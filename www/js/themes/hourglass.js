/* 모래시계 — 위에 남은 모래가 남은 시간 */
(function () {
  'use strict';
  const M = window.M, U = M.util;

  M.registerTheme({
    id: 'hourglass', name: '모래시계',
    story: '위에 남은 모래가 남은 시간, 아래 쌓인 모래가 지나온 시간이에요.',
    keywords: ['모래시계', '모래', '시간', '시계', '사막', 'hourglass', 'time', 'sand', 'clock'],
    create(env) {
      const rng = U.rng(env.seed);
      let W = 0, H = 0, grains = [], motes = [], stream = [];
      const texture = (g, x0, y0, w, h) => {
        g.fillStyle = 'rgba(70,45,20,.22)';
        for (const [u, v] of grains) g.fillRect(x0 + u * w, y0 + v * h, 1.2, 1.2);
      };
      return {
        resize(w, h) {
          W = w; H = h;
          grains = Array.from({ length: 700 }, () => [rng(), rng()]);
          motes = U.makeStars(rng, 60);
          stream = Array.from({ length: 36 }, () => ({ y: rng(), v: 0.7 + rng() * 0.8, x: rng() - 0.5 }));
        },
        draw(g, { t, dt, p }) {
          U.fillV(g, W, H, '#110e0b', '#2a2018');
          g.fillStyle = 'rgba(255,225,180,.35)';
          for (const m of motes) {
            const y = ((m.y - t * 0.006 * m.sp) % 1 + 1) % 1;
            g.globalAlpha = 0.3 + 0.3 * Math.sin(t * m.sp + m.ph);
            g.fillRect(m.x * W, y * H, m.r, m.r);
          }
          g.globalAlpha = 1;

          const cx = W / 2, cy = H * 0.6, Ht = Math.min(H * 0.44, W * 0.95), hb = Ht / 2, hw = Math.min(Ht * 0.3, W * 0.36);
          const q = Math.sqrt(1 - p), hs = hb * q;
          const sand = g.createLinearGradient(0, cy - hb, 0, cy + hb);
          sand.addColorStop(0, '#e9c98f'); sand.addColorStop(1, '#b98a4f');

          // 위 모래: 꼭짓점이 목에 붙은 삼각형, 가운데가 살짝 꺼진다
          if (p < 1) {
            const dip = Math.min(hs * 0.25, 8);
            g.save(); g.beginPath();
            g.moveTo(cx - hw * q, cy - hs); g.quadraticCurveTo(cx, cy - hs + dip * 2, cx + hw * q, cy - hs);
            g.lineTo(cx, cy); g.closePath();
            g.fillStyle = sand; g.fill(); g.clip(); texture(g, cx - hw, cy - hb, hw * 2, hb); g.restore();
          }
          // 아래 모래: 바닥부터 쌓여 가운데가 솟는다
          const by = cy + hs, mound = Math.min((hb - hs) * 0.3, 10);
          if (p > 0) {
            g.save(); g.beginPath();
            g.moveTo(cx - hw * q, by); g.quadraticCurveTo(cx, by - mound * 2, cx + hw * q, by);
            g.lineTo(cx + hw, cy + hb); g.lineTo(cx - hw, cy + hb); g.closePath();
            g.fillStyle = sand; g.fill(); g.clip(); texture(g, cx - hw, cy, hw * 2, hb); g.restore();
          }
          // 흐르는 모래
          if (p > 0 && p < 1) {
            const len = by - mound - cy;
            g.strokeStyle = 'rgba(233,201,143,.75)'; g.lineWidth = 1.3;
            g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy + len); g.stroke();
            g.fillStyle = '#f0d49c';
            for (const s of stream) {
              s.y = (s.y + s.v * dt * 1.4) % 1;
              g.fillRect(cx + s.x * 2.4 - 0.6, cy + s.y * len, 1.3, 1.3);
            }
          }

          // 유리와 틀
          g.strokeStyle = 'rgba(255,236,210,.55)'; g.lineWidth = 1.4; g.lineJoin = 'round';
          g.beginPath();
          g.moveTo(cx - hw, cy - hb); g.lineTo(cx - 2, cy - 2); g.lineTo(cx - 2, cy + 2); g.lineTo(cx - hw, cy + hb);
          g.moveTo(cx + hw, cy - hb); g.lineTo(cx + 2, cy - 2); g.lineTo(cx + 2, cy + 2); g.lineTo(cx + hw, cy + hb);
          g.stroke();
          g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 3;
          g.beginPath(); g.moveTo(cx - hw * 0.8, cy - hb * 0.85); g.lineTo(cx - hw * 0.35, cy - hb * 0.4); g.stroke();
          g.fillStyle = 'rgba(255,236,210,.28)';
          g.fillRect(cx - hw - 16, cy - hb - 9, (hw + 16) * 2, 7);
          g.fillRect(cx - hw - 16, cy + hb + 2, (hw + 16) * 2, 7);
          g.strokeStyle = 'rgba(255,236,210,.2)'; g.lineWidth = 2;
          g.beginPath(); g.moveTo(cx - hw - 10, cy - hb - 2); g.lineTo(cx - hw - 10, cy + hb + 2);
          g.moveTo(cx + hw + 10, cy - hb - 2); g.lineTo(cx + hw + 10, cy + hb + 2); g.stroke();
        },
        caption: () => '위에 남은 모래가 남은 시간 · 아래 쌓인 모래가 지나온 시간',
      };
    },
  });
})();
