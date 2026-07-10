// WhatsApp-style collapsible header for Journal/Faith/Kapwa/Tulong — the
// tabs that scroll at the window level (Kaibigan has its own internal-scroll
// header collapse in companion.js, since its chat pane owns scrolling and
// the window itself never moves there).
//
// Scrolling down hides the header (translateY(-100%), eased); scrolling up
// snaps it straight back (translateY(0), no transition — instant, the way
// WhatsApp's own list header reappears). #oc-root's top padding shrinks and
// grows in step so content never jumps when the header's space disappears
// or returns.
const HIDE_AFTER = 24; // px scrolled down before the header may hide at all
const MOVE_THRESHOLD = 4; // ignore sub-pixel/rubber-band jitter

let lastScrollY = window.scrollY;
let hidden = false;

// The shared header (see index.html) is only ever shown outside Kaibigan
// (home), which has its own header baked into its non-scrolling layout.
function activeHeader() {
  if (document.body.dataset.activeView === 'home') return null;
  const header = document.getElementById('oc-shared-header');
  return header && !header.hidden ? header : null;
}

function baselinePadding() {
  return 'calc(env(safe-area-inset-top, 0px) + 20px)';
}

function setHidden(next, header) {
  if (hidden === next) return;
  hidden = next;
  const root = document.getElementById('oc-root');
  if (next) {
    header.style.transition = 'transform 0.3s ease';
    header.style.transform = 'translateY(-100%)';
    if (root) { root.style.transition = 'padding-top 0.3s ease'; root.style.paddingTop = baselinePadding(); }
  } else {
    header.style.transition = 'transform 0.15s ease';
    header.style.transform = 'translateY(0)';
    if (root) { root.style.transition = 'padding-top 0.15s ease'; root.style.paddingTop = header.offsetHeight + 'px'; }
  }
}

export function initScrollHeader() {
  window.addEventListener('scroll', () => {
    const header = activeHeader();
    const y = window.scrollY;
    if (!header) { lastScrollY = y; return; }

    const delta = y - lastScrollY;
    if (y <= HIDE_AFTER) {
      setHidden(false, header);
    } else if (delta > MOVE_THRESHOLD) {
      setHidden(true, header);
    } else if (delta < -MOVE_THRESHOLD) {
      setHidden(false, header);
    }
    lastScrollY = y;
  }, { passive: true });

  window.addEventListener('resize', () => {
    const header = activeHeader();
    const root = document.getElementById('oc-root');
    if (header && root && !hidden) root.style.paddingTop = header.offsetHeight + 'px';
  });
}

// Called on every tab switch so the newly-opened view always starts with
// its header fully visible and #oc-root padded to match — no leftover
// hidden/collapsed state from whatever the member scrolled to last time.
export function resetScrollHeader() {
  lastScrollY = window.scrollY;
  hidden = false;
  const header = activeHeader();
  const root = document.getElementById('oc-root');
  if (header) {
    header.style.transition = 'none';
    header.style.transform = 'translateY(0)';
  }
  if (root) {
    root.style.transition = 'none';
    root.style.paddingTop = header ? header.offsetHeight + 'px' : baselinePadding();
  }
  requestAnimationFrame(() => {
    if (header) header.style.transition = '';
    if (root) root.style.transition = '';
  });
}
