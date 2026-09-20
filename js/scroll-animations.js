/* ==========================================================================
   scroll-animations.js — GSAP + ScrollTrigger setups
   Falls back to the IntersectionObserver reveal in main.js when GSAP is
   missing, and does nothing (content is static) under reduced motion.
   ========================================================================== */
(() => {
  'use strict';

  const App = (window.App = window.App || {});
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init() {
    if (reduced) return; // CSS keeps everything visible and static

    const { gsap, ScrollTrigger } = window;
    if (!gsap || !ScrollTrigger) { App.initRevealFallback && App.initRevealFallback(); return; }
    gsap.registerPlugin(ScrollTrigger);

    /* --- Hero intro, staged after the preloader --- */
    const heroIntro = () => {
      gsap.fromTo('.hero-anim',
        { opacity: 0, y: 40, filter: 'blur(8px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, ease: 'expo.out', stagger: 0.09, clearProps: 'filter' });
      // Fade only, and on the inner shell: the bar is fixed at top:0 with ~17px of
      // headroom, so any upward translate clips against the viewport edge. An inline
      // transform on .site-nav would also outrank .is-hidden and break hide-on-scroll.
      gsap.from('.nav-shell', { opacity: 0, duration: .9, ease: 'power2.out', delay: 0.2, clearProps: 'opacity' });
    };
    document.documentElement.classList.contains('hero-ready') ? heroIntro() : document.addEventListener('app:ready', heroIntro, { once: true });

    /* Hero copy drifts up and fades as you scroll away */
    gsap.to('.hero-copy', {
      yPercent: -18, opacity: 0.1, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });

    /* --- Generic reveals, batched so siblings stagger together --- */
    const dirs = { left: { x: -60, y: 0 }, right: { x: 60, y: 0 } };
    gsap.utils.toArray('[data-reveal]').forEach((el) => {
      const d = dirs[el.dataset.reveal] || { x: 0, y: 50 };
      gsap.set(el, { opacity: 0, x: d.x, y: d.y });
    });
    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 88%',
      once: true,
      onEnter: (batch) => gsap.to(batch, { opacity: 1, x: 0, y: 0, duration: 1, ease: 'expo.out', stagger: 0.1, overwrite: true }),
    });

    /* --- Section titles: 3D flip-up --- */
    gsap.utils.toArray('.section-title').forEach((t) => {
      gsap.from(t, {
        rotateX: -55, transformPerspective: 900, transformOrigin: '50% 100%', duration: 1.2, ease: 'expo.out',
        scrollTrigger: { trigger: t, start: 'top 90%', once: true },
      });
    });

    /* --- Skill cards: rotate/scale in from depth --- */
    gsap.utils.toArray('.skill-card').forEach((card, i) => {
      gsap.from(card, {
        rotateY: i % 2 ? -18 : 18, scale: 0.92, transformPerspective: 1000, duration: 1.2, ease: 'expo.out',
        scrollTrigger: { trigger: card, start: 'top 90%', once: true },
      });
    });

    /* --- Timeline progress line fills with scroll --- */
    const progress = document.querySelector('.timeline__progress');
    if (progress) {
      gsap.fromTo(progress, { scaleY: 0 }, {
        scaleY: 1, ease: 'none',
        scrollTrigger: { trigger: '.timeline', start: 'top 70%', end: 'bottom 60%', scrub: 0.6 },
      });
    }

    /* --- Project cards: rise from a tilted plane --- */
    gsap.utils.toArray('.project-card').forEach((card, i) => {
      gsap.from(card, {
        rotateX: 25, y: 80, z: -120, transformPerspective: 1200, duration: 1.3, ease: 'expo.out', delay: i * 0.08,
        clearProps: 'transform', // hand transform back to the tilt effect
        scrollTrigger: { trigger: '.projects-grid', start: 'top 85%', once: true },
      });
    });

    /* --- Subtle parallax on the skills sphere --- */
    gsap.to('.tag-sphere-wrap', {
      yPercent: -8, ease: 'none',
      scrollTrigger: { trigger: '#skills', start: 'top bottom', end: 'bottom top', scrub: true },
    });

    // Recalculate once fonts/images settle
    window.addEventListener('load', () => ScrollTrigger.refresh());
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
