/* 뉴스 받기 — 개인 시험판(구글 뉴스 RSS).
   구글 피드 약관: "personal feed reader for personal, non-commercial use … Any other use … prohibited" → 출시판(release 빌드)에서는 꺼진다.
   출시용은 계약한 출처(딥서치 · 빅카인즈 등)로 바꾼다 — docs/라이선스-검토.md.
   흐름: 주제마다 최근 하루 기사 제목을 받아 기기 안 기록(최대 7일)에 쌓고, 최근 3시간 기사 수를 평소 3시간 평균과 비교 → detectSignal */
(function () {
  'use strict';
  const M = window.M;

  const decode = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  // RSS → [{ t: 발행 시각(ms), h: 제목(언론사 이름 뗌) }]
  M.parseRss = (xml) => {
    const out = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const b = m[1];
      const tag = (n) => { const r = b.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`)); return r ? decode(r[1]).trim() : ''; };
      const src = tag('source');
      let h = tag('title');
      if (src && h.endsWith(` - ${src}`)) h = h.slice(0, -(src.length + 3));
      const t = Date.parse(tag('pubDate'));
      if (h && !isNaN(t)) out.push({ t, h });
    }
    return out;
  };

  // 앱에서는 안드로이드 쪽 HTTP(CapacitorHttp — 웹뷰의 CORS 제한을 안 받는다), 브라우저에서는 fetch
  async function getText(url) {
    const cap = window.Capacitor, H = cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins.CapacitorHttp;
    if (H) {
      const r = await H.get({ url, responseType: 'text', headers: { 'Accept-Language': 'ko-KR,ko' } });
      if (r.status !== 200) throw new Error(`뉴스 ${r.status}`);
      return typeof r.data === 'string' ? r.data : String(r.data);
    }
    const r = await fetch(url);
    if (!r.ok) throw new Error(`뉴스 ${r.status}`);
    return r.text();
  }
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
  // store: { [주제]: { items, fired, checked, recent, baseline } } — 기기 안에만 둔다
  M.newsCheck = (topic, items, store, now = Date.now()) => {
    const rec = store[topic] || (store[topic] = { items: [], fired: null, checked: 0 });
    const seen = new Set(rec.items.map((x) => x.h));
    for (const it of items) if (!seen.has(it.h) && it.t <= now + 600e3) { rec.items.push(it); seen.add(it.h); }
    rec.items = rec.items.filter((x) => now - x.t < 7 * DAY).sort((a, b) => a.t - b.t).slice(-1500);
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
