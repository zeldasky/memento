/* 바다 — 물결 위를 건너는 작은 배, 지나온 물길이 지나온 삶 */
(function () {
  'use strict';
  const M = window.M, U = M.util;

  M.registerTheme({
    id: 'ocean', name: '바다',
    story: '왼쪽 끝에서 떠난 배가 오른쪽 등대까지 가요. 지나온 물길이 지나온 삶이에요.',
    keywords: ['바다', '파도', '물결', '해변', '항해', '호수', '강물', '물', 'sea', 'ocean', 'wave', 'beach'],
    create(env) {
      const rng = U.rng(env.seed);
      let W = 0, H = 0, stars = [];
      const N = 30, ROW = Math.round(N * 0.38);
      const row = (i, x, t, hy) => {
        const d = i / (N - 1), depth = d ** 1.8;
        const y0 = hy + (H - hy) * depth, amp = (1 + 18 * depth * depth) * (H / 900);
        const k = 0.018 / (0.3 + depth * 1.6), sp = 0.5 + depth * 0.9;
        return y0 + Math.sin(x * k + t * sp + i * 1.7) * amp + Math.sin(x * k * 2.1 - t * sp * 0.7 + i * 0.6) * amp * 0.4;
      };
      const along = (g, i, xa, xb, t, hy) => {
        g.beginPath();
        for (let x = xa; x <= xb; x += 5) { const y = row(i, x, t, hy); x === xa ? g.moveTo(x, y) : g.lineTo(x, y); }
        g.lineTo(xb, row(i, xb, t, hy)); g.stroke();
      };
      return {
        resize(w, h) { W = w; H = h; stars = U.makeStars(rng, 140); },
        draw(g, { t, p }) {
          const hy = H * 0.46;
          U.fillV(g, W, H, '#050a17', '#1d3557', 0, hy);
          g.fillStyle = '#06111f'; g.fillRect(0, hy, W, H - hy);
          U.drawStars(g, stars, W, hy * 0.85, t, 0.6);

          const mx = W * 0.8, my = hy - Math.min(H * 0.09, 70), mr = Math.min(W, H) * 0.028;
          U.glow(g, mx, my, mr * 6, 'rgba(240,232,210,.18)');
          g.fillStyle = '#f2ead6'; U.dot(g, mx, my, mr);

          for (let i = 0; i < N; i++) {
            const depth = (i / (N - 1)) ** 1.8;
            g.strokeStyle = U.hsl(207, 50, 34 + depth * 30, 0.16 + 0.5 * depth); g.lineWidth = 0.5 + depth * 1.4;
            along(g, i, -10, W + 10, t, hy);
            // 달빛 반사
            const half = 4 + depth * 60, x = mx + Math.sin(t * 1.3 + i) * depth * 10;
            g.strokeStyle = `rgba(245,236,210,${0.08 + (1 - depth) * 0.45})`; g.lineWidth = 0.8 + depth;
            along(g, i, x - half, x + half, t, hy);
          }

          // 배의 물길
          const xa = W * 0.07, xb = W * 0.93, xp = xa + (xb - xa) * p;
          g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.2; g.setLineDash([2, 7]);
          along(g, ROW, xp, xb, t, hy); g.setLineDash([]);
          g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.8;
          if (xp > xa + 1) along(g, ROW, xa, xp, t, hy);
          const ya = row(ROW, xa, t, hy);
          g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(xa, ya - 8); g.lineTo(xa, ya + 6); g.stroke();
          // 등대
          const yb = row(ROW, xb, t, hy);
          g.strokeStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.moveTo(xb, yb); g.lineTo(xb, yb - 22); g.stroke();
          const blink = 0.35 + 0.65 * Math.max(0, Math.sin(t * 1.6)) ** 6;
          U.glow(g, xb, yb - 24, 22, `rgba(255,236,190,${0.5 * blink})`);
          g.fillStyle = `rgba(255,240,200,${0.5 + 0.5 * blink})`; U.dot(g, xb, yb - 24, 2.5);
          // 배
          const yp = row(ROW, xp, t, hy), tilt = (row(ROW, xp + 6, t, hy) - row(ROW, xp - 6, t, hy)) / 12;
          g.save(); g.translate(xp, yp - 1); g.rotate(Math.atan(tilt));
          U.glow(g, 0, -6, 26, 'rgba(255,250,235,.25)');
          g.fillStyle = 'rgba(255,255,255,.95)';
          g.beginPath(); g.moveTo(0, -16); g.lineTo(0, -2); g.lineTo(10, -3); g.closePath(); g.fill();
          g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(-7, 0); g.lineTo(9, 0); g.stroke();
          g.restore();
        },
        caption: () => '배가 건너온 물길이 지나온 삶 · 등대까지가 남은 길',
      };
    },
  });
})();
