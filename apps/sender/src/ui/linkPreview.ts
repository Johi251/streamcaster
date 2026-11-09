/**
 * Link-Preview Modal — confirm a URL before it is cast.
 *
 * The matching styles already exist in `apps/sender/public/style.css`
 * (`.preview-overlay`, `.preview-card`, `.preview-domain`, `.preview-url`,
 * `.preview-btn-open`, `.preview-btn-block`) — this module only builds the
 * corresponding DOM and owns the confirm / cancel lifecycle. No new CSS.
 *
 * URL validation is factored into `parseSafeUrl` so it can be unit-tested
 * without a DOM (vitest runs in a node environment here).
 */

export interface ParsedLink {
  ok: boolean;
  domain?: string;
  reason?: "invalid" | "scheme";
}

/**
 * Validate a cast target. Only `http(s)` URLs are allowed — never
 * `javascript:`, `data:`, `file:` or anything else. Returns the registrable
 * domain (with a leading `www.` stripped) on success.
 */
export function parseSafeUrl(rawUrl: string): ParsedLink {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "scheme" };
  }
  const host = url.hostname.replace(/^www\./i, "");
  return { ok: true, domain: host };
}

export interface LinkPreviewHandlers {
  onConfirm: (url: string) => void;
  onCancel?: () => void;
}

/**
 * Show a confirmation modal for `rawUrl`. Resolves nothing — use the
 * callbacks. Returns a cleanup function that removes the overlay (also invoked
 * automatically on confirm / cancel / Escape / backdrop click).
 *
 * If the URL is not castable, `onCancel` is called immediately and an empty
 * cleanup is returned — no modal is shown, so the caller's error path still
 * fires.
 */
export function showLinkPreview(rawUrl: string, handlers: LinkPreviewHandlers): () => void {
  const parsed = parseSafeUrl(rawUrl);
  if (!parsed.ok) {
    handlers.onCancel?.();
    return () => {};
  }
  const domain = parsed.domain ?? "";
  const returnFocus = document.activeElement as HTMLElement | null;

  const overlay = document.createElement("div");
  overlay.className = "preview-overlay";

  const card = document.createElement("div");
  card.className = "preview-card";

  const heading = document.createElement("h3");
  heading.style.margin = "0 0 14px";
  heading.style.fontSize = "16px";
  heading.textContent = "Cast this link?";

  const domainEl = document.createElement("div");
  domainEl.className = "preview-domain";
  domainEl.textContent = domain;

  const urlEl = document.createElement("div");
  urlEl.className = "preview-url";
  urlEl.textContent = rawUrl;

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "12px";

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "preview-btn-open";
  openBtn.textContent = "Cast";

  const blockBtn = document.createElement("button");
  blockBtn.type = "button";
  blockBtn.className = "preview-btn-block";
  blockBtn.textContent = "Abbrechen";

  actions.append(openBtn, blockBtn);
  card.append(heading, domainEl, urlEl, actions);
  overlay.append(card);

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    returnFocus?.focus?.();
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      handlers.onCancel?.();
    }
  };

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      close();
      handlers.onCancel?.();
    }
  });
  openBtn.addEventListener("click", () => {
    close();
    handlers.onConfirm(rawUrl);
  });
  blockBtn.addEventListener("click", () => {
    close();
    handlers.onCancel?.();
  });

  document.addEventListener("keydown", onKey);
  document.body.append(overlay);
  openBtn.focus();

  return close;
}
