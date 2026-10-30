/* Animations partagées · Tech Vaucanson */
(() => {
  'use strict';
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function animateCount(el, value) {
    if (!el) return;
    const target = Number(value);
    if (!Number.isFinite(target)) { el.textContent = value; return; }
    if (reduced) { el.textContent = target; el.dataset.animValue = String(target); return; }
    if (el.dataset.animValue === String(target)) return;
    el.dataset.animValue = String(target);
    const from = Number(el.dataset.animFrom || 0);
    const start = performance.now();
    const duration = 700;
    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(from + (target - from) * eased);
      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = target;
    }
    requestAnimationFrame(tick);
  }

  function initReveal() {
    const els = [...document.querySelectorAll('[data-reveal]')];
    if (!els.length) return;
    if (reduced || !('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('visible')); return; }
    els.forEach((el) => el.classList.add('reveal'));
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    els.forEach((el) => observer.observe(el));
  }

  function initScrollProgress() {
    const bar = document.getElementById('scrollProgress');
    if (!bar) return;
    let ticking = false;
    const update = () => {
      const root = document.documentElement;
      const max = root.scrollHeight - root.clientHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, root.scrollTop / max)) : 0;
      bar.style.transform = `scaleX(${progress})`;
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  function init() {
    initReveal();
    initScrollProgress();
  }

  window.TVAnimations = { init, animateCount, reduced };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
