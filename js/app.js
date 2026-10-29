/* 메멘토 — 화면 · 설정 · 날씨 불러오기 · 그리기 고리 */
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
      scene = def.create(env); scene.resize(W, H); capAt = -1e9;
      $('#themeName').textContent = text;
      if (def.needs === 'weather') loadWeather(false);
      cv.style.opacity = 1;
    };
    if (fade && scene) { cv.style.opacity = 0; setTimeout(swap, 450); } else swap();
  }

  let last = performance.now(), t = 0, capAt = -1e9;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000) * slow;
    last = now; t += dt;
    const f = { t, dt, p: ready() ? M.progress(st) : 0.5, now: Date.now() };
    if (scene) { g.save(); scene.draw(g, f); g.restore(); }
    if (now - capAt > 1000) {
      capAt = now;
      const c = scene && scene.caption ? scene.caption(f) : '';
      if ($('#caption').textContent !== c) $('#caption').textContent = c;
    }
    requestAnimationFrame(frame);
  }

  /* ── 날씨 (Open-Meteo, 키 없음) ─────── */
  let weatherBusy = false;
  function resolvePlace() {
    if (st.place && st.place.source === 'city') return Promise.resolve(st.place);
    return new Promise((res) => {
      if (!navigator.geolocation) return res(st.place || SEOUL);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const pl = { lat: +pos.coords.latitude.toFixed(3), lon: +pos.coords.longitude.toFixed(3), name: '현재 위치', source: 'geo' };
          st.place = pl; save(); res(pl);
        },
        () => res(st.place || SEOUL),
        { timeout: 8000, maximumAge: 30 * 60e3 },
      );
    });
  }
  async function loadWeather(force) {
    if (weatherBusy) return;
    weatherBusy = true;
    if (!env.weather) env.weatherStatus = 'loading';
    try {
      const place = await resolvePlace();
      env.place = place;
      const c = store.get(WKEY);
      if (!force && c && Date.now() - c.at < 30 * 60e3 && Math.abs(c.lat - place.lat) < 0.05 && Math.abs(c.lon - place.lon) < 0.05) {
        env.weather = c.data; env.weatherStatus = 'ok'; return;
      }
      const url = 'https://api.open-meteo.com/v1/forecast'
        + `?latitude=${place.lat}&longitude=${place.lon}`
        + '&current=temperature_2m,weather_code,is_day,cloud_cover,wind_speed_10m'
        + '&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7';
      const r = await fetch(url);
      if (!r.ok) throw new Error(`날씨 ${r.status}`);
      const data = await r.json();
      env.weather = data; env.weatherStatus = 'ok';
      store.set(WKEY, { at: Date.now(), lat: place.lat, lon: place.lon, data });
    } catch (e) {
      console.warn(e);
      env.weatherStatus = 'error';
    } finally {
      weatherBusy = false;
      capAt = -1e9;
    }
  }

  /* ── 문장 ───────────────────────────── */
  let remainItems = [], remainIdx = 0;
  function updateWords() {
    if (!ready()) return;
    const now = Date.now(), age = M.currentAge(st, now), p = U.clamp(age / st.lifespan, 0, 1);
    $('#words').hidden = false; $('#lifeline').hidden = false;
    $('#clock').textContent = M.clockPhrase(p);
    $('#fraction').textContent = M.fractionPhrase(p);
    $('#season').textContent = `계절로는 ${M.seasonPhrase(p)}`;
    remainItems = M.remainingThings(st.lifespan - age);
    $('#remain').textContent = remainItems[remainIdx % remainItems.length];
    $('#detail').hidden = !st.detail;
    if (st.detail) $('#detail').textContent = M.detailLine(st, now);
    $('#lineDone').style.width = `${p * 100}%`;
    $('#lineDot').style.left = `${p * 100}%`;
    $('#dotLabel').textContent = st.detail ? `${age.toFixed(1)}세` : '지금';
    $('#endL').textContent = st.detail ? '0세' : '태어난 날';
    $('#endR').textContent = st.detail ? `${st.lifespan}세` : '마지막 날';
  }
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
    if (pickedCity) cityButtons([pickedCity]);
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
  async function searchCity() {
    const q = $('#fCity').value.trim();
    if (!q) return;
    $('#cityResults').textContent = '찾는 중…';
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=ko&format=json`);
      const data = await r.json();
      cityButtons((data.results || []).map((x) => ({
        lat: +x.latitude.toFixed(3), lon: +x.longitude.toFixed(3), name: x.name, source: 'city',
        label: [x.name, x.admin1, x.country].filter(Boolean).join(' · '),
      })));
    } catch {
      $('#cityResults').textContent = '도시를 못 찾았어요 · 인터넷을 확인해 주세요';
    }
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
    else if (def && def.needs === 'weather' && JSON.stringify(st.place) !== oldPlace) { env.weather = null; loadWeather(true); }
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
  $('#citySearch').addEventListener('click', searchCity);
  $('#fCity').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); searchCity(); } });
  $('#form').addEventListener('submit', submit);
  $('#cancelBtn').addEventListener('click', () => dlg.close());
  dlg.addEventListener('cancel', (e) => { if (!ready()) e.preventDefault(); });
  $('#openSettings').addEventListener('click', () => openSettings(false));
  $('#themeChip').addEventListener('click', () => openSettings(true));
  $('#remain').addEventListener('click', nextRemain);
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    updateWords();
    if (def && def.needs === 'weather') loadWeather(false);
  });

  resize();
  applyTheme(false);
  updateWords();
  if (!ready()) openSettings(false);
  setInterval(updateWords, 30e3);
  setInterval(nextRemain, 9e3);
  setInterval(() => { if (def && def.needs === 'weather' && !document.hidden) loadWeather(true); }, 30 * 60e3);
  requestAnimationFrame(frame);
})();
