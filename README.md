# Nitesh Upadhyay — GenAI Engineer Portfolio

A 3D, animated single-page portfolio built with **plain HTML/CSS/JS**, Bootstrap 5 (grid only), **Three.js**, **GSAP + ScrollTrigger** and **Lenis**. No build step.

## Run locally

Double-click `index.html`, **or** (recommended, so everything behaves like production) serve the folder:

```bash
npx serve .            # or
python -m http.server 5500
```

Then open http://localhost:5500 (or the port shown). VS Code **Live Server** works too.

## Structure

```
index.html              All content & sections (semantic HTML, SEO/OG/JSON-LD)
css/style.css           Design tokens, layout, components, responsive, reduced-motion
css/animations.css      Keyframes & animation utilities
js/main.js              Preloader, Lenis, navbar, mobile menu, typing/decoding text,
                        counters, magnetic buttons, tilt cards, skills tag sphere,
                        project modal, contact form (Formspree)
js/scroll-animations.js GSAP ScrollTrigger reveals, timeline progress, 3D entrances
js/cursor.js            Custom cursor + glowing canvas trail (mouse devices only)
js/three-scene.js       Shader background + "Agent Core" hero (lazy-loads Three.js)
assets/images/          Favicon, OG image, project illustrations (SVG)
assets/resume/          Downloadable resume PDF
robots.txt, sitemap.xml
```

## Before you deploy — 3 quick edits

1. **Contact form:** create a free form at https://formspree.io, copy its ID, and in `index.html` replace
   `https://formspree.io/f/YOUR_FORM_ID`. Until then, the form opens the visitor's email client (mailto fallback).
2. **Domain:** the canonical/OG URLs, `robots.txt` and `sitemap.xml` assume `https://upadhyay02nitesh.github.io/`.
   Search-and-replace if you deploy elsewhere.
3. **Project links:** the GitHub buttons point to your profile. Swap in repo URLs when they're public.

To update the resume, replace `assets/resume/Nitesh_Upadhyay_GenAI_Resume.pdf` (keep the filename).

## Deploy for free

**GitHub Pages** (matches the URLs already in the site)
1. Create a repo named `upadhyay02nitesh.github.io`, then push these files to `main`.
2. Repo → Settings → Pages → Source: *Deploy from a branch* → `main` / root.
3. Live at https://upadhyay02nitesh.github.io in about a minute.

**Netlify:** drag-and-drop the folder at https://app.netlify.com/drop.
**Vercel:** `npx vercel` in the folder and accept the defaults (framework: *Other*).

## Performance & accessibility notes

- Three.js is loaded **only** when WebGL is available and motion is allowed, after first paint.
- Mobile/low-power devices get fewer particles, lower pixel ratio and lower mesh detail. The hero stops rendering when scrolled off-screen, all rendering pauses in background tabs, and GPU resources are released on `pagehide`.
- `prefers-reduced-motion: reduce` → no 3D, no cursor, no smooth scroll, no typing. A static gradient orb and fully visible content are shown instead.
- Content is fully visible without JavaScript. Includes a skip link, a focus-trapped mobile menu (Esc closes it), labelled form fields with inline errors, and alt text on all images.

### Optional minification

The source is readable on purpose. For a production build:

```bash
npx esbuild js/*.js --minify --outdir=dist/js
npx esbuild css/*.css --minify --outdir=dist/css
```

Copy `index.html` and `assets/` into `dist/` and deploy `dist/`.
