/* 주제 아이콘 — 설정에서 "아이콘으로" 고를 때 · 위쪽 주제 칩에 쓴다(SVG 선 그림, 24칸).
   theme: 저장되는 주제 값. 기하 무늬 하나만 고를 때는 '@무늬이름'(geometry.js 가 알아듣는다) */
(function () {
  'use strict';
  const M = window.M;
  const f = (n) => Math.round(n * 100) / 100;
  // 수식으로 그리는 아이콘 경로
  const curve = (fn, n = 160) => {
    let d = '';
    for (let i = 0; i <= n; i++) { const [x, y] = fn(i / n); d += `${i ? 'L' : 'M'}${f(x)} ${f(y)}`; }
    return `<path d="${d}"/>`;
  };
  const harmono = curve((u) => { const s = u * 60, e = Math.exp(-0.03 * s); return [12 + 9.5 * e * Math.sin(1.003 * s + 1), 12 + 9.5 * e * Math.sin(2 * s)]; }, 400);
  const knot = curve((u) => { const s = u * Math.PI * 2; return [12 + 9.5 * Math.sin(3 * s + 0.6), 12 + 9.5 * Math.sin(2 * s)]; });
  const spiro = curve((u) => { const s = u * Math.PI * 2 * 3, r = 0.42, d = 0.62, sc = 1 - r + d; return [12 + (9.5 * ((1 - r) * Math.cos(s) + d * Math.cos(((1 - r) / r) * s))) / sc, 12 + (9.5 * ((1 - r) * Math.sin(s) - d * Math.sin(((1 - r) / r) * s))) / sc]; }, 300);
  const rose = curve((u) => { const s = u * Math.PI * 2, r = 9.5 * Math.cos(2 * s); return [12 + r * Math.cos(s), 12 + r * Math.sin(s)]; });
  const phyllo = (() => {
    let g = '<g fill="currentColor" stroke="none">';
    for (let i = 1; i < 34; i++) { const r = 9.5 * Math.sqrt(i / 34), a = i * 2.39996; g += `<circle cx="${f(12 + r * Math.cos(a))}" cy="${f(12 + r * Math.sin(a))}" r="${f(0.55 + 0.6 * (i / 34))}"/>`; }
    return `${g}</g>`;
  })();

  M.THEME_ICONS = [
    { id: 'weather', label: '날씨', theme: '날씨', svg: '<circle cx="9" cy="8.5" r="3.5"/><path d="M9 2v1.5M2.5 8.5H4M4.4 3.9l1 1M13.6 3.9l-1 1"/><path d="M8 20h9a3.6 3.6 0 0 0 0-7.2 4.6 4.6 0 0 0-8.8 1.5A2.9 2.9 0 0 0 8 20z"/>' },
    { id: 'ocean', label: '바다', theme: '바다', svg: '<path d="M2 9c2.5-2 4.5-2 7 0s4.5 2 7 0 4-2 6 0M2 14c2.5-2 4.5-2 7 0s4.5 2 7 0 4-2 6 0M2 19c2.5-2 4.5-2 7 0s4.5 2 7 0 4-2 6 0"/>' },
    { id: 'space', label: '우주', theme: '우주', svg: '<ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(-18 12 12)"/><circle cx="12" cy="12" r="2.6"/><circle cx="20.2" cy="8.6" r="1.4" fill="currentColor"/>' },
    { id: 'moon', label: '달', theme: '달', svg: '<path d="M19.5 15A8.5 8.5 0 1 1 9 4.5 7 7 0 0 0 19.5 15z"/>' },
    { id: 'tree', label: '나무', theme: '나무', svg: '<path d="M12 22v-9M12 16l-3.5-3.5M12 14l3-3"/><path d="M7 14.5a5 5 0 0 1-.5-9.4A5.5 5.5 0 0 1 17.4 5a5 5 0 0 1-.4 9.5"/>' },
    { id: 'season', label: '계절', theme: '계절', svg: '<path d="M5 19C5 10.5 11 5 20 4.5 19.5 13.5 14 19 5.5 19"/><path d="M5 19l8.5-8.5"/>' },
    { id: 'hourglass', label: '모래시계', theme: '모래시계', svg: '<path d="M6 3h12M6 21h12"/><path d="M7.5 3c0 5 9 5.5 9 9s-9 4-9 9M16.5 3c0 5-9 5.5-9 9s9 4 9 9"/><path d="M9.5 19.5h5l-2.5-2z" fill="currentColor"/>' },
    { id: 'harmono', label: '진자 무늬', theme: '@harmono', svg: harmono },
    { id: 'spiro', label: '나선 꽃', theme: '@spiro', svg: spiro },
    { id: 'rose', label: '장미 곡선', theme: '@rose', svg: rose },
    { id: 'rings', label: '겹 도형', theme: '@rings', svg: '<path d="M12 2.5l9 6.6-3.4 10.6H6.4L3 9.1z"/><path d="M12 7l4.8 3.5-1.8 5.6H9l-1.8-5.6z"/><path d="M12 10.4l1.6 1.2-.6 1.9h-2l-.6-1.9z"/>' },
    { id: 'phyllo', label: '씨앗 배열', theme: '@phyllo', svg: phyllo },
    { id: 'moire', label: '물결 간섭', theme: '@moire', svg: '<circle cx="10" cy="12" r="3"/><circle cx="10" cy="12" r="6.5"/><circle cx="14" cy="12" r="3"/><circle cx="14" cy="12" r="6.5"/><circle cx="12" cy="12" r="10"/>' },
    { id: 'lissa3d', label: '매듭', theme: '@lissa3d', svg: knot },
    { id: 'mix', label: '여러 무늬', theme: '@mix', svg: '<circle cx="7" cy="7" r="4"/><path d="M14 3.5l7 3.5-7 3.5z"/><path d="M3 17.5c1.5-2 3-2 4.5 0s3 2 4.5 0"/><circle cx="17.5" cy="17.5" r="1.2" fill="currentColor"/><circle cx="17.5" cy="17.5" r="3.5"/>' },
  ];
  M.iconSvg = (svg, size = 22) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${svg}</svg>`;
  // 주제 값 → 아이콘 항목(없으면 null) — 글자로 넣은 주제가 아이콘 이름과 같아도 아이콘을 보여 준다
  M.themeIcon = (theme) => M.THEME_ICONS.find((i) => i.theme === (theme || '').trim()) || null;
})();
