/* 나무 — 잎 색이 인생의 계절. 봄엔 꽃이 섞이고, 가을이 깊을수록 잎이 떨어진다 */
(function () {
  'use strict';
  const M = window.M, U = M.util, TAU = U.TAU;
  const MAXD = 8;
  // 인생 진행 → 잎 색 [h, s, l]
  const LEAF = [[0, [95, 42, 66]], [0.3, [122, 32, 46]], [0.55, [80, 34, 44]], [0.7, [40, 70, 54]], [0.85, [18, 64, 46]], [1, [14, 36, 38]]];

  M.registerTheme({
    id: 'tree', name: '나무',
    story: '잎 색이 인생의 계절이에요. 봄엔 꽃이 섞이고, 늦가을로 갈수록 잎이 져요.',
    keywords: ['나무', '숲', '나뭇잎', '낙엽', '식물', '정원', '꽃', '잎', 'tree', 'forest', 'leaf', 'flower', 'garden'],
    create(env) {
      const rng = U.rng(env.seed);
      let W = 0, H = 0, branches = [], leaves = [], falling = [], tips = [];

      // 나무 모양은 주제 글자로 정해진다(같은 글자면 같은 나무)
      const rec = (parent, ang, len, depth) => {
        const b = { parent, ang, len, depth, sw: rng() * TAU, leaf: depth >= MAXD - 2 };
        branches.push(b);
        if (depth >= MAXD) return;
        const n = depth === 0 ? 2 : rng() < 0.22 ? 3 : 2;
        for (let k = 0; k < n; k++) {
          const side = n === 2 ? (k ? 1 : -1) : k - 1;
          rec(b, side * (0.26 + rng() * 0.32) + (rng() - 0.5) * 0.16, len * (0.7 + rng() * 0.12), depth + 1);
        }
      };
      rec(null, (rng() - 0.5) * 0.06, 1, 0);
      tips = branches.filter((b) => b.leaf);
      for (const b of tips) {
        for (let k = 0; k < 2; k++) {
          leaves.push({ b, a: rng() * TAU, d: rng() * 7, s: 1.6 + rng() * 1.8, j: (rng() - 0.5) * 14, drop: rng(), bloom: rng() });
        }
      }

      const spawn = (f) => {
        const b = tips[Math.floor(rng() * tips.length)];
        Object.assign(f, { x: b.ex || W / 2, y: b.ey || H * 0.5, vy: 22 + rng() * 22, ph: rng() * TAU, rot: rng() * TAU, vr: (rng() - 0.5) * 3, j: (rng() - 0.5) * 14 });
      };

      return {
        resize(w, h) { W = w; H = h; falling = Array.from({ length: 34 }, () => ({ wait: rng() * 6 })); },
        draw(g, { t, dt, p }) {
          U.fillV(g, W, H, '#0c1311', '#1d2722');
          const bx = W / 2, by = H * 0.9, L = Math.min(H * 0.14, W * 0.19), unit = L / 120;
          U.glow(g, bx, by, L * 2.2, 'rgba(255,240,210,.05)');
          g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(W * 0.1, by + 0.5); g.lineTo(W * 0.9, by + 0.5); g.stroke();

          for (const b of branches) {
            const pa = b.parent;
            b.sx = pa ? pa.ex : bx; b.sy = pa ? pa.ey : by;
            const sway = Math.sin(t * 0.6 + b.sw) * 0.006 * b.depth + Math.sin(t * 0.35) * 0.008 * b.depth;
            b.a = (pa ? pa.a : 0) + b.ang + sway;
            const l = b.len * L;
            b.ex = b.sx + Math.sin(b.a) * l; b.ey = b.sy - Math.cos(b.a) * l;
          }
          for (let d = 0; d <= MAXD; d++) {
            g.strokeStyle = `rgba(232,224,210,${0.9 - d * 0.05})`;
            g.lineWidth = Math.max(0.5, (MAXD + 1 - d) ** 1.5 * 0.45 * unit);
            g.lineCap = 'round'; g.beginPath();
            for (const b of branches) if (b.depth === d) { g.moveTo(b.sx, b.sy); g.lineTo(b.ex, b.ey); }
            g.stroke();
          }

          const [h, s, l] = U.keyframe(LEAF, p);
          const bloom = U.clamp(1 - p / 0.25, 0, 1) * 0.45;
          const gone = U.clamp((p - 0.72) / 0.28, 0, 1) * 0.9;
          for (const lf of leaves) {
            if (lf.drop < gone) continue;
            g.fillStyle = lf.bloom < bloom ? U.hsl(340, 60, 84, 0.85) : U.hsl(h + lf.j, s, l + lf.j * 0.4, 0.75);
            U.dot(g, lf.b.ex + Math.cos(lf.a) * lf.d * unit * 1.6, lf.b.ey + Math.sin(lf.a) * lf.d * unit * 1.6, lf.s * unit * 1.5);
          }

          // 떨어지는 잎 — 인생이 깊을수록 많다
          const active = Math.round(2 + p * 30);
          falling.forEach((f, i) => {
            if (i >= active) return;
            if (f.wait > 0) { f.wait -= dt; if (f.wait <= 0) spawn(f); return; }
            f.y += f.vy * dt; f.x += Math.sin(t * 1.1 + f.ph) * 20 * dt; f.rot += f.vr * dt;
            if (f.y > by) { f.wait = rng() * 4; return; }
            g.save(); g.translate(f.x, f.y); g.rotate(f.rot);
            g.fillStyle = U.hsl(h + f.j, s, l, 0.8);
            g.beginPath(); g.ellipse(0, 0, 3.6 * unit * 1.4, 1.8 * unit * 1.4, 0, 0, TAU); g.fill();
            g.restore();
          });
        },
        caption: (f) => `잎 색이 인생의 계절 · 지금은 ${M.seasonPhrase(f.p)}`,
      };
    },
  });
})();
