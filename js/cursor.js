/* ==========================================================================
   cursor.js — custom animated cursor with a glowing canvas trail
   Enabled only for fine pointers (mouse/trackpad) with motion allowed.
   ========================================================================== */
(() => {
  'use strict';

  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || reduced) return;

  function init() {
    const wrap = document.querySelector('.cursor');
    if (!wrap) return;
    const dot = wrap.querySelector('.cursor__dot');
    const ring = wrap.querySelector('.cursor__ring');
    const canvas = wrap.querySelector('.cursor__trail');
    const ctx = canvas.getContext('2d');
    document.documentElement.classList.add('has-cursor');

    const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
    const ringPos = { ...mouse };
    const trail = []; // recent points for the glow trail
    const MAX = 18;
    let dpr = 1, visible = false;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX; mouse.y = e.clientY;
      if (!visible) { visible = true; wrap.classList.remove('is-hidden'); ringPos.x = mouse.x; ringPos.y = mouse.y; }
    }, { passive: true });
    document.addEventListener('mouseleave', () => { visible = false; wrap.classList.add('is-hidden'); trail.length = 0; });
    window.addEventListener('mousedown', () => wrap.classList.add('is-down'));
    window.addEventListener('mouseup', () => wrap.classList.remove('is-down'));

    // Grow the ring over interactive elements
    const interactive = 'a, button, .tilt, .tag-sphere, input, textarea, [data-bs-toggle]';
    document.addEventListener('mouseover', (e) => { if (e.target.closest(interactive)) wrap.classList.add('is-hover'); });
    document.addEventListener('mouseout', (e) => { if (e.target.closest(interactive) && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(interactive))) wrap.classList.remove('is-hover'); });

    const tick = () => {
      ringPos.x += (mouse.x - ringPos.x) * 0.18;
      ringPos.y += (mouse.y - ringPos.y) * 0.18;
      dot.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0)`;
      ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;

      // Trail: fading gradient stroke through recent positions
      if (visible) trail.push({ x: mouse.x, y: mouse.y });
      while (trail.length > MAX || (!visible && trail.length)) trail.shift();
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      if (trail.length > 2) {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let i = 1; i < trail.length; i++) {
          const t = i / trail.length;
          ctx.beginPath();
          ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
          ctx.lineTo(trail[i].x, trail[i].y);
          ctx.strokeStyle = `rgba(${Math.round(61 + 78 * t)}, ${Math.round(139 - 47 * t + 90 * t * t)}, ${Math.round(255 - 50 * t)}, ${t * 0.55})`;
          ctx.lineWidth = t * 5;
          ctx.shadowColor = 'rgba(139, 92, 246, .9)';
          ctx.shadowBlur = 12;
          ctx.stroke();
        }
      }
      requestAnimationFrame(tick);
    };
    wrap.classList.add('is-hidden');
    requestAnimationFrame(tick);
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
