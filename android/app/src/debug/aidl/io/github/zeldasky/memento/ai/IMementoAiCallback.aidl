// IMementoAi.generate 의 결과를 받는 쪽(요청한 앱이 만든다). oneway — 메멘토가 기다리지 않는다
package io.github.zeldasky.memento.ai;

oneway interface IMementoAiCallback {
    void onToken(int requestId, String text);
    // {"text","model","loadMs","ttftMs","tokPerSec","generated","stop","cancelled"}
    void onDone(int requestId, String resultJson);
    // code: unsupported · nomodel · memory · busy · cancelled · bad_request · internal
    void onError(int requestId, String code, String message);
}
