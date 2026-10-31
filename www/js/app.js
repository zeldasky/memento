/* 메멘토 — 화면 · 설정 · 위치 · 날씨 불러오기 · 그리기 고리 */
(function () {
  'use strict';
  const M = window.M, U = M.util;
  const $ = (s) => document.querySelector(s);
  const KEY = 'memento.v1', WKEY = 'memento.weather';
  const SEOUL = { lat: 37.5665, lon: 126.978, name: '서울', source: 'default' };
  const INT_SUGGEST = ['삼성전자', '비트코인', '엔비디아', '코스피', '금리', '부동산'];

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장 못 해도 화면은 돈다 */ } },
  };
  const st = Object.assign({ age: null, ageSetAt: Date.now(), birth: '', lifespan: 85, theme: '날씨', place: null, detail: false,
    keepOn: false, saverMin: 0, bright: 100, saverBright: 25, saverOffH: 3, saverStyle: 'mix', newsOn: true, savedDays: 1 }, store.get(KEY) || {});
  // 시스템 화면 보호기(안드로이드 Dream)로 떴는가 — 앱과 저장소가 달라서 앱이 적어 둔 설정을 받아 쓴다
  const DREAM = new URLSearchParams(location.search).get('dream') === '1';
  if (DREAM && window.MementoNative) {
    try { const saved = JSON.parse(window.MementoNative.settings() || '{}'); Object.assign(st, saved); } catch { /* 설정이 없으면 기본값 */ }
    st.guideSeen = true;
  }
  // 배경 하나(theme — 아이콘 목록의 값) + 관심 주제 둘(interests). 예전 저장값(주제 3칸 topics/main)에서 옮긴다
  const bgOf = (v) => { if (M.themeIcon(v)) return v; const d = M.matchTheme(v), ic = M.THEME_ICONS.find((i) => i.theme === d.name); return ic ? ic.theme : '@mix'; };
  const migrated = !Array.isArray(st.interests) || Array.isArray(st.topics);
  if (!Array.isArray(st.interests)) {
    const old = Array.isArray(st.topics) ? st.topics : [];
    st.interests = old.filter((x) => !x.icon && x.v && !x.v.startsWith('@') && !M.themeIcon(x.v)).map((x) => x.v).slice(0, 2);
    if (!M.themeIcon(st.theme)) { const ic = old.map((x) => M.themeIcon(x.v)).find(Boolean); st.theme = ic ? ic.theme : bgOf(st.theme || '날씨'); }
  }
  st.theme = bgOf(st.theme || '날씨');
  delete st.topics; delete st.main; delete st.themeMode;
  // 저장: 웹 저장소 + (앱에서는) 안드로이드 저장소에도 — 시스템 화면 보호기가 같은 설정으로 그린다
  const save = () => {
    store.set(KEY, st);
    const c = window.Capacitor, B = c && c.isNativePlatform && c.isNativePlatform() && c.Plugins.MementoBridge;
    if (B) B.saveSettings({ json: JSON.stringify(st) }).catch(() => {});
  };
  if (migrated && !DREAM) save(); // 옮긴 값은 바로 저장(시스템 화면 보호기도 새 값으로)
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
    // ?theme=우주 (배경) — 배경 목록에 없는 낱말(예: 삼성전자)이면 배경은 여러 무늬, 그 낱말은 관심 주제로
    if (q.has('theme')) { const v = q.get('theme'); st.theme = bgOf(v); if (!M.themeIcon(v) && st.theme === '@mix') st.interests = [v]; }
    if (q.has('interests')) st.interests = q.get('interests').split(',').filter(Boolean).slice(0, 2); // ?interests=삼성전자,비트코인
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
  const saverPic = M.saverPlayer((Date.now() & 0xffff) + 3);
  let eventOn = false;
  // 대화 중에 큰 뉴스가 오면 대화를 닫은 뒤에 보여 준다
  let heldEvent = null;
  M.onAiChatClose = () => { touched(); if (heldEvent) { const s = heldEvent; heldEvent = null; startEvent(s); } };
  function startEvent(sig) {
    if (M.aiChatOpen()) { heldEvent = sig; return; }
    const kind = Math.abs(sig.tone) < 0.2 ? 'notice' : sig.tone > 0 ? 'up' : 'down';
    ev.play(kind, sig.level, t - EVENT_AT, FORCE_SCENE);
    eventOn = true;
    goPage(0); hideFloats(true);
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
    const label = st.interests[0] || (M.themeIcon(st.theme) ? M.themeIcon(st.theme).label : '주제');
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

  // 위쪽 칩: 배경(아이콘 + 이름) + 관심 주제 수(이름은 화면에 드러내지 않는다)
  function applyThemeChip() {
    const text = (st.theme || '').trim() || '날씨', ic = M.themeIcon(text), dot = $('#themeChipIcon');
    $('#themeName').textContent = ic ? ic.label : text;
    dot.classList.toggle('has-icon', !!ic);
    dot.innerHTML = ic ? M.iconSvg(ic.svg, 17) : '';
    $('#themeMore').hidden = !st.interests.length; $('#themeMore').textContent = `관심 ${st.interests.length}`;
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

  // 「와」 넘어가기 — 앱을 열거나 배경을 바꾸면: 화면이 어두워지고 빛줄기가 쏟아지는 동안 나이가 0세에서 지금까지 오르고,
  // 빛이 잦아들며 살아온 시간을 다른 숫자(며칠째 · 심장 박동 · 먹은 밥 …)로 한 번 더 굴린 뒤, 섬광과 함께 지금의 그림이 드러난다.
  // 누르면 바로 섬광으로 건너뛴다
  const SKEY = 'memento.stats';
  const warp = { start: -1e9, flashAt: 5.75, flashed: true, stat: null, phase: 0, last: 0, streaks: [] };
  for (let i = 0; i < 170; i++) warp.streaks.push({ a: Math.random() * U.TAU, r: Math.random(), v: 0.5 + Math.random(), w: 0.6 + Math.random() * 1.6, h: 28 + Math.random() * 30 });
  const easeIO = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
  const warpSkippable = (now) => { const el = (now - warp.start) / 1000; return !warp.flashed && el >= 0 && el < warp.flashAt - 0.15; };
  // 최근에 본 숫자는 피해서 고른다
  function pickStat() {
    const all = M.lifeStats(M.currentAge(st), st.lifespan, !!st.birth), seen = store.get(SKEY) || [];
    const pool = all.map((_, i) => i).filter((i) => !seen.includes(i)), from = pool.length ? pool : all.map((_, i) => i);
    const i = from[Math.floor(Math.random() * from.length)];
    store.set(SKEY, [...seen.filter((x) => x !== i), i].slice(-Math.floor(all.length * 0.6)));
    return all[i];
  }
  function startWarp() {
    if (slow < 1) { enter(); return; }            // 움직임 줄이기 설정이면 건너뛴다
    warp.start = performance.now(); warp.last = warp.start; warp.flashed = false;
    warp.flashAt = ready() ? 5.75 : 1.9;        // 둘째 숫자가 약 3.7초 보이도록(2.05초부터 섬광까지)
    warp.stat = ready() ? pickStat() : null;
    document.body.classList.add('warping');
  }
  // 긴 글자는 폭에 맞춰 줄여서 쓴다
  function fitText(text, x, y, size, maxW, weight, family) {
    g.font = `${weight} ${size}px ${family}`;
    const w = g.measureText(text).width;
    if (w > maxW) g.font = `${weight} ${size * (maxW / w)}px ${family}`;
    g.fillText(text, x, y);
  }
  function drawWarp(now) {
    const el = (now - warp.start) / 1000, F = warp.flashAt;
    const dtw = Math.min(0.1, (now - warp.last) / 1000); warp.last = now;
    // 프레임이 끊겨 섬광 순간을 건너뛰어도 글은 반드시 띄운다
    if (!warp.flashed && el >= F) { warp.flashed = true; document.body.classList.remove('warping'); enter(); shownP = -1; }
    if (el < 0 || el >= F + 0.8) return;
    const cx = W / 2, cy = H * 0.5, maxR = Math.hypot(W, H) * 0.62, serif = '"Noto Serif KR", serif', sans = 'Pretendard, sans-serif';
    // 어둠: 빨리 덮고, 섬광 뒤에 걷힌다
    const dark = el < 0.26 ? el / 0.26 : el < F + 0.1 ? 1 : Math.max(0, 1 - (el - F - 0.1) / 0.7);
    g.fillStyle = `rgba(2,3,9,${0.95 * dark})`; g.fillRect(0, 0, W, H);
    // 빛줄기: 점점 빨라졌다가, 두 번째 숫자 동안 잦아들고, 섬광 직전에 다시 쏟아진다
    const rise = U.clamp((el - 0.1) / 1.8, 0, 1), calm = warp.stat ? U.clamp((el - 1.9) / 0.5, 0, 1) : 0, burst = warp.stat ? U.clamp((el - F + 0.6) / 0.6, 0, 1) : 0;
    const speed = Math.max(rise * rise * (1 - calm * 0.9), burst);
    warp.phase += dtw * (0.15 + speed * 2.6);
    const fade = Math.min(1, el * 4) * (el > F - 0.05 ? Math.max(0, 1 - (el - F + 0.05) / 0.25) : 1) * (1 - 0.55 * calm * (1 - burst));
    if (fade > 0) {
      g.lineCap = 'round';
      for (const s of warp.streaks) {
        const r0 = (s.r + warp.phase * s.v) % 1, rr = r0 * r0 * maxR, len = (6 + speed * 170 * s.v) * (0.25 + r0);
        g.strokeStyle = U.hsl(s.h, 90, 80 + 15 * r0, (0.15 + 0.85 * r0) * fade);
        g.lineWidth = s.w * (0.5 + r0);
        g.beginPath(); g.moveTo(cx + Math.cos(s.a) * rr, cy + Math.sin(s.a) * rr);
        g.lineTo(cx + Math.cos(s.a) * (rr + len), cy + Math.sin(s.a) * (rr + len)); g.stroke();
      }
    }
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
    // 첫째: 나이 0세 → 지금
    if (ready() && el < 2.25) {
      const u = easeIO(U.clamp((el - 0.2) / 1.5, 0, 1)), a = Math.min(1, el / 0.4) * (el > 1.95 ? Math.max(0, 1 - (el - 1.95) / 0.3) : 1);
      U.glow(g, cx, cy, 60 + u * 140, `rgba(255,214,150,${0.35 * a})`);
      g.shadowColor = 'rgba(255,220,160,.9)'; g.shadowBlur = 28;
      g.fillStyle = `rgba(255,248,232,${a})`;
      const fs = Math.min(W * 0.32, 150);
      g.font = `300 ${fs}px ${serif}`;
      g.fillText(String(Math.round(u * M.currentAge(st))), cx, cy);
      g.shadowBlur = 0; g.font = `400 ${fs * 0.16}px ${sans}`;
      g.fillStyle = `rgba(255,240,215,${0.75 * a})`;
      g.fillText(u < 0.98 ? '태어난 날부터' : '지금, 여기', cx, cy + fs * 0.62);
    }
    // 둘째: 살아온 시간을 다른 숫자로
    if (warp.stat && el > 2.05 && el < F + 0.1) {
      const a = Math.min(1, (el - 2.05) / 0.35) * (el > F - 0.15 ? Math.max(0, 1 - (el - F + 0.15) / 0.25) : 1);
      const u = 1 - (1 - U.clamp((el - 2.15) / 1.05, 0, 1)) ** 3, s = warp.stat, fs = Math.min(W * 0.135, 62);
      U.glow(g, cx, cy, 200, `rgba(255,214,150,${0.2 * a})`);
      g.fillStyle = `rgba(255,240,215,${0.8 * a})`;
      fitText(s.top, cx, cy - fs * 1.15, fs * 0.33, W * 0.86, 400, sans);
      g.shadowColor = 'rgba(255,220,160,.9)'; g.shadowBlur = 22;
      g.fillStyle = `rgba(255,248,232,${a})`;
      fitText(s.fmt(s.value * u), cx, cy, fs, W * 0.9, 300, serif);
      g.shadowBlur = 0; g.fillStyle = `rgba(255,240,215,${0.7 * a * U.clamp((el - 2.9) / 0.3, 0, 1)})`;
      fitText(s.sub, cx, cy + fs * 1.1, fs * 0.3, W * 0.86, 400, sans);
    }
    g.restore();
    // 섬광
    if (el > F - 0.15) {
      const f = el < F ? (el - F + 0.15) / 0.15 : Math.max(0, 1 - (el - F) / 0.65);
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, maxR);
      gr.addColorStop(0, `rgba(255,252,240,${0.95 * f})`); gr.addColorStop(0.4, `rgba(255,236,200,${0.6 * f})`); gr.addColorStop(1, `rgba(255,236,200,${0.1 * f})`);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
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
    // 보호기 그림: 나이를 암시하는 상징(나이테 · 10년 도형 · 별자리 · 달 · 시계)이 검은 화면을 떠돈다. 'theme' 이면 주제 그림을 작은 창으로
    const symbol = (st.saverStyle || 'mix') !== 'theme';
    if (scene && symbol) {
      if (sv < 0.99) { g.save(); scene.draw(g, { t, dt, p, now: Date.now() }); g.restore(); }
      if (sv > 0.01) {
        g.fillStyle = `rgba(0,0,0,${sv})`; g.fillRect(0, 0, W, H);
        g.save(); g.globalAlpha = sv;
        saverPic.draw(g, W, H, t, dt, { p: realP(), age: ready() ? M.currentAge(st) : 40, lifespan: st.lifespan || 85 }, st.saverStyle || 'mix');
        g.restore();
      }
    } else if (scene) {
      g.save();
      if (sv > 0.01) {
        const s = U.lerp(1, 0.42, sv) * (1 + 0.05 * M.breath(t) * sv), ox = Math.sin(t / 97) * W * 0.26 * sv, oy = Math.sin(t / 131 + 1.3) * H * 0.3 * sv;
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
    drawFloats(t, dt, now);
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
  // 한 문장씩 돌려 보여 주기: 비유(머리) → 한마디 → 남은 것 → 농담 한 줄(둘 다 돌 때마다 다른 항목) → (숫자도 보기면) 숫자 줄
  const LINE_HOLD = 5200, LINE_FADE = 900;
  let quips = [], quipIdx = 0;
  let lines = { head: '', note: '' }, lineIdx = 0, lineTimer = null, lineSwap = null, detailText = '', swapping = false;
  function putLine(text, instant) {
    const el = $('#line');
    clearTimeout(lineSwap);
    const set = () => { el.textContent = text; el.dataset.len = text.length > 20 ? 'long' : ''; };
    if (instant) { el.classList.remove('out', 'pre'); el.classList.add('live'); set(); return; }
    el.classList.remove('live');
    el.classList.add('out');                                  // 위로 흐릿하게 사라지고
    swapping = true;
    lineSwap = setTimeout(() => {
      swapping = false;
      set(); el.classList.remove('out'); el.classList.add('pre'); // 아래에서
      void el.offsetWidth; el.classList.remove('pre');          // 스르륵 떠오른다
    }, el.textContent ? LINE_FADE : 0);
  }
  function lineSeq() {
    const seq = [() => lines.head, () => lines.note, () => { const r = remainItems[remainIdx % Math.max(1, remainItems.length)] || ''; remainIdx++; return r; },
      () => { const q = quips[quipIdx % Math.max(1, quips.length)] || ''; quipIdx++; return q; }];
    if (st.detail && detailText) seq.push(() => detailText);
    return seq;
  }
  function nextLine() {
    if (!ready() || scrub) return;
    const seq = lineSeq();
    lineIdx = (lineIdx + 1) % seq.length;
    const txt = seq[lineIdx]();
    if (txt) putLine(txt);
  }
  // 처음부터(비유 문장부터) 다시 — 열 때 · 비유를 바꿀 때
  function enter() {
    clearInterval(lineTimer);
    renderWords(viewP(performance.now()));                  // 지금 비유로 문장을 먼저 만든다
    lineIdx = 0; putLine(lines.head);
    lineTimer = setInterval(nextLine, LINE_HOLD + LINE_FADE);
  }
  function newSession() {
    sessionSeed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    const rnd = U.rng(sessionSeed);
    pk = U.picker(sessionSeed); remainIdx = 0;
    quips = M.quipsFor(ready() ? M.currentAge(st) : 40, U.rng(sessionSeed ^ 0x5bd1e995)); quipIdx = 0;
    meta = pickMetaphor(rnd);
    t += 600 + rnd() * 3000;           // 그림 시계를 건너뛰어 열 때마다 다른 무늬 · 하늘 · 바다 상태로
    startWarp(); shownP = -1;
  }
  // 비유 문장 + 아래 인생 줄 — p 가 움직이는 동안(되감기 · 끌기) 매 프레임 따라 바뀐다
  const setText = (sel, v) => { const el = $(sel); if (el.textContent !== v) el.textContent = v; };
  function renderWords(p) {
    if (!ready()) return;
    const age = p * st.lifespan, s = M.sayMetaphor(meta, p, { age, lifespan: st.lifespan }, pk);
    lines = { head: `${s.label} ${s.big}${s.suf === '째' ? '째' : s.suf ? ` ${s.suf}` : ''}`, note: s.note || '' };
    if (scrub) putLine(lines.head, true);                    // 끄는 동안은 비유 문장이 손가락을 바로 따라간다
    else if (lineIdx === 0 && !swapping) {                   // 비유 문장이 떠 있으면 숫자가 굴러가는 대로(되감기 중) 그 자리에서 바뀐다
      const el = $('#line');
      if (el.textContent && el.textContent !== lines.head) el.textContent = lines.head;
    }
    $('#lineDone').style.width = `${p * 100}%`;
    $('#lineDot').style.left = `${p * 100}%`;
    setText('#dotLabel', scrub ? `${Math.round(age)}세` : st.detail ? `${M.currentAge(st).toFixed(1)}세` : '지금');
  }
  function updateWords() {
    if (!ready()) return;
    const now = Date.now(), age = M.currentAge(st, now);
    $('#words').hidden = false; $('#lifeline').hidden = false;
    remainItems = M.remainingThings(st.lifespan - age, pk, U.rng(sessionSeed)); // 세션 안에서는 순서가 그대로
    detailText = st.detail ? M.detailLine(st, now) : '';
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
  const textTopics = () => st.interests.filter(Boolean);
  async function pollNews() {
    if (!provider || !st.newsOn || !ready() || newsBusy || document.hidden) return;
    const topics = textTopics();
    if (!topics.length) { newsNote = '글자로 넣은 주제가 없어요 — 주제 칸에 낱말(예: 삼성전자)을 넣으면 살펴봐요'; return; }
    newsBusy = true; newsLast = Date.now();
    const db = store.get(NKEY) || {}, notes = [];
    let fired = null;
    for (const [ti, topic] of topics.entries()) {
      const name = `관심 ${ti + 1}`;
      try {
        const items = await provider.fetch(topic);
        const sig = M.newsCheck(topic, items, db);
        const r = db[topic];
        notes.push(`${name} 최근 3시간 ${r.recent}건(평소 ${r.baseline})${sig ? ` → ${sig.tone > 0.2 ? '좋은 소식' : sig.tone < -0.2 ? '나쁜 소식' : '큰 뉴스'}` : ''}`);
        if (sig && !fired) fired = sig;
      } catch (e) { console.warn(e); notes.push(`${name} 못 받음`); }
    }
    for (const k of Object.keys(db)) if (!topics.includes(k)) delete db[k]; // 지운 주제의 기록은 버린다
    store.set(NKEY, db);
    const hm = new Date(newsLast).toTimeString().slice(0, 5);
    newsNote = `${hm} 확인 · ${notes.join(' · ')}`;
    if (floating && !floats.length) spawnFloats();
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
    if (on) { goPage(0); hideFloats(true); }
    document.body.classList.toggle('saver', on);
    if (!on && saverSlept) { saverSlept = false; applyScreen(); } // 깨면 다시 켜 두기
    applyBrightness();
  }
  const touched = () => { lastTouch = Date.now(); };
  setInterval(() => {
    if (!saverOn && st.saverMin > 0 && ready() && !dlg.open && !$('#quick').open && !$('#guide').open && !M.aiChatOpen() && Date.now() - lastTouch > st.saverMin * 60e3) setSaver(true);
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
    if (eventOn || saverOn) { if (eventOn) ev.stop(t); setSaver(false); e.stopPropagation(); e.preventDefault(); return; }
    // 넘어가기 중에 누르면 바로 섬광으로(대화 상자를 누른 것이 아닐 때만)
    const now = performance.now();
    if (warpSkippable(now) && !dlg.open && !$('#quick').open && !$('#guide').open) { warp.start = now - (warp.flashAt - 0.15) * 1000; e.stopPropagation(); e.preventDefault(); }
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
      replay(1100, from); enter();                           // 놓으면 지금으로 돌아오며 첫 문장부터 다시
    } else if (e.type === 'pointerup' && performance.now() - down.t < 450 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 14) {
      const r = { x: e.clientX, y: e.clientY, start: performance.now(), sparks: [] };
      for (let i = 0; i < 14; i++) r.sparks.push({ a: Math.random() * U.TAU, v: 30 + Math.random() * 70 });
      ripples.push(r);
    }
    down = null;
  };
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', release);

  /* ── 설정 ───────────────────────────── */
  const dlg = $('#settings');
  let shownAge = '', pickedCity = null;

  function showError(msg) { $('#formError').textContent = msg; return false; }
  function radio(name, value) { const el = document.querySelector(`input[name="${name}"][value="${value}"]`); if (el) el.checked = true; }
  function radioValue(name) { const el = document.querySelector(`input[name=${name}]:checked`); return el ? el.value : null; }

  // 배경(아이콘 하나) · 관심 주제(글자 둘) — 설정과 빠른 팝업이 같이 쓴다
  let pickedBg = '날씨';
  function buildBgGrid(box, onPick) {
    M.THEME_ICONS.forEach((ic, i) => {
      if (i === 0 || i === 7) {
        const sep = document.createElement('div'); sep.className = 'sep'; sep.textContent = i === 0 ? '그림' : '기하 무늬';
        box.append(sep);
      }
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.theme = ic.theme;
      b.innerHTML = `${M.iconSvg(ic.svg, 26)}<span></span>`;
      b.lastChild.textContent = ic.label;
      b.onclick = () => { pickedBg = ic.theme; onPick(); };
      box.append(b);
    });
  }
  const syncBgGrid = (box) => { for (const b of box.querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.theme === pickedBg)); };
  function syncThemeHint() {
    syncBgGrid($('#bgGrid'));
    const ic = M.themeIcon(pickedBg), d = M.matchTheme(pickedBg);
    $('#themeMatch').textContent = `${ic ? ic.label : d.name} — ${d.story}`;
    $('#placeBox').hidden = d.needs !== 'weather';
  }
  const readInts = (a, b) => [a, b].map((sel) => $(sel).value.trim()).filter(Boolean);
  // 관심 주제 낱말 칩: 누르면 비어 있는 칸에(둘 다 차 있으면 둘째 칸에)
  function buildIntChips(box, a, b) {
    for (const w of INT_SUGGEST) {
      const c = document.createElement('button'); c.type = 'button'; c.textContent = w;
      c.onclick = () => { const el = !$(a).value.trim() ? $(a) : $(b); el.value = w; };
      box.append(c);
    }
  }
  function syncBirth() {
    const has = !!$('#fBirth').value;
    $('#fAge').disabled = has;
    if (has) {
      const a = M.currentAge({ birth: $('#fBirth').value });
      $('#fAge').value = ''; $('#fAge').placeholder = `생일 기준 ${a.toFixed(1)}세`;
    } else { $('#fAge').placeholder = '예: 47'; }
  }
  // 보호기 그림 고르기(칩)
  let pickedSaver = 'mix';
  function syncSaverChips() { for (const b of $('#saverPicChips').children) b.classList.toggle('on', b.dataset.k === pickedSaver); }
  for (const [k, label] of Object.entries(M.SAVER_NAMES)) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.k = k; b.textContent = label;
    b.onclick = () => { pickedSaver = k; syncSaverChips(); };
    $('#saverPicChips').append(b);
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
    pickedBg = st.theme;
    $('#fInt1').value = st.interests[0] || ''; $('#fInt2').value = st.interests[1] || '';
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
    $('#savedBox').hidden = !provider;
    renderAiBox();
    radio('keepOn', st.keepOn ? 'on' : 'off');
    radio('saver', String(st.saverMin));
    radio('saverOff', String(st.saverOffH));
    radio('savedDays', String(st.savedDays));
    pickedSaver = st.saverStyle || 'mix'; syncSaverChips();
    $('#fBright').value = st.bright; $('#fSaverBright').value = st.saverBright;
    syncScreenForm();
    $('#formError').textContent = '';
    $('#cancelBtn').hidden = !ready();
    syncBirth(); syncThemeHint(); syncPlace();
    if (!dlg.open) dlg.showModal();
    if (!ready()) $('#fAge').focus();
    else if (focusTheme) $('#fInt1').focus();
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
    st.theme = pickedBg;
    if (radioValue('placeMode') === 'city') { if (pickedCity) st.place = pickedCity; }
    else if (st.place && st.place.source === 'city') st.place = null;
    st.detail = radioValue('detail') === 'more';
    newsPreview = radioValue('newsPreview') || 'normal';
    const topicsChanged = JSON.stringify(textTopics());
    st.interests = readInts('#fInt1', '#fInt2');
    st.newsOn = radioValue('newsOn') !== 'off';
    st.keepOn = radioValue('keepOn') === 'on';
    st.saverMin = +(radioValue('saver') || 0);
    st.saverOffH = +(radioValue('saverOff') ?? 3);
    st.savedDays = U.clamp(+(radioValue('savedDays') || 1), 1, 7);
    cleanSaved();
    st.saverStyle = pickedSaver;
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
  buildBgGrid($('#bgGrid'), syncThemeHint);
  buildIntChips($('#intChips'), '#fInt1', '#fInt2');
  // 빠른 팝업(위쪽 칩): 배경 · 관심 주제만 바로 바꾼다
  const qdlg = $('#quick');
  buildBgGrid($('#qBgGrid'), () => syncBgGrid($('#qBgGrid')));
  buildIntChips($('#qIntChips'), '#qInt1', '#qInt2');
  // 설정: 폰 안 AI 모델 받기 · 지우기
  async function renderAiBox() {
    const box = $('#aiBox'), note = $('#aiStatus'), btn = $('#aiModelBtn');
    box.hidden = !M.ai.has() || !provider;
    if (box.hidden) return;
    const s = await M.ai.status(), gb = (n) => `${(n / 1e9).toFixed(1)}GB`;
    $('#aiChatBtn').hidden = !s.supported || !s.downloaded;
    if (!s.supported) { note.textContent = `이 폰의 칩(${s.soc || '알 수 없음'})에서는 아직 쓸 수 없어요.`; btn.hidden = true; return; }
    btn.hidden = false; btn.disabled = false;
    if (s.downloaded) {
      note.textContent = `모델 받음 · ${gb(s.size)}. 브리핑의 AI 단추를 누를 때만 잠깐 메모리에 올려요.`;
      btn.textContent = '모델 지우기';
      btn.onclick = async () => { btn.disabled = true; await M.ai.remove(); renderAiBox(); };
    } else {
      note.textContent = `모델은 ${gb(s.size)}이에요. 브리핑에서 AI 단추를 처음 누를 때 받아도 돼요.${s.wifi ? '' : ' 지금은 모바일 데이터예요.'}`;
      btn.textContent = s.downloading ? '받는 중…' : '모델 받기';
      btn.disabled = !!s.downloading;
      btn.onclick = async () => {
        btn.disabled = true;
        try {
          await M.ai.download((e) => { if (e.total) btn.textContent = `받는 중 · ${gb(e.done)} / ${gb(e.total)}`; });
        } catch (e) { note.textContent = '받다가 끊겼어요. 다시 누르면 이어서 받아요.'; }
        renderAiBox();
      };
    }
  }
  function openQuick() {
    if (!ready()) { openSettings(false); return; }
    pickedBg = st.theme; syncBgGrid($('#qBgGrid'));
    $('#qInt1').value = st.interests[0] || ''; $('#qInt2').value = st.interests[1] || '';
    qdlg.showModal();
  }
  $('#quickForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const oldTheme = st.theme, oldInts = JSON.stringify(st.interests);
    st.theme = pickedBg; st.interests = readInts('#qInt1', '#qInt2');
    save(); qdlg.close();
    if (st.theme !== oldTheme) applyTheme(true); else applyThemeChip();
    if (JSON.stringify(st.interests) !== oldInts) setTimeout(pollNews, 1500);
  });
  $('#qClose').addEventListener('click', () => qdlg.close());

  /* ── 떠다니는 쪽지: 위로 스와이프하면 배경에 어울리는 사물이 낱말을 달고 떠오른다 ── */
  // 낱말은 제목에서 뽑은 짧은 말(주제 이름 뺌). 누르면 기사 한 줄이 작게 펼쳐지고, 그 줄을 누르면 저장함으로 날아간다.
  // 저장함에서 누르면 원문으로. 아래로 스와이프하거나 30초 동안 손대지 않으면 사라진다. 뉴스 출처가 없는 빌드(출시판)에는 없다
  const SAVEKEY = 'memento.saved', TAKENKEY = 'memento.taken', FLOAT_MS = 30e3, LINE_MS = 6e3, TIPKEY = 'memento.floatTip';
  const TINTS = ['#f2c879', '#8fd3e8']; // 관심 1 · 관심 2를 색으로만 구분한다
  const OBJ = {
    bottle: '<path d="M10 3h4v3l1.5 3v10a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V9L10 6z"/><path d="M10.5 12.5h3v4h-3z"/>',
    satellite: '<rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9.5 12H3.5M14.5 12h6M3.5 9v6M20.5 9v6M12 9.5V6"/><circle cx="12" cy="5" r="1"/>',
    kite: '<path d="M12 3l6 7-6 9-6-9z"/><path d="M6 10h12M12 3v16"/><path d="M12 19c-1 1 1 2 0 3"/>',
    leaf: '<path d="M5 19C5 10.5 11 5 20 4.5 19.5 13.5 14 19 5.5 19"/><path d="M5 19l8.5-8.5"/>',
    star: '<path d="M12 3.5l2.4 5.6 6.1.5-4.6 4 1.4 6-5.3-3.2-5.3 3.2 1.4-6-4.6-4 6.1-.5z"/>',
    glow: '<circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="12" cy="12" r="7" opacity=".4"/>',
  };
  const OBJ_OF = { 바다: 'bottle', 우주: 'satellite', 날씨: 'kite', 나무: 'leaf', 계절: 'leaf', 달: 'star' };
  // 사물마다 흔들리는 모양: [좌우 폭, 위아래 폭, 기울기]
  const SWAY = { bottle: [14, 7, 0.28], satellite: [22, 14, 0.12], kite: [20, 12, 0.3], leaf: [24, 10, 0.5], star: [12, 9, 0.08], glow: [18, 14, 0] };
  let page = 0, saved = store.get(SAVEKEY) || [], swipedAt = 0, floating = false, floats = [], floatUntil = 0, openFloat = null, lastShown = new Set();
  const ago = (ms) => { const m = Math.max(1, Math.round((Date.now() - ms) / 60e3)); return m < 60 ? `${m}분 전` : m < 1440 ? `${Math.round(m / 60)}시간 전` : `${Math.round(m / 1440)}일 전`; };
  const isSaved = (it) => saved.some((x) => x.h === it.h);
  // 한 번 저장한 기사는 쪽지로 다시 뜨지 않는다 — 저장함에서 지워도, 저장함이 넘쳐 밀려나도. 뉴스 기록(7일)이 지나면 잊는다
  let taken = (store.get(TAKENKEY) || saved.map((x) => ({ h: x.h, w: '', topic: x.topic, at: x.at || Date.now() }))).filter((x) => Date.now() - x.at < 8 * 864e5);
  store.set(TAKENKEY, taken);
  // 자동 정리: 핀을 꽂지 않은 기사는 저장한 지 st.savedDays 일이 지나면 지운다
  const DAY_MS = 864e5, savedExpiry = (it) => (it.at || Date.now()) + st.savedDays * DAY_MS;
  function cleanSaved() {
    const left = saved.filter((x) => x.pin || savedExpiry(x) > Date.now());
    if (left.length !== saved.length) { saved = left; store.set(SAVEKEY, saved); }
    $('#savedCount').textContent = saved.length;
    if (page) renderSaved();
  }
  const isTaken = (it, topic) => taken.some((x) => x.topic === topic && M.newsSameStory(x.h, it.h, topic));
  const takenWords = (topic) => new Set(taken.filter((x) => x.topic === topic && x.w).map((x) => x.w.toLowerCase()));
  // 제목 속 주제 이름은 가린다
  const mask = (text, topic) => M.maskTopics(text, [topic, ...textTopics()]);
  function goPage(n) {
    page = n ? 1 : 0; document.body.dataset.page = String(page);
    if (!page) M.closeBrief();
    if (page) { cleanSaved(); renderSaved(); }
    else if (floating) floatUntil = performance.now() + FLOAT_MS;
  }
  function showTip(text, ms = 3500) {
    const el = $('#floatTip');
    el.textContent = text; el.hidden = false; el.style.opacity = 1;
    clearTimeout(showTip.t); showTip.t = setTimeout(() => { el.style.opacity = 0; setTimeout(() => { el.hidden = true; }, 600); }, ms);
  }
  function addFloat(word, item, topic, tint, i, n, kind, slot) {
    const wrap = document.createElement('div'); wrap.className = 'float'; wrap.style.setProperty('--tint', tint);
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'float-btn';
    btn.innerHTML = `${M.iconSvg(OBJ[kind], 26)}<span></span>`; btn.lastChild.textContent = word;
    wrap.append(btn); $('#floats').append(wrap);
    // 자리: 위쪽 문장과 아래 인생 줄을 비켜 고르게 흩어 놓는다
    const f = {
      el: wrap, btn, word, item, topic, kind,
      x0: slot ? slot.x0 : 0.14 + ((i * 0.618 + 0.2) % 1) * 0.72, y0: slot ? slot.y0 : 0.24 + ((i + 0.5) / n) * 0.52 + (Math.random() - 0.5) * 0.03,
      ph: Math.random() * U.TAU, born: performance.now() + (slot ? 0 : i * 220), gone: 0, y: 0,
    };
    btn.onclick = () => { if (performance.now() - swipedAt > 350) toggleLine(f); };
    floats.push(f);
    return f;
  }
  // 지금 띄울 수 있는 쪽지 후보(저장한 것 · 겹치는 것 빼고), 앞일수록 많이 나온 낱말
  function floatPool() {
    const db = store.get(NKEY) || {}, seen = new Set(), pool = [];
    textTopics().forEach((topic, ti) => {
      const list = M.newsLatest(db[topic], 100).filter((it) => !isTaken(it, topic));
      M.newsKeywords(list, topic, 24, takenWords(topic)).forEach((k, rank) => {
        if (seen.has(k.item.h) || seen.has(k.word)) return;
        seen.add(k.item.h); seen.add(k.word);
        pool.push({ ...k, topic, tint: TINTS[ti % 2], rank });
      });
    });
    return pool;
  }
  // 떠 있을 때 또 위로 스와이프하면 몇 개만 가라앉고 그 자리에 새 쪽지가 떠오른다
  function refreshFloats() {
    const live = floats.filter((f) => !f.gone && f.item && f !== openFloat);
    const onScreen = new Set(floats.filter((f) => !f.gone).flatMap((f) => [f.word, f.item ? f.item.h : '']));
    const fresh = floatPool().filter((k) => !onScreen.has(k.word) && !onScreen.has(k.item.h)).map((k) => [k.rank / 24 + Math.random() * 0.8, k]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    if (!live.length || !fresh.length) return;
    const n = Math.min(fresh.length, Math.max(2, Math.round(live.length * 0.35)));
    const out = live.map((f) => [Math.random(), f]).sort((a, b) => a[0] - b[0]).slice(0, n).map((x) => x[1]);
    const now = performance.now();
    out.forEach((f, i) => {
      f.gone = now;
      const k = fresh[i], nf = addFloat(k.word, k.item, k.topic, k.tint, i, n, f.kind, f);
      nf.born = now + 450 + i * 180;
    });
    lastShown = new Set(floats.filter((f) => !f.gone && f.item).map((f) => f.item.h));
  }
  function spawnFloats() {
    const topics = textTopics();
    if (!topics.length) {
      const f = addFloat('관심 주제 넣기', null, '', TINTS[0], 2, 5, OBJ_OF[st.theme] || 'glow');
      f.btn.onclick = () => { hideFloats(false); openQuick(); };
      return;
    }
    const pool = floatPool();
    if (!pool.length) { showTip(newsBusy ? '소식을 건지는 중이에요' : '아직 떠다니는 소식이 없어요'); return; }
    // 지난번 쪽지를 절반 남짓 남기고 나머지는 새것으로 — 스와이프할 때마다 조금씩 달라진다
    const total = Math.min(pool.length, 6 + Math.floor(Math.random() * 3));
    const shuffled = (list) => list.map((k) => [k.rank / 24 + Math.random() * 0.8, k]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    const before = shuffled(pool.filter((k) => lastShown.has(k.item.h))), fresh = shuffled(pool.filter((k) => !lastShown.has(k.item.h)));
    const keep = before.slice(0, Math.round(total * 0.55));
    const picks = [...keep, ...fresh.slice(0, total - keep.length)];
    if (picks.length < total) picks.push(...before.slice(keep.length, keep.length + total - picks.length));
    const kind = OBJ_OF[st.theme] || 'glow';
    picks.forEach((k, i) => addFloat(k.word, k.item, k.topic, k.tint, i, picks.length, kind));
    lastShown = new Set(picks.map((k) => k.item.h));
    const seenTip = store.get(TIPKEY) || 0;
    if (seenTip < 3) { store.set(TIPKEY, seenTip + 1); showTip('누르면 한 줄 · 그 줄을 누르면 저장 · 아래로 내리면 사라져요', 5000); }
  }
  function showFloats() {
    if (floating) { floatUntil = performance.now() + FLOAT_MS; refreshFloats(); return; }
    floating = true; floatUntil = performance.now() + FLOAT_MS;
    document.body.classList.add('floating');
    $('#toSaved').hidden = false; $('#savedCount').textContent = saved.length;
    $('#toChat').hidden = !M.ai.has();
    spawnFloats();
    if (Date.now() - newsLast > 5 * 60e3) pollNews();
  }
  function hideFloats(now) {
    if (!floating) return;
    floating = false; closeLine();
    document.body.classList.remove('floating');
    $('#toSaved').hidden = true; $('#toChat').hidden = true;
    const t0 = performance.now();
    for (const f of floats) { f.gone = t0; if (now) f.el.remove(); }
    if (now) floats = [];
  }
  function closeLine() {
    if (!openFloat) return;
    const l = openFloat.el.querySelector('.float-line'); if (l) l.remove();
    openFloat.el.style.zIndex = '';
    clearTimeout(closeLine.t); openFloat = null;
  }
  function toggleLine(f) {
    floatUntil = performance.now() + FLOAT_MS;
    const same = openFloat === f;
    closeLine();
    if (same || !f.item) return;
    const line = document.createElement('div'); line.className = 'float-line';
    const text = document.createElement('button'); text.type = 'button'; text.className = 'fl-text';
    text.textContent = mask(f.item.h, f.topic);
    const small = document.createElement('small'); small.textContent = `${f.item.s ? `${f.item.s} · ` : ''}${ago(f.item.t)} · 누르면 저장`;
    text.append(small);
    text.onclick = () => { if (performance.now() - swipedAt > 350) saveFloat(f, line); };
    const brief = document.createElement('button'); brief.type = 'button'; brief.className = 'fl-brief'; brief.setAttribute('aria-label', '연관 브리핑');
    brief.innerHTML = M.iconSvg(BRIEF_SVG, 18);
    brief.onclick = () => { closeLine(); openBrief(f.item.h, f.topic, f.word); };
    line.append(text, brief);
    f.el.append(line); f.el.style.zIndex = 3; openFloat = f;
    // 화면 밖으로 나가지 않게 옮긴다
    const r = line.getBoundingClientRect(), half = r.width / 2, c = r.left + half;
    const dx = c < half + 10 ? half + 10 - c : c > W - half - 10 ? W - half - 10 - c : 0;
    line.style.setProperty('--shift', `calc(-50% + ${dx}px)`);
    closeLine.t = setTimeout(closeLine, LINE_MS);
  }
  // 그 줄을 누르면: 저장함 아이콘으로 날아가고 쪽지는 사라진다
  function saveFloat(f, line) {
    const it = f.item;
    floatUntil = performance.now() + FLOAT_MS;
    if (!isSaved(it)) {
      saved.unshift({ h: it.h, l: it.l, s: it.s || '', t: it.t, topic: f.topic, at: Date.now() });
      if (saved.length > 200) { const k = saved.map((x) => !!x.pin).lastIndexOf(false); if (k >= 0) saved.splice(k, 1); }
      store.set(SAVEKEY, saved);
      taken.push({ h: it.h, w: f.word, topic: f.topic, at: Date.now() });
      store.set(TAKENKEY, taken);
    }
    // 같은 소식 · 같은 낱말을 단 다른 쪽지도 함께 가라앉는다
    for (const o of floats) if (o !== f && !o.gone && o.item && o.topic === f.topic && (o.word === f.word || M.newsSameStory(o.item.h, it.h, f.topic))) o.gone = performance.now();
    const from = line.getBoundingClientRect(), to = $('#toSaved').getBoundingClientRect();
    const fly = document.createElement('p'); fly.className = 'fly-line'; fly.textContent = mask(it.h, f.topic);
    Object.assign(fly.style, { left: `${from.left + 10}px`, top: `${from.top + 8}px`, width: `${from.width - 20}px` });
    document.body.append(fly);
    const dx = to.left + to.width / 2 - from.left, dy = to.top + to.height / 2 - from.top;
    const done = () => {
      fly.remove();
      $('#savedCount').textContent = saved.length;
      const tab = $('#toSaved'); tab.classList.remove('bump'); void tab.offsetWidth; tab.classList.add('bump');
    };
    if (fly.animate && slow === 1) {
      fly.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(.08)`, opacity: 0.2 }], { duration: 600, easing: 'cubic-bezier(.5, 0, .2, 1)' }).onfinish = done;
    } else done();
    closeLine(); f.gone = performance.now();
  }
  // 매 프레임: 아래에서 떠올라 숨 쉬듯 흔들리고, 사라질 때는 가라앉는다
  function drawFloats(t, dt, now) {
    if (floating && !page && !M.briefOpen() && now > floatUntil) hideFloats(false);
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      if (f.gone && now - f.gone > 900) { f.el.remove(); floats.splice(i, 1); if (openFloat === f) openFloat = null; continue; }
      const up = U.clamp((now - f.born) / 1800, 0, 1), ease1 = 1 - (1 - up) ** 3;
      const out = f.gone ? U.clamp((now - f.gone) / 900, 0, 1) : 0;
      const [sx, sy, tilt] = SWAY[f.kind];
      const held = openFloat === f;                       // 펼쳐 둔 동안은 멈춰 있어 읽기 쉽게
      if (!held) f.ph += dt * 0.25;
      const x = f.x0 * W + Math.sin(f.ph) * sx, yt = f.y0 * H + Math.sin(f.ph * 1.7 + 1) * sy + (M.breath ? (M.breath(t + f.x0 * 5) - 0.5) * 6 : 0);
      const y = U.lerp(H + 40, yt, ease1) + out * 50;
      f.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      f.btn.firstChild.style.transform = `rotate(${(Math.sin(f.ph * 1.3) * tilt).toFixed(3)}rad)`;
      f.el.style.opacity = String((up > 0 ? Math.min(1, up * 2.5) : 0) * (1 - out) * 0.92);
    }
  }
  const BOOK_SVG = '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>';
  const DEL_SVG = '<path d="M6 6l12 12M18 6L6 18"/>';
  const PIN_SVG = '<path d="M9 3h6l-1 6 4 4v2H6v-2l4-4z"/><path d="M12 15v6"/>';
  const BRIEF_SVG = '<circle cx="12" cy="12" r="2.6"/><circle cx="5" cy="5" r="1.7"/><circle cx="19" cy="5" r="1.7"/><circle cx="5" cy="19" r="1.7"/><circle cx="19" cy="19" r="1.7"/><path d="M10.2 10.2L6.3 6.3M13.8 10.2l3.9-3.9M10.2 13.8l-3.9 3.9M13.8 13.8l3.9 3.9"/>';
  const leftText = (it) => { const h = Math.ceil((savedExpiry(it) - Date.now()) / 3600e3); return h <= 24 ? `${h}시간 뒤 정리` : `${Math.ceil(h / 24)}일 뒤 정리`; };
  function openBrief(h, topic, word) {
    M.openBrief({ h, word, db: store.get(NKEY) || {}, interests: textTopics(), mask: (x) => mask(x, topic), openLink, onClose: () => { if (floating) floatUntil = performance.now() + FLOAT_MS; } });
  }
  function renderSaved() {
    const box = $('#savedList'); box.innerHTML = '';
    $('#savedCount2').textContent = saved.length ? `${saved.length}개` : '';
    const canDigest = M.ai.has() && saved.length >= 2;
    $('#savedDigest').hidden = !canDigest; $('#savedGap').hidden = canDigest;
    $('#savedCount').textContent = saved.length;
    if (!saved.length) {
      const li = document.createElement('li'); li.className = 'saved-empty';
      li.textContent = `떠다니는 쪽지를 눌러 기사 한 줄을 펼치고, 그 줄을 누르면 여기로 옮겨져요. ${st.savedDays}일이 지나면 정리되고, 핀을 꽂으면 남아요`;
      box.append(li);
      return;
    }
    [...saved].sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0)).forEach((it) => {
      const li = document.createElement('li'); li.className = `saved-item${it.pin ? ' pinned' : ''}`;
      const open = document.createElement('button'); open.type = 'button'; open.className = 'saved-open';
      open.innerHTML = `<b></b><span>${M.iconSvg(BOOK_SVG, 13)}<em></em><em class="left"></em></span>`;
      open.querySelector('b').textContent = mask(it.h, it.topic);
      open.querySelector('em').textContent = `${it.s ? `${it.s} · ` : ''}${ago(it.t)}`;
      open.querySelector('.left').textContent = it.pin ? '· 핀 꽂음' : `· ${leftText(it)}`;
      open.onclick = () => { if (performance.now() - swipedAt > 350) openLink(it.l); };
      const acts = document.createElement('div'); acts.className = 'saved-acts';
      const act = (cls, label, svg, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.setAttribute('aria-label', label); b.innerHTML = M.iconSvg(svg, 17); b.onclick = fn; acts.append(b); };
      act('act-brief', '연관 브리핑', BRIEF_SVG, () => openBrief(it.h, it.topic));
      act(`act-pin${it.pin ? ' on' : ''}`, it.pin ? '핀 빼기' : '지우지 않게 핀 꽂기', PIN_SVG, () => {
        it.pin = !it.pin;
        if (!it.pin) it.at = Date.now();                // 핀을 뺀 때부터 다시 세어 곧바로 사라지지 않게
        store.set(SAVEKEY, saved); renderSaved();
      });
      act('saved-del', '저장에서 지우기', DEL_SVG, () => { saved = saved.filter((x) => x !== it); store.set(SAVEKEY, saved); renderSaved(); });
      li.append(open, acts); box.append(li);
    });
  }
  // 앱에서는 앱 안 브라우저 창(닫으면 메멘토로 돌아온다), 브라우저에서는 새 탭
  function openLink(url) {
    const B = plug('Browser');
    if (B) B.open({ url }).catch((e) => console.warn(e));
    else window.open(url, '_blank', 'noopener');
  }
  $('#savedBack').addEventListener('click', () => goPage(0));
  $('#toSaved').addEventListener('click', () => goPage(1));
  const openFreeChat = () => M.openFreeChat({ mask: (x) => mask(x), openLink });
  $('#toChat').addEventListener('click', openFreeChat);
  $('#aiChatBtn').addEventListener('click', () => { dlg.close(); openFreeChat(); });
  $('#savedDigest').addEventListener('click', () => M.openDigest({ items: saved, mask, openLink }));
  // 세로 스와이프 — 터치 · 마우스 모두. 메인: 위로 = 쪽지 띄우기, 아래로 = 지우기. 저장함: 아래로 = 닫기(목록 맨 위일 때만)
  let sw = null, lastTouchAt = 0;
  document.addEventListener('visibilitychange', () => { if (!document.hidden) cleanSaved(); });
  const swipeBlocked = () => !provider || !ready() || DREAM || eventOn || saverOn || scrub || warpSkippable(performance.now())
    || dlg.open || qdlg.open || $('#guide').open || M.briefOpen();
  const swStart = (x, y, target) => { sw = swipeBlocked() ? null : { x, y, t: performance.now(), target }; };
  const swEnd = (x, y) => {
    if (!sw) return;
    const dx = x - sw.x, dy = y - sw.y, el = performance.now() - sw.t, target = sw.target;
    sw = null;
    if (scrub || el > 1500 || Math.abs(dy) < 60 || Math.abs(dy) < Math.abs(dx) * 1.5) return;
    swipedAt = performance.now();
    if (page) {
      if (dy > 0 && !($('#savedList').contains(target) && $('#savedList').scrollTop > 0)) goPage(0);
      return;
    }
    if (dy < 0) showFloats(); else hideFloats(false);
  };
  document.addEventListener('touchstart', (e) => { lastTouchAt = performance.now(); if (e.touches.length === 1) swStart(e.touches[0].clientX, e.touches[0].clientY, e.target); else sw = null; }, { passive: true });
  document.addEventListener('touchend', (e) => { lastTouchAt = performance.now(); const c = e.changedTouches[0]; if (c) swEnd(c.clientX, c.clientY); }, { passive: true });
  document.addEventListener('mousedown', (e) => { if (performance.now() - lastTouchAt > 800) swStart(e.clientX, e.clientY, e.target); });
  document.addEventListener('mouseup', (e) => { if (performance.now() - lastTouchAt > 800) swEnd(e.clientX, e.clientY); });
  document.body.dataset.page = '0';
  cleanSaved();
  $('#swipeHint').hidden = !provider || DREAM;
  $('#savedCount').textContent = saved.length;
  document.querySelectorAll('input[name=keepOn]').forEach((r) => r.addEventListener('change', syncScreenForm));
  $('#fBright').addEventListener('input', syncScreenForm);
  $('#fSaverBright').addEventListener('input', syncScreenForm);
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
  $('#themeChip').addEventListener('click', openQuick);
  $('#line').addEventListener('click', nextMetaphor);
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
  setInterval(() => { if (def && def.needs === 'weather' && !document.hidden) loadWeather(); }, 30 * 60e3);
  requestAnimationFrame(frame);
})();
