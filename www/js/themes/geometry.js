/* 기하 무늬 — 정해진 주제에 없는 낱말이면 그 글자로 무늬·색을 뽑는다. 밝게 그린 만큼이 지나온 삶.
   무늬 일곱 가지가 몇 분마다 천천히 겹쳐 바뀌고, 무늬 안의 비율·색도 느린 잡음으로 계속 흘러서 같은 꼴이 되풀이되지 않는다. */
(function () {
  'use strict';
  const M = window.M, U = M.util, TAU = U.TAU;
  const GOLD = Math.PI * (3 - Math.sqrt(5));

  // 낱말 → 색(hue). 없으면 글자 해시로
  const HUES = {
    사랑: 345, 연애: 345, 결혼: 350, 커피: 28, 차: 95, 돈: 45, 부자: 45, 투자: 45, 코인: 45, 주식: 45, 가족: 22, 아이: 30, 엄마: 18, 아빠: 205,
    일: 210, 회사: 210, 꿈: 270, 책: 35, 공부: 200, 여행: 185, 음악: 300, 노래: 300, 운동: 8, 건강: 150, 바람: 190, 불: 15, 빛: 50,
    골프: 110, 기도: 260, 행복: 48, 감사: 40, love: 345, coffee: 28, money: 45, family: 22, work: 210, dream: 270, music: 300,
  };
  // 낱말 → 처음 무늬
  const MODES = {
    음악: 'lissa3d', 노래: 'lissa3d', 소리: 'lissa3d', 리듬: 'harmono', 춤: 'harmono', music: 'lissa3d',
    사랑: 'rose', 결혼: 'rose', 기도: 'spiro', love: 'rose',
    가족: 'phyllo', 씨앗: 'phyllo', 해바라기: 'phyllo', 기억: 'moire', 아이: 'phyllo',
    일: 'rings', 회사: 'rings', 돈: 'rings', 투자: 'rings', 코인: 'rings', 주식: 'rings', work: 'rings',
  };
  const NAME = { harmono: '진자 무늬', spiro: '나선 꽃 무늬', rose: '장미 곡선', rings: '겹 도형', phyllo: '씨앗 배열', moire: '물결 간섭', lissa3d: '매듭 곡선' };
  const ALL = Object.keys(NAME);

  // 아이콘으로 고른 무늬('@rose' 등) — 그 무늬만, 무늬마다 어울리는 색. '@mix' 는 글자로 넣은 것처럼 돌아가며
  const ICON_HUE = { harmono: 165, spiro: 275, rose: 345, rings: 42, phyllo: 48, moire: 200, lissa3d: 305, mix: 25 };
  const pick = (text) => {
    const whole = M.normalize(text), tokens = M.tokens(text), seed = U.hash(whole || '무늬');
    const icon = whole.startsWith('@') ? whole.slice(1) : null;
    if (icon && ICON_HUE[icon] !== undefined) {
      return { hue: ICON_HUE[icon], mode: NAME[icon] ? icon : ALL[(seed >>> 9) % ALL.length], only: !!NAME[icon] };
    }
    const hit = (dict) => { for (const k in dict) if (M.keywordHit(k, whole, tokens)) return dict[k]; return null; };
    return { hue: hit(HUES) ?? seed % 360, mode: hit(MODES) ?? ALL[(seed >>> 9) % ALL.length], only: false };
  };

  // 곡선 점 목록 그리기: 앞 p 만큼은 밝게(색이 흐르며), 나머지는 희미하게. 진행 머리 위치를 돌려준다
  function drawCurve(g, pts, p, hue, hue2, a, z = null) {
    const n = pts.length - 1, k = Math.max(0, Math.min(n, Math.floor(n * p)));
    g.lineWidth = 1; g.strokeStyle = U.hsl(hue, 30, 78, 0.14 * a);
    g.beginPath(); for (let i = k; i <= n; i++) i === k ? g.moveTo(pts[i][0], pts[i][1]) : g.lineTo(pts[i][0], pts[i][1]); g.stroke();
    g.lineCap = 'round';
    const step = 36;
    for (let i0 = 0; i0 < k; i0 += step) {
      const i1 = Math.min(k, i0 + step), u = i0 / n, depth = z ? 0.45 + 0.55 * z[i0] : 1;
      g.lineWidth = 1.1 + 0.9 * depth;
      g.strokeStyle = U.hsl(U.lerp(hue, hue2, u), 72, 64 + 10 * depth, (0.45 + 0.5 * depth) * a);
      g.beginPath(); for (let i = i0; i <= i1; i++) i === i0 ? g.moveTo(pts[i][0], pts[i][1]) : g.lineTo(pts[i][0], pts[i][1]); g.stroke();
    }
    return pts[k];
  }

  // 겹 도형용 초공식(Gielis superformula) — m·n 값이 흐르면 별·꽃·둥근 다각형 사이를 오간다
  const superR = (phi, m, n1, n2, n3) => {
    const a = Math.abs(Math.cos((m * phi) / 4)) ** n2, b = Math.abs(Math.sin((m * phi) / 4)) ** n3;
    return (a + b) ** (-1 / n1);
  };

  M.registerTheme({
    id: 'geometry', name: '기하 무늬', keywords: null,
    story: '이 낱말에서 뽑은 무늬예요. 밝게 그린 만큼이 지나온 삶이고, 무늬는 몇 분마다 천천히 다른 꼴로 바뀌어요.',
    describe: (text) => NAME[pick(text).mode],
    create(env) {
      const { hue: baseHue, mode, only } = pick(env.text);
      const rng = U.rng(env.seed ^ 0x9e3779b9), d = U.drift(env.seed, 12);
      // 무늬 순서: 낱말이 고른 것부터, 나머지는 씨앗으로 섞는다
      const rest = ALL.filter((m) => m !== mode);
      for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
      const order = only ? [mode] : [mode, ...rest];
      // 무늬마다 정수 비율 바탕(낱말마다 다르다)
      // 보기 좋은 비율만 모아 두고 고른다(아무 정수나 쓰면 엉키거나 한 줄로 밋밋해진다)
      const HARM = [[1, 1], [1, 2], [2, 3], [3, 4], [1, 3], [3, 2], [2, 1]];
      const KNOT = [[2, 3, 5], [3, 4, 7], [2, 5, 7], [3, 5, 7], [1, 4, 5], [3, 2, 7], [4, 5, 9]];
      const base = {
        h: HARM[Math.floor(rng() * HARM.length)], lis: KNOT[Math.floor(rng() * KNOT.length)],
        rose: 2 + Math.floor(rng() * 5), sides: 3 + Math.floor(rng() * 5),
      };
      let W = 0, H = 0, idx = 0;
      // 무늬 일정표: 칸마다 110~260초, 끝 9초 동안 다음 무늬와 겹친다. 시각만으로 지금 무늬가 정해진다(프레임이 끊겨도 안 꼬임)
      const FADE = 9, slots = [];
      for (let s = 0, k = 0; k < 400; k++) { const len = 110 + rng() * 150; slots.push([s, len]); s += len; }
      const total = slots[slots.length - 1][0] + slots[slots.length - 1][1];
      const at = (t) => {
        const tt = ((t % total) + total) % total;
        let lo = 0, hi = slots.length - 1;
        while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (slots[mid][0] <= tt) lo = mid; else hi = mid - 1; }
        const [s, len] = slots[lo], f = U.clamp((tt - s - (len - FADE)) / FADE, 0, 1);
        return { i: lo % order.length, f };
      };

      const fam = {
        // 하모노그래프 — 축마다 진자 하나(+작은 보조 진자). 바깥(태어남)에서 안으로 감겨 들어간다.
        // 정수 비율에서 아주 조금(0.004~0.02) 어긋나 선이 천천히 돌며 겹 무늬가 되고, 어긋남이 흐르며 꼴이 바뀐다
        harmono(g, R, t, p, h1, h2, a) {
          // 축 진자 둘 + 종이가 도는 회전 진자(작게). 한 주기에 점이 20개 넘게 들어가도록 K 를 잡는다(모자라면 톱니가 진다)
          const K = 3600, S = 220, dmp = 0.007 + d(2, t, 80) * 0.006, pts = [];
          const fx = base.h[0], fy = base.h[1] + 0.004 + d(3, t, 60) * 0.02, fr = fx * 1.004 + d(5, t, 120) * 0.01;
          const p1 = d(7, t, 70) * TAU, p2 = d(8, t, 90) * TAU, sub = 0.15 + d(4, t, 100) * 0.25;
          for (let i = 0; i <= K; i++) {
            const s = (S * i) / K, e = Math.exp(-dmp * s);
            pts.push([
              R * e * (Math.sin(fx * s + p1) * (1 - sub) + Math.sin(fr * s) * sub),
              R * e * (Math.sin(fy * s + p2) * (1 - sub) + Math.cos(fr * s) * sub),
            ]);
          }
          return drawCurve(g, pts, p, h1, h2, a);
        },
        // 나선 꽃(하이포트로코이드) — 작은 원 비율이 흐르며 꽃잎 수·모양이 바뀐다
        spiro(g, R, t, p, h1, h2, a) {
          const r = 0.22 + d(3, t, 90) * 0.5, dd = r * (0.6 + d(4, t, 70) * 0.9), turns = 9, K = 2600, sc = 1 - r + dd, pts = [];
          for (let i = 0; i <= K; i++) {
            const s = (TAU * turns * i) / K;
            pts.push([(R * ((1 - r) * Math.cos(s) + dd * Math.cos(((1 - r) / r) * s))) / sc, (R * ((1 - r) * Math.sin(s) - dd * Math.sin(((1 - r) / r) * s))) / sc]);
          }
          g.rotate(t * 0.01);
          return drawCurve(g, pts, p, h1, h2, a);
        },
        // 장미 곡선 r = cos(kθ) — k 가 정수 사이를 흐르면 꽃잎이 갈라지고 겹친다
        rose(g, R, t, p, h1, h2, a) {
          const k = base.rose + (d(3, t, 120) - 0.5) * 1.6, K = 2400, turns = 8, pw = 0.8 + d(4, t, 60), pts = [];
          for (let i = 0; i <= K; i++) {
            const s = (TAU * turns * i) / K, r = R * (0.15 + 0.85 * Math.abs(Math.cos(k * s)) ** pw);
            pts.push([r * Math.cos(s), r * Math.sin(s)]);
          }
          g.rotate(-t * 0.008);
          return drawCurve(g, pts, p, h1, h2, a);
        },
        // 겹 도형 — 안쪽(태어남)부터 바깥으로 켜진다. 도형 꼴(초공식)과 비틀림이 흐른다
        rings(g, R, t, p, h1, h2, a) {
          const N = 32, edge = p * N, m = base.sides + (d(3, t, 110) - 0.5) * 2.4;
          const n1 = 0.6 + d(4, t, 80) * 2.4, n23 = 0.6 + d(5, t, 95) * 1.8, twist = (d(6, t, 70) - 0.5) * 0.16;
          const shape = [];
          let mx = 0;
          for (let j = 0; j <= 120; j++) { const r = superR((TAU * j) / 120, m, n1, n23, n23); shape.push(r); mx = Math.max(mx, r); }
          let head = null;
          for (let i = 0; i < N; i++) {
            const sc = R * (0.07 + (0.93 * (i + 1)) / N), rot = i * twist + t * 0.02 * (i % 2 ? 1 : -1), lit = U.clamp(edge - i, 0, 1);
            g.strokeStyle = lit > 0 ? U.hsl(U.lerp(h1, h2, i / N), 70, 66, (0.25 + 0.65 * lit) * a) : U.hsl(h1, 25, 78, 0.1 * a);
            g.lineWidth = lit > 0 ? 1.4 : 1;
            g.beginPath();
            for (let j = 0; j <= 120; j++) {
              const phi = (TAU * j) / 120, r = (shape[j] / mx) * sc, x = r * Math.cos(phi + rot), y = r * Math.sin(phi + rot);
              j ? g.lineTo(x, y) : g.moveTo(x, y);
              if (j === 0 && i === Math.min(N - 1, Math.floor(edge))) head = [x, y];
            }
            g.stroke();
          }
          return head;
        },
        // 씨앗 배열 — 벌어짐 각이 황금각 둘레를 흐르면 나선 팔의 수가 바뀐다
        phyllo(g, R, t, p, h1, h2, a) {
          const count = 820, k = Math.floor(count * p), ang = GOLD + (d(3, t, 150) - 0.5) * 0.022;
          g.rotate(t * 0.01);
          g.fillStyle = U.hsl(h1, 25, 78, 0.13 * a); g.beginPath();
          for (let i = k; i < count; i++) {
            const r = R * Math.sqrt(i / count), th = i * ang, z = 0.8 + 1.5 * (i / count);
            g.moveTo(Math.cos(th) * r + z, Math.sin(th) * r); g.arc(Math.cos(th) * r, Math.sin(th) * r, z, 0, TAU);
          }
          g.fill();
          for (let i = 0; i < k; i++) {
            const r = R * Math.sqrt(i / count), th = i * ang;
            g.fillStyle = U.hsl(U.lerp(h1, h2, i / count), 72, 66, 0.9 * a);
            U.dot(g, Math.cos(th) * r, Math.sin(th) * r, 1.2 + 2.6 * (i / count));
          }
          const r = R * Math.sqrt(k / count);
          return [Math.cos(k * ang) * r, Math.sin(k * ang) * r];
        },
        // 물결 간섭 — 동심원 두 묶음의 중심이 천천히 떠돌며 무아레가 생긴다. 지나온 만큼의 원이 밝다
        moire(g, R, t, p, h1, h2, a) {
          const N = 30, off = R * 0.22 * d(4, t, 50), ang = d(3, t, 60) * TAU * 2;
          const c1 = [Math.cos(ang) * off, Math.sin(ang) * off], c2 = [-c1[0], -c1[1]];
          g.lineWidth = 1;
          for (let i = 1; i <= N; i++) {
            const r = (R * i) / N, lit = U.clamp(p * N - i + 1, 0, 1);
            g.strokeStyle = lit > 0 ? U.hsl(U.lerp(h1, h2, i / N), 70, 66, (0.3 + 0.6 * lit) * a) : U.hsl(h1, 25, 78, 0.12 * a);
            g.beginPath(); g.arc(c1[0], c1[1], r, 0, TAU); g.stroke();
            g.strokeStyle = U.hsl(h2, 40, 75, 0.12 * a);
            g.beginPath(); g.arc(c2[0], c2[1], r, 0, TAU); g.stroke();
          }
          const r = R * p, h = d(5, t, 30) * TAU;
          return [c1[0] + Math.cos(h) * r, c1[1] + Math.sin(h) * r];
        },
        // 3차원 매듭 곡선(리사주) — 실 여러 가닥을 조금씩 어긋나게 겹쳐 비단 띠처럼. 천천히 돌며 앞쪽은 굵고 밝게
        lissa3d(g, R, t, p, h1, h2, a) {
          const [fa, fb, fc] = base.lis, K = 1600, STR = 7, spread = 0.025 + d(6, t, 80) * 0.05;
          const ph = d(3, t, 90) * TAU, ry = t * 0.05 + d(4, t, 120) * 2, rx = 0.5 + (d(5, t, 100) - 0.5) * 1.2;
          const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
          let head = null;
          for (let k = STR - 1; k >= 0; k--) {
            const pts = [], z = [], o = (k - (STR - 1) / 2) * spread;
            for (let i = 0; i <= K; i++) {
              const s = (TAU * i) / K;
              let x = Math.sin(fa * s + ph + o), y = Math.sin(fb * s + o * 0.5), zz = Math.sin(fc * s + ph * 0.5);
              [x, zz] = [x * cy + zz * sy, -x * sy + zz * cy];
              [y, zz] = [y * cx - zz * sx, y * sx + zz * cx];
              const persp = 1 / (1.8 - zz * 0.5);
              pts.push([x * R * persp * 1.1, y * R * persp * 1.1]); z.push((zz + 1) / 2);
            }
            const edge = Math.abs(k - (STR - 1) / 2) / ((STR - 1) / 2);
            const hp = drawCurve(g, pts, p, h1 + k * 4, h2 + k * 4, a * (1 - 0.6 * edge), z);
            if (k === (STR - 1) / 2) head = hp;
          }
          return head;
        },
      };

      return {
        resize(w, h) { W = w; H = h; },
        draw(g, { t, p }) {
          const cx = W / 2, cy = H * 0.6, R = Math.min(W * 0.4, H * 0.25);
          let h1 = baseHue + (d(0, t, 140) - 0.5) * 70, h2 = h1 + 30 + d(1, t, 110) * 70;
          // 뉴스 특이점: 좋은 소식이면 금빛으로 데워지고 숨 쉬듯 부푼다, 나쁜 소식이면 청회색으로 식고 오그라들며 떤다
          const sg = env.sig || { level: 0, tone: 0 }, L = sg.level, good = sg.tone >= 0;
          let Rs = R, jx = 0, jy = 0;
          if (L > 0.01) {
            const target = good ? 40 : 212;
            const k = Math.min(1, L * 1.1);
            h1 = U.lerp(h1, target, k); h2 = U.lerp(h2, good ? 18 : 195, k);
            Rs = R * (good ? 1 + 0.07 * L * Math.sin(t * 2.4) + 0.04 * L : 1 - 0.1 * L);
            if (!good) { jx = (Math.random() - 0.5) * 5 * L; jy = (Math.random() - 0.5) * 3 * L; }
          }
          const bg = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.85);
          bg.addColorStop(0, U.hsl(h1, 38, 11)); bg.addColorStop(1, U.hsl(h1 + 20, 30, 3.5));
          g.fillStyle = bg; g.fillRect(0, 0, W, H);
          U.glow(g, cx, cy, R * 1.7, U.hsl(h2, 70, 50, 0.07));

          // 몇 분마다 다음 무늬로 겹쳐 바뀐다
          const now = at(t), f = now.f;
          idx = now.i;
          const layers = [[order[idx], 1 - f]];
          if (f > 0) layers.push([order[(idx + 1) % order.length], f]);
          for (const [name, a] of layers) {
            if (a <= 0.01) continue;
            g.save(); g.translate(cx + jx, cy + jy);
            const hp = fam[name](g, Rs, t, p, h1, h2, a);
            if (hp) { // 진행 머리 — 그 무늬의 회전을 그대로 따른다
              U.glow(g, hp[0], hp[1], 20, U.hsl(h2, 90, 75, (0.55 + 0.15 * Math.sin(t * 2)) * a));
              g.fillStyle = `rgba(255,255,255,${a})`; U.dot(g, hp[0], hp[1], 3.5);
            }
            g.restore();
          }
        },
        caption: () => `「${env.text}」에서 뽑은 ${NAME[order[idx]]} · 밝은 만큼이 지나온 삶`,
      };
    },
  });
})();
