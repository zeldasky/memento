/* 빌드 정보 — scripts/make-apk.mjs 가 빌드할 때 덮어쓰고, 끝나면 이 'dev' 로 되돌린다.
   channel: dev(브라우저) · debug(내 폰 시험판) · release(플레이 출시판)
   newsServer: 계약한 뉴스 출처를 받아 주는 우리 서버 주소(생기면 넣는다 — 그러면 출시판에서도 뉴스가 켜진다) */
window.M = window.M || {};
window.M.BUILD = { channel: 'dev', version: '', newsServer: '' };
