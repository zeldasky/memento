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
  async function read(url) {
    const html = await M.getText(url);
    if ((html.match(/�/g) || []).length > 40) return [];   // 인코딩이 깨진 페이지
    const doc = dom(html);
    doc.querySelectorAll('script,style,noscript,nav,header,footer,aside,form,iframe,svg,button,select,.ad,.ads,.advert,.comment,.comments,.related,.share,.sidebar').forEach((e) => e.remove());
    const root = doc.querySelector('article') || doc.querySelector('main') || doc.querySelector('[itemprop=articleBody]') || doc.body;
    if (!root) return [];
    const seen = new Set(), out = [];
    for (const e of root.querySelectorAll('p,li,h2,h3,td,blockquote,div')) {
      if (e.tagName === 'DIV' && e.querySelector('p,li,div,table')) continue;  // 글이 바로 든 div 만
      const t = clean(e.textContent);
      if (t.length < 25 || seen.has(t)) continue;
      seen.add(t); out.push(t);
    }
    if (!out.length) {
      const t = clean(root.textContent);
      for (let i = 0; i < t.length && i < 12000; i += 350) out.push(t.slice(i, i + 350));
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
  // → { sources: [{ n, title, url, text }], searched: 건수, pages: 읽은 페이지 수 }. onStep('search') · onStep('read', 페이지 수)로 단계를 알려 준다
  M.web = {
    host, keywords,
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
