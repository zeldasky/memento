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
    keepOn: false, saverMin: 0, bright: 100, saverBright: 25, saverOffH: 3, newsOn: true }, store.get(KEY) || {});
  // 주제 3개: [{ v: '삼성전자', icon: false }, …], 메인(그림으로 쓰는 주제)은 main 번째. 예전 저장값(theme 하나)은 한 칸으로 옮긴다
  if (!Array.isArray(st.topics) || !st.topics.length) {
    st.topics = [{ v: st.theme || '날씨', icon: st.themeMode === 'icon' || (st.theme || '').startsWith('@') }];
    st.main = 0;
  }
  // 시스템 화면 보호기(안드로이드 Dream)로 떴는가 — 앱과 저장소가 달라서 앱이 적어 둔 설정을 받아 쓴다
  const DREAM = new URLSearchParams(location.search).get('dream') === '1';
  if (DREAM && window.MementoNative) {
    try { const saved = JSON.parse(window.MementoNative.settings() || '{}'); Object.assign(st, saved); } catch { /* 설정이 없으면 기본값 */ }
    st.guideSeen = true;
  }
  // 저장: 웹 저장소 + (앱에서는) 안드로이드 저장소에도 — 시스템 화면 보호기가 같은 설정으로 그린다
  const save = () => {
    store.set(KEY, st);
    const c = window.Capacitor, B = c && c.isNativePlatform && c.isNativePlatform() && c.Plugins.MementoBridge;
    if (B) B.saveSettings({ json: JSON.stringify(st) }).catch(() => {});
  };
  const ready = () => (st.birth || st.age != null) && st.lifespan > 0;

  // 시험용: ?t=초 로 그림 시계를 앞당겨 몇 분 뒤 모습을 바로 본다(주소는 아래에서 지워지므로 먼저 읽는다)
  const T_START = +(new URLSearchParams(location.search).get('t') || 0);
  // 시험용: ?news=surprise|shock|normal 로 뉴스 특이점 그림을 바로 본다
  let newsPreview = new URLSearchParams(location.search).get('news') || 'normal';
  const SAVER_NOW = new URLSearchParams(location.search).get('saver') === '1'; // 시험용: 바로 화면 보호기로
  // 시험용: ?scene=rocket 으로 장면을 고르고, ?et=12 로 장면 12초째부터
  const FORCE_SCENE = new URLSearchParams(location.search).get('scene'), EVENT_AT = +(new URLSearchParams(location.search).get('et') || 0);

  // 주소로 미리 채우기: ?age=47&life=85&theme=바다&detail=1
  (function fromQuery() {
    const q = new URLSearchParams(location.search);
    if (![...q.keys()].length) return;
    if (q.has('age')) { st.age = +q.get('age'); st.ageSetAt = Date.now(); st.birth = ''; }
    if (q.has('birth')) st.birth = q.get('birth');
    if (q.has('life')) st.lifespan = +q.get('life');
    if (q.has('theme')) { st.theme = q.get('theme'); st.topics = [{ v: st.theme, icon: st.theme.startsWith('@') }]; st.main = 0; }
    if (q.has('topics')) { // 시험용: ?topics=삼성전자,@rose,비트코인&main=1
      st.topics = q.get('topics').split(',').slice(0, 3).map((v) => ({ v, icon: v.startsWith('@') }));
      st.main = Math.min(st.topics.length - 1, +(q.get('main') || 0)); st.theme = st.topics[st.main].v;
    }
    if (q.has('detail')) st.detail = q.get('detail') === '1';
    st.guideSeen = q.get('guide') !== '1'; // 시험용 주소로 열면 가이드를 건너뛴다(?guide=1 이면 보여 줌)
    save();
    try { history.replaceState(null, '', location.pathname); } catch { /* file:// 에서 막혀도 그만 */ }
  })();

  /* ── 그리기 ─────────────────────────── */
  const cv = $('#scene'), g = cv.getContext('2d');
  const env = { seed: 0, text: '', weather: null, weatherStatus: 'idle', place: null };
  // 뉴스 이벤트: 표본 제목 → 감지 → 30초 장면(진짜 뉴스 출처가 생기면 표본 자리에 받은 제목이 들어간다)
  const ev = M.eventPlayer((Date.now() & 0xffff) + 7);
  let eventOn = false;
  function startEvent(sig) {
    const kind = Math.abs(sig.tone) < 0.2 ? 'notice' : sig.tone > 0 ? 'up' : 'down';
    ev.play(kind, sig.level, t - EVENT_AT, FORCE_SCENE);
    eventOn = true;
    document.body.classList.add('eventing');
    applyBrightness();                                   // 장면 동안은 화면을 밝게
  }
  function endEvent() {
    eventOn = false;
    document.body.classList.remove('eventing');
    applyBrightness();
    enter(); shownP = -1;                                // 원래 화면 · 문장으로 돌아온다
  }
  function applyNews() {
    const sample = M.SAMPLE_NEWS[newsPreview] || M.SAMPLE_NEWS.normal;
    // 뉴스는 글자로 넣은 주제만 살핀다(아이콘 주제 · 기하 무늬 값은 뉴스 낱말이 아니다). 미리보기는 그 첫 주제 이름으로
    const newsTopics = st.topics.filter((x) => !x.icon && x.v && !x.v.startsWith('@')).map((x) => x.v);
    const label = newsTopics[0] || (M.themeIcon(st.theme) ? M.themeIcon(st.theme).label : st.theme || '주제');
    const sig = newsPreview === 'normal' ? null : M.detectSignal(label, sample.titles, sample.baseline);
    if (sig) startEvent(sig); else if (eventOn) ev.stop(t);
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

  // 위쪽 칩: 메인 주제(아이콘이면 아이콘 + 이름, 아니면 점 + 낱말) + 나머지 주제 수(+2)
  function applyThemeChip() {
    const text = (st.theme || '').trim() || '날씨', ic = M.themeIcon(text), dot = $('#themeChipIcon');
    $('#themeName').textContent = ic ? ic.label : text;
    dot.classList.toggle('has-icon', !!ic);
    dot.innerHTML = ic ? M.iconSvg(ic.svg, 17) : '';
    const more = st.topics.filter((x) => x.v).length - 1;
    $('#themeMore').hidden = more < 1; $('#themeMore').textContent = `+${more}`;
  }
  function applyTheme(fade) {
    const text = (st.theme || '').trim() || '날씨';
    const next = M.matchTheme(text);
    const swap = () => {
      def = next; env.text = text; env.seed = U.hash(M.normalize(text));
      scene = def.create(env); scene.resize(W, H);
      startWarp();
      applyThemeChip();
      if (def.needs === 'weather') loadWeather();
      cv.style.opacity = 1;
    };
    if (fade && scene) { cv.style.opacity = 0; setTimeout(swap, 450); } else swap();
  }

  // 보여 줄 진행률 — 평소엔 진짜 값. 화면을 좌우로 끄는 동안은 손가락 자리(타임머신), 놓으면 지금으로 되돌아온다
  let last = performance.now(), t = T_START, shownP = -1, scrub = null, sv = 0;
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
    // 화면 보호기 중에는 초당 15번만 그린다(천천히 움직여서 매끄럽고, 전력 · 열이 준다)
    if (saverOn && !eventOn && sv > 0.98 && now - last < 1000 / 15) { requestAnimationFrame(frame); return; }
    const dt = Math.min(0.1, (now - last) / 1000) * slow;
    last = now; t += dt;
    const p = viewP(now);
    // 화면 보호기(번인 막기): 그림을 작게 줄여 둥근 창 안에만, 그 창이 몇 분에 걸쳐 화면 곳곳을 떠돈다. 나머지는 검게(OLED 픽셀 끔)
    sv += ((saverOn && !eventOn ? 1 : 0) - sv) * Math.min(1, dt * 1.2);
    if (scene) {
      g.save();
      if (sv > 0.01) {
        const s = U.lerp(1, 0.42, sv), ox = Math.sin(t / 97) * W * 0.26 * sv, oy = Math.sin(t / 131 + 1.3) * H * 0.3 * sv;
        g.translate(W / 2 + ox, H * 0.6 + oy); g.scale(s, s); g.translate(-W / 2, -H * 0.6);
      }
      scene.draw(g, { t, dt, p, now: Date.now() });
      g.restore();
      if (sv > 0.01) {
        const cx = W / 2 + Math.sin(t / 97) * W * 0.26 * sv, cy = H * 0.6 + Math.sin(t / 131 + 1.3) * H * 0.3 * sv;
        const r = Math.min(W, H) * U.lerp(1.2, 0.3, sv), mask = g.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
        mask.addColorStop(0, 'rgba(0,0,0,0)'); mask.addColorStop(1, `rgba(0,0,0,${sv})`);
        g.fillStyle = mask; g.fillRect(0, 0, W, H);
        g.fillStyle = `rgba(0,0,0,${0.3 * sv})`; g.fillRect(0, 0, W, H);
        g.fillStyle = `rgba(0,0,0,${sv})`; // 둥근 창 바깥은 완전히 검게
        g.beginPath(); g.rect(0, 0, W, H); g.arc(cx, cy, r, 0, U.TAU, true); g.fill();
      }
    }
    if (eventOn && !ev.draw(g, W, H, t, dt)) endEvent();
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

  /* ── 뉴스 살펴보기: 화면이 보이는 동안 20분마다 글자 주제의 뉴스를 받아 특이점이면 장면 ── */
  const NKEY = 'memento.news', provider = M.newsProvider();
  let newsBusy = false, newsLast = 0, newsNote = '';
  const textTopics = () => st.topics.filter((x) => !x.icon && x.v && !x.v.startsWith('@')).map((x) => x.v);
  async function pollNews() {
    if (!provider || !st.newsOn || !ready() || newsBusy || document.hidden) return;
    const topics = textTopics();
    if (!topics.length) { newsNote = '글자로 넣은 주제가 없어요 — 주제 칸에 낱말(예: 삼성전자)을 넣으면 살펴봐요'; return; }
    newsBusy = true; newsLast = Date.now();
    const db = store.get(NKEY) || {}, notes = [];
    let fired = null;
    for (const topic of topics) {
      try {
        const items = await provider.fetch(topic);
        const sig = M.newsCheck(topic, items, db);
        const r = db[topic];
        notes.push(`${topic} 최근 3시간 ${r.recent}건(평소 ${r.baseline})${sig ? ` → ${sig.tone > 0.2 ? '좋은 소식' : sig.tone < -0.2 ? '나쁜 소식' : '큰 뉴스'}` : ''}`);
        if (sig && !fired) fired = sig;
      } catch (e) { console.warn(e); notes.push(`${topic} 못 받음`); }
    }
    for (const k of Object.keys(db)) if (!topics.includes(k)) delete db[k]; // 지운 주제의 기록은 버린다
    store.set(NKEY, db);
    const hm = new Date(newsLast).toTimeString().slice(0, 5);
    newsNote = `${hm} 확인 · ${notes.join(' · ')}`;
    if ($('#newsStatus')) $('#newsStatus').textContent = newsNote;
    newsBusy = false;
    if (fired && !eventOn) startEvent(fired);
  }
  if (!DREAM) setTimeout(pollNews, 5000); // 시스템 화면 보호기에서는 뉴스를 받지 않는다(앱 밖이라 — 나중에 서버가 생기면)
  setInterval(() => { if (Date.now() - newsLast > 20 * 60e3) pollNews(); }, 60e3);

  /* ── 화면: 켜 두기 · 밝기 · 화면 보호기 ── */
  // 앱에서는 플러그인(켜 두기 · 창 밝기 — 시스템 밝기 설정은 안 건드림), 브라우저에서는 검은 막으로 어둡게
  const plug = (name) => { const c = window.Capacitor; return c && c.isNativePlatform && c.isNativePlatform() ? c.Plugins[name] : null; };
  let saverOn = false, lastTouch = Date.now(), saverSince = 0, saverDeep = false, saverSlept = false;
  function applyBrightness() {
    const deep = saverOn && Date.now() - saverSince > 30 * 60e3 ? 0.5 : 1;          // 30분 넘으면 절반으로
    const v = eventOn ? 1 : (saverOn ? Math.min(st.bright, st.saverBright) * deep : st.bright) / 100;
    const SB = plug('ScreenBrightness');
    if (SB) { SB.setBrightness({ brightness: st.bright >= 100 && !saverOn && !eventOn ? -1 : v }).catch(() => {}); $('#dim').style.opacity = 0; }
    else $('#dim').style.opacity = DREAM ? '0.3' : String(Math.min(0.92, 1 - v)); // 시스템 화면 보호기는 시스템이 어둡게 해 준다
  }
  function applyScreen() {
    const KA = plug('KeepAwake');
    if (KA) (st.keepOn ? KA.keepAwake() : KA.allowSleep()).catch(() => {});
    applyBrightness();
  }
  function setSaver(on) {
    if (saverOn === on) return;
    saverOn = on; saverSince = Date.now(); saverDeep = false;
    document.body.classList.toggle('saver', on);
    if (!on && saverSlept) { saverSlept = false; applyScreen(); } // 깨면 다시 켜 두기
    applyBrightness();
  }
  const touched = () => { lastTouch = Date.now(); };
  setInterval(() => {
    if (!saverOn && st.saverMin > 0 && ready() && !dlg.open && !$('#guide').open && Date.now() - lastTouch > st.saverMin * 60e3) setSaver(true);
    if (!saverOn) return;
    const on = Date.now() - saverSince;
    if (!saverDeep && on > 30 * 60e3) { saverDeep = true; applyBrightness(); }
    // 아주 오래 두면 "켜 두기"를 풀어 시스템이 화면을 끄게 한다(밤새 켜 두지 않게)
    if (!saverSlept && st.saverOffH > 0 && on > st.saverOffH * 3600e3) {
      saverSlept = true;
      const KA = plug('KeepAwake'); if (KA) KA.allowSleep().catch(() => {});
    }
  }, 2000);

  /* ── 손가락 ─────────────────────────── */
  // 누르기: 물결 · 좌우로 끌기: 그 나이의 나(타임머신), 놓으면 지금으로 돌아온다
  let down = null;
  // 화면 보호기 중에는 첫 손길이 깨우기만 한다(물결 · 끌기 없음)
  addEventListener('pointerdown', (e) => {
    touched();
    // 장면 · 화면 보호기 중 첫 손길은 끝내기 · 깨우기만
    if (eventOn || saverOn) { if (eventOn) ev.stop(t); setSaver(false); e.stopPropagation(); e.preventDefault(); }
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

  // 주제 3칸 — 칸마다 글자로(아무 낱말) 또는 아이콘으로(목록에서 고르기). 동그라미 = 메인(그림으로 쓰는 주제).
  // 칸을 누르면 그 칸을 고치는 중이 되고, 아래 [글자로 | 아이콘으로] · 낱말 칩 · 아이콘 목록이 그 칸에 적용된다
  let slots = [], mainIdx = 0, editIdx = 0, pickedIcon = M.THEME_ICONS[0];
  const themeMode = () => radioValue('themeMode') || 'text';
  const slotTheme = (s) => (s && s.v.trim()) || '';
  const chosenTheme = () => slotTheme(slots[mainIdx]) || slots.map(slotTheme).find(Boolean) || '날씨';
  const X_SVG = '<path d="M6 6l12 12M18 6L6 18"/>';
  function renderTopicRows(focus) {
    const box = $('#topicRows'); box.innerHTML = '';
    slots.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = `topic-row${i === editIdx ? ' editing' : ''}`;
      const pickL = document.createElement('label'); pickL.className = 'main-pick'; pickL.title = '그림으로 쓸 메인 주제';
      pickL.innerHTML = `<input type="radio" name="mainTopic" value="${i}"${i === mainIdx ? ' checked' : ''}><span></span>`;
      pickL.firstChild.onchange = () => { mainIdx = i; syncThemeHint(); };
      row.append(pickL);
      const ic = s.icon ? M.themeIcon(s.v) : null;
      if (ic) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'topic-icon';
        b.innerHTML = `${M.iconSvg(ic.svg, 20)}<span></span>`; b.lastChild.textContent = ic.label;
        b.onclick = () => { editIdx = i; radio('themeMode', 'icon'); pickedIcon = ic; syncThemeMode(); };
        row.append(b);
      } else {
        const inp = document.createElement('input');
        inp.type = 'text'; inp.className = 'topic-text'; inp.maxLength = 30; inp.autocomplete = 'off';
        inp.value = s.v; inp.placeholder = ['주제 1 — 예: 날씨, 삼성전자', '주제 2 (선택)', '주제 3 (선택)'][i];
        inp.setAttribute('aria-label', `주제 ${i + 1}`);
        inp.onfocus = () => { if (editIdx !== i || themeMode() !== 'text') { editIdx = i; radio('themeMode', 'text'); markEditing(); syncThemeMode(true); } };
        inp.oninput = () => { s.v = inp.value; syncThemeHint(); };
        row.append(inp);
        if (focus && i === editIdx) setTimeout(() => inp.focus(), 0);
      }
      const clr = document.createElement('button'); clr.type = 'button'; clr.className = 'clear'; clr.setAttribute('aria-label', `주제 ${i + 1} 지우기`);
      clr.innerHTML = M.iconSvg(X_SVG, 16); clr.hidden = !s.v;
      clr.onclick = () => { s.v = ''; s.icon = false; editIdx = i; radio('themeMode', 'text'); renderTopicRows(true); syncThemeMode(true); };
      row.append(clr);
      box.append(row);
    });
  }
  const markEditing = () => [...$('#topicRows').children].forEach((r, i) => r.classList.toggle('editing', i === editIdx));
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
      b.onclick = () => { pickedIcon = ic; slots[editIdx] = { v: ic.theme, icon: true }; renderTopicRows(); syncThemeHint(); };
      box.append(b);
    });
  }
  // keep: 칸 내용을 그대로 두고 보기만 바꾼다(입력칸에 막 들어왔을 때)
  function syncThemeMode(keep) {
    const icon = themeMode() === 'icon', s = slots[editIdx];
    if (!keep && s) {
      if (!icon && s.icon) { // 아이콘 → 글자: 기하 무늬 값('@rose')은 글자로 못 쓰니 비우고, 그림 이름(날씨 등)은 그대로
        s.icon = false; s.v = s.v.startsWith('@') ? '' : s.v; renderTopicRows(true);
      }
    }
    $('#themeTextBox').hidden = icon; $('#themeIconBox').hidden = !icon;
    syncThemeHint();
  }
  function syncThemeHint() {
    const text = chosenTheme(), s = slots[editIdx];
    const d = M.matchTheme(text), ic = M.themeIcon(text);
    const look = ic ? `${ic.label} 그림` : d.id === 'geometry' ? `「${text}」에서 뽑은 ${d.describe(text)}` : `${d.name} 그림`;
    const editingIcon = s && s.icon ? s.v : null;
    for (const b of $('#themeIconBox').querySelectorAll('button')) b.setAttribute('aria-checked', String(!!editingIcon && M.themeIcon(editingIcon) && b.dataset.id === M.themeIcon(editingIcon).id));
    $('#themeMatch').innerHTML = '';
    const b = document.createElement('b'); b.textContent = look;
    // 받침 있으면 '으로', 없거나 ㄹ 받침이면 '로'
    const jong = (look.charCodeAt(look.length - 1) - 0xac00) % 28;
    $('#themeMatch').append('메인 → ', b, `${jong > 0 && jong !== 8 ? '으로' : '로'} 보여줘요. ${d.story}`);
    const news = slots.filter((x) => !x.icon && x.v.trim() && !x.v.startsWith('@')).map((x) => x.v.trim());
    if (news.length) $('#themeMatch').append(document.createElement('br'), `뉴스 특이점(시험판)은 ${news.map((n) => `「${n}」`).join(' ')}을 살펴요.`);
    const cur = s && !s.icon ? s.v.trim() : '';
    for (const c of $('#themeChips').children) c.classList.toggle('on', c.textContent === cur);
    for (const r of $('#topicRows').querySelectorAll('.clear')) r.hidden = !slots[+r.getAttribute('aria-label').match(/\d/)[0] - 1].v;
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
    for (const id of ['#saverSeg', '#saverOffSeg']) $(id).style.opacity = radioValue('keepOn') === 'on' ? 1 : 0.45;
  }
  function syncPlace() { $('#cityBox').hidden = radioValue('placeMode') !== 'city'; }

  function openSettings(focusTheme) {
    shownAge = st.age != null && !st.birth ? String(+M.currentAge(st).toFixed(1)) : '';
    $('#fAge').value = shownAge;
    $('#fLife').value = st.lifespan || '';
    $('#fBirth').value = st.birth || '';
    $('#birthBox').open = !!st.birth;
    slots = [0, 1, 2].map((i) => ({ v: (st.topics[i] && st.topics[i].v) || '', icon: !!(st.topics[i] && st.topics[i].icon && M.themeIcon(st.topics[i].v)) }));
    mainIdx = Math.min(st.main || 0, 2); editIdx = mainIdx;
    pickedIcon = M.themeIcon(slots[editIdx].v) || M.THEME_ICONS[0];
    radio('themeMode', slots[editIdx].icon ? 'icon' : 'text');
    renderTopicRows();
    pickedCity = st.place && st.place.source === 'city' ? st.place : null;
    radio('placeMode', pickedCity ? 'city' : 'geo');
    $('#fCity').value = pickedCity ? pickedCity.name : '';
    $('#cityResults').innerHTML = '';
    searchCity();
    radio('detail', st.detail ? 'more' : 'feel');
    radio('newsPreview', newsPreview);
    radio('newsOn', st.newsOn ? 'on' : 'off');
    $('#newsSource').textContent = provider ? `· ${provider.name}` : '';
    $('#newsStatus').textContent = provider ? newsNote || '아직 확인 전이에요 (화면이 켜져 있는 동안 20분마다)' : '';
    for (const el of $('#newsBox').querySelectorAll('.seg:first-of-type, #newsStatus')) el.hidden = !provider;
    $('#newsBox').hidden = !provider && !M.SAMPLE_NEWS;
    radio('keepOn', st.keepOn ? 'on' : 'off');
    radio('saver', String(st.saverMin));
    radio('saverOff', String(st.saverOffH));
    $('#fBright').value = st.bright; $('#fSaverBright').value = st.saverBright;
    syncScreenForm();
    $('#formError').textContent = '';
    $('#cancelBtn').hidden = !ready();
    syncBirth(); syncThemeMode(); syncPlace();
    if (!dlg.open) dlg.showModal();
    if (!ready()) $('#fAge').focus();
    else if (focusTheme && themeMode() === 'text') { const inp = $('#topicRows').children[editIdx].querySelector('.topic-text'); if (inp) inp.focus(); }
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
    // 빈 칸은 빼고 저장. 메인 칸이 비었으면 첫 주제가 메인
    const filled = slots.map((s, i) => ({ s, i })).filter((x) => x.s.v.trim());
    if (!filled.length) return showError('주제를 하나 이상 넣어 주세요');
    st.topics = filled.map((x) => ({ v: x.s.v.trim(), icon: x.s.icon }));
    st.main = Math.max(0, filled.findIndex((x) => x.i === mainIdx));
    st.theme = st.topics[st.main].v;
    st.themeMode = st.topics[st.main].icon ? 'icon' : 'text';
    if (radioValue('placeMode') === 'city') { if (pickedCity) st.place = pickedCity; }
    else if (st.place && st.place.source === 'city') st.place = null;
    st.detail = radioValue('detail') === 'more';
    newsPreview = radioValue('newsPreview') || 'normal';
    const topicsChanged = JSON.stringify(textTopics());
    st.newsOn = radioValue('newsOn') !== 'off';
    st.keepOn = radioValue('keepOn') === 'on';
    st.saverMin = +(radioValue('saver') || 0);
    st.saverOffH = +(radioValue('saverOff') ?? 3);
    st.bright = +$('#fBright').value; st.saverBright = +$('#fSaverBright').value;
    applyScreen();
    save();
    applyNews();
    dlg.close();
    if (st.theme !== oldTheme) applyTheme(true);
    else {
      applyThemeChip();
      if (def && def.needs === 'weather' && JSON.stringify(st.place) !== oldPlace) { env.weather = null; loadWeather(); }
    }
    if (JSON.stringify(textTopics()) !== topicsChanged || st.newsOn) setTimeout(pollNews, 1500); // 주제가 바뀌면 바로 한 번
    updateWords();
    return true;
  }

  /* ── 묶기 ───────────────────────────── */
  for (const s of SUGGEST) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = s;
    b.onclick = () => { slots[editIdx] = { v: s, icon: false }; renderTopicRows(); syncThemeHint(); };
    $('#themeChips').append(b);
  }
  buildIconGrid();
  document.querySelectorAll('input[name=keepOn]').forEach((r) => r.addEventListener('change', syncScreenForm));
  $('#fBright').addEventListener('input', syncScreenForm);
  $('#fSaverBright').addEventListener('input', syncScreenForm);
  document.querySelectorAll('input[name=themeMode]').forEach((r) => r.addEventListener('change', () => syncThemeMode(false)));
  $('#fBirth').addEventListener('input', syncBirth);
  document.querySelectorAll('input[name=placeMode]').forEach((r) => r.addEventListener('change', syncPlace));
  $('#fCity').addEventListener('input', searchCity);
  $('#fCity').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
  $('#form').addEventListener('submit', submit);
  $('#cancelBtn').addEventListener('click', () => dlg.close());
  dlg.addEventListener('cancel', (e) => { if (!ready()) e.preventDefault(); });
  $('#openSettings').addEventListener('click', () => openSettings(false));
  $('#openHelp').addEventListener('click', () => M.openGuide());
  $('#helpAgain').addEventListener('click', (e) => { e.preventDefault(); M.openGuide(); });
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
  if (DREAM) { setSaver(true); sv = 1; warp.start = -1e9; document.body.classList.remove('warping'); }
  updateWords();
  // 처음 설치: 가이드 → 「시작하기」 → 설정. 업데이트로 가이드를 처음 보는 사람에게도 한 번
  if (DREAM) { /* 시스템 화면 보호기: 아무것도 묻지 않는다 */ } else if (!st.guideSeen) M.openGuide({ first: true, onDone: () => { st.guideSeen = true; save(); if (!ready()) openSettings(false); } });
  else if (!ready()) openSettings(false);
  setInterval(updateWords, 30e3);
  setInterval(nextRemain, 9e3);
  setInterval(() => { if (def && def.needs === 'weather' && !document.hidden) loadWeather(); }, 30 * 60e3);
  requestAnimationFrame(frame);
})();
