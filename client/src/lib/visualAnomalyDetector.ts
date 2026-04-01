/**
 * Visual Anomaly Detector — catches graphical glitches that don't match the theme.
 *
 * Periodically scans visible elements for color contrast anomalies:
 *  - White/light boxes on a dark page (unstyled elements leaking through)
 *  - Dark text on dark background (invisible text)
 *  - Light text on light background (invisible text)
 *  - Pure browser-default colors (#fff / #000) that bypass theme variables
 *  - Zero-size visible elements (broken renders)
 *
 * Reports to sentinel via /api/system/client-error with [VISUAL_ANOMALY] prefix.
 */

// ── Config ───────────────────────────────────────────────────────────────────

const SCAN_INTERVAL_MS = 30_000; // Scan every 30 seconds
const DEDUP_COOLDOWN_MS = 300_000; // 5 min cooldown per element
const MAX_REPORTS_PER_SESSION = 10;
const INITIAL_DELAY_MS = 8_000; // Wait for page to settle after load

// Lightness thresholds (0 = black, 1 = white)
const DARK_PAGE_THRESHOLD = 0.3; // Page is "dark" if lightness < this
const LIGHT_ELEMENT_THRESHOLD = 0.82; // Element is "light" if lightness > this
const INVISIBLE_LOW = 0.3; // Both text + bg below this = invisible
const INVISIBLE_HIGH = 0.7; // Both text + bg above this = invisible
const CONTRAST_MIN_DIFF = 0.15; // Minimum lightness difference for readability

// ── State ────────────────────────────────────────────────────────────────────

let initialized = false;
let reportCount = 0;
let scanTimer: ReturnType<typeof setInterval> | null = null;
const reportedElements = new Map<string, number>(); // selector → last report ts

// Theme-change suppression — skip scans for 3s after a theme change
let suppressUntil = 0;

/**
 * Call when the theme changes to suppress visual anomaly scans
 * during the transition period. Prevents false positives.
 */
export function suppressForThemeChange(): void {
  suppressUntil = Date.now() + 3_000;
  // Clear existing anomaly reports since colors are expected to change
  reportedElements.clear();
}

// ── Color Parsing ────────────────────────────────────────────────────────────

function getLightness(colorStr: string): number | null {
  if (!colorStr || colorStr === "transparent" || colorStr === "rgba(0, 0, 0, 0)") return null;

  // oklch(L C H) — L is already 0-1
  const oklchMatch = colorStr.match(/oklch\(\s*([\d.]+)/);
  if (oklchMatch) return parseFloat(oklchMatch[1]);

  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = colorStr.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]) / 255;
    const g = parseInt(rgbMatch[2]) / 255;
    const b = parseInt(rgbMatch[3]) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  // hsl(h, s%, l%) or hsla(h, s%, l%, a)
  const hslMatch = colorStr.match(/hsla?\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*([\d.]+)%/);
  if (hslMatch) return parseFloat(hslMatch[1]) / 100;

  return null;
}

function isTransparent(colorStr: string): boolean {
  if (!colorStr || colorStr === "transparent") return true;
  const alphaMatch = colorStr.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\)/);
  if (alphaMatch && parseFloat(alphaMatch[1]) < 0.1) return true;
  return false;
}

function isBrowserDefault(colorStr: string): boolean {
  // Pure white or pure black with no alpha — likely unstyled
  return (
    colorStr === "rgb(255, 255, 255)" ||
    colorStr === "rgb(0, 0, 0)" ||
    colorStr === "rgba(255, 255, 255, 1)" ||
    colorStr === "rgba(0, 0, 0, 1)"
  );
}

// ── Modal/Overlay Detection ──────────────────────────────────────────────────

