/**
 * Dead Click Detector — catches buttons that don't work when clicked.
 *
 * Monitors all clicks on interactive elements (button, a, [role="button"]).
 * A click is "dead" if it produces no network request, no navigation, and
 * no DOM change within 3 seconds.  Rapid repeated clicks on the same element
 * ("rage clicks") are also flagged.
 *
 * Reports to sentinel via /api/system/client-error so the autopilot
 * can detect and fix broken UI handlers.
 */

// ── Config ───────────────────────────────────────────────────────────────────

const DEAD_CLICK_TIMEOUT_MS = 3_000;
const RAGE_CLICK_THRESHOLD = 3;
const RAGE_CLICK_WINDOW_MS = 2_000;
const DEDUP_COOLDOWN_MS = 60_000; // Don't report same element within 60s
const MAX_REPORTS_PER_SESSION = 20; // Cap to prevent runaway reporting

// ── State ────────────────────────────────────────────────────────────────────

let initialized = false;
let reportCount = 0;
const reportedElements = new Map<string, number>(); // selector → last report timestamp
const rageTracker = new Map<string, number[]>(); // selector → click timestamps

// ── Element Identification ───────────────────────────────────────────────────

function getSelector(el: Element): string {
  const parts: string[] = [];
  const tag = el.tagName.toLowerCase();
  if (el.id) return `${tag}#${el.id}`;

  parts.push(tag);

  // Add distinguishing attributes
  const text = (el.textContent || "").trim().slice(0, 30);
  const ariaLabel = el.getAttribute("aria-label");
  const dataTestId = el.getAttribute("data-testid");
  const className = el.className && typeof el.className === "string"
    ? el.className.split(/\s+/).slice(0, 2).join(".")
    : "";

  if (dataTestId) parts.push(`[data-testid="${dataTestId}"]`);
  else if (ariaLabel) parts.push(`[aria-label="${ariaLabel}"]`);
  else if (className) parts.push(`.${className}`);

  if (text) parts.push(`{${text}}`);

  // Add page context
  return `${window.location.pathname} > ${parts.join("")}`;
}

function isInteractive(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === "button" || tag === "a") return true;
  if (el.getAttribute("role") === "button") return true;
  if (el.getAttribute("role") === "tab") return true;
  if (el.getAttribute("role") === "menuitem") return true;
  if (tag === "input" && ["submit", "button"].includes((el as HTMLInputElement).type)) return true;
  return false;
}

function findInteractiveAncestor(el: Element | null): Element | null {
  let current = el;
  let depth = 0;
  while (current && depth < 8) {
    if (isInteractive(current)) return current;
    current = current.parentElement;
    depth++;
  }
  return null;
}

// ── Network Activity Tracking ────────────────────────────────────────────────

let networkActivitySince = 0;
let pendingFetches = 0;

function patchFetch() {
  const origFetch = window.fetch;
  window.fetch = function (...args) {
    networkActivitySince = Date.now();
    pendingFetches++;
    const promise = origFetch.apply(this, args);
    promise.then(() => { pendingFetches = Math.max(0, pendingFetches - 1); })
      .catch(() => { pendingFetches = Math.max(0, pendingFetches - 1); });
    return promise;
  };
}

function patchXHR() {
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (...args: any[]) {
    this.addEventListener("loadstart", () => {
      networkActivitySince = Date.now();
      pendingFetches++;
    }, { once: true });
    this.addEventListener("loadend", () => {
      pendingFetches = Math.max(0, pendingFetches - 1);
    }, { once: true });
    return origOpen.apply(this, args);
  };
}

// ── Reporting ────────────────────────────────────────────────────────────────

