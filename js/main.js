/* ==========================================================================
   main.js — general interactions
   preloader · smooth scroll (Lenis) · navbar · mobile menu · hero text effects
   counters · magnetic buttons · tilt cards · skills tag sphere · project modal
   contact form (Formspree) · IntersectionObserver reveal fallback
   ========================================================================== */
(() => {
  'use strict';

  const root = document.documentElement;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  // Shared namespace so other scripts (scroll-animations.js) can hook in
  const App = (window.App = window.App || {});
  App.prefersReduced = prefersReduced;

  /* ---------- Preloader → hero intro ---------- */
  function initPreloader() {
    const loader = $('#preloader');
    const done = () => {
      if (!loader || loader.classList.contains('is-done')) return;
      loader.classList.add('is-done');
      root.classList.add('hero-ready');
      document.dispatchEvent(new CustomEvent('app:ready'));
      setTimeout(() => loader.remove(), 800);
    };
    if (prefersReduced) return done();
    // Short minimum for polish, hard cap so slow CDNs never block content
    const minTime = new Promise((r) => setTimeout(r, 1300));
    const loaded = new Promise((r) => (document.readyState === 'complete' ? r() : window.addEventListener('load', r, { once: true })));
    Promise.all([minTime, loaded]).then(done);
    setTimeout(done, 3500);
  }

  /* ---------- Smooth scrolling (Lenis) ---------- */
  function initSmoothScroll() {
    if (prefersReduced || typeof window.Lenis !== 'function') return;
    const lenis = new window.Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    App.lenis = lenis;
    // Drive Lenis from GSAP's ticker when present so ScrollTrigger stays in sync
    if (window.gsap && window.ScrollTrigger) {
      lenis.on('scroll', window.ScrollTrigger.update);
      window.gsap.ticker.add((t) => lenis.raf(t * 1000));
      window.gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }

  function scrollToTarget(target) {
    const offset = -(parseInt(getComputedStyle(root).getPropertyValue('--nav-h'), 10) || 64) + 1;
    if (App.lenis) App.lenis.scrollTo(target, { offset, duration: 1.3 });
    else {
      const y = target.getBoundingClientRect().top + window.scrollY + offset;
      window.scrollTo({ top: y, behavior: prefersReduced ? 'auto' : 'smooth' });
    }
  }

  // Delegate all in-page anchor clicks
  function initAnchors() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = document.getElementById(id.slice(1));
      if (!target) return;
      e.preventDefault();
      closeMenu(false);
      scrollToTarget(target);
      history.replaceState(null, '', id === '#hero' ? location.pathname : id);
      // Move focus for keyboard/screen-reader users without jumping
      if (id !== '#hero') { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
    });
  }

  /* ---------- Navbar: scrolled state, hide on scroll down, active link ---------- */
  function initNavbar() {
    const nav = $('#siteNav');
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      nav.classList.toggle('is-scrolled', y > 30);
      const menuOpen = document.body.classList.contains('menu-open');
      nav.classList.toggle('is-hidden', !menuOpen && y > 500 && y > lastY + 4);
      if (y < lastY - 4 || y < 500) nav.classList.remove('is-hidden');
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const links = $$('.nav-links .nav-link');
    const sections = links.map((l) => document.getElementById(l.getAttribute('href').slice(1))).filter(Boolean);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((l) => {
          const on = l.getAttribute('href') === '#' + en.target.id;
          l.classList.toggle('is-active', on);
          on ? l.setAttribute('aria-current', 'true') : l.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => io.observe(s));
  }

  /* ---------- Mobile full-screen menu (focus trap + Esc) ---------- */
  const menu = $('#mobileMenu');
  const toggle = $('#menuToggle');
  function openMenu() {
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add('is-open'));
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
    document.body.classList.add('menu-open');
    App.lenis && App.lenis.stop();
    setTimeout(() => { const f = $('a', menu); f && f.focus(); }, 300);
  }
  function closeMenu(returnFocus = true) {
    if (!menu || menu.hidden) return;
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    document.body.classList.remove('menu-open');
    App.lenis && App.lenis.start();
    setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, prefersReduced ? 0 : 700);
    if (returnFocus) toggle.focus();
  }
  function initMobileMenu() {
    if (!toggle || !menu) return;
    toggle.addEventListener('click', () => (toggle.getAttribute('aria-expanded') === 'true' ? closeMenu() : openMenu()));
    document.addEventListener('keydown', (e) => {
      if (menu.hidden) return;
      if (e.key === 'Escape') closeMenu();
      if (e.key === 'Tab') {
        const items = [toggle, ...$$('a, button', menu)];
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    window.addEventListener('resize', () => { if (window.innerWidth >= 992) closeMenu(false); });
  }

  /* ---------- Hero: decoding role text ---------- */
  function initRoleDecoder() {
    const el = $('#roleDecoder');
    if (!el) return;
    let roles;
    try { roles = JSON.parse(el.dataset.roles); } catch { return; }
    if (prefersReduced || roles.length < 2) return;
    const glyphs = '!<>-_\\/[]{}—=+*^?#01';
    let idx = 0;

    const decodeTo = (next) => new Promise((resolve) => {
      const from = el.textContent;
      const len = Math.max(from.length, next.length);
      const queue = [];
      for (let i = 0; i < len; i++) {
        const start = Math.floor(Math.random() * 20);
        queue.push({ from: from[i] || '', to: next[i] || '', start, end: start + Math.floor(Math.random() * 20) + 8 });
      }
      let frame = 0;
      const tick = () => {
        let out = '', complete = 0;
        for (const q of queue) {
          if (frame >= q.end) { complete++; out += q.to; }
          else if (frame >= q.start) out += glyphs[Math.floor(Math.random() * glyphs.length)];
          else out += q.from;
        }
        el.textContent = out;
        if (complete === queue.length) return resolve();
        frame++;
        requestAnimationFrame(tick);
      };
      tick();
    });

    const loop = async () => {
      await new Promise((r) => setTimeout(r, 2600));
      idx = (idx + 1) % roles.length;
      await decodeTo(roles[idx]);
      loop();
    };
    document.addEventListener('app:ready', loop, { once: true });
  }

  /* ---------- Hero: typing tagline ---------- */
  function initTyping() {
    const el = $('#typedTagline');
    if (!el || prefersReduced) return;
    const text = el.dataset.text;
    el.textContent = '';
    document.addEventListener('app:ready', () => {
      let i = 0;
      const type = () => {
        el.textContent = text.slice(0, ++i);
        if (i < text.length) setTimeout(type, text[i - 1] === ',' || text[i - 1] === '—' ? 180 : 24 + Math.random() * 30);
      };
      setTimeout(type, 700);
    }, { once: true });
  }

  /* ---------- Count-up stats ---------- */
  function initCounters() {
    const counters = $$('.counter');
    if (prefersReduced) return; // numbers already rendered in HTML
    counters.forEach((c) => (c.textContent = (0).toFixed(+c.dataset.decimals || 0)));
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        obs.unobserve(en.target);
        const el = en.target, target = parseFloat(el.dataset.target), dec = +el.dataset.decimals || 0;
        const dur = 1800, t0 = performance.now();
        const step = (now) => {
          const p = Math.min(1, (now - t0) / dur);
          const eased = 1 - Math.pow(1 - p, 4);
          el.textContent = (target * eased).toFixed(dec);
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    counters.forEach((c) => io.observe(c));
  }

  /* ---------- Magnetic buttons ---------- */
  function initMagnetic() {
    if (prefersReduced || !finePointer) return;
    $$('.magnetic').forEach((btn) => {
      const strength = 0.3;
      btn.addEventListener('mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
        btn.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
      });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    });
  }

  /* ---------- 3D tilt cards (mouse-position math + CSS transforms) ---------- */
  function initTilt() {
    if (prefersReduced || !finePointer) return;
    $$('.tilt').forEach((card) => {
      const max = card.classList.contains('project-card') ? 10 : 6;
      let raf = 0;
      card.addEventListener('mousemove', (e) => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const r = card.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
          card.style.transition = 'transform .1s linear, border-color .4s, box-shadow .4s';
          card.style.transform = `perspective(1000px) rotateX(${(0.5 - py) * max}deg) rotateY(${(px - 0.5) * max}deg) translateZ(0)`;
          card.style.setProperty('--gx', px * 100 + '%');
          card.style.setProperty('--gy', py * 100 + '%');
        });
      });
      card.addEventListener('mouseleave', () => {
        cancelAnimationFrame(raf);
        card.style.transition = 'transform .8s cubic-bezier(.16,1,.3,1), border-color .4s, box-shadow .4s';
        card.style.transform = '';
      });
    });
  }

  /* ---------- Hero holographic portrait: 3D tilt toward the pointer ---------- */
  function initHolo() {
    const stage = $('#holoStage');
    if (!stage || prefersReduced || !finePointer) return;
    let raf = 0;
    window.addEventListener('pointermove', (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5;
        stage.style.transform = `rotateY(${x * 22}deg) rotateX(${-y * 16}deg)`;
      });
    }, { passive: true });
  }

  /* ---------- Skills: 3D tag sphere (DOM + projection math) ----------
     Built from the category chip lists so skills are defined once in HTML. */
  function initTagSphere() {
    const sphere = $('#tagSphere');
    if (!sphere) return;
    const names = [...new Set($$('[data-skill-group] li').map((li) => li.textContent.trim()))];
    const hot = new Set(['LangGraph', 'MCP', 'AWS Bedrock', 'RAG', 'FastAPI', 'Python', 'LangChain', 'Multi-Agent Systems']);
    const tags = names.map((n) => {
      const s = document.createElement('span');
      s.className = 'tag-sphere__tag' + (hot.has(n) ? ' is-hot' : '');
      s.textContent = n;
      sphere.appendChild(s);
      return s;
    });
    if (prefersReduced) { sphere.classList.add('is-static'); return; }

    // Fibonacci sphere distribution
    const N = tags.length;
    const pts = tags.map((_, i) => {
      const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = Math.PI * (3 - Math.sqrt(5)) * i;
      return { x: Math.cos(th) * r, y, z: Math.sin(th) * r };
    });

    let radius = sphere.clientWidth * 0.4;
    let vx = 0.003, vy = 0.004;        // current angular velocity
    let tx = vx, ty = vy;              // target velocity (from pointer)
    let dragging = false, lastX = 0, lastY = 0, running = false, raf = 0;
    new ResizeObserver(() => (radius = sphere.clientWidth * 0.4)).observe(sphere);

    const rotate = (ax, ay) => {
      const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay);
      for (const p of pts) {
        const y1 = p.y * cx - p.z * sx, z1 = p.y * sx + p.z * cx;   // around X
        const x2 = p.x * cy + z1 * sy, z2 = -p.x * sy + z1 * cy;    // around Y
        p.x = x2; p.y = y1; p.z = z2;
      }
    };
    const render = () => {
      for (let i = 0; i < N; i++) {
        const p = pts[i], scale = (p.z + 2) / 3; // 0.33 (back) → 1 (front)
        tags[i].style.transform = `translate(-50%, -50%) translate3d(${p.x * radius}px, ${p.y * radius}px, 0) scale(${scale})`;
        tags[i].style.opacity = (0.15 + 0.85 * ((p.z + 1) / 2)).toFixed(2);
        tags[i].style.zIndex = Math.round(p.z * 100) + 100;
      }
    };
    const loop = () => {
      if (!dragging) { vx += (tx - vx) * 0.05; vy += (ty - vy) * 0.05; }
      rotate(vx, vy);
      render();
      raf = requestAnimationFrame(loop);
    };

    sphere.addEventListener('pointermove', (e) => {
      const r = sphere.getBoundingClientRect();
      if (dragging) {
        vy = (e.clientX - lastX) * 0.004; vx = -(e.clientY - lastY) * 0.004;
        lastX = e.clientX; lastY = e.clientY;
      } else {
        ty = ((e.clientX - r.left) / r.width - 0.5) * 0.03;
        tx = -((e.clientY - r.top) / r.height - 0.5) * 0.03;
      }
    });
    sphere.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; sphere.setPointerCapture(e.pointerId); });
    sphere.addEventListener('pointerup', () => { dragging = false; tx = vx; ty = vy; });
    sphere.addEventListener('pointerleave', () => { if (!dragging) { tx = 0.003; ty = 0.004; } });

    // Only animate while visible
    new IntersectionObserver(([en]) => {
      if (en.isIntersecting && !running) { running = true; loop(); }
      else if (!en.isIntersecting && running) { running = false; cancelAnimationFrame(raf); }
    }).observe(sphere);
    render();
  }

  /* ---------- Project detail modal (Bootstrap) ---------- */
  function initProjectModal() {
    const modal = $('#projectModal');
    if (!modal) return;
    modal.addEventListener('show.bs.modal', (e) => {
      const card = e.relatedTarget && e.relatedTarget.closest('[data-project]');
      if (!card) return;
      const img = $('img', card);
      $('#projectModalTitle').textContent = $('.project-card__title', card).textContent;
      $('#projectModalTag').textContent = $('.project-card__tag', card).textContent;
      $('#projectModalImg').src = img.src;
      $('#projectModalImg').alt = img.alt;
      $('#projectModalBody').innerHTML = $('.project-card__details', card).innerHTML;
    });
    // Pause smooth scroll while the modal owns scrolling
    modal.addEventListener('shown.bs.modal', () => App.lenis && App.lenis.stop());
    modal.addEventListener('hidden.bs.modal', () => App.lenis && App.lenis.start());
  }

  /* ---------- Contact form → Formspree (AJAX) with mailto fallback ---------- */
  function initContactForm() {
    const form = $('#contactForm');
    if (!form) return;
    const status = $('#formStatus');
    const btn = $('#cf-submit');
    const label = $('.btn-label', btn);
    const icon = $('.bi', btn);
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    const setError = (id, msg) => {
      const input = $('#' + id), err = $('#' + id + '-err');
      input.closest('.field').classList.toggle('has-error', !!msg);
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (msg) input.setAttribute('aria-describedby', id + '-err'); else input.removeAttribute('aria-describedby');
      err.textContent = msg || '';
      return !msg;
    };
    const validate = () => {
      const name = $('#cf-name').value.trim(), email = $('#cf-email').value.trim(), msg = $('#cf-message').value.trim();
      const ok = [
        setError('cf-name', name.length < 2 ? 'Please enter your name.' : ''),
        setError('cf-email', !emailRe.test(email) ? 'Please enter a valid email address.' : ''),
        setError('cf-message', msg.length < 10 ? 'A little more detail, please (10+ characters).' : ''),
      ].every(Boolean);
      if (!ok) $('.has-error .form-control', form).focus();
      return ok;
    };
    ['cf-name', 'cf-email', 'cf-message'].forEach((id) => $('#' + id).addEventListener('input', () => {
      if ($('#' + id).closest('.field').classList.contains('has-error')) setError(id, '');
    }));

    const setStatus = (text, type) => { status.textContent = text; status.className = 'form-status mono' + (type ? ' is-' + type : ''); };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      setStatus('');
      if (!validate()) return;
      const data = new FormData(form);
      if (data.get('_gotcha')) return; // bot

      // Not configured yet → open the visitor's email client instead
      if (form.action.includes('YOUR_FORM_ID')) {
        const body = `${data.get('message')}\n\n— ${data.get('name')} (${data.get('email')})${data.get('company') ? '\n' + data.get('company') : ''}`;
        window.location.href = `mailto:upadhyay02nitesh@gmail.com?subject=${encodeURIComponent('Portfolio enquiry from ' + data.get('name'))}&body=${encodeURIComponent(body)}`;
        setStatus('Opening your email client…', 'success');
        return;
      }

      btn.disabled = true; btn.classList.add('is-loading');
      label.textContent = 'Sending…'; icon.className = 'bi bi-arrow-repeat';
      try {
        const res = await fetch(form.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error('Request failed');
        form.reset();
        setStatus('✓ Message sent — I’ll reply within 24 hours.', 'success');
      } catch {
        setStatus('Something went wrong. Please email me directly.', 'error');
      } finally {
        btn.disabled = false; btn.classList.remove('is-loading');
        label.textContent = 'Send message'; icon.className = 'bi bi-send';
      }
    });
  }

  /* ---------- Reveal fallback (used when GSAP is unavailable) ---------- */
  App.initRevealFallback = function () {
    const els = $$('[data-reveal]');
    if (!('IntersectionObserver' in window)) return els.forEach((el) => el.classList.add('is-visible'));
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-visible'); obs.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach((el) => io.observe(el));
  };

  /* ---------- Boot ---------- */
  function boot() {
    const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
    initSmoothScroll();
    initAnchors();
    initNavbar();
    initMobileMenu();
    initRoleDecoder();
    initTyping();
    initCounters();
    initMagnetic();
    initTilt();
    initHolo();
    initTagSphere();
    initProjectModal();
    initContactForm();
    initVoiceGreeting();
    initPreloader();
  }
  /* ---------- Spoken intro (Web Speech API) ----------
     Greets on arrival. Chrome/Safari drop speak() that is not tied to a user
     gesture, so when the autoplay attempt is swallowed we arm a one-shot listener
     and greet on the visitor's first interaction instead. The button remains as a
     replay/stop control, and a muted preference is remembered. */
  function initVoiceGreeting() {
    const btn = $('#voiceGreet');
    const synth = window.speechSynthesis;
    if (!btn || !synth || typeof SpeechSynthesisUtterance === 'undefined') return;
    btn.hidden = false;

    const label = btn.querySelector('.btn-voice__label');
    const LINE = btn.dataset.line;
    let muted = false;
    try { muted = localStorage.getItem('voiceGreetMuted') === '1'; } catch (e) {}

    const idle = () => { btn.classList.remove('is-speaking'); label.textContent = 'Hear intro'; btn.setAttribute('aria-label', 'Play spoken intro'); };
    const stop = () => { synth.cancel(); idle(); };

    function say() {
      if (muted) return false;
      const u = new SpeechSynthesisUtterance(LINE);
      u.rate = 0.98; u.pitch = 1;
      const voices = synth.getVoices();
      u.voice = voices.find((v) => v.lang === 'en-IN') || voices.find((v) => v.lang.startsWith('en')) || null;
      u.onend = idle; u.onerror = idle;
      btn.classList.add('is-speaking');
      label.textContent = 'Stop';
      btn.setAttribute('aria-label', 'Stop spoken intro');
      synth.speak(u);
      return true;
    }

    // Greet on arrival, after the preloader clears so it is not talking over a blank screen.
    function autoGreet() {
      if (!say()) return;
      // If the browser silently refused, fall back to the first real interaction.
      setTimeout(() => {
        if (synth.speaking || synth.pending) return;
        idle();
        const once = () => { say(); ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((e) => window.removeEventListener(e, once)); };
        ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((e) => window.addEventListener(e, once, { once: true, passive: true }));
      }, 350);
    }

    // Voice list loads async on Chrome; wait for it so we do not get the default robot.
    const kick = () => setTimeout(autoGreet, 600);
    if (synth.getVoices().length) kick();
    else synth.addEventListener('voiceschanged', kick, { once: true });

    btn.addEventListener('click', () => {
      if (btn.classList.contains('is-speaking')) {
        stop();
        muted = true;                                   // an explicit stop means "not again"
        try { localStorage.setItem('voiceGreetMuted', '1'); } catch (e) {}
        return;
      }
      muted = false;
      try { localStorage.removeItem('voiceGreetMuted'); } catch (e) {}
      say();
    });

    window.addEventListener('beforeunload', () => synth.cancel());
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();