function isModalOrOverlay(el: Element): boolean {
  const role = el.getAttribute("role");
  if (role === "dialog" || role === "alertdialog" || role === "tooltip") return true;
  if (el.hasAttribute("data-radix-popper-content-wrapper")) return true;
  const cls = el.className && typeof el.className === "string" ? el.className : "";
  if (/\b(modal|popover|dropdown|tooltip|dialog|sheet|overlay)\b/i.test(cls)) return true;
  // Check ancestors (up to 3 levels)
  let parent = el.parentElement;
  for (let i = 0; i < 3 && parent; i++) {
    const pRole = parent.getAttribute("role");
    if (pRole === "dialog" || pRole === "alertdialog") return true;
    parent = parent.parentElement;
  }
  return false;
}

// ── Element Selector (matches deadClickDetector pattern) ─��───────────────────

function getSelector(el: Element): string {
  const parts: string[] = [];
  const tag = el.tagName.toLowerCase();
  if (el.id) return `${tag}#${el.id}`;

  parts.push(tag);

  const dataTestId = el.getAttribute("data-testid");
  const ariaLabel = el.getAttribute("aria-label");
  const className =
    el.className && typeof el.className === "string"
      ? el.className.split(/\s+/).filter(c => !c.startsWith("__")).slice(0, 2).join(".")
      : "";

  if (dataTestId) parts.push(`[data-testid="${dataTestId}"]`);
  else if (ariaLabel) parts.push(`[aria-label="${ariaLabel.slice(0, 30)}"]`);
  else if (className) parts.push(`.${className}`);

  return `${window.location.pathname} > ${parts.join("")}`;
}

// ── Reporting ────────────────────────────────────────────────────────────────

type AnomalyType =
  | "light_box_on_dark_page"
  | "invisible_text_dark"
  | "invisible_text_light"
  | "browser_default_color"
  | "zero_size_element";

const ANOMALY_LABELS: Record<AnomalyType, string> = {
  light_box_on_dark_page: "White/light box on dark page",
  invisible_text_dark: "Dark text on dark background (invisible)",
  invisible_text_light: "Light text on light background (invisible)",
  browser_default_color: "Unstyled element using browser default color",
  zero_size_element: "Zero-size visible element (broken render)",
};

function reportAnomaly(
  type: AnomalyType,
  selector: string,
  el: Element,
  details: Record<string, unknown>,
) {
  if (reportCount >= MAX_REPORTS_PER_SESSION) return;

  const now = Date.now();
  const lastReport = reportedElements.get(selector) || 0;
  if (now - lastReport < DEDUP_COOLDOWN_MS) return;

  reportedElements.set(selector, now);
  reportCount++;

  const label = ANOMALY_LABELS[type];
  const rect = el.getBoundingClientRect();

  const message = `[VISUAL_ANOMALY] ${label}: ${selector}`;

  fetch("/api/system/client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      message,
      stack: JSON.stringify(
        {
          anomalyType: type,
          label,
          selector,
          tagName: el.tagName.toLowerCase(),
          page: window.location.pathname,
          boundingBox: {
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          ...details,
        },
        null,
        2,
      ),
      url: window.location.href,
      userAgent: navigator.userAgent,
    }),
  }).catch(() => {});
}

// ── Scanner ──────────────────────────────────────────────────────────────────

