/* 계절 — 바깥은 오늘의 진짜 계절(꽃잎·반딧불·낙엽·눈), 가운데 바퀴는 인생의 사계절 */
(function () {
  'use strict';
  const M = window.M, U = M.util, TAU = U.TAU;
  const NAMES = ['봄', '여름', '가을', '겨울'];
  const COL = [[340, 70, 80], [140, 50, 56], [28, 85, 58], [205, 45, 86]];
  const BG = [['#1a1622', '#3a2836'], ['#07130e', '#1a3125'], ['#1a110b', '#3a2414'], ['#0b121b', '#24334a']];
  const seasonOf = (d) => { const m = d.getMonth(); return m >= 2 && m <= 4 ? 0 : m >= 5 && m <= 7 ? 1 : m >= 8 && m <= 10 ? 2 : 3; };

  M.registerTheme({
    id: 'season', name: '계절',
    story: '바퀴 한 바퀴가 인생의 사계절이에요. 바깥 풍경은 오늘의 진짜 계절이에요.',
    keywords: ['계절', '사계절', '사계', '봄', '여름', '가을', '겨울', 'season', 'spring', 'summer', 'autumn', 'winter'],
    create(env) {
      const rng = U.rng(env.seed);
      let W = 0, H = 0, parts = [];
      const spawn = (o, top) => Object.assign(o, {
        x: rng() * W, y: top ? -10 : rng() * H, v: 0.5 + rng(), ph: rng() * TAU, rot: rng() * TAU, vr: (rng() - 0.5) * 2, s: 0.6 + rng() * 0.8, j: rng() - 0.5,
      });
      return {
        resize(w, h) { W = w; H = h; parts = Array.from({ length: 90 }, () => spawn({}, false)); },
        draw(g, { t, dt, p, now }) {
          const today = new Date(now), s = seasonOf(today);
          U.fillV(g, W, H, BG[s][0], BG[s][1]);

          for (const o of parts) {
            if (s === 1) { // 반딧불 — 떠다닌다
              o.x += Math.cos(t * 0.5 * o.v + o.ph) * 16 * dt; o.y += Math.sin(t * 0.4 * o.v + o.ph * 1.3) * 12 * dt;
              const a = Math.max(0, Math.sin(t * 1.8 * o.v + o.ph)) ** 2;
              if (o.y < H * 0.35) o.y = H; if (o.y > H) o.y = H * 0.35;
              U.glow(g, o.x, o.y, 9 * o.s, `rgba(214,255,120,${0.4 * a})`);
              g.fillStyle = `rgba(240,255,190,${a})`; U.dot(g, o.x, o.y, 1.2);
              continue;
            }
            o.y += (s === 0 ? 22 : s === 2 ? 30 : 28) * o.v * dt;
            o.x += (Math.sin(t * 0.9 + o.ph) * (s === 2 ? 26 : 16) + (s === 0 ? 8 : 0)) * dt;
            o.rot += o.vr * dt * (s === 2 ? 1.5 : 1);
            if (o.y > H + 10) spawn(o, true);
            if (s === 3) { g.fillStyle = 'rgba(255,255,255,.8)'; U.dot(g, o.x, o.y, 1 + o.s * 1.3); continue; }
            g.save(); g.translate(o.x, o.y); g.rotate(o.rot);
            if (s === 0) {
              g.fillStyle = U.hsl(340 + o.j * 20, 70, 86, 0.85);
              g.beginPath(); g.ellipse(0, 0, 4.5 * o.s, 2.6 * o.s, 0, 0, TAU); g.fill();
            } else {
              const z = 5 * o.s; g.fillStyle = U.hsl(25 + o.j * 40, 80, 52, 0.85);
              g.beginPath(); g.moveTo(-z, 0); g.quadraticCurveTo(0, -z * 0.65, z, 0); g.quadraticCurveTo(0, z * 0.65, -z, 0); g.fill();
            }
            g.restore();
          }

          // 인생의 사계절 바퀴 — 맨 위가 태어남, 시계 방향
          const cx = W / 2, cy = H * 0.64, r = Math.min(W * 0.33, H * 0.21), gap = 0.05, ap = -Math.PI / 2 + TAU * p;
          for (let q = 0; q < 4; q++) {
            const a0 = -Math.PI / 2 + (q * Math.PI) / 2 + gap, a1 = -Math.PI / 2 + ((q + 1) * Math.PI) / 2 - gap;
            const [h, sa, l] = COL[q];
            g.strokeStyle = U.hsl(h, sa, l, 0.2); g.lineWidth = 2; g.lineCap = 'round';
            g.beginPath(); g.arc(cx, cy, r, a0, a1); g.stroke();
            const e = Math.min(a1, ap);
            if (e > a0) { g.strokeStyle = U.hsl(h, sa, l, 0.95); g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, r, a0, e); g.stroke(); }
            const am = (a0 + a1) / 2;
            g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '12px Pretendard, "Malgun Gothic", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillText(NAMES[q], cx + Math.cos(am) * r * 1.2, cy + Math.sin(am) * r * 1.2);
          }
          U.glow(g, cx + Math.cos(ap) * r, cy + Math.sin(ap) * r, 22, `rgba(255,255,255,${0.45 + 0.15 * Math.sin(t * 2)})`);
          g.fillStyle = '#fff'; U.dot(g, cx + Math.cos(ap) * r, cy + Math.sin(ap) * r, 4.5);

          // 안쪽 작은 고리: 올해(3월 1일이 맨 위)
          const start = new Date(today.getFullYear(), 2, 1);
          let yf = (today - start) / (365.2425 * 864e5); yf -= Math.floor(yf);
          const ri = r * 0.62, ay = -Math.PI / 2 + TAU * yf;
          g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1; g.setLineDash([2, 6]);
          g.beginPath(); g.arc(cx, cy, ri, 0, TAU); g.stroke(); g.setLineDash([]);
          g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.4;
          g.beginPath(); g.arc(cx + Math.cos(ay) * ri, cy + Math.sin(ay) * ri, 3.5, 0, TAU); g.stroke();
          g.fillStyle = 'rgba(255,255,255,.45)'; g.font = '11px Pretendard, "Malgun Gothic", sans-serif';
          g.fillText('올해', cx, cy);
          g.textBaseline = 'alphabetic';
        },
        caption: (f) => `바깥은 ${NAMES[seasonOf(new Date(f.now))]} · 인생은 ${M.seasonPhrase(f.p)}`,
      };
    },
  });
})();
