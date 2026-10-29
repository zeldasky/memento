/* 메멘토 — 화면 · 설정 · 위치 · 날씨 불러오기 · 그리기 고리 */
(function () {
  'use strict';
  const M = window.M, U = M.util;
  const $ = (s) => document.querySelector(s);
  const KEY = 'memento.v1', WKEY = 'memento.weather';
  const SEOUL = { lat: 37.5665, lon: 126.978, name: '서울', source: 'default' };
  const SUGGEST = ['날씨', '바다', '우주', '달', '나무', '계절', '모래시계', '커피', '음악'];

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장 못 해도 화면은 돈다 */ } },
  };
  const st = Object.assign({ age: null, ageSetAt: Date.now(), birth: '', lifespan: 85, theme: '날씨', place: null, detail: false,
    keepOn: false, saverMin: 0, bright: 100, saverBright: 25 }, store.get(KEY) || {});
  const save = () => store.set(KEY, st);
  const ready = () => (st.birth || st.age != null) && st.lifespan > 0;

  // 시험용: ?t=초 로 그림 시계를 앞당겨 몇 분 뒤 모습을 바로 본다(주소는 아래에서 지워지므로 먼저 읽는다)
  const T_START = +(new URLSearchParams(location.search).get('t') || 0);
  // 시험용: ?news=surprise|shock|normal 로 뉴스 특이점 그림을 바로 본다
  let newsPreview = new URLSearchParams(location.search).get('news') || 'normal';
  const SAVER_NOW = new URLSearchParams(location.search).get('saver') === '1'; // 시험용: 바로 화면 보호기로

  // 주소로 미리 채우기: ?age=47&life=85&theme=바다&detail=1
  (function fromQuery() {
    const q = new URLSearchParams(location.search);
    if (![...q.keys()].length) return;
    if (q.has('age')) { st.age = +q.get('age'); st.ageSetAt = Date.now(); st.birth = ''; }
    if (q.has('birth')) st.birth = q.get('birth');
    if (q.has('life')) st.lifespan = +q.get('life');
    if (q.has('theme')) st.theme = q.get('theme');
    if (q.has('detail')) st.detail = q.get('detail') === '1';
    save();
    try { history.replaceState(null, '', location.pathname); } catch { /* file:// 에서 막혀도 그만 */ }
  })();

  /* ── 그리기 ─────────────────────────── */
  const cv = $('#scene'), g = cv.getContext('2d');
  const env = { seed: 0, text: '', weather: null, weatherStatus: 'idle', place: null, sig: { level: 0, tone: 0 } };
  const fx = M.signalFx(U.rng(7));
  env.sig = fx.value;
  // 뉴스 신호 켜기: 표본 제목 → 감지 → 효과(진짜 뉴스 출처가 생기면 표본 자리에 받은 제목이 들어간다)
  function applyNews() {
    const sample = M.SAMPLE_NEWS[newsPreview] || M.SAMPLE_NEWS.normal;
    fx.set(M.detectSignal(M.themeIcon(st.theme) ? M.themeIcon(st.theme).label : st.theme || '주제', sample.titles, sample.baseline), t);
  }
  const slow = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.25 : 1;
  let W = 0, H = 0, scene = null, def = null;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (scene) scene.resize(W, H);
  }

  function applyTheme(fade) {
    const text = (st.theme || '').trim() || '날씨';
    const next = M.matchTheme(text);
    const swap = () => {
      def = next; env.text = text; env.seed = U.hash(M.normalize(text));
      scene = def.create(env); scene.resize(W, H);
      startWarp();
      // 위쪽 칩: 아이콘으로 고른 주제면 아이콘 + 이름, 아니면 점 + 낱말
      const ic = M.themeIcon(text), dot = $('#themeChipIcon');
      $('#themeName').textContent = ic ? ic.label : text;
      dot.classList.toggle('has-icon', !!ic);
      dot.innerHTML = ic ? M.iconSvg(ic.svg, 17) : '';
      if (def.needs === 'weather') loadWeather();
      cv.style.opacity = 1;
    };
    if (fade && scene) { cv.style.opacity = 0; setTimeout(swap, 450); } else swap();
  }

  // 보여 줄 진행률 — 평소엔 진짜 값. 화면을 좌우로 끄는 동안은 손가락 자리(타임머신), 놓으면 지금으로 되돌아온다
  let last = performance.now(), t = T_START, shownP = -1, scrub = null;
  const anim = { from: 0, start: -1e9, dur: 2600 };
  const ease = (k) => 1 - (1 - k) ** 3;
  const realP = () => (ready() ? M.progress(st) : 0.5);
  function replay(dur, from = 0) { anim.from = from; anim.start = performance.now(); anim.dur = dur; }
  function viewP(now) {
    if (scrub) return scrub.p;
    const k = (now - anim.start) / anim.dur;
    return k >= 1 ? realP() : U.lerp(anim.from, realP(), ease(Math.max(0, k)));
  }

  // 「와」 넘어가기 — 앱을 열거나 주제를 바꾸면: 화면이 어두워지고, 빛줄기가 점점 빨라지며 쏟아지는 동안
  // 가운데 나이가 0세에서 지금까지 오르고, 하얀 섬광과 함께 지금의 그림이 드러나며 글이 떠오른다.
  // 중간 과정의 그림 · 글은 보여 주지 않는다(전에는 그림 · 비유가 태어남부터 정신없이 바뀌었다)
  const warp = { start: -1e9, dur: 2600, flashed: true, streaks: [] };
  for (let i = 0; i < 170; i++) warp.streaks.push({ a: Math.random() * U.TAU, r: Math.random(), v: 0.5 + Math.random(), w: 0.6 + Math.random() * 1.6, h: 28 + Math.random() * 30 });
  const easeIO = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
  function startWarp(dur = 2600) {
    if (slow < 1) { enter(); return; }            // 움직임 줄이기 설정이면 건너뛴다
    warp.start = performance.now(); warp.dur = dur; warp.flashed = false;
    document.body.classList.add('warping');
  }
  function drawWarp(now) {
    const k = (now - warp.start) / warp.dur;
    if (k < 0 || k >= 1) return;
    const cx = W / 2, cy = H * 0.5, maxR = Math.hypot(W, H) * 0.62;
    // 어둠: 빨리 덮고, 섬광 뒤에 걷힌다
    const dark = k < 0.1 ? k / 0.1 : k < 0.8 ? 1 : Math.max(0, 1 - (k - 0.8) / 0.2);
    g.fillStyle = `rgba(2,3,9,${0.95 * dark})`; g.fillRect(0, 0, W, H);
    // 빛줄기: 가운데서 바깥으로, 점점 빨라지고 길어진다
    if (k > 0.04 && k < 0.84) {
      const u = U.clamp((k - 0.04) / 0.72, 0, 1), speed = u * u, fade = k > 0.74 ? 1 - (k - 0.74) / 0.1 : Math.min(1, u * 4);
      const sec = now / 1000;
      g.lineCap = 'round';
      for (const s of warp.streaks) {
        const r0 = (s.r + sec * s.v * (0.15 + speed * 2.6)) % 1, rr = r0 * r0 * maxR, len = (6 + speed * 170 * s.v) * (0.25 + r0);
        g.strokeStyle = U.hsl(s.h, 90, 80 + 15 * r0, (0.15 + 0.85 * r0) * fade);
        g.lineWidth = s.w * (0.5 + r0);
        g.beginPath(); g.moveTo(cx + Math.cos(s.a) * rr, cy + Math.sin(s.a) * rr);
        g.lineTo(cx + Math.cos(s.a) * (rr + len), cy + Math.sin(s.a) * (rr + len)); g.stroke();
      }
    }
    // 가운데 빛과 나이 숫자
    if (k < 0.8 && ready()) {
      const u = easeIO(U.clamp((k - 0.08) / 0.62, 0, 1)), a = Math.min(1, k / 0.15) * (k > 0.72 ? 1 - (k - 0.72) / 0.08 : 1);
      U.glow(g, cx, cy, 60 + u * 140, `rgba(255,214,150,${0.35 * a})`);
      const age = Math.round(u * M.currentAge(st));
      g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = 'rgba(255,220,160,.9)'; g.shadowBlur = 28;
      g.fillStyle = `rgba(255,248,232,${a})`;
      const fs = Math.min(W * 0.32, 150);
      g.font = `300 ${fs}px "Noto Serif KR", serif`;
      g.fillText(String(age), cx, cy);
      g.shadowBlur = 0; g.font = `400 ${fs * 0.16}px Pretendard, sans-serif`;
      g.fillStyle = `rgba(255,240,215,${0.75 * a})`;
      g.fillText(u < 0.98 ? '태어난 날부터' : '지금, 여기', cx, cy + fs * 0.62);
      g.restore();
    }
    // 섬광
    if (k > 0.72) {
      const f = k < 0.78 ? (k - 0.72) / 0.06 : Math.max(0, 1 - (k - 0.78) / 0.16);
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, maxR);
      gr.addColorStop(0, `rgba(255,252,240,${0.95 * f})`); gr.addColorStop(0.4, `rgba(255,236,200,${0.6 * f})`); gr.addColorStop(1, `rgba(255,236,200,${0.1 * f})`);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      if (!warp.flashed && k >= 0.78) { warp.flashed = true; document.body.classList.remove('warping'); enter(); shownP = -1; }
    }
  }

  // 누르면 퍼지는 물결
  const ripples = [];
  function drawRipples(now) {
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i], k = (now - r.start) / 1400;
      if (k >= 1) { ripples.splice(i, 1); continue; }
      for (let j = 0; j < 3; j++) {
        const kk = k - j * 0.12;
        if (kk <= 0) continue;
        g.strokeStyle = `rgba(255,255,255,${0.5 * (1 - kk) ** 2})`; g.lineWidth = 1.4 - j * 0.3;
        g.beginPath(); g.arc(r.x, r.y, 12 + ease(kk) * 130, 0, U.TAU); g.stroke();
      }
      for (const s of r.sparks) {
        const d = ease(k) * s.v;
        g.fillStyle = `rgba(255,245,220,${0.9 * (1 - k)})`;
        U.dot(g, r.x + Math.cos(s.a) * d, r.y + Math.sin(s.a) * d, 1.6 * (1 - k) + 0.4);
      }
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000) * slow;
    last = now; t += dt;
    const p = viewP(now);
    fx.step(dt);
    if (scene) { g.save(); scene.draw(g, { t, dt, p, now: Date.now() }); g.restore(); }
    fx.draw(g, W, H, t, dt, saverOn); // 화면 보호기에서는 낱말 없이 그림 변화만
    drawRipples(now);
    drawWarp(now);
    if (Math.abs(p - shownP) > 2e-5) { shownP = p; renderWords(p); }
    requestAnimationFrame(frame);
  }

  /* ── 위치 ───────────────────────────── */
  // 앱에서는 Capacitor 위치 플러그인(대략 위치 권한만), 브라우저에서는 navigator.geolocation
  async function devicePosition() {
    const cap = window.Capacitor, G = cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins.Geolocation;
    if (G) {
      const ok = (p) => p.location === 'granted' || p.coarseLocation === 'granted';
      let perm = await G.checkPermissions();
      if (!ok(perm)) perm = await G.requestPermissions({ permissions: ['coarseLocation'] });
      if (!ok(perm)) throw new Error('위치 권한 없음');
      return (await G.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 30 * 60e3 })).coords;
    }
    return new Promise((res, rej) => {
      if (!navigator.geolocation) return rej(new Error('위치 기능 없음'));
      navigator.geolocation.getCurrentPosition((p) => res(p.coords), rej, { timeout: 8000, maximumAge: 30 * 60e3 });
    });
  }
  async function resolvePlace() {
    if (st.place && st.place.source === 'city') return st.place;
    try {
      const c = await devicePosition();
      const pl = { lat: +c.latitude.toFixed(3), lon: +c.longitude.toFixed(3), name: '현재 위치', source: 'geo' };
      st.place = pl; save();
      return pl;
    } catch (e) {
      console.warn(e);
      return st.place || SEOUL;
    }
  }

  /* ── 날씨 (MET Norway — CC BY 4.0 · NLOD, 상업 사용 가능 · 키 없음) ── */
  // MET 약관: 응답을 캐시하고 Expires 전에는 다시 묻지 않는다 · 앱을 안 쓸 때는 받지 않는다
  let weatherBusy = false;
  async function loadWeather() {
    if (weatherBusy) return;
    weatherBusy = true;
    if (!env.weather) env.weatherStatus = 'loading';
    let c = null;
    try {
      const place = await resolvePlace();
      env.place = place;
      c = store.get(WKEY);
      if (c && (c.v !== 2 || Math.abs(c.lat - place.lat) > 0.05 || Math.abs(c.lon - place.lon) > 0.05)) c = null;
      if (c && Date.now() < Math.max(c.expires || 0, c.at + 30 * 60e3)) {
        env.weather = M.metNormalize(c.data); env.weatherStatus = 'ok'; return;
      }
      const r = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${place.lat}&lon=${place.lon}`);
      if (!r.ok) throw new Error(`날씨 ${r.status}`);
      const data = await r.json();
      env.weather = M.metNormalize(data); env.weatherStatus = 'ok';
      const exp = Date.parse(r.headers.get('Expires') || '');
      store.set(WKEY, { v: 2, at: Date.now(), expires: isNaN(exp) ? 0 : exp, lat: place.lat, lon: place.lon, data });
    } catch (e) {
      console.warn(e);
      // 못 받으면 지난 자료라도 보여 준다
      if (c) { env.weather = M.metNormalize(c.data); env.weatherStatus = 'ok'; } else env.weatherStatus = 'error';
    } finally {
      weatherBusy = false;
      capAt = -1e9;
    }
  }

  /* ── 문장 ───────────────────────────── */
  // 세션: 앱을 열 때 · 화면을 껐다 다시 볼 때마다 새 씨앗 → 다른 비유(마라톤 · KTX · 24절기 …), 다른 표현, 다른 그림 시각
  const MKEY = 'memento.metaphors';
  let remainItems = [], remainIdx = 0, sessionSeed = 1, pk = U.picker(1), meta = 0;
  // 최근에 본 비유는 피해서 고른다
  function pickMetaphor(rnd) {
    const n = M.METAPHORS.length, seen = store.get(MKEY) || [];
    const fresh = [...Array(n).keys()].filter((i) => !seen.includes(i));
    const pool = fresh.length ? fresh : [...Array(n).keys()];
    const i = pool[Math.floor(rnd() * pool.length)];
    store.set(MKEY, [...seen.filter((x) => x !== i), i].slice(-Math.floor(n * 0.6)));
    return i;
  }
  function enter() { const w = $('#words'); w.classList.remove('enter'); void w.offsetWidth; w.classList.add('enter'); }
  function newSession() {
    sessionSeed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    const rnd = U.rng(sessionSeed);
    pk = U.picker(sessionSeed); remainIdx = 0;
    meta = pickMetaphor(rnd);
    t += 600 + rnd() * 3000;           // 그림 시계를 건너뛰어 열 때마다 다른 무늬 · 하늘 · 바다 상태로
    startWarp(); shownP = -1;
  }
  // 비유 문장 + 아래 인생 줄 — p 가 움직이는 동안(되감기 · 끌기) 매 프레임 따라 바뀐다
  const setText = (sel, v) => { const el = $(sel); if (el.textContent !== v) el.textContent = v; };
  function renderWords(p) {
    if (!ready()) return;
    const age = p * st.lifespan, s = M.sayMetaphor(meta, p, { age, lifespan: st.lifespan }, pk);
    setText('#clockLabel', s.label);
    setText('#clock', s.big);
    $('#clockBox').dataset.len = s.big.length > 9 ? 'long' : s.big.length > 6 ? 'mid' : ''; // 긴 비유는 글씨를 줄여 한 줄에
    setText('#clockSuffix', s.suf || '');
    setText('#fraction', s.note || '');
    $('#lineDone').style.width = `${p * 100}%`;
    $('#lineDot').style.left = `${p * 100}%`;
    setText('#dotLabel', scrub ? `${Math.round(age)}세` : st.detail ? `${M.currentAge(st).toFixed(1)}세` : '지금');
  }
  function updateWords() {
    if (!ready()) return;
    const now = Date.now(), age = M.currentAge(st, now);
    $('#words').hidden = false; $('#lifeline').hidden = false;
    remainItems = M.remainingThings(st.lifespan - age, pk, U.rng(sessionSeed)); // 세션 안에서는 순서가 그대로
    $('#remain').textContent = remainItems[remainIdx % remainItems.length];
    $('#detail').hidden = !st.detail;
    if (st.detail) $('#detail').textContent = M.detailLine(st, now);
    $('#endL').textContent = st.detail ? '0세' : '태어난 날';
    $('#endR').textContent = st.detail ? `${st.lifespan}세` : '마지막 날';
    shownP = -1;
  }
  // 큰 글씨를 누르면 다른 비유로
  function nextMetaphor() {
    meta = pickMetaphor(Math.random);
    replay(1400, Math.max(0, realP() - 0.25)); enter(); shownP = -1;
  }

  /* ── 화면: 켜 두기 · 밝기 · 화면 보호기 ── */
  // 앱에서는 플러그인(켜 두기 · 창 밝기 — 시스템 밝기 설정은 안 건드림), 브라우저에서는 검은 막으로 어둡게
  const plug = (name) => { const c = window.Capacitor; return c && c.isNativePlatform && c.isNativePlatform() ? c.Plugins[name] : null; };
  let saverOn = false, lastTouch = Date.now();
  function applyBrightness() {
    const v = (saverOn ? Math.min(st.bright, st.saverBright) : st.bright) / 100;
    const SB = plug('ScreenBrightness');
    if (SB) { SB.setBrightness({ brightness: st.bright >= 100 && !saverOn ? -1 : v }).catch(() => {}); $('#dim').style.opacity = 0; }
    else $('#dim').style.opacity = String(Math.min(0.92, 1 - v));
  }
  function applyScreen() {
    const KA = plug('KeepAwake');
    if (KA) (st.keepOn ? KA.keepAwake() : KA.allowSleep()).catch(() => {});
    applyBrightness();
  }
  function setSaver(on) {
    if (saverOn === on) return;
    saverOn = on;
    document.body.classList.toggle('saver', on);
    applyBrightness();
  }
  const touched = () => { lastTouch = Date.now(); };
  setInterval(() => {
    if (!saverOn && st.saverMin > 0 && ready() && !dlg.open && Date.now() - lastTouch > st.saverMin * 60e3) setSaver(true);
  }, 2000);

  /* ── 손가락 ─────────────────────────── */
  // 누르기: 물결 · 좌우로 끌기: 그 나이의 나(타임머신), 놓으면 지금으로 돌아온다
  let down = null;
  // 화면 보호기 중에는 첫 손길이 깨우기만 한다(물결 · 끌기 없음)
  addEventListener('pointerdown', (e) => {
    touched();
    if (saverOn) { setSaver(false); e.stopPropagation(); e.preventDefault(); }
  }, true);
  addEventListener('keydown', touched, true);
  cv.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
    try { cv.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!down || !ready()) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!scrub && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) { scrub = { p: viewP(performance.now()) }; document.body.classList.add('scrubbing'); }
    if (scrub) scrub.p = U.clamp((e.clientX - 20) / Math.max(1, W - 40), 0, 1);
  });
  const release = (e) => {
    if (!down) return;
    if (scrub) {
      const from = scrub.p;
      scrub = null; document.body.classList.remove('scrubbing');
      replay(1100, from);
    } else if (e.type === 'pointerup' && performance.now() - down.t < 450) {
      const r = { x: e.clientX, y: e.clientY, start: performance.now(), sparks: [] };
      for (let i = 0; i < 14; i++) r.sparks.push({ a: Math.random() * U.TAU, v: 30 + Math.random() * 70 });
      ripples.push(r);
    }
    down = null;
  };
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', release);
  function nextRemain() {
    if (remainItems.length < 2) return;
    const el = $('#remain');
    el.style.opacity = 0;
    setTimeout(() => { remainIdx = (remainIdx + 1) % remainItems.length; el.textContent = remainItems[remainIdx]; el.style.opacity = 1; }, 350);
  }

  /* ── 설정 ───────────────────────────── */
  const dlg = $('#settings');
  let shownAge = '', pickedCity = null;

  function showError(msg) { $('#formError').textContent = msg; return false; }
  function radio(name, value) { const el = document.querySelector(`input[name="${name}"][value="${value}"]`); if (el) el.checked = true; }
  function radioValue(name) { const el = document.querySelector(`input[name=${name}]:checked`); return el ? el.value : null; }

  // 주제: 글자로(아무 낱말) / 아이콘으로(목록에서 고르기)
  let pickedIcon = M.THEME_ICONS[0];
  const themeMode = () => radioValue('themeMode') || 'text';
  const chosenTheme = () => (themeMode() === 'icon' ? pickedIcon.theme : $('#fTheme').value.trim() || '날씨');
  function buildIconGrid() {
    const box = $('#themeIconBox');
    M.THEME_ICONS.forEach((ic, i) => {
      if (i === 0 || i === 7) {
        const sep = document.createElement('div'); sep.className = 'sep'; sep.textContent = i === 0 ? '그림' : '기하 무늬';
        box.append(sep);
      }
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.id = ic.id;
      b.innerHTML = `${M.iconSvg(ic.svg, 26)}<span></span>`;
      b.lastChild.textContent = ic.label;
      b.onclick = () => { pickedIcon = ic; syncThemeHint(); };
      box.append(b);
    });
  }
  function syncThemeMode() {
    const icon = themeMode() === 'icon';
    $('#themeTextBox').hidden = icon; $('#themeIconBox').hidden = !icon;
    syncThemeHint();
  }
  function syncThemeHint() {
    const text = chosenTheme();
    const d = M.matchTheme(text), ic = M.themeIcon(text);
    const look = ic ? `${ic.label} 그림` : d.id === 'geometry' ? `「${text}」에서 뽑은 ${d.describe(text)}` : `${d.name} 그림`;
    for (const b of $('#themeIconBox').querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.id === pickedIcon.id));
    $('#themeMatch').innerHTML = '';
    const b = document.createElement('b'); b.textContent = look;
    // 받침 있으면 '으로', 없거나 ㄹ 받침이면 '로'
    const jong = (look.charCodeAt(look.length - 1) - 0xac00) % 28;
    $('#themeMatch').append('→ ', b, `${jong > 0 && jong !== 8 ? '으로' : '로'} 보여줘요. ${d.story}`);
    for (const c of $('#themeChips').children) c.classList.toggle('on', c.textContent === text);
    $('#placeBox').hidden = d.needs !== 'weather';
  }
  function syncBirth() {
    const has = !!$('#fBirth').value;
    $('#fAge').disabled = has;
    if (has) {
      const a = M.currentAge({ birth: $('#fBirth').value });
      $('#fAge').value = ''; $('#fAge').placeholder = `생일 기준 ${a.toFixed(1)}세`;
    } else { $('#fAge').placeholder = '예: 47'; }
  }
  // 밝기 막대는 움직이는 대로 숫자를 보여 준다(저장은 '보기'를 눌러야)
  function syncScreenForm() {
    $('#briOut').textContent = `${$('#fBright').value}%`;
    $('#saverBriOut').textContent = `${$('#fSaverBright').value}%`;
    $('#saverSeg').style.opacity = radioValue('keepOn') === 'on' ? 1 : 0.45;
  }
  function syncPlace() { $('#cityBox').hidden = radioValue('placeMode') !== 'city'; }

  function openSettings(focusTheme) {
    shownAge = st.age != null && !st.birth ? String(+M.currentAge(st).toFixed(1)) : '';
    $('#fAge').value = shownAge;
    $('#fLife').value = st.lifespan || '';
    $('#fBirth').value = st.birth || '';
    $('#birthBox').open = !!st.birth;
    const ic = M.themeIcon(st.theme);
    pickedIcon = ic || M.THEME_ICONS[0];
    radio('themeMode', st.themeMode === 'icon' || (st.theme || '').startsWith('@') ? 'icon' : 'text');
    $('#fTheme').value = (st.theme || '').startsWith('@') ? '' : st.theme || '';
    pickedCity = st.place && st.place.source === 'city' ? st.place : null;
    radio('placeMode', pickedCity ? 'city' : 'geo');
    $('#fCity').value = pickedCity ? pickedCity.name : '';
    $('#cityResults').innerHTML = '';
    searchCity();
    radio('detail', st.detail ? 'more' : 'feel');
    radio('newsPreview', newsPreview);
    radio('keepOn', st.keepOn ? 'on' : 'off');
    radio('saver', String(st.saverMin));
    $('#fBright').value = st.bright; $('#fSaverBright').value = st.saverBright;
    syncScreenForm();
    $('#formError').textContent = '';
    $('#cancelBtn').hidden = !ready();
    syncBirth(); syncThemeMode(); syncPlace();
    if (!dlg.open) dlg.showModal();
    if (!ready()) $('#fAge').focus();
    else if (focusTheme && themeMode() === 'text') $('#fTheme').focus();
  }

  function cityButtons(list) {
    const box = $('#cityResults'); box.innerHTML = '';
    if (!list.length) { const s = document.createElement('span'); s.className = 'none'; s.textContent = '찾는 곳이 없어요'; box.append(s); return; }
    for (const c of list) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = c.label || c.name;
      b.classList.toggle('on', !!pickedCity && pickedCity.lat === c.lat && pickedCity.lon === c.lon);
      b.onclick = () => { pickedCity = c; for (const x of box.children) x.classList.remove('on'); b.classList.add('on'); };
      box.append(b);
    }
  }
  // 앱 안 도시 목록에서 고른다(외부 지오코딩 서비스 없음 — 무료판은 상업 사용 금지라서)
  function searchCity() {
    const q = M.normalize($('#fCity').value);
    const list = q ? M.CITIES.filter((c) => c.name.includes(q)) : M.CITIES.slice(0, 12);
    cityButtons(list.slice(0, 12).map((c) => ({ ...c, source: 'city' })));
  }

  function submit(e) {
    e.preventDefault();
    const birth = $('#fBirth').value, ageStr = $('#fAge').value.trim(), life = parseFloat($('#fLife').value);
    let age;
    if (birth) {
      const b = new Date(birth + 'T00:00:00');
      if (isNaN(b) || b > new Date()) return showError('생년월일을 다시 확인해 주세요');
      age = M.currentAge({ birth });
    } else {
      if (ageStr === '') return showError('지금 나이를 넣어 주세요');
      age = parseFloat(ageStr);
      if (!(age >= 0 && age < 150)) return showError('나이를 다시 확인해 주세요');
    }
    if (!(life > 0 && life <= 150)) return showError('얼마나 살 것 같은지 넣어 주세요');
    if (life <= age) return showError('살 것 같은 나이가 지금 나이보다 커야 해요');

    if (birth) st.birth = birth;
    else {
      // 나이를 고치지 않았으면 처음 넣은 때를 그대로 둔다(저장할 때마다 반올림이 쌓이지 않게)
      if (st.birth || ageStr !== shownAge) { st.age = age; st.ageSetAt = Date.now(); }
      st.birth = '';
    }
    st.lifespan = life;
    const oldTheme = st.theme, oldPlace = JSON.stringify(st.place);
    st.theme = chosenTheme();
    st.themeMode = themeMode();
    if (radioValue('placeMode') === 'city') { if (pickedCity) st.place = pickedCity; }
    else if (st.place && st.place.source === 'city') st.place = null;
    st.detail = radioValue('detail') === 'more';
    newsPreview = radioValue('newsPreview') || 'normal';
    st.keepOn = radioValue('keepOn') === 'on';
    st.saverMin = +(radioValue('saver') || 0);
    st.bright = +$('#fBright').value; st.saverBright = +$('#fSaverBright').value;
    applyScreen();
    save();
    applyNews();
    dlg.close();
    if (st.theme !== oldTheme) applyTheme(true);
    else if (def && def.needs === 'weather' && JSON.stringify(st.place) !== oldPlace) { env.weather = null; loadWeather(); }
    updateWords();
    return true;
  }

  /* ── 묶기 ───────────────────────────── */
  for (const s of SUGGEST) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = s;
    b.onclick = () => { $('#fTheme').value = s; syncThemeHint(); };
    $('#themeChips').append(b);
  }
  $('#fTheme').addEventListener('input', syncThemeHint);
  buildIconGrid();
  document.querySelectorAll('input[name=keepOn]').forEach((r) => r.addEventListener('change', syncScreenForm));
  $('#fBright').addEventListener('input', syncScreenForm);
  $('#fSaverBright').addEventListener('input', syncScreenForm);
  document.querySelectorAll('input[name=themeMode]').forEach((r) => r.addEventListener('change', syncThemeMode));
  $('#fBirth').addEventListener('input', syncBirth);
  document.querySelectorAll('input[name=placeMode]').forEach((r) => r.addEventListener('change', syncPlace));
  $('#fCity').addEventListener('input', searchCity);
  $('#fCity').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
  $('#form').addEventListener('submit', submit);
  $('#cancelBtn').addEventListener('click', () => dlg.close());
  dlg.addEventListener('cancel', (e) => { if (!ready()) e.preventDefault(); });
  $('#openSettings').addEventListener('click', () => openSettings(false));
  $('#themeChip').addEventListener('click', () => openSettings(true));
  $('#remain').addEventListener('click', nextRemain);
  $('#clockBox').addEventListener('click', nextMetaphor);
  addEventListener('resize', resize);
  // 화면을 껐다 켜거나(잠금) 다른 앱에 다녀오면 새 세션 — 2초 넘게 가려졌을 때만
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (Date.now() - hiddenAt > 2000) newSession();
    updateWords();
    if (def && def.needs === 'weather') loadWeather();
  });

  resize();
  applyTheme(false);
  newSession();
  applyNews();
  applyScreen();
  if (SAVER_NOW) setTimeout(() => setSaver(true), 1500);
  updateWords();
  if (!ready()) openSettings(false);
  setInterval(updateWords, 30e3);
  setInterval(nextRemain, 9e3);
  setInterval(() => { if (def && def.needs === 'weather' && !document.hidden) loadWeather(); }, 30 * 60e3);
  requestAnimationFrame(frame);
})();