function scanVisibleElements(): void {
  if (reportCount >= MAX_REPORTS_PER_SESSION) {
    if (scanTimer) clearInterval(scanTimer);
    return;
  }

  // Skip scan during theme transitions
  if (Date.now() < suppressUntil) return;

  // Get page theme lightness
  const rootStyle = getComputedStyle(document.documentElement);
  const pageBgColor = rootStyle.backgroundColor;
  const pageLightness = getLightness(pageBgColor);

  // If we can't determine the page background, skip this scan
  if (pageLightness === null) return;
  const isDarkPage = pageLightness < DARK_PAGE_THRESHOLD;

  // Query elements that could have visual issues
  // Focus on containers, cards, inputs, and content elements — not every DOM node
  const candidates = document.querySelectorAll(
    [
      "[class*='bg-']",
      "[class*='card']",
      "[class*='Card']",
      "[role='alert']",
      "[role='dialog']",
      "[role='status']",
      "input",
      "textarea",
      "select",
      "button",
      "table",
      "th",
      "td",
      ".toast",
      ".popover",
      ".dropdown-menu",
      ".modal",
    ].join(","),
  );

  for (const el of candidates) {
    // Skip elements not in viewport
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      // Zero-size but visible?
      const style = getComputedStyle(el);
      if (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        el.textContent?.trim()
      ) {
        reportAnomaly("zero_size_element", getSelector(el), el, {
          display: style.display,
          visibility: style.visibility,
          hasContent: true,
        });
      }
      continue;
    }

    // Skip off-screen elements
    if (
      rect.bottom < 0 ||
      rect.top > window.innerHeight ||
      rect.right < 0 ||
      rect.left > window.innerWidth
    ) {
      continue;
    }

    const style = getComputedStyle(el);
    const bgColor = style.backgroundColor;
    const textColor = style.color;
    const bgLightness = getLightness(bgColor);
    const textLightness = getLightness(textColor);

    // Skip transparent backgrounds — they inherit from parent
    if (isTransparent(bgColor)) continue;

    // Check 1: Light box on dark page (skip modals/overlays — they're intentionally light)
    if (isDarkPage && bgLightness !== null && bgLightness > LIGHT_ELEMENT_THRESHOLD && !isModalOrOverlay(el)) {
      reportAnomaly("light_box_on_dark_page", getSelector(el), el, {
        pageLightness: pageLightness.toFixed(3),
        elementBgLightness: bgLightness.toFixed(3),
        bgColor,
        isDarkPage,
      });
      continue;
    }

    // Check 2: Browser default colors leaking through
    if (isBrowserDefault(bgColor) && isDarkPage) {
      reportAnomaly("browser_default_color", getSelector(el), el, {
        bgColor,
        pageLightness: pageLightness.toFixed(3),
        isDarkPage,
      });
      continue;
    }

    // Check 3: Invisible text (dark on dark)
    if (
      bgLightness !== null &&
      textLightness !== null &&
      bgLightness < INVISIBLE_LOW &&
      textLightness < INVISIBLE_LOW &&
      Math.abs(bgLightness - textLightness) < CONTRAST_MIN_DIFF
    ) {
      reportAnomaly("invisible_text_dark", getSelector(el), el, {
        bgLightness: bgLightness.toFixed(3),
        textLightness: textLightness.toFixed(3),
        bgColor,
        textColor,
        contrastDiff: Math.abs(bgLightness - textLightness).toFixed(3),
      });
      continue;
    }

    // Check 4: Invisible text (light on light)
    if (
      bgLightness !== null &&
      textLightness !== null &&
      bgLightness > INVISIBLE_HIGH &&
      textLightness > INVISIBLE_HIGH &&
      Math.abs(bgLightness - textLightness) < CONTRAST_MIN_DIFF
    ) {
      reportAnomaly("invisible_text_light", getSelector(el), el, {
        bgLightness: bgLightness.toFixed(3),
        textLightness: textLightness.toFixed(3),
        bgColor,
        textColor,
        contrastDiff: Math.abs(bgLightness - textLightness).toFixed(3),
      });
    }
  }
}

// ── Drag-Select Detection ────────────────────────────────────────────────────
// When a user click-drags over a region, check all elements in that area
// for visual anomalies. This catches glitches the periodic scan might miss
// because the user is literally looking at that exact spot.

let dragStartX = 0;
let dragStartY = 0;
let isDragging = false;

function handleMouseDown(e: MouseEvent) {
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  isDragging = false;
}

