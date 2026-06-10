// ===========================================================================
//  STRYDE — storefront UI (React) driving the 2D Sneaker Stage
//  Fully responsive — no fixed-canvas scaling, uses fluid CSS layout
// ===========================================================================
const { useState, useEffect, useRef, useCallback } = React;

// ---- Tweakable defaults --------------------------------------------------
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "transition": "momentum",
  "float": true,
  "shoeScale": 70
}/*EDITMODE-END*/;

// Path-based version select: visiting "/img" loads the bg-image product set;
// every other path (incl. "/" / index.html) loads the gradient version.
const useGradient = !(typeof location !== 'undefined' && /\/img\/?$/.test(location.pathname.toLowerCase()));

const PRODUCTS_ORIGINAL = [
  {
    name: 'Court Black',
    sub: 'Clean black-and-white leather. Premium comfort, made for you.',
    price: '59.99', was: '79.99', sizes: [39, 40, 41, 42],
    shoe: 'assets/shoe-black.png', bg: 'assets/bg-night.png', base: '#0c0d10',
    fit: { k: 1.132, tx: -2.27, ty: 3.62 },
  },
  {
    name: 'Army Green',
    sub: 'Tonal olive suede with a clean midsole, quietly bold, all day.',
    price: '64.99', was: '84.99', sizes: [40, 41, 42, 43],
    shoe: 'assets/shoe-olive.png', bg: 'assets/bg-olive.png', base: '#161a0c',
    fit: { k: 1.217, tx: -1.19, ty: 4.44 },
  },
  {
    name: 'Sand Dune',
    sub: 'Warm sand tones, breathable build, made for the long way home.',
    price: '54.99', was: '74.99', sizes: [38, 39, 40, 41],
    shoe: 'assets/shoe-orange.png', bg: 'assets/bg-orange.png', base: '#1a0e07',
    fit: { k: 1, tx: 0, ty: 0 },
  },
];

const PRODUCTS_GRADIENT = [
  {
    name: 'Sand Dune',
    sub: 'Warm sand tones, breathable build, made for the long way home.',
    price: '54.99', was: '74.99', sizes: [38, 39, 40, 41],
    shoe: 'assets/shoe-orange.png', bg: 'assets/bg-orange.png', base: '#2a0901',
    gradient: 'url("assets/orangegrad.png")',
    fit: { k: 0.92, tx: 0, ty: 0 },
  },
  {
    name: 'Army Green',
    sub: 'Tonal olive suede with a clean midsole, quietly bold, all day.',
    price: '64.99', was: '84.99', sizes: [40, 41, 42, 43],
    shoe: 'assets/shoe-golden.png', bg: 'assets/bg-olive.png', base: '#080c04',
    gradient: 'url("assets/goldenbg.png")',
    fit: { k: 1, tx: 0, ty: 0 },
  },
  {
    name: 'Pastel Dream',
    sub: 'Soft pastel hues combined with airy cushioning for light, cloud-like steps.',
    price: '69.99', was: '89.99', sizes: [37, 38, 39, 40],
    shoe: 'assets/shoe-pastel.png', bg: 'assets/bg-orange.png', base: '#2e1e3f',
    gradient: 'url("assets/pastelbg.png")',
    fit: { k: 1, tx: 0, ty: 0 },
  },
];

const PRODUCTS = useGradient ? PRODUCTS_GRADIENT : PRODUCTS_ORIGINAL;

const NAV = ['Products', 'About', 'Category', 'Contact'];

// ---- small inline icons --------------------------------------------------
const Icon = {
  arrow: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  left: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </svg>
  ),
  right: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  chevUp: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 15l6-6 6 6" />
    </svg>
  ),
  chevDown: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  user: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="8" r="3.4" /><path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
    </svg>
  ),
  bag: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 8h12l-1 11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  ),
  heart: (filled) => (p) => (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  ),
  cloud: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.3A3.5 3.5 0 0 1 17 18H7z" />
    </svg>
  ),
  feather: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M19 6a5.5 5.5 0 0 1-1.6 3.9L8 19H5v-3l9.1-9.4A5.5 5.5 0 0 1 19 6z" />
      <path d="M6 18 14 10" />
    </svg>
  ),
  shield: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6l7-3z" />
    </svg>
  ),
  gear: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

const FEATURES = [
  { icon: Icon.cloud,   a: 'Super Soft',  b: 'Cushion' },
  { icon: Icon.feather, a: 'Lightweight', b: 'Feel' },
  { icon: Icon.shield,  a: 'Durable',     b: '& Reliable' },
];

