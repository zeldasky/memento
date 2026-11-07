// 메멘토 폰 안 AI 를 다른 앱(같은 서명)이 쓰는 창구 — 시험판 전용. TD 쪽에 같은 파일을 그대로 둔다.
// 요청 · 결과는 JSON 문자열(필드를 늘려도 이 파일은 그대로 둔다). 자세한 꼴은 docs/AI-서비스.md
package io.github.zeldasky.memento.ai;

import io.github.zeldasky.memento.ai.IMementoAiCallback;

interface IMementoAi {
    // 창구 판 — 꼴이 바뀌면 올린다
    int apiVersion();
    // {"api","supported","soc","downloaded","loaded","busy","availMem","model","keepAliveSec","idleUnloadIn"}
    String status();
    // 요청을 줄에 세우고 번호를 돌려준다. 글은 callback 으로 흘려 보낸다
    int generate(String requestJson, IMementoAiCallback callback);
    // 그 번호를 멈춘다(기다리는 중이면 시작하지 않는다)
    void cancel(int requestId);
    // 지금 쓰는 요청이 없으면 모델을 바로 내린다
    void unload();
}
