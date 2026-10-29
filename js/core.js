/* 메멘토 — 공용 도구 · 인생 계산 · 느낌 문장 · 주제 등록 */
(function () {
  'use strict';
  const M = (window.M = window.M || {});
  const U = (M.util = {});
  const TAU = Math.PI * 2;
  U.TAU = TAU;

  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
  // FNV-1a — 주제 글자에서 늘 같은 씨앗을 뽑는다
  U.hash = (s) => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  // mulberry32
  U.rng = (seed) => {
    let a = seed >>> 0 || 1;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  // 세로 그라디언트로 [y0, y1] 칠하기
  U.fillV = (g, W, H, top, bot, y0 = 0, y1 = H) => {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, top); gr.addColorStop(1, bot);
    g.fillStyle = gr; g.fillRect(0, y0, W, y1 - y0);
  };
  U.glow = (g, x, y, r, color) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  };
  U.dot = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
  U.makeStars = (rng, n) => Array.from({ length: n }, () => ({
    x: rng(), y: rng(), r: 0.4 + rng() * 1.3, ph: rng() * TAU, sp: 0.4 + rng() * 1.6,
  }));
  // H 는 별이 깔릴 높이 — 지평선 위만 쓰려면 지평선 y 를 넘긴다
  U.drawStars = (g, stars, W, H, t, a = 1) => {
    g.fillStyle = '#fff';
    for (const s of stars) {
      g.globalAlpha = a * (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph))) * (0.35 + s.r * 0.4);
      g.fillRect(s.x * W, s.y * H, s.r, s.r);
    }
    g.globalAlpha = 1;
  };
  // 키프레임 [[p, [h,s,l]], …] 사이를 잇는다
  U.keyframe = (kf, p) => {
    for (let i = 1; i < kf.length; i++) {
      if (p <= kf[i][0]) {
        const [p0, a] = kf[i - 1], [p1, b] = kf[i], u = (p - p0) / (p1 - p0 || 1);
        return a.map((v, j) => U.lerp(v, b[j], u));
      }
    }
    return kf[kf.length - 1][1];
  };

  /* ── 인생 계산 ─────────────────────────── */
  const YEAR = 365.2425 * 864e5;
  M.currentAge = (st, now = Date.now()) => {
    if (st.birth) {
      const b = new Date(st.birth + 'T00:00:00');
      if (!isNaN(b)) return (now - b) / YEAR;
    }
    return (st.age || 0) + (now - st.ageSetAt) / YEAR;
  };
  M.progress = (st, now) => U.clamp(M.currentAge(st, now) / st.lifespan, 0, 1);

  /* ── 느낌 문장 ─────────────────────────── */
  // 인생을 하루로 치면 지금 몇 시쯤인가 (10분 단위로 뭉갠다)
  M.clockPhrase = (p) => {
    let min = Math.round((p * 1440) / 10) * 10;
    if (min >= 1440) min = 1430;
    const h = Math.floor(min / 60), m = min % 60;
    if (h === 0) return m ? `새벽 0시 ${m}분` : '자정';
    const part = h < 5 ? '새벽' : h < 9 ? '아침' : h < 12 ? '오전' : h < 14 ? '낮' : h < 18 ? '오후' : h < 21 ? '저녁' : '밤';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${part} ${h12}시${m ? ` ${m}분` : ''}`;
  };

  const SEASONS = ['이른 봄', '봄', '늦봄', '초여름', '한여름', '늦여름', '초가을', '가을', '늦가을', '초겨울', '한겨울', '겨울 끝자락'];
  M.seasonPhrase = (p) => SEASONS[Math.min(11, Math.floor(p * 12))];

  // [값, 이름, 조사]
  const FR = [
    [1 / 5, '5분의 1', '을'], [1 / 4, '4분의 1', '을'], [1 / 3, '3분의 1', '을'], [2 / 5, '5분의 2', '를'],
    [1 / 2, '절반', '을'], [3 / 5, '5분의 3', '을'], [2 / 3, '3분의 2', '를'], [3 / 4, '4분의 3', '을'],
    [4 / 5, '5분의 4', '를'], [9 / 10, '10분의 9', '를'],
  ];
  M.fractionPhrase = (p) => {
    if (p >= 1) return '기대한 나이를 넘어섰어요. 이제부터는 덤이에요';
    if (p < 0.12) return '이제 막 길을 나섰어요';
    if (p > 0.95) return '거의 끝자락에 와 있어요';
    let best = FR[0];
    for (const f of FR) if (Math.abs(f[0] - p) < Math.abs(best[0] - p)) best = f;
    const d = p - best[0];
    if (Math.abs(d) < 0.012) return `딱 ${best[1]}쯤 왔어요`;
    return d > 0 ? `${best[1]}${best[2]} 조금 넘게 지나왔어요` : `${best[1]}에 조금 못 미치게 왔어요`;
  };

  // 숫자를 "느낌"으로: 두 자리만 남기고 만·천 단위로 읽는다
  const feel = (n) => {
    n = Math.max(1, n);
    if (n < 20) return String(Math.round(n));
    const e = 10 ** (Math.floor(Math.log10(n)) - 1);
    const r = Math.round(n / e) * e;
    if (r < 10000) return r.toLocaleString('ko-KR');
    const man = Math.floor(r / 10000), rest = r % 10000;
    return `${man}만${rest ? ` ${rest / 1000}천` : ''}`;
  };
  M.remainingThings = (yearsLeft) => {
    if (yearsLeft <= 0) return ['오늘 하루가 통째로 선물이에요'];
    const y = yearsLeft;
    return [
      `앞으로 맞을 여름, 약 ${feel(y)}번`,
      `앞으로 볼 보름달, 약 ${feel(y * 12.37)}번`,
      `남은 주말, 약 ${feel(y * 52.18)}번`,
      `남은 아침, 약 ${feel(y * 365.24)}번`,
      `첫눈 오는 날, 약 ${feel(y)}번`,
    ];
  };

  M.detailLine = (st, now) => {
    const a = M.currentAge(st, now), p = Math.min(1, a / st.lifespan), left = Math.max(0, st.lifespan - a);
    const y = Math.floor(left), m = Math.floor((left - y) * 12);
    return `${a.toFixed(1)}세 / ${st.lifespan}세 · ${(p * 100).toFixed(1)}% 지나옴 · 남은 약 ${y}년 ${m}개월`;
  };

  /* ── 주제 등록 · 고르기 ────────────────── */
  M.themes = [];
  M.registerTheme = (def) => M.themes.push(def);
  M.normalize = (s) => (s || '').trim().toLowerCase();
  M.tokens = (s) => M.normalize(s).split(/[\s,·/]+/).filter(Boolean);
  // 영어·한 글자 낱말은 낱말째 같아야, 두 글자 이상 한글은 들어 있기만 하면 맞음
  // ('비트코인'이 '비'로 날씨가 되지 않게)
  M.keywordHit = (k, whole, tokens) => {
    if (/^[a-z]+$/.test(k)) return tokens.some((t) => t === k || t === k + 's');
    if (k.length < 2) return tokens.includes(k);
    return whole.includes(k);
  };
  M.matchTheme = (text) => {
    const whole = M.normalize(text), tokens = M.tokens(text);
    for (const def of M.themes) {
      if (def.keywords && def.keywords.some((k) => M.keywordHit(k, whole, tokens))) return def;
    }
    return M.themes.find((d) => d.id === 'geometry');
  };
})();