function Logo() {
  return (
    <div className="logo">
      <img src="assets/nikelogo.png" alt="Nike" style={{height:'70px',filter:'brightness(0) invert(1)'}} />
    </div>
  );
}

function App() {
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState('Products');
  const [size, setSize] = useState(PRODUCTS[0].sizes[0]);
  const [qty, setQty] = useState(1);
  const [wish, setWish] = useState(false);
  const [cart, setCart] = useState(2);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const mountRef = useRef(null);

  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // mount the 2D stage once its API is live
  useEffect(() => {
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      window.ShoeStage.mount(mountRef.current, PRODUCTS);
      window.ShoeStage.setType(t.transition);
      window.ShoeStage.setFloat(t.float);
      window.ShoeStage.setScale(t.shoeScale);
      window.ShoeStage.whenReady.then(() => !cancelled && setLoaded(true));
    };
    if (window.ShoeStage) start();
    else window.addEventListener('shoestage-ready-api', start, { once: true });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { if (loaded) window.ShoeStage.setType(t.transition); }, [loaded, t.transition]);
  useEffect(() => { if (loaded) window.ShoeStage.setFloat(t.float); }, [loaded, t.float]);
  useEffect(() => { if (loaded) window.ShoeStage.setScale(t.shoeScale); }, [loaded, t.shoeScale]);

  const product = PRODUCTS[active];

  const swapTo = useCallback((n, dir) => {
    if (busy || !loaded || n === active) return;
    setBusy(true);
    window.ShoeStage.transition(n, dir, {
      onSwap: (idx) => {
        setActive(idx);
        setSize(PRODUCTS[idx].sizes[0]);
        setWish(false);
      },
    }).then(() => setBusy(false));
  }, [active, busy, loaded]);

  const go = useCallback((dir) => {
    const n = Math.max(0, Math.min(PRODUCTS.length - 1, active + dir));
    swapTo(n, dir);
  }, [active, swapTo]);

  const jumpTo = useCallback((n) => swapTo(n, n > active ? 1 : -1), [active, swapTo]);

  // keep listeners pointed at the freshest navigator without re-binding them
  const goRef = useRef(go);
  useEffect(() => { goRef.current = go; }, [go]);

  // ---- SCROLL / SWIPE / KEYS — the primary interaction --------------------
  // Wheel + trackpad, touch swipe, and arrow keys all advance the diagonal
  // stack one colorway at a time. The stage's own `busy` guard keeps a single
  // gesture mapped to a single step; a short cooldown collapses scroll bursts.
  useEffect(() => {
    if (!loaded) return;
    let lock = false;
    let accum = 0;
    let resetTimer = null;
    const fire = (dir) => {
      if (lock) return;
      lock = true;
      goRef.current(dir);
      setTimeout(() => { lock = false; }, 620);
    };
    const onWheel = (e) => {
      if (e.target && e.target.closest && e.target.closest('[data-omelette-chrome]')) return;
      e.preventDefault();
      if (lock) { accum = 0; return; }
      const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      accum += d;
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { accum = 0; }, 160);
      if (Math.abs(accum) > 26) { const dir = accum > 0 ? 1 : -1; accum = 0; fire(dir); }
    };
    const onKey = (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); fire(1); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); fire(-1); }
    };
    let tsX = 0, tsY = 0, tracking = false;
    const onTS = (e) => { const tt = e.touches[0]; tsX = tt.clientX; tsY = tt.clientY; tracking = true; };
    const onTM = (e) => { if (tracking) e.preventDefault(); };
    const onTE = (e) => {
      if (!tracking) return; tracking = false;
      const tt = e.changedTouches[0];
      const dx = tt.clientX - tsX, dy = tt.clientY - tsY;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (Math.max(ax, ay) < 42) return;
      // swipe up / left = next · swipe down / right = previous
      const dir = ay >= ax ? (dy < 0 ? 1 : -1) : (dx < 0 ? 1 : -1);
      fire(dir);
    };
    const stage = mountRef.current ? mountRef.current.parentElement : document.body;
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    stage.addEventListener('touchstart', onTS, { passive: true });
    stage.addEventListener('touchmove', onTM, { passive: false });
    stage.addEventListener('touchend', onTE);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      stage.removeEventListener('touchstart', onTS);
      stage.removeEventListener('touchmove', onTM);
      stage.removeEventListener('touchend', onTE);
      clearTimeout(resetTimer);
    };
  }, [loaded]);

  const buyNow = () => {
    setCart((c) => c + 1);
    setAdding(true);
    setTimeout(() => setAdding(false), 900);
  };

  return (
    <div className="stage" style={{ backgroundColor: product.base }}>
      {/* 2D image stage behind the UI */}
      <div className="canvas-mount" ref={mountRef}>
        {/* Nike logo watermark — inside canvas-mount, above bg (z 0-1) but below shoes (z 6+) */}
        <img src="assets/nikelogo.png" alt="" aria-hidden="true"
             style={{position:'absolute',inset:0,margin:'auto',width:'85%',maxWidth:'800px',
                     opacity:0.08,filter:'brightness(0) invert(1)',
                     pointerEvents:'none',zIndex:3,userSelect:'none'}} />
      </div>

{/* loading veil */}
      <div className={`loader ${loaded ? 'gone' : ''}`}>
        <div className="loader-ring" />
        <div className="loader-text">Preparing your sneaker…</div>
      </div>

      {/* ---------- TOP BAR ---------- */}
      <header className="topbar">
        <Logo />
        <nav className="navpills">
          {NAV.map((n) => (
            <button
              key={n}
              className={`pill ${tab === n ? 'active' : ''}`}
              onClick={() => setTab(n)}
            >{n}</button>
          ))}
        </nav>
        <div className="actions">
          <button className="iconbtn"><Icon.user width="20" height="20" /></button>
          <button className="iconbtn cart">
            <span className="material-icons-outlined" style={{fontSize:'20px', color:'#1c1c1c'}}>shopping_bag</span>
          </button>
        </div>
      </header>

      {/* ---------- LEFT HERO COPY ---------- */}
      <div className="hero">
        <h1 className="headline">Wear your<br/>Style with<br/>Comfort</h1>
        <p key={product.name + 'sub'} className="subcopy fade-key">{product.sub}</p>
      </div>



{/* ---------- BOTTOM BAR ---------- */}
      <div className="bottom-bar">
        {/* SIZE (left) */}
        <div className="sizes">
          <span className="sizes-label">Size</span>
          <div className="size-row">
            {product.sizes.slice(0, 3).map((s) => (
              <button
                key={s}
                className={`size-chip ${size === s ? 'on' : ''}`}
                onClick={() => setSize(s)}
              >{s}</button>
            ))}
          </div>
        </div>

        {/* RIGHT CLUSTER */}
        <div className="right-actions">
          <div className="price" key={product.name + 'price'}>
            <div className="price-now fade-key">${product.price}</div>
            <div className="price-was fade-key">${product.was}</div>
          </div>
          <div className="arrows">
            <button className="arrowbtn" disabled={busy || active === 0} onClick={() => go(-1)}><Icon.left width="20" height="20" /></button>
            <button className="arrowbtn" disabled={busy || active === PRODUCTS.length - 1} onClick={() => go(1)}><Icon.right width="20" height="20" /></button>
          </div>
          <div className="qty-row">
            <button className="arrowbtn" onClick={() => setQty(q => Math.max(1, q - 1))}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="18" height="18"><path d="M5 12h14"/></svg>
            </button>
            <span className="qty-val">{qty}</span>
            <button className="arrowbtn" onClick={() => setQty(q => q + 1)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="18" height="18"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          </div>
          <button className={`buynow ${adding ? 'added' : ''}`} onClick={buyNow}>
            {adding ? 'Done ✓' : 'Buy Now'}
          </button>
        </div>
      </div>



      {/* ---------- TWEAKS ---------- */}
      <TweaksPanel>
        <TweakSection label="Motion" />
        <TweakRadio label="Transition" value={t.transition}
                    options={[
                      { value: 'momentum', label: 'Momentum' },
                      { value: 'depth',    label: 'Depth' },
                      { value: 'orbit',    label: 'Orbit' },
                    ]}
                    onChange={(v) => setTweak('transition', v)} />

        <TweakSection label="Stage" />
        <TweakSlider label="Shoe size" value={t.shoeScale} min={48} max={86} step={1} unit="%"
                     onChange={(v) => setTweak('shoeScale', v)} />
        <TweakToggle label="Idle float" value={t.float}
                     onChange={(v) => setTweak('float', v)} />

        <TweakButton label="Reset all" secondary
                     onClick={() => setTweak({ ...TWEAK_DEFAULTS })} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
