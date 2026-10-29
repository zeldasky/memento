/* 뉴스 특이점 — 관심 주제의 기사 제목이 평소보다 몰리거나 논조가 뚜렷한 낱말이 몰리면 알린다.
   흐름: 기사 제목 묶음 → detectSignal(낱말 · 논조 · 세기) → events.js 의 30초 장면(좋은 소식 · 나쁜 소식 · 큰 뉴스).
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
    // 기사만 몰리고 논조는 뚜렷하지 않은 날(혜성 장면)
    notice: { baseline: 12, titles: Array.from({ length: 42 }, (_, i) => [
      '삼성전자 오늘 주주총회 개최', '삼성전자 새 사업 전략 공개', '삼성전자 경영진 인사 단행', '삼성전자 해외 공장 증설 검토',
      '삼성전자 신제품 행사 생중계', '삼성전자 협력사와 기술 협약'][i % 6]) },
  };
})();
