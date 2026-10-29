/* 화면 보호기 그림 — 검은 화면 위를 천천히 떠도는 기하 상징. 남들 눈엔 무늬, 나에겐 "지금 내 나이"의 암시.
   나이테(산 해만큼) · 10년 도형(지나온 10년마다 하나, 미스티파이식) · 별자리(산 해만큼 이은 별) · 인생의 달(초승 → 보름 → 그믐) · 인생 시계(바늘 하나).
   번인 막기: 배경은 완전한 검정, 모든 것이 벽에 튕기며 움직인다(초당 20~30px — 폰 화면을 15~20초에 가로지른다). docs/화면보호기.md
   장면: create(rng) → draw(g, W, H, t, dt, c)   c = { p: 지나온 비율, age, lifespan } */
(function () {
  'use strict';
  const M = window.M, U = M.util, TAU = U.TAU;

  // DVD 로고처럼 벽에 튕기며 떠도는 중심점
  const drifter = (rng, speed = 24) => {
    const a = rng() * TAU;
    let x = 0.5, y = 0.5, vx = Math.cos(a) * speed, vy = Math.sin(a) * speed, ready = false;
    return (W, H, dt, pad) => {
      if (!ready) { x = pad + rng() * Math.max(1, W - 2 * pad); y = pad + rng() * Math.max(1, H - 2 * pad); ready = true; }
      x += vx * dt; y += vy * dt;
      if (x < pad) { x = pad; vx = Math.abs(vx); } else if (x > W - pad) { x = W - pad; vx = -Math.abs(vx); }
      if (y < pad) { y = pad; vy = Math.abs(vy); } else if (y > H - pad) { y = H - pad; vy = -Math.abs(vy); }
      return [x, y];
    };
  };
  // 10대 봄빛 → 50대 가을빛 → 80대 겨울빛
  const decadeHue = (d) => [150, 110, 70, 45, 30, 15, 355, 220, 205][Math.min(8, d)];

  const SCENES = {
    // 나이테: 산 해만큼 일렁이는 테. 가장 바깥이 올해, 남은 해는 희미한 점선
    rings(rng) {
      const pos = drifter(rng, 20), wob = Array.from({ length: 160 }, () => [rng() * TAU, 0.6 + rng() * 1.4]);
      return (g, W, H, t, dt, c) => {
        const R = Math.min(W, H) * 0.24, [cx, cy] = pos(W, H, dt, R * 1.05), years = Math.floor(c.age), L = Math.max(years + 1, Math.round(c.lifespan));
        g.save(); g.translate(cx, cy); g.rotate(t * 0.01);
        for (let i = 1; i <= L; i++) {
          const r = R * Math.sqrt(i / L), lived = i <= years, last = i === years;
          g.beginPath();
          for (let k = 0; k <= 64; k++) {
            const a = (TAU * k) / 64, [ph, f] = wob[i % wob.length], rr = r * (1 + 0.03 * Math.sin(a * 3 + ph) + 0.015 * Math.sin(a * f * 5 + ph * 2));
            k ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          }
          if (lived) { g.setLineDash([]); g.strokeStyle = U.hsl(32, 55, last ? 72 : 50, last ? 0.85 : 0.22 + 0.25 * (i / years)); g.lineWidth = last ? 1.6 : 1; }
          else { g.setLineDash([1.5, 5]); g.strokeStyle = 'rgba(200,180,150,.08)'; g.lineWidth = 1; }
          g.stroke();
        }
        g.setLineDash([]); g.restore();
      };
    },
    // 10년 도형: 지나온 10년마다 사각형 하나가 꼭짓점마다 벽에 튕기며 잔상을 남긴다. 지금 10년대 것은 그만큼만 밝다
    decades(rng) {
      let shapes = null;
      const make = (n) => Array.from({ length: n }, () => Array.from({ length: 4 }, () => ({ x: rng(), y: rng(), vx: (rng() - 0.5) * 0.18, vy: (rng() - 0.5) * 0.18 })));
      const trail = [];
      return (g, W, H, t, dt, c) => {
        const n = Math.max(1, Math.ceil(c.age / 10));
        if (!shapes || shapes.length !== n) { shapes = make(n); trail.length = 0; }
        for (const s of shapes) for (const v of s) {
          v.x += v.vx * dt; v.y += v.vy * dt;
          if (v.x < 0 || v.x > 1) { v.vx *= -1; v.x = U.clamp(v.x, 0, 1); }
          if (v.y < 0 || v.y > 1) { v.vy *= -1; v.y = U.clamp(v.y, 0, 1); }
        }
        trail.push(shapes.map((s) => s.map((v) => [v.x * W, v.y * H])));
        if (trail.length > 7) trail.shift();
        trail.forEach((frame, k) => {
          frame.forEach((pts, d) => {
            const cur = d === n - 1, a = ((k + 1) / trail.length) * (cur ? 0.25 + 0.65 * ((c.age % 10) / 10) : 0.8) * 0.75;
            g.strokeStyle = U.hsl(decadeHue(d), 70, 62, a); g.lineWidth = 1.2;
            g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke();
          });
        });
      };
    },
    // 별자리: 산 해만큼 별을 이어 그린다. 남은 해는 이어지지 않은 희미한 별, 가장 최근 별이 반짝인다
    stars(rng) {
      const pos = drifter(rng, 22), pts = [];
      let x = 0, y = 0, a = rng() * TAU;
      for (let i = 0; i < 150; i++) { a += (rng() - 0.5) * 1.6; x += Math.cos(a) * (0.05 + rng() * 0.05); y += Math.sin(a) * (0.05 + rng() * 0.05); pts.push([x, y, rng()]); }
      return (g, W, H, t, dt, c) => {
        const R = Math.min(W, H) * 0.24, [cx, cy] = pos(W, H, dt, R * 1.05), years = Math.floor(c.age), L = Math.min(pts.length, Math.max(years + 1, Math.round(c.lifespan)));
        // 크기 · 중심은 한평생(L개) 별이 차지하는 범위로 맞춘다
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (let i = 0; i < L; i++) { x0 = Math.min(x0, pts[i][0]); x1 = Math.max(x1, pts[i][0]); y0 = Math.min(y0, pts[i][1]); y1 = Math.max(y1, pts[i][1]); }
        const mx0 = (x0 + x1) / 2, my0 = (y0 + y1) / 2, sc = R / (Math.max(x1 - x0, y1 - y0) / 2 || 1), cs = Math.cos(t * 0.01), sn = Math.sin(t * 0.01);
        const P = (i) => { const u = (pts[i][0] - mx0) * sc, v = (pts[i][1] - my0) * sc; return [cx + u * cs - v * sn, cy + u * sn + v * cs]; };
        g.strokeStyle = 'rgba(170,200,255,.22)'; g.lineWidth = 0.8; g.beginPath();
        for (let i = 0; i < Math.min(years, L); i++) { const [px, py] = P(i); i ? g.lineTo(px, py) : g.moveTo(px, py); }
        g.stroke();
        for (let i = 0; i < Math.min(L, pts.length); i++) {
          const [px, py] = P(i), lived = i < years, last = i === years - 1;
          if (last) { U.glow(g, px, py, 14, `rgba(200,225,255,${0.4 + 0.25 * Math.sin(t * 2)})`); g.fillStyle = '#eef4ff'; U.dot(g, px, py, 2.2); continue; }
          g.fillStyle = lived ? `rgba(200,220,255,${0.45 + 0.3 * pts[i][2]})` : 'rgba(200,220,255,.08)';
          U.dot(g, px, py, lived ? 1.1 + pts[i][2] * 0.8 : 0.8);
        }
      };
    },
    // 인생의 달: 태어날 때 초승, 인생 한가운데 보름, 끝에 그믐 — 달 나이가 곧 내 나이
    moon(rng) {
      const pos = drifter(rng, 18);
      return (g, W, H, t, dt, c) => {
        const r = Math.min(W, H) * 0.11, [x, y] = pos(W, H, dt, r * 1.6), f = U.clamp(c.p, 0.02, 0.98);
        U.glow(g, x, y, r * 3, `rgba(220,226,255,${0.04 + 0.1 * Math.sin(Math.PI * f)})`);
        g.fillStyle = 'rgba(40,46,64,.55)'; U.dot(g, x, y, r);
        const k = Math.cos(TAU * f), waxing = f < 0.5;
        g.beginPath(); g.arc(x, y, r, -Math.PI / 2, Math.PI / 2, !waxing);
        g.ellipse(x, y, r * Math.abs(k), r, 0, Math.PI / 2, -Math.PI / 2, waxing ? k > 0 : k <= 0); g.closePath();
        const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); gr.addColorStop(0, '#d9d4c4'); gr.addColorStop(1, '#a9a393');
        g.fillStyle = gr; g.fill();
      };
    },
    // 인생 시계: 24시간 문자판에 바늘 하나 — "인생을 하루로 치면"의 지금 시각을 가리킨다
    clock(rng) {
      const pos = drifter(rng, 20);
      return (g, W, H, t, dt, c) => {
        const R = Math.min(W, H) * 0.17, [x, y] = pos(W, H, dt, R * 1.15), a = -Math.PI / 2 + TAU * c.p;
        g.save(); g.translate(x, y);
        for (let i = 0; i < 24; i++) {
          const b = -Math.PI / 2 + (TAU * i) / 24, big = i % 6 === 0;
          g.strokeStyle = `rgba(230,220,200,${big ? 0.4 : 0.16})`; g.lineWidth = big ? 1.6 : 1;
          g.beginPath(); g.moveTo(Math.cos(b) * R * (big ? 0.84 : 0.9), Math.sin(b) * R * (big ? 0.84 : 0.9)); g.lineTo(Math.cos(b) * R, Math.sin(b) * R); g.stroke();
        }
        g.strokeStyle = 'rgba(242,200,121,.35)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, R * 1.08, -Math.PI / 2, a); g.stroke();
        g.strokeStyle = 'rgba(245,235,215,.75)'; g.lineWidth = 2; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-Math.cos(a) * R * 0.12, -Math.sin(a) * R * 0.12); g.lineTo(Math.cos(a) * R * 0.78, Math.sin(a) * R * 0.78); g.stroke();
        g.fillStyle = 'rgba(245,235,215,.8)'; U.dot(g, 0, 0, 2.5);
        g.restore();
      };
    },
  };
  M.SAVER_SCENES = SCENES;
  M.SAVER_NAMES = { mix: '돌아가며', rings: '나이테', decades: '10년 도형', stars: '별자리', moon: '인생의 달', clock: '인생 시계', theme: '주제 그림' };

  // 재생기: style 이 'mix' 면 5분마다 다음 상징으로 3초에 걸쳐 바꾼다
  M.saverPlayer = (seed = 3) => {
    const rng = U.rng(seed), order = Object.keys(SCENES), made = {};
    let idx = Math.floor(rng() * order.length), since = 0, prev = null, fade = 1;
    const get = (name) => made[name] || (made[name] = SCENES[name](U.rng((seed * 31 + order.indexOf(name)) >>> 0)));
    return {
      draw(g, W, H, t, dt, c, style) {
        let name = style && SCENES[style] ? style : order[idx];
        if (!SCENES[style]) {
          since += dt;
          if (since > 300) { since = 0; prev = order[idx]; idx = (idx + 1) % order.length; name = order[idx]; fade = 0; }
        }
        fade = Math.min(1, fade + dt / 3);
        if (prev && fade < 1) { g.save(); g.globalAlpha = 1 - fade; get(prev)(g, W, H, t, dt, c); g.restore(); }
        g.save(); g.globalAlpha = fade; get(name)(g, W, H, t, dt, c); g.restore();
      },
    };
  };
})();
