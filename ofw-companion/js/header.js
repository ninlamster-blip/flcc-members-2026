// WhatsApp-style collapsible header, identical mechanics on every tab.
// Scrolling down hides the header (translateY(-100%), eased); scrolling up
// snaps it straight back (translateY(0), no transition — instant, the way
// WhatsApp's own header reappears) and it stays put ("frozen") there.
//
// Every tab scrolls at the window level, and every header is
// position: sticky — see style.css. Sticky headers are part of the normal
// scrolling flow, which iOS Safari's compositor tracks natively frame-by-
// frame (position: fixed elements are known to visually detach/jump there
// during momentum scrolling instead), and they reserve their own space in
// the flow automatically, so no JS needs to manage a spacer's padding for
// either header — the `spacer`/`baselinePadding` params below exist only
// in case a future header needs that (e.g. isn't sticky for some reason).
//
// Journal/Faith/Kapwa/Tulong share one header (#oc-shared-header). Kaibigan
// has its own (different content, and it also folds away the ritual pill/
// audio drop in step via onToggle) but is built from the same
// createHeaderController() factory below, so the scroll-direction decision
// logic is identical for both.
const HIDE_AFTER = 24; // px scrolled down before the header may hide at all
const MOVE_THRESHOLD = 10; // net px of travel needed before reacting

// getScrollTop: () => number — current scroll position of whatever scrolls
//   (window.scrollY, or a chat pane's scrollTop).
// header: the element to slide off/on screen.
// spacer: optional — the element whose padding-top is kept in sync with
//   the header's rendered height, so content underneath never jumps.
//   Omit for a sticky header, which reserves its own space in the flow.
// baselinePadding: required if spacer is set — the spacer's padding-top
//   once the header is hidden.
// onToggle(hidden): optional, called whenever the hidden/visible state
//   changes — lets a caller fold other elements away in step (Kaibigan
//   uses this to also tuck away the ritual pill and audio drop).
// A long scroll to the top is rarely one continuous gesture — it's usually
// several swipes with a brief lift-and-regrip between them. That seam can
// produce a real, brief reversal in reported scroll position (momentum
// overshoot correcting itself, rubber-banding, etc.) well past what's
// reasonable to call "sensor noise," so no fixed pixel threshold can
// reliably tell it apart from a genuine direction change. This cooldown
// instead uses time: right after any decision, further opposite-direction
// triggers are ignored for a short window, since a spurious gesture-seam
// blip resolves within a frame or two while a deliberate reversal persists.
const REVERSAL_COOLDOWN_MS = 350;

export function createHeaderController({ getScrollTop, header, spacer, baselinePadding, onToggle }) {
  // anchor is the position we last made a hide/show decision from — NOT
  // the previous frame's position. Comparing against the previous frame
  // meant even one frame per animation frame (the earlier fix) was still
  // vulnerable to real touch-scroll deceleration/settling noise: two
  // consecutive frames can easily drift in opposite directions by a few
  // px, which would cross a small threshold in both directions in a row
  // and flip the header back and forth — visible as shaking. Anchoring to
  // the last *decision* point means a decision only fires once genuine
  // net travel accumulates from there, and small back-and-forth noise
  // between frames can never cancel itself out into a false trigger.
  let anchor = getScrollTop();
  let hidden = false;
  let ticking = false;
  let cooldownUntil = 0;

  function setHidden(next) {
    if (hidden === next) return;
    hidden = next;
    if (next) {
      header.style.transition = 'transform 0.3s ease';
      header.style.transform = 'translateY(-100%)';
      if (spacer) spacer.style.paddingTop = baselinePadding;
    } else {
      header.style.transition = 'transform 0.15s ease';
      header.style.transform = 'translateY(0)';
      if (spacer) spacer.style.paddingTop = header.offsetHeight + 'px';
    }
    onToggle?.(next);
  }

  function process() {
    ticking = false;
    const y = getScrollTop();
    if (y <= HIDE_AFTER) {
      setHidden(false);
      anchor = y;
      return;
    }
    const delta = y - anchor;
    // anchor always tracks genuine net travel, cooldown or not — otherwise
    // it goes stale mid-gesture and corrupts the delta for whatever comes
    // next. The cooldown only gates the visual flip itself, and only when
    // that flip would actually change the current state.
    if (delta > MOVE_THRESHOLD) {
      anchor = y;
      if (!hidden && performance.now() >= cooldownUntil) {
        setHidden(true);
        cooldownUntil = performance.now() + REVERSAL_COOLDOWN_MS;
      }
    } else if (delta < -MOVE_THRESHOLD) {
      anchor = y;
      if (hidden && performance.now() >= cooldownUntil) {
        setHidden(false);
        cooldownUntil = performance.now() + REVERSAL_COOLDOWN_MS;
      }
    }
    // else: not enough net travel from the anchor yet — leave it alone,
    // so a momentary reversal can't get "banked" as new baseline noise.
  }

  // Raw scroll events can fire many times per animation frame (especially
  // during touch/momentum scrolling), each carrying a tiny, noisy delta.
  // Reacting to every one of them let the hide/show decision flip back and
  // forth mid-gesture, interrupting the CSS transition each time — which
  // reads as a stutter. Coalescing to one read+decision per frame fixes it.
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(process);
  }

  // Forces the header fully visible with no transition — used when a tab
  // is (re)opened, so it never starts hidden/collapsed from a previous
  // scroll position.
  function reset() {
    anchor = getScrollTop();
    hidden = false;
    cooldownUntil = 0;
    header.style.transition = 'none';
    header.style.transform = 'translateY(0)';
    if (spacer) spacer.style.paddingTop = header.offsetHeight + 'px';
    onToggle?.(false);
    requestAnimationFrame(() => { header.style.transition = ''; });
  }

  // Keeps the spacer padded to the header's actual rendered height whenever
  // it changes shape while visible — window resize, the large-text setting,
  // or content that loads in after the header first appeared (e.g. the
  // weather chip, which shows up once geolocation/network resolve).
  if (spacer && 'ResizeObserver' in window) {
    new ResizeObserver(() => {
      if (!hidden) spacer.style.paddingTop = header.offsetHeight + 'px';
    }).observe(header);
  }

  return { onScroll, reset };
}

// ── Journal/Faith/Kapwa/Tulong: one shared header, driven by window scroll ──

let shared = null;

function activeSharedHeader() {
  if (document.body.dataset.activeView === 'home') return null;
  const header = document.getElementById('oc-shared-header');
  return header && !header.hidden ? header : null;
}

export function initScrollHeader() {
  shared = createHeaderController({
    getScrollTop: () => window.scrollY,
    header: document.getElementById('oc-shared-header'),
    // No spacer: position: sticky reserves its own space in the flow
    // automatically, so there's no padding for JS to manage here.
  });

  window.addEventListener('scroll', () => {
    if (activeSharedHeader()) shared.onScroll();
  }, { passive: true });
}

// Called on every tab switch so the newly-opened view always starts with
// its header fully visible and its spacer padded to match — no leftover
// hidden/collapsed state from whatever the member scrolled to last time.
export function resetScrollHeader() {
  if (activeSharedHeader()) shared.reset();
}
