/* ==========================================================================
   three-scene.js — all Three.js / WebGL work
   1) Ambient background: full-screen GLSL gradient-mesh + drifting particles
   2) Hero "Agent Core": noise-displaced shader core, wireframe shell, a neural
      graph of nodes/edges with travelling signal pulses, and labelled agent
      nodes (Planner, Retriever, MCP Tools, Memory, HITL) projected to the DOM.

   Performance: Three.js is lazy-loaded (dynamic import) only when WebGL is
   usable and motion is allowed. Pixel ratio and particle counts scale down on
   mobile / low-power devices; the hero pauses when off-screen; everything
   pauses when the tab is hidden and is disposed on unload.
   ========================================================================== */
(() => {
  'use strict';

  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js';
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hasWebGL = (() => {
    try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); }
    catch { return false; }
  })();

  if (reduced || !hasWebGL) { root.classList.add('no-3d'); return; }

  const isMobile = window.matchMedia('(max-width: 767.98px)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const lowPower = isMobile || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const tier = lowPower ? 'low' : 'high';

  // Shared GLSL: 3D simplex noise (Ashima Arts / Stefan Gustavson, MIT)
  const NOISE = /* glsl */`
    vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
    float snoise(vec3 v){
      const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
      vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
      vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
      vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
      i=mod289(i);
      vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
      float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
      vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
      vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
      vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
      vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
      vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
      vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
      vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
      p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
      vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
      return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
    }`;

  // Soft round sprite texture for glowing points
  function makeGlowTexture(THREE) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,.75)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /* =======================================================================
     1) Ambient background shader
     ======================================================================= */
  function createBackground(THREE) {
    const canvas = document.getElementById('bg-canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power' });
    // A soft gradient doesn't need full resolution: render at reduced scale
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1) * (tier === 'low' ? 0.5 : 0.75));
    renderer.setSize(innerWidth, innerHeight, false);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const uniforms = {
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2(innerWidth, innerHeight) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uScroll: { value: 0 },
    };
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
        fragmentShader: /* glsl */`
          precision highp float;
          varying vec2 vUv;
          uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse; uniform float uScroll;
          ${NOISE}
          void main(){
            vec2 uv=vUv; vec2 p=uv; p.x*=uRes.x/uRes.y;
            float t=uTime*0.04;
            float n1=snoise(vec3(p*1.1, t+uScroll*0.4));
            float n2=snoise(vec3(p*1.9+n1*0.6, t*1.4+10.0));
            vec3 bg=vec3(0.027,0.027,0.051);
            vec3 blue=vec3(0.24,0.55,1.0), violet=vec3(0.55,0.36,0.96), teal=vec3(0.18,0.90,0.79);
            float a=smoothstep(0.15,0.9,n1*0.5+0.5), b=smoothstep(0.35,1.0,n2*0.5+0.5);
            vec3 col=mix(blue,violet,a); col=mix(col,teal,b*0.45);
            // Glow concentrated near the top, fading toward the bottom
            float vign=smoothstep(1.25,0.1,distance(uv,vec2(0.72,0.78)));
            float m=smoothstep(0.55,0.0,distance(uv,uMouse))*0.35;
            float intensity=(0.11+m*0.35)*(0.55+vign)*(1.0-uScroll*0.35);
            gl_FragColor=vec4(bg+col*intensity*(0.6+0.4*n2),1.0);
          }`,
        depthWrite: false,
      })
    );
    scene.add(quad);

    // Drifting dust particles
    const count = tier === 'low' ? 120 : 320;
    const pos = new Float32Array(count * 3), seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = Math.random() * 2 - 1; pos[i * 3 + 1] = Math.random() * 2 - 1; pos[i * 3 + 2] = 0;
      seed[i] = Math.random();
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const pMat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute float aSeed; uniform float uTime; uniform float uScroll; varying float vA;
        void main(){
          vec3 p=position;
          p.y=mod(p.y+1.0+uTime*0.012*(0.4+aSeed)+uScroll*0.6*aSeed,2.0)-1.0;
          p.x+=sin(uTime*0.2+aSeed*40.0)*0.02;
          vA=0.25+0.75*aSeed;
          gl_PointSize=(1.0+aSeed*2.2);
          gl_Position=vec4(p.xy,0.,1.);
        }`,
      fragmentShader: /* glsl */`
        varying float vA;
        void main(){ float d=length(gl_PointCoord-0.5); if(d>0.5) discard; gl_FragColor=vec4(0.75,0.82,1.0,(1.0-d*2.0)*vA*0.5); }`,
    });
    scene.add(new THREE.Points(pGeo, pMat));

    let targetMouse = new THREE.Vector2(0.5, 0.5);
    const onMove = (e) => targetMouse.set(e.clientX / innerWidth, 1 - e.clientY / innerHeight);
    window.addEventListener('pointermove', onMove, { passive: true });

    let acc = 0;
    return {
      resize() { renderer.setSize(innerWidth, innerHeight, false); uniforms.uRes.value.set(innerWidth, innerHeight); },
      update(dt, time) {
        // Background runs at ~30fps; it's slow-moving and this halves GPU cost
        acc += dt; if (acc < 1 / 30) return; acc = 0;
        uniforms.uTime.value = time;
        uniforms.uMouse.value.lerp(targetMouse, 0.05);
        const max = Math.max(1, document.body.scrollHeight - innerHeight);
        uniforms.uScroll.value = window.scrollY / max;
        renderer.render(scene, camera);
      },
      dispose() {
        window.removeEventListener('pointermove', onMove);
        quad.geometry.dispose(); quad.material.dispose(); pGeo.dispose(); pMat.dispose(); renderer.dispose();
      },
    };
  }

  /* =======================================================================
     2) Hero "Agent Core"
     ======================================================================= */
  function createHero(THREE) {
    const canvas = document.getElementById('hero-canvas');
    const hero = document.getElementById('hero');
    const labelsEl = document.getElementById('heroLabels');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier === 'high', alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, tier === 'low' ? 1.25 : 2));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 9);

    const world = new THREE.Group();   // positioned per breakpoint
    const rig = new THREE.Group();     // rotates with mouse / scroll
    world.add(rig); scene.add(world);

    const glowTex = makeGlowTexture(THREE);
    const disposables = [glowTex];
    const track = (o) => { disposables.push(o); return o; };

    /* --- Core: displaced icosahedron with fresnel gradient shader --- */
    const coreUniforms = {
      uTime: { value: 0 },
      uAmp: { value: 0.28 },
      uHover: { value: 0 },
      uC1: { value: new THREE.Color('#3d8bff') },
      uC2: { value: new THREE.Color('#8b5cf6') },
      uC3: { value: new THREE.Color('#2ee6c9') },
    };
    const coreGeo = track(new THREE.IcosahedronGeometry(1.35, tier === 'low' ? 24 : 64));
    const coreMat = track(new THREE.ShaderMaterial({
      uniforms: coreUniforms,
      vertexShader: /* glsl */`
        uniform float uTime; uniform float uAmp; uniform float uHover;
        varying vec3 vNormal; varying vec3 vView; varying float vNoise;
        ${NOISE}
        void main(){
          float n=snoise(normal*1.4+uTime*0.35);
          float n2=snoise(normal*3.2-uTime*0.25)*0.35;
          float d=(n+n2)*(uAmp+uHover*0.18);
          vNoise=n;
          vec3 p=position+normal*d;
          vec4 mv=modelViewMatrix*vec4(p,1.0);
          vView=normalize(-mv.xyz);
          vNormal=normalize(normalMatrix*normal);
          gl_Position=projectionMatrix*mv;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform float uTime;
        varying vec3 vNormal; varying vec3 vView; varying float vNoise;
        void main(){
          float fres=pow(1.0-max(dot(vNormal,vView),0.0),2.2);
          vec3 col=mix(uC1,uC2,smoothstep(-0.6,0.6,vNoise));
          col=mix(col,uC3,smoothstep(0.35,0.9,vNoise)*0.7);
          vec3 base=col*0.22;                       // dark glassy body
          vec3 rim=mix(col,vec3(1.0),0.25)*fres*1.6; // bright rim light
          float bands=smoothstep(0.92,1.0,sin(vNoise*18.0+uTime))*0.25;
          gl_FragColor=vec4(base+rim+col*bands,0.92);
        }`,
      transparent: true,
    }));
    const core = new THREE.Mesh(coreGeo, coreMat);
    const holoEl = document.getElementById('holo');
    if (!holoEl) rig.add(core);

    /* --- Wireframe shell --- */
    const shellGeo = track(new THREE.IcosahedronGeometry(1.95, 2));
    const shellMat = track(new THREE.MeshBasicMaterial({ color: 0x8b5cf6, wireframe: true, transparent: true, opacity: 0.12 }));
    const shell = new THREE.Mesh(shellGeo, shellMat);
    if (!holoEl) rig.add(shell);

    /* --- Inner glow halo sprite --- */
    const haloMat = track(new THREE.SpriteMaterial({ map: glowTex, color: 0x6a5cff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    const halo = new THREE.Sprite(haloMat);
    halo.scale.set(6.5, 6.5, 1);
    if (!holoEl) rig.add(halo);

    /* --- Neural graph: nodes on a thick spherical shell --- */
    const nodeCount = tier === 'low' ? 60 : 130;
    const nodes = [];
    for (let i = 0; i < nodeCount; i++) {
      const u = Math.random(), v = Math.random();
      const th = 2 * Math.PI * u, ph = Math.acos(2 * v - 1);
      const r = 2.3 + Math.random() * 1.1;
      nodes.push(new THREE.Vector3(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.85, r * Math.sin(ph) * Math.sin(th)));
    }

    // Labelled agent nodes (the story of the scene)
    const agents = [
      { name: 'Planner', color: '#3d8bff', pos: new THREE.Vector3(-2.4, 1.6, 0.9) },
      { name: 'Retriever · RAG', color: '#2ee6c9', pos: new THREE.Vector3(2.5, 1.2, 0.6) },
      { name: 'MCP Tools', color: '#8b5cf6', pos: new THREE.Vector3(2.2, -1.6, 1.1) },
      { name: 'Memory', color: '#e45cf6', pos: new THREE.Vector3(-2.6, -1.3, 0.4) },
      { name: 'HITL ✓', color: '#ffd166', pos: new THREE.Vector3(0.2, 2.75, -0.6) },
    ];
    agents.forEach((a) => nodes.push(a.pos));

    const nodePos = new Float32Array(nodes.length * 3);
    const nodeCol = new Float32Array(nodes.length * 3);
    const palette = [new THREE.Color('#3d8bff'), new THREE.Color('#8b5cf6'), new THREE.Color('#2ee6c9')];
    nodes.forEach((n, i) => {
      nodePos.set([n.x, n.y, n.z], i * 3);
      const c = i >= nodeCount ? new THREE.Color(agents[i - nodeCount].color) : palette[i % 3];
      nodeCol.set([c.r, c.g, c.b], i * 3);
    });
    const nodeGeo = track(new THREE.BufferGeometry());
    nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePos, 3));
    nodeGeo.setAttribute('color', new THREE.BufferAttribute(nodeCol, 3));
    const nodeMat = track(new THREE.PointsMaterial({ size: 0.12, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    rig.add(new THREE.Points(nodeGeo, nodeMat));

    // Big glowing sprites for agent nodes
    agents.forEach((a) => {
      const m = track(new THREE.SpriteMaterial({ map: glowTex, color: a.color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      const s = new THREE.Sprite(m);
      s.scale.set(0.55, 0.55, 1);
      s.position.copy(a.pos);
      a.sprite = s;
      rig.add(s);
    });

    // Edges: connect each node to its nearest neighbours (+ agents to the core)
    const edges = [];
    const maxDist = 1.35;
    for (let i = 0; i < nodes.length; i++) {
      let links = 0;
      for (let j = i + 1; j < nodes.length && links < 3; j++) {
        if (nodes[i].distanceTo(nodes[j]) < maxDist) { edges.push([nodes[i], nodes[j]]); links++; }
      }
    }
    const origin = new THREE.Vector3();
    agents.forEach((a, k) => {
      edges.push([a.pos, origin.clone().setLength(0)]);            // agent ↔ core
      edges.push([a.pos, agents[(k + 1) % agents.length].pos]);   // agent ↔ agent (A2A)
    });
    const edgePos = new Float32Array(edges.length * 6);
    edges.forEach(([a, b], i) => edgePos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6));
    const edgeGeo = track(new THREE.BufferGeometry());
    edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePos, 3));
    const edgeMat = track(new THREE.LineBasicMaterial({ color: 0x7c8cff, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false }));
    rig.add(new THREE.LineSegments(edgeGeo, edgeMat));

    // Signal pulses travelling along random edges (agent messages / tool calls)
    const pulseCount = tier === 'low' ? 24 : 60;
    const pulses = Array.from({ length: pulseCount }, () => ({ e: edges[(Math.random() * edges.length) | 0], t: Math.random(), speed: 0.25 + Math.random() * 0.6 }));
    const pulsePos = new Float32Array(pulseCount * 3);
    const pulseGeo = track(new THREE.BufferGeometry());
    pulseGeo.setAttribute('position', new THREE.BufferAttribute(pulsePos, 3));
    const pulseMat = track(new THREE.PointsMaterial({ size: 0.16, map: glowTex, color: 0xbff6ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    rig.add(new THREE.Points(pulseGeo, pulseMat));

    /* --- Orbit ring of particles --- */
    const ringCount = tier === 'low' ? 200 : 600;
    const ringPos = new Float32Array(ringCount * 3);
    for (let i = 0; i < ringCount; i++) {
      const a = (i / ringCount) * Math.PI * 2, r = 3.9 + (Math.random() - 0.5) * 0.35;
      ringPos.set([Math.cos(a) * r, (Math.random() - 0.5) * 0.12, Math.sin(a) * r], i * 3);
    }
    const ringGeo = track(new THREE.BufferGeometry());
    ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPos, 3));
    const ringMat = track(new THREE.PointsMaterial({ size: 0.04, color: 0x2ee6c9, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, map: glowTex }));
    const ring = new THREE.Points(ringGeo, ringMat);
    ring.rotation.set(1.2, 0, 0.35);
    world.add(ring);

    /* --- DOM labels for agent nodes --- */
    if (holoEl) labelsEl.hidden = true; // the portrait's own chips replace these labels
    const labels = agents.map((a) => {
      const el = document.createElement('span');
      el.className = 'node-label';
      el.style.setProperty('--dot', a.color);
      el.textContent = a.name;
      labelsEl.appendChild(el);
      return el;
    });
    const tmp = new THREE.Vector3();
    let w = 1, h = 1;

    /* --- Layout: object to the right on desktop, centered/back on mobile --- */
    const layout = () => {
      const r = hero.getBoundingClientRect();
      w = r.width; h = r.height;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      if (holoEl) {
        // Centre the network behind the portrait: ray from the camera through its screen centre, onto the z=0 plane
        const hr = holoEl.getBoundingClientRect(), hb = hero.getBoundingClientRect();
        const p = new THREE.Vector3(((hr.left + hr.width / 2 - hb.left) / w) * 2 - 1, -((hr.top + hr.height * 0.55 - hb.top) / h) * 2 + 1, 0.5).unproject(camera);
        const dir = p.sub(camera.position).normalize();
        world.position.copy(camera.position).addScaledVector(dir, -camera.position.z / dir.z);
        world.scale.setScalar(Math.max(0.55, (hr.width / h) * 1.8));
      } else if (w >= 992) { world.position.set(2.2 * Math.min(1.2, camera.aspect / 1.6), 0, 0); world.scale.setScalar(0.88); }
      else { world.position.set(0, 2.2, -3); world.scale.setScalar(0.8); }
    };
    layout();

    /* --- Interaction --- */
    const mouse = new THREE.Vector2(), smooth = new THREE.Vector2();
    const onMove = (e) => { mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); };
    window.addEventListener('pointermove', onMove, { passive: true });
    const raycaster = new THREE.Raycaster();
    const hitSphere = new THREE.Sphere(new THREE.Vector3(), 1.6);

    return {
      canvas,
      resize: layout,
      update(dt, time) {
        smooth.lerp(mouse, 0.05);
        const scrollP = Math.min(1, window.scrollY / Math.max(1, h));

        // Rotation: idle spin + mouse parallax + scroll twist
        rig.rotation.y += dt * 0.12;
        rig.rotation.x = smooth.y * -0.35 + scrollP * 0.8;
        world.rotation.y = smooth.x * 0.45;
        world.rotation.z = scrollP * 0.3;
        shell.rotation.y -= dt * 0.18; shell.rotation.x += dt * 0.07;
        ring.rotation.z += dt * 0.05;
        canvas.style.opacity = String(1 - scrollP * 0.85);

        // Hover the core → it ripples harder
        raycaster.setFromCamera(smooth, camera);
        hitSphere.center.setFromMatrixPosition(core.matrixWorld);
        const hovering = raycaster.ray.intersectsSphere(hitSphere) ? 1 : 0;
        coreUniforms.uHover.value += (hovering - coreUniforms.uHover.value) * 0.06;
        coreUniforms.uTime.value = time;
        const pulse = 1 + Math.sin(time * 1.6) * 0.03;
        core.scale.setScalar(pulse);
        haloMat.opacity = 0.3 + coreUniforms.uHover.value * 0.25;

        // Move signal pulses along edges
        for (let i = 0; i < pulseCount; i++) {
          const p = pulses[i];
          p.t += dt * p.speed;
          if (p.t >= 1) { p.t = 0; p.e = edges[(Math.random() * edges.length) | 0]; }
          tmp.lerpVectors(p.e[0], p.e[1], p.t);
          pulsePos[i * 3] = tmp.x; pulsePos[i * 3 + 1] = tmp.y; pulsePos[i * 3 + 2] = tmp.z;
        }
        pulseGeo.attributes.position.needsUpdate = true;

        // Agent sprites breathe; labels follow projected positions
        const showLabels = w >= 992 && !holoEl;
        agents.forEach((a, i) => {
          a.sprite.scale.setScalar(0.5 + Math.sin(time * 2 + i) * 0.08);
          if (!showLabels) return;
          tmp.copy(a.pos).applyMatrix4(rig.matrixWorld);
          const depth = tmp.clone().applyMatrix4(camera.matrixWorldInverse).z;
          tmp.project(camera);
          const x = (tmp.x * 0.5 + 0.5) * w, y = (-tmp.y * 0.5 + 0.5) * h;
          const front = THREE.MathUtils.clamp((-depth - 6) / 6, 0, 1); // fade when behind the core
          labels[i].style.transform = `translate(${x + 14}px, ${y - 10}px)`;
          labels[i].style.opacity = (0.25 + 0.75 * (1 - front)) * (1 - scrollP * 1.5);
        });

        renderer.render(scene, camera);
      },
      dispose() {
        window.removeEventListener('pointermove', onMove);
        disposables.forEach((d) => d.dispose && d.dispose());
        renderer.dispose();
        labelsEl.innerHTML = '';
      },
    };
  }

  /* =======================================================================
     Orchestration: one RAF loop, visibility-aware
     ======================================================================= */
  async function start() {
    let THREE;
    try { THREE = await import(THREE_URL); }
    catch (err) { console.warn('[three-scene] Three.js failed to load, using static fallback.', err); root.classList.add('no-3d'); return; }

    let bg, hero;
    try { bg = createBackground(THREE); hero = createHero(THREE); }
    catch (err) { console.warn('[three-scene] WebGL init failed, using static fallback.', err); root.classList.add('no-3d'); return; }

    let heroVisible = true, tabVisible = !document.hidden, raf = 0;
    const clock = new THREE.Clock();

    new IntersectionObserver(([en]) => { heroVisible = en.isIntersecting; }, { threshold: 0 }).observe(document.getElementById('hero'));
    document.addEventListener('visibilitychange', () => {
      tabVisible = !document.hidden;
      if (tabVisible) { clock.getDelta(); loop(); } else cancelAnimationFrame(raf);
    });

    let resizeT;
    window.addEventListener('resize', () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => { bg.resize(); hero.resize(); }, 150);
    });

    function loop() {
      cancelAnimationFrame(raf);
      if (!tabVisible) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      bg.update(dt, t);
      if (heroVisible) hero.update(dt, t);
      raf = requestAnimationFrame(loop);
    }
    loop();

    // Free GPU memory when leaving the page
    window.addEventListener('pagehide', () => { cancelAnimationFrame(raf); bg.dispose(); hero.dispose(); }, { once: true });
  }

  // Load after first paint so the 3D never blocks content
  const kick = () => ('requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 1200 }) : setTimeout(start, 200));
  document.readyState === 'complete' ? kick() : window.addEventListener('load', kick, { once: true });
})();
