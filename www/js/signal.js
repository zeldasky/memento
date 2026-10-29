/* 뉴스 특이점 — 관심 주제의 기사 제목이 평소보다 몰리거나 특이한 낱말이 몰리면 배경이 바뀐다.
   흐름: 기사 제목 묶음 → detectSignal(낱말 · 논조 · 세기) → M.signalFx 가 그림 위에 효과를 얹고, 기하 무늬는 색 · 크기 · 떨림이 바뀐다.
   뉴스 출처는 아직 없다(상업용 한국어 뉴스는 계약 필요 — docs/라이선스-검토.md). 지금은 시험용 표본 제목으로만 돈다. */
(function () {
  'use strict';
  const M = window.M, U = M.util, TAU = U.TAU;

  // 논조 사전(제목에 들어 있으면) — 길게 겹치는 말을 먼저
  const PHRASES = [
    ['어닝 서프라이즈', 1], ['어닝서프라이즈', 1], ['사상 최대', 0.8], ['역대 최대', 0.8], ['깜짝 실적', 0.9], ['호실적', 0.7], ['신고가', 0.7], ['급등', 0.6], ['흑자 전환', 0.7], ['수주', 0.4], ['상향', 0.4],
    ['어닝 쇼크', -1], ['어닝쇼크', -1], ['적자 전환', -0.8], ['적자', -0.6], ['급락', -0.7], ['하향', -0.4], ['리콜', -0.7], ['소송', -0.5], ['부진', -0.6], ['쇼크', -0.7], ['우려', -0.3], ['감소', -0.3],
  ];
  const STOP = new Set(['오늘', '올해', '지난해', '전년', '대비', '분기', '기록', '발표', '관련', '이번', '속보', '종합', '단독', '정부', '시장']);
  const PARTICLE = /(은|는|이|가|을|를|의|에|에서|로|으로|와|과|도|만|까지|부터)$/;

  // titles: 최근 창(예: 6시간) 제목들, baseline: 같은 길이 창의 평소 기사 수
  M.detectSignal = (topic, titles, baseline) => {
    const ratio = titles.length / Math.max(1, baseline);
    const burst = U.clamp((ratio - 1.5) / 3, 0, 1);            // 평소의 1.5배부터 오르기 시작, 4.5배면 최대
    let tone = 0, best = null;
    const hits = new Map();
    for (const raw of titles) {
      const t = raw.replace(/\s+/g, ' ');
      for (const [w, v] of PHRASES) if (t.includes(w)) { tone += v; hits.set(w, (hits.get(w) || 0) + 1); break; }
    }
    tone = U.clamp(tone / Math.max(3, titles.length * 0.5), -1, 1);
    // 가장 많이 나온 논조 낱말, 없으면 가장 많이 나온 일반 낱말(주제 낱말 · 불용어 빼고)
    for (const [w, n] of hits) if (!best || n > best[1]) best = [w, n];
    if (!best) {
      const df = new Map(), topicTok = M.tokens(topic);
      for (const raw of titles) {
        const seen = new Set();
        for (let w of raw.split(/[^가-힣A-Za-z0-9]+/)) {
          w = w.replace(PARTICLE, '');
          if (w.length < 2 || STOP.has(w) || topicTok.some((x) => x.includes(w) || w.includes(x)) || seen.has(w)) continue;
          seen.add(w); df.set(w, (df.get(w) || 0) + 1);
        }
      }
      for (const [w, n] of df) if (n >= 3 && (!best || n > best[1])) best = [w, n];
    }
    // 세기: 기사 몰림 + 논조의 뚜렷함
    const level = U.clamp(Math.max(burst, burst * 0.6 + Math.abs(tone) * 0.5, best && hits.size ? 0.55 : 0), 0, 1);
    if (level < 0.25) return null;                              // 평소
    return { topic, word: (best ? best[0] : topic).replace('어닝서프라이즈', '어닝 서프라이즈').replace('어닝쇼크', '어닝 쇼크'), level, tone, ratio };
  };

  // 시험용 표본(지어낸 제목) — 화면에 나오지 않고 감지 흐름을 돌려 보는 데만 쓴다
  M.SAMPLE_NEWS = {
    normal: { baseline: 12, titles: ['삼성전자, 신규 갤럭시 공개 일정 안내', '삼성전자 반도체 공장 견학 행사', '삼성전자 임직원 봉사활동', '삼성전자 가전 할인 행사 시작',
      '삼성전자 노사 정기 협의', '삼성전자 디자인상 수상', '삼성전자 협력사 상생 간담회', '삼성전자 새 스마트워치 출시', '삼성전자 주가 보합 마감', '삼성전자 친환경 포장 확대'] },
    surprise: { baseline: 12, titles: Array.from({ length: 46 }, (_, i) => [
      '삼성전자, 3분기 어닝 서프라이즈…영업이익 시장 기대 크게 웃돌아', '삼성전자 깜짝 실적에 주가 급등', '삼성전자 반도체 부문 사상 최대 분기 매출',
      '[속보] 삼성전자 어닝서프라이즈, 증권가 목표가 상향', '삼성전자 호실적…HBM 수주 확대', '삼성전자 신고가 경신, 외국인 순매수'][i % 6]) },
    shock: { baseline: 12, titles: Array.from({ length: 44 }, (_, i) => [
      '삼성전자, 3분기 어닝 쇼크…영업이익 시장 예상 크게 밑돌아', '삼성전자 실적 부진에 주가 급락', '삼성전자 반도체 적자 전환 우려',
      '[속보] 삼성전자 어닝쇼크, 증권가 목표가 하향', '삼성전자 메모리 가격 하락에 이익 감소', '삼성전자 리콜 이어 실적까지 부진'][i % 6]) },
  };

  // 그림 위 효과 — 좋은 소식: 금빛 · 떠오르는 불티 · 퍼지는 고리 · 낱말이 떠오름 / 나쁜 소식: 청회색 · 가라앉는 재 · 지지직 · 낱말이 흔들리며 내려감
  M.signalFx = (rng) => {
    const parts = Array.from({ length: 110 }, () => ({ x: rng(), y: rng(), v: 0.4 + rng() * 0.9, s: 0.6 + rng() * 1.6, ph: rng() * TAU }));
    let cur = { level: 0, tone: 0 }, sig = null, born = 0, glitch = 0;
    const nextGlitch = U.every(rng, 2.5, 7);
    return {
      get value() { return cur; },
      set(s, t) { sig = s; born = t; },
      // 매 프레임: 값이 부드럽게 따라간다(켜질 때 2~3초에 걸쳐 스며든다)
      step(dt) {
        const k = 1 - Math.exp(-dt * 0.9);
        cur.level += ((sig ? sig.level : 0) - cur.level) * k;
        cur.tone += ((sig ? sig.tone : 0) - cur.tone) * k;
      },
      draw(g, W, H, t, dt, quiet = false) {
        const L = cur.level;
        if (L < 0.02) return;
        const pos = cur.tone >= 0, warm = pos ? [42, 95, 62] : [205, 35, 62];
        const cx = W / 2, cy = H * 0.6;
        // 가장자리 물들이기
        const vg = g.createRadialGradient(cx, cy, Math.min(W, H) * 0.25, cx, cy, Math.max(W, H) * 0.8);
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, U.hsl(warm[0], warm[1], pos ? 40 : 25, 0.35 * L));
        g.fillStyle = vg; g.fillRect(0, 0, W, H);

        // 배경 낱말
        if (sig && !quiet) {
          const age = t - born, drift = pos ? -age * 4 : age * 3, shake = pos ? 0 : Math.sin(t * 37) * 2.2 * L;
          const fs = Math.min(W * 0.15, 92) * (sig.word.length > 5 ? 0.75 : 1);
          g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
          g.font = `500 ${fs}px "Noto Serif KR", serif`;
          const wy = H * 0.42 + ((drift % (H * 0.12)) + H * 0.12) % (H * 0.12) - H * 0.06;
          g.shadowColor = U.hsl(warm[0], 90, 65, 0.8 * L); g.shadowBlur = pos ? 30 : 8;
          g.fillStyle = U.hsl(warm[0], warm[1], 84, (0.34 + 0.12 * Math.sin(t * 1.4)) * L);
          g.fillText(sig.word, cx + shake, wy);
          g.shadowBlur = 0;
          g.font = `400 ${Math.max(12, fs * 0.2)}px Pretendard, sans-serif`;
          g.fillStyle = U.hsl(warm[0], 30, 85, 0.45 * L);
          g.fillText(`${sig.topic} · 기사가 평소의 ${Math.max(2, Math.round(sig.ratio))}배`, cx + shake, wy + fs * 0.75);
          g.restore();
        }

        // 입자: 좋은 소식은 불티가 떠오르고, 나쁜 소식은 재가 가라앉는다
        const n = Math.round(parts.length * L);
        for (let i = 0; i < n; i++) {
          const q = parts[i];
          q.y += (pos ? -1 : 1) * q.v * dt * 0.06;
          if (q.y < -0.02) q.y = 1.02; else if (q.y > 1.02) q.y = -0.02;
          const x = (q.x + Math.sin(t * 0.7 + q.ph) * 0.01) * W, y = q.y * H;
          if (pos) { U.glow(g, x, y, 6 * q.s, `rgba(255,200,110,${0.5 * L})`); g.fillStyle = `rgba(255,236,190,${0.9 * L})`; U.dot(g, x, y, q.s * 0.7); }
          else { g.fillStyle = `rgba(170,185,205,${0.45 * L})`; g.fillRect(x, y, q.s * 1.4, q.s * 1.4); }
        }

        // 좋은 소식: 가운데서 빛 고리가 2초마다 퍼진다
        if (pos) {
          for (let j = 0; j < 3; j++) {
            const k = ((t * 0.5 + j / 3) % 1), r = Math.min(W, H) * (0.1 + k * 0.55);
            g.strokeStyle = `rgba(255,214,140,${0.35 * (1 - k) * L})`; g.lineWidth = 1.5;
            g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
          }
        } else {
          // 나쁜 소식: 가끔 화면이 가로로 찢어지듯 지지직
          if (nextGlitch(t)) glitch = 0.35;
          if (glitch > 0) {
            for (let j = 0; j < 6; j++) {
              const y = rng() * H, h = 2 + rng() * 10;
              g.fillStyle = j % 2 ? `rgba(255,70,90,${0.18 * L})` : `rgba(90,220,255,${0.15 * L})`;
              g.fillRect((rng() - 0.5) * 30, y, W, h);
            }
            glitch -= dt;
          }
        }
      },
    };
  };
})();