function report(type: "dead_click" | "rage_click", selector: string, el: Element) {
  if (reportCount >= MAX_REPORTS_PER_SESSION) return;

  const now = Date.now();
  const lastReport = reportedElements.get(selector) || 0;
  if (now - lastReport < DEDUP_COOLDOWN_MS) return;

  reportedElements.set(selector, now);
  reportCount++;

  const detail = {
    type,
    selector,
    tagName: el.tagName.toLowerCase(),
    text: (el.textContent || "").trim().slice(0, 50),
    ariaLabel: el.getAttribute("aria-label"),
    disabled: (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true",
    href: (el as HTMLAnchorElement).href || undefined,
    page: window.location.pathname,
    url: window.location.href,
    userAgent: navigator.userAgent,
  };

  const message = type === "dead_click"
    ? `[DEAD_CLICK] Button does nothing: ${selector}`
    : `[RAGE_CLICK] User frustrated with: ${selector}`;

  fetch("/api/system/client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      message,
      stack: JSON.stringify(detail, null, 2),
      url: window.location.href,
      userAgent: navigator.userAgent,
    }),
  }).catch(() => {});
}

// ── Click Handler ────────────────────────────────────────────────────────────

function handleClick(event: MouseEvent) {
  const target = event.target as Element | null;
  if (!target) return;

  const interactive = findInteractiveAncestor(target);
  if (!interactive) return;

  // Skip disabled buttons — expected to do nothing
  if ((interactive as HTMLButtonElement).disabled) return;
  if (interactive.getAttribute("aria-disabled") === "true") return;

  // Skip links with href (they navigate)
  if (interactive.tagName.toLowerCase() === "a" && (interactive as HTMLAnchorElement).href) return;

  // Skip dropdown/menu triggers — they toggle popover/menu state via CSS/JS
  // without network requests or navigation (not a dead click)
  const ariaHasPopup = interactive.getAttribute("aria-haspopup");
  const ariaExpanded = interactive.getAttribute("aria-expanded");
  const role = interactive.getAttribute("role");
  if (ariaHasPopup || ariaExpanded !== null) return;
  if (role === "menuitem" || role === "tab" || role === "combobox" || role === "option") return;
  // Skip elements inside radix/shadcn portals and popovers
  if (interactive.closest("[data-radix-popper-content-wrapper]")) return;
  if (interactive.closest("[role='menu']") || interactive.closest("[role='listbox']")) return;
  // Skip navigation toggle buttons (common pattern in responsive layouts)
  const ariaLabel = interactive.getAttribute("aria-label");
  if (ariaLabel && /toggle|menu|nav|sidebar|close|dismiss|expand|collapse/i.test(ariaLabel)) return;

  const selector = getSelector(interactive);
  const now = Date.now();

  // ── Rage click detection ──
  const clicks = rageTracker.get(selector) || [];
  clicks.push(now);
  // Keep only clicks within the rage window
  const recent = clicks.filter(t => now - t < RAGE_CLICK_WINDOW_MS);
  rageTracker.set(selector, recent);

  if (recent.length >= RAGE_CLICK_THRESHOLD) {
    report("rage_click", selector, interactive);
    rageTracker.set(selector, []); // Reset after reporting
    return; // Don't also check for dead click
  }

  // ── Dead click detection ──
  const clickTime = now;
  const currentPath = window.location.pathname;
  const currentHash = window.location.hash;

  setTimeout(() => {
    // Check if anything happened since the click
    const networkHappened = networkActivitySince > clickTime || pendingFetches > 0;
    const navigated = window.location.pathname !== currentPath || window.location.hash !== currentHash;

    if (!networkHappened && !navigated) {
      report("dead_click", selector, interactive);
    }
  }, DEAD_CLICK_TIMEOUT_MS);
}

// ── Initialization ───────────────────────────────────────────────────────────

export function initDeadClickDetector(): void {
  if (initialized || typeof window === "undefined") return;
  if (process.env.NODE_ENV === "development") return; // Only in production
  initialized = true;

  patchFetch();
  patchXHR();

  document.addEventListener("click", handleClick, { capture: true, passive: true });
}
