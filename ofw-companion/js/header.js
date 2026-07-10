// WhatsApp-style collapsible header, shared by every tab. Scrolling down
// hides the header (translateY(-100%), eased); scrolling up snaps it
// straight back (translateY(0), no transition — instant, the way
// WhatsApp's own header reappears) and it stays put ("frozen") there. A
// spacer element's top padding is kept in sync with the header's height so
// content underneath never sits under it — but that padding change is
// applied instantly, never animated: unlike transform, animating padding
// forces the browser to recompute layout for the whole spacer subtree on
// every frame, on the main thread, at the exact moment it's competing with
// an active scroll gesture for that same thread — which is what stutter
// actually is. Only the (compositor-only, cheap) transform animates.
//
// Journal/Faith/Kapwa/Tulong share one fixed header (#oc-shared-header) and
// scroll at the window level. Kaibigan has its own header baked into its
// non-scrolling layout and scrolls internally (its chat pane, not the
// window, moves) — see companion.js, which builds its controller from the
// same createHeaderController() factory below so both behave identically.
const HIDE_AFTER = 24; // px scrolled down before the header may hide at all
const MOVE_THRESHOLD = 10; // net px of travel needed before reacting

// getScrollTop: () => number — current scroll position of whatever scrolls
//   (window.scrollY, or a chat pane's scrollTop).
// header: the element to slide off/on screen.
// spacer: the element whose padding-top is kept in sync with the header's
//   rendered height, so content underneath never jumps.
// baselinePadding: the spacer's padding-top once the header is hidden.
// onToggle(hidden): optional, called whenever the hidden/visible state
//   changes — lets a caller fold other elements away in step (Kaibigan
//   uses this to also tuck away the ritual pill and audio drop).
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
    if (delta > MOVE_THRESHOLD) {
      setHidden(true);
      anchor = y;
    } else if (delta < -MOVE_THRESHOLD) {
      setHidden(false);
      anchor = y;
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
    spacer: document.getElementById('oc-root'),
    baselinePadding: 'calc(env(safe-area-inset-top, 0px) + 20px)',
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
