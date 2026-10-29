/* 날씨 — 하늘을 가로지르는 해가 인생, 하늘·구름·비·눈은 오늘 진짜 날씨, 땅 위 줄은 이번 주 날씨 */
(function () {
  'use strict';
  const M = window.M, U = M.util, TAU = U.TAU;

  // WMO 날씨 코드 → 종류
  const KIND = (c) => c === 0 ? 'clear' : c <= 2 ? 'partly' : c === 3 ? 'cloudy' : c === 45 || c === 48 ? 'fog'
    : c <= 57 ? 'drizzle' : c <= 67 ? 'rain' : c <= 77 ? 'snow' : c <= 82 ? 'rain' : c <= 86 ? 'snow' : 'thunder';
  const LABEL = { clear: '맑음', partly: '구름 조금', cloudy: '흐림', fog: '안개', drizzle: '이슬비', rain: '비', snow: '눈', thunder: '뇌우' };
  const PRECIP = { 51: .25, 53: .35, 55: .5, 56: .35, 57: .5, 61: .45, 63: .7, 65: 1, 66: .5, 67: .9, 71: .35, 73: .6, 75: .9, 77: .4, 80: .55, 81: .8, 82: 1, 85: .5, 86: .85, 95: .9, 96: 1, 99: 1 };
  // [낮 위·아래], [밤 위·아래]
  const SKY = {
    clear: [['#2a68b8', '#93c3ea'], ['#060a18', '#1a2644']],
    partly: [['#3a72b2', '#a2c2dd'], ['#090e1c', '#212b40']],
    cloudy: [['#56606c', '#a4acb5'], ['#0f1216', '#252a30']],
    fog: [['#7d858e', '#b9bec3'], ['#151719', '#2d3135']],
    drizzle: [['#4a5561', '#8a95a1'], ['#0c1015', '#222930']],
    rain: [['#36404b', '#717d8a'], ['#0a0d11', '#1d232a']],
    snow: [['#727d8a', '#c2c9d1'], ['#131920', '#313945']],
    thunder: [['#232933', '#56606d'], ['#06080b', '#171b21']],
  };
  M.weatherKind = KIND;

  function glyph(g, kind, x, y, s) {
    g.beginPath();
    const pill = (dx = 0, dy = 0) => { g.moveTo(x + dx + s, y + dy); g.ellipse(x + dx, y + dy, s, s * 0.45, 0, 0, TAU); };
    if (kind === 'clear') { g.moveTo(x + s * 0.6, y); g.arc(x, y, s * 0.6, 0, TAU); }
    else if (kind === 'partly') { g.moveTo(x + s * 0.05, y - s * 0.4); g.arc(x - s * 0.4, y - s * 0.4, s * 0.45, 0, TAU); pill(s * 0.2, s * 0.25); }
    else if (kind === 'fog') { g.moveTo(x - s, y - s * 0.25); g.lineTo(x + s, y - s * 0.25); g.moveTo(x - s * 0.7, y + s * 0.3); g.lineTo(x + s * 0.7, y + s * 0.3); }
    else if (kind === 'thunder') { g.moveTo(x + s * 0.2, y - s); g.lineTo(x - s * 0.3, y + s * 0.1); g.lineTo(x + s * 0.25, y + s * 0.1); g.lineTo(x - s * 0.2, y + s); }
    else {
      pill();
      for (let i = -1; i <= 1; i++) {
        const bx = x + i * s * 0.55, by = y + s * 0.9;
        if (kind === 'snow') { g.moveTo(bx + 1.1, by); g.arc(bx, by, 1.1, 0, TAU); }
        else if (kind === 'rain' || kind === 'drizzle') { g.moveTo(bx + 1, by - 1.5); g.lineTo(bx - 1.5, by + (kind === 'rain' ? 4.5 : 2.5)); }
      }
    }
    g.stroke();
  }

  M.registerTheme({
    id: 'weather', name: '날씨', needs: 'weather',
    story: '하늘을 가로지르는 해가 내 인생이에요. 하늘은 오늘 날씨, 땅 위 줄은 이번 주 날씨.',
    keywords: ['날씨', '기상', '일기예보', '하늘', '구름', '소나기', '비', '눈', 'weather', 'sky', 'rain', 'snow', 'cloud'],
    create(env) {
      const rng = U.rng(env.seed);
      let W = 0, H = 0, drops = [], flakes = [], clouds = [], stars = [], fogs = [];
      let flash = 0, nextBolt = 2 + rng() * 4, bolt = null;

      return {
        resize(w, h) {
          W = w; H = h;
          const m = Math.min(W, H);
          drops = Array.from({ length: 420 }, () => ({ x: rng() * W, y: rng() * H, l: 10 + rng() * 16, v: 0.75 + rng() * 0.5 }));
          flakes = Array.from({ length: 260 }, () => ({ x: rng() * W, y: rng() * H, r: 0.8 + rng() * 2.2, v: 0.5 + rng() * 0.8, ph: rng() * TAU }));
          clouds = Array.from({ length: 10 }, () => ({
            x: rng() * W * 1.4 - W * 0.2, y: H * (0.05 + rng() * 0.45), s: m * (0.07 + rng() * 0.09), v: 0.4 + rng() * 0.8,
            puffs: Array.from({ length: 6 }, () => ({ dx: (rng() - 0.5) * 2.6, dy: (rng() - 0.5) * 0.5, r: 0.55 + rng() * 0.6 })),
          }));
          stars = U.makeStars(rng, 170);
          fogs = Array.from({ length: 6 }, () => ({ y: 0.4 + rng() * 0.5, h: 0.05 + rng() * 0.07, ph: rng() * TAU, sp: 0.1 + rng() * 0.3 }));
        },

        draw(g, { t, dt, p }) {
          const w = env.weather, cur = w && w.current;
          const code = cur ? cur.weather_code : 2;
          const kind = KIND(code);
          const hour = new Date().getHours();
          const day = cur ? cur.is_day === 1 : hour >= 7 && hour < 19;
          const [top, bot] = SKY[kind][day ? 0 : 1];
          const hy = H * 0.74;
          const wind = cur ? cur.wind_speed_10m : 8;

          U.fillV(g, W, H, top, bot, 0, hy);
          g.fillStyle = bot; g.fillRect(0, hy, W, H - hy);
          if (!day && (kind === 'clear' || kind === 'partly')) U.drawStars(g, stars, W, hy, t, kind === 'clear' ? 0.9 : 0.45);

          // 인생의 해 — 왼쪽 지평선(태어남)에서 오른쪽 지평선(마지막 날)까지
          const cx = W / 2, Rx = W * 0.42, Ry = Math.min(H * 0.36, Rx * 0.95);
          g.lineWidth = 1.2; g.setLineDash([2, 7]); g.strokeStyle = 'rgba(255,255,255,.32)';
          g.beginPath(); g.ellipse(cx, hy, Rx, Ry, 0, Math.PI, TAU); g.stroke(); g.setLineDash([]);
          g.lineWidth = 1.8; g.strokeStyle = 'rgba(255,255,255,.75)';
          g.beginPath(); g.ellipse(cx, hy, Rx, Ry, 0, Math.PI, Math.PI + Math.PI * p); g.stroke();
          const sx = cx - Rx * Math.cos(Math.PI * p), sy = hy - Ry * Math.sin(Math.PI * p);
          const hue = U.lerp(52, 16, p), light = U.lerp(90, 62, p), sr = Math.min(W, H) * 0.032;
          U.glow(g, sx, sy, sr * 7, U.hsl(hue, 95, light, day ? 0.35 : 0.25));
          g.fillStyle = U.hsl(hue, 95, light); U.dot(g, sx, sy, sr);

          // 구름 — 운량만큼, 바람만큼 흐른다
          const cover = cur ? cur.cloud_cover : 35;
          const nCloud = Math.round((cover / 100) * clouds.length);
          const heavy = kind === 'cloudy' || kind === 'rain' || kind === 'drizzle' || kind === 'thunder' || kind === 'snow';
          const v = day ? (heavy ? 205 : 255) : (heavy ? 70 : 120);
          for (let i = 0; i < nCloud; i++) {
            const c = clouds[i];
            c.x += (6 + wind * 1.1) * c.v * dt;
            if (c.x - c.s * 2.5 > W) c.x = -c.s * 2.5;
            for (const pf of c.puffs) {
              const r = c.s * pf.r, px = c.x + pf.dx * c.s * 0.6, py = c.y + pf.dy * c.s;
              const gr = g.createRadialGradient(px, py, 0, px, py, r);
              gr.addColorStop(0, `rgba(${v},${v},${v + 6},${heavy ? 0.6 : 0.5})`);
              gr.addColorStop(1, `rgba(${v},${v},${v + 6},0)`);
              g.fillStyle = gr; U.dot(g, px, py, r);
            }
          }

          if (kind === 'fog') {
            for (const f of fogs) {
              const y = f.y * H, h = f.h * H, a = 0.16 + 0.1 * Math.sin(t * f.sp + f.ph);
              const gr = g.createLinearGradient(0, y - h, 0, y + h);
              gr.addColorStop(0, 'rgba(230,232,235,0)'); gr.addColorStop(0.5, `rgba(230,232,235,${a})`); gr.addColorStop(1, 'rgba(230,232,235,0)');
              g.fillStyle = gr; g.fillRect(0, y - h, W, h * 2);
            }
          }

          // 비·눈
          const I = PRECIP[code] || 0, slant = U.clamp(wind / 40, 0, 0.6), floor = hy + (H - hy) * 0.3;
          if (I && kind !== 'snow') {
            const n = Math.round(drops.length * I);
            g.strokeStyle = 'rgba(205,218,235,.45)'; g.lineWidth = 1; g.beginPath();
            for (let i = 0; i < n; i++) {
              const d = drops[i], sp = 900 * d.v * dt;
              d.y += sp; d.x += slant * sp;
              if (d.y > floor) { d.y = -d.l; d.x = rng() * W * 1.2 - W * 0.2; }
              g.moveTo(d.x, d.y); g.lineTo(d.x - slant * d.l, d.y - d.l);
            }
            g.stroke();
          } else if (I) {
            const n = Math.round(flakes.length * I);
            g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath();
            for (let i = 0; i < n; i++) {
              const f = flakes[i];
              f.y += 45 * f.v * dt; f.x += (Math.sin(t * 0.8 + f.ph) * 14 + slant * 30) * dt;
              if (f.y > floor) { f.y = -4; f.x = rng() * W; }
              g.moveTo(f.x + f.r, f.y); g.arc(f.x, f.y, f.r, 0, TAU);
            }
            g.fill();
          }

          // 땅
          const gr = g.createLinearGradient(0, hy, 0, H);
          gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,.82)');
          g.fillStyle = gr; g.fillRect(0, hy, W, H - hy);
          g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(0, hy + 0.5); g.lineTo(W, hy + 0.5); g.stroke();

          // 이번 주 — 최고기온을 잇는 선 위에 날씨 모양
          const dd = w && w.daily;
          if (dd && dd.time.length > 1) {
            const n = Math.min(7, dd.time.length), x0 = W * 0.1, x1 = W * 0.9;
            const gy = hy + (H - hy) * 0.42, span = (H - hy) * 0.15;
            const tmax = dd.temperature_2m_max.slice(0, n), lo = Math.min(...tmax), hi = Math.max(...tmax);
            const pts = tmax.map((tv, i) => [x0 + ((x1 - x0) * i) / (n - 1), gy - (hi === lo ? 0.5 : (tv - lo) / (hi - lo)) * span]);
            g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
            for (let i = 1; i < n; i++) {
              const mx = (pts[i - 1][0] + pts[i][0]) / 2;
              g.bezierCurveTo(mx, pts[i - 1][1], mx, pts[i][1], pts[i][0], pts[i][1]);
            }
            g.stroke();
            g.font = '11px Pretendard, "Malgun Gothic", sans-serif'; g.textAlign = 'center';
            for (let i = 0; i < n; i++) {
              const [x, y] = pts[i];
              g.strokeStyle = i === 0 ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.7)'; g.lineWidth = i === 0 ? 1.6 : 1.2;
              glyph(g, KIND(dd.weather_code[i]), x, y - 12, 6.5);
              g.fillStyle = i === 0 ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.45)';
              g.fillText(i === 0 ? '오늘' : '일월화수목금토'[new Date(dd.time[i] + 'T00:00').getDay()], x, gy + span * 0.2 + 20);
            }
          }

          // 천둥 번개
          if (kind === 'thunder') {
            nextBolt -= dt;
            if (nextBolt < 0) {
              flash = 1; nextBolt = 4 + rng() * 8;
              let x = W * (0.15 + rng() * 0.7), y = H * 0.08; bolt = [[x, y]];
              while (y < hy) { y += 18 + rng() * 26; x += (rng() - 0.5) * 40; bolt.push([x, y]); }
            }
            if (flash > 0) {
              g.fillStyle = `rgba(235,240,255,${flash * 0.28})`; g.fillRect(0, 0, W, H);
              if (bolt && flash > 0.55) {
                g.strokeStyle = `rgba(255,255,255,${flash})`; g.lineWidth = 1.6; g.beginPath();
                bolt.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
              }
              flash = Math.max(0, flash - dt * 2.4);
            }
          }
        },

        caption() {
          if (!env.weather) return env.weatherStatus === 'error' ? '날씨를 못 불러왔어요 · 설정에서 위치를 확인해 주세요' : '날씨를 불러오는 중…';
          const c = env.weather.current, kinds = env.weather.daily.weather_code.slice(0, 7).map(KIND);
          const count = (...ks) => kinds.filter((k) => ks.includes(k)).length;
          const rainy = count('rain', 'drizzle', 'thunder'), snowy = count('snow'), clear = count('clear', 'partly');
          const week = snowy ? `눈 소식 ${snowy}일` : rainy ? `비 소식 ${rainy}일` : clear >= 5 ? '대체로 맑은 한 주' : '구름 많은 한 주';
          const place = env.place ? `${env.place.name} · ` : '';
          return `${place}지금 ${LABEL[KIND(c.weather_code)]} ${Math.round(c.temperature_2m)}° · 이번 주 ${week}`;
        },
      };
    },
  });
})();
