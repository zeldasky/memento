/* 기하 무늬 — 정해진 주제에 없는 낱말이면 그 글자로 무늬·색을 뽑는다. 밝게 그린 만큼이 지나온 삶 */
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
  // 낱말 → 무늬
  const MODES = {
    음악: 'lissajous', 노래: 'lissajous', 소리: 'lissajous', 리듬: 'lissajous', 춤: 'lissajous', music: 'lissajous',
    사랑: 'spiro', 결혼: 'spiro', 기도: 'spiro', love: 'spiro',
    가족: 'phyllo', 씨앗: 'phyllo', 해바라기: 'phyllo', 기억: 'phyllo', 아이: 'phyllo',
    일: 'rings', 회사: 'rings', 돈: 'rings', 투자: 'rings', 코인: 'rings', 주식: 'rings', work: 'rings',
  };
  const MODE_NAME = { spiro: '나선 꽃 무늬', lissajous: '물결 무늬', rings: '겹 다각형', phyllo: '씨앗 배열' };
  const ORDER = ['spiro', 'lissajous', 'rings', 'phyllo'];

  const pick = (text) => {
    const whole = M.normalize(text), tokens = M.tokens(text), seed = U.hash(whole || '무늬');
    const hit = (dict) => { for (const k in dict) if (M.keywordHit(k, whole, tokens)) return dict[k]; return null; };
    const hue = hit(HUES) ?? seed % 360;
    const mode = hit(MODES) ?? ORDER[(seed >>> 9) % ORDER.length];
    return { hue, mode };
  };
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);

  M.registerTheme({
    id: 'geometry', name: '기하 무늬', keywords: null,
    story: '이 낱말에서 뽑은 무늬예요. 밝게 그린 만큼이 지나온 삶이에요.',
    describe: (text) => MODE_NAME[pick(text).mode],
    create(env) {
      const { hue, mode } = pick(env.text);
      const rng = U.rng(env.seed ^ 0x9e3779b9);
      let W = 0, H = 0, curve = null;
      // 곡선형 무늬는 점 목록을 한 번만 만든다(물결은 매 프레임 조금씩 흔든다)
      const spiro = () => {
        // 한두 바퀴에 닫히는 밋밋한 꼴은 피한다(최소 세 바퀴)
        let R, r;
        do { R = 5 + Math.floor(rng() * 9); r = 2 + Math.floor(rng() * (R - 3)); } while (r / gcd(R, r) < 3);
        const d = r * (0.8 + rng() * 0.7);
        const turns = r / gcd(R, r), K = Math.min(3600, 420 * turns), sc = R - r + d, pts = [];
        for (let i = 0; i <= K; i++) {
          const s = (TAU * turns * i) / K;
          pts.push([((R - r) * Math.cos(s) + d * Math.cos(((R - r) / r) * s)) / sc, ((R - r) * Math.sin(s) - d * Math.sin(((R - r) / r) * s)) / sc]);
        }
        return pts;
      };
      const lis = { a: 1 + Math.floor(rng() * 4), b: 0, d0: rng() * Math.PI };
      lis.b = lis.a + 1 + Math.floor(rng() * 3);
      const lissajous = (t) => {
        const K = 1400, pts = [], d = lis.d0 + t * 0.05;
        for (let i = 0; i <= K; i++) { const s = (TAU * i) / K; pts.push([Math.sin(lis.a * s + d), Math.sin(lis.b * s)]); }
        return pts;
      };
      const sides = 3 + Math.floor(rng() * 5), twist = 0.02 + rng() * 0.08;
      if (mode === 'spiro') curve = spiro();

      const drawCurve = (g, pts, R, p) => {
        const n = pts.length - 1, k = Math.floor(n * p);
        g.strokeStyle = U.hsl(hue, 30, 75, 0.17); g.lineWidth = 1;
        g.beginPath(); for (let i = k; i <= n; i++) i === k ? g.moveTo(pts[i][0] * R, pts[i][1] * R) : g.lineTo(pts[i][0] * R, pts[i][1] * R); g.stroke();
        g.lineWidth = 1.6; g.lineCap = 'round';
        const step = 40;
        for (let i0 = 0; i0 < k; i0 += step) {
          const i1 = Math.min(k, i0 + step);
          g.strokeStyle = U.hsl(hue + (60 * i0) / n, 75, 68, 0.9);
          g.beginPath(); for (let i = i0; i <= i1; i++) i === i0 ? g.moveTo(pts[i][0] * R, pts[i][1] * R) : g.lineTo(pts[i][0] * R, pts[i][1] * R); g.stroke();
        }
        return pts[k];
      };

      return {
        resize(w, h) { W = w; H = h; },
        draw(g, { t, p }) {
          const cx = W / 2, cy = H * 0.63, R = Math.min(W * 0.4, H * 0.26);
          const bg = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.8);
          bg.addColorStop(0, U.hsl(hue, 35, 11)); bg.addColorStop(1, U.hsl(hue, 30, 4));
          g.fillStyle = bg; g.fillRect(0, 0, W, H);
          U.glow(g, cx, cy, R * 1.6, U.hsl(hue, 70, 50, 0.08));
          g.save(); g.translate(cx, cy);
          let head = null;

          if (mode === 'spiro' || mode === 'lissajous') {
            g.rotate(t * 0.02);
            head = drawCurve(g, mode === 'spiro' ? curve : lissajous(t), R, p);
            head = head && [head[0] * R, head[1] * R];
          } else if (mode === 'rings') {
            const N = 34, edge = p * N;
            for (let i = 0; i < N; i++) {
              const rad = R * (0.08 + (0.92 * (i + 1)) / N), rot = i * twist + t * 0.03 * (i % 2 ? 1 : -1);
              const lit = U.clamp(edge - i, 0, 1);
              g.strokeStyle = lit > 0 ? U.hsl(hue + (50 * i) / N, 70, 66, 0.2 + 0.7 * lit) : U.hsl(hue, 25, 75, 0.1);
              g.lineWidth = lit > 0 ? 1.4 : 1;
              g.beginPath();
              for (let s = 0; s <= sides; s++) { const a = rot + (TAU * s) / sides; s ? g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad) : g.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); }
              g.stroke();
            }
            const rad = R * (0.08 + 0.92 * p), a = Math.floor(edge) * twist + t * 0.03 * (Math.floor(edge) % 2 ? 1 : -1);
            head = [Math.cos(a) * rad, Math.sin(a) * rad];
          } else {
            const count = 720, k = Math.floor(count * p), breathe = 1 + 0.012 * Math.sin(t * 0.8);
            g.rotate(t * 0.015);
            g.fillStyle = U.hsl(hue, 25, 75, 0.13); g.beginPath();
            for (let i = k; i < count; i++) {
              const r = R * Math.sqrt(i / count) * breathe, a = i * GOLD, z = 0.8 + 1.4 * (i / count);
              g.moveTo(Math.cos(a) * r + z, Math.sin(a) * r); g.arc(Math.cos(a) * r, Math.sin(a) * r, z, 0, TAU);
            }
            g.fill();
            for (let i = 0; i < k; i++) {
              const r = R * Math.sqrt(i / count) * breathe, a = i * GOLD;
              g.fillStyle = U.hsl(hue + (60 * i) / count, 72, 66, 0.9);
              U.dot(g, Math.cos(a) * r, Math.sin(a) * r, 1.2 + 2.4 * (i / count));
            }
            const r = R * Math.sqrt(k / count) * breathe;
            head = [Math.cos(k * GOLD) * r, Math.sin(k * GOLD) * r];
          }
          if (head) {
            U.glow(g, head[0], head[1], 20, U.hsl(hue + 60 * p, 90, 75, 0.55 + 0.15 * Math.sin(t * 2)));
            g.fillStyle = '#fff'; U.dot(g, head[0], head[1], 3.5);
          }
          g.restore();
        },
        caption: () => `「${env.text}」에서 뽑은 ${MODE_NAME[mode]} · 밝은 만큼이 지나온 삶`,
      };
    },
  });
})();
