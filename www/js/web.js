/* 대화용 웹 읽기 — 작은 모델이 모르는 건 웹에서 찾아 읽고 답하게 한다(시험판 전용, 폰 안 AI 대화에서만 쓴다).
   찾을 때: 검색(DuckDuckGo · Bing · 구글 뉴스) → 위쪽 페이지 본문 읽기 → 질문과 맞는 문단 고르기 → 번호 달린 자료로 모델에 넘긴다. 언제 찾을지는 brief.js 가 정한다.
   API 키 없이 검색 결과 페이지를 읽는 방식이라 개인 시험용이다. 출시하려면 계약한 검색 API 로 바꿔야 한다 — docs/라이선스-검토.md */
(function () {
  'use strict';
  const M = window.M;
  const SKIP = /(news\.google\.|youtube\.com|youtu\.be|instagram\.com|facebook\.com|tiktok\.com|x\.com|twitter\.com)|\.(pdf|zip|mp4|hwp|docx?|pptx?|xlsx?)(\?|$)/i;
  const within = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('late')), ms))]);
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const dom = (html) => new DOMParser().parseFromString(html, 'text/html');
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };

  async function ddg(q) {
    const doc = dom(await M.getText(`https://html.duckduckgo.com/html/?kl=kr-kr&q=${encodeURIComponent(q)}`));
    return [...doc.querySelectorAll('.result')].map((r) => {
      const a = r.querySelector('a.result__a');
      if (!a) return null;
      let url = a.getAttribute('href') || '';
      const m = url.match(/[?&]uddg=([^&]+)/);
      if (m) { try { url = decodeURIComponent(m[1]); } catch (e) { return null; } }
      if (url.startsWith('//')) url = `https:${url}`;
      if (/duckduckgo\.com\/y\.js/.test(url)) return null;     // 광고
      return { title: clean(a.textContent), url, snippet: clean((r.querySelector('.result__snippet') || {}).textContent) };
    }).filter(Boolean);
  }
  async function bing(q) {
    const doc = new DOMParser().parseFromString(await M.getText(`https://www.bing.com/search?format=rss&mkt=ko-KR&q=${encodeURIComponent(q)}`), 'text/xml');
    return [...doc.querySelectorAll('item')].map((it) => ({
      title: clean((it.querySelector('title') || {}).textContent), url: clean((it.querySelector('link') || {}).textContent), snippet: clean((it.querySelector('description') || {}).textContent),
    })).filter((x) => x.url);
  }
  // 본문만: 메뉴 · 광고 · 스크립트를 걷어 내고 문단 목록으로
  const BLOCK = /^(P|LI|H2|H3|BLOCKQUOTE|TD)$/, INLINE = /^(A|B|STRONG|EM|I|U|SPAN|FONT|MARK|SUB|SUP)$/;
  // 그 영역의 글을 차례대로 문단으로: 문단 태그는 통째로, 그 밖은 줄바꿈(br)과 덩어리 태그에서 끊는다(본문을 br 로만 나눈 언론사가 많다)
  function collect(root) {
    const seen = new Set(), out = [];
    const push = (raw) => { const t = clean(raw); if (t.length >= 25 && !seen.has(t)) { seen.add(t); out.push(t); } };
    (function walk(e) {
      let buf = '';
      const flush = () => { push(buf); buf = ''; };
      for (const c of e.childNodes) {
        if (c.nodeType === 3) buf += c.nodeValue;
        else if (c.nodeType !== 1) continue;
        else if (c.tagName === 'BR') flush();
        else if (INLINE.test(c.tagName) && !c.querySelector('p,div,br,li')) buf += c.textContent;
        else if (BLOCK.test(c.tagName) && !c.querySelector('p,div,li')) { flush(); push(c.textContent); }
        else { flush(); walk(c); }
      }
      flush();
    })(root);
    return out;
  }
  // 글이 바로 아래에 가장 많이 모인 영역 = 본문(메뉴 · 추천 기사 목록은 글이 여러 상자에 흩어져 있다)
  function mainBlock(doc) {
    let best = null, most = 0;
    for (const e of doc.body.querySelectorAll('div,article,section,main,td')) {
      let len = 0, buf = '';
      const add = (raw) => { const t = clean(raw); if (t.length >= 25) len += t.length; };
      for (const c of e.childNodes) {
        if (c.nodeType === 3) buf += c.nodeValue;
        else if (c.nodeType !== 1) continue;
        else if (INLINE.test(c.tagName)) buf += c.textContent;
        else { add(buf); buf = ''; if (c.tagName === 'P' || c.tagName === 'BLOCKQUOTE') add(c.textContent); }
      }
      add(buf);
      if (len > most) { best = e; most = len; }
    }
    return most >= 300 ? best : null;
  }
  // 화면을 스크립트로 그리는 언론사: 페이지에 든 기사 데이터(JSON-LD articleBody · {"type":"text","content":…} 조각)에서 꺼낸다
  function embedded(html) {
    let body = '';
    for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        const scan = (o) => {
          if (!o || typeof o !== 'object') return;
          if (typeof o.articleBody === 'string' && o.articleBody.length > body.length) body = o.articleBody;
          for (const k in o) scan(o[k]);
        };
        scan(JSON.parse(m[1]));
      } catch (e) { /* 깨진 JSON 은 건너뛴다 */ }
    }
    if (body.length >= 300) return body.split(/\n+|(?<=[.?!다])\s+(?=[^\s])/).map(clean).filter((t) => t.length >= 25);
    const parts = [];
    for (const m of html.matchAll(/\{[^{}]*"type":"text"[^{}]*\}/g)) {
      try { const c = JSON.parse(m[0]).content; if (typeof c === 'string') parts.push(clean(c.replace(/<[^>]+>/g, ' '))); } catch (e) { /* 다음 조각 */ }
    }
    return parts.filter((t) => t.length >= 25);
  }
  // 본문만: 메뉴 · 광고 · 스크립트를 걷어 내고 문단 목록으로
  async function read(url) {
    const html = await M.getText(url);
    if ((html.match(/�/g) || []).length > 40) return [];   // 인코딩이 깨진 페이지
    const doc = dom(html);
    doc.querySelectorAll('script,style,noscript,nav,header,footer,aside,form,iframe,svg,button,select,figure,figcaption,.ad,.ads,.advert,.comment,.comments,.related,.share,.sidebar').forEach((e) => e.remove());
    if (!doc.body) return [];
    const total = (list) => list.reduce((a, t) => a + t.length, 0);
    const block = mainBlock(doc);
    let out = block ? collect(block) : [];
    if (total(out) < 300) {
      const alt = collect(doc.querySelector('[itemprop=articleBody]') || doc.querySelector('article') || doc.querySelector('main') || doc.body);
      if (total(alt) > total(out)) out = alt;
    }
    if (total(out) < 400) {
      const emb = embedded(html);
      if (total(emb) > total(out)) out = emb;
    }
    return out;
  }
  // 조사 · 어미를 뗀 낱말이 많이 든 문단을 고른다. 앞쪽 문단에 가산점(글의 첫머리는 대개 요약이다)
  const words = (s) => [...new Set((s.toLowerCase().match(/[가-힣a-z0-9]{2,}/g) || []).map((w) => (/[가-힣]/.test(w) && w.length > 2 ? M.stripParticle(w) : w)))];
  function pick(paras, ws, budget) {
    const scored = paras.map((t, i) => {
      const low = t.toLowerCase();
      return { t, i, s: ws.filter((w) => low.includes(w)).length + Math.max(0, 0.6 - i * 0.04) };
    }).filter((x) => x.s > 0.5).sort((a, b) => b.s - a.s);
    const out = []; let used = 0;
    for (const x of scored) {
      if (used >= budget) break;
      const t = x.t.slice(0, budget - used);
      out.push({ i: x.i, t }); used += t.length;
    }
    return out.sort((a, b) => a.i - b.i).map((x) => x.t).join(' ');
  }
  // 말하듯 쓴 질문에서 찾을 낱말만 — 구글 뉴스는 모든 낱말이 맞아야 나와서 「샘 올트먼이 이번에 한국 와서 뭐 했어?」는 0건이다
  const CHATTER = new Set('뭐 뭐야 뭐지 뭔가 왜 어떻게 어때 어디 어디야 언제 언제야 누구 누구야 누가 얼마 얼마야 얼마나 얼마였어 무슨 어떤 이번 오늘 어제 내일 요즘 최근 최신 지금 현재 방금 다음 그럼 그거 거기 저기 이거 와서 가서 있어 없어 됐어 될까 알려줘 말해줘 찾아줘 찾아봐 검색해 설명해줘 정리해줘 뉴스 기사 소식'.split(' '));
  const SPOKEN_END = /(했어|았어|었어|였어|했니|했나|했지|했냐|했음|한다|하나|해줘|해봐|려줘|해요|나요|까요|어요|아요|있어|없어|있나|없나|인가)$/;
  const keywords = (q) => words(q).filter((w) => !CHATTER.has(w) && !SPOKEN_END.test(w)).slice(0, 5);
  async function newsFor(provider, kws) {
    if (!provider || !kws.length) return [];
    const got = await within(provider.fetch(kws.join(' ')), 5000).catch(() => []);
    if (got.length || kws.length < 3) return got;
    return within(provider.fetch(kws.slice(0, 2).join(' ')), 4000).catch(() => []);   // 낱말이 많아 안 나오면 앞의 둘로
  }
  // 구글 뉴스 링크 안에 원문 주소가 그대로 든 옛 꼴이면 꺼낸다(요즘 꼴은 주소가 없어 제목으로 찾는다)
  function fromGoogle(link) {
    const m = (link || '').match(/\/articles\/([A-Za-z0-9_-]+)/);
    if (!m) return '';
    try {
      const bin = atob(m[1].replace(/-/g, '+').replace(/_/g, '/'));
      const u = bin.match(/https?:\/\/[!-~]+/);
      return u && !/news\.google\./.test(u[0]) ? u[0] : '';
    } catch (e) { return ''; }
  }
  // 요즘 꼴: 구글 뉴스 기사 페이지에 든 서명 · 시각으로 원문 주소를 물어본다(브라우저가 그 링크를 열 때 하는 일과 같다).
  // 구글 안쪽 창구라 언제든 막힐 수 있다 — 개인 시험판에서만 쓰고, 출시판은 원문 주소를 주는 계약 출처로 바꾼다
  async function askGoogle(link) {
    const m = (link || '').match(/\/articles\/([A-Za-z0-9_-]+)/);
    if (!m) return '';
    const page = await M.getText(`https://news.google.com/rss/articles/${m[1]}`);
    const sg = (page.match(/data-n-a-sg="([^"]+)"/) || [])[1], ts = (page.match(/data-n-a-ts="([^"]+)"/) || [])[1];
    if (!sg || !ts) return '';
    const inner = JSON.stringify(['garturlreq', [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0], m[1], +ts, sg]);
    const res = await M.postForm('https://news.google.com/_/DotsSplashUi/data/batchexecute', { 'f.req': JSON.stringify([[['Fbv4je', inner, null, 'generic']]]) });
    const line = res.split(String.fromCharCode(10)).find((x) => x.startsWith('[["wrb.fr"'));
    if (!line) return '';
    const got = JSON.parse(JSON.parse(line)[0][2]);
    return got[0] === 'garturlres' && /^https?:/.test(got[1]) ? got[1] : '';
  }
  // 기사 끝의 기자 연락처 · 저작권 · 구독 안내 같은 줄은 본문이 아니다
  const JUNK = /무단\s?전재|재배포\s?금지|저작권자|Copyright|ⓒ|©|구독|제보|기자\s*=|[\w.+-]+@[\w-]+\.[\w.]+|관련\s?기사|많이 본|댓글|로그인|공유하기|카카오톡|페이스북|글자\s?크기|인쇄|스크랩/;
  // 기사 한 편의 본문을 찾아 읽는다 — 저장한 기사 · 쪽지의 「AI 정리」. 구글 뉴스 링크에서 원문 주소를 얻고, 안 되면 제목으로 찾는다.
  // 제목 낱말이 절반 넘게 맞는 페이지만 그 기사로 본다. → { url, host, title, text } — 본문을 못 읽었으면 text 가 비고, 원문 주소도 못 찾으면 null(지어내지 않게 부르는 쪽이 멈춘다)
  async function article(item, { onStep = () => {}, budget = 2400 } = {}) {
    const ws = words(item.h), need = Math.max(2, Math.ceil(ws.length * 0.5));
    const hit = (text) => { const low = (text || '').toLowerCase(); return ws.filter((w) => low.includes(w)).length; };
    const body = (paras) => {
      const out = []; let used = 0;
      for (const t of paras) {
        if (used >= budget) break;
        if (JUNK.test(t) && t.length < 160) continue;
        const cut = t.slice(0, budget - used);
        out.push(cut); used += cut.length + 1;
      }
      return out.join(String.fromCharCode(10));
    };
    // text 가 비면 그 기사 본문을 읽지 못한 것(why: read 본문 없음 · match 제목과 다른 글)
    // sure: 구글 뉴스 링크가 가리킨 바로 그 기사 — 제목 낱말을 덜 깐깐하게 본다(로그인 안내 같은 다른 글만 거른다)
    const tryRead = async (url, title, sure) => {
      const paras = await within(read(url), 7000).catch(() => []);
      const text = body(paras), ok = text.length >= 200 && hit(text) >= (sure ? Math.min(2, need) : need);
      return { url, title: title || item.h, host: host(url), text: ok ? text : '', why: ok ? '' : text.length < 200 ? 'read' : 'match' };
    };
    onStep('find');
    const direct = fromGoogle(item.l) || await within(askGoogle(item.l), 9000).catch(() => '');
    let first = null;
    if (direct && !SKIP.test(direct)) { onStep('read'); first = await tryRead(direct, item.h, true); if (first.text) return first; }
    const [a, b] = await Promise.all([within(ddg(item.h), 6000).catch(() => []), within(bing(item.h), 6000).catch(() => [])]);
    const seen = new Set(), cands = [];
    for (const r of [...a, ...b]) {
      const key = r.url.replace(/[#?].*$/, '').replace(/[/]$/, '');
      if (!r.url.startsWith('http') || seen.has(key) || SKIP.test(r.url)) continue;
      seen.add(key);
      const s = hit(r.title);
      if (s >= need) cands.push({ r, s });
    }
    cands.sort((x, y) => y.s - x.s);
    if (cands.length) {
      onStep('read');
      const got = (await Promise.all(cands.slice(0, 3).map((c) => tryRead(c.r.url, c.r.title)))).find((x) => x.text);
      if (got) return got;
    }
    return first;                                             // 원문 주소는 알지만 본문을 못 읽었거나(text ''), 아무것도 못 찾았으면 null
  }
  // → { sources: [{ n, title, url, text }], searched: 건수, pages: 읽은 페이지 수 }. onStep('search') · onStep('read', 페이지 수)로 단계를 알려 준다
  M.web = {
    host, keywords, article, read,
    async gather(query, { heads = [], onStep = () => {}, budget = 2600 } = {}) {
      const kws = keywords(query), ws = kws.length ? kws : words(query);
      onStep('search');
      const [a, b, n] = await Promise.all([
        within(ddg(query), 6000).catch(() => []),
        within(bing(query), 6000).catch(() => []),
        newsFor(M.newsProvider && M.newsProvider(), kws),
      ]);
      const seen = new Set(), results = [];
      for (const r of [...a, ...b]) {
        const key = r.url.replace(/[#?].*$/, '').replace(/\/$/, '');
        if (!r.url.startsWith('http') || seen.has(key)) continue;
        seen.add(key); results.push(r);
      }
      const readable = results.filter((r) => !SKIP.test(r.url));
      if (readable.length) onStep('read', Math.min(4, readable.length));
      const pages = await Promise.all(readable.slice(0, 4).map((r) => within(read(r.url), 6000).then((p) => ({ r, p })).catch(() => ({ r, p: [] }))));
      const sources = [];
      let left = budget;
      const add = (title, url, text) => { if (text && left > 60) { const t = text.slice(0, left); sources.push({ n: sources.length + 1, title, url, text: t }); left -= t.length + 20; } };
      // 뉴스 제목을 먼저 넣는다 — 오늘 일에는 가장 믿을 만하고, 페이지 본문이 칸을 다 차지하면 뉴스가 모델에 닿지 못한다
      // 질문 낱말이 절반 이상 맞는 제목만(「2026년」 하나만 맞는 운세 기사가 끼지 않게)
      const need = Math.ceil(ws.length / 2);
      const fresh = n.filter((x) => ws.filter((w) => x.h.toLowerCase().includes(w)).length >= need).slice(0, 6);
      const titles = [...new Set([...fresh.map((x) => x.h), ...heads.slice(0, 5)])];
      if (titles.length) add('최근 뉴스 제목', (fresh[0] && fresh[0].l) || '', titles.join(' / ').slice(0, 520));
      const worth = pages.filter((x) => x.p.length || x.r.snippet);
      const perPage = Math.min(1000, Math.floor(left / Math.max(1, worth.length)) - 20);
      for (const { r, p } of worth) add(r.title, r.url, pick(p, ws, perPage) || r.snippet);
      for (const r of results.slice(0, 8)) if (!sources.some((s) => s.url === r.url) && r.snippet) add(r.title, r.url, r.snippet.slice(0, 160));
      return { sources, searched: results.length, pages: pages.filter((x) => x.p.length).length, news: fresh.length };
    },
  };
})();
