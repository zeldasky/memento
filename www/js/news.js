/* 뉴스 받기 — 개인 시험판(구글 뉴스 RSS).
   구글 피드 약관: "personal feed reader for personal, non-commercial use … Any other use … prohibited" → 출시판(release 빌드)에서는 꺼진다.
   출시용은 계약한 출처(딥서치 · 빅카인즈 등)로 바꾼다 — docs/라이선스-검토.md.
   흐름: 주제마다 최근 하루 기사 제목을 받아 기기 안 기록(최대 7일)에 쌓고, 최근 3시간 기사 수를 평소 3시간 평균과 비교 → detectSignal */
(function () {
  'use strict';
  const M = window.M;

  const decode = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  // RSS → [{ t: 발행 시각(ms), h: 제목(언론사 이름 뗌 — 한 줄 요약으로 쓴다), l: 링크, s: 언론사 }]
  M.parseRss = (xml) => {
    const out = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const b = m[1];
      const tag = (n) => { const r = b.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`)); return r ? decode(r[1]).trim() : ''; };
      const src = tag('source');
      let h = tag('title');
      if (src && h.endsWith(` - ${src}`)) h = h.slice(0, -(src.length + 3));
      const t = Date.parse(tag('pubDate'));
      if (h && !isNaN(t)) out.push({ t, h, l: tag('link'), s: src });
    }
    return out;
  };

  // 앱에서는 안드로이드 쪽 HTTP(CapacitorHttp — 웹뷰의 CORS 제한을 안 받는다), 브라우저에서는 fetch
  async function getText(url) {
    const cap = window.Capacitor, H = cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins.CapacitorHttp;
    if (H) {
      const r = await H.get({ url, responseType: 'text', connectTimeout: 6000, readTimeout: 8000, headers: { 'Accept-Language': 'ko-KR,ko', 'User-Agent': 'Mozilla/5.0 (Linux; Android 16; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36' } });
      if (r.status !== 200) throw new Error(`뉴스 ${r.status}`);
      return typeof r.data === 'string' ? r.data : String(r.data);
    }
    const r = await fetch(url);
    if (!r.ok) throw new Error(`뉴스 ${r.status}`);
    return r.text();
  }
  M.getText = getText;
  M.fetchTopicNews = (topic) =>
    getText(`https://news.google.com/rss/search?q=${encodeURIComponent(`${topic} when:1d`)}&hl=ko&gl=KR&ceid=KR:ko`).then(M.parseRss);

  // 뉴스 출처 갈아 끼우기 — 앱의 나머지는 provider.fetch(주제) → [{t, h}] 만 안다.
  // 나중에 우리 서버(계약한 출처)가 생기면 build.js 의 newsServer 에 주소를 넣는다:
  //   GET {newsServer}/v1/headlines?topic=삼성전자 → [{ "t": 발행 시각(ms), "h": "제목" }, …]
  M.NEWS_PROVIDERS = {
    google: { id: 'google', name: '구글 뉴스 (개인 시험판)', fetch: M.fetchTopicNews },
    server: {
      id: 'server', name: '메멘토 뉴스 서버',
      fetch: async (topic) => JSON.parse(await getText(`${M.BUILD.newsServer.replace(/\/$/, '')}/v1/headlines?topic=${encodeURIComponent(topic)}`)),
    },
  };
  // 서버 주소가 있으면 서버, 없으면 출시판이 아닐 때만 구글(약관상 개인 시험용), 출시판은 없음(뉴스 꺼짐)
  M.newsProvider = () => {
    const b = M.BUILD || {};
    if (b.newsServer) return M.NEWS_PROVIDERS.server;
    return b.channel === 'release' ? null : M.NEWS_PROVIDERS.google;
  };

  const H3 = 3 * 3600e3, DAY = 864e5;
  // 떠다니는 쪽지에 붙일 짧은 낱말: 제목에 많이 나온 말(주제 이름 · 뻔한 말 · 동사 끝 말 뺌)과, 그 말이 든 기사 하나씩(겹치지 않게)
  const KW_STOP = new Set(['오늘', '내일', '어제', '올해', '내년', '작년', '지난해', '전년', '대비', '분기', '기록', '발표', '관련', '이번', '속보', '종합', '단독', '정부', '시장', '이유', '까닭', '위해', '대한', '위한', '통해', '이후', '때문', '따라', '오는', '지난', '최근', '전망', '있는', '없는', '하는', '되는', '것으로', '가운데', '사실', '결국', '다시', '또', '뉴스', '기자', '영상', '사진', '포토', '공개', '진행', '개최', '한국', '국내', '글로벌', '세계', '오전', '오후', '이상', '이하', '가장', '모두', '함께', '시대', '기반', '미래', '혁신', '속도', '강화', '추진', '확대', '활용', '개최', '본격화', '만에', '넘어', '따른', '바꾸', '바꿀', '만난', '만났다', '주목', '전략', '사업', '기업', '증가', '현장', '지원', '목표', '성과', '전환', '모색', '가속', '고도화', '새로운', '차세대', '판단', '제시', '선언', '개편', '확장', '공유', '방안', '다음', '사진', '머니투데', 'ebn', 'by', 'hi', '논의']);
  const KW_PARTICLE = /(에서|으로|까지|부터|은|는|이|가|을|를|의|에|로|와|과|도|만)$/;
  const KW_VERB = /(다|까|며|면서|라고|하고|했고|해서|지만|는데|려면|했던|하며)$/;
  M.stripParticle = (raw) => { const cut = raw.replace(KW_PARTICLE, ''); return cut.length >= 2 ? cut : raw; };
  // 제목 속 주제 이름을 가린다. 영어 주제는 낱말째만(ai 가 said 를 건드리지 않게), 대소문자 없이
  M.maskTopics = (text, topics) => {
    for (const t of new Set(topics.filter(Boolean))) {
      const e = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      text = text.replace(/^[A-Za-z0-9 ]+$/.test(t) ? new RegExp(`(?<![A-Za-z])${e}(?![A-Za-z])`, 'gi') : new RegExp(e, 'gi'), '○○');
    }
    return text;
  };
  M.newsKeywords = (items, topic, n = 6, skipWords = new Set()) => {
    const tk = M.tokens(topic), found = new Map();
    for (const it of items) {
      const seen = new Set();
      for (const raw of it.h.replace(/\[[^\]]*\]/g, ' ').split(/[^가-힣A-Za-z0-9]+/)) {
        const cut = raw.replace(KW_PARTICLE, ''), w = (cut.length >= 2 ? cut : raw).toLowerCase();
        if (w.length < 2 || w.length > 6 || /^[0-9]/.test(w) || KW_STOP.has(w) || skipWords.has(w) || KW_VERB.test(w) || seen.has(w)) continue;
        if (tk.some((x) => x.includes(w) || w.includes(x))) continue;
        seen.add(w);
        const f = found.get(w) || { word: cut.length >= 2 ? cut : raw, count: 0, items: [] };
        f.count += 1; f.items.push(it); found.set(w, f);
      }
    }
    const used = new Set(), out = [];
    for (const f of [...found.values()].sort((a, b) => b.count - a.count || b.word.length - a.word.length)) {
      const it = f.items.find((x) => !used.has(x.h));
      if (!it) continue;
      used.add(it.h); out.push({ word: f.word, count: f.count, item: it });
      if (out.length >= n) break;
    }
    return out;
  };
  // 같은 소식인가: 언론사마다 제목이 조금씩 달라도, 주제 이름을 뺀 낱말이 60% 넘게 겹치면 같은 기사로 본다
  const headWords = (h, topic) => {
    const tk = M.tokens(topic);
    return new Set(h.replace(/\[[^\]]*\]/g, ' ').split(/[^가-힣A-Za-z0-9]+/).map((r) => { const c = r.replace(KW_PARTICLE, ''); return (c.length >= 2 ? c : r).toLowerCase(); })
      .filter((w) => w.length >= 2 && !tk.some((x) => x.includes(w) || w.includes(x))));
  };
  M.newsSameStory = (a, b, topic) => {
    if (a === b) return true;
    const A = headWords(a, topic), B = headWords(b, topic), few = Math.min(A.size, B.size);
    if (few < 3) return false;
    let both = 0;
    for (const w of A) if (B.has(w)) both++;
    return both / few >= 0.6;
  };
  // 최근 기사(새것부터, 링크 있는 것만)
  M.newsLatest = (rec, n = 30) => ((rec && rec.items) || []).filter((x) => x.l).sort((a, b) => b.t - a.t).slice(0, n);
  // store: { [주제]: { items, fired, checked, recent, baseline } } — 기기 안에만 둔다
  M.newsCheck = (topic, items, store, now = Date.now()) => {
    const rec = store[topic] || (store[topic] = { items: [], fired: null, checked: 0 });
    const seen = new Map(rec.items.map((x) => [x.h, x]));
    for (const it of items) {
      if (it.t > now + 600e3) continue;
      const old = seen.get(it.h);
      if (old) { if (it.l) { old.l = it.l; old.s = it.s; } } else { rec.items.push(it); seen.set(it.h, it); }
    }
    rec.items = rec.items.filter((x) => now - x.t < 7 * DAY).sort((a, b) => a.t - b.t).slice(-1500);
    // 링크는 길어서 이틀 지난 기사는 뗀다(기기 저장 공간) — 저장함에 넣은 기사는 따로 보관돼 있다
    for (const x of rec.items) if (now - x.t > 2 * DAY) { delete x.l; delete x.s; }
    rec.checked = now;
    const recent = rec.items.filter((x) => now - x.t <= H3), older = rec.items.filter((x) => now - x.t > H3);
    // 평소 3시간 평균: 기록이 덮는 기간(최대 7일, 처음엔 받은 하루치)에서 최근 3시간을 뺀 나머지로
    const span = Math.min(7 * DAY, Math.max(DAY, now - (rec.items[0] ? rec.items[0].t : now)));
    const baseline = Math.max(3, older.length / Math.max(1, (span - H3) / H3)); // 원래 기사가 적은 주제가 한두 건으로 울리지 않게
    rec.recent = recent.length; rec.baseline = Math.round(baseline * 10) / 10;
    const sig = M.detectSignal(topic, recent.map((x) => x.h), baseline);
    if (!sig) return null;
    if (rec.fired && now - rec.fired.t < 6 * 3600e3) return null; // 같은 주제는 6시간에 한 번만
    rec.fired = { t: now, word: sig.word, tone: sig.tone };
    return sig;
  };
})();
