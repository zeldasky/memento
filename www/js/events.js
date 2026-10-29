/* 뉴스 이벤트 장면 — 관심 주제에 특이 뉴스가 생기면 30초 동안 화면을 밝히고 글 없이 장면만으로 알린다.
   좋은 소식(up): 올라가고 · 피어나고 · 터지는 장면, 나쁜 소식(down): 떨어지고 · 깨지고 · 빨려 드는 장면, 큰 뉴스지만 논조가 불분명(notice): 혜성.
   글자 · 상표는 하나도 쓰지 않는다(회사에서 옆 사람이 봐도 뜻을 알기 어렵게, 상용 배포 문제없게).
   장면: create(rng, W, H) → draw(g, W, H, k, t, dt, L)   k: 0~1 진행, L: 세기(0~1) */
(function () {
  'use strict';
  const M = window.M, U = M.util, TAU = U.TAU;
  const sm = (a, b, x) => { const k = U.clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
  const sky = (g, W, H, stops) => {
    const gr = g.createLinearGradient(0, 0, 0, H);
    stops.forEach(([o, c]) => gr.addColorStop(o, c));
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  };
  const stars = (rng, n) => Array.from({ length: n }, () => ({ x: rng(), y: rng(), r: 0.4 + rng() * 1.4, ph: rng() * TAU }));

  /* ─────────────── 좋은 소식 ─────────────── */
  function drawRocket(g, x, y, s, ang, flame, tw) {
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s);
    const fl = 26 + flame * 46 * (0.85 + 0.3 * tw);
    U.glow(g, 0, 26 + fl * 0.4, fl * 0.9, `rgba(255,170,70,${0.35 * flame})`);
    const gr = g.createLinearGradient(0, 20, 0, 20 + fl);
    gr.addColorStop(0, 'rgba(255,252,230,1)'); gr.addColorStop(0.35, 'rgba(255,196,90,.95)'); gr.addColorStop(1, 'rgba(255,80,30,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(-7, 20); g.quadraticCurveTo(0, 20 + fl * 1.25, 7, 20); g.closePath(); g.fill();
    g.fillStyle = '#d8453c';
    g.beginPath(); g.moveTo(-9, 6); g.lineTo(-18, 25); g.lineTo(-8.5, 20); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(9, 6); g.lineTo(18, 25); g.lineTo(8.5, 20); g.closePath(); g.fill();
    const body = g.createLinearGradient(-10, 0, 10, 0);
    body.addColorStop(0, '#b9c1cc'); body.addColorStop(0.45, '#f6f8fb'); body.addColorStop(1, '#a9b1bd');
    g.fillStyle = body; g.beginPath(); g.moveTo(0, -36); g.bezierCurveTo(11, -22, 10, -4, 9, 21); g.lineTo(-9, 21); g.bezierCurveTo(-10, -4, -11, -22, 0, -36); g.fill();
    g.fillStyle = '#d8453c'; g.beginPath(); g.moveTo(0, -36); g.bezierCurveTo(4.5, -31, 6.6, -27, 7.6, -23); g.lineTo(-7.6, -23); g.bezierCurveTo(-6.6, -27, -4.5, -31, 0, -36); g.fill();
    g.fillStyle = '#6cc0f5'; U.dot(g, 0, -10, 4.2); g.strokeStyle = '#8b95a3'; g.lineWidth = 1.6; g.beginPath(); g.arc(0, -10, 4.2, 0, TAU); g.stroke();
    g.restore();
  }
  const UP = {
    // 로켓이 불꽃을 뿜으며 붉은 행성으로 — 별이 아래로 쏟아져 솟구치는 느낌
    rocket(rng, W, H) {
      const st = stars(rng, 220), puffs = Array.from({ length: 26 }, () => ({ a: (rng() - 0.5) * Math.PI * 0.9, v: 30 + rng() * 70, r: 14 + rng() * 22, d: rng() * 0.08 }));
      let speed = 0, offset = 0;
      return (g, W, H, k, t, dt, L) => {
        sky(g, W, H, [[0, '#060418'], [0.55, '#1a1440'], [1, '#3a1d3a']]);
        const ascend = sm(0.05, 0.35, k), cruise = sm(0.3, 0.45, k);
        speed = U.lerp(speed, 40 + 900 * cruise + 200 * ascend, Math.min(1, dt * 2)); offset += speed * dt;
        g.fillStyle = '#fff';
        for (const s of st) { const y = ((s.y * H + offset * (0.3 + s.r * 0.5)) % H); g.globalAlpha = 0.4 + 0.6 * (s.r / 1.8); g.fillRect(s.x * W, y, s.r, s.r + speed * 0.012 * s.r); }
        g.globalAlpha = 1;
        // 붉은 행성
        const pr = Math.min(W, H) * (0.1 + 0.06 * sm(0.4, 1, k)), px = W * 0.76, py = H * 0.16;
        U.glow(g, px, py, pr * 2.6, 'rgba(255,120,80,.25)');
        const pg = g.createRadialGradient(px - pr * 0.35, py - pr * 0.35, pr * 0.1, px, py, pr);
        pg.addColorStop(0, '#ffb08a'); pg.addColorStop(0.6, '#d0573a'); pg.addColorStop(1, '#6e2219');
        g.fillStyle = pg; U.dot(g, px, py, pr);
        // 발사대 연기
        const smoke = 1 - sm(0.25, 0.45, k);
        if (smoke > 0) for (const p of puffs) {
          const age = Math.max(0, k - p.d) * 30, r = p.r + age * 9;
          g.fillStyle = `rgba(230,225,235,${0.22 * smoke})`;
          U.dot(g, W / 2 + Math.sin(p.a) * p.v * age, H * 0.95 - Math.abs(Math.cos(p.a)) * age * 6, r);
        }
        // 로켓: 솟구쳐 화면 가운데에 머물다, 끝에 행성 쪽으로 기울며 작아진다
        const exitK = sm(0.72, 0.95, k);
        const x = W / 2 + exitK * (px - W / 2) * 0.9 + Math.sin(t * 2.3) * 2 * cruise;
        const y = U.lerp(H * 0.95, H * 0.5, ascend) - exitK * (H * 0.5 - py) * 0.9 + Math.sin(t * 3.1) * 3 * cruise;
        const s = (Math.min(W, H) / 380) * (1.25 - 0.85 * exitK) * (0.9 + 0.3 * L);
        drawRocket(g, x, y, s, exitK * 0.55, 0.6 + 0.4 * ascend, Math.random());
      };
    },
    // 도시 위 불꽃놀이
    fireworks(rng, W, H) {
      const city = []; for (let x = 0; x < 1; x += 0.03 + rng() * 0.05) city.push({ x, w: 0.03 + rng() * 0.06, h: 0.05 + rng() * 0.16, lit: Array.from({ length: 12 }, () => rng() < 0.35) });
      const shells = [], sparks = [], due = U.every(rng, 0.25, 0.8);
      return (g, W, H, k, t, dt, L) => {
        sky(g, W, H, [[0, '#04050f'], [1, '#141a35']]);
        if (k < 0.9 && due(t * (0.7 + L))) {
          const hue = [45, 330, 190, 120, 280, 15][Math.floor(rng() * 6)];
          shells.push({ x: W * (0.15 + rng() * 0.7), y: H, ty: H * (0.12 + rng() * 0.35), hue, v: H * (0.9 + rng() * 0.4) });
        }
        g.globalCompositeOperation = 'lighter';
        for (let i = shells.length - 1; i >= 0; i--) {
          const s = shells[i]; s.y -= s.v * dt;
          g.fillStyle = `hsla(${s.hue},90%,80%,.9)`; U.dot(g, s.x, s.y, 2);
          g.fillStyle = `hsla(${s.hue},90%,70%,.25)`; U.dot(g, s.x, s.y + 8, 1.4);
          if (s.y <= s.ty) {
            shells.splice(i, 1);
            const n = 70 + Math.floor(50 * L);
            for (let j = 0; j < n; j++) { const a = rng() * TAU, v = 60 + rng() * 170; sparks.push({ x: s.x, y: s.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.4 + rng() * 0.8, age: 0, hue: s.hue + (rng() - 0.5) * 30 }); }
            sparks.push({ flash: true, x: s.x, y: s.y, age: 0, life: 0.35 });
          }
        }
        for (let i = sparks.length - 1; i >= 0; i--) {
          const p = sparks[i]; p.age += dt;
          if (p.age > p.life) { sparks.splice(i, 1); continue; }
          const a = 1 - p.age / p.life;
          if (p.flash) { U.glow(g, p.x, p.y, 120 * a, `rgba(255,240,210,${0.5 * a})`); continue; }
          const ox = p.x, oy = p.y;
          p.vx *= 1 - dt * 1.2; p.vy = p.vy * (1 - dt * 1.2) + 70 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          g.strokeStyle = `hsla(${p.hue},95%,${65 + 25 * a}%,${a})`; g.lineWidth = 2;
          g.beginPath(); g.moveTo(ox - (p.x - ox) * 3, oy - (p.y - oy) * 3); g.lineTo(p.x, p.y); g.stroke();
          g.fillStyle = `hsla(${p.hue},100%,92%,${a})`; U.dot(g, p.x, p.y, 1.8);
        }
        g.globalCompositeOperation = 'source-over';
        for (const b of city) {
          const bx = b.x * W, bw = b.w * W, bh = b.h * H;
          g.fillStyle = '#070912'; g.fillRect(bx, H - bh, bw, bh);
          b.lit.forEach((on, j) => { if (on) { g.fillStyle = 'rgba(255,214,140,.55)'; g.fillRect(bx + 3 + (j % 3) * (bw / 3), H - bh + 6 + Math.floor(j / 3) * 9, 2.5, 3.5); } });
        }
      };
    },
    // 수면 위로 떠오르는 풍등
    lanterns(rng, W, H) {
      const ls = Array.from({ length: 46 }, () => ({ x: rng(), d: rng() * 0.55, v: 0.035 + rng() * 0.04, s: 0.6 + rng() * 0.8, ph: rng() * TAU }));
      return (g, W, H, k, t, dt, L) => {
        sky(g, W, H, [[0, '#0a0b26'], [0.62, '#3a2448'], [0.74, '#a55a3c'], [0.75, '#160f22'], [1, '#07060f']]);
        const hz = H * 0.745;
        for (const l of ls) {
          const age = Math.max(0, k - l.d) * 30;
          if (age <= 0) continue;
          const y = hz - age * l.v * H, sc = l.s * U.clamp(1 - (hz - y) / H * 0.9, 0.25, 1) * (Math.min(W, H) / 400);
          if (y < -40) continue;
          const x = l.x * W + Math.sin(t * 0.6 + l.ph) * 14 * sc;
          U.glow(g, x, y, 34 * sc, 'rgba(255,170,80,.35)');
          const bg = g.createLinearGradient(0, y - 14 * sc, 0, y + 10 * sc);
          bg.addColorStop(0, '#ffd6a0'); bg.addColorStop(1, '#ff8a3d');
          g.fillStyle = bg; g.beginPath(); g.moveTo(x - 8 * sc, y - 12 * sc); g.lineTo(x + 8 * sc, y - 12 * sc); g.lineTo(x + 6 * sc, y + 10 * sc); g.lineTo(x - 6 * sc, y + 10 * sc); g.closePath(); g.fill();
          g.fillStyle = '#fff6d8'; U.dot(g, x, y + 8 * sc, 1.6 * sc);
          // 물에 비친 빛
          const ry = hz + (hz - y) * 0.35;
          if (ry < H) { g.fillStyle = `rgba(255,170,90,${0.18 * sc})`; g.fillRect(x - 6 * sc, ry, 12 * sc, 2 + 6 * sc); }
        }
      };
    },
    // 해돋이 — 밤하늘이 금빛으로 바뀌고 새 떼가 난다
    sunrise(rng, W, H) {
      const birds = Array.from({ length: 9 }, (_, i) => ({ dx: (i % 3) * 22 + rng() * 8, dy: Math.floor(i / 3) * 14 + (i % 3) * 8, ph: rng() * TAU }));
      return (g, W, H, k, t, dt, L) => {
        const u = sm(0.02, 0.55, k);
        const c = (a, b) => `rgb(${a.map((v, i) => Math.round(U.lerp(v, b[i], u))).join(',')})`;
        sky(g, W, H, [[0, c([8, 10, 30], [70, 120, 200])], [0.55, c([25, 20, 50], [255, 190, 120])], [0.7, c([40, 25, 45], [255, 140, 70])], [0.701, '#0b0c16'], [1, '#05060c']]);
        const hz = H * 0.7, sr = Math.min(W, H) * 0.1, sy = U.lerp(hz + sr * 1.5, H * 0.38, sm(0.05, 0.55, k)), sx = W / 2;
        g.save(); g.beginPath(); g.rect(0, 0, W, hz); g.clip();
        g.translate(sx, sy); g.rotate(t * 0.05);
        for (let i = 0; i < 16; i++) { g.rotate(TAU / 16); g.fillStyle = `rgba(255,230,160,${0.08 * u})`; g.beginPath(); g.moveTo(0, 0); g.lineTo(-30, -H); g.lineTo(30, -H); g.closePath(); g.fill(); }
        g.restore(); g.save(); g.beginPath(); g.rect(0, 0, W, hz); g.clip();
        U.glow(g, sx, sy, sr * 5, 'rgba(255,200,120,.45)');
        g.fillStyle = '#fff1c9'; U.dot(g, sx, sy, sr);
        g.restore();
        // 물에 비친 해
        for (let i = 0; i < 14; i++) { const y = hz + 6 + i * 9, w = (sr * 1.4) * (1 - i / 16); g.fillStyle = `rgba(255,200,120,${0.4 * u * (1 - i / 14)})`; g.fillRect(sx - w / 2 + Math.sin(t * 2 + i) * 4, y, w, 2.5); }
        // 새 떼
        const bx = U.lerp(-0.2, 1.2, sm(0.35, 0.95, k)) * W, by = H * 0.3;
        g.strokeStyle = 'rgba(30,25,40,.85)'; g.lineWidth = 1.8;
        for (const b of birds) { const f = Math.sin(t * 9 + b.ph) * 4, x = bx - b.dx, y = by + b.dy; g.beginPath(); g.moveTo(x - 7, y - f); g.quadraticCurveTo(x - 3, y - 3, x, y); g.quadraticCurveTo(x + 3, y - 3, x + 7, y - f); g.stroke(); }
      };
    },
    // 꽃이 차례로 피어나고 꽃가루가 떠오른다
    bloom(rng, W, H) {
      const fl = Array.from({ length: 7 }, (_, i) => ({ x: 0.1 + (i / 6) * 0.8 + (rng() - 0.5) * 0.06, h: 0.25 + rng() * 0.3, d: rng() * 0.15, n: 6 + Math.floor(rng() * 3), hue: [340, 30, 50, 300, 10, 200, 320][i], sw: rng() * TAU }));
      const pollen = Array.from({ length: 70 }, () => ({ x: rng(), y: rng(), v: 0.02 + rng() * 0.04, ph: rng() * TAU }));
      return (g, W, H, k, t, dt, L) => {
        sky(g, W, H, [[0, '#14243a'], [0.6, '#3c5a6a'], [1, '#e9b9a6']]);
        const ground = H * 0.93, unit = Math.min(W, H) / 400;
        for (const f of fl) {
          const grow = sm(0.03 + f.d, 0.3 + f.d, k), open = sm(0.25 + f.d, 0.5 + f.d, k);
          const x0 = f.x * W, top = ground - f.h * H * grow, sway = Math.sin(t * 0.8 + f.sw) * 8 * grow;
          g.strokeStyle = '#3f7a4a'; g.lineWidth = 3 * unit; g.beginPath(); g.moveTo(x0, ground); g.quadraticCurveTo(x0 - 10, (ground + top) / 2, x0 + sway, top); g.stroke();
          if (open <= 0) continue;
          const R = 26 * unit * (0.6 + open * 0.6);
          for (let i = 0; i < f.n; i++) {
            const a = (TAU * i) / f.n + t * 0.05;
            g.save(); g.translate(x0 + sway, top); g.rotate(a); g.scale(open, open);
            const pg = g.createLinearGradient(0, 0, R, 0); pg.addColorStop(0, `hsl(${f.hue},70%,88%)`); pg.addColorStop(1, `hsl(${f.hue},75%,66%)`);
            g.fillStyle = pg; g.beginPath(); g.ellipse(R * 0.55, 0, R * 0.55, R * 0.24, 0, 0, TAU); g.fill(); g.restore();
          }
          g.fillStyle = '#ffd86a'; U.dot(g, x0 + sway, top, 5 * unit * open);
        }
        for (const p of pollen) {
          const y = (((p.y - t * p.v) % 1) + 1) % 1, a = sm(0.35, 0.5, k);
          g.fillStyle = `rgba(255,236,170,${0.7 * a})`; U.dot(g, (p.x + Math.sin(t + p.ph) * 0.01) * W, y * H, 1.6);
        }
      };
    },
    // 열기구가 맑은 하늘로 떠오른다(구름이 아래로 흘러 올라가는 느낌)
    balloons(rng, W, H) {
      const bs = Array.from({ length: 6 }, (_, i) => ({ x: 0.12 + i * 0.15 + (rng() - 0.5) * 0.06, d: rng() * 0.2, s: 0.7 + rng() * 0.6, c: [[350, 45], [40, 200], [200, 50], [140, 10], [280, 50], [20, 190]][i] }));
      const clouds = Array.from({ length: 9 }, () => ({ x: rng(), y: rng(), s: 0.6 + rng() }));
      return (g, W, H, k, t, dt, L) => {
        sky(g, W, H, [[0, '#2f74c9'], [1, '#bfe2f7']]);
        for (const c of clouds) {
          const y = (((c.y + t * 0.03) % 1.3) - 0.15) * H;
          for (let j = 0; j < 4; j++) { g.fillStyle = 'rgba(255,255,255,.55)'; U.dot(g, c.x * W + j * 22 * c.s, y + (j % 2) * 8, 22 * c.s); }
        }
        const unit = Math.min(W, H) / 400;
        for (const b of bs) {
          const rise = sm(0.02 + b.d, 0.55 + b.d, k), x = b.x * W + Math.sin(t * 0.5 + b.x * 9) * 10, y = U.lerp(H + 80, H * (0.25 + b.d), rise), s = b.s * unit;
          const R = 28 * s;
          g.save(); g.beginPath(); g.ellipse(x, y, R * 0.9, R, 0, 0, TAU); g.clip();
          for (let j = -3; j <= 3; j++) { g.fillStyle = `hsl(${j % 2 ? b.c[0] : b.c[1]},70%,${j % 2 ? 58 : 70}%)`; g.fillRect(x + j * R * 0.26 - R * 0.13, y - R, R * 0.26, R * 2); }
          g.restore();
          g.strokeStyle = 'rgba(80,60,40,.8)'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(x - R * 0.5, y + R * 0.85); g.lineTo(x - 5 * s, y + R * 1.35); g.moveTo(x + R * 0.5, y + R * 0.85); g.lineTo(x + 5 * s, y + R * 1.35); g.stroke();
          g.fillStyle = '#8a5a34'; g.fillRect(x - 6 * s, y + R * 1.35, 12 * s, 8 * s);
        }
      };
    },
    // 빛줄기 그래프가 치솟는다
    surge(rng, W, H) {
      const pts = []; let v = 0.5;
      for (let i = 0; i <= 120; i++) { const u = i / 120; v += (rng() - 0.5) * 0.03 + (u > 0.62 ? 0.012 + u * 0.01 : 0); pts.push(v); }
      const sparks = [];
      return (g, W, H, k, t, dt, L) => {
        sky(g, W, H, [[0, '#04120e'], [1, '#0b231c']]);
        g.strokeStyle = 'rgba(120,255,200,.06)'; g.lineWidth = 1;
        for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(0, (H * i) / 8); g.lineTo(W, (H * i) / 8); g.stroke(); g.beginPath(); g.moveTo((W * i) / 8, 0); g.lineTo((W * i) / 8, H); g.stroke(); }
        const n = Math.floor(sm(0.03, 0.6, k) * 120), lo = Math.min(...pts), hi = Math.max(...pts);
        const P = (i) => [W * 0.06 + (W * 0.88 * i) / 120, H * 0.82 - ((pts[i] - lo) / (hi - lo)) * H * 0.6];
        if (n < 2) return;
        const area = g.createLinearGradient(0, H * 0.2, 0, H * 0.85); area.addColorStop(0, 'rgba(80,255,170,.28)'); area.addColorStop(1, 'rgba(80,255,170,0)');
        g.fillStyle = area; g.beginPath(); g.moveTo(P(0)[0], H * 0.85); for (let i = 0; i <= n; i++) g.lineTo(...P(i)); g.lineTo(P(n)[0], H * 0.85); g.closePath(); g.fill();
        g.shadowColor = 'rgba(120,255,190,.9)'; g.shadowBlur = 14; g.strokeStyle = '#8dffd0'; g.lineWidth = 3; g.lineJoin = 'round';
        g.beginPath(); for (let i = 0; i <= n; i++) i ? g.lineTo(...P(i)) : g.moveTo(...P(i)); g.stroke(); g.shadowBlur = 0;
        const [hx, hy] = P(n);
        U.glow(g, hx, hy, 40, 'rgba(180,255,220,.6)'); g.fillStyle = '#fff'; U.dot(g, hx, hy, 4);
        if (rng() < 0.6) sparks.push({ x: hx, y: hy, vx: (rng() - 0.3) * 60, vy: -40 - rng() * 90, age: 0 });
        for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.age += dt; if (s.age > 1.2) { sparks.splice(i, 1); continue; } s.x += s.vx * dt; s.y += s.vy * dt; g.fillStyle = `rgba(200,255,230,${1 - s.age / 1.2})`; U.dot(g, s.x, s.y, 1.6); }
      };
    },
  };

  /* ─────────────── 나쁜 소식 ─────────────── */
  const DOWN = {
    // 불덩이가 비스듬히 떨어져 땅에 부딪힌다
    meteors(rng, W, H) {
      const ms = [], hits = [], debris = [], due = U.every(rng, 0.4, 1.4), st = stars(rng, 120);
      const hills = Array.from({ length: 9 }, (_, i) => 0.84 + Math.sin(i * 1.7) * 0.03 + rng() * 0.03);
      return (g, W, H, k, t, dt, L) => {
        sky(g, W, H, [[0, '#0b0510'], [0.7, '#2a0d14'], [1, '#3d1410']]);
        g.fillStyle = '#fff'; for (const s of st) { g.globalAlpha = 0.5; g.fillRect(s.x * W, s.y * H * 0.7, s.r, s.r); } g.globalAlpha = 1;
        const ground = (x) => { const f = (x / W) * (hills.length - 1), i = Math.floor(f), u = f - i; return H * U.lerp(hills[Math.min(i, 8)], hills[Math.min(i + 1, 8)], u); };
        if (k < 0.88 && due(t * (0.8 + L))) ms.push({ x: W * (0.3 + rng() * 0.9), y: -30, a: Math.PI * (0.6 + rng() * 0.08), v: 380 + rng() * 260, r: 3 + rng() * 5 });
        for (let i = ms.length - 1; i >= 0; i--) {
          const m = ms[i]; m.x += Math.cos(m.a) * m.v * dt; m.y += Math.sin(m.a) * m.v * dt;
          const tl = 120 + m.r * 18, tx = m.x - Math.cos(m.a) * tl, ty = m.y - Math.sin(m.a) * tl;
          const gr = g.createLinearGradient(m.x, m.y, tx, ty); gr.addColorStop(0, 'rgba(255,230,180,.95)'); gr.addColorStop(0.2, 'rgba(255,120,50,.7)'); gr.addColorStop(1, 'rgba(255,60,20,0)');
          g.strokeStyle = gr; g.lineWidth = m.r * 1.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(m.x, m.y); g.lineTo(tx, ty); g.stroke();
          U.glow(g, m.x, m.y, m.r * 6, 'rgba(255,150,70,.5)'); g.fillStyle = '#fff1d0'; U.dot(g, m.x, m.y, m.r);
          if (m.y >= ground(m.x)) {
            ms.splice(i, 1); hits.push({ x: m.x, y: ground(m.x), age: 0, r: m.r });
            for (let j = 0; j < 22; j++) { const a = -Math.PI * rng(); debris.push({ x: m.x, y: ground(m.x), vx: Math.cos(a) * (60 + rng() * 140), vy: Math.sin(a) * (80 + rng() * 160), age: 0 }); }
          }
        }
        for (let i = hits.length - 1; i >= 0; i--) {
          const h = hits[i]; h.age += dt;
          if (h.age > 3) { hits.splice(i, 1); continue; }
          if (h.age < 0.4) { g.fillStyle = `rgba(255,220,180,${0.25 * (1 - h.age / 0.4)})`; g.fillRect(0, 0, W, H); }
          U.glow(g, h.x, h.y, 30 + h.r * 10 * (1 - h.age / 3), `rgba(255,110,40,${0.6 * (1 - h.age / 3)})`);
        }
        g.fillStyle = '#0a0607'; g.beginPath(); g.moveTo(0, H);
        for (let x = 0; x <= W; x += 10) g.lineTo(x, ground(x)); g.lineTo(W, H); g.closePath(); g.fill();
        for (let i = debris.length - 1; i >= 0; i--) { const d = debris[i]; d.age += dt; if (d.age > 1.4) { debris.splice(i, 1); continue; } d.vy += 260 * dt; d.x += d.vx * dt; d.y += d.vy * dt; g.fillStyle = `rgba(255,150,80,${1 - d.age / 1.4})`; g.fillRect(d.x, d.y, 2, 2); }
      };
    },
    // 먹구름 · 장대비 · 번개
    storm(rng, W, H) {
      const drops = Array.from({ length: 700 }, () => ({ x: rng(), y: rng(), v: 0.8 + rng() * 0.6 }));
      const clouds = Array.from({ length: 16 }, () => ({ x: rng() * 1.2 - 0.1, y: rng() * 0.3, r: 0.12 + rng() * 0.15, v: 0.01 + rng() * 0.02 }));
      const due = U.every(rng, 1.2, 3.5); let flash = 0, bolt = null;
      return (g, W, H, k, t, dt, L) => {
        sky(g, W, H, [[0, '#0b0d12'], [1, '#1c2128']]);
        for (const c of clouds) { const x = (((c.x + t * c.v) % 1.3) - 0.15) * W; const gr = g.createRadialGradient(x, c.y * H, 0, x, c.y * H, c.r * W); gr.addColorStop(0, 'rgba(60,66,78,.9)'); gr.addColorStop(1, 'rgba(60,66,78,0)'); g.fillStyle = gr; U.dot(g, x, c.y * H, c.r * W); }
        if (k < 0.9 && due(t)) {
          flash = 1; let x = W * (0.2 + rng() * 0.6), y = H * 0.18; bolt = [[x, y]];
          while (y < H * 0.95) { y += 20 + rng() * 34; x += (rng() - 0.5) * 60; bolt.push([x, y]); }
        }
        g.strokeStyle = 'rgba(180,200,225,.45)'; g.lineWidth = 1.1; g.beginPath();
        for (const d of drops) { d.y += d.v * dt * 1.6; if (d.y > 1) { d.y -= 1; d.x = rng(); } const x = d.x * W + d.y * 60, y = d.y * H; g.moveTo(x, y); g.lineTo(x - 7, y - 26); }
        g.stroke();
        if (flash > 0) {
          g.fillStyle = `rgba(220,230,255,${flash * 0.45})`; g.fillRect(0, 0, W, H);
          if (bolt && flash > 0.4) { g.shadowColor = '#cfe0ff'; g.shadowBlur = 20; g.strokeStyle = `rgba(255,255,255,${flash})`; g.lineWidth = 3; g.beginPath(); bolt.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.shadowBlur = 0; }
          flash = Math.max(0, flash - dt * 2.2);
        }
      };
    },
    // 유리가 쩍 갈라지고 조각이 떨어진다(뒤의 그림이 비친다)
    crack(rng, W, H) {
      const cx = W * (0.35 + rng() * 0.3), cy = H * (0.35 + rng() * 0.25), lines = [];
      const branch = (x, y, a, len, depth) => {
        const pts = [[x, y]]; let px = x, py = y;
        const n = 6 + Math.floor(rng() * 5);
        for (let i = 0; i < n; i++) { a += (rng() - 0.5) * 0.5; px += Math.cos(a) * (len / n); py += Math.sin(a) * (len / n); pts.push([px, py]); if (depth < 2 && rng() < 0.25) branch(px, py, a + (rng() < 0.5 ? 0.7 : -0.7), len * 0.45, depth + 1); }
        lines.push({ pts, depth });
      };
      const R = Math.hypot(W, H);
      for (let i = 0; i < 14; i++) branch(cx, cy, (TAU * i) / 14 + rng() * 0.3, R * (0.35 + rng() * 0.4), 0);
      const shards = Array.from({ length: 26 }, () => { const a = rng() * TAU, d = 20 + rng() * 140; return { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, s: 6 + rng() * 16, r: rng() * TAU, vr: (rng() - 0.5) * 4, d: 0.3 + rng() * 0.4, vy: 0 }; });
      return (g, W, H, k, t, dt, L) => {
        g.fillStyle = 'rgba(8,12,20,.5)'; g.fillRect(0, 0, W, H);
        const grow = sm(0.02, 0.12, k);
        if (k < 0.05) { g.fillStyle = `rgba(230,240,255,${0.5 * (1 - k / 0.05)})`; g.fillRect(0, 0, W, H); }
        g.lineCap = 'round';
        for (const l of lines) {
          const n = Math.max(1, Math.floor(l.pts.length * grow));
          g.strokeStyle = `rgba(235,245,255,${l.depth ? 0.55 : 0.85})`; g.lineWidth = l.depth ? 0.8 : 1.4;
          g.shadowColor = 'rgba(160,200,255,.8)'; g.shadowBlur = 6;
          g.beginPath(); l.pts.slice(0, n + 1).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
        }
        g.shadowBlur = 0;
        for (let i = 1; i <= 3; i++) { g.strokeStyle = `rgba(220,235,255,${0.35 * grow})`; g.lineWidth = 0.8; g.beginPath(); g.arc(cx, cy, i * 28, 0, TAU); g.stroke(); }
        for (const s of shards) {
          if (k < s.d) { g.fillStyle = 'rgba(210,230,255,.12)'; } else { s.vy += 600 * dt; s.y += s.vy * dt; s.r += s.vr * dt; g.fillStyle = 'rgba(210,230,255,.35)'; }
          if (s.y > H + 40) continue;
          g.save(); g.translate(s.x, s.y); g.rotate(s.r); g.beginPath(); g.moveTo(0, -s.s); g.lineTo(s.s * 0.7, s.s * 0.6); g.lineTo(-s.s * 0.6, s.s * 0.4); g.closePath(); g.fill();
          g.strokeStyle = 'rgba(240,248,255,.7)'; g.lineWidth = 0.8; g.stroke(); g.restore();
        }
      };
    },
    // 모든 것이 소용돌이(블랙홀)로 빨려 든다
    vortex(rng, W, H) {
      const ps = Array.from({ length: 420 }, () => ({ a: rng() * TAU, r: 0.2 + rng() * 0.9, v: 0.6 + rng(), h: 200 + rng() * 80 }));
      return (g, W, H, k, t, dt, L) => {
        sky(g, W, H, [[0, '#05040c'], [1, '#0e0b1c']]);
        const cx = W / 2, cy = H * 0.5, R = Math.hypot(W, H) * 0.55, pull = 0.15 + 0.5 * sm(0.05, 0.4, k);
        for (const p of ps) {
          p.a += dt * p.v * (0.6 + 1.8 / (p.r + 0.15)); p.r -= dt * pull * p.v * 0.25;
          if (p.r < 0.04) { p.r = 0.9 + rng() * 0.3; p.a = rng() * TAU; }
          const x = cx + Math.cos(p.a) * p.r * R, y = cy + Math.sin(p.a) * p.r * R * 0.62;
          const tx = cx + Math.cos(p.a - 0.12) * p.r * R, ty = cy + Math.sin(p.a - 0.12) * p.r * R * 0.62;
          g.strokeStyle = `hsla(${p.h},70%,${55 + 30 * (1 - p.r)}%,${0.25 + 0.6 * (1 - p.r)})`; g.lineWidth = 1 + (1 - p.r) * 1.5;
          g.beginPath(); g.moveTo(tx, ty); g.lineTo(x, y); g.stroke();
        }
        const hr = Math.min(W, H) * 0.08;
        U.glow(g, cx, cy, hr * 3, 'rgba(150,120,255,.3)');
        g.fillStyle = '#000'; U.dot(g, cx, cy, hr);
        g.strokeStyle = 'rgba(200,180,255,.6)'; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy, hr * 1.6, hr * 0.5, 0, 0, TAU); g.stroke();
      };
    },
    // 그래프가 곤두박질친다
    plunge(rng, W, H) {
      const pts = []; let v = 0.5;
      for (let i = 0; i <= 120; i++) { const u = i / 120; v += (rng() - 0.5) * 0.03 - (u > 0.6 ? 0.016 + u * 0.012 : 0); pts.push(v); }
      const drops = [];
      return (g, W, H, k, t, dt, L) => {
        sky(g, W, H, [[0, '#14060a'], [1, '#2a0b10']]);
        g.strokeStyle = 'rgba(255,120,120,.06)'; g.lineWidth = 1;
        for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(0, (H * i) / 8); g.lineTo(W, (H * i) / 8); g.stroke(); g.beginPath(); g.moveTo((W * i) / 8, 0); g.lineTo((W * i) / 8, H); g.stroke(); }
        const n = Math.floor(sm(0.03, 0.6, k) * 120), lo = Math.min(...pts), hi = Math.max(...pts);
        const shake = n > 75 && n < 115 ? (rng() - 0.5) * 6 : 0;
        const P = (i) => [W * 0.06 + (W * 0.88 * i) / 120 + shake, H * 0.2 + (1 - (pts[i] - lo) / (hi - lo)) * H * 0.62];
        if (n < 2) return;
        g.shadowColor = 'rgba(255,90,90,.9)'; g.shadowBlur = 14; g.strokeStyle = '#ff7b7b'; g.lineWidth = 3; g.lineJoin = 'round';
        g.beginPath(); for (let i = 0; i <= n; i++) i ? g.lineTo(...P(i)) : g.moveTo(...P(i)); g.stroke(); g.shadowBlur = 0;
        const [hx, hy] = P(n);
        U.glow(g, hx, hy, 40, 'rgba(255,120,120,.6)'); g.fillStyle = '#fff'; U.dot(g, hx, hy, 4);
        if (rng() < 0.6) drops.push({ x: hx, y: hy, vx: (rng() - 0.5) * 40, vy: 30 + rng() * 60, age: 0 });
        for (let i = drops.length - 1; i >= 0; i--) { const s = drops[i]; s.age += dt; if (s.age > 1.4) { drops.splice(i, 1); continue; } s.vy += 200 * dt; s.x += s.vx * dt; s.y += s.vy * dt; g.fillStyle = `rgba(255,170,170,${1 - s.age / 1.4})`; U.dot(g, s.x, s.y, 1.6); }
      };
    },
    // 해가 순식간에 지고 하늘이 차갑게 식는다
    sunset(rng, W, H) {
      const leaves = Array.from({ length: 60 }, () => ({ x: rng(), y: rng(), v: 0.5 + rng(), r: rng() * TAU, ph: rng() * TAU }));
      return (g, W, H, k, t, dt, L) => {
        const u = sm(0.05, 0.6, k);
        const c = (a, b) => `rgb(${a.map((v, i) => Math.round(U.lerp(v, b[i], u))).join(',')})`;
        sky(g, W, H, [[0, c([60, 110, 190], [8, 10, 22])], [0.6, c([255, 170, 90], [30, 34, 60])], [0.7, c([255, 120, 60], [40, 40, 60])], [0.701, '#0a0b12'], [1, '#05060a']]);
        const hz = H * 0.7, sr = Math.min(W, H) * 0.1, sy = U.lerp(H * 0.35, hz + sr * 1.4, u);
        g.save(); g.beginPath(); g.rect(0, 0, W, hz); g.clip();
        U.glow(g, W / 2, sy, sr * 4, `rgba(255,140,80,${0.4 * (1 - u)})`); g.fillStyle = '#ffd7a0'; U.dot(g, W / 2, sy, sr);
        g.restore();
        // 찬 바람에 날리는 마른 잎
        const a = sm(0.3, 0.5, k);
        for (const l of leaves) {
          l.x += dt * 0.12 * l.v; l.y += dt * 0.08 * l.v; l.r += dt * 3;
          if (l.x > 1.05) l.x -= 1.1; if (l.y > 1.05) l.y -= 1.1;
          g.save(); g.translate(l.x * W, l.y * H); g.rotate(l.r); g.fillStyle = `rgba(150,110,80,${0.7 * a})`;
          g.beginPath(); g.ellipse(0, 0, 5, 2.2, 0, 0, TAU); g.fill(); g.restore();
        }
      };
    },
  };

  /* ─────────────── 논조가 불분명한 큰 뉴스 ─────────────── */
  const NOTICE = {
    comet(rng, W, H) {
      const st = stars(rng, 200);
      return (g, W, H, k, t, dt, L) => {
        sky(g, W, H, [[0, '#04060e'], [1, '#0d1426']]);
        g.fillStyle = '#fff'; for (const s of st) { g.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(t + s.ph)); g.fillRect(s.x * W, s.y * H, s.r, s.r); } g.globalAlpha = 1;
        const u = sm(0.05, 0.9, k), x = U.lerp(-0.2, 1.2, u) * W, y = H * (0.25 + 0.25 * u);
        const gr = g.createLinearGradient(x, y, x - W * 0.45, y - H * 0.12); gr.addColorStop(0, 'rgba(200,240,255,.8)'); gr.addColorStop(1, 'rgba(120,180,255,0)');
        g.strokeStyle = gr; g.lineWidth = 10; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x - W * 0.45, y - H * 0.12); g.stroke();
        U.glow(g, x, y, 50, 'rgba(200,240,255,.6)'); g.fillStyle = '#fff'; U.dot(g, x, y, 5);
      };
    },
  };

  M.EVENT_SCENES = { up: UP, down: DOWN, notice: NOTICE };
  M.EVENT_NAMES = {
    rocket: '로켓 발사', fireworks: '불꽃놀이', lanterns: '풍등', sunrise: '해돋이', bloom: '꽃이 핌', balloons: '열기구', surge: '치솟는 그래프',
    meteors: '유성 추락', storm: '폭풍우', crack: '유리 깨짐', vortex: '소용돌이', plunge: '곤두박질 그래프', sunset: '해넘이', comet: '혜성',
  };

  // 재생기 — 30초(앞 1.5초 스며들고 뒤 3초 사라짐). 최근에 나온 장면은 피한다
  M.eventPlayer = (seed = 1) => {
    const rng = U.rng(seed), recent = [];
    // 장면은 따로 그린 뒤 통째로 겹친다(장면 안에서 투명도를 바꿔도 스며들기 · 사라지기가 깨지지 않게)
    const oc = document.createElement('canvas'), og = oc.getContext('2d');
    let cur = null;
    return {
      get active() { return !!cur; },
      get name() { return cur ? cur.name : null; },
      play(kind, level = 1, t = 0, force = null) {
        const lib = M.EVENT_SCENES[kind] || NOTICE, names = Object.keys(lib);
        let name = force && lib[force] ? force : null;
        if (!name) { const pool = names.filter((n) => !recent.includes(n)); name = (pool.length ? pool : names)[Math.floor(rng() * (pool.length || names.length))]; }
        recent.push(name); if (recent.length > 3) recent.shift();
        cur = { name, kind, level, start: t, dur: 30, ending: -1, draw: null };
        return name;
      },
      stop(t) { if (cur && cur.ending < 0) cur.ending = t; },
      // 끝났으면 false 를 돌려준다
      draw(g, W, H, t, dt) {
        if (!cur) return false;
        if (!cur.draw) cur.draw = (M.EVENT_SCENES[cur.kind] || NOTICE)[cur.name](U.rng((seed + cur.start * 1000) >>> 0), W, H);
        const el = t - cur.start, k = U.clamp(el / cur.dur, 0, 1);
        let env = sm(0, 1.5, el) * (1 - sm(cur.dur - 3, cur.dur, el));
        if (cur.ending >= 0) env *= 1 - sm(0, 0.8, t - cur.ending);
        if (k >= 1 || (cur.ending >= 0 && t - cur.ending > 0.8)) { cur = null; return false; }
        const dpr = g.getTransform().a || 1, pw = Math.round(W * dpr), ph = Math.round(H * dpr);
        if (oc.width !== pw || oc.height !== ph) { oc.width = pw; oc.height = ph; }
        og.setTransform(1, 0, 0, 1, 0, 0); og.globalAlpha = 1; og.globalCompositeOperation = 'source-over'; og.clearRect(0, 0, pw, ph);
        og.setTransform(dpr, 0, 0, dpr, 0, 0);
        cur.draw(og, W, H, k, t, dt, cur.level);
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = env; g.drawImage(oc, 0, 0); g.restore();
        return true;
      },
    };
  };
})();
