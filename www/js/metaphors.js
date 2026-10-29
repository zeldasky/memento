/* 비유 — 앱을 열 때마다 "인생을 ○○로 치면"이 바뀐다. 하루 시계 · 1년 달력 · 마라톤 · 축구 · KTX · 24절기 · 배터리 …
   say(p, c, pk) → { big, suf, note }   p: 지나온 비율(0~1), c: { age, lifespan }, pk: 세션 표현 고르기
   big 이 크게, suf 는 big 옆에 작게, note 는 아래 한 줄. 1 을 넘으면(기대 나이를 넘김) OVER 에서 고른다 */
(function () {
  'use strict';
  const M = window.M;
  // [상한, 값] 목록에서 p 가 들어가는 칸
  const band = (p, list) => { for (const [lim, v] of list) if (p < lim) return v; return list[list.length - 1][1]; };
  const MONTH_NOTE = ['새해 다짐이 아직 따끈한 때', '추위 끝에 봄 냄새가 나는 때', '새 학기처럼 설레는 때', '꽃이 한창인 때',
    '가장 푸른 때', '초여름 바람이 부는 때', '한여름 한복판', '볕은 뜨겁고 저녁은 선선해지는 때',
    '하늘이 높아지는 때', '단풍이 드는 때', '낙엽을 밟는 때', '한 해를 차분히 정리하는 때'];
  const TERMS = [['입춘', '봄이 문을 두드려요'], ['우수', '눈이 녹아 비가 돼요'], ['경칩', '개구리가 잠에서 깨요'], ['춘분', '낮과 밤이 같아져요'],
    ['청명', '하늘이 맑게 갰어요'], ['곡우', '곡식을 깨우는 비가 와요'], ['입하', '여름이 시작돼요'], ['소만', '온 세상이 차올라요'],
    ['망종', '씨를 뿌릴 때예요'], ['하지', '낮이 가장 길어요'], ['소서', '더위가 시작돼요'], ['대서', '가장 뜨거운 때예요'],
    ['입추', '가을이 문턱에 왔어요'], ['처서', '더위가 한풀 꺾여요'], ['백로', '풀잎에 이슬이 맺혀요'], ['추분', '낮과 밤이 다시 같아져요'],
    ['한로', '이슬이 차가워져요'], ['상강', '첫서리가 내려요'], ['입동', '겨울이 시작돼요'], ['소설', '첫눈이 와요'],
    ['대설', '눈이 소복이 쌓여요'], ['동지', '밤이 가장 길어요 — 이제부터 낮이 길어져요'], ['소한', '매서운 추위'], ['대한', '마지막 큰 추위, 곧 다시 봄']];
  const KTX = [['서울', 0], ['광명', 22], ['천안아산', 96], ['오송', 124], ['대전', 160], ['김천구미', 247], ['동대구', 293], ['신경주', 343], ['울산', 371], ['부산', 418]];
  const DAYS = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];
  const DAY_NOTE = ['한 주가 막 시작됐어요', '일이 손에 붙는 날', '한 주의 한가운데', '주말이 보이기 시작해요', '금요일 저녁의 설렘', '느긋한 토요일', '일요일 오후의 여유'];
  const partOfDay = (f) => (f < 0.33 ? '오전' : f < 0.7 ? '오후' : '저녁');

  M.METAPHORS = [
    { id: 'day', say: (p, c, pk) => ({ label: pk(['인생을 하루로 치면', '삶을 하루에 빗대면', '한평생을 하루로 접으면', '인생이 하루라면']), big: M.clockPhrase(p), suf: pk(['무렵', '즈음', '쯤']), note: M.fractionPhrase(p, pk) }) },
    { id: 'year', say: (p, c, pk) => {
      const d = new Date(2001, 0, Math.max(1, Math.round(p * 365)));
      return { label: pk(['인생을 1년 달력으로 치면', '한평생이 열두 달이라면']), big: `${d.getMonth() + 1}월 ${d.getDate()}일`, suf: '무렵', note: MONTH_NOTE[d.getMonth()] };
    } },
    { id: 'terms', say: (p) => {
      const [name, note] = TERMS[Math.min(23, Math.floor(p * 24))];
      return { label: '인생을 24절기로 치면', big: name, suf: '무렵', note };
    } },
    { id: 'season', say: (p, c, pk) => ({ label: pk(['인생을 사계절로 치면', '삶을 계절로 치면']), big: M.seasonPhrase(p), suf: '', note: M.fractionPhrase(p, pk) }) },
    { id: 'book', say: (p) => {
      const ch = Math.min(12, Math.floor(p * 12) + 1);
      return { label: '인생이 300쪽짜리 책이라면', big: `${Math.max(1, Math.round(p * 300))}쪽`, suf: '읽는 중',
        note: `12장 중 ${ch}장 · ${band(p, [[0.3, '등장인물이 하나둘 늘어나는 대목'], [0.6, '이야기가 무르익는 대목'], [0.85, '복선이 하나씩 풀리는 대목'], [1, '마지막 장을 아껴 읽는 중']])}` };
    } },
    { id: 'marathon', say: (p) => ({ label: '인생이 마라톤이라면', big: `${Math.round(p * 42.195 * 2) / 2}km`, suf: '지점',
      note: band(p, [[0.45, '아직 다리가 가벼워요'], [0.55, '반환점 근처예요'], [0.75, '숨은 차지만 리듬을 찾았어요'], [0.9, '결승선이 보이기 시작해요'], [1, '마지막 스퍼트']]) }) },
    { id: 'football', say: (p) => {
      const m = Math.max(1, Math.round(p * 90));
      return { label: '인생이 축구 한 경기라면', big: m <= 45 ? `전반 ${m}분` : `후반 ${m - 45}분`, suf: '',
        note: band(p, [[0.3, '탐색전이 끝나 가요'], [0.5, '하프타임 전에 한 골?'], [0.75, '교체 카드는 아직 남았어요'], [0.95, '뒤집기엔 충분한 시간'], [1, '추가 시간까지 뛰어요']]) };
    } },
    { id: 'baseball', say: (p) => {
      const x = p * 9, inn = Math.min(9, Math.floor(x) + 1), half = x % 1 < 0.5 ? '초' : '말';
      return { label: '인생이 야구 9회라면', big: `${inn}회 ${half}`, suf: '',
        note: band(p, [[0.34, '몸을 푸는 중'], [0.67, '승부는 지금부터'], [0.89, '불펜이 몸을 풀어요'], [1, '9회, 야구는 끝날 때까지 몰라요']]) };
    } },
    { id: 'movie', say: (p) => {
      const m = Math.max(1, Math.round(p * 120)), h = Math.floor(m / 60);
      return { label: '인생이 두 시간짜리 영화라면', big: h ? `${h}시간 ${m % 60}분` : `${m}분`, suf: '째',
        note: band(p, [[0.25, '주인공이 길을 나서는 장면'], [0.5, '사건이 꼬이기 시작해요'], [0.75, '가장 뜨거운 장면들'], [0.9, '클라이맥스'], [1, '엔딩 크레디트가 다가와요']]) };
    } },
    { id: 'song', say: (p) => {
      const s = Math.round((p * 240) / 5) * 5;
      return { label: '인생이 4분짜리 노래라면', big: s < 60 ? `${s}초` : s % 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s / 60}분`, suf: '',
        note: band(p, [[0.12, '전주가 흐르는 중'], [0.35, '첫 번째 절'], [0.5, '첫 후렴, 다 같이'], [0.7, '두 번째 절과 후렴'], [0.85, '브리지 — 분위기가 바뀌어요'], [1, '마지막 후렴']]) };
    } },
    { id: 'ktx', say: (p) => {
      const km = p * 418;
      let i = 0;
      while (i < KTX.length - 1 && KTX[i + 1][1] <= km) i++;
      const [a, ka] = KTX[i], next = KTX[Math.min(i + 1, KTX.length - 1)];
      const near = km - ka < 10 ? `${a}역` : next[1] - km < 10 ? `${next[0]}역` : `${a}–${next[0]}`;
      return { label: '인생이 서울→부산 KTX라면', big: near, suf: near.includes('–') ? '사이' : '근처', note: `부산까지 약 ${M.feel(Math.max(1, 418 - km))}km` };
    } },
    { id: 'building', say: (p) => ({ label: '인생이 100층 빌딩이라면', big: `${Math.max(1, Math.round(p * 100))}층`, suf: '',
      note: band(p, [[0.3, '창밖으로 나무 꼭대기가 보여요'], [0.6, '도시가 한눈에 들어와요'], [0.9, '구름이 발아래 있어요'], [1, '옥상 정원이 바로 위']]) }) },
    { id: 'battery', say: (p) => {
      const left = Math.max(0, Math.round((1 - p) * 20) * 5);
      return { label: '인생이 배터리라면', big: `${left}%`, suf: '남음',
        note: band(1 - p, [[0.2, '남은 만큼 아껴 쓰는 중'], [0.5, '절전 모드 대신 좋아하는 일부터'], [1.01, '아직 넉넉해요, 화면은 밝게']]) };
    } },
    { id: 'pizza', say: (p) => {
      const n = Math.min(8, Math.floor(p * 8) + 1);
      return { label: '인생이 피자 한 판이라면', big: `${n}번째 조각`, suf: '', note: n < 8 ? `${8 - n}조각 남았어요 — 제일 맛있는 건 아직일지도` : '마지막 조각, 천천히' };
    } },
    { id: 'candle', say: (p) => ({ label: '인생이 초 한 자루라면',
      big: band(p, [[0.2, '막 불을 붙인 초'], [0.45, '심지가 곧게 선 초'], [0.6, '반쯤 탄 초'], [0.8, '촛농이 흘러내린 초'], [1, '몽당초']]), suf: '', note: '타는 동안은 환해요' }) },
    { id: 'week', say: (p) => {
      const x = p * 7, d = Math.min(6, Math.floor(x));
      return { label: '인생이 일주일이라면', big: `${DAYS[d]} ${partOfDay(x - d)}`, suf: '', note: DAY_NOTE[d] };
    } },
    { id: 'mountain', say: (p) => ({ label: '인생이 등산이라면',
      big: band(p, [[0.25, '들머리를 막 지나'], [0.42, '오르막 중턱'], [0.5, '정상이 코앞'], [0.58, '정상에서 땀을 식히는 중'], [0.85, '내려가는 길'], [1, '산 아래 마을이 보여요']]), suf: '',
      note: p < 0.5 ? '숨이 차도 경치는 좋아지고 있어요' : '내려가는 길에 꽃이 더 잘 보여요' }) },
    { id: 'flight', say: (p) => ({ label: '인생이 서울→뉴욕 14시간 비행이라면', big: `${Math.max(1, Math.round(p * 14))}시간째`, suf: '비행 중',
      note: band(p, [[0.12, '일본 위를 지나는 중'], [0.45, '태평양 한가운데'], [0.6, '알래스카 위, 오로라가 보일지도'], [0.88, '캐나다를 건너는 중'], [1, '착륙 준비, 창밖에 도시 불빛']]) }) },
    { id: 'piano', say: (p) => {
      const k = Math.max(1, Math.round(p * 88));
      return { label: '인생이 피아노 88건반이라면', big: `${k}번째 건반`, suf: '',
        note: k < 35 ? '묵직한 낮은음을 지나는 중' : k <= 45 ? '가운데 도 근처, 가장 많이 누르는 음' : k <= 70 ? '맑은 음이 이어져요' : '반짝이는 높은음' };
    } },
    { id: 'coffee', say: (p) => ({ label: '인생이 커피 한 잔이라면',
      big: band(p, [[0.15, '첫 모금'], [0.45, '따뜻한 반 잔 이상'], [0.65, '반 잔 남짓'], [0.85, '식어 가는 몇 모금'], [1, '마지막 한 모금']]), suf: '', note: '식기 전에 천천히' }) },
    { id: 'trip', say: (p) => {
      const x = p * 4, d = Math.min(3, Math.floor(x));
      return { label: '인생이 3박 4일 여행이라면', big: `${['첫', '둘', '셋', '넷'][d]}째 날 ${partOfDay(x - d)}`, suf: '',
        note: band(p, [[0.25, '짐 풀고 동네를 걷는 중'], [0.5, '맛집을 찾아냈어요'], [0.75, '아직 못 가 본 곳이 있어요'], [1, '기념품을 고르는 시간']]) };
    } },
  ];

  // 기대 나이를 넘었을 때
  M.METAPHOR_OVER = [
    { label: '인생이 축구 한 경기라면', big: '추가 시간', suf: '', note: '휘슬은 아직 안 울렸어요' },
    { label: '인생이 야구 9회라면', big: '연장 10회', suf: '', note: '덤으로 얻은 이닝' },
    { label: '인생이 영화라면', big: '쿠키 영상', suf: '', note: '끝까지 남은 사람만 보는 장면' },
    { label: '인생이 노래라면', big: '앙코르', suf: '', note: '박수가 멈추지 않아서' },
    { label: '인생이 책이라면', big: '덧붙이는 글', suf: '', note: '본문 뒤의 가장 솔직한 쪽' },
  ];

  M.sayMetaphor = (idx, p, c, pk) => {
    if (p >= 1) return M.METAPHOR_OVER[idx % M.METAPHOR_OVER.length];
    return M.METAPHORS[idx % M.METAPHORS.length].say(p, c, pk);
  };
})();