function handleMouseUp(e: MouseEvent) {
  if (!isDragging) return;
  isDragging = false;

  // Only check if they dragged at least 30px (actual selection, not accidental)
  const dx = Math.abs(e.clientX - dragStartX);
  const dy = Math.abs(e.clientY - dragStartY);
  if (dx < 30 && dy < 30) return;

  // Define the drag rectangle
  const left = Math.min(dragStartX, e.clientX);
  const top = Math.min(dragStartY, e.clientY);
  const right = Math.max(dragStartX, e.clientX);
  const bottom = Math.max(dragStartY, e.clientY);

  // Get page theme
  const rootStyle = getComputedStyle(document.documentElement);
  const pageBgColor = rootStyle.backgroundColor;
  const pageLightness = getLightness(pageBgColor);
  if (pageLightness === null) return;
  const isDarkPage = pageLightness < DARK_PAGE_THRESHOLD;

  // Find all elements at points within the drag region
  const step = 20; // Sample every 20px
  const checked = new Set<Element>();

  for (let x = left; x <= right; x += step) {
    for (let y = top; y <= bottom; y += step) {
      const el = document.elementFromPoint(x, y);
      if (!el || checked.has(el)) continue;
      checked.add(el);

      const style = getComputedStyle(el);
      const bgColor = style.backgroundColor;
      if (isTransparent(bgColor)) continue;

      const bgL = getLightness(bgColor);
      const textL = getLightness(style.color);

      // Light box on dark page (skip modals/overlays)
      if (isDarkPage && bgL !== null && bgL > LIGHT_ELEMENT_THRESHOLD && !isModalOrOverlay(el)) {
        reportAnomaly("light_box_on_dark_page", getSelector(el), el, {
          trigger: "drag_select",
          pageLightness: pageLightness.toFixed(3),
          elementBgLightness: bgL.toFixed(3),
          bgColor,
          dragRegion: { left, top, right, bottom },
        });
      }

      // Browser default
      if (isBrowserDefault(bgColor) && isDarkPage) {
        reportAnomaly("browser_default_color", getSelector(el), el, {
          trigger: "drag_select",
          bgColor,
          pageLightness: pageLightness.toFixed(3),
        });
      }

      // Invisible text
      if (bgL !== null && textL !== null && Math.abs(bgL - textL) < CONTRAST_MIN_DIFF) {
        if (bgL < INVISIBLE_LOW && textL < INVISIBLE_LOW) {
          reportAnomaly("invisible_text_dark", getSelector(el), el, {
            trigger: "drag_select",
            bgLightness: bgL.toFixed(3),
            textLightness: textL.toFixed(3),
            bgColor,
            textColor: style.color,
          });
        } else if (bgL > INVISIBLE_HIGH && textL > INVISIBLE_HIGH) {
          reportAnomaly("invisible_text_light", getSelector(el), el, {
            trigger: "drag_select",
            bgLightness: bgL.toFixed(3),
            textLightness: textL.toFixed(3),
            bgColor,
            textColor: style.color,
          });
        }
      }
    }
  }
}

function handleMouseMove(e: MouseEvent) {
  // Detect drag (mouse moved > 10px while button down)
  if (e.buttons === 1) {
    const dx = Math.abs(e.clientX - dragStartX);
    const dy = Math.abs(e.clientY - dragStartY);
    if (dx > 10 || dy > 10) isDragging = true;
  }
}

// ── Initialization ───────────────────────────────────────────────────────────

export function initVisualAnomalyDetector(): void {
  if (initialized || typeof window === "undefined") return;
  if (process.env.NODE_ENV === "development") return;
  initialized = true;

  // Periodic background scans
  setTimeout(() => {
    scanVisibleElements();
    scanTimer = setInterval(scanVisibleElements, SCAN_INTERVAL_MS);
  }, INITIAL_DELAY_MS);

  // Drag-select detection — checks the exact region the user is looking at
  document.addEventListener("mousedown", handleMouseDown, { passive: true });
  document.addEventListener("mousemove", handleMouseMove, { passive: true });
  document.addEventListener("mouseup", handleMouseUp, { passive: true });
}
