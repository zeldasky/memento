/* 화면 보호기 그림 — 검은 화면 위를 천천히 떠도는 기하 상징. 남들 눈엔 무늬, 나에겐 "지금 내 나이"의 암시.
   나이테 · 10년 도형 · 별자리 · 인생의 달 · 숨 쉬는 꽃 · 해파리 · 민들레 홀씨 · 나선 은하 · 물방울 파문 · 반딧불 무리 · DNA 나선 · 촛불 · 생명의 꽃(각 장면 위 설명 참고).
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
  // 숨: 1분에 6번(10초) — 4초 들이쉬고, 0.5초 머물고, 5.5초 내쉰다. 0(다 내쉼) ~ 1(다 들이쉼)
  const BREATH = 10, IN = 4, HOLD = 0.5;
  const breath = (t) => {
    const u = ((t % BREATH) + BREATH) % BREATH, e = (k) => 0.5 - 0.5 * Math.cos(Math.PI * k);
    return u < IN ? e(u / IN) : u < IN + HOLD ? 1 : 1 - e((u - IN - HOLD) / (BREATH - IN - HOLD));
  };
  M.breath = breath;
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
          // 숨이 가운데(태어남)에서 바깥(올해)으로 물결처럼 번진다
          const r = R * Math.sqrt(i / L) * (1 + 0.07 * breath(t - (i / L) * 1.6)), lived = i <= years, last = i === years;
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
        // 도형마다 제 중심을 기준으로 숨 쉬듯 부풀었다 가라앉는다(도형마다 숨이 조금씩 어긋난다)
        trail.push(shapes.map((s, d) => {
          const k = 1 + 0.12 * (breath(t - d * 0.7) - 0.5), mx = s.reduce((a, v) => a + v.x, 0) / 4, my = s.reduce((a, v) => a + v.y, 0) / 4;
          return s.map((v) => [(mx + (v.x - mx) * k) * W, (my + (v.y - my) * k) * H]);
        }));
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
        const b = breath(t), mx0 = (x0 + x1) / 2, my0 = (y0 + y1) / 2, sc = (R / (Math.max(x1 - x0, y1 - y0) / 2 || 1)) * (1 + 0.06 * b), cs = Math.cos(t * 0.01), sn = Math.sin(t * 0.01);
        const P = (i) => { const u = (pts[i][0] - mx0) * sc, v = (pts[i][1] - my0) * sc; return [cx + u * cs - v * sn, cy + u * sn + v * cs]; };
        g.strokeStyle = 'rgba(170,200,255,.22)'; g.lineWidth = 0.8; g.beginPath();
        for (let i = 0; i < Math.min(years, L); i++) { const [px, py] = P(i); i ? g.lineTo(px, py) : g.moveTo(px, py); }
        g.stroke();
        for (let i = 0; i < Math.min(L, pts.length); i++) {
          const [px, py] = P(i), lived = i < years, last = i === years - 1;
          if (last) { U.glow(g, px, py, 10 + 10 * b, `rgba(200,225,255,${0.3 + 0.35 * b})`); g.fillStyle = '#eef4ff'; U.dot(g, px, py, 2.2); continue; }
          g.fillStyle = lived ? `rgba(200,220,255,${(0.35 + 0.3 * pts[i][2]) * (0.75 + 0.35 * b)})` : 'rgba(200,220,255,.08)';
          U.dot(g, px, py, lived ? 1.1 + pts[i][2] * 0.8 : 0.8);
        }
      };
    },
    // 인생의 달: 태어날 때 초승, 인생 한가운데 보름, 끝에 그믐 — 달 나이가 곧 내 나이
    moon(rng) {
      const pos = drifter(rng, 18);
      return (g, W, H, t, dt, c) => {
        const b = breath(t), r = Math.min(W, H) * 0.11 * (1 + 0.04 * b), [x, y] = pos(W, H, dt, r * 1.7), f = U.clamp(c.p, 0.02, 0.98);
        U.glow(g, x, y, r * (2.4 + 1.2 * b), `rgba(220,226,255,${(0.03 + 0.1 * Math.sin(Math.PI * f)) * (0.6 + 0.8 * b)})`); // 달무리가 숨을 따라
        g.fillStyle = 'rgba(40,46,64,.55)'; U.dot(g, x, y, r);
        const k = Math.cos(TAU * f), waxing = f < 0.5;
        g.beginPath(); g.arc(x, y, r, -Math.PI / 2, Math.PI / 2, !waxing);
        g.ellipse(x, y, r * Math.abs(k), r, 0, Math.PI / 2, -Math.PI / 2, waxing ? k > 0 : k <= 0); g.closePath();
        const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); gr.addColorStop(0, '#d9d4c4'); gr.addColorStop(1, '#a9a393');
        g.fillStyle = gr; g.fill();
      };
    },
    // 해파리: 촉수가 살아온 해만큼. 날숨에 갓이 오므라들며 위로 헤엄치고, 화면 위로 나가면 아래에서 다시 올라온다
    jelly(rng) {
      let x = 0.3 + rng() * 0.4, y = 0.35 + rng() * 0.5, sway = rng() * TAU; // 처음엔 화면 안에서
      const tent = Array.from({ length: 120 }, () => ({ ph: rng() * TAU, l: 0.7 + rng() * 0.6 }));
      return (g, W, H, t, dt, c) => {
        const b = breath(t), push = Math.max(0, -Math.sin((TAU * t) / 10)) ; // 날숨 때 밀어 올린다
        const R = Math.min(W, H) * 0.12, n = Math.max(3, Math.floor(c.age));
        y -= (0.004 + 0.018 * push) * dt * (H / Math.max(W, H)) * 2.2;
        sway += dt * 0.15; x += Math.sin(sway) * 0.004 * dt;
        if (y < -0.25) { y = 1.15; x = 0.2 + rng() * 0.6; }
        const cx = x * W, cy = y * H, rw = R * (1.05 - 0.18 * (1 - b)), rh = R * (0.75 + 0.15 * (1 - b));
        U.glow(g, cx, cy, R * 2.4, `rgba(140,200,255,${0.05 + 0.06 * b})`);
        // 촉수
        for (let i = 0; i < n; i++) {
          const tp = tent[i % tent.length], u = (i + 0.5) / n, sx = cx + (u - 0.5) * rw * 1.6, len = R * 2.6 * tp.l;
          g.strokeStyle = `hsla(${190 + u * 120},80%,72%,${0.16 + 0.12 * b})`; g.lineWidth = 0.8;
          g.beginPath(); g.moveTo(sx, cy + rh * 0.15);
          for (let k = 1; k <= 12; k++) { const f = k / 12; g.lineTo(sx + Math.sin(t * 1.3 + tp.ph + f * 4) * R * 0.18 * f, cy + rh * 0.15 + len * f); }
          g.stroke();
        }
        // 갓
        const gr = g.createRadialGradient(cx, cy - rh * 0.3, R * 0.1, cx, cy, rw);
        gr.addColorStop(0, `rgba(210,235,255,${0.35 + 0.2 * b})`); gr.addColorStop(1, 'rgba(120,170,255,.06)');
        g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, rw, rh, 0, Math.PI, TAU); g.quadraticCurveTo(cx, cy + rh * 0.35, cx - rw, cy); g.fill();
        g.strokeStyle = `rgba(200,230,255,${0.35 + 0.25 * b})`; g.lineWidth = 1; g.stroke();
      };
    },
    // 민들레 홀씨: 송이에는 남은 해만큼, 지나온 해만큼의 홀씨는 이미 날아가 화면을 떠돈다. 숨마다 바람이 분다
    dandelion(rng) {
      const pos = drifter(rng, 16), dirs = Array.from({ length: 150 }, (_, i) => ({ a: i * 2.39996, l: 0.85 + rng() * 0.3 }));
      const flying = Array.from({ length: 150 }, () => ({ x: rng(), y: rng(), vx: 0.01 + rng() * 0.02, vy: -0.004 - rng() * 0.01, ph: rng() * TAU, r: rng() * TAU }));
      return (g, W, H, t, dt, c) => {
        const R = Math.min(W, H) * 0.14, [cx, cy] = pos(W, H, dt, R * 1.6), b = breath(t), years = Math.floor(c.age), L = Math.max(years + 1, Math.round(c.lifespan));
        const left = Math.max(0, L - years), wind = 0.5 + b;
        // 날아간 홀씨(지나온 해)
        for (let i = 0; i < Math.min(years, flying.length); i++) {
          const f = flying[i];
          f.x += f.vx * wind * dt; f.y += (f.vy + Math.sin(t * 0.5 + f.ph) * 0.006) * dt; f.r += dt * 0.3;
          if (f.x > 1.05) f.x = -0.05; if (f.y < -0.05) f.y = 1.05;
          const x = f.x * W, y = f.y * H, s = 5;
          g.strokeStyle = 'rgba(235,235,225,.28)'; g.lineWidth = 0.7; g.beginPath();
          g.moveTo(x, y); g.lineTo(x, y + s * 1.6);
          for (let k = 0; k < 6; k++) { const a = f.r + (TAU * k) / 6; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * s * 0.7, y - Math.abs(Math.sin(a)) * s * 0.6); }
          g.stroke();
        }
        // 줄기와 송이(남은 해만큼의 홀씨)
        const sw = Math.sin(t * 0.6) * 0.05 * wind;
        g.strokeStyle = 'rgba(150,180,140,.35)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx, cy + R * 2); g.quadraticCurveTo(cx + R * 0.1, cy + R, cx + Math.sin(sw) * R, cy); g.stroke();
        const hx = cx + Math.sin(sw) * R;
        g.lineWidth = 0.7;
        for (let i = 0; i < Math.min(left, dirs.length); i++) {
          const d = dirs[i], a = d.a + sw, rr = R * d.l * (0.92 + 0.08 * b), x = hx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
          g.strokeStyle = `rgba(240,240,230,${0.18 + 0.14 * b})`; g.beginPath(); g.moveTo(hx, cy); g.lineTo(x, y); g.stroke();
          g.fillStyle = `rgba(250,250,240,${0.35 + 0.3 * b})`; U.dot(g, x, y, 1.2);
        }
        g.fillStyle = 'rgba(200,190,150,.6)'; U.dot(g, hx, cy, 3);
      };
    },
    // 나선 은하: 별이 한평생 수만큼 — 지나온 해는 밝고 남은 해는 희미하다. 천천히 돌고 중심이 숨 쉰다
    galaxy(rng) {
      const pos = drifter(rng, 18), st = Array.from({ length: 160 }, (_, i) => ({ arm: i % 2, u: rng(), off: (rng() - 0.5) * 0.14, s: rng() }));
      // 팔을 보이게 하는 희미한 별먼지(나이와 무관한 배경)
      const dust = Array.from({ length: 520 }, (_, i) => ({ arm: i % 2, u: Math.sqrt(rng()), off: (rng() - 0.5) * 0.16 * (0.4 + rng()), s: rng() }));
      return (g, W, H, t, dt, c) => {
        const R = Math.min(W, H) * 0.34, [cx, cy] = pos(W, H, dt, R * 1.05), b = breath(t), years = Math.floor(c.age), L = Math.min(st.length, Math.max(years + 1, Math.round(c.lifespan)));
        U.glow(g, cx, cy, R * (0.35 + 0.25 * b), `rgba(255,220,180,${0.18 + 0.15 * b})`);
        g.fillStyle = `rgba(190,200,255,${0.1 + 0.06 * b})`;
        for (const s of dust) {
          const r = R * (0.08 + 0.92 * s.u), a = s.arm * Math.PI + s.u * 6.5 + s.off + t * 0.02 / (0.3 + s.u);
          g.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.55, 1, 1);
        }
        for (let i = 0; i < L; i++) {
          const s = st[i], r = R * (0.12 + 0.88 * s.u), a = s.arm * Math.PI + s.u * 6.5 + s.off + t * 0.02 / (0.3 + s.u);
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.55;
          const lived = i < years;
          g.fillStyle = lived ? `hsla(${210 + s.s * 60},70%,${75 + 15 * b}%,${0.45 + 0.4 * s.s})` : 'rgba(200,210,255,.07)';
          U.dot(g, x, y, lived ? 1.2 + s.s * 1.8 : 1);
          if (i === years - 1) U.glow(g, x, y, 10 + 6 * b, `rgba(220,230,255,${0.4 + 0.3 * b})`);
        }
      };
    },
    // 물방울 파문: 날숨마다 물방울이 떨어지고, 파문 고리 수는 지나온 10년 수만큼
    ripples(rng) {
      const pos = drifter(rng, 14), drops = [];
      let lastCycle = -1;
      return (g, W, H, t, dt, c) => {
        const R = Math.min(W, H) * 0.3, [cx, cy] = pos(W, H, dt, R * 0.6), n = Math.max(1, Math.ceil(c.age / 10));
        const cyc = Math.floor((t - 4.5) / 10);
        if (cyc !== lastCycle) { lastCycle = cyc; drops.push({ x: cx, y: cy, t0: t }); if (drops.length > 3) drops.shift(); }
        for (const d of drops) {
          const age = t - d.t0;
          if (age < 0.4) { g.fillStyle = `rgba(220,240,255,${0.7 * (1 - age / 0.4)})`; U.dot(g, d.x, d.y - 30 * (1 - age / 0.4), 2.2); }
          for (let k = 0; k < n; k++) {
            const a = age - k * 0.55; if (a <= 0) continue;
            const r = a * R * 0.16, fade = Math.max(0, 1 - r / R);
            const cur = k === n - 1 ? 0.35 + 0.65 * ((c.age % 10) / 10) : 1;
            g.strokeStyle = `rgba(160,210,255,${0.45 * fade * cur})`; g.lineWidth = 1.2;
            g.beginPath(); g.ellipse(d.x, d.y, r, r * 0.42, 0, 0, TAU); g.stroke();
          }
        }
      };
    },
    // 반딧불 무리: 반딧불 수가 남은 해만큼 — 아직 켜질 빛. 무리 지어 흐르며 숨에 맞춰 깜박인다
    fireflies(rng) {
      const pos = drifter(rng, 22), fl = Array.from({ length: 120 }, () => ({ ox: (rng() - 0.5) * 2, oy: (rng() - 0.5) * 2, ph: rng() * TAU, sp: 0.3 + rng() * 0.6, lag: rng() * 2 }));
      return (g, W, H, t, dt, c) => {
        const R = Math.min(W, H) * 0.22, [cx, cy] = pos(W, H, dt, R * 1.2), left = Math.max(1, Math.round(c.lifespan - c.age));
        for (let i = 0; i < Math.min(left, fl.length); i++) {
          const f = fl[i], b = breath(t - f.lag);
          const x = cx + (f.ox + Math.sin(t * f.sp + f.ph) * 0.35) * R, y = cy + (f.oy + Math.cos(t * f.sp * 0.8 + f.ph) * 0.35) * R * 0.7;
          U.glow(g, x, y, 7 + 6 * b, `rgba(214,255,120,${0.12 + 0.3 * b})`);
          g.fillStyle = `rgba(240,255,190,${0.35 + 0.6 * b})`; U.dot(g, x, y, 1.3);
        }
      };
    },
    // DNA 나선: 가로대가 한평생 수만큼, 지나온 해만 색이 든다. 3차원으로 돌며 숨 쉬듯 늘었다 줄어든다
    dna(rng) {
      const pos = drifter(rng, 18);
      return (g, W, H, t, dt, c) => {
        const b = breath(t), Hh = Math.min(W, H) * 0.62 * (0.94 + 0.08 * b), Rw = Math.min(W, H) * 0.09, [cx, cy] = pos(W, H, dt, Hh * 0.55);
        const years = Math.floor(c.age), L = Math.max(years + 1, Math.round(c.lifespan)), turns = 3.2, rot = t * 0.35;
        const P = (k, side) => { const u = k / (L - 1), a = u * turns * TAU + rot + side * Math.PI; return [cx + Math.cos(a) * Rw, cy - Hh / 2 + u * Hh, Math.sin(a)]; };
        for (let k = 0; k < L; k++) {
          const [x1, y1, z1] = P(k, 0), [x2, y2] = P(k, 1), lived = k < years;
          g.strokeStyle = lived ? `hsla(${decadeHue(Math.floor(k / 10))},65%,65%,${0.25 + 0.3 * (z1 + 1) / 2})` : 'rgba(200,210,230,.05)';
          g.lineWidth = 1; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
        }
        for (const side of [0, 1]) {
          g.strokeStyle = 'rgba(220,230,255,.35)'; g.lineWidth = 1.4; g.beginPath();
          for (let k = 0; k < L; k++) { const [x, y] = P(k, side); k ? g.lineTo(x, y) : g.moveTo(x, y); }
          g.stroke();
        }
        const [hx, hy] = P(Math.max(0, years - 1), 0);
        U.glow(g, hx, hy, 8 + 6 * b, `rgba(255,240,200,${0.35 + 0.3 * b})`);
      };
    },
    // 촛불: 초의 길이가 남은 생만큼. 불꽃이 숨에 맞춰 일렁인다
    candle(rng) {
      const pos = drifter(rng, 14);
      return (g, W, H, t, dt, c) => {
        const S = Math.min(W, H), full = S * 0.36, h = Math.max(S * 0.02, full * (1 - c.p)), w = S * 0.07, b = breath(t);
        const [cx, cy] = pos(W, H, dt, full * 0.6);
        const base = cy + full * 0.5, top = base - h;
        const flick = Math.sin(t * 7) * 0.08 + Math.sin(t * 11.3) * 0.05;
        U.glow(g, cx, top - w * 0.9, S * (0.18 + 0.08 * b), `rgba(255,170,80,${0.12 + 0.1 * b})`);
        const body = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
        body.addColorStop(0, 'rgba(120,95,80,.5)'); body.addColorStop(0.5, 'rgba(210,190,170,.55)'); body.addColorStop(1, 'rgba(120,95,80,.5)');
        g.fillStyle = body; g.fillRect(cx - w / 2, top, w, h);
        g.strokeStyle = 'rgba(60,40,30,.8)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx, top); g.lineTo(cx, top - w * 0.25); g.stroke();
        const fh = w * (1.1 + 0.45 * b) * (1 + flick), fw = w * 0.32;
        const fg = g.createRadialGradient(cx, top - fh * 0.35, 1, cx, top - fh * 0.4, fh);
        fg.addColorStop(0, 'rgba(255,250,230,.95)'); fg.addColorStop(0.35, 'rgba(255,200,110,.75)'); fg.addColorStop(1, 'rgba(255,120,40,0)');
        g.fillStyle = fg; g.beginPath(); g.moveTo(cx, top - w * 0.15 - fh);
        g.quadraticCurveTo(cx + fw * (1 + flick), top - fh * 0.35, cx, top - w * 0.1);
        g.quadraticCurveTo(cx - fw * (1 - flick), top - fh * 0.35, cx, top - w * 0.15 - fh); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; g.strokeRect(cx - w / 2, base - full, w, full - h); // 이미 탄 만큼은 아주 희미한 윤곽
      };
    },
    // 생명의 꽃: 겹친 원의 고리가 지나온 10년마다 하나씩. 돌면서 부풀었다 가라앉는다
    flowerOfLife(rng) {
      const pos = drifter(rng, 18), cells = [[0, 0, 0]];
      // 육각 격자 위 원 중심 — 고리(링) 번호 매기기
      for (let ring = 1; ring <= 9; ring++) {
        for (let side = 0; side < 6; side++) {
          for (let k = 0; k < ring; k++) {
            const a1 = (Math.PI / 3) * side, a2 = (Math.PI / 3) * (side + 2);
            cells.push([ring * Math.cos(a1) + k * Math.cos(a2), ring * Math.sin(a1) + k * Math.sin(a2), ring]);
          }
        }
      }
      return (g, W, H, t, dt, c) => {
        const b = breath(t), n = Math.max(1, Math.ceil(c.age / 10)), Rn = Math.max(n, Math.ceil(c.lifespan / 10));
        const r = (Math.min(W, H) * 0.3) / (Rn + 0.5) * (0.95 + 0.08 * b), [cx, cy] = pos(W, H, dt, r * (Rn + 1.2));
        g.save(); g.translate(cx, cy); g.rotate(t * 0.01);
        for (const [x, y, ring] of cells) {
          if (ring >= Rn) continue;
          const lived = ring < n, cur = ring === n - 1;
          const a = lived ? (cur ? 0.15 + 0.4 * ((c.age % 10) / 10) : 0.35) * (0.7 + 0.5 * b) : 0.05;
          g.strokeStyle = lived ? U.hsl(decadeHue(ring), 55, 70, a) : `rgba(220,220,240,${a})`; g.lineWidth = 1;
          g.beginPath(); g.arc(x * r, y * r, r, 0, TAU); g.stroke();
        }
        g.restore();
      };
    },
    // 숨 쉬는 꽃: 지나온 10년마다 꽃잎 한 겹(지금 10년대 겹은 그만큼만). 들숨에 꽃잎이 벌어지고 날숨에 오므라든다
    lotus(rng) {
      const pos = drifter(rng, 20);
      return (g, W, H, t, dt, c) => {
        const R = Math.min(W, H) * 0.26, [x, y] = pos(W, H, dt, R * 1.3), n = Math.max(1, Math.ceil(c.age / 10)), b = breath(t);
        g.save(); g.translate(x, y); g.rotate(t * 0.008);
        U.glow(g, 0, 0, R * (0.8 + 0.6 * b), `rgba(255,200,170,${0.04 + 0.08 * b})`);
        for (let d = n - 1; d >= 0; d--) {
          const cur = d === n - 1, lit = cur ? 0.3 + 0.7 * ((c.age % 10) / 10) : 1;
          const petals = 8, lay = (d + 1) / Math.max(n, 5);                        // 바깥 겹일수록 큰 꽃잎
          const open = 0.35 + 0.65 * breath(t - d * 0.35);                         // 겹마다 숨이 조금씩 늦게
          const len = R * (0.32 + 0.68 * lay) * (0.8 + 0.25 * open), wid = len * (0.18 + 0.2 * open);
          for (let i = 0; i < petals; i++) {
            const a = (TAU * i) / petals + d * (Math.PI / petals);
            g.save(); g.rotate(a);
            g.beginPath(); g.moveTo(0, 0);
            g.bezierCurveTo(wid, -len * 0.35, wid * 0.8, -len * 0.85, 0, -len);
            g.bezierCurveTo(-wid * 0.8, -len * 0.85, -wid, -len * 0.35, 0, 0);
            g.strokeStyle = U.hsl(decadeHue(d), 60, 68, (0.25 + 0.45 * open) * lit);
            g.lineWidth = 1.1; g.stroke();
            g.fillStyle = U.hsl(decadeHue(d), 60, 55, 0.05 * lit * (0.5 + open)); g.fill();
            g.restore();
          }
        }
        g.fillStyle = `rgba(255,236,200,${0.5 + 0.4 * b})`; U.dot(g, 0, 0, 2 + 1.5 * b);
        g.restore();
      };
    },
  };
  M.SAVER_SCENES = SCENES;
  M.SAVER_NAMES = { mix: '돌아가며', lotus: '숨 쉬는 꽃', jelly: '해파리', dandelion: '민들레 홀씨', galaxy: '나선 은하', ripples: '물방울 파문', fireflies: '반딧불 무리', dna: 'DNA 나선', candle: '촛불', flowerOfLife: '생명의 꽃', rings: '나이테', decades: '10년 도형', stars: '별자리', moon: '인생의 달', theme: '주제 그림' };

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
          if (since > 240) { since = 0; prev = order[idx]; idx = (idx + 1) % order.length; name = order[idx]; fade = 0; }
        }
        fade = Math.min(1, fade + dt / 3);
        if (prev && fade < 1) { g.save(); g.globalAlpha = 1 - fade; get(prev)(g, W, H, t, dt, c); g.restore(); }
        g.save(); g.globalAlpha = fade; get(name)(g, W, H, t, dt, c); g.restore();
      },
    };
  };
})();
