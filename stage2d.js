// ===========================================================================
//  STRYDE — 2D Sneaker Stage · Diagonal Stack Carousel (Gradient Version)
//  ---------------------------------------------------------------------------
//  A premium product showcase. Instead of one cross-fading shoe, the stage now
//  renders the WHOLE colorway ring as a spatial stack along a diagonal axis:
//
//        next  ◹           (top-right · small · soft)
//                 ◆ hero    (center   · large · sharp)
//        ◺ prev            (bottom-left · small · soft)
//
//  Navigating advances the stack one notch along that diagonal so the user
//  feels a continuous motion path  prev → hero → next.  Three runtime-
//  selectable motion engines drive the travel between resting slots:
//      • momentum  — straight-line conveyor with motion blur (default)
//      • depth     — rack-focus: hero recedes in Z, next pushes forward
//      • orbit     — curved arc travel, rotation tracking the tangent
//
//  The resting composition is FIXED (it matches the reference prototype); only
//  the path between states differs per engine.  All travel is transform /
//  opacity / blur only — GPU friendly, no layout thrash.  Exposes window.ShoeStage.
// ===========================================================================
(function () {
  const EASE = {
    out:   'cubic-bezier(0.22, 1, 0.36, 1)',
    in:    'cubic-bezier(0.55, 0, 0.55, 1)',
    inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
    soft:  'cubic-bezier(0.16, 1, 0.3, 1)',
    arc:   'cubic-bezier(0.45, 0, 0.2, 1)',
  };

  // ── Resting slots ────────────────────────────────────────────────────────
  // Fractions are of the stage's width (fx) / height (fy). The two FAR slots
  // live off-screen and are used only as the recycle waypoint for the layer
  // that wraps from one side of the stack to the other.
  const SLOTS = {
    HERO:   { fx: 0.00,  fy: -0.015, s: 1.00, rot: 0,  blur: 0,   op: 1,    z: 30 },
    PREV:   { fx: -0.325, fy: 0.300, s: 0.30, rot: -6, blur: 1.1, op: 0.92, z: 16 },
    NEXT:   { fx: 0.345, fy: -0.255, s: 0.34, rot: 5,  blur: 1.1, op: 0.96, z: 22 },
    FAR_BL: { fx: -0.62, fy: 0.60,   s: 0.14, rot: -10, blur: 6,  op: 0,    z: 6  },
    FAR_TR: { fx: 0.66,  fy: -0.55,  s: 0.16, rot: 10,  blur: 6,  op: 0,    z: 6  },
  };

  const state = {
    mounted: false,
    products: [],
    layers: [],          // one per product: { layer, wrap, tilt, fit, img, shadow, slot }
    current: 0,          // product index occupying HERO
    busy: false,
    type: 'momentum',
    float: true,
    scale: 70,           // HERO wrap width as % of stage
    W: 0, H: 0,          // cached stage size
    container: null,
    bgFront: null, bgBack: null,   // bgBack sits on top at opacity 0, fades in on swap
  };

  let resolveReady;
  const readyPromise = new Promise((r) => (resolveReady = r));

  // ── geometry helpers ──────────────────────────────────────────────────────
  function px(slot) { return { x: slot.fx * state.W, y: slot.fy * state.H }; }

  function tf(slot, override) {
    const p = px(slot);
    const x = override && override.x != null ? override.x : p.x;
    const y = override && override.y != null ? override.y : p.y;
    const s = override && override.s != null ? override.s : slot.s;
    const r = override && override.rot != null ? override.rot : slot.rot;
    return `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${s}) rotate(${r}deg)`;
  }
  function flt(blur) { return blur > 0 ? `blur(${blur}px)` : 'blur(0px)'; }

  // signed LINEAR distance from current → j (no ring wrap, so the stack has
  // real ends: nothing sits in bottom-left at the first item, nothing sits in
  // top-right at the last item)
  function relOf(j, c) {
    return j - c;
  }
  function slotForRel(rel) {
    if (rel === 0) return SLOTS.HERO;
    if (rel === -1) return SLOTS.PREV;
    if (rel === 1) return SLOTS.NEXT;
    return rel < 0 ? SLOTS.FAR_BL : SLOTS.FAR_TR;
  }

  // ── responsive slot tuning ────────────────────────────────────────────────
  // Mutates the PREV/NEXT/FAR slot fractions + scales in place for the current
  // viewport so previews never crowd the CTA / size chips on small screens.
  function applyResponsive() {
    const w = state.W;
    let pvS, pushX, pushY, heroS;
    if (w <= 640) {            // mobile — previews are small accents, hero dominant
      pvS = 0.62; pushX = 1.06; pushY = 1.12; heroS = 0.96;
    } else if (w <= 1024) {    // tablet — tighter, smaller previews
      pvS = 0.82; pushX = 0.96; pushY = 0.98; heroS = 1.0;
    } else {                   // desktop — full diagonal stack
      pvS = 1.0;  pushX = 1.0;  pushY = 1.0;  heroS = 1.0;
    }
    SLOTS.HERO.s   = 1.00 * heroS;
    SLOTS.PREV.s   = 0.30 * pvS;
    SLOTS.NEXT.s   = 0.34 * pvS;
    SLOTS.PREV.fx  = -0.325 * pushX; SLOTS.PREV.fy = 0.300 * pushY;
    SLOTS.NEXT.fx  = 0.345 * pushX;  SLOTS.NEXT.fy = -0.255 * pushY;
  }

  // ── build one product layer ───────────────────────────────────────────────
  function makeLayer(p) {
    const layer = document.createElement('div');
    layer.className = 's2-layer';

    const wrap = document.createElement('div');
    wrap.className = 's2-shoewrap';
    wrap.style.width = state.scale + '%';

    const shadow = document.createElement('div');
    shadow.className = 's2-shadow';

    const tilt = document.createElement('div');
    tilt.className = 's2-tilt';

    const fit = document.createElement('div');
    fit.className = 's2-fit';
    applyFit(fit, p.fit);

    const img = document.createElement('img');
    img.className = 's2-shoe';
    img.src = p.shoe;
    img.alt = '';
    img.draggable = false;

    fit.appendChild(img);
    tilt.appendChild(fit);
    wrap.append(shadow, tilt);
    layer.appendChild(wrap);
    return { layer, wrap, tilt, fit, img, shadow, slot: SLOTS.HERO };
  }

  function applyFit(el, f) {
    const k = (f && f.k) || 1;
    const tx = (f && f.tx) || 0;
    const ty = (f && f.ty) || 0;
    el.style.transform = `translate(${tx}%, ${ty}%) scale(${k})`;
  }

  // place a layer at a resting slot with no animation
  function park(L, slot) {
    L.slot = slot;
    L.layer.style.transform = tf(slot);
    L.layer.style.filter = flt(slot.blur);
    L.layer.style.opacity = slot.op;
    L.layer.style.zIndex = slot.z;
  }

  function layoutAll() {
    state.layers.forEach((L, j) => park(L, slotForRel(relOf(j, state.current))));
  }

  // ── mount ──────────────────────────────────────────────────────────────────
  function mount(container, products) {
    if (state.mounted) return;
    state.mounted = true;
    state.products = products.slice();
    state.container = container;
    container.classList.add('s2-mount');

    // two stacked background layers — bgBack rides on top at opacity 0 and
    // crossfades in on every swap, then the roles swap.
    const bgA = document.createElement('div'); bgA.className = 's2-bg';
    const bgB = document.createElement('div'); bgB.className = 's2-bg';
    setBg(bgA, products[0]); setBg(bgB, products[0]);
    bgA.style.opacity = 1; bgA.style.zIndex = 0;
    bgB.style.opacity = 0; bgB.style.zIndex = 1;
    container.append(bgA, bgB);
    state.bgFront = bgA; state.bgBack = bgB;

    measure();
    applyResponsive();

    // build all product layers
    state.layers = products.map((p) => {
      const L = makeLayer(p);
      container.appendChild(L.layer);
      return L;
    });
    layoutAll();
    bindFloat();
    bindParallax(container);

    // resolve readiness when the hero image is decodable (hard timeout guard)
    const im = state.layers[0].img;
    let settled = false;
    const finish = () => { if (!settled) { settled = true; resolveReady(); } };
    if (im.complete && im.naturalWidth) finish();
    else { im.onload = finish; im.onerror = finish; }
    setTimeout(finish, 1200);

    // preload every colorway so swaps never pop
    products.forEach((p) => { const i = new Image(); i.src = p.shoe; });

    window.addEventListener('resize', onResize);
    window.dispatchEvent(new Event('shoestage-ready-api'));
  }

  function setBg(el, p) {
    // gradients ARE background-images — assign directly (do not also clear it)
    el.style.backgroundImage = p.gradient ? p.gradient : `url("${p.bg}")`;
  }

  function measure() {
    const r = state.container.getBoundingClientRect();
    state.W = r.width; state.H = r.height;
  }

  let resizeRaf = 0;
  function onResize() {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      measure();
      applyResponsive();
      if (!state.busy) layoutAll();
    });
  }

  // ── idle float — only the HERO layer breathes ──────────────────────────────
  function bindFloat() {
    state.layers.forEach((L, j) => {
      const isHero = relOf(j, state.current) === 0;
      L.wrap.style.animationPlayState = (isHero && state.float) ? 'running' : 'paused';
    });
  }

  // ── pointer parallax — only the HERO layer tilts ───────────────────────────
  function bindParallax(container) {
    const onMove = (e) => {
      if (state.busy) return;
      const r = container.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      const t = `rotateY(${x * 9}deg) rotateX(${-y * 6}deg) translateZ(0)`;
      state.layers.forEach((L, j) => {
        L.tilt.style.transform = relOf(j, state.current) === 0 ? t : '';
      });
    };
    const reset = () => state.layers.forEach((L) => { L.tilt.style.transform = ''; });
    container.addEventListener('pointermove', onMove);
    container.addEventListener('pointerleave', reset);
  }

  // ── WAAPI helper ────────────────────────────────────────────────────────────
  function anim(el, frames, dur, ease, delay = 0) {
    return el.animate(frames, { duration: dur, easing: ease, delay, fill: 'both' });
  }

  // ── motion engines ───────────────────────────────────────────────────────
  // Each returns { frames, dur, ease } for ONE layer travelling fromSlot→toSlot.
  // `wrap` flags the recycling layer (crosses the stack via an off-screen FAR
  // waypoint); `dir` is +1 (next) / -1 (prev).
  function engineFrames(typ, fromSlot, toSlot, wrap, dir) {
    const a = px(fromSlot), b = px(toSlot);

    // Wrapping layer: out to its near FAR, teleport (invisible) to the opposite
    // FAR, then in to the target. Identical skeleton for every engine; the
    // engine only flavours blur.
    if (wrap) {
      const outFar = fromSlot === SLOTS.PREV ? SLOTS.FAR_BL : SLOTS.FAR_TR;
      const inFar  = toSlot === SLOTS.NEXT ? SLOTS.FAR_TR : SLOTS.FAR_BL;
      const peak = typ === 'depth' ? 8 : typ === 'orbit' ? 4 : 6;
      return {
        frames: [
          { transform: tf(fromSlot), filter: flt(fromSlot.blur), opacity: fromSlot.op, offset: 0 },
          { transform: tf(outFar),   filter: flt(peak),          opacity: 0, offset: 0.5 },
          { transform: tf(inFar),    filter: flt(peak),          opacity: 0, offset: 0.5 },
          { transform: tf(toSlot),   filter: flt(toSlot.blur),   opacity: toSlot.op, offset: 1 },
        ],
        dur: ENGINE_DUR[typ], ease: EASE.soft,
      };
    }

    if (typ === 'depth') {
      // Rack-focus: dip the scale + heavy defocus mid-travel so the layer reads
      // as moving through Z. Minimal sideways drift, drama in scale/blur.
      const midScale = Math.min(fromSlot.s, toSlot.s) * 0.86;
      const midX = a.x + (b.x - a.x) * 0.5;
      const midY = a.y + (b.y - a.y) * 0.5;
      return {
        frames: [
          { transform: tf(fromSlot), filter: flt(fromSlot.blur), opacity: fromSlot.op, offset: 0 },
          { transform: tf(toSlot, { x: midX, y: midY, s: midScale, rot: (fromSlot.rot + toSlot.rot) / 2 }),
            filter: flt(8), opacity: Math.min(fromSlot.op, toSlot.op) * 0.9, offset: 0.5 },
          { transform: tf(toSlot), filter: flt(toSlot.blur), opacity: toSlot.op, offset: 1 },
        ],
        dur: ENGINE_DUR.depth, ease: EASE.inOut,
      };
    }

    if (typ === 'orbit') {
      // Curved arc: bow the straight path along its perpendicular so layers
      // swing through an orbit; rotation tracks the arc.
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;          // unit perpendicular
      const bow = len * 0.22 * dir;                  // arc depth, signed by travel dir
      const midX = a.x + dx * 0.5 + nx * bow;
      const midY = a.y + dy * 0.5 + ny * bow;
      const midRot = (fromSlot.rot + toSlot.rot) / 2 + dir * 6;
      return {
        frames: [
          { transform: tf(fromSlot), filter: flt(fromSlot.blur), opacity: fromSlot.op, offset: 0 },
          { transform: tf(toSlot, { x: midX, y: midY,
              s: (fromSlot.s + toSlot.s) / 2, rot: midRot }),
            filter: flt(2.5), opacity: (fromSlot.op + toSlot.op) / 2, offset: 0.5 },
          { transform: tf(toSlot), filter: flt(toSlot.blur), opacity: toSlot.op, offset: 1 },
        ],
        dur: ENGINE_DUR.orbit, ease: EASE.arc,
      };
    }

    // momentum (default): straight-line conveyor + a pulse of motion blur that
    // peaks early and sharpens into the resting slot.
    return {
      frames: [
        { transform: tf(fromSlot), filter: flt(fromSlot.blur), opacity: fromSlot.op, offset: 0 },
        { filter: flt(Math.max(fromSlot.blur, toSlot.blur) + 4.5), offset: 0.32 },
        { transform: tf(toSlot), filter: flt(toSlot.blur), opacity: toSlot.op, offset: 1 },
      ],
      dur: ENGINE_DUR.momentum, ease: EASE.out,
    };
  }

  const ENGINE_DUR = { momentum: 820, depth: 900, orbit: 1000 };

  // ── the swap ────────────────────────────────────────────────────────────────
  function transition(toIndex, dir = 1, opts = {}) {
    return new Promise((resolve) => {
      if (state.busy || toIndex === state.current || !state.products[toIndex]) {
        resolve(); return;
      }
      state.busy = true;
      const typ = ENGINE_DUR[state.type] != null ? state.type : 'momentum';

      // pause all idle float so it never fights the slot travel
      state.layers.forEach((L) => { L.wrap.style.animationPlayState = 'paused'; });
      state.layers.forEach((L) => { L.tilt.style.transform = ''; });

      // crossfade background to the incoming hero's bg/gradient
      const back = state.bgBack;
      const front = state.bgFront;
      setBg(back, state.products[toIndex]);
      back.style.opacity = 0;

      // The bg-image version (no per-product gradient) gets a richer push:
      // the incoming photo zooms + slides in from the travel direction while
      // the outgoing one drifts the other way for a parallax depth feel.
      // The gradient version keeps its clean flat crossfade.
      const isImageBg = state.products.every((p) => !p.gradient);
      const bgAnims = [];
      let bgDur;
      if (isImageBg) {
        bgDur = 1000;
        const slide = 9 * dir; // % within the -8% overscan, direction-aware
        bgAnims.push(back.animate(
          [
            { opacity: 0, transform: `scale(1.18) translateX(${slide}%)`, filter: 'blur(6px)' },
            { opacity: 1, transform: 'scale(1) translateX(0)', filter: 'blur(0px)' },
          ],
          { duration: bgDur, easing: EASE.soft, fill: 'forwards' }
        ));
        bgAnims.push(front.animate(
          [
            { transform: 'scale(1) translateX(0)' },
            { transform: `scale(1.07) translateX(${-slide * 0.55}%)` },
          ],
          { duration: bgDur, easing: EASE.soft, fill: 'forwards' }
        ));
      } else {
        bgDur = 720;
        bgAnims.push(back.animate(
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: bgDur, easing: EASE.inOut, fill: 'forwards' }
        ));
      }

      const anims = bgAnims.slice();
      let maxDur = bgDur;

      state.layers.forEach((L, j) => {
        const fromSlot = L.slot;
        const toSlot = slotForRel(relOf(j, toIndex));
        if (fromSlot === toSlot) return;

        const fromRel = relOf(j, state.current);
        const toRel = relOf(j, toIndex);
        const isWrap = fromRel * toRel < 0 && Math.abs(fromRel) === 1 && Math.abs(toRel) === 1;

        const { frames, dur, ease } = engineFrames(typ, fromSlot, toSlot, isWrap, dir);
        L.layer.style.zIndex = toSlot.z;     // claim destination depth immediately
        L.layer.style.willChange = 'transform, opacity, filter';
        anims.push(anim(L.layer, frames, dur, ease));
        L.slot = toSlot;
        maxDur = Math.max(maxDur, dur);
      });

      // notify React mid-travel so price / sizes / dots update as the new hero
      // lands in focus
      const swapTimer = setTimeout(() => opts.onSwap && opts.onSwap(toIndex), Math.round(maxDur * 0.46));

      let done = false;
      const commit = () => {
        if (done) return;
        done = true;
        clearTimeout(swapTimer);
        clearTimeout(safety);
        opts.onSwap && opts.onSwap(toIndex);
        anims.forEach((x) => { try { x.cancel(); } catch (e) {} });

        // settle the crossfade: the faded-in back becomes the new front,
        // the old front becomes the hidden back. Clear any push transform/blur
        // left on either layer so the hidden one resets cleanly for next swap.
        back.style.transform = ''; back.style.filter = '';
        front.style.transform = ''; front.style.filter = '';
        back.style.opacity = 1;
        const oldFront = state.bgFront;
        state.bgFront = back; state.bgBack = oldFront;
        state.bgFront.style.zIndex = 0; state.bgFront.style.opacity = 1;
        state.bgBack.style.zIndex = 1; state.bgBack.style.opacity = 0;

        state.current = toIndex;
        state.layers.forEach((L) => { L.layer.style.willChange = ''; });
        layoutAll();
        bindFloat();
        state.busy = false;
        resolve();
      };

      const safety = setTimeout(commit, maxDur + 260);
      Promise.all(anims.map((x) => x.finished)).then(commit).catch(commit);
    });
  }

  // ── public API ──────────────────────────────────────────────────────────────
  window.ShoeStage = {
    whenReady: readyPromise,
    mount,
    transition,
    getCurrent: () => state.current,
    setType: (t) => { if (ENGINE_DUR[t] != null) state.type = t; },
    setFloat: (on) => { state.float = !!on; if (!state.busy) bindFloat(); },
    setScale: (pct) => {
      state.scale = pct;
      state.layers.forEach((L) => { L.wrap.style.width = pct + '%'; });
    },
  };
})();
