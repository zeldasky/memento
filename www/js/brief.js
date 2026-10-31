/* 연관 브리핑 — 기기에 쌓인 기사 제목으로 작은 지식 지도(온톨로지)를 엮는다.
   개체(사람 · 회사 · 지역 · 지표 · 기술)와 관계(회동 · 투자 · 소송 …)를 제목에서 찾아 잇고, 지도의 점을 누르면 그 점을 중심으로 다시 엮는다.
   지도와 AI 브리핑은 제목만 쓰고 기기 안에서 계산한다. 「물어보기」 대화만 필요할 때 검색어를 밖으로 보낸다(web.js). 주제 이름은 어디에도 보이지 않는다 */
(function () {
  'use strict';
  const M = window.M;

  const TYPES = {
    person: { name: '사람', color: '#f4a7a0' }, org: { name: '회사 · 기관', color: '#f2c879' }, place: { name: '나라 · 지역', color: '#8fd3e8' },
    metric: { name: '시장 지표', color: '#9fe0a8' }, tech: { name: '기술 · 제품', color: '#c4b0ff' }, word: { name: '화제', color: 'rgba(244, 241, 234, .66)' },
  };
  const dict = (type, s) => s.split(' ').map((w) => [w.toLowerCase(), { type, name: w }]);
  const ONTO = new Map([
    ...dict('person', '올트먼 최태원 이재용 정의선 구광모 트럼프 머스크 젠슨황 저커버그 베이조스 시진핑 이재명 파월 나델라 피차이 쿡 손정의 곽노정 전영현 다리오'),
    ...dict('org', '삼성 삼성전기 삼성SDI 삼성바이오로직스 하이닉스 한미반도체 SK SK텔레콤 LG LG전자 LG에너지솔루션 CNS 현대차 기아 현대해상 현대모비스 네이버 카카오 포스코 한화 두산 효성중공업 엔비디아 TSMC 인텔 AMD 마이크론 애플 구글 알파벳 메타 아마존 테슬라 MS 마이크로소프트 오픈AI 앤트로픽 딥시크 바이낸스 화웨이 알리바바 샤오미 소프트뱅크 브로드컴 ASML 퀄컴 지멘스 연준 금융위 금감원 한국은행 한은 백악관 국세청 빅테크'),
    ...dict('place', '미국 중국 일본 대만 유럽 EU 독일 네덜란드 영국 프랑스 러시아 우크라이나 이란 이스라엘 북한 인도 베트남 캐나다 서울 부산 대구 광주 용인 새만금 경주 호남 충북 실리콘밸리 월가'),
    ...dict('metric', '금리 환율 코스피 코스닥 나스닥 다우 증시 뉴욕증시 주가 유가 달러 영업익 매출 실적 배당 시총 주주환원 법인세 수익성 외국인 ETF 비트코인 공급망 수요'),
    ...dict('tech', 'HBM D램 낸드 GPU 파운드리 메모리 로봇 휴머노이드 데이터센터 클라우드 전기차 배터리 자율주행 양자 챗GPT 제미나이 에이전트 MLCC 소부장 전력망 피지컬 AX 인프라 스마트폰 갤럭시 아이폰 전력반도체'),
  ]);
  const ALIAS = { sk하이닉스: '하이닉스', sk하이닉스서: '하이닉스', 삼성전자: '삼성', 현대차그룹: '현대차', sk그룹: 'sk', 영업이익: '영업익', 젠슨: '젠슨황', 샘올트먼: '올트먼', 오픈에이아이: '오픈ai', 용인시: '용인', 알파벳: '구글' };
  // 제목에서 찾는 관계 — [찾는 말, 보여 줄 말]
  const RELATIONS = [['맞손', '협력'], ['협력', '협력'], ['제휴', '협력'], ['동맹', '동맹'], ['회동', '회동'], ['오찬', '회동'], ['간담회', '회동'], ['만난', '회동'], ['만났', '회동'], ['회담', '회동'], ['논의', '논의'],
    ['투자', '투자'], ['인수', '인수'], ['합병', '인수'], ['공급', '공급'], ['수주', '수주'], ['계약', '계약'], ['소송', '소송'], ['제재', '제재'], ['규제', '규제'], ['관세', '관세'], ['수출', '수출'],
    ['파업', '파업'], ['해킹', '해킹'], ['피싱', '해킹'], ['경쟁', '경쟁'], ['추격', '경쟁'], ['출시', '출시'], ['개발', '개발'], ['양산', '양산'], ['착공', '착공'], ['유치', '유치']];
  const CUE_WORDS = new Set(RELATIONS.flatMap(([a, b]) => [a, b]));
  // 만나고 손잡고 다투는 일의 상대는 사람 · 회사 · 나라뿐이다(「최태원 회동 HBM」 같은 줄이 나오지 않게)
  const ACTOR_ONLY = new Set(['회동', '협력', '동맹', '논의', '인수', '계약', '소송', '제재']), ACTORS = new Set(['person', 'org', 'place']);
  const GOOD = ['급등', '호실적', '호조', '호황', '신고가', '사상 최대', '역대 최대', '흑자', '상승', '돌파', '수주', '성장', '회복', '반등', '상향', '서프라이즈', '쌍끌이'];
  const BAD = ['급락', '폭락', '하락', '적자', '우려', '쇼크', '부진', '리콜', '소송', '해킹', '피싱', '위기', '파업', '감소', '둔화', '하향', '증발', '공포', '제재'];
  const TONE_WORDS = new Set([...GOOD, ...BAD]);
  const STOP = new Set('오늘 내일 어제 올해 내년 작년 지난해 전년 대비 분기 기록 발표 관련 이번 속보 종합 단독 정부 시장 이유 까닭 위해 대한 위한 통해 이후 때문 따라 오는 지난 최근 전망 있는 없는 하는 되는 것으로 가운데 사실 결국 다시 뉴스 기자 영상 사진 포토 공개 진행 개최 한국 국내 글로벌 세계 오전 오후 이상 이하 가장 모두 함께 시대 기반 미래 혁신 속도 강화 추진 확대 활용 본격화 만에 넘어 따른 바꾸 바꿀 주목 전략 사업 기업 산업 경제 증가 급증 현장 지원 목표 성과 전환 모색 가속 고도화 새로운 차세대 판단 제시 선언 개편 확장 공유 방안 다음 머니투데 ebn by hi 최대 최대폭 기술 개선 분석 효과 대책 마련 경쟁력 지속 중심 운영 서비스 인사 회장 사람 인간 연구 교육 업무 플랫폼 전력 에너지 동반 조성 플러스 끌고 밀고 업계 나선다 나서 눈길 시동 박차 잇따라 관심 필요 강조 예정 계획 제작 도입 착수 수준 규모 역대 사상 석달만 경기'.split(' '));
  const VERBISH = /(다|까|며|면서|라고|하고|했고|해서|지만|는데|려면|했던|하며|한다|된다|했다|겠다|하는|되는|위해)$/;

  const isHangul = (c) => c >= 0xac00 && c <= 0xd7a3;
  const jong = (w) => {
    const c = w.charCodeAt(w.length - 1);
    if (isHangul(c)) return (c - 0xac00) % 28;
    return /[lmnr0136789]$/i.test(w) ? 1 : 0;
  };
  const eun = (w) => w + (jong(w) ? '은' : '는');
  const ro = (w) => { const j = jong(w); return w + (j && j !== 8 ? '으로' : '로'); };

  function terms(h, tks, disp) {
    const out = new Set();
    for (const raw of h.replace(/\[[^\]]*\]/g, ' ').split(/[^가-힣A-Za-z0-9]+/)) {
      if (!raw) continue;
      const stripped = M.stripParticle(raw), low = (ALIAS[stripped.toLowerCase()] || stripped).toLowerCase();
      const known = ONTO.has(low);
      if (low.length < 2 || low.length > 8 || /^[0-9]/.test(low)) continue;
      if (!known && (STOP.has(low) || CUE_WORDS.has(low) || TONE_WORDS.has(low) || VERBISH.test(low))) continue;
      // 주제 이름이 든 말은 뺀다 — 주제 이름을 품은 고유한 이름(예: 회사 이름)만 남긴다
      if (tks.some((x) => x === low || x.includes(low) || (low.includes(x) && !known))) continue;
      out.add(low);
      if (!disp.has(low)) disp.set(low, known ? ONTO.get(low).name : (ALIAS[stripped.toLowerCase()] || stripped));
    }
    return out;
  }
  const typeOf = (w) => (ONTO.has(w) ? ONTO.get(w).type : 'word');

  // 저장된 뉴스 기록 → 문서 목록 + 낱말별 문서 수
  M.briefGraph = (db, interests) => {
    const tks = interests.flatMap((t) => M.tokens(t)), docs = [], byH = new Map(), df = new Map(), disp = new Map();
    for (const topic of interests) {
      for (const it of (db[topic] && db[topic].items) || []) {
        const old = byH.get(it.h);
        if (old) { old.topics.add(topic); continue; }
        const d = { h: it.h, t: it.t, l: it.l, s: it.s, topics: new Set([topic]), words: terms(it.h, tks, disp) };
        byH.set(it.h, d); docs.push(d);
        for (const w of d.words) df.set(w, (df.get(w) || 0) + 1);
      }
    }
    return { docs, df, disp, interests, tks };
  };

  // 씨앗 기사와 중심 낱말로 브리핑 하나를 계산한다. focus 를 안 주면 씨앗 제목에서 가장 알맞은 개체를 고른다
  M.briefAnswer = (g, { h, focus, now = Date.now() }) => {
    const N = Math.max(1, g.docs.length), df = (w) => g.df.get(w) || 0, idf = (w) => Math.log(1 + N / Math.max(1, df(w)));
    const weight = (w) => (typeOf(w) === 'word' ? 0.7 : 1.4);
    const seedWords = h ? [...terms(h, g.tks, g.disp)] : [];
    if (!focus) focus = seedWords.filter((w) => df(w) >= 2).sort((a, b) => weight(b) * Math.log(1 + df(b)) - weight(a) * Math.log(1 + df(a)))[0] || null;
    const name = (w) => g.disp.get(w) || w;
    const base = { focus, name, seedWords, ctx: [], ring1: [], ring2: [], relations: [], bars: [], bridges: [], related: [], same: 0, n24: 0, prev24: 0, compare: false, good: 0, bad: 0 };
    if (!focus) return base;
    const ctx = g.docs.filter((d) => d.words.has(focus));
    // 첫째 고리: 중심과 같은 제목에 나온 말
    const co = new Map();
    for (const d of ctx) for (const w of d.words) if (w !== focus) co.set(w, (co.get(w) || 0) + 1);
    const minCo = ctx.length >= 8 ? 2 : 1;
    const score = (w, n) => n * idf(w) * weight(w);
    const ring1 = [...co].filter(([, n]) => n >= minCo).map(([w, n]) => ({ w, n, s: score(w, n) })).sort((a, b) => b.s - a.s).slice(0, 6);
    const inRing = new Set([focus, ...ring1.map((x) => x.w)]);
    // 둘째 고리: 중심과는 같이 나오지 않았지만 이웃을 건너 이어지는 말 — 지도가 알려 주는 뜻밖의 연결
    const ring2 = [];
    for (const nb of ring1.slice(0, 4)) {
      const c2 = new Map();
      for (const d of g.docs) if (d.words.has(nb.w) && !d.words.has(focus)) for (const w of d.words) if (!inRing.has(w)) c2.set(w, (c2.get(w) || 0) + 1);
      const best = [...c2].filter(([, n]) => n >= 2).map(([w, n]) => ({ w, n, s: score(w, n), via: nb.w })).sort((a, b) => b.s - a.s)[0];
      if (best) { ring2.push(best); inRing.add(best.w); }
    }
    // 관계: 같은 제목의 다른 개체 + 관계 말 → 중심 ─ 관계 ─ 개체
    const rel = new Map();
    for (const d of ctx) {
      const others = [...d.words].filter((w) => w !== focus && typeOf(w) !== 'word');
      const labels = new Set(RELATIONS.filter(([a]) => d.h.includes(a)).map(([, b]) => b));
      for (const r of labels) for (const to of (ACTOR_ONLY.has(r) ? others.filter((w) => ACTORS.has(typeOf(w))) : others).concat(others.length ? [] : [''])) {
        const key = `${r}|${to}`, f = rel.get(key) || { r, to, n: 0 };
        f.n += 1; rel.set(key, f);
      }
    }
    const perTo = new Map(), relations = [];
    for (const f of [...rel.values()].sort((a, b) => b.n - a.n)) {
      const used = perTo.get(f.to) || 0;
      if (used >= (f.to ? 2 : 1)) continue;
      perTo.set(f.to, used + 1); relations.push(f);
      if (relations.length >= 5) break;
    }
    // 흐름: 24시간을 2시간씩 12칸 + 그 전 24시간과 비교
    const H = 3600e3, bars = new Array(12).fill(0);
    let n24 = 0, prev24 = 0, good = 0, bad = 0;
    for (const d of ctx) {
      const age = now - d.t;
      if (age >= 0 && age < 24 * H) { n24++; bars[11 - Math.floor(age / (2 * H))]++; } else if (age < 48 * H) prev24++;
      if (GOOD.some((x) => d.h.includes(x))) good++;
      if (BAD.some((x) => d.h.includes(x))) bad++;
    }
    const oldest = g.docs.reduce((m, d) => Math.min(m, d.t), now);
    // 관심 주제 둘을 잇는 말
    const bridges = [];
    if (g.interests.length === 2) {
      const [a, b] = g.interests, ca = new Map(), cb = new Map();
      for (const d of g.docs) for (const w of d.words) { if (d.topics.has(a)) ca.set(w, (ca.get(w) || 0) + 1); if (d.topics.has(b)) cb.set(w, (cb.get(w) || 0) + 1); }
      for (const [w, n] of ca) { const m = cb.get(w) || 0; if (n >= 2 && m >= 2 && typeOf(w) !== 'word') bridges.push({ w, n: Math.min(n, m) }); }
      bridges.sort((x, y) => y.n - x.n); bridges.length = Math.min(bridges.length, 6);
    }
    // 함께 볼 기사: 씨앗(또는 중심과 이웃)과 드문 말을 많이 나눌수록 앞으로. 같은 소식은 한 건만
    const anchors = new Set(seedWords.includes(focus) ? seedWords : [focus, ...ring1.map((x) => x.w)]);
    let same = 0;
    const cand = g.docs.filter((d) => d.l && d.h !== h).map((d) => {
      let s = 0;
      for (const w of d.words) if (anchors.has(w)) s += idf(w);
      if (d.words.has(focus)) s += 2;
      return { d, s: s + Math.max(0, 1 - (now - d.t) / (48 * H)) };
    }).filter((x) => x.s >= 2).sort((a, b) => b.s - a.s);
    const related = [];
    for (const { d } of cand) {
      if (h && M.newsSameStory(h, d.h, g.interests.join(' '))) { same++; continue; }
      if (related.some((x) => M.newsSameStory(x.h, d.h, g.interests.join(' ')))) continue;
      if (related.length < 5) related.push(d);
    }
    return { ...base, ctx, ring1, ring2, relations, bars, bridges, related, same, n24, prev24, compare: now - oldest > 40 * H, good, bad };
  };

  /* ── 화면 ── */
  const $ = (s) => document.querySelector(s);
  const SVGNS = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs, parent) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.append(e); return e; };
  const el = (tag, cls, text, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (parent) parent.append(e); return e; };
  const ICONS = {
    map: '<circle cx="6" cy="12" r="2.2"/><circle cx="18" cy="6" r="2.2"/><circle cx="18" cy="18" r="2.2"/><path d="M8 11l8-4M8 13l8 4"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    flow: '<path d="M3 17l5-6 4 3 5-7 4 4"/><path d="M3 21h18"/>',
    bridge: '<path d="M3 16c3-7 15-7 18 0"/><path d="M3 19h18M8 12.5V19M16 12.5V19M12 11.5V19"/>',
    doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
  };
  const ago = (ms) => { const m = Math.max(1, Math.round((Date.now() - ms) / 60e3)); return m < 60 ? `${m}분 전` : m < 1440 ? `${Math.round(m / 60)}시간 전` : `${Math.round(m / 1440)}일 전`; };

  let ctl = null;
  const CHAT_ICON = '<path d="M4 5h16v11H9l-5 4z"/>';
  const SPARK = '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>';
  const AI_ERR = { memory: '지금은 메모리가 부족해요. 쓰지 않는 앱을 닫고 다시 눌러 주세요.', nomodel: 'AI 모델을 찾지 못했어요. 다시 받아 주세요.' };
  const gb = (n) => `${(n / 1e9).toFixed(1)}GB`;
  // 모델 준비: 없으면 ui.ask 로 물어 받는다. 준비되면 상태, 아니면 null
  async function readyModel(mine, ui) {
    const st = await M.ai.status();
    if (mine !== ctl) return null;
    if (!st.supported) { ui.say('이 폰의 칩에서는 아직 쓸 수 없어요.', true); return null; }
    if (st.downloaded) return st;
    if (!(await ui.ask(st)) || mine !== ctl) return null;
    ui.busy(true); ui.bar.hidden = false; ui.say('AI 모델을 받는 중이에요. 화면을 닫지 말아 주세요.');
    try {
      await M.ai.download((e) => { if (e.total) { ui.fill.style.width = `${Math.round((e.done / e.total) * 100)}%`; ui.say(`AI 모델을 받는 중이에요 · ${gb(e.done)} / ${gb(e.total)}`); } });
    } catch (e) {
      if (mine === ctl) { ui.bar.hidden = true; ui.busy(false); ui.say('받다가 끊겼어요. 다시 누르면 이어서 받아요.', true); }
      return null;
    }
    if (mine !== ctl) return null;
    ui.bar.hidden = true; ui.busy(false);
    return { ...st, downloaded: true };
  }
  // 단추를 눌렀을 때만 모델을 올리고, 글자를 흘려 보여 준다. 같은 질문은 다시 계산하지 않는다
  // modes: [{ id, label, main?, prompt: () => 프롬프트 } 또는 { label, action: () => … }]
  function aiPanel(parent, key, modes, noteText) {
    if (!M.ai.has()) return;
    const wrap = el('div', 'ai-panel', null, parent);
    const out = el('p', 'ai-out', null, wrap); out.hidden = true;
    const note = el('p', 'ai-note', null, wrap); note.hidden = true;
    const bar = el('div', 'ai-bar', null, wrap); bar.hidden = true; const fill = el('i', '', null, bar);
    const chips = el('div', 'ai-chips', null, wrap);
    const say = (t, warn, live) => { note.textContent = t || ''; note.hidden = !t; note.className = `ai-note${warn ? ' warn' : ''}${live ? ' live' : ''}`; };
    const busy = (on) => buttons.forEach((b) => { b.disabled = on; });
    const buttons = modes.map((m) => {
      const b = el('button', m.main ? 'main' : '', null, chips); b.type = 'button';
      const i = el('i', '', null, b); i.innerHTML = M.iconSvg(m.action ? CHAT_ICON : SPARK, 14); i.style.display = 'grid';
      b.append(m.label);
      b.onclick = () => (m.action ? m.action() : start(m, b));
      return b;
    });
    async function start(m, b) {
      const mine = ctl, ck = `${key}|${m.id}`;
      if (mine.aiCache.has(ck)) {
        out.hidden = false; renderAnswer(out, ctl.mask(mine.aiCache.get(ck)));
        buttons.forEach((x) => x.classList.toggle('on', x === b)); say(noteText);
        return;
      }
      const st = await readyModel(mine, {
        say, bar, fill, busy,
        ask: async (s) => {
          if (b.dataset.ask === '1') return true;
          b.dataset.ask = '1';
          say(`AI 모델(${gb(s.size)})을 폰에 한 번 받아요.${s.wifi ? ' 다시 누르면 시작해요.' : ' 지금은 모바일 데이터예요 — 와이파이에서 받는 게 좋아요. 그래도 받으려면 다시 누르세요.'}`, !s.wifi);
          return false;
        },
      });
      if (!st) return;
      busy(true); buttons.forEach((x) => x.classList.toggle('on', x === b));
      out.hidden = false; out.textContent = ''; out.classList.add('run');
      say(st.loaded ? 'Thinking…' : 'Loading model…', false, true);
      const stop = el('button', 'ai-stop', '멈추기', chips); stop.type = 'button'; stop.onclick = () => M.ai.stop();
      try {
        const r = await M.ai.run(m.prompt(), (full) => { if (mine === ctl) { renderAnswer(out, mine.mask(full)); if (!note.classList.contains('warn')) say(''); } });
        if (mine !== ctl) return;
        const text = r.text.trim();
        if (r.stop !== 'user' && text) mine.aiCache.set(ck, text);
        out.classList.remove('run'); renderAnswer(out, mine.mask(text));
        say(noteText);
      } catch (e) {
        if (mine !== ctl) return;
        out.classList.remove('run'); out.hidden = !out.textContent;
        say(AI_ERR[e.message] || `AI가 답하지 못했어요. 다시 눌러 주세요. (${e.message})`, true);
      } finally {
        stop.remove();
        if (mine === ctl) busy(false);
      }
    }
  }
  /* ── AI 에게 묻기: 계속 묻고 답한다. 대화는 브리핑을 닫을 때까지 대상별로 남아 있다 ── */
  let chat = null;                                            // 지금 열린 대화 { key, title, heads, msgs, running, stopped, turn, lastSources, cancel }
  const msgsBox = () => $('#aiMsgs');
  function chatBubble(cls, text) {
    const box = msgsBox(), b = el('div', `ai-msg ${cls}`, text, box);
    box.scrollTop = box.scrollHeight;
    return b;
  }
  function chatScroll(force) {
    const box = msgsBox();
    if (force || box.scrollHeight - box.scrollTop - box.clientHeight < 90) box.scrollTop = box.scrollHeight; // 위로 올려 읽는 중이면 끌어내리지 않는다
  }
  function setSendMode(running) {
    const send = $('#aiSend');
    send.classList.toggle('stop', running);
    send.setAttribute('aria-label', running ? '멈추기' : '보내기');
    send.innerHTML = M.iconSvg(running ? '<rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor"/>' : '<path d="M12 19V5M6 11l6-6 6 6"/>', 19);
  }
  // 이어 묻거나 주제가 있으면 모델이 검색어를 만든다. 이상하면 질문을 그대로 쓴다
  async function searchWords(c) {
    const q = c.msgs[c.msgs.length - 1].text;
    if (c.msgs.length < 2) return c.title && q.length < 12 ? `${c.title} ${q}` : q;
    let made = '';
    try { made = (await M.ai.run(M.aiPrompts.searchQuery(c.title, c.msgs), () => {})).text; } catch (e) { return q; }
    made = made.split('\n')[0].replace(/["'「」\[\]]/g, '').replace(/^검색어\s*[:：]\s*/, '').trim();
    return made && made.length <= 60 ? made : q;
  }
  const SEARCH_HEAD = /^[「"']?(검(색(\s*[:：][\s\S]*|\s*)?)?)?$/, SEARCH_LINE = /^[「"']?검색\s*[:：]\s*(.+)/;
  function sourceChips(sources, text) {
    const cited = sources.filter((x) => x.url && text.includes(`[${x.n}]`)), show = (cited.length ? cited : sources.filter((x) => x.url)).slice(0, 4);
    if (!show.length) return;
    const wrap = el('div', 'ai-src', null, msgsBox());
    for (const x of show) {
      const b = el('button', '', null, wrap); b.type = 'button';
      el('b', '', `[${x.n}]`, b); b.append(ctl.mask(M.web.host(x.url)));
      b.setAttribute('aria-label', `출처 ${x.n} 열기`);
      b.onclick = () => ctl.openLink(x.url);
    }
  }
  function openChat(key, title, heads, opt = {}) {
    const mine = ctl;
    chat = mine.chats.get(key);
    if (!chat) { chat = { key, title, heads, msgs: [] }; mine.chats.set(key, chat); }
    $('#aiChatCtx').textContent = title ? mine.mask(title) : '';
    const box = msgsBox(); box.innerHTML = '';
    if (!chat.msgs.length) el('p', 'ai-hello', '무엇이든 물어보세요. 아는 건 폰 안에서 바로 답하고, 최신 정보가 필요하면 스스로 웹을 찾아봐요. 찾을 때는 검색어가 DuckDuckGo · Bing · 구글 뉴스로 보내져요. 틀릴 수 있으니 중요한 건 꼭 확인하세요.', box);
    for (const m of chat.msgs) {
      if (m.trail) chatBubble('sys', m.trail);
      const b = chatBubble(m.role === 'user' ? 'me' : 'ai', m.role === 'user' ? mine.mask(m.text) : '');
      if (m.role !== 'user') renderAnswer(b, mine.mask(m.text));
      if (m.sources) sourceChips(m.sources, m.text);
    }
    setSendMode(!!chat.running);
    $('#aiChat').hidden = false;
    chatScroll(true);
  }
  function closeChat() {
    if (!chat) return;
    const c = chat, free = ctl && ctl.free;
    if (c.running) { c.stopped = true; if (c.cancel) c.cancel(); M.ai.stop(); }
    c.turn = (c.turn || 0) + 1;                               // 진행 중이던 답은 다시 열어도 화면에 쓰지 않는다
    chat = null;
    $('#aiChat').hidden = true;
    if (free) M.closeBrief();                                 // 뉴스 없이 바로 연 대화는 닫으면 끝
    if (M.onAiChatClose) M.onAiChatClose();
  }
  M.aiChatOpen = () => !!chat;
  // 뉴스와 상관없이 바로 여는 대화
  M.openFreeChat = (opt) => {
    if (ctl) return;
    ctl = { ...opt, free: true, aiCache: new Map(), chats: new Map() };
    openChat('free', '', []);
  };
  // 답의 마크다운을 글자 그대로 두지 않는다. 먼저 이스케이프해서 웹에서 온 글이 HTML 로 해석되지 않게 하고, 코드 덩어리 안은 손대지 않는다
  function renderAnswer(box, text) {
    const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    box.innerHTML = esc.split(/(```[\s\S]*?(?:```|$))/).map((part) => (part.startsWith('```')
      ? `<pre>${part.replace(/^```[^\n]*\n?/, '').replace(/\n?(?:```)?$/, '')}</pre>`
      : part.replace(/`([^`\n]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
        .replace(/^#{1,4}\s+(.+)$/gm, '<b>$1</b>')
        .replace(/^(\s*)[-*]\s+/gm, '$1• ')
        .replace(/^\s*---+\s*$/gm, ''))).join('');
  }
  async function sendChat(question) {
    const c = chat, mine = ctl;
    if (!c || !question) return;
    const turn = c.turn = (c.turn || 0) + 1;
    const live = () => chat === c && c.turn === turn;         // 이 대화 화면이 아직 이 질문을 보고 있는가
    c.running = true; c.stopped = false; setSendMode(true);
    const hello = msgsBox().querySelector('.ai-hello'); if (hello) hello.remove();
    chatBubble('me', mine.mask(question));
    c.msgs.push({ role: 'user', text: question });
    chatScroll(true);
    const sys = chatBubble('sys', '');
    const bar = el('div', 'ai-bar'), fill = el('i', '', null, bar); bar.hidden = true;
    // Claude 처럼 지금 하는 일을 답 위에 작게 보여 주고(live), 답이 나오면 한 일을 짧게 남긴다
    const say = (t, warn, on) => { sys.textContent = t || ''; sys.classList.toggle('warn', !!warn); sys.classList.toggle('live', !!on); sys.hidden = !t; if (!bar.hidden) sys.append(bar); if (live()) chatScroll(); };
    let reply = null;
    // 멈췄거나 닫았으면 이 질문은 없던 일로(화면의 내 말풍선만 남는다)
    const drop = () => { c.msgs.pop(); if (live()) { if (reply) reply.remove(); sys.remove(); } };
    try {
      const st = await readyModel(mine, {
        say, bar, fill, busy: () => {},
        ask: (s) => new Promise((res) => {
          c.cancel = () => res(false);
          say(`AI 모델(${gb(s.size)})을 폰에 한 번 받아요.${s.wifi ? '' : ' 지금은 모바일 데이터예요.'}`, !s.wifi);
          const go = el('button', '', '받기', sys); go.type = 'button'; go.onclick = () => res(true);
        }),
      });
      c.cancel = null;
      if (!st) { if (c.stopped) drop(); else c.msgs.pop(); return; } // 지원하지 않는 칩 · 받기 실패 안내는 남겨 둔다
      if (c.stopped) { drop(); return; }
      const t0 = Date.now();
      let readPages = 0, searched = false, sources = c.lastSources || [];
      say(st.loaded ? 'Thinking…' : 'Loading model…', false, true);
      // 일반 LLM 처럼: 먼저 스스로 답한다. 웹은 ①오늘 일을 묻거나 ②모델이 「검색: …」을 쓰거나 ③모른다고 답했을 때만, 질문당 한 번
      const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
      const lookUp = async (q) => {
        if (c.stopped || !live()) return;
        searched = true;
        // 웹은 10초 넘게 걸리기도 한다 — 멈추기를 누르면 기다리지 않고 바로 끝낸다
        const got = await Promise.race([
          M.web.gather(q, {
            heads: c.heads,
            onStep: (kind, n) => { if (live() && !c.stopped) say(kind === 'read' ? `Reading ${n} page${n > 1 ? 's' : ''}…` : `Searching the web · ${mine.mask(q)}`, false, true); },
          }),
          new Promise((res) => { c.cancel = () => res(null); }),
        ]);
        c.cancel = null;
        if (!got) return;
        readPages = got.pages;
        if (got.sources.length) sources = got.sources;
        if (live() && !c.stopped) say(got.sources.length ? 'Thinking…' : 'No results · Thinking…', false, true);
      };
      const trail = () => (searched ? `Searched the web${readPages ? ` · ${readPages} page${readPages > 1 ? 's' : ''}` : ''}` : `Thought for ${Math.max(1, Math.round((Date.now() - t0) / 1000))}s`);
      const write = async (canSearch) => {
        let text = '', decided = !canSearch, stopSent = false;
        const r = await M.ai.run(M.aiPrompts.chat(c.title, searched ? [] : c.heads.slice(0, 8), sources, c.msgs, { today, canSearch }), (full) => {
          text = full;
          if (c.stopped && !reply) { if (!stopSent) { stopSent = true; M.ai.stop(); } return; } // 모델을 올리는 중에 멈춘 경우
          if (!live()) return;
          const head = full.trimStart();
          // 첫머리가 「검색:」일 수 있는 동안은 보여 주지 않는다
          if (!decided) { if (SEARCH_HEAD.test(head)) return; decided = true; }
          if (!reply) { say(trail()); reply = chatBubble('ai run', ''); }
          renderAnswer(reply, mine.mask(head)); chatScroll();
        });
        return { r, text: text.trim() };
      };
      if (M.aiNeedsWeb(question)) await lookUp(await searchWords(c));
      if (!live() || c.stopped) { drop(); return; }
      let { r, text } = await write(!searched);
      if (!live() || (c.stopped && !reply)) { drop(); return; }
      const asked = text.match(SEARCH_LINE);
      if (!c.stopped && (asked || (!searched && M.aiUnsure(text)))) {
        // 첫 질문은 사용자의 말 그대로 찾는다(모델이 이름을 틀리게 옮기기도 한다 — 「점슨황」). 이어 묻는 말은 모델이 풀어 쓴 검색어로
        const query = asked && c.msgs.length > 1 ? asked[1].split('\n')[0].replace(/["'「」]/g, '').trim().slice(0, 60) : await searchWords(c);
        if (reply) { reply.remove(); reply = null; }
        await lookUp(query);
        if (!live() || c.stopped) { drop(); return; }
        ({ r, text } = await write(false));
        if (!live() || (c.stopped && !reply)) { drop(); return; }
      }
      if (text && !reply) { say(trail()); reply = chatBubble('ai', ''); } // 「검색」 한 낱말처럼 숨겨 둔 채 끝난 답도 보여 준다
      const cited = (x) => text.includes(`[${x.n}]`);
      const used = searched ? sources : sources.filter(cited);   // 앞서 찾은 자료를 인용했으면 출처도 함께
      if (searched) c.lastSources = sources;                     // 이어 묻는 말은 찾은 자료로 먼저 답한다
      if (text) c.msgs.push({ role: 'assistant', text, sources: used, trail: sys.textContent }); else c.msgs.pop();
      if (reply) { reply.classList.remove('run'); renderAnswer(reply, mine.mask(text)); } else sys.remove();
      if (text) sourceChips(used, text);
      chatScroll();
    } catch (e) {
      c.msgs.pop();
      if (live()) {
        if (reply) reply.remove();
        sys.remove();
        chatBubble('sys warn', AI_ERR[e.message] || `AI가 답하지 못했어요. 다시 물어봐 주세요. (${e.message})`);
      }
    } finally {
      c.running = false; c.cancel = null;
      if (chat === c) setSendMode(false);
    }
  }
  // 입력칸 · 보내기(문서가 준비된 뒤 한 번만 묶는다)
  function bindChat() {
    const text = $('#aiText'), form = $('#aiForm');
    const grow = () => { text.style.height = 'auto'; text.style.height = `${Math.min(112, text.scrollHeight + 2)}px`; };
    text.addEventListener('input', grow);
    // 답하는 중의 엔터는 무시한다(이어서 쓰던 말이 답을 끊지 않게). 멈추기는 단추로만
    text.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (chat && !chat.running) form.requestSubmit(); } });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!chat) return;
      if (chat.running) { chat.stopped = true; if (chat.cancel) chat.cancel(); M.ai.stop(); return; }
      const q = text.value.trim();
      if (!q) return;
      text.value = ''; grow();
      sendChat(q);
    });
    $('#aiChatBack').addEventListener('click', closeChat);
    // 키보드가 올라오면 보이는 높이만큼만 쓴다 — 입력칸이 가려지지 않게
    const vv = window.visualViewport;
    if (vv) {
      const fit = () => {
        document.documentElement.style.setProperty('--vvh', `${vv.height}px`);
        document.body.classList.toggle('ime', vv.height < window.innerHeight - 80);
        if (chat) chatScroll();
      };
      vv.addEventListener('resize', fit); fit();
    }
  }
  // 근거 제목: 최근 것부터, 같은 소식은 하나만
  function headsOf(docs, n = 14) {
    const out = [], join = ctl.g.interests.join(' ');
    for (const d of [...docs].sort((a, b) => b.t - a.t)) {
      if (out.some((h) => M.newsSameStory(h, d.h, join))) continue;
      out.push(d.h);
      if (out.length >= n) break;
    }
    return out;
  }
  function card(icon, title, sub) {
    const c = el('section', 'brief-card');
    const head = el('header', 'brief-head', null, c);
    const ic = el('i', '', null, head); ic.innerHTML = M.iconSvg(ICONS[icon], 15);
    el('b', '', title, head);
    if (sub) el('small', '', sub, head);
    return c;
  }
  function drawMap(a, box, go) {
    const W = 340, H = 300, cx = W / 2, cy = 146, s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'brief-map', role: 'img', 'aria-label': '연결 지도' }, box);
    const edges = svg('g', {}, s), nodes = svg('g', {}, s), pos = new Map([[a.focus, { x: cx, y: cy }]]);
    const relOf = new Map(); for (const r of a.relations) if (r.to && !relOf.has(r.to)) relOf.set(r.to, r.r);
    const top = a.ring1[0] ? a.ring1[0].s : 1;
    a.ring1.forEach((nb, i) => {
      const ang = -Math.PI / 2 + (i + 0.5) * (Math.PI * 2) / a.ring1.length;
      pos.set(nb.w, { x: cx + Math.cos(ang) * 92, y: cy + Math.sin(ang) * 82, ang });
    });
    a.ring2.forEach((nb, i) => {
      const p = pos.get(nb.via), ang = p.ang + (i % 2 ? 0.34 : -0.34);
      pos.set(nb.w, { x: Math.min(W - 30, Math.max(30, cx + Math.cos(ang) * 146)), y: Math.min(H - 22, Math.max(14, cy + Math.sin(ang) * 128)), ang });
    });
    const line = (a0, b0, op, wid, dash) => svg('line', { x1: a0.x, y1: a0.y, x2: b0.x, y2: b0.y, stroke: 'rgba(244,241,234,.9)', 'stroke-opacity': op, 'stroke-width': wid, ...(dash ? { 'stroke-dasharray': '2 4' } : {}) }, edges);
    a.ring1.forEach((nb) => {
      const st = nb.s / top, p = pos.get(nb.w);
      line(pos.get(a.focus), p, 0.16 + st * 0.4, 0.8 + st * 1.4);
      const rel = relOf.get(nb.w);
      if (rel) svg('text', { x: (cx + p.x) / 2, y: (cy + p.y) / 2 + 3, class: 'bm-rel', 'text-anchor': 'middle' }, edges).textContent = rel;
    });
    a.ring2.forEach((nb) => line(pos.get(nb.via), pos.get(nb.w), 0.32, 1, true));
    const node = (w, r, cls, delay) => {
      const p = pos.get(w), g = svg('g', { class: `bm-node ${cls}`, style: `animation-delay:${delay}ms`, tabindex: 0, role: 'button' }, nodes);
      svg('circle', { cx: p.x, cy: p.y, r: 24, fill: 'transparent' }, g);
      svg('circle', { cx: p.x, cy: p.y, r, fill: TYPES[typeOf(w)].color }, g);
      const t = svg('text', { x: p.x, y: p.y + r + 13, 'text-anchor': 'middle' }, g); t.textContent = a.name(w);
      if (w !== a.focus) g.addEventListener('click', () => go(w));
    };
    a.ring2.forEach((nb, i) => node(nb.w, 3.5, 'bm-far', 420 + i * 60));
    a.ring1.forEach((nb, i) => node(nb.w, 4.5 + (nb.s / top) * 3.5, '', 160 + i * 60));
    node(a.focus, 11, 'bm-center', 0);
    const types = [...new Set([a.focus, ...a.ring1.map((x) => x.w), ...a.ring2.map((x) => x.w)].map(typeOf))];
    const lg = el('p', 'brief-legend', null, box);
    for (const t of types) { const sp = el('span', '', TYPES[t].name, lg); sp.style.setProperty('--c', TYPES[t].color); }
  }
  function render() {
    const { g, h, trail, mask } = ctl, focus = trail[trail.length - 1];
    const a = M.briefAnswer(g, { h: trail.length > 1 ? null : h, focus });
    if (!focus && a.focus) trail[trail.length - 1] = a.focus;
    const rawName = a.name; a.name = (w) => mask(rawName(w)); // 주제 이름을 품은 이름도 가린다(회사 이름 등)
    const body = $('#briefBody'); body.innerHTML = ''; body.scrollTop = 0;
    const go = (w) => { M.ai.stop(); trail.push(w); render(); };   // 안 보이게 된 글에 NPU 를 쓰지 않는다
    if (trail.length > 1) {
      const nav = el('nav', 'brief-trail', null, body);
      trail.forEach((w, i) => {
        const b = el('button', i === trail.length - 1 ? 'on' : '', a.name(w), nav); b.type = 'button';
        b.onclick = () => { M.ai.stop(); trail.length = i + 1; render(); };
      });
    }
    if (h) el('p', 'brief-seed', mask(h), body);
    if (!a.focus || a.ctx.length < 2) { el('p', 'brief-empty', '아직 이어 볼 기사가 적어요. 소식이 더 쌓이면 지도가 그려져요.', body); return; }
    // 결론부터
    const lead = el('section', 'brief-lead', null, body), f = a.name(a.focus);
    const near = a.ring1.slice(0, 3).map((x) => a.name(x.w));
    let say = near.length ? `${eun(f)} ${near.slice(0, -1).concat(ro(near[near.length - 1])).join(' · ')} 이어져요.` : `${eun(f)} 아직 혼자 떠 있어요.`;
    if (a.ring2[0]) say += ` 한 다리 건너면 ${a.name(a.ring2[0].w)}까지 닿아요.`;
    el('p', '', say, lead);
    const badges = el('div', 'brief-badges', null, lead);
    const badge = (text, cls) => el('span', cls || '', text, badges);
    const tb = badge(TYPES[typeOf(a.focus)].name, 'type'); tb.style.setProperty('--c', TYPES[typeOf(a.focus)].color);
    badge(`근거 기사 ${a.ctx.length.toLocaleString()}건`);
    if (a.compare) { const d = a.n24 - a.prev24; badge(`24시간 ${a.n24}건 · 전날보다 ${d === 0 ? '같음' : (d > 0 ? `${d}건 많음` : `${-d}건 적음`)}`, d > 0 ? 'up' : ''); } else badge(`24시간 ${a.n24}건`);
    const heads = () => headsOf(a.ctx), rawF = rawName(a.focus), note = `제목 ${a.ctx.length.toLocaleString()}건만 읽고 쓴 글이에요. 틀릴 수 있으니 아래 근거 기사와 함께 보세요.`;
    aiPanel(lead, a.focus, [
      { id: 'brief', label: 'AI 브리핑', main: true, prompt: () => M.aiPrompts.brief(rawF, heads()) },
      {
        label: '물어보기',
        action: () => openChat(a.focus, rawF, heads()),
      },
    ], note);
    // 지도
    const mapC = card('map', '연결 지도', '점을 누르면 그 점으로 다시 엮어요'); body.append(mapC);
    drawMap(a, mapC, go);
    // 건너 이어진 연결 — 왜 이어졌는지 AI 에게 묻는다
    if (a.ring2[0]) {
      const far = a.ring2[0], rawVia = rawName(far.via), rawTo = rawName(far.w);
      aiPanel(mapC, `${a.focus}>${far.w}`, [{
        id: 'link', label: `${a.name(a.focus)}에서 ${a.name(far.w)}까지, 왜 이어졌지?`,
        prompt: () => M.aiPrompts.link(eun(rawF), rawVia + (jong(rawVia) ? '과' : '와'), `${rawTo}도`, headsOf(g.docs.filter((d) => d.words.has(far.via) && (d.words.has(a.focus) || d.words.has(far.w))), 12)),
      }], '두 말이 함께 나온 제목을 따라가며 쓴 풀이예요. 실제 관계라는 뜻은 아니에요.');
    }
    // 관계
    if (a.relations.length) {
      const c = card('link', '오간 일', '제목에 함께 나온 관계'); body.append(c);
      const top = a.relations[0].n;
      for (const r of a.relations) {
        const row = el(r.to ? 'button' : 'div', 'brief-rel', null, c);
        if (r.to) { row.type = 'button'; row.onclick = () => go(r.to); }
        el('b', '', f, row); el('em', '', r.r, row); if (r.to) el('b', '', a.name(r.to), row);
        el('i', '', null, row).style.width = `${Math.max(8, (r.n / top) * 44)}px`;
        el('small', '', `${r.n}건`, row);
      }
    }
    // 흐름
    const flow = card('flow', '오늘의 흐름', '최근 24시간 · 2시간씩'); body.append(flow);
    const bars = el('div', 'brief-bars', null, flow), mx = Math.max(1, ...a.bars);
    a.bars.forEach((n, i) => { const b = el('i', i === 11 ? 'now' : '', null, bars); b.style.height = `${n ? 8 + (n / mx) * 92 : 3}%`; b.title = `${n}건`; });
    const axis = el('p', 'brief-axis', null, flow); el('span', '', '24시간 전', axis); el('span', '', '지금', axis);
    const toneAll = a.good + a.bad;
    if (toneAll) {
      const tone = el('div', 'brief-tone', null, flow), pct = Math.round((a.good / toneAll) * 100);
      el('i', 'good', null, tone).style.width = `${pct}%`; el('i', 'bad', null, tone).style.width = `${100 - pct}%`;
      const leg = el('p', 'brief-axis', null, flow); el('span', '', `밝은 말 ${a.good}건`, leg); el('span', '', `어두운 말 ${a.bad}건`, leg);
    }
    // 관심 주제를 잇는 말
    if (a.bridges.length) {
      const c = card('bridge', '두 관심을 잇는 말', '양쪽 기사에 모두 나왔어요'); body.append(c);
      const wrap = el('div', 'brief-chips', null, c);
      for (const b of a.bridges) { const x = el('button', '', a.name(b.w), wrap); x.type = 'button'; x.style.setProperty('--c', TYPES[typeOf(b.w)].color); x.onclick = () => go(b.w); }
    }
    // 함께 볼 기사
    if (a.related.length) {
      const c = card('doc', '함께 볼 기사', a.same ? `같은 소식 ${a.same}건은 뺐어요` : ''); body.append(c);
      for (const d of a.related) {
        const b = el('button', 'brief-art', null, c); b.type = 'button';
        el('b', '', mask(d.h), b); el('span', '', `${d.s ? `${d.s} · ` : ''}${ago(d.t)}`, b);
        b.onclick = () => ctl.openLink(d.l);
      }
    }
  }
  // { h: 기사 제목, word: 낱말(있으면), db, interests, mask, openLink, onClose }
  M.openBrief = (opt) => {
    ctl = { ...opt, g: M.briefGraph(opt.db, opt.interests), trail: [null], aiCache: new Map(), chats: new Map() };
    if (opt.word) {
      const low = (ALIAS[opt.word.toLowerCase()] || opt.word).toLowerCase();
      if (ctl.g.df.has(low)) ctl.trail = [low];
    }
    $('#brief').hidden = false;
    render();
  };
  // 저장한 기사 엮어 읽기: 정리되기 전에 오늘 저장한 것들이 무슨 이야기였는지
  M.openDigest = (opt) => {
    ctl = { ...opt, aiCache: new Map(), chats: new Map() };
    const body = $('#briefBody'); body.innerHTML = '';
    $('#brief').hidden = false;
    const lead = el('section', 'brief-lead', null, body);
    el('p', '', `저장한 기사 ${opt.items.length}건을 하나의 이야기로 읽어요.`, lead);
    const savedHeads = opt.items.slice(0, 14).map((x) => x.h);
    aiPanel(lead, 'digest', [
      { id: 'digest', label: '엮어 읽기', main: true, prompt: () => M.aiPrompts.digest(savedHeads) },
      { label: '물어보기', action: () => openChat('digest', '저장한 기사', savedHeads) },
    ], '저장한 기사의 제목만 읽고 쓴 글이에요. 틀릴 수 있어요.');
    const c = card('doc', '저장한 기사'); body.append(c);
    for (const d of opt.items) {
      const b = el('button', 'brief-art', null, c); b.type = 'button';
      el('b', '', opt.mask(d.h, d.topic), b); el('span', '', `${d.s ? `${d.s} · ` : ''}${ago(d.t)}`, b);
      b.onclick = () => opt.openLink(d.l);
    }
  };
  M.closeBrief = () => {
    if (!ctl) return;
    closeChat();
    if (!ctl) return;                                         // 바로 연 대화나 미뤄 둔 장면이 이미 닫았다
    const done = ctl.onClose; ctl = null;
    $('#brief').hidden = true;
    M.ai.unload();                                            // 메모리를 바로 돌려준다
    if (done) done();
  };
  M.briefOpen = () => !!ctl;
  document.addEventListener('DOMContentLoaded', () => { const b = $('#briefBack'); if (b) b.addEventListener('click', M.closeBrief); bindChat(); });
})();
