/* 가이드 · 도움말 — 처음 설치하면 한 번 보여 주고, 위쪽 도움말(?) 단추로 언제든 다시 본다.
   카드 그림은 모두 SVG 선 그림(글자 기호 아님) */
(function () {
  'use strict';
  const M = window.M;
  const svg = (inner) => `<svg viewBox="0 0 64 64" width="96" height="96" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

  M.GUIDE = [
    { title: '지나온 시간을 느끼는 시계', art: svg('<path d="M6 44h52" opacity=".5"/><path d="M10 44a22 22 0 0 1 34.6-18" /><path d="M44.6 26A22 22 0 0 1 54 44" stroke-dasharray="1 5"/><circle cx="44.6" cy="26" r="5" fill="currentColor"/><path d="M38 52h10M34 57h18" opacity=".45"/>'),
      body: '지금 나이와 이만큼 살 것 같은 나이만 넣으세요. 숫자 대신 비유와 그림으로 지나온 만큼을 보여 줘요.' },
    { title: '열 때마다 다른 비유', art: svg('<rect x="8" y="14" width="30" height="22" rx="4"/><rect x="26" y="28" width="30" height="22" rx="4"/><path d="M14 22h14M14 28h9M32 36h16M32 42h11"/>'),
      body: '하루 시계 · 마라톤 · 축구 · 서울→부산 KTX · 24절기 · 배터리… 스무 가지가 넘는 비유가 열 때마다 바뀌어요. 위쪽 문장을 누르면 바로 다음 비유로.' },
    { title: '그림이 곧 내 인생', art: svg('<circle cx="32" cy="32" r="22" stroke-dasharray="1 5"/><path d="M32 10a22 22 0 0 1 21 28"/><circle cx="53" cy="38" r="3.6" fill="currentColor"/><circle cx="32" cy="32" r="4"/>'),
      body: '밝게 그려진 만큼이 지나온 삶이에요. 무늬 · 하늘 · 바다는 몇 분마다 천천히 바뀌어서, 켜 둘수록 다른 장면을 만나요.' },
    { title: '손가락으로 만지는 시간', art: svg('<path d="M8 32h48M8 32l6-6M8 32l6 6M56 32l-6-6M56 32l-6 6"/><path d="M28 50c0-6 2-9 4-9s4 3 4 9" opacity=".6"/><circle cx="32" cy="32" r="3" fill="currentColor"/>'),
      body: '화면을 좌우로 끌면 그 나이의 나로 가는 타임머신 — 서른 살의 나는 몇 시였을까? 놓으면 지금으로 돌아와요. 누르면 물결이 퍼져요.' },
    { title: '배경 하나, 관심 주제 둘', art: svg('<circle cx="14" cy="20" r="4" fill="currentColor"/><path d="M24 20h28"/><circle cx="14" cy="32" r="4"/><path d="M24 32h22"/><circle cx="14" cy="44" r="4"/><path d="M24 44h25"/>'),
      body: '배경(우주 · 바다 · 날씨 · 기하 무늬 …)을 하나 고르고, 관심 주제(예: 삼성전자)를 둘까지 넣어요. 위쪽 이름표를 누르면 설정까지 가지 않고 바로 바꿀 수 있어요.' },
    { title: '켜 두는 시계, 조용한 화면 보호기', art: svg('<rect x="18" y="6" width="28" height="52" rx="5"/><circle cx="32" cy="30" r="9" stroke-dasharray="2 3"/><path d="M28 50h8"/><path d="M52 18v-6M58 24h-6" opacity=".6"/>'),
      body: '설정 → 화면에서 켜 두기와 밝기를 정해요. 손대지 않으면 글은 사라지고 그림만 어둡게 남는 화면 보호기가 돼요. 누르면 돌아와요.' },
    { title: '뉴스 특이점 (시험판)', art: svg('<path d="M10 46c8-2 10-14 16-14s7 10 13 10 8-20 15-24"/><circle cx="54" cy="18" r="3.6" fill="currentColor"/><path d="M10 54h44" opacity=".45"/>'),
      body: '글자로 넣은 주제(예: 삼성전자)에 큰 뉴스가 몰리면 화면이 밝아지며 30초 동안 장면이 흘러요. 로켓이 솟고 불꽃이 터지면 좋은 소식, 유성이 떨어지고 유리가 깨지면 나쁜 소식. 글자는 하나도 안 나와요. 지금은 설정의 미리보기로만 볼 수 있어요.' },
  ];

  // first: 처음 설치(마지막 단추가 「시작하기」), onDone: 닫힐 때
  M.openGuide = ({ first = false, onDone } = {}) => {
    const dlg = document.getElementById('guide'), cards = document.getElementById('guideCards'), dots = document.getElementById('guideDots');
    const next = document.getElementById('guideNext'), skip = document.getElementById('guideSkip');
    cards.innerHTML = ''; dots.innerHTML = '';
    M.GUIDE.forEach((c, i) => {
      const el = document.createElement('section'); el.className = 'guide-card';
      el.innerHTML = `<div class="art">${c.art}</div><div class="step">${i + 1} / ${M.GUIDE.length}</div><h3></h3><p></p>`;
      el.querySelector('h3').textContent = c.title; el.querySelector('p').textContent = c.body;
      cards.append(el); dots.append(document.createElement('i'));
    });
    let idx = 0;
    const show = (i, smooth = true) => {
      idx = Math.max(0, Math.min(M.GUIDE.length - 1, i));
      cards.scrollTo({ left: idx * cards.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
      sync();
    };
    const sync = () => {
      [...dots.children].forEach((d, i) => d.classList.toggle('on', i === idx));
      const last = idx === M.GUIDE.length - 1;
      next.textContent = last ? (first ? '시작하기' : '닫기') : '다음';
      skip.textContent = first ? '건너뛰기' : '닫기';
      skip.style.visibility = last ? 'hidden' : 'visible';
    };
    cards.onscroll = () => { const i = Math.round(cards.scrollLeft / Math.max(1, cards.clientWidth)); if (i !== idx) { idx = i; sync(); } };
    const close = () => { dlg.close(); };
    next.onclick = () => (idx === M.GUIDE.length - 1 ? close() : show(idx + 1));
    skip.onclick = close;
    dlg.onclose = () => { if (onDone) onDone(); };
    dlg.oncancel = null;
    if (!dlg.open) dlg.showModal();
    show(0, false);
  };
})();
