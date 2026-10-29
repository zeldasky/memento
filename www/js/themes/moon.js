/* 달 — 달 모양은 오늘 진짜 달, 달을 두른 고리가 지나온 삶 */
(function () {
  'use strict';
  const M = window.M, U = M.util, TAU = U.TAU;

  const SYN = 29.530588853, REF = Date.UTC(2000, 0, 6, 18, 14) / 864e5; // 2000-01-06 삭
  const NAMES = ['새 달', '초승달', '상현달', '차오르는 달', '보름달', '기우는 달', '하현달', '그믐달'];
  M.moonPhase = (now) => {
    const age = (((now / 864e5 - REF) % SYN) + SYN) % SYN, f = age / SYN;
    let toFull = SYN / 2 - age;
    if (toFull < 0) toFull += SYN;
    return { f, age, illum: (1 - Math.cos(TAU * f)) / 2, name: NAMES[Math.round(f * 8) % 8], toFull };
  };

  // f: 0 삭 → 0.5 보름 → 1 삭. 북반구 기준(차오를 때 오른쪽이 밝다)
  function drawMoon(g, x, y, r, f, maria) {
    g.fillStyle = '#181d2b'; U.dot(g, x, y, r);
    const k = Math.cos(TAU * f), waxing = f < 0.5;
    g.save();
    g.beginPath();
    g.arc(x, y, r, -Math.PI / 2, Math.PI / 2, !waxing);
    g.ellipse(x, y, r * Math.abs(k), r, 0, Math.PI / 2, -Math.PI / 2, waxing ? k > 0 : k <= 0);
    g.closePath();
    const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    gr.addColorStop(0, '#fbf7ea'); gr.addColorStop(1, '#d6d0be');
    g.fillStyle = gr; g.fill();
    g.clip();
    for (const m of maria) {
      U.glow(g, x + Math.cos(m.a) * m.d * r, y + Math.sin(m.a) * m.d * r, m.r * r, `rgba(120,112,95,${m.o})`);
    }
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
  }

  M.registerTheme({
    id: 'moon', name: '달',
    story: '달 모양은 오늘 진짜 달이에요. 달을 두른 고리가 지나온 삶이에요.',
    keywords: ['달', '보름달', '달빛', '초승달', '반달', '그믐달', 'moon', 'lunar'],
    create(env) {
      const rng = U.rng(env.seed);
      let W = 0, H = 0, stars = [], maria = [];
      return {
        resize(w, h) {
          W = w; H = h;
          stars = U.makeStars(rng, 240);
          maria = Array.from({ length: 9 }, () => ({ a: rng() * TAU, d: rng() * 0.7, r: 0.08 + rng() * 0.2, o: 0.05 + rng() * 0.09 }));
        },
        draw(g, { t, p, now }) {
          U.fillV(g, W, H, '#04060c', '#131a2b');
          U.drawStars(g, stars, W, H, t, 0.8);
          const ph = M.moonPhase(now);
          const cx = W / 2, cy = H * 0.63, r = Math.min(W * 0.25, H * 0.16);
          U.glow(g, cx, cy, r * 3.2, `rgba(215,222,255,${0.05 + 0.16 * ph.illum})`);
          drawMoon(g, cx, cy, r, ph.f, maria);

          // 고리: 맨 위(태어남)에서 시계 방향으로
          const rr = r * 1.45, a0 = -Math.PI / 2, a1 = a0 + TAU * p;
          g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1.2; g.setLineDash([2, 7]);
          g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.stroke(); g.setLineDash([]);
          g.strokeStyle = 'rgba(255,248,225,.85)'; g.lineWidth = 2;
          g.beginPath(); g.arc(cx, cy, rr, a0, a1); g.stroke();
          for (let i = 0; i < 12; i++) {
            const a = a0 + (TAU * i) / 12, inner = i % 3 ? rr + 4 : rr + 2, outer = i % 3 ? rr + 8 : rr + 12;
            g.strokeStyle = `rgba(255,255,255,${i % 3 ? 0.2 : 0.4})`; g.lineWidth = 1;
            g.beginPath(); g.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
            g.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer); g.stroke();
          }
          const hx = cx + Math.cos(a1) * rr, hy = cy + Math.sin(a1) * rr;
          U.glow(g, hx, hy, 18, `rgba(255,240,200,${0.45 + 0.15 * Math.sin(t * 2)})`);
          g.fillStyle = '#fff6dc'; U.dot(g, hx, hy, 3.5);
        },
        caption() {
          const ph = M.moonPhase(Date.now());
          if (ph.name === '보름달') return '오늘은 보름달 무렵 · 고리가 지나온 삶이에요';
          return `오늘은 ${ph.name} · 보름달까지 ${Math.max(1, Math.round(ph.toFull))}일`;
        },
      };
    },
  });
})();
