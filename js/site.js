// Site-level glue code — everything here sits outside the dc-runtime's
// component (which must stay inline in index.html, see the <script
// data-dc-script> comment there) and outside the vendor runtime file
// (support.js). Safe to run at any point relative to those —
// it only defines functions and registers event listeners, none of which
// touch the DOM until the events they're waiting for actually fire.

// The browser restores the previous scroll position on a reload BEFORE any
// of our JS runs — including before GSAP/ScrollTrigger exist. This page's
// pinned "digital heart" section (#stage) measures and sets itself up
// relative to whatever scroll position is current at that moment; starting
// that setup already scrolled deep into the page (verified: reloading from
// scrollY 4000 reopens at ~3990) corrupts its pin/spacer geometry, and the
// section can render detached from its normal spot — overlapping earlier
// content instead of sitting where "Made to be loved" belongs. Reloads
// should simply start clean, so opt out of scroll restoration; a direct link
// to a section (a URL with a #hash) is left alone.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (!location.hash) scrollTo(0, 0);

// Opening a case study and pressing Back must land where the visitor left. Since the browser's own
// restoration is switched off above, the home page keeps its own bookmark: a click on a project card
// stores the scroll position, and a back/forward load puts it back once the page has finished
// building (see restoreFromCaseStudy below).
const ALD_HOME_KEY = 'ald:home';
const navType = (performance.getEntriesByType('navigation')[0] || {}).type;
window.__aldRestore = null;
if (navType === 'back_forward') {
  try { window.__aldRestore = JSON.parse(sessionStorage.getItem(ALD_HOME_KEY)); } catch (_) { /* storage blocked */ }
}
document.addEventListener('click', (e) => {
  const card = e.target.closest && e.target.closest('.ald-work-link');
  if (!card) return;
  try {
    sessionStorage.setItem(ALD_HOME_KEY, JSON.stringify({ y: Math.round(scrollY) }));
  } catch (_) { /* storage blocked — Back simply lands at the top */ }
});

// ScrollTrigger.refresh() measures every trigger by briefly jumping the page
// to scrollY 0 and back. With `html{scroll-behavior:smooth}` (style.css) that
// jump is animated instead of instant, so the measurement happens at the
// *current* scroll position and the cached positions come out offset by it
// (verified: refreshing at scrollY 3000 left the hero trigger with
// start:-3000, end:-2181 — faded hero, invisible heart after scrolling back —
// and refreshing after "More" left the pinned stage's start 1400px stale).
// Force instant scrolling for the duration of the (synchronous) refresh, so it
// is safe to run from anywhere on the page. Every refresh this page triggers
// goes through here.
function aldSafeRefresh() {
  if (!window.ScrollTrigger) return;
  const root = document.documentElement;
  const prev = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  ScrollTrigger.refresh();
  root.style.scrollBehavior = prev;
}
window.__aldSafeRefresh = aldSafeRefresh;

// Safety net: the pixel-heart canvases size themselves from their container's
// getBoundingClientRect() on mount, which can race a late-settling layout
// (webfont swap, external stylesheet, viewport not yet final). An extra
// 'resize' dispatch once everything has truly settled makes them re-measure
// and self-correct, without touching the generated dc-runtime.
//
// The stage heart's frame is flex-sized off the copy above it (.ald-stage-copy),
// so its height depends on the Geist webfont's own metrics — Google Fonts can
// finish loading well after window 'load' (font-display:swap lets the page
// paint with a fallback font first), so a fit() done at 'load' can still be
// measuring pre-swap layout. Re-fit again once the webfont has actually settled.
function resyncMotion() {
  dispatchEvent(new Event('resize'));
  aldSafeRefresh();
}
addEventListener('load', () => setTimeout(resyncMotion, 60));
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(resyncMotion);
}

// Once scrolling goes quiet, re-sync every trigger's progress against the real,
// current scroll position — cheap, and it can only correct drift.
let scrollSettleTimer;
addEventListener('scroll', () => {
  clearTimeout(scrollSettleTimer);
  scrollSettleTimer = setTimeout(() => { if (window.ScrollTrigger) ScrollTrigger.update(); }, 120);
}, { passive: true });

// In-page anchor links (nav, CTAs, "Back to top") used to scroll smoothly through
// the CSS `scroll-behavior:smooth` on <html>. That CSS is switched off while GSAP is
// running (see html.ald-gsap in style.css), so do the smooth scroll explicitly.
// scrollIntoView honours the `scroll-padding-top` set on <html>.
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest && e.target.closest('a[href^="#"]');
  if (!a) return;
  const target = a.hash.length > 1 ? document.getElementById(decodeURIComponent(a.hash.slice(1))) : null;
  if (!target) return;
  e.preventDefault();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  history.pushState(null, '', a.hash);
});

// Put the scroll position back after returning from a case study. Wait until the page has finished
// building — fonts and triggers settled, then a refresh — otherwise the pinned "Made to be loved"
// section would measure from the wrong place.
(function restoreFromCaseStudy() {
  const saved = window.__aldRestore;
  if (!saved || !saved.y) return;
  const t0 = performance.now();
  (function wait() {
    const ready = document.readyState === 'complete' && window.ScrollTrigger && document.querySelector('.ald-work');
    if (!ready && performance.now() - t0 < 6000) return void setTimeout(wait, 80);
    setTimeout(() => {
      aldSafeRefresh();
      scrollTo(0, saved.y);
      if (window.ScrollTrigger) ScrollTrigger.update();
    }, 200);
  })();
})();

// Language menu (<details class="ald-lang"> in the nav): close it on an outside click or Escape.
document.addEventListener('click', (e) => {
  document.querySelectorAll('details.ald-lang[open]').forEach((d) => { if (!d.contains(e.target)) d.open = false; });
});
document.addEventListener('keydown', (e) => {
  const d = e.key === 'Escape' && document.querySelector('details.ald-lang[open]');
  if (d) { d.open = false; d.querySelector('summary').focus(); }
});
