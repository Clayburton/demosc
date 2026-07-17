/* DEM-Osc landing — Three.js atmosphere + tap-to-play cassette
   Clay and Kelsy Instruments */
(function () {
  'use strict';

  /* state classes (playing/noscene/loading) go on the app wrapper when embedded
     in WordPress (#demosc-app), otherwise on <body>. Descendant CSS works for both. */
  var body = document.getElementById('demosc-app') || document.body;
  var heroEl = document.getElementById('hero');

  /* apply the ONE buy link (window.DEMOSC_CART_LINK, set at the top of the HTML)
     to every button on the page, so there's only one place to ever change it */
  var CART = window.DEMOSC_CART_LINK || 'https://clayandkelsy.com/checkout/?add-to-cart=6322&quantity=1';
  Array.prototype.forEach.call(document.querySelectorAll('[data-cart], .cta, .topcta'), function (a) {
    a.setAttribute('href', CART);
    /* CRITICAL: this page runs inside an iframe on clayandkelsy.com/dem-osc/.
       Without target=_top the checkout would load INSIDE the (github.io) iframe,
       making WooCommerce's session cookie a blocked third-party cookie — guests
       then get "your session has expired". _top navigates the whole tab so
       checkout is first-party on clayandkelsy.com and the cart/session work.
       (When the page is opened standalone, _top is just the current tab.) */
    a.setAttribute('target', '_top');
  });

  /* ------------------------------------------------------------------ */
  /* AUDIO                                                              */
  /* ------------------------------------------------------------------ */
  /* the six preview sounds (real DEM-Osc renders) — ORDER is the tap-cycle order,
     sequenced so each tap sounds clearly different from the last */
  var CLIPS = { pad:     'assets/audio/pad.mp3',
                keys:    'assets/audio/keys.mp3',
                bass:    'assets/audio/bass.mp3',
                lead:    'assets/audio/lead.mp3',
                strings: 'assets/audio/strings.mp3',
                brass:   'assets/audio/brass.mp3' };
  var ORDER = ['pad', 'bass', 'keys', 'brass', 'strings', 'lead'];
  var actx = null, master = null, analyser = null, timeData = null;
  var buffers = {}, current = 'pad', activeSource = null, started = false;
  var isPlaying = false, energy = 0, glow = 0, tapPulse = 0;

  function initAudio() {
    if (actx) return;
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      master = actx.createGain(); master.gain.value = 0.9;
      analyser = actx.createAnalyser(); analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.8;
      timeData = new Uint8Array(analyser.fftSize);
      master.connect(analyser); analyser.connect(actx.destination);
    } catch (e) { /* no audio */ }
  }

  function loadClip(name) {
    if (buffers[name] || !actx) return Promise.resolve(buffers[name]);
    return fetch(CLIPS[name]).then(function (r) { return r.arrayBuffer(); })
      .then(function (b) { return actx.decodeAudioData(b); })
      .then(function (buf) { buffers[name] = buf; return buf; })
      .catch(function () {});
  }

  function play(name) {
    initAudio();
    if (!actx) return;
    if (actx.state === 'suspended') actx.resume();
    current = name;
    tapPulse = 1;               /* instant visual kick, even before audio swells */
    var go = function () {
      if (!buffers[name]) return;
      if (activeSource) { try { activeSource.stop(); } catch (e) {} }
      var src = actx.createBufferSource();
      src.buffer = buffers[name];
      src.connect(master);
      src.start();
      activeSource = src;
      isPlaying = true;
      body.classList.add('playing');
      src.onended = function () {
        if (activeSource === src) { isPlaying = false; body.classList.remove('playing'); }
      };
    };
    if (buffers[name]) go(); else loadClip(name).then(go);
  }

  /* preload once audio context is unlocked */
  function preloadAll() { Object.keys(CLIPS).forEach(loadClip); }

  /* ------------------------------------------------------------------ */
  /* VU / waveform canvas                                              */
  /* ------------------------------------------------------------------ */
  var vu = document.getElementById('vu');
  var vctx = vu ? vu.getContext('2d') : null;
  function drawVU() {
    if (!vctx) return;
    var W = vu.width, H = vu.height, mid = H / 2;
    vctx.clearRect(0, 0, W, H);
    var accent = '#7a3ff2', ink = 'rgba(23,18,12,.5)';
    vctx.lineWidth = 2.5; vctx.lineJoin = 'round';
    vctx.beginPath();
    if (isPlaying && analyser) {
      analyser.getByteTimeDomainData(timeData);
      var step = Math.floor(timeData.length / W) || 1, sum = 0;
      for (var x = 0; x < W; x++) {
        var v = (timeData[x * step] - 128) / 128;
        sum += v * v;
        var y = mid + v * mid * 0.9;
        if (x === 0) vctx.moveTo(x, y); else vctx.lineTo(x, y);
      }
      energy = Math.min(1, Math.sqrt(sum / W) * 3.2);
      vctx.strokeStyle = accent;
    } else {
      var t = performance.now() * 0.002;
      for (var i = 0; i <= W; i += 6) {
        var yy = mid + Math.sin(i * 0.05 + t) * 1.4;
        if (i === 0) vctx.moveTo(i, yy); else vctx.lineTo(i, yy);
      }
      energy *= 0.9;
      vctx.strokeStyle = ink;
    }
    vctx.stroke();
  }

  /* ------------------------------------------------------------------ */
  /* THREE.JS scene                                                    */
  /* ------------------------------------------------------------------ */
  var renderer, cnv, bgScene, bgCam, bgMat, scene, cam, group, cassette, glowMesh, shadowMesh;
  var aspect = 4 / 3, targetRX = 0, targetRY = 0, curRX = 0, curRY = 0;
  var scrollP = 0;

  function radialTexture(inner, outer, stops) {
    var s = 256, c = document.createElement('canvas'); c.width = c.height = s;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
    stops.forEach(function (st) { grad.addColorStop(st[0], st[1]); });
    g.fillStyle = grad; g.fillRect(0, 0, s, s);
    var t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
  }

  function initThree() {
    if (typeof THREE === 'undefined') throw new Error('no three');
    var canvas = document.getElementById('scene');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    cnv = canvas;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.autoClear = false;

    /* background grain pass */
    bgScene = new THREE.Scene();
    bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    bgMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
        uPlaying: { value: 0 }, uEnergy: { value: 0 }
      },
      vertexShader:
        'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
      fragmentShader: [
        'precision mediump float;',
        'uniform float uTime; uniform vec2 uRes; uniform float uPlaying; uniform float uEnergy;',
        'varying vec2 vUv;',
        'float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }',
        'void main(){',
        '  vec2 uv=vUv;',
        '  vec3 top=vec3(0.949,0.906,0.835);',
        '  vec3 bot=vec3(0.870,0.816,0.717);',
        '  vec3 col=mix(top,bot,pow(clamp(uv.y,0.0,1.0),1.15));',
        '  vec2 c=uv-0.5; c.x*=uRes.x/uRes.y;',
        '  float d=length(c);',
        '  float vig=smoothstep(1.05,0.20,d);',
        '  col*=mix(0.88,1.0,vig);',
        '  float bloom=smoothstep(0.75,0.0,d);',
        '  col+=bloom*uPlaying*vec3(0.11,0.05,0.17)*(0.45+uEnergy*0.9);',
        '  float g=hash(uv*uRes*0.5+uTime*57.0);',
        '  col+=(g-0.5)*0.05;',
        '  gl_FragColor=vec4(col,1.0);',
        '}'
      ].join('\n')
    });
    bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat));

    /* main scene */
    scene = new THREE.Scene();
    cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    cam.position.set(0, 0, 5);
    group = new THREE.Group(); scene.add(group);

    /* soft contact shadow */
    shadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(aspect * 1.18, 1.18),
      new THREE.MeshBasicMaterial({
        map: radialTexture(0, 1, [[0, 'rgba(30,20,10,0.5)'], [0.6, 'rgba(30,20,10,0.18)'], [1, 'rgba(30,20,10,0)']]),
        transparent: true, depthWrite: false
      })
    );
    shadowMesh.position.set(0.04, -0.14, -0.25);
    shadowMesh.scale.set(1.25, 0.9, 1);
    group.add(shadowMesh);

    /* warm/purple play glow behind */
    glowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(aspect * 1.7, 1.7),
      new THREE.MeshBasicMaterial({
        map: radialTexture(0, 1, [[0, 'rgba(150,95,255,0.55)'], [0.4, 'rgba(122,63,242,0.22)'], [1, 'rgba(122,63,242,0)']]),
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0
      })
    );
    glowMesh.position.set(0, 0, -0.2);
    group.add(glowMesh);

    /* the cassette */
    var loader = new THREE.TextureLoader();
    var tex = loader.load('assets/hero_cassette_ink_1200.webp', function () { render(); });
    if (renderer.capabilities) tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    cassette = new THREE.Mesh(
      new THREE.PlaneGeometry(aspect, 1),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    group.add(cassette);

    resize();
    window.addEventListener('resize', resize);
    /* Re-sync once layout/fonts/iframe height settle — otherwise on some hosts
       (notably inside a WordPress iframe) the slot has zero height on first paint
       and the cassette stays invisible until a scroll forces a reflow. */
    window.addEventListener('load', resize);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
    setTimeout(resize, 120);
    setTimeout(resize, 500);
    body.classList.remove('loading');
    animate();
  }

  var slotEl = document.getElementById('castslot');
  var phEl = document.getElementById('playhint');

  /* IMPORTANT: use documentElement.clientWidth/Height — the CSS layout viewport, the
     same coordinate space as getBoundingClientRect (the DOM slot we anchor to). Do NOT
     use window.innerWidth or canvas.clientWidth; some mobile emulators report those in
     device pixels, which puts the cassette in a different space than the DOM and breaks
     alignment. documentElement.clientWidth is CSS px on real devices AND here. */
  var docEl = document.documentElement;
  function vpW() { return docEl.clientWidth || window.innerWidth; }
  function vpH() { return docEl.clientHeight || window.innerHeight; }

  function resize() {
    var w = vpW(), h = vpH();
    renderer.setSize(w, h, true);   // true: also set canvas CSS box to the CSS viewport
    var pr = renderer.getPixelRatio();
    bgMat.uniforms.uRes.value.set(w * pr, h * pr);
    cam.aspect = w / h; cam.updateProjectionMatrix();
    updateCassetteTransform();
  }

  /* lock the cassette into the reserved DOM slot so it never overlaps copy */
  function updateCassetteTransform() {
    if (!slotEl) return;
    var h = vpH(), w = vpW();
    var r = slotEl.getBoundingClientRect();
    if (r.height < 2) return;
    var vHW = 2 * cam.position.z * Math.tan(cam.fov * 0.5 * Math.PI / 180);
    var worldPerPx = vHW / h;

    /* reserve the play-hint pill's space at the top of the slot */
    var reserve = phEl ? phEl.offsetHeight + 16 : 0;
    var availH = Math.max(60, r.height - reserve);

    var isDesk = w >= 820;
    var targetPxH = availH * 0.98;
    var maxPxW = Math.min(r.width * 0.98, isDesk ? 720 : w * 0.9);   // a bit bigger on desktop
    if (targetPxH * aspect > maxPxW) targetPxH = maxPxW / aspect;
    targetPxH = Math.min(targetPxH, h * (isDesk ? 0.58 : 0.5));
    group.scale.setScalar(targetPxH * worldPerPx);

    /* centre the cassette in the space below the play hint — track the slot on
       BOTH axes so it follows the DOM (single-column centred on mobile, left
       column on desktop's two-column hero) instead of always sitting mid-screen */
    var centerY = r.top + reserve + availH / 2;
    var centerX = r.left + r.width / 2;
    group.position.y = (h / 2 - centerY) * worldPerPx;
    group.position.x = (centerX - w / 2) * worldPerPx;
  }

  var clock = (window.performance || Date);
  function animate() {
    requestAnimationFrame(animate);
    var t = clock.now() / 1000;

    updateCassetteTransform();

    tapPulse *= 0.90;

    /* ease tilt + subtle idle float */
    curRX += (targetRX - curRX) * 0.06;
    curRY += (targetRY - curRY) * 0.06;
    var floaty = Math.sin(t * 0.8) * 0.03;
    group.rotation.x = curRX + floaty * 0.4;
    group.rotation.y = curRY;
    group.position.z = -scrollP * 1.4;
    group.position.y += Math.sin(t * 0.8) * 0.012;

    /* breathing punch on tap + gentle pulse with the audio */
    var pf = 1 + tapPulse * 0.055 + (isPlaying ? energy * 0.03 : 0);
    group.scale.multiplyScalar(pf);

    /* glow follows playback energy, flashes on tap */
    var targetGlow = isPlaying ? (0.30 + energy * 0.85) : 0;
    glow += (targetGlow - glow) * 0.12;
    glowMesh.material.opacity = Math.min(1, glow + tapPulse * 0.5);
    cassette.material.opacity = 1 - scrollP * 0.9;
    shadowMesh.material.opacity = (1 - scrollP) * 0.6;

    bgMat.uniforms.uTime.value = t;
    var wantPlay = (isPlaying ? 1 : 0);
    bgMat.uniforms.uPlaying.value += (Math.max(wantPlay, tapPulse) - bgMat.uniforms.uPlaying.value) * 0.08;
    bgMat.uniforms.uEnergy.value = energy + tapPulse * 0.6;

    drawVU();
    render();
  }

  function render() {
    if (!renderer) return;
    renderer.clear();
    renderer.render(bgScene, bgCam);
    renderer.clearDepth();
    renderer.render(scene, cam);
  }

  /* ------------------------------------------------------------------ */
  /* INPUT — tilt + tap                                                */
  /* ------------------------------------------------------------------ */
  function onPointer(clientX, clientY) {
    var nx = (clientX / vpW()) - 0.5;
    var ny = (clientY / vpH()) - 0.5;
    targetRY = nx * 0.45;
    targetRX = ny * 0.32;
  }
  window.addEventListener('pointermove', function (e) { onPointer(e.clientX, e.clientY); }, { passive: true });

  var tiltAsked = false;
  function enableTilt() {
    if (tiltAsked) return; tiltAsked = true;
    var handler = function (e) {
      if (e.gamma == null) return;
      targetRY = Math.max(-0.5, Math.min(0.5, (e.gamma / 45) * 0.4));
      targetRX = Math.max(-0.4, Math.min(0.4, ((e.beta - 45) / 45) * 0.3));
    };
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(function (s) {
        if (s === 'granted') window.addEventListener('deviceorientation', handler);
      }).catch(function () {});
    } else if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handler);
    }
  }

  var tasteBtns = Array.prototype.slice.call(document.querySelectorAll('.taste'));
  var phText = document.getElementById('playhinttext');

  function syncChips(name) {
    tasteBtns.forEach(function (x) {
      x.setAttribute('aria-pressed', x.getAttribute('data-clip') === name ? 'true' : 'false');
    });
  }
  function selectSound(name) {
    enableTilt(); preloadAll();
    syncChips(name);
    if (phText) phText.textContent = 'tap for the next sound';
    play(name);                 // play() sets `current`
  }
  function cycleSound() {
    var i = ORDER.indexOf(current);
    selectSound(ORDER[(i + 1) % ORDER.length]);
  }

  /* tap the cassette/hero: first tap plays, each tap after cycles to a new sound */
  heroEl.addEventListener('click', function (e) {
    if (e.target.closest('a')) return;      // don't hijack the Get-it CTA
    if (!started) { started = true; selectSound(current); } else { cycleSound(); }
  });

  /* the labelled chips jump straight to a specific sound */
  tasteBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      started = true; selectSound(b.getAttribute('data-clip'));
    });
  });

  /* ------------------------------------------------------------------ */
  /* SCROLL — sticky CTA, parallax, reveals                            */
  /* ------------------------------------------------------------------ */
  var sticky = document.getElementById('sticky');
  function onScroll() {
    var hH = heroEl.offsetHeight || window.innerHeight;
    scrollP = Math.max(0, Math.min(1, window.scrollY / hH));
    var nearBottom = (window.innerHeight + window.scrollY) > (document.body.scrollHeight - 300);
    if (window.scrollY > hH * 0.45 && !nearBottom) sticky.classList.add('show');
    else sticky.classList.remove('show');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.15 });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
  }

  /* ------------------------------------------------------------------ */
  /* BOOT                                                              */
  /* ------------------------------------------------------------------ */
  try { initThree(); }
  catch (err) {
    body.classList.add('noscene'); body.classList.remove('loading');
    var f = document.getElementById('cassetteFallback');
    if (f && f.dataset.src) f.src = f.dataset.src;
    requestAnimationFrame(function loop(){ drawVU(); requestAnimationFrame(loop); });
  }

  /* warm up the audio buffers immediately so the first tap is instant */
  initAudio();
  preloadAll();
})();
