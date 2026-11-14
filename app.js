/* ==========================================================================
   RAZA.DEVELOPER — BESPOKE AUTOMOTIVE STUDIO ENGINE
   - Scroll animation ONLY on Section 1 (#process Hero)
   - Hero button (#btn-next-section) animates Hero wash & glides to Section 2
   - Click & drag laser-wipe configurators for Coating, Correction, Wraps,
     Forged Calipers, Ceramic Tint, Cockpit Leather, and Private Bay Booking.
   ========================================================================== */

(function () {
  'use strict';

  const TOTAL_PROCESS_FRAMES = 107; // f_000..f_106
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  /* ------------------------------------------------------------------------
     4K IMAGE CACHE & CONFIGURATION STATE
     ------------------------------------------------------------------------ */
  const cache = {
    process: new Array(TOTAL_PROCESS_FRAMES),
    coatingBeads: null,
    correction: { before: null, after: null },
    wraps: { stealth: null, silver: null, midnight: null, crimson: null },
    wheels: { gold: null, crimson: null, acid: null, silver: null },
    tint: { vlt70: null, vlt35: null, vlt15: null, vlt05: null },
    interior: { obsidian: null, cognac: null, porcelain: null }
  };

  const TINT_KEY_MAP = {
    '0.0': 'vlt70',
    '0.38': 'vlt35',
    '0.68': 'vlt15',
    '0.92': 'vlt05'
  };

  function createWipeChannel(initialKey) {
    return {
      current: initialKey,
      prev: initialKey,
      progress: 1.0,
      scanning: false,
      dirty: true
    };
  }

  const state = {
    // Section 1: Hero Process
    processProgress: 0.02,
    processTarget: 0.02,
    isAutoPlayingProcess: false,
    isJumpingToSection2: false,

    // Section 2: Coating Hydrophobicity
    hydroDroplets: [],

    // Section 3: Paint Correction
    corrRatio: 0.18,
    corrTargetRatio: 0.18,
    isDraggingCorr: false,
    corrDirty: true,

    // Sections 4-7: Click-Triggered Laser Wipe Configurators
    wraps: createWipeChannel('stealth'),
    wheels: createWipeChannel('gold'),
    tint: createWipeChannel('vlt70'),
    interior: createWipeChannel('obsidian'),

    // Section 8: Pricing Configurator
    vehicleAddon: 0,
    pkgBase: 149,
    selectedSlot: null,
    pricingDirty: true
  };

  /* ------------------------------------------------------------------------
     DOM REFERENCES
     ------------------------------------------------------------------------ */
  const dom = {
    preloader: document.getElementById('intro-preloader'),
    introStatusText: document.getElementById('intro-status-text'),
    introPct: document.getElementById('intro-pct'),
    introBarFill: document.getElementById('intro-bar-fill'),
    replayIntroBtn: document.getElementById('replay-intro-btn'),

    navLinks: document.getElementById('nav-links'),
    navItems: Array.from(document.querySelectorAll('.nav-item')),
    navPill: document.getElementById('nav-pill-indicator'),

    // Section 1: Process
    secProcess: document.getElementById('process'),
    processCanvas: document.getElementById('process-canvas'),
    flawlessWord: document.getElementById('flawless-word'),
    glossValue: document.getElementById('gloss-value'),
    glossBarsWrap: document.getElementById('gloss-bars'),
    timelineFill: document.getElementById('timeline-fill'),
    timelineSteps: Array.from(document.querySelectorAll('.timeline-step')),
    btnNextSection: document.getElementById('btn-next-section'),
    hoodHotspot: document.getElementById('hood-hotspot'),
    btnAutoplayProcess: document.getElementById('btn-autoplay-process'),
    autoplayLabel: document.getElementById('autoplay-label'),

    // Section 2: Coating
    secCoating: document.getElementById('coating'),
    coatingCanvas: document.getElementById('coating-canvas'),
    btnHydroBurst: document.getElementById('btn-hydro-burst'),
    beadAngleVal: document.getElementById('bead-angle-val'),

    // Section 3: Correction
    corrComparison: document.getElementById('correction-comparison'),
    corrBeforeCanvas: document.getElementById('correction-before-canvas'),
    corrAfterCanvas: document.getElementById('correction-after-canvas'),
    corrAfterClip: document.getElementById('corr-after-clip'),
    corrDivider: document.getElementById('corr-divider'),
    corrHandle: document.getElementById('corr-handle'),
    corrPresetBtns: Array.from(document.querySelectorAll('.corr-preset-btn')),
    swirlCounter: document.getElementById('swirl-counter'),
    mirrorBadge: document.getElementById('mirror-finish-badge'),

    // Section 4: Wraps
    wrapsCanvas: document.getElementById('wraps-canvas'),
    wrapOptions: Array.from(document.querySelectorAll('.wrap-option[data-wrap]')),
    wrapPriceValue: document.getElementById('wrap-price-value'),

    // Section 5: Wheels & Calipers
    wheelsCanvas: document.getElementById('wheels-canvas'),
    caliperOptions: Array.from(document.querySelectorAll('.caliper-option')),

    // Section 6: Window Tint
    tintCanvas: document.getElementById('tint-canvas'),
    tintOptions: Array.from(document.querySelectorAll('.tint-option')),
    tintIrValue: document.getElementById('tint-ir-value'),

    // Section 7: Cockpit Interior
    interiorCanvas: document.getElementById('interior-canvas'),
    interiorOptions: Array.from(document.querySelectorAll('.interior-option')),

    // Section 8: Pricing
    pricingCanvas: document.getElementById('pricing-canvas'),
    vehicleBtns: Array.from(document.querySelectorAll('#vehicle-selector .quote-pill')),
    pkgBtns: Array.from(document.querySelectorAll('#package-selector .pkg-card')),
    slotBtns: Array.from(document.querySelectorAll('#slot-selector .slot-pill')),
    totalAmount: document.getElementById('total-amount'),
    btnBookSubmit: document.getElementById('btn-book-submit'),
    bookSubmitText: document.getElementById('book-submit-text'),
    yourCarBadge: document.getElementById('your-car-badge'),
    yourCarWrapName: document.getElementById('your-car-wrap-name')
  };

  /* ------------------------------------------------------------------------
     INITIALIZE HERO GLOSS BARS
     ------------------------------------------------------------------------ */
  const glossBarEls = [];
  if (dom.glossBarsWrap) {
    dom.glossBarsWrap.innerHTML = '';
    for (let i = 0; i < 24; i++) {
      const b = document.createElement('div');
      b.className = 'gloss-bar';
      dom.glossBarsWrap.appendChild(b);
      glossBarEls.push(b);
    }
  }

  /* ------------------------------------------------------------------------
     HIGH-DPI CANVAS MANAGEMENT
     ------------------------------------------------------------------------ */
  const allCanvases = [
    dom.processCanvas,
    dom.coatingCanvas,
    dom.corrBeforeCanvas,
    dom.corrAfterCanvas,
    dom.wrapsCanvas,
    dom.wheelsCanvas,
    dom.tintCanvas,
    dom.interiorCanvas,
    dom.pricingCanvas
  ].filter(Boolean);

  function resizeAllCanvases() {
    allCanvases.forEach((c) => {
      const rect = c.parentElement.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      if (c.width !== w * DPR || c.height !== h * DPR) {
        c.width = w * DPR;
        c.height = h * DPR;
      }
    });
    state.corrDirty = true;
    state.wraps.dirty = true;
    state.wheels.dirty = true;
    state.tint.dirty = true;
    state.interior.dirty = true;
    state.pricingDirty = true;
  }

  window.addEventListener('resize', () => {
    resizeAllCanvases();
    updateNavPill();
  });

  function drawCoverImage(ctx, img, cw, ch, focusX = 0.56, focusY = 0.5) {
    ctx.fillStyle = '#060608';
    ctx.fillRect(0, 0, cw, ch);
    if (!img) return;

    const iw = img.naturalWidth || img.width || 1344;
    const ih = img.naturalHeight || img.height || 768;
    const scale = Math.max(cw / iw, ch / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (cw - dw) * focusX;
    const dy = (ch - dh) * focusY;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  /**
   * Shared horizontal laser-wipe renderer for Wraps, Wheels, Tint, and Interior stages.
   */
  function renderWipeCanvas(canvas, imgMap, channel, focusX = 0.65) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cw = canvas.width;
    const ch = canvas.height;
    const currImg = imgMap[channel.current];
    const prevImg = imgMap[channel.prev] || currImg;

    if (!channel.scanning || channel.progress >= 1) {
      drawCoverImage(ctx, currImg, cw, ch, focusX, 0.5);
      channel.dirty = false;
      return;
    }

    drawCoverImage(ctx, prevImg, cw, ch, focusX, 0.5);

    const scanX = cw * channel.progress;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, scanX, ch);
    ctx.clip();
    drawCoverImage(ctx, currImg, cw, ch, focusX, 0.5);
    ctx.restore();

    // Warm Champagne Titanium Laser Scan Line
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, 'rgba(223,201,163,0)');
    grad.addColorStop(0.2, '#F4E6CA');
    grad.addColorStop(0.5, '#FAF7F2');
    grad.addColorStop(0.8, '#DFC9A3');
    grad.addColorStop(1, 'rgba(223,201,163,0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.6 * DPR;
    ctx.shadowColor = '#DFC9A3';
    ctx.shadowBlur = 22 * DPR;
    ctx.beginPath();
    ctx.moveTo(scanX, 0);
    ctx.lineTo(scanX, ch);
    ctx.stroke();
    ctx.restore();
  }

  /* ------------------------------------------------------------------------
     PRELOADER & CRITICAL ASSET DECODING
     ------------------------------------------------------------------------ */
  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function runPreloaderSequence() {
    const startMs = performance.now();
    await loadImage('assets/intro/hero_reveal.webp');

    if (dom.preloader) {
      requestAnimationFrame(() => dom.preloader.classList.add('phase-enter'));
      setTimeout(() => dom.preloader.classList.add('phase-pause'), 820);
    }

    const tasks = [];
    const priorityIndices = [0, 2, 14, 28, 46, 68, 88, 102, 106];
    priorityIndices.forEach((idx) => {
      const num = String(idx).padStart(3, '0');
      tasks.push(loadImage(`assets/process/f_${num}.webp`).then((img) => { cache.process[idx] = img; }));
    });

    tasks.push(
      loadImage('assets/coating/clean_beads.webp').then((img) => { cache.coatingBeads = img; }),
      loadImage('assets/correction/after.webp').then((img) => { cache.correction.after = img; }),
      loadImage('assets/correction/before.webp').then((img) => { cache.correction.before = img; }),
      loadImage('assets/wraps/stealth.webp').then((img) => { cache.wraps.stealth = img; }),
      loadImage('assets/wraps/silver.webp').then((img) => { cache.wraps.silver = img; }),
      loadImage('assets/wraps/midnight.webp').then((img) => { cache.wraps.midnight = img; }),
      loadImage('assets/wraps/crimson.webp').then((img) => { cache.wraps.crimson = img; }),
      loadImage('assets/wheels/gold.webp').then((img) => { cache.wheels.gold = img; }),
      loadImage('assets/wheels/crimson.webp').then((img) => { cache.wheels.crimson = img; }),
      loadImage('assets/wheels/acid.webp').then((img) => { cache.wheels.acid = img; }),
      loadImage('assets/wheels/silver.webp').then((img) => { cache.wheels.silver = img; }),
      loadImage('assets/tint/vlt70.webp').then((img) => { cache.tint.vlt70 = img; }),
      loadImage('assets/tint/vlt35.webp').then((img) => { cache.tint.vlt35 = img; }),
      loadImage('assets/tint/vlt15.webp').then((img) => { cache.tint.vlt15 = img; }),
      loadImage('assets/tint/vlt05.webp').then((img) => { cache.tint.vlt05 = img; }),
      loadImage('assets/interior/obsidian.webp').then((img) => { cache.interior.obsidian = img; }),
      loadImage('assets/interior/cognac.webp').then((img) => { cache.interior.cognac = img; }),
      loadImage('assets/interior/porcelain.webp').then((img) => { cache.interior.porcelain = img; })
    );

    let done = 0;
    const total = tasks.length;
    await Promise.all(
      tasks.map((p) =>
        p.then(() => {
          done++;
          const pct = Math.min(100, Math.round((done / total) * 100));
          if (dom.introPct) dom.introPct.textContent = `${pct}%`;
          if (dom.introBarFill) dom.introBarFill.style.width = `${pct}%`;
          if (dom.introStatusText) {
            if (pct < 45) dom.introStatusText.textContent = 'PREPARING BAY 01 OPTICS...';
            else if (pct < 90) dom.introStatusText.textContent = 'DECODING 4K STUDIO ASSETS...';
            else dom.introStatusText.textContent = 'ATELIER READY · LAUNCHING';
          }
        })
      )
    );

    resizeAllCanvases();
    initHydroDroplets();
    renderProcessSection(true);
    renderCoatingSection();
    renderCorrectionCanvases();
    updateCorrectionUI(state.corrRatio);
    renderWipeCanvas(dom.wrapsCanvas, cache.wraps, state.wraps, 0.72);
    renderWipeCanvas(dom.wheelsCanvas, cache.wheels, state.wheels, 0.5);
    renderWipeCanvas(dom.tintCanvas, cache.tint, state.tint, 0.68);
    renderWipeCanvas(dom.interiorCanvas, cache.interior, state.interior, 0.5);
    renderPricingSection();

    // Ensure full cinematic headlight reveal + laser sweep finishes cleanly even on instant cache loads
    const remainingShowMs = Math.max(380, 1750 - (performance.now() - startMs));
    setTimeout(() => {
      if (dom.preloader) dom.preloader.classList.add('phase-launch');
      setTimeout(() => {
        if (dom.preloader) dom.preloader.classList.add('intro-exit');
        document.body.classList.remove('is-loading');
        updateNavPill();
      }, 540);
    }, remainingShowMs);

    // Load remaining Hero scrub frames in background
    for (let i = 0; i < TOTAL_PROCESS_FRAMES; i++) {
      if (!cache.process[i]) {
        const num = String(i).padStart(3, '0');
        loadImage(`assets/process/f_${num}.webp`).then((img) => { cache.process[i] = img; });
      }
    }
  }

  if (dom.replayIntroBtn) {
    dom.replayIntroBtn.addEventListener('click', () => {
      if (!dom.preloader) return;
      dom.preloader.className = 'intro-preloader';
      if (dom.introPct) dom.introPct.textContent = '100%';
      if (dom.introBarFill) dom.introBarFill.style.width = '100%';
      if (dom.introStatusText) dom.introStatusText.textContent = 'REPLAYING ATELIER REVEAL...';

      requestAnimationFrame(() => dom.preloader.classList.add('phase-enter'));
      setTimeout(() => dom.preloader.classList.add('phase-pause'), 820);
      setTimeout(() => dom.preloader.classList.add('phase-launch'), 1950);
      setTimeout(() => dom.preloader.classList.add('intro-exit'), 2500);
    });
  }

  /* ------------------------------------------------------------------------
     SECTION 1 (HERO — ONLY SECTION WITH SCROLL ANIMATION + DIRECT NEXT BTN)
     ------------------------------------------------------------------------ */
  function getNearestFrame(arr, idx) {
    if (arr[idx]) return arr[idx];
    for (let off = 1; off < arr.length; off++) {
      if (idx - off >= 0 && arr[idx - off]) return arr[idx - off];
      if (idx + off < arr.length && arr[idx + off]) return arr[idx + off];
    }
    return null;
  }

  function updateProcessScrollTarget() {
    if (!dom.secProcess || state.isAutoPlayingProcess || state.isJumpingToSection2) return;
    const rect = dom.secProcess.getBoundingClientRect();
    const scrollable = Math.max(1, rect.height - window.innerHeight);
    const raw = -rect.top / scrollable;
    state.processTarget = Math.max(0.02, Math.min(1, raw));
  }

  let lastProcessIdx = -1;

  function renderProcessSection(force = false) {
    if (!dom.processCanvas) return;
    const diff = state.processTarget - state.processProgress;
    if (Math.abs(diff) > 0.0005) state.processProgress += diff * 0.16;
    else state.processProgress = state.processTarget;

    const p = Math.max(0, Math.min(1, state.processProgress));
    const idx = Math.min(TOTAL_PROCESS_FRAMES - 1, Math.floor(p * (TOTAL_PROCESS_FRAMES - 1)));

    if (force || idx !== lastProcessIdx) {
      lastProcessIdx = idx;
      const ctx = dom.processCanvas.getContext('2d');
      const img = getNearestFrame(cache.process, idx);
      drawCoverImage(ctx, img, dom.processCanvas.width, dom.processCanvas.height, 0.72, 0.5);

      const glossPct = Math.round(12 + p * 88);
      if (dom.glossValue) dom.glossValue.textContent = `${glossPct}%`;

      const litCount = Math.round(p * glossBarEls.length);
      glossBarEls.forEach((b, i) => b.classList.toggle('lit', i < litCount));

      if (dom.timelineFill) dom.timelineFill.style.width = `${Math.max(4, p * 100)}%`;
      const stepIdx = Math.min(4, Math.floor(p * 5));
      dom.timelineSteps.forEach((btn, i) => btn.classList.toggle('active', i === stepIdx));

      if (dom.flawlessWord) dom.flawlessWord.classList.toggle('is-flawless', p > 0.82);
    }
  }

  // Hero direct button ("Explore Coating"): plays wash animation AND smoothly glides to Section 2!
  function playHeroAndGlideToCoating() {
    if (!dom.secCoating) return;
    state.isJumpingToSection2 = true;
    state.isAutoPlayingProcess = false;

    const startP = state.processProgress;
    const startY = window.scrollY;
    const targetY = dom.secCoating.getBoundingClientRect().top + window.scrollY;
    const startT = performance.now();
    const duration = 840;

    function animateJump(now) {
      const t = Math.min(1, (now - startT) / duration);
      const ease = 1 - Math.pow(1 - t, 3);

      state.processProgress = startP + (1.0 - startP) * Math.min(1, t * 1.45);
      state.processTarget = state.processProgress;
      renderProcessSection(true);
      window.scrollTo(0, startY + (targetY - startY) * ease);

      if (t < 1) {
        requestAnimationFrame(animateJump);
      } else {
        state.isJumpingToSection2 = false;
        triggerHydroBurst();
      }
    }
    requestAnimationFrame(animateJump);
  }

  if (dom.btnNextSection) dom.btnNextSection.addEventListener('click', playHeroAndGlideToCoating);
  if (dom.hoodHotspot) dom.hoodHotspot.addEventListener('click', playHeroAndGlideToCoating);

  if (dom.btnAutoplayProcess) {
    dom.btnAutoplayProcess.addEventListener('click', () => {
      state.isAutoPlayingProcess = !state.isAutoPlayingProcess;
      if (state.isAutoPlayingProcess) {
        if (state.processProgress > 0.94) state.processProgress = 0.02;
        state.processTarget = 1.0;
        if (dom.autoplayLabel) dom.autoplayLabel.textContent = 'Pause wash';
      } else {
        if (dom.autoplayLabel) dom.autoplayLabel.textContent = 'Auto wash';
      }
    });
  }

  dom.timelineSteps.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetP = parseFloat(btn.getAttribute('data-progress') || '0.02');
      state.isAutoPlayingProcess = false;
      if (dom.autoplayLabel) dom.autoplayLabel.textContent = 'Auto wash';
      state.processTarget = targetP;

      if (dom.secProcess) {
        const rect = dom.secProcess.getBoundingClientRect();
        const top = rect.top + window.scrollY;
        const scrollable = Math.max(1, rect.height - window.innerHeight);
        window.scrollTo({ top: top + targetP * scrollable, behavior: 'smooth' });
      }
    });
  });

  /* ------------------------------------------------------------------------
     SECTION 2: CERAMIC COATING (4K BEADS + INTERACTIVE DROPLET PHYSICS)
     ------------------------------------------------------------------------ */
  const mouseCoating = { x: -99, y: -99 };

  function initHydroDroplets() {
    state.hydroDroplets = [];
    for (let i = 0; i < 34; i++) {
      state.hydroDroplets.push({
        x: 0.08 + Math.random() * 0.56,
        y: 0.22 + Math.random() * 0.68,
        vx: (Math.random() - 0.5) * 0.0008,
        vy: 0.0007 + Math.random() * 0.0014,
        r: (2.2 + Math.random() * 4.2) * DPR
      });
    }
  }

  function triggerHydroBurst() {
    for (let i = 0; i < 28; i++) {
      state.hydroDroplets.push({
        x: 0.34 + (Math.random() - 0.5) * 0.4,
        y: 0.45 + (Math.random() - 0.5) * 0.34,
        vx: (Math.random() - 0.45) * 0.008,
        vy: (Math.random() - 0.25) * 0.008,
        r: (3 + Math.random() * 4.8) * DPR
      });
    }
    if (state.hydroDroplets.length > 88) {
      state.hydroDroplets.splice(0, state.hydroDroplets.length - 88);
    }
    if (dom.beadAngleVal) {
      dom.beadAngleVal.textContent = '124';
      setTimeout(() => { if (dom.beadAngleVal) dom.beadAngleVal.textContent = '118'; }, 1100);
    }
  }

  if (dom.btnHydroBurst) dom.btnHydroBurst.addEventListener('click', triggerHydroBurst);

  if (dom.secCoating) {
    dom.secCoating.addEventListener('pointermove', (e) => {
      const r = dom.secCoating.getBoundingClientRect();
      mouseCoating.x = (e.clientX - r.left) / r.width;
      mouseCoating.y = (e.clientY - r.top) / r.height;
    });
  }

  function renderCoatingSection() {
    if (!dom.coatingCanvas) return;
    const ctx = dom.coatingCanvas.getContext('2d');
    const cw = dom.coatingCanvas.width;
    const ch = dom.coatingCanvas.height;
    drawCoverImage(ctx, cache.coatingBeads, cw, ch, 0.35, 0.5);

    ctx.save();
    for (let i = 0; i < state.hydroDroplets.length; i++) {
      const d = state.hydroDroplets[i];
      const dx = d.x - mouseCoating.x;
      const dy = d.y - mouseCoating.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.14 && dist > 0.0001) {
        const push = (0.14 - dist) * 0.04;
        d.vx += (dx / dist) * push;
        d.vy += (dy / dist) * push;
      }

      d.x += d.vx;
      d.y += d.vy;
      d.vx *= 0.96;
      d.vy = d.vy * 0.96 + 0.00011;

      if (d.y > 0.96 || d.x > 0.72 || d.x < 0.04) {
        d.x = 0.08 + Math.random() * 0.56;
        d.y = 0.22 + Math.random() * 0.35;
        d.vx = (Math.random() - 0.5) * 0.0008;
        d.vy = 0.0009 + Math.random() * 0.0014;
      }

      const px = d.x * cw;
      const py = d.y * ch;
      const g = ctx.createRadialGradient(px - d.r * 0.3, py - d.r * 0.3, d.r * 0.1, px, py, d.r);
      g.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      g.addColorStop(0.55, 'rgba(226, 232, 240, 0.55)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------------
     SECTION 3: OPTICAL PAINT CORRECTION (CLICK PRESETS + DRAG HANDLE)
     ------------------------------------------------------------------------ */
  function renderCorrectionCanvases() {
    if (!dom.corrBeforeCanvas || !dom.corrAfterCanvas) return;
    const cw = dom.corrBeforeCanvas.width;
    const ch = dom.corrBeforeCanvas.height;

    const ctxAfter = dom.corrAfterCanvas.getContext('2d');
    drawCoverImage(ctxAfter, cache.correction.after, cw, ch, 0.5, 0.5);

    const ctxBefore = dom.corrBeforeCanvas.getContext('2d');
    drawCoverImage(ctxBefore, cache.correction.before, cw, ch, 0.5, 0.5);

    // Subtle oxidation haze + spiderweb swirl scratches across BEFORE hood
    ctxBefore.save();
    ctxBefore.fillStyle = 'rgba(200, 195, 195, 0.08)';
    ctxBefore.fillRect(0, 0, cw, ch);

    ctxBefore.strokeStyle = 'rgba(255, 255, 255, 0.19)';
    ctxBefore.lineWidth = 1.05 * DPR;
    const centers = [[cw * 0.42, ch * 0.48], [cw * 0.65, ch * 0.45], [cw * 0.54, ch * 0.62]];
    centers.forEach(([sx, sy]) => {
      for (let rad = 16 * DPR; rad < 210 * DPR; rad += 10 * DPR) {
        for (let a = 0; a < Math.PI * 2; a += 0.52) {
          ctxBefore.beginPath();
          ctxBefore.arc(sx, sy, rad, a, a + 0.34);
          ctxBefore.stroke();
        }
      }
    });
    ctxBefore.restore();
    state.corrDirty = false;
  }

  function updateCorrectionUI(ratio) {
    const r = Math.max(0.05, Math.min(0.95, ratio));
    state.corrRatio = r;

    const pct = r * 100;
    if (dom.corrDivider) dom.corrDivider.style.left = `${pct}%`;
    if (dom.corrAfterClip) dom.corrAfterClip.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
    if (dom.corrHandle) dom.corrHandle.setAttribute('aria-valuenow', String(Math.round(pct)));

    const swirls = Math.max(0, Math.round((1 - (r - 0.08) / 0.80) * 4000));
    if (dom.swirlCounter) dom.swirlCounter.textContent = swirls.toLocaleString();

    if (dom.mirrorBadge) dom.mirrorBadge.classList.toggle('unlocked', r >= 0.82);

    dom.corrPresetBtns.forEach((btn) => {
      const pos = parseFloat(btn.getAttribute('data-corr-pos') || '0');
      btn.classList.toggle('active', Math.abs(pos - r) < 0.15);
    });
  }

  dom.corrPresetBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.corrTargetRatio = parseFloat(btn.getAttribute('data-corr-pos') || '0.5');
    });
  });

  if (dom.corrComparison) {
    const setFromX = (clientX) => {
      const rect = dom.corrComparison.getBoundingClientRect();
      const r = (clientX - rect.left) / Math.max(1, rect.width);
      state.corrTargetRatio = Math.max(0.05, Math.min(0.95, r));
      updateCorrectionUI(state.corrTargetRatio);
    };

    dom.corrComparison.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.corr-left-overlay') || e.target.closest('.corr-right-overlay')) return;
      state.isDraggingCorr = true;
      setFromX(e.clientX);
    });
    window.addEventListener('pointermove', (e) => {
      if (state.isDraggingCorr) setFromX(e.clientX);
    });
    window.addEventListener('pointerup', () => { state.isDraggingCorr = false; });
  }

  /* ------------------------------------------------------------------------
     SECTIONS 4, 5, 6, 7: CLICK-TRIGGERED LASER CONFIGURATORS
     ------------------------------------------------------------------------ */
  function triggerWipe(channel, nextKey) {
    if (nextKey === channel.current && !channel.scanning) return;
    channel.prev = channel.current;
    channel.current = nextKey;
    channel.progress = 0.0;
    channel.scanning = true;
    channel.dirty = true;
  }

  // Section 4: Custom Wraps
  function selectWrap(wrapKey) {
    triggerWipe(state.wraps, wrapKey);
    state.pricingDirty = true;
    dom.wrapOptions.forEach((btn) => {
      const match = btn.getAttribute('data-wrap') === wrapKey;
      btn.classList.toggle('active', match);
      btn.setAttribute('aria-checked', match ? 'true' : 'false');
      if (match) {
        const price = Number(btn.getAttribute('data-price') || 3200);
        const name = btn.getAttribute('data-name') || 'STEALTH BLACK';
        if (dom.wrapPriceValue) dom.wrapPriceValue.textContent = `$${price.toLocaleString()}`;
        if (dom.yourCarWrapName) dom.yourCarWrapName.textContent = name;
      }
    });
  }
  dom.wrapOptions.forEach((btn) => {
    btn.addEventListener('click', () => selectWrap(btn.getAttribute('data-wrap')));
  });

  // Section 5: Forged Wheel & Brake Caliper Studio
  dom.caliperOptions.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-caliper');
      triggerWipe(state.wheels, key);
      dom.caliperOptions.forEach((b) => {
        const match = b === btn;
        b.classList.toggle('active', match);
        b.setAttribute('aria-checked', match ? 'true' : 'false');
      });
    });
  });

  // Section 6: Nano-Ceramic Window Tint
  dom.tintOptions.forEach((btn) => {
    btn.addEventListener('click', () => {
      const rawTint = btn.getAttribute('data-tint') || '0.0';
      const mappedKey = TINT_KEY_MAP[rawTint] || 'vlt70';
      triggerWipe(state.tint, mappedKey);
      dom.tintOptions.forEach((b) => {
        const match = b === btn;
        b.classList.toggle('active', match);
        b.setAttribute('aria-checked', match ? 'true' : 'false');
      });
      if (dom.tintIrValue) dom.tintIrValue.textContent = btn.getAttribute('data-ir') || '64%';
    });
  });

  // Section 7: Supercar Cockpit Leather Sanctuary
  dom.interiorOptions.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-interior');
      triggerWipe(state.interior, key);
      dom.interiorOptions.forEach((b) => {
        const match = b === btn;
        b.classList.toggle('active', match);
        b.setAttribute('aria-checked', match ? 'true' : 'false');
      });
    });
  });

  /* ------------------------------------------------------------------------
     SECTION 8: PRICING & BOOKING CONFIGURATOR
     ------------------------------------------------------------------------ */
  function renderPricingSection() {
    if (!dom.pricingCanvas) return;
    const ctx = dom.pricingCanvas.getContext('2d');
    const img = cache.wraps[state.wraps.current] || cache.wraps.stealth;
    drawCoverImage(ctx, img, dom.pricingCanvas.width, dom.pricingCanvas.height, 0.72, 0.5);
    state.pricingDirty = false;
  }

  function updateQuoteTotal() {
    const total = state.pkgBase + state.vehicleAddon;
    if (dom.totalAmount) dom.totalAmount.textContent = `$${total.toLocaleString()}`;
  }

  dom.vehicleBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      dom.vehicleBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.vehicleAddon = Number(btn.getAttribute('data-addon') || 0);
      updateQuoteTotal();
    });
  });

  dom.pkgBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      dom.pkgBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.pkgBase = Number(btn.getAttribute('data-base') || 149);
      updateQuoteTotal();
    });
  });

  dom.slotBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      dom.slotBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedSlot = btn.getAttribute('data-slot');
      if (dom.btnBookSubmit) {
        dom.btnBookSubmit.classList.remove('confirmed');
        dom.btnBookSubmit.classList.add('ready');
      }
      if (dom.bookSubmitText) dom.bookSubmitText.textContent = `Reserve Bay · ${state.selectedSlot}`;
    });
  });

  if (dom.btnBookSubmit) {
    dom.btnBookSubmit.addEventListener('click', () => {
      if (!state.selectedSlot && dom.slotBtns[0]) dom.slotBtns[0].click();
      dom.btnBookSubmit.classList.add('confirmed');
      if (dom.bookSubmitText) {
        dom.bookSubmitText.textContent = `✓ Bay Confirmed (${state.selectedSlot || 'Thu 9:00'}) · Raza.Developer`;
      }
    });
  }

  if (dom.yourCarBadge) {
    const order = ['stealth', 'silver', 'midnight', 'crimson'];
    dom.yourCarBadge.addEventListener('click', () => {
      const next = order[(order.indexOf(state.wraps.current) + 1) % order.length];
      selectWrap(next);
      renderPricingSection();
    });
  }

  /* ------------------------------------------------------------------------
     NAVIGATION PILL & SCROLL TRACKING
     ------------------------------------------------------------------------ */
  function updateNavPill() {
    const active = document.querySelector('.nav-item.active');
    if (!active || !dom.navPill || !dom.navLinks) return;
    const navRect = dom.navLinks.getBoundingClientRect();
    const btnRect = active.getBoundingClientRect();
    const offsetLeft = btnRect.left - navRect.left + dom.navLinks.scrollLeft;
    dom.navPill.style.width = `${btnRect.width}px`;
    dom.navPill.style.transform = `translate3d(${offsetLeft - 4}px, 0, 0)`;
  }

  function scrollToSection(id) {
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  dom.navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      dom.navItems.forEach((b) => b.classList.toggle('active', b === btn));
      updateNavPill();
      scrollToSection(btn.getAttribute('data-section'));
    });
  });

  document.querySelectorAll('[data-goto]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToSection(el.getAttribute('data-goto'));
    });
  });

  const allSections = Array.from(document.querySelectorAll('[data-section-id]'));
  window.addEventListener(
    'scroll',
    () => {
      updateProcessScrollTarget();

      const mid = window.innerHeight * 0.45;
      let activeId = 'process';
      for (const sec of allSections) {
        const r = sec.getBoundingClientRect();
        if (r.top <= mid && r.bottom >= mid) {
          activeId = sec.getAttribute('data-section-id');
          break;
        }
      }
      dom.navItems.forEach((btn) => {
        const isMatch = btn.getAttribute('data-section') === activeId;
        if (isMatch && !btn.classList.contains('active')) {
          dom.navItems.forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          updateNavPill();
        }
      });
    },
    { passive: true }
  );

  /* ------------------------------------------------------------------------
     MAIN 60FPS RENDER LOOP (WITH INTERSECTION OBSERVER CULLING)
     ------------------------------------------------------------------------ */
  const visible = new Set(['process']);
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        const id = e.target.getAttribute('data-section-id');
        if (!id) return;
        if (e.isIntersecting) visible.add(id);
        else visible.delete(id);
      });
    },
    { threshold: 0.02 }
  );
  allSections.forEach((s) => io.observe(s));

  function stepLaserChannel(secId, canvas, imgMap, channel, focusX) {
    if (!visible.has(secId) && !channel.scanning) return;
    if (channel.scanning) {
      channel.progress += 0.036;
      if (channel.progress >= 1) {
        channel.progress = 1;
        channel.scanning = false;
      }
      renderWipeCanvas(canvas, imgMap, channel, focusX);
    } else if (channel.dirty) {
      renderWipeCanvas(canvas, imgMap, channel, focusX);
    }
  }

  function tick() {
    if (visible.has('process') || state.isAutoPlayingProcess || state.isJumpingToSection2) {
      if (state.isAutoPlayingProcess) {
        state.processProgress += 0.0045;
        state.processTarget = state.processProgress;
        if (state.processProgress >= 1) {
          state.processProgress = 1;
          state.isAutoPlayingProcess = false;
          if (dom.autoplayLabel) dom.autoplayLabel.textContent = 'Auto wash';
        }
        renderProcessSection(true);
      } else {
        renderProcessSection(false);
      }
    }

    if (visible.has('coating')) renderCoatingSection();

    if (visible.has('correction')) {
      if (state.corrDirty) renderCorrectionCanvases();
      if (Math.abs(state.corrTargetRatio - state.corrRatio) > 0.001) {
        updateCorrectionUI(state.corrRatio + (state.corrTargetRatio - state.corrRatio) * 0.18);
      }
    }

    stepLaserChannel('wraps', dom.wrapsCanvas, cache.wraps, state.wraps, 0.72);
    stepLaserChannel('wheels', dom.wheelsCanvas, cache.wheels, state.wheels, 0.5);
    stepLaserChannel('tint', dom.tintCanvas, cache.tint, state.tint, 0.68);
    stepLaserChannel('interior', dom.interiorCanvas, cache.interior, state.interior, 0.5);

    if (visible.has('pricing') && state.pricingDirty) renderPricingSection();

    requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------------------
     BOOT
     ------------------------------------------------------------------------ */
  runPreloaderSequence();
  requestAnimationFrame(tick);
})();
