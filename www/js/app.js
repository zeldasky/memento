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
  const st = Object.assign({ age: null, ageSetAt: Date.now(), birth: '', lifespan: 85, theme: '날씨', place: null, detail: false }, store.get(KEY) || {});
  const save = () => store.set(KEY, st);
  const ready = () => (st.birth || st.age != null) && st.lifespan > 0;

  // 시험용: ?t=초 로 그림 시계를 앞당겨 몇 분 뒤 모습을 바로 본다(주소는 아래에서 지워지므로 먼저 읽는다)
  const T_START = +(new URLSearchParams(location.search).get('t') || 0);

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
  const env = { seed: 0, text: '', weather: null, weatherStatus: 'idle', place: null };
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
      replay(2200);
      $('#themeName').textContent = text;
      if (def.needs === 'weather') loadWeather();
      cv.style.opacity = 1;
    };
    if (fade && scene) { cv.style.opacity = 0; setTimeout(swap, 450); } else swap();
  }

  // 보여 줄 진행률 — 평소엔 진짜 값. 열 때는 태어남(0)에서 지금까지 달려오고(되감기),
  // 화면을 좌우로 끄는 동안은 손가락 자리(타임머신), 놓으면 지금으로 되돌아온다
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
    if (scene) { g.save(); scene.draw(g, { t, dt, p, now: Date.now() }); g.restore(); }
    drawRipples(now);
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
    replay(2600); enter(); shownP = -1;
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

  /* ── 손가락 ─────────────────────────── */
  // 누르기: 물결 · 좌우로 끌기: 그 나이의 나(타임머신), 놓으면 지금으로 돌아온다
  let down = null;
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
  function radio(name, value) { const el = document.querySelector(`input[name=${name}][value=${value}]`); if (el) el.checked = true; }
  function radioValue(name) { const el = document.querySelector(`input[name=${name}]:checked`); return el ? el.value : null; }

  function syncThemeHint() {
    const text = $('#fTheme').value.trim() || '날씨';
    const d = M.matchTheme(text);
    const look = d.id === 'geometry' ? `「${text}」에서 뽑은 ${d.describe(text)}` : `${d.name} 그림`;
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
  function syncPlace() { $('#cityBox').hidden = radioValue('placeMode') !== 'city'; }

  function openSettings(focusTheme) {
    shownAge = st.age != null && !st.birth ? String(+M.currentAge(st).toFixed(1)) : '';
    $('#fAge').value = shownAge;
    $('#fLife').value = st.lifespan || '';
    $('#fBirth').value = st.birth || '';
    $('#birthBox').open = !!st.birth;
    $('#fTheme').value = st.theme || '';
    pickedCity = st.place && st.place.source === 'city' ? st.place : null;
    radio('placeMode', pickedCity ? 'city' : 'geo');
    $('#fCity').value = pickedCity ? pickedCity.name : '';
    $('#cityResults').innerHTML = '';
    searchCity();
    radio('detail', st.detail ? 'more' : 'feel');
    $('#formError').textContent = '';
    $('#cancelBtn').hidden = !ready();
    syncBirth(); syncThemeHint(); syncPlace();
    if (!dlg.open) dlg.showModal();
    (focusTheme ? $('#fTheme') : ready() ? $('#fTheme') : $('#fAge')).focus();
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
    st.theme = $('#fTheme').value.trim() || '날씨';
    if (radioValue('placeMode') === 'city') { if (pickedCity) st.place = pickedCity; }
    else if (st.place && st.place.source === 'city') st.place = null;
    st.detail = radioValue('detail') === 'more';
    save();
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
  updateWords();
  if (!ready()) openSettings(false);
  setInterval(updateWords, 30e3);
  setInterval(nextRemain, 9e3);
  setInterval(() => { if (def && def.needs === 'weather' && !document.hidden) loadWeather(); }, 30 * 60e3);
  requestAnimationFrame(frame);
})();
