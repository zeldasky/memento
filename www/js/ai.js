/* 폰 안 AI — 퀄컴 NPU 로 도는 언어 모델을 부르는 얇은 층(MementoAiPlugin, 시험판 빌드에만 있다).
   출시판 · 브라우저에는 플러그인이 없어서 M.ai.has() 가 거짓이고, 화면에 AI 단추가 나오지 않는다.
   브리핑은 기사 제목만 근거로 삼게 하고, 대화는 일반 LLM 처럼 먼저 스스로 답하다가 필요할 때만 웹을 찾는다(web.js). 사실과 다를 수 있으니 근거 · 출처를 함께 보여 준다 */
(function () {
  'use strict';
  const M = window.M;
  const plugin = () => {
    if (window.__fakeAi) return window.__fakeAi;              // 화면 시험용
    const c = window.Capacitor;
    return c && c.isNativePlatform && c.isNativePlatform() ? c.Plugins.MementoAi || null : null;
  };
  let seq = 0;
  M.ai = {
    has: () => !!plugin(),
    status: () => plugin().status(),
    remove: () => plugin().remove(),
    stop: () => { const p = plugin(); return p ? p.stop().catch(() => {}) : null; },
    unload: () => { const p = plugin(); return p ? p.unload().catch(() => {}) : null; },
    async download(onProgress) {
      const p = plugin(), h = await p.addListener('progress', onProgress);
      try { await p.download(); } finally { h.remove(); }
    },
    // onText(지금까지 쓴 글 전체) 를 부르며 흘려 준다
    async run(req, onText) {
      const p = plugin(), id = ++seq;
      let full = '';
      const h = await p.addListener('token', (e) => { if (e.id === id) { full += e.text; onText(full); } });
      try {
        const r = await p.generate({ ...req, id });
        return { ...r, text: full };
      } finally { h.remove(); }
    },
  };

  // 제목에 없는 걸 지어내지 않게 — 첫 시험에서 나온 실수(「수차례」 · 「이와 parallel로」 · 약어 뜻풀이 틀림)를 막는 규칙 포함
  const RULE = '주어진 기사 제목만 근거로 삼는다. 제목에 없는 사실 · 수치 · 횟수 · 전망은 쓰지 않는다. 약어의 뜻을 풀어 쓰지 않는다. 회사와 사람 이름은 제목의 표기 그대로 쓰고, 그 밖의 말은 모두 한국어로만 쓴다. 투자 조언을 하지 않는다. 머리말 없이 본문만 쓴다.';
  const SYS = `너는 뉴스를 짧게 정리하는 한국어 분석가다. ${RULE}`;
  // 모델 지식으로는 답할 수 없는 말 — 모델 판단과 상관없이 찾아본다(모델은 오늘 일을 모른다). 「일정하게」 「최근접」 「지수 함수」처럼 뜻이 다른 말은 비켜 간다
  const NEEDS_WEB = /오늘|어제|내일|이번\s?(주|달|해|에)|지난\s?(주|달)|요즘|최근(?!접)|최신|방금|뉴스|속보|날씨|주가|시세|환율|코스피|코스닥|나스닥|얼마야|얼마였|몇\s?시|다음\s?(주|달|해|대선|선거)|가격(?!\s?탄력)|출시|(?:^|\s)일정(?=[은는이을좀\s?]|$)|실적|영업이익|매출|대선|선거|순위|몇\s?위|\b20(2[5-9]|[3-9]\d)\b|링크|찾아\s?(줘|봐|보)|검색해|(현재|지금).{0,20}(누구|얼마|몇)|(대통령|총리|회장|사장|대표|CEO|감독)\S*\s*(은|는|이|가)?\s*누구/;
  const IS_MATH = /\d\s*[-+*/×÷]\s*\d|곱하기|더하기|빼기|나누기/;
  M.aiNeedsWeb = (q) => !IS_MATH.test(q) && NEEDS_WEB.test(q);
  // 모델이 모른다고 할 때 — 찾아보고 다시 답한다. 첫머리의 짧은 답만 본다(사과 메일의 「죄송합니다」나 설명 속 「알 수 없다」를 모른다는 뜻으로 오해하지 않게)
  M.aiUnsure = (t) => t.length < 400 && /(모르겠|알 수 없|확인할 수 없|확인되지 않|정보가 없|자료가 부족|알려지지 않|공개되지 않|제 지식으로는|학습된 데이터|실시간 정보를|죄송)/.test(t.slice(0, 80));
  // 기억 칸은 4096토큰(한글 1자 ≈ 0.8토큰) — 프롬프트를 이 글자 수 안에 맞추고, 남은 만큼 답을 쓰게 한다
  const CHAT_CHARS = 3900, CTX_TOKENS = 4096;
  const list = (heads) => heads.map((h) => `- ${h}`).join('\n');
  M.aiPrompts = {
    brief: (word, heads) => ({ system: SYS, maxTokens: 220, user: `「${word}」가 나오는 최근 기사 제목이다.\n${list(heads)}\n\n보고서체로 세 문장만 써라. 첫 문장은 핵심 결론, 둘째는 누가 누구와 무엇을 했는지, 셋째는 함께 볼 흐름이다.` }),
    // 조사는 부르는 쪽(brief.js)에서 맞춰 준다 — 「은(는)」 같은 틀을 주면 모델이 그대로 베낀다
    link: (fromEun, viaWa, toDo, heads) => ({ system: SYS, maxTokens: 150, user: `관련 기사 제목이다.\n${list(heads)}\n\n「${fromEun} ${viaWa} ~했다. ${toDo} ${viaWa} ~했다.」 꼴로 두 문장만 써라. ~에는 제목에 적힌 일을 넣어라. 다른 말은 쓰지 마라.` }),
    digest: (heads) => ({ system: SYS, maxTokens: 220, user: `내가 저장해 둔 기사 제목이다.\n${list(heads)}\n\n이 기사들을 관통하는 흐름을 두 문장으로 쓰고, 마지막에 「오늘 남길 한 줄:」로 시작하는 짧은 문장을 하나 덧붙여라.` }),
    // 대화: 일반 LLM 처럼 먼저 스스로 답한다. 확인이 필요하면 답 대신 「검색: 검색어」 한 줄을 쓰고, 앱이 찾아 와서 다시 묻는다(canSearch).
    // 앞선 말은 최근 다섯 마디(질문은 1000자, 그 밖은 300자), 남는 칸에 자료를 넣는다
    chat: (title, heads, sources, history, { today, canSearch }) => {
      const turns = history.slice(-5).map((m, i, all) => ({ role: m.role, content: m.text.slice(0, i === all.length - 1 ? 1000 : 300) }));
      const spoken = turns.reduce((a, m) => a + m.content.length, 0);
      const fixed = [
        `너는 똑똑하고 친절한 한국어 AI 도우미다. 오늘은 ${today}이다. 어떤 주제든 대화하듯 자연스럽게 답한다. 아는 것은 망설이지 말고 바로 답하고, 수치 · 날짜 · 이름을 지어내지 않는다.`,
        canSearch ? '최신 소식 · 실시간 정보 · 처음 듣는 이름처럼 네 지식으로 확신할 수 없는 것을 물으면, 답을 쓰지 말고 「검색: 검색어」 한 줄만 쓴다. 용어 뜻 · 원리 · 방법 · 역사 · 글쓰기 · 계산 · 코드처럼 아는 것은 검색하지 말고 바로 답한다.\n예) 오늘 코스피 얼마야? → 검색: 오늘 코스피 지수\n예) 파이썬 리스트 어떻게 정렬해? → (바로 답한다)' : '',
        title ? `지금까지의 이야기 주제는 「${title}」이지만 다른 걸 물어도 된다.` : '',
        heads.length ? `참고할 최근 기사 제목:\n${heads.map((h) => `- ${h}`).join('\n')}` : '',
      ].filter(Boolean).join('\n');
      let room = CHAT_CHARS - fixed.length - spoken - 60;
      const lines = [];
      for (const x of sources) {
        if (room < 80) break;
        const line = `[${x.n}] ${x.title}: ${x.text}`.slice(0, room);
        lines.push(line); room -= line.length + 1;
      }
      const system = lines.length ? `${fixed}\n웹에서 찾은 자료다. 관련 있으면 쓰고 쓴 문장 끝에 [번호]를 붙인다. 자료에 없는 건 아는 대로 답한다.\n${lines.join('\n')}` : fixed;
      const used = Math.ceil((system.length + spoken) * 0.85) + 60;
      return { maxTokens: Math.min(900, Math.max(200, CTX_TOKENS - used - 40)), messages: [{ role: 'system', content: system }, ...turns] };
    },
    // 이어 묻는 말을 검색어로 바꾼다(「그럼 거기는?」 → 무엇을 찾을지)
    searchQuery: (title, history) => ({
      maxTokens: 24, temperature: 0,
      messages: [
        { role: 'system', content: `너는 검색어를 만든다. 대화의 마지막 질문을 웹에서 찾기 좋은 한국어 검색어로 바꿔라. 앞선 대화를 보고 「그거」 「거기」 같은 말을 실제 이름으로 바꾼다.${title ? ` 대화 주제: ${title}. 주제와 상관없는 질문이면 주제를 넣지 마라.` : ''} 8낱말 이내의 검색어만 쓰고 다른 말은 쓰지 마라.` },
        ...history.slice(-3).map((m) => ({ role: m.role, content: m.text.slice(0, 160) })),
      ],
    }),
  };
})();
