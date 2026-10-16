// Behaviour for the static case-study pages and the /work/ hub: reading-progress bar, mobile menu,
// scroll-reveal and the screenshot viewer. No dependencies, and every feature is progressive
// enhancement — the pages read and navigate fine without any of it.
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // ───────────── reading progress (the red hairline under the nav) ─────────────
  const prog = $('.ald-prog');
  if (prog) {
    let queued = false;
    const paint = () => {
      queued = false;
      const max = document.documentElement.scrollHeight - innerHeight;
      prog.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(paint); } };
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue);
    paint();
  }

  // ───────────── mobile menu ─────────────
  const burger = $('.ald-burger');
  const menu = $('#menu');
  if (burger && menu) {
    const background = ['main', 'footer'].map((s) => $(s)).filter(Boolean);
    const focusables = () => [burger, ...$$('a[href], button:not([disabled])', menu)];
    const set = (open) => {
      menu.hidden = !open;
      burger.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.classList.toggle('is-locked', open);
      // keep the page behind the dialog out of the tab order and the accessibility tree
      background.forEach((el) => { el.inert = open; });
    };
    const close = () => { if (!menu.hidden) { set(false); burger.focus(); } };
    burger.addEventListener('click', () => {
      if (menu.hidden) { set(true); const first = $('a', menu); if (first) first.focus(); } else close();
    });
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', (e) => {
      if (menu.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      const items = focusables();
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    // the burger disappears at desktop width — don't leave the page locked
    matchMedia('(min-width: 921px)').addEventListener('change', (e) => { if (e.matches && !menu.hidden) set(false); });
  }

  // ───────────── scroll reveal ─────────────
  const reveal = $$('.case-rv');
  if (reveal.length) {
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        for (const en of entries) if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      reveal.forEach((el) => io.observe(el));
    } else {
      reveal.forEach((el) => el.classList.add('is-in'));
    }
  }

  // ───────────── screenshot viewer ─────────────
  const box = $('#lightbox');
  const shots = $$('.case-shot[data-lb]').sort((a, b) => a.dataset.lb - b.dataset.lb);
  if (box && typeof box.showModal === 'function' && shots.length) {
    const img = $('img', box), cap = $('.case-lb-cap', box);
    const prev = $('.case-lb-prev', box), next = $('.case-lb-next', box);
    let at = 0;
    const show = (i) => {
      at = (i + shots.length) % shots.length;
      const thumb = $('img', shots[at]);
      img.src = shots[at].href;
      img.alt = thumb.alt;
      cap.textContent = `${at + 1} / ${shots.length}`;
      prev.hidden = next.hidden = shots.length < 2;
      // warm the neighbours so stepping through feels instant
      [at - 1, at + 1].forEach((n) => { new Image().src = shots[(n + shots.length) % shots.length].href; });
    };
    shots.forEach((a, i) => a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; // let "open in new tab" through
      e.preventDefault();
      show(i);
      box.showModal();
    }));
    prev.addEventListener('click', () => show(at - 1));
    next.addEventListener('click', () => show(at + 1));
    $('.case-lb-close', box).addEventListener('click', () => box.close());
    box.addEventListener('click', (e) => { if (e.target === box) box.close(); }); // click on the dark area
    box.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(at - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); show(at + 1); }
    });
    box.addEventListener('close', () => { img.removeAttribute('src'); });
  }
})();
