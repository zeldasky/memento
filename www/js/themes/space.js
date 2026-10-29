/* 우주 — 여러 궤도 가운데 하나가 내 궤도, 밝게 그은 만큼이 지나온 삶 */
(function () {
  'use strict';
  const M = window.M, U = M.util, TAU = U.TAU;
  const MINE = 3;

  M.registerTheme({
    id: 'space', name: '우주',
    story: '밝게 빛나는 궤도가 내 궤도예요. 한 바퀴가 한 인생이에요.',
    keywords: ['우주', '별', '별빛', '밤하늘', '은하', '은하수', '행성', '궤도', '태양계', 'space', 'star', 'galaxy', 'planet', 'universe', 'cosmos'],
    create(env) {
      const rng = U.rng(env.seed), hue = 190 + rng() * 90, d = U.drift(env.seed, 6), meteors = U.meteors(rng);
      let W = 0, H = 0, stars = [], orbits = [], nebula = [], TILT = -0.18;
      const at = (o, cx, cy, R, a) => {
        const rx = R * o.f, ry = rx * 0.36, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
        return [cx + x * Math.cos(TILT) - y * Math.sin(TILT), cy + x * Math.sin(TILT) + y * Math.cos(TILT)];
      };
      const trace = (g, o, cx, cy, R, a0, a1) => {
        const n = Math.max(2, Math.ceil(((a1 - a0) / TAU) * 160));
        g.beginPath();
        for (let i = 0; i <= n; i++) {
          const [x, y] = at(o, cx, cy, R, a0 + ((a1 - a0) * i) / n);
          i ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.stroke();
      };
      return {
        resize(w, h) {
          W = w; H = h;
          stars = U.makeStars(rng, 280);
          orbits = [0.13, 0.2, 0.28, 0.37, 0.46].map((f) => ({ f, ph: rng() * TAU, sz: 1.6 + rng() * 2.8, hue: hue + (rng() - 0.5) * 80 }));
          nebula = Array.from({ length: 4 }, () => ({ x: rng(), y: 0.3 + rng() * 0.6, r: 0.25 + rng() * 0.3, h: hue + (rng() - 0.5) * 60 }));
        },
        draw(g, { t, dt, p }) {
          // 몇 분에 걸쳐 궤도가 기울고, 성운 빛이 번지고 옮겨 간다
          TILT = -0.18 + (d(0, t, 140) - 0.5) * 0.3;
          U.fillV(g, W, H, '#03040a', '#0b1020');
          nebula.forEach((n, i) => U.glow(g, (n.x + (d(1 + (i % 3), t, 200) - 0.5) * 0.2) * W, n.y * H, n.r * Math.max(W, H) * (0.8 + d(4, t, 90) * 0.5), U.hsl(n.h + (d(5, t, 160) - 0.5) * 60, 60, 45, 0.05 + 0.05 * d(2 + (i % 2), t, 70))));
          U.drawStars(g, stars, W, H, t, 0.9);
          meteors.draw(g, W, H * 0.5, t, dt);

          const cx = W / 2, cy = H * 0.6, R = Math.min(W, H * 1.6);
          U.glow(g, cx, cy, R * 0.1, 'rgba(255,214,150,.55)');
          g.fillStyle = '#ffe9c4'; U.dot(g, cx, cy, Math.max(4, R * 0.012));

          orbits.forEach((o, i) => {
            if (i === MINE) return;
            g.strokeStyle = 'rgba(255,255,255,.09)'; g.lineWidth = 1;
            trace(g, o, cx, cy, R, 0, TAU);
            const a = o.ph + (t * 0.06) / o.f ** 1.5;
            const [x, y] = at(o, cx, cy, R, a);
            g.fillStyle = U.hsl(o.hue, 55, 70, 0.85); U.dot(g, x, y, o.sz);
          });

          // 내 궤도: 왼쪽 끝(태어남)에서 한 바퀴
          const o = orbits[MINE], a0 = Math.PI, a1 = a0 + TAU * p;
          g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1.2; g.setLineDash([2, 7]);
          trace(g, o, cx, cy, R, a1, a0 + TAU); g.setLineDash([]);
          g.strokeStyle = U.hsl(hue, 80, 82, 0.9); g.lineWidth = 2;
          g.shadowColor = U.hsl(hue, 90, 70, 0.8); g.shadowBlur = 10;
          if (p > 0.001) trace(g, o, cx, cy, R, a0, a1);
          g.shadowBlur = 0;
          const [sx, sy] = at(o, cx, cy, R, a0), [px, py] = at(o, cx, cy, R, a1);
          g.strokeStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.moveTo(sx, sy - 7); g.lineTo(sx, sy + 7); g.stroke();
          U.glow(g, px, py, 22, U.hsl(hue, 90, 75, 0.5 + 0.15 * Math.sin(t * 2)));
          g.fillStyle = '#fff'; U.dot(g, px, py, 4);
        },
        caption: () => '밝게 그은 궤도가 지나온 삶 · 점선이 남은 길',
      };
    },
  });
})();
