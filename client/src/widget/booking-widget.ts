/**
 * Rebooked Embeddable Booking Widget
 *
 * A lightweight, self-contained script that businesses embed on their
 * website via a single <script> tag. It renders a floating "Book Now"
 * button and opens an iframe modal pointing to the public booking page.
 *
 * Usage:
 *   <script src="https://app.rebooked.org/widget.js"
 *           data-slug="acme-salon"
 *           data-color="#00A896"></script>
 *
 * Config via data attributes:
 *   data-slug   (required) - tenant booking page slug
 *   data-color  (optional) - brand colour for the button (default #00A896)
 *   data-position (optional) - "left" or "right" (default "right")
 *   data-text   (optional) - button label (default "Book Now")
 */
(function () {
  // Prevent double-initialisation
  if ((window as any).__REBOOKED_WIDGET_LOADED) return;
  (window as any).__REBOOKED_WIDGET_LOADED = true;

  // ── Read configuration from <script> tag data attributes ──────────────
  const scriptTag = document.currentScript as HTMLScriptElement | null;
  const slug = scriptTag?.getAttribute("data-slug") || "";
  const color = scriptTag?.getAttribute("data-color") || "#00A896";
  const position = scriptTag?.getAttribute("data-position") || "right";
  const buttonText = scriptTag?.getAttribute("data-text") || "Book Now";

  if (!slug) {
    console.warn("[Rebooked Widget] Missing data-slug attribute.");
    return;
  }

  // Derive the origin so the iframe URL works in both dev and prod
  const origin = scriptTag?.src
    ? new URL(scriptTag.src).origin
    : window.location.origin;
  const bookingUrl = `${origin}/book/${encodeURIComponent(slug)}?embed=true`;

  // ── Helpers ────────────────────────────────────────────────────────────
  function createEl<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    styles: Partial<CSSStyleDeclaration>,
  ): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    Object.assign(el.style, styles);
    return el;
  }

  // ── Floating button ───────────────────────────────────────────────────
  const btn = createEl("button", {
    position: "fixed",
    bottom: "20px",
    [position === "left" ? "left" : "right"]: "20px",
    zIndex: "9999",
    background: color,
    color: "#fff",
    border: "none",
    borderRadius: "28px",
    padding: "12px 24px",
    fontSize: "15px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    transition: "transform 0.2s, box-shadow 0.2s",
  });
  btn.textContent = `\uD83D\uDCC5 ${buttonText}`;
  btn.setAttribute("aria-label", buttonText);

  btn.addEventListener("mouseenter", () => {
    btn.style.transform = "scale(1.05)";
    btn.style.boxShadow = "0 6px 20px rgba(0,0,0,0.3)";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.transform = "scale(1)";
    btn.style.boxShadow = "0 4px 14px rgba(0,0,0,0.25)";
  });

  // ── Modal overlay + iframe ────────────────────────────────────────────
  let overlay: HTMLDivElement | null = null;

  function openModal() {
    if (overlay) return;

    overlay = createEl("div", {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      background: "rgba(0,0,0,0.6)",
      zIndex: "10000",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      opacity: "0",
      transition: "opacity 0.25s",
    }) as HTMLDivElement;

    const container = createEl("div", {
      position: "relative",
      width: "90vw",
      maxWidth: "480px",
      height: "85vh",
      maxHeight: "700px",
      borderRadius: "16px",
      overflow: "hidden",
      background: "#fff",
      boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
    });

    const closeBtn = createEl("button", {
      position: "absolute",
      top: "8px",
      right: "8px",
      zIndex: "10001",
      background: "rgba(0,0,0,0.5)",
      color: "#fff",
      border: "none",
      borderRadius: "50%",
      width: "32px",
      height: "32px",
      fontSize: "18px",
      lineHeight: "32px",
      textAlign: "center",
      cursor: "pointer",
      padding: "0",
    });
    closeBtn.textContent = "\u2715";
    closeBtn.setAttribute("aria-label", "Close booking widget");

    const iframe = createEl("iframe", {
      width: "100%",
      height: "100%",
      border: "none",
    }) as unknown as HTMLIFrameElement;
    iframe.src = bookingUrl;
    iframe.title = "Book an appointment";
    iframe.allow = "payment";

    container.appendChild(closeBtn);
    container.appendChild(iframe);
    overlay.appendChild(container);
    document.body.appendChild(overlay);

    // Fade in
    requestAnimationFrame(() => {
      if (overlay) overlay.style.opacity = "1";
    });

    // Close handlers
    closeBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener("keydown", escHandler);
  }

  function closeModal() {
    if (!overlay) return;
    overlay.style.opacity = "0";
    const ref = overlay;
    setTimeout(() => ref.remove(), 250);
    overlay = null;
    document.removeEventListener("keydown", escHandler);
  }

  function escHandler(e: KeyboardEvent) {
    if (e.key === "Escape") closeModal();
  }

  // ── Attach ────────────────────────────────────────────────────────────
  btn.addEventListener("click", openModal);

  // Listen for "booking:close" postMessage from the iframe
  window.addEventListener("message", (e) => {
    if (e.data === "rebooked:close") closeModal();
  });

  // Inject into the DOM
  document.body.appendChild(btn);
})();
