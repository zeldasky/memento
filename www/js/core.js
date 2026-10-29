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

  /* ── 되풀이되지 않는 움직임 ──────────────── */
  // 부드러운 1차원 잡음(대략 0~1). 옥타브 셋의 주기가 서로 나뉘지 않아 몇 시간을 봐도 같은 꼴이 돌아오지 않는다
  U.noise = (seed) => {
    const r = U.rng(seed), N = 512, v = Float32Array.from({ length: N }, () => r());
    const at = (x) => {
      const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f);
      const a = v[((i % N) + N) % N], b = v[(((i + 1) % N) + N) % N];
      return a + (b - a) * s;
    };
    return (x) => at(x) * 0.58 + at(x * 2.137 + 17.3) * 0.28 + at(x * 4.711 + 41.9) * 0.14;
  };
  // 천천히 흐르는 값 여러 개: d(i, t, 초) → 0~1, 초가 클수록 느리다
  U.drift = (seed, n = 8) => {
    const fs = Array.from({ length: n }, (_, i) => U.noise((seed + i * 7919) >>> 0));
    return (i, t, sec = 60) => fs[i % n](t / sec);
  };
  // 가끔 일어나는 일 — 다음 시각을 [lo, hi] 초 사이에서 무작위로 정한다
  U.every = (rng, lo, hi) => {
    let next = lo + rng() * (hi - lo);
    return (t) => { if (t < next) return false; next = t + lo + rng() * (hi - lo); return true; };
  };
  // 별똥별 — 하늘 아래 경계 yMax(픽셀)까지
  U.meteors = (rng) => {
    const list = [], due = U.every(rng, 14, 55);
    return {
      draw(g, W, yMax, t, dt) {
        if (due(t)) list.push({ x: W * (0.1 + rng() * 0.8), y: yMax * (0.05 + rng() * 0.4), a: Math.PI * (0.15 + rng() * 0.2) * (rng() < 0.5 ? 1 : -1) + Math.PI / 2, v: 380 + rng() * 260, life: 0, max: 0.7 + rng() * 0.7 });
        for (let i = list.length - 1; i >= 0; i--) {
          const m = list[i];
          m.life += dt;
          if (m.life > m.max) { list.splice(i, 1); continue; }
          const k = m.life / m.max, fade = Math.sin(Math.PI * k);
          const hx = m.x + Math.cos(m.a) * m.v * m.life, hy = m.y + Math.sin(m.a) * m.v * m.life;
          if (hy > yMax) continue;
          const tl = 70 * fade, gr = g.createLinearGradient(hx, hy, hx - Math.cos(m.a) * tl, hy - Math.sin(m.a) * tl);
          gr.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
          g.strokeStyle = gr; g.lineWidth = 1.3; g.beginPath(); g.moveTo(hx, hy);
          g.lineTo(hx - Math.cos(m.a) * tl, hy - Math.sin(m.a) * tl); g.stroke();
        }
      },
    };
  };
  // 바람 — 가끔 30~90초마다 몇 초 동안 세게 분다. 0(잔잔) ~ 1(돌풍)
  U.gusts = (rng) => {
    const due = U.every(rng, 30, 90);
    let start = -1e9, len = 6;
    return (t) => {
      if (due(t)) { start = t; len = 5 + rng() * 6; }
      const k = (t - start) / len;
      return k < 0 || k > 1 ? 0 : Math.sin(Math.PI * k) ** 2;
    };
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
  // 같은 뜻을 여러 표현으로 — 화면을 다시 열 때마다(세션) 하나를 고른다. pk(목록) 은 세션 씨앗으로 고르는 함수
  const first = (list) => list[0];
  U.picker = (seed) => {
    const memo = new Map();
    return (list) => {
      const key = list.join('|');
      if (!memo.has(key)) memo.set(key, U.hash(`${seed}:${key}`) % list.length);
      return list[memo.get(key)];
    };
  };
  // 받침 따라 조사: josa('절반', '을', '를') → '절반을'
  const josa = (w, a, b) => {
    const c = w.charCodeAt(w.length - 1);
    if (c >= 0xac00 && c <= 0xd7a3) return w + ((c - 0xac00) % 28 ? a : b);
    return w + (/[136780]$/.test(w) ? a : b); // 숫자로 끝나면 읽는 소리로(일·삼·육·칠·팔·영 → 받침)
  };
  M.josa = josa;

  M.CLOCK_LABELS = ['인생을 하루로 치면', '삶을 하루에 빗대면', '한평생을 하루로 접으면', '인생이 하루라면', '스물네 시간짜리 인생이라면', '내 삶의 시계는 지금'];
  M.CLOCK_SUFFIX = ['무렵', '즈음', '쯤', '언저리'];

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
  M.seasonLine = (p, pk = first) => {
    const s = SEASONS[Math.min(11, Math.floor(p * 12))];
    return pk([`계절로는 ${s}`, `인생의 ${s}`, `삶의 계절은 ${s}`, `${josa(s, '에', '에')} 서 있어요`]);
  };

  // [값, 이름]
  const FR = [[1 / 5, '5분의 1'], [1 / 4, '4분의 1'], [1 / 3, '3분의 1'], [2 / 5, '5분의 2'], [1 / 2, '절반'],
    [3 / 5, '5분의 3'], [2 / 3, '3분의 2'], [3 / 4, '4분의 3'], [4 / 5, '5분의 4'], [9 / 10, '10분의 9']];
  M.fractionPhrase = (p, pk = first) => {
    if (p >= 1) return pk(['기대한 나이를 넘어섰어요. 이제부터는 덤이에요', '계획보다 오래 걷고 있어요. 하루하루가 선물이에요', '지도 밖을 걷고 있어요. 모든 날이 덤이에요']);
    if (p < 0.12) return pk(['이제 막 길을 나섰어요', '아직 아침 이슬이 마르지 않았어요', '길은 이제 시작이에요']);
    if (p > 0.95) return pk(['거의 끝자락에 와 있어요', '마지막 장을 넘기는 중이에요', '해가 지평선에 닿았어요']);
    let best = FR[0];
    for (const f of FR) if (Math.abs(f[0] - p) < Math.abs(best[0] - p)) best = f;
    const d = p - best[0], x = best[1];
    if (Math.abs(d) < 0.012) return pk([`딱 ${x}쯤 왔어요`, `꼭 ${x} 지점에 서 있어요`, `${x} 지점을 지나는 중이에요`]);
    if (d > 0) return pk([`${josa(x, '을', '를')} 조금 넘게 지나왔어요`, `${josa(x, '을', '를')} 막 넘어섰어요`, `${josa(x, '을', '를')} 지나 조금 더 걸어왔어요`, `${josa(x, '을', '를')} 살짝 넘긴 자리예요`]);
    return pk([`${josa(x, '에', '에')} 조금 못 미치게 왔어요`, `${josa(x, '을', '를')} 눈앞에 두고 있어요`, `곧 ${josa(x, '이', '가')} 돼요`, `${x}까지 얼마 남지 않았어요`]);
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
  // 남은 것들 — 항목마다 표현 몇 개, 세션마다 순서와 표현이 바뀐다
  M.feel = feel;
  M.remainingThings = (yearsLeft, pk = first, rnd = Math.random) => {
    if (yearsLeft <= 0) return [pk(['오늘 하루가 통째로 선물이에요', '오늘이 가장 귀한 날이에요'])];
    const y = yearsLeft, n = (k) => feel(y * k);
    const items = [
      [`앞으로 맞을 여름, 약 ${n(1)}번`, `남은 여름, 약 ${n(1)}번`, `수박 먹을 여름이 약 ${n(1)}번`],
      [`앞으로 볼 보름달, 약 ${n(12.37)}번`, `보름달이 약 ${n(12.37)}번 더 떠요`],
      [`남은 주말, 약 ${n(52.18)}번`, `늦잠 잘 토요일, 약 ${n(52.18)}번`],
      [`남은 아침, 약 ${n(365.24)}번`, `눈 뜰 아침이 약 ${n(365.24)}번`],
      [`첫눈 오는 날, 약 ${n(1)}번`, `첫눈을 약 ${n(1)}번 더 맞아요`],
      [`벚꽃 필 봄, 약 ${n(1)}번`, `꽃구경 갈 봄, 약 ${n(1)}번`],
      [`단풍 드는 가을, 약 ${n(1)}번`],
      [`남은 생일, 약 ${n(1)}번`, `생일 케이크 촛불, 약 ${n(1)}번 더`],
      [`계절이 약 ${n(4)}번 더 바뀌어요`],
      [`남은 금요일 저녁, 약 ${n(52.18)}번`],
    ].map(pk);
    for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
    return items;
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
