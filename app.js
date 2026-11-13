/* ==========================================================
   MIRRORLINE — Auto Detailing Studio
   60/120fps GPU Engine: Car Intro Preloader, Lenis-Grade
   Smooth Wheel Inertia, Viewport Culling & Dirty-Flag Canvas
   ========================================================== */

(() => {
  'use strict';

  // ----------------------------------------------------------
  // 1. STATE & CONFIGURATION
  // ----------------------------------------------------------
  const TOTAL_PROCESS_FRAMES = 107;
  const TOTAL_COATING_FRAMES = 21;

  const state = {
    activeSection: 'process',
    visibleSections: new Set(['process']),

    // Process (0.0 -> 1.0)
    processProgress: 0.0,
    targetProcessProgress: 0.0,
    lastDrawnProcessFrame: -1,
    isAutoPlayingProcess: false,

    // Coating
    beadAngle: 62,
    targetBeadAngle: 112,
    pointerX: -1000,
    pointerY: -1000,

    // Correction slider (0.06 -> 0.92, where 0.16 = 3400 swirls, 0.84 = 0 swirls)
    corrSliderPos: 0.16,
    targetCorrSliderPos: 0.16,
    lastAppliedCorrPos: -1,
    userDraggedCorrection: false,
    isDraggingCorrection: false,
    correctionNeedsRedraw: true,

    // Wraps ('red' | 'blue' | 'silver')
    currentWrap: 'red',
    previousWrap: 'red',
    wrapScanProgress: 1.0,
    wrapsNeedsRedraw: true,
    wrapDisplayPrice: 2900,
    wrapTargetPrice: 2900,
    userClickedWrap: false,

    // Pricing Quote
    pricingNeedsRedraw: true,
    vehicle: 'Coupe',
    vehicleAddon: 0,
    pkg: 'Wash',
    pkgBase: 149,
    selectedSlot: null,
    selectedDay: null,
    isBooked: false,
    displayTotal: 149,
    targetTotal: 149,
  };

  const WRAP_META = {
    red: { name: 'CANDY RED', price: 2900, color: '#E11D48', glow: 'rgba(225, 29, 72, 0.85)' },
    blue: { name: 'MIDNIGHT BLUE', price: 3200, color: '#6B8AFF', glow: 'rgba(107, 138, 255, 0.85)' },
    silver: { name: 'LIQUID SILVER', price: 3900, color: '#D8E0EA', glow: 'rgba(216, 224, 234, 0.9)' },
  };

  // ----------------------------------------------------------
  // 2. DOM ELEMENTS
  // ----------------------------------------------------------
  const dom = {
    introPreloader: document.getElementById('intro-preloader'),
    introStatusText: document.getElementById('intro-status-text'),
    introPct: document.getElementById('intro-pct'),
    introBarFill: document.getElementById('intro-bar-fill'),
    replayIntroBtn: document.getElementById('replay-intro-btn'),

    navLinks: document.getElementById('nav-links'),
    navItems: Array.from(document.querySelectorAll('.nav-item')),
    navPill: document.getElementById('nav-pill-indicator'),
    frameModeToggle: document.getElementById('frame-mode-toggle'),
    frameModeLabel: document.getElementById('frame-mode-label'),

    // Process
    processSection: document.getElementById('process'),
    processCanvas: document.getElementById('process-canvas'),
    flawlessWord: document.getElementById('flawless-word'),
    glossValue: document.getElementById('gloss-value'),
    glossBarsContainer: document.getElementById('gloss-bars'),
    timelineFill: document.getElementById('timeline-fill'),
    timelineSteps: Array.from(document.querySelectorAll('.timeline-step')),
    hoodHotspot: document.getElementById('hood-hotspot'),
    btnAutoplayProcess: document.getElementById('btn-autoplay-process'),
    autoplayLabel: document.getElementById('autoplay-label'),

    // Coating
    coatingSection: document.getElementById('coating'),
    coatingCanvas: document.getElementById('coating-canvas'),
    beadAngleVal: document.getElementById('bead-angle-val'),

    // Correction
    correctionSection: document.getElementById('correction'),
    corrComparison: document.getElementById('correction-comparison'),
    corrBeforeCanvas: document.getElementById('correction-before-canvas'),
    corrAfterCanvas: document.getElementById('correction-after-canvas'),
    corrAfterClip: document.getElementById('corr-after-clip'),
    corrDivider: document.getElementById('corr-divider'),
    corrHandle: document.getElementById('corr-handle'),
    swirlCounter: document.getElementById('swirl-counter'),
    mirrorFinishBadge: document.getElementById('mirror-finish-badge'),

    // Wraps
    wrapsSection: document.getElementById('wraps'),
    wrapsCanvas: document.getElementById('wraps-canvas'),
    wrapAccentWord: document.getElementById('wrap-accent-word'),
    wrapOptions: Array.from(document.querySelectorAll('.wrap-option')),
    wrapPriceValue: document.getElementById('wrap-price-value'),

    // Pricing
    pricingSection: document.getElementById('pricing'),
    pricingCanvas: document.getElementById('pricing-canvas'),
    vehicleBtns: Array.from(document.querySelectorAll('#vehicle-selector .quote-pill')),
    pkgBtns: Array.from(document.querySelectorAll('#package-selector .pkg-card')),
    slotBtns: Array.from(document.querySelectorAll('#slot-selector .slot-pill')),
    totalAmount: document.getElementById('total-amount'),
    btnBookSubmit: document.getElementById('btn-book-submit'),
    bookSubmitText: document.getElementById('book-submit-text'),
    yourCarBadge: document.getElementById('your-car-badge'),
    yourCarWrapName: document.getElementById('your-car-wrap-name'),
  };

  // Build 24 GLOSS LED bar segments
  const glossBarEls = [];
  for (let i = 0; i < 24; i++) {
    const seg = document.createElement('div');
    seg.className = 'gloss-bar-seg';
    dom.glossBarsContainer.appendChild(seg);
    glossBarEls.push(seg);
  }

  // ----------------------------------------------------------
  // 3. GPU ASSET PRELOADER + CINEMATIC CAR INTRO CHOREOGRAPHY
  // ----------------------------------------------------------
  const images = {
    process: new Array(TOTAL_PROCESS_FRAMES),
    coating: new Array(TOTAL_COATING_FRAMES),
    correctionAfter: new Image(),
    correctionBefore: new Image(),
    wraps: {
      red: new Image(),
      blue: new Image(),
      silver: new Image(),
    },
  };

  let totalAssetsToLoad = TOTAL_PROCESS_FRAMES + TOTAL_COATING_FRAMES + 5;
  let loadedAssetsCount = 0;

  function onAssetLoaded() {
    loadedAssetsCount++;
    if (loadedAssetsCount >= totalAssetsToLoad) {
      state.correctionNeedsRedraw = true;
      state.wrapsNeedsRedraw = true;
      state.pricingNeedsRedraw = true;
      state.lastDrawnProcessFrame = -1;
    }
  }

  function loadAndDecodeImage(img, src) {
    img.decoding = 'async';
    img.onload = () => {
      if (img.decode) {
        img.decode().catch(() => {}).finally(onAssetLoaded);
      } else {
        onAssetLoaded();
      }
    };
    img.onerror = onAssetLoaded;
    img.src = src;
  }

  function preloadAllAssets() {
    loadAndDecodeImage(images.wraps.red, 'assets/wraps/red.webp');
    loadAndDecodeImage(images.wraps.blue, 'assets/wraps/blue.webp');
    loadAndDecodeImage(images.wraps.silver, 'assets/wraps/silver.webp');
    loadAndDecodeImage(images.correctionAfter, 'assets/correction/after.webp');
    loadAndDecodeImage(images.correctionBefore, 'assets/correction/before.webp');

    for (let i = 0; i < TOTAL_PROCESS_FRAMES; i++) {
      const img = new Image();
      images.process[i] = img;
      loadAndDecodeImage(img, `assets/process/f_${String(i).padStart(3, '0')}.webp`);
    }

    for (let i = 0; i < TOTAL_COATING_FRAMES; i++) {
      const img = new Image();
      images.coating[i] = img;
      loadAndDecodeImage(img, `assets/coating/c_${String(i).padStart(2, '0')}.webp`);
    }
  }

  /**
   * Runs the 3-stage Car Intro Animation:
   * 1. Car drives in from left (phase-enter)
   * 2. Car pauses in studio center while hex ceiling lights ignite & preloader reaches 100% (phase-pause)
   * 3. Car launches off to the right with crimson tail-light trails & website reveals (phase-launch -> intro-exit)
   */
  function runCarIntroSequence(isReplay = false) {
    const el = dom.introPreloader;
    if (!el) return;

    document.body.classList.add('is-loading');
    el.classList.remove('intro-exit', 'phase-enter', 'phase-pause', 'phase-launch');
    if (dom.introPct) dom.introPct.textContent = '0%';
    if (dom.introBarFill) dom.introBarFill.style.width = '0%';
    if (dom.introStatusText) dom.introStatusText.textContent = 'ENTERING DETAIL STUDIO...';

    // Force reflow so car starts at translate3d(-115vw, 0, 0)
    void el.offsetWidth;

    // Phase 1: Car drives in (0ms -> 900ms)
    el.classList.add('phase-enter');

    const startTime = performance.now();
    const minDuration = isReplay ? 1850 : 2100;

    function tickIntro(now) {
      const elapsed = now - startTime;
      const timeProgress = Math.min(1, elapsed / minDuration);
      const assetProgress = isReplay ? 1 : Math.min(1, loadedAssetsCount / Math.max(1, totalAssetsToLoad * 0.75));
      const combined = Math.min(1, timeProgress * 0.65 + assetProgress * 0.35);
      const pct = Math.round(combined * 100);

      if (dom.introPct) dom.introPct.textContent = `${pct}%`;
      if (dom.introBarFill) dom.introBarFill.style.width = `${pct}%`;

      if (elapsed >= 850 && !el.classList.contains('phase-pause') && !el.classList.contains('phase-launch')) {
        // Phase 2: Car pauses in center of studio, hex lights ignite, headlights flare!
        el.classList.remove('phase-enter');
        el.classList.add('phase-pause');
        if (dom.introStatusText) dom.introStatusText.textContent = 'IGNITING HEXAGON STUDIO LIGHTS...';
      }

      if (combined < 1 || elapsed < minDuration) {
        requestAnimationFrame(tickIntro);
      } else {
        // Phase 3: Studio Ready -> Car launches forward at high speed!
        if (dom.introPct) dom.introPct.textContent = '100%';
        if (dom.introBarFill) dom.introBarFill.style.width = '100%';
        if (dom.introStatusText) dom.introStatusText.textContent = 'STUDIO READY · LAUNCHING';

        el.classList.remove('phase-pause');
        el.classList.add('phase-launch');

        setTimeout(() => {
          el.classList.add('intro-exit');
          document.body.classList.remove('is-loading');
          state.lastDrawnProcessFrame = -1;
          state.correctionNeedsRedraw = true;
          state.wrapsNeedsRedraw = true;
          state.pricingNeedsRedraw = true;
        }, 520);
      }
    }

    requestAnimationFrame(tickIntro);
  }

  if (dom.replayIntroBtn) {
    dom.replayIntroBtn.addEventListener('click', () => {
      runCarIntroSequence(true);
    });
  }

  // ----------------------------------------------------------
  // 4. LENIS-GRADE VIRTUAL SMOOTH SCROLL ENGINE (DESKTOP WHEEL + NATIVE TOUCH)
  // ----------------------------------------------------------
  const smoothScroll = {
    currentY: window.scrollY,
    targetY: window.scrollY,
    isWheelActive: false,
    lerp: 0.115, // Silky-smooth exponential damping
  };

  function getMaxScrollY() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  // Intercept desktop mouse wheel for buttery inertia scrolling
  window.addEventListener('wheel', (e) => {
    if (document.body.classList.contains('is-loading')) {
      e.preventDefault();
      return;
    }
    // Do not hijack pinch-zoom
    if (e.ctrlKey) return;

    e.preventDefault();
    if (!smoothScroll.isWheelActive) {
      smoothScroll.currentY = window.scrollY;
      smoothScroll.targetY = window.scrollY;
      smoothScroll.isWheelActive = true;
    }

    // Normalize wheel delta across mice and trackpads
    const delta = e.deltaMode === 1 ? e.deltaY * 36 : e.deltaY;
    smoothScroll.targetY = Math.max(0, Math.min(getMaxScrollY(), smoothScroll.targetY + delta * 0.95));

    state.isAutoPlayingProcess = false;
    if (dom.autoplayLabel) dom.autoplayLabel.textContent = 'Our process';
  }, { passive: false });

  // Sync when user drags native scrollbar or uses touch on mobile
  window.addEventListener('touchstart', () => {
    smoothScroll.isWheelActive = false;
  }, { passive: true });

  window.addEventListener('scroll', () => {
    if (!smoothScroll.isWheelActive) {
      smoothScroll.currentY = window.scrollY;
      smoothScroll.targetY = window.scrollY;
    }
    handleScrollMetrics();
  }, { passive: true });

  function scrollToPositionSmoothly(destY) {
    smoothScroll.currentY = window.scrollY;
    smoothScroll.targetY = Math.max(0, Math.min(getMaxScrollY(), destY));
    smoothScroll.isWheelActive = true;
  }

  // ----------------------------------------------------------
  // 5. NAVBAR PILL & SECTION OBSERVER (VIEWPORT CULLING)
  // ----------------------------------------------------------
  function updateNavPill(sectionId) {
    const activeBtn = dom.navItems.find((b) => b.dataset.section === sectionId);
    if (!activeBtn || !dom.navPill) return;
    dom.navItems.forEach((b) => b.classList.toggle('active', b === activeBtn));
    dom.navPill.style.width = `${activeBtn.offsetWidth}px`;
    dom.navPill.style.transform = `translate3d(${activeBtn.offsetLeft}px, 0, 0)`;
  }

  dom.navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      const secId = btn.dataset.section;
      const targetEl = document.getElementById(secId);
      if (targetEl) {
        state.activeSection = secId;
        updateNavPill(secId);
        scrollToPositionSmoothly(targetEl.offsetTop);
      }
    });
  });

  document.querySelectorAll('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const secId = btn.dataset.goto;
      const targetEl = document.getElementById(secId);
      if (targetEl) {
        scrollToPositionSmoothly(targetEl.offsetTop);
      }
    });
  });

  // Showcase Frame Mode Toggle
  if (dom.frameModeToggle) {
    dom.frameModeToggle.addEventListener('click', () => {
      const isFrame = document.body.classList.toggle('mode-frame');
      document.body.classList.toggle('mode-fullscreen', !isFrame);
      dom.frameModeLabel.textContent = isFrame ? 'Full Screen' : 'Reel Frame';
      setTimeout(() => {
        resizeAllCanvases();
        updateNavPill(state.activeSection);
      }, 60);
    });
  }

  // IntersectionObserver to cull offscreen canvas animations (massive FPS boost!)
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const id = entry.target.dataset.sectionId;
      if (!id) return;
      if (entry.isIntersecting) {
        state.visibleSections.add(id);
        if (id === 'process') state.lastDrawnProcessFrame = -1;
        if (id === 'correction') state.correctionNeedsRedraw = true;
        if (id === 'wraps') state.wrapsNeedsRedraw = true;
        if (id === 'pricing') state.pricingNeedsRedraw = true;
      } else {
        state.visibleSections.delete(id);
      }
    });
  }, { rootMargin: '150px 0px' });

  [
    dom.processSection,
    dom.coatingSection,
    dom.correctionSection,
    dom.wrapsSection,
    dom.pricingSection,
  ].forEach((sec) => {
    if (sec) sectionObserver.observe(sec);
  });

  // ----------------------------------------------------------
  // 6. CANVAS SIZING & SMART COVER RENDERING
  // ----------------------------------------------------------
  const canvases = [
    dom.processCanvas,
    dom.coatingCanvas,
    dom.corrBeforeCanvas,
    dom.corrAfterCanvas,
    dom.wrapsCanvas,
    dom.pricingCanvas,
  ];

  function resizeAllCanvases() {
    // Cap DPR at 1.5 for ultra-fast GPU fill-rate with crisp retina sharpness
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvases.forEach((c) => {
      if (!c) return;
      const rect = c.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
    });
    buildProceduralSwirlOverlay();
    state.lastDrawnProcessFrame = -1;
    state.correctionNeedsRedraw = true;
    state.wrapsNeedsRedraw = true;
    state.pricingNeedsRedraw = true;
    handleScrollMetrics();
    requestAnimationFrame(() => updateNavPill(state.activeSection));
  }

  window.addEventListener('resize', resizeAllCanvases);

  function drawImageSmartCover(ctx, img, cw, ch, opts = {}) {
    if (!img || !img.complete || !img.naturalWidth) return;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const isMobile = cw < ch * 0.95;

    const scale = Math.max(cw / iw, ch / ih) * (opts.zoom || (isMobile ? 1.04 : 1.0));
    const dw = iw * scale;
    const dh = ih * scale;

    const alignX = opts.alignX !== undefined ? opts.alignX : (isMobile ? 0.68 : 0.5);
    const alignY = opts.alignY !== undefined ? opts.alignY : (isMobile ? 0.35 : 0.5);

    const dx = (cw - dw) * alignX + (opts.offsetX || 0);
    const dy = (ch - dh) * alignY + (opts.offsetY || 0);

    ctx.drawImage(img, dx, dy, dw, dh);
  }

  // ----------------------------------------------------------
  // 7. SECTION 1: PROCESS ("Filthy to flawless.") — 107-Frame Dirty-Flag Renderer
  // ----------------------------------------------------------
  let lastGlossInt = -1;
  let lastStepIdx = -1;

  function renderProcessCanvas(progress) {
    const c = dom.processCanvas;
    if (!c) return;
    const frameIdx = Math.max(0, Math.min(TOTAL_PROCESS_FRAMES - 1, Math.round(progress * (TOTAL_PROCESS_FRAMES - 1))));

    // Dirty-flag check: only redraw canvas when the frame index actually changes!
    if (frameIdx === state.lastDrawnProcessFrame) return;

    const img = images.process[frameIdx];
    if (!img || !img.complete || !img.naturalWidth) return;

    state.lastDrawnProcessFrame = frameIdx;
    const ctx = c.getContext('2d', { alpha: false });
    const cw = c.width;
    const ch = c.height;

    ctx.fillStyle = '#070709';
    ctx.fillRect(0, 0, cw, ch);
    drawImageSmartCover(ctx, img, cw, ch);
  }

  function updateProcessUI(progress) {
    const gloss = Math.round(12 + progress * 86);
    if (gloss !== lastGlossInt) {
      lastGlossInt = gloss;
      if (dom.glossValue) dom.glossValue.textContent = `${gloss}%`;

      let accentColor = '#C49A76'; // 01 MUD
      if (progress >= 0.18 && progress < 0.45) accentColor = '#F3ECE6'; // 02 FOAM
      else if (progress >= 0.45 && progress < 0.72) accentColor = '#F09AA8'; // 03 RINSE
      else if (progress >= 0.72) accentColor = '#E11D48'; // 04 DRY & 05 SHINE

      if (dom.flawlessWord) dom.flawlessWord.style.color = accentColor;
      if (dom.glossValue) dom.glossValue.style.color = accentColor;

      const litCount = Math.max(2, Math.round((gloss / 100) * 24));
      for (let i = 0; i < 24; i++) {
        const isLit = i < litCount;
        glossBarEls[i].style.backgroundColor = isLit ? accentColor : 'rgba(255,255,255,0.12)';
      }
    }

    const fillPct = Math.max(6, Math.min(100, 8 + progress * 92));
    if (dom.timelineFill) {
      dom.timelineFill.style.width = `${fillPct.toFixed(1)}%`;
    }

    let stepIdx = 0;
    if (progress >= 0.82) stepIdx = 4;
    else if (progress >= 0.64) stepIdx = 3;
    else if (progress >= 0.42) stepIdx = 2;
    else if (progress >= 0.18) stepIdx = 1;

    if (stepIdx !== lastStepIdx) {
      lastStepIdx = stepIdx;
      dom.timelineSteps.forEach((btn, idx) => {
        btn.classList.toggle('active', idx <= stepIdx);
      });
    }

    if (dom.hoodHotspot) {
      dom.hoodHotspot.classList.toggle('visible', progress > 0.86);
    }
  }

  dom.timelineSteps.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetP = parseFloat(btn.dataset.progress || '0');
      state.isAutoPlayingProcess = false;
      if (dom.autoplayLabel) dom.autoplayLabel.textContent = 'Our process';

      const secTop = dom.processSection.offsetTop;
      const scrollable = dom.processSection.offsetHeight - window.innerHeight;
      scrollToPositionSmoothly(secTop + scrollable * targetP);
    });
  });

  if (dom.btnAutoplayProcess) {
    dom.btnAutoplayProcess.addEventListener('click', () => {
      if (state.processProgress > 0.92) {
        state.processProgress = 0.0;
        state.targetProcessProgress = 0.0;
      }
      state.isAutoPlayingProcess = !state.isAutoPlayingProcess;
      if (dom.autoplayLabel) {
        dom.autoplayLabel.textContent = state.isAutoPlayingProcess ? 'Playing...' : 'Our process';
      }
    });
  }

  if (dom.hoodHotspot) {
    dom.hoodHotspot.addEventListener('click', () => {
      if (dom.coatingSection) {
        scrollToPositionSmoothly(dom.coatingSection.offsetTop + 60);
      }
    });
  }

  // ----------------------------------------------------------
  // 8. SECTION 2: COATING ("Water can't stick.")
  // ----------------------------------------------------------
  const waterBeads = Array.from({ length: 18 }, () => ({
    x: Math.random(),
    y: Math.random(),
    vx: 0,
    vy: Math.random() * 0.0012 + 0.0004,
    r: Math.random() * 8 + 4,
  }));

  if (dom.coatingSection) {
    dom.coatingSection.addEventListener('pointermove', (e) => {
      const rect = dom.coatingCanvas.getBoundingClientRect();
      state.pointerX = (e.clientX - rect.left) / rect.width;
      state.pointerY = (e.clientY - rect.top) / rect.height;
    }, { passive: true });
    dom.coatingSection.addEventListener('pointerleave', () => {
      state.pointerX = -1000;
      state.pointerY = -1000;
    }, { passive: true });
  }

  function renderCoatingCanvas(now) {
    const c = dom.coatingCanvas;
    if (!c) return;
    const ctx = c.getContext('2d', { alpha: false });
    const cw = c.width;
    const ch = c.height;

    const cyclePos = (now * 0.011) % ((TOTAL_COATING_FRAMES - 1) * 2);
    const rawIdx = cyclePos <= (TOTAL_COATING_FRAMES - 1)
      ? cyclePos
      : (TOTAL_COATING_FRAMES - 1) * 2 - cyclePos;
    const idx = Math.round(rawIdx);
    const img = images.coating[idx];

    if (img && img.complete && img.naturalWidth) {
      drawImageSmartCover(ctx, img, cw, ch, { alignX: 0.55, alignY: 0.5 });
    }

    const scale = cw / 1000;
    ctx.save();
    waterBeads.forEach((b) => {
      const dx = b.x - state.pointerX;
      const dy = b.y - state.pointerY;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.16 && dist > 0.0001) {
        const force = (0.16 - dist) * 0.08;
        b.vx += (dx / dist) * force;
        b.vy += (dy / dist) * force;
      }

      b.x += b.vx + 0.0003;
      b.y += b.vy;
      b.vx *= 0.92;
      b.vy = b.vy * 0.95 + 0.00018;

      if (b.y > 1.05) { b.y = -0.04; b.x = Math.random(); b.vx = 0; b.vy = 0.001; }
      if (b.x > 1.05) b.x = -0.04;
      if (b.x < -0.05) b.x = 1.04;

      const px = b.x * cw;
      const py = b.y * ch;
      const r = Math.max(3, b.r * scale);

      ctx.beginPath();
      ctx.ellipse(px, py, r, r * 0.82, -0.15, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(180, 12, 38, 0.55)';
      ctx.strokeStyle = 'rgba(255, 210, 220, 0.65)';
      ctx.lineWidth = 1.2;
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(px - r * 0.28, py - r * 0.26, r * 0.26, r * 0.13, -0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.fill();
    });
    ctx.restore();

    state.beadAngle += (state.targetBeadAngle - state.beadAngle) * 0.08;
    if (dom.beadAngleVal) {
      dom.beadAngleVal.textContent = String(Math.round(state.beadAngle));
    }
  }

  // ----------------------------------------------------------
  // 9. SECTION 3: CORRECTION ("Erase every swirl.")
  //    Static Pre-Baked Canvas Layers + 120fps GPU CSS Clip-Path Slider!
  // ----------------------------------------------------------
  let swirlPatternCanvas = null;

  function buildProceduralSwirlOverlay() {
    if (!dom.corrBeforeCanvas) return;
    const w = dom.corrBeforeCanvas.width || 960;
    const h = dom.corrBeforeCanvas.height || 540;
    swirlPatternCanvas = document.createElement('canvas');
    swirlPatternCanvas.width = w;
    swirlPatternCanvas.height = h;
    const sctx = swirlPatternCanvas.getContext('2d');

    sctx.strokeStyle = 'rgba(255, 225, 230, 0.13)';
    sctx.lineWidth = Math.max(0.7, w / 1300);

    const centers = [
      { x: w * 0.25, y: h * 0.28 },
      { x: w * 0.52, y: h * 0.26 },
      { x: w * 0.78, y: h * 0.30 },
      { x: w * 0.38, y: h * 0.76 },
      { x: w * 0.68, y: h * 0.78 },
    ];

    centers.forEach((c) => {
      for (let i = 0; i < 85; i++) {
        const radius = 14 + Math.random() * (w * 0.22);
        const startAng = Math.random() * Math.PI * 2;
        const arcLen = 0.35 + Math.random() * 1.15;
        const jitterX = (Math.random() - 0.5) * 28;
        const jitterY = (Math.random() - 0.5) * 22;
        sctx.beginPath();
        sctx.arc(c.x + jitterX, c.y + jitterY, radius, startAng, startAng + arcLen);
        sctx.stroke();
      }
    });
  }

  function renderCorrectionCanvasesOnce() {
    if (!state.correctionNeedsRedraw) return;
    const cb = dom.corrBeforeCanvas;
    const ca = dom.corrAfterCanvas;
    if (!cb || !ca) return;
    if (!images.correctionBefore.complete || !images.correctionAfter.complete) return;

    state.correctionNeedsRedraw = false;
    const w = cb.width;
    const h = cb.height;

    const ctxB = cb.getContext('2d', { alpha: false });
    drawImageSmartCover(ctxB, images.correctionBefore, w, h, { alignX: 0.5, alignY: 0.5 });
    if (swirlPatternCanvas) {
      ctxB.save();
      ctxB.globalCompositeOperation = 'screen';
      ctxB.drawImage(swirlPatternCanvas, 0, 0, w, h);
      ctxB.restore();
    }

    const ctxA = ca.getContext('2d', { alpha: false });
    drawImageSmartCover(ctxA, images.correctionAfter, w, h, { alignX: 0.5, alignY: 0.5 });
  }

  function updateCorrectionUI(pos) {
    if (Math.abs(pos - state.lastAppliedCorrPos) < 0.0005) return;
    state.lastAppliedCorrPos = pos;

    const clamped = Math.max(0.06, Math.min(0.94, pos));
    const pct = clamped * 100;
    const rightInset = 100 - pct;

    if (dom.corrAfterClip) {
      dom.corrAfterClip.style.clipPath = `inset(0 ${rightInset.toFixed(2)}% 0 0)`;
    }
    if (dom.corrDivider) {
      dom.corrDivider.style.left = `${pct.toFixed(2)}%`;
    }
    if (dom.corrHandle) {
      dom.corrHandle.setAttribute('aria-valuenow', String(Math.round(pct)));
    }

    const norm = Math.max(0, Math.min(1, (0.82 - clamped) / (0.82 - 0.16)));
    const swirls = Math.round(3400 * Math.pow(norm, 1.15));
    if (dom.swirlCounter) {
      dom.swirlCounter.textContent = swirls.toLocaleString('en-US');
    }
    if (dom.mirrorFinishBadge) {
      dom.mirrorFinishBadge.classList.toggle('visible', swirls === 0);
    }
  }

  if (dom.corrComparison) {
    const setSliderFromClientX = (clientX) => {
      const rect = dom.corrComparison.getBoundingClientRect();
      const relX = (clientX - rect.left) / rect.width;
      state.targetCorrSliderPos = Math.max(0.06, Math.min(0.92, relX));
      state.userDraggedCorrection = true;
    };

    dom.corrComparison.addEventListener('pointerdown', (e) => {
      state.isDraggingCorrection = true;
      setSliderFromClientX(e.clientX);
      if (dom.corrComparison.setPointerCapture) {
        try { dom.corrComparison.setPointerCapture(e.pointerId); } catch (_) {}
      }
    });

    dom.corrComparison.addEventListener('pointermove', (e) => {
      if (!state.isDraggingCorrection) return;
      setSliderFromClientX(e.clientX);
    });

    const endDrag = () => { state.isDraggingCorrection = false; };
    dom.corrComparison.addEventListener('pointerup', endDrag);
    dom.corrComparison.addEventListener('pointercancel', endDrag);
  }

  // ----------------------------------------------------------
  // 10. SECTION 4: WRAPS ("Pick your wrap.") — On-Demand Laser Sweep
  // ----------------------------------------------------------
  function selectWrap(wrapKey) {
    if (!WRAP_META[wrapKey] || wrapKey === state.currentWrap) return;
    state.previousWrap = state.currentWrap;
    state.currentWrap = wrapKey;
    state.wrapScanProgress = 0.0;
    state.wrapsNeedsRedraw = true;
    state.pricingNeedsRedraw = true;
    state.wrapTargetPrice = WRAP_META[wrapKey].price;

    dom.wrapOptions.forEach((btn) => {
      const isSelected = btn.dataset.wrap === wrapKey;
      btn.classList.toggle('active', isSelected);
      btn.setAttribute('aria-checked', String(isSelected));
    });

    if (dom.wrapAccentWord) {
      dom.wrapAccentWord.style.color = WRAP_META[wrapKey].color;
    }

    if (dom.yourCarWrapName) {
      dom.yourCarWrapName.textContent = WRAP_META[wrapKey].name;
    }
  }

  dom.wrapOptions.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.userClickedWrap = true;
      selectWrap(btn.dataset.wrap);
    });
  });

  if (dom.yourCarBadge) {
    dom.yourCarBadge.addEventListener('click', () => {
      const order = ['red', 'blue', 'silver'];
      const next = order[(order.indexOf(state.currentWrap) + 1) % order.length];
      state.userClickedWrap = true;
      selectWrap(next);
    });
  }

  function renderWrapsCanvas() {
    if (!state.wrapsNeedsRedraw && state.wrapScanProgress >= 1.0) return;

    const c = dom.wrapsCanvas;
    if (!c) return;
    const ctx = c.getContext('2d', { alpha: false });
    const cw = c.width;
    const ch = c.height;

    const imgCurr = images.wraps[state.currentWrap];
    const imgPrev = images.wraps[state.previousWrap];

    if (state.wrapScanProgress < 0.995 && imgPrev && imgPrev.complete && imgCurr && imgCurr.complete) {
      state.wrapScanProgress = Math.min(1.0, state.wrapScanProgress + 0.036);
      const p = state.wrapScanProgress;

      drawImageSmartCover(ctx, imgPrev, cw, ch);

      const scanY = ch * (0.18 + p * 0.72);
      const tilt = ch * 0.045;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(cw, 0);
      ctx.lineTo(cw, scanY + tilt);
      ctx.lineTo(0, scanY - tilt);
      ctx.closePath();
      ctx.clip();

      drawImageSmartCover(ctx, imgCurr, cw, ch);
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cw * 0.24, scanY - tilt * 0.5);
      ctx.lineTo(cw * 0.97, scanY + tilt);
      ctx.strokeStyle = WRAP_META[state.currentWrap].glow;
      ctx.lineWidth = Math.max(6, ch * 0.022);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cw * 0.24, scanY - tilt * 0.5);
      ctx.lineTo(cw * 0.97, scanY + tilt);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2.2, ch * 0.007);
      ctx.stroke();
      ctx.restore();
    } else if (imgCurr && imgCurr.complete && imgCurr.naturalWidth) {
      drawImageSmartCover(ctx, imgCurr, cw, ch);
      state.wrapsNeedsRedraw = false;
    }
  }

  // ----------------------------------------------------------
  // 11. SECTION 5: PRICING ("Price it. Book it.") — Static Canvas + GPU CSS Zoom
  // ----------------------------------------------------------
  function renderPricingCanvasOnce() {
    if (!state.pricingNeedsRedraw) return;
    const c = dom.pricingCanvas;
    if (!c) return;
    const img = images.wraps[state.currentWrap] || images.wraps.silver;
    if (!img || !img.complete || !img.naturalWidth) return;

    state.pricingNeedsRedraw = false;
    const ctx = c.getContext('2d', { alpha: false });
    const cw = c.width;
    const ch = c.height;
    const isMobile = cw < ch * 0.95;

    drawImageSmartCover(ctx, img, cw, ch, {
      zoom: isMobile ? 1.08 : 1.18,
      alignX: isMobile ? 0.65 : 0.15,
      alignY: isMobile ? 0.35 : 0.52,
      offsetX: isMobile ? 0 : cw * 0.14,
    });
  }

  function recalculateQuote() {
    state.targetTotal = state.pkgBase + state.vehicleAddon;
    state.isBooked = false;
    dom.btnBookSubmit.classList.remove('booked');
    updateBookingButtonLabel();
  }

  function updateBookingButtonLabel() {
    const totalFormatted = `$${state.targetTotal.toLocaleString('en-US')}`;
    if (state.isBooked) {
      dom.bookSubmitText.textContent = `Booked ✓ See you ${state.selectedDay || 'Saturday'}`;
    } else if (state.selectedDay) {
      dom.bookSubmitText.textContent = `Book ${state.selectedDay} · ${totalFormatted} →`;
    } else {
      dom.bookSubmitText.textContent = 'Choose a time';
    }
  }

  dom.vehicleBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      dom.vehicleBtns.forEach((b) => b.classList.toggle('active', b === btn));
      state.vehicle = btn.dataset.vehicle;
      state.vehicleAddon = parseInt(btn.dataset.addon || '0', 10);
      recalculateQuote();
    });
  });

  dom.pkgBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      dom.pkgBtns.forEach((b) => b.classList.toggle('active', b === btn));
      state.pkg = btn.dataset.pkg;
      state.pkgBase = parseInt(btn.dataset.base || '149', 10);
      recalculateQuote();
    });
  });

  dom.slotBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      dom.slotBtns.forEach((b) => b.classList.toggle('active', b === btn));
      state.selectedSlot = btn.dataset.slot;
      state.selectedDay = btn.dataset.day;
      state.isBooked = false;
      dom.btnBookSubmit.classList.remove('booked');
      updateBookingButtonLabel();
    });
  });

  if (dom.btnBookSubmit) {
    dom.btnBookSubmit.addEventListener('click', () => {
      if (!state.selectedDay) {
        const satBtn = dom.slotBtns[1] || dom.slotBtns[0];
        if (satBtn) satBtn.click();
        return;
      }
      state.isBooked = !state.isBooked;
      dom.btnBookSubmit.classList.toggle('booked', state.isBooked);
      updateBookingButtonLabel();
    });
  }

  // ----------------------------------------------------------
  // 12. SCROLL PROGRESS METRICS & ULTRA-LIGHT 60/120FPS MAIN LOOP
  // ----------------------------------------------------------
  function getSectionScrollProgress(sectionEl) {
    if (!sectionEl) return 0;
    const rect = sectionEl.getBoundingClientRect();
    const scrollable = Math.max(1, rect.height - window.innerHeight);
    return Math.max(0, Math.min(1, -rect.top / scrollable));
  }

  function handleScrollMetrics() {
    const vh = window.innerHeight;

    const sections = [
      dom.processSection,
      dom.coatingSection,
      dom.correctionSection,
      dom.wrapsSection,
      dom.pricingSection,
    ];

    for (const sec of sections) {
      if (!sec) continue;
      const r = sec.getBoundingClientRect();
      if (r.top <= vh * 0.45 && r.bottom >= vh * 0.45) {
        if (state.activeSection !== sec.dataset.sectionId) {
          state.activeSection = sec.dataset.sectionId;
          updateNavPill(state.activeSection);
        }
        break;
      }
    }

    if (state.visibleSections.has('process') && !state.isAutoPlayingProcess) {
      state.targetProcessProgress = getSectionScrollProgress(dom.processSection);
    }

    if (state.visibleSections.has('correction') && !state.userDraggedCorrection && !state.isDraggingCorrection) {
      const corrP = getSectionScrollProgress(dom.correctionSection);
      state.targetCorrSliderPos = 0.16 + corrP * 0.68;
    }

    if (state.visibleSections.has('wraps') && !state.userClickedWrap) {
      const wrapP = getSectionScrollProgress(dom.wrapsSection);
      if (wrapP < 0.34) selectWrap('red');
      else if (wrapP < 0.68) selectWrap('blue');
      else selectWrap('silver');
    }
  }

  function mainLoop(now) {
    // 1. Update virtual smooth scroll position (if wheel/programmatic scroll is active)
    if (smoothScroll.isWheelActive) {
      const diff = smoothScroll.targetY - smoothScroll.currentY;
      if (Math.abs(diff) > 0.4) {
        smoothScroll.currentY += diff * smoothScroll.lerp;
        window.scrollTo(0, smoothScroll.currentY);
        handleScrollMetrics();
      } else {
        smoothScroll.currentY = smoothScroll.targetY;
        window.scrollTo(0, smoothScroll.targetY);
        smoothScroll.isWheelActive = false;
        handleScrollMetrics();
      }
    }

    // 2. Process Section (only when visible)
    if (state.visibleSections.has('process')) {
      if (state.isAutoPlayingProcess) {
        state.targetProcessProgress = Math.min(1.0, state.targetProcessProgress + 0.0042);
        if (state.targetProcessProgress >= 1.0) {
          state.isAutoPlayingProcess = false;
          if (dom.autoplayLabel) dom.autoplayLabel.textContent = 'Our process';
        }
      }
      state.processProgress += (state.targetProcessProgress - state.processProgress) * 0.16;
      renderProcessCanvas(state.processProgress);
      updateProcessUI(state.processProgress);
    }

    // 3. Coating Section (only when visible)
    if (state.visibleSections.has('coating')) {
      renderCoatingCanvas(now);
    }

    // 4. Correction Section (static canvas drawn once + 120fps CSS clip-path slider)
    if (state.visibleSections.has('correction')) {
      renderCorrectionCanvasesOnce();
      state.corrSliderPos += (state.targetCorrSliderPos - state.corrSliderPos) * 0.22;
      updateCorrectionUI(state.corrSliderPos);
    }

    // 5. Wraps Section (only redraws during active laser sweep)
    if (state.visibleSections.has('wraps')) {
      renderWrapsCanvas();
      if (Math.abs(state.wrapTargetPrice - state.wrapDisplayPrice) > 0.5) {
        state.wrapDisplayPrice += (state.wrapTargetPrice - state.wrapDisplayPrice) * 0.18;
        if (dom.wrapPriceValue) {
          dom.wrapPriceValue.textContent = `$${Math.round(state.wrapDisplayPrice).toLocaleString('en-US')}`;
        }
      } else if (state.wrapDisplayPrice !== state.wrapTargetPrice) {
        state.wrapDisplayPrice = state.wrapTargetPrice;
        if (dom.wrapPriceValue) {
          dom.wrapPriceValue.textContent = `$${state.wrapTargetPrice.toLocaleString('en-US')}`;
        }
      }
    }

    // 6. Pricing Section (static canvas drawn once + animated total price)
    if (state.visibleSections.has('pricing')) {
      renderPricingCanvasOnce();
      if (Math.abs(state.targetTotal - state.displayTotal) > 0.5) {
        state.displayTotal += (state.targetTotal - state.displayTotal) * 0.2;
        if (dom.totalAmount) {
          dom.totalAmount.textContent = `$${Math.round(state.displayTotal).toLocaleString('en-US')}`;
        }
      } else if (state.displayTotal !== state.targetTotal) {
        state.displayTotal = state.targetTotal;
        if (dom.totalAmount) {
          dom.totalAmount.textContent = `$${state.targetTotal.toLocaleString('en-US')}`;
        }
      }
    }

    requestAnimationFrame(mainLoop);
  }

  // Boot & Start Car Intro Preloader
  preloadAllAssets();
  const boot = () => {
    resizeAllCanvases();
    runCarIntroSequence(false);
    updateNavPill('process');
    requestAnimationFrame(mainLoop);
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
