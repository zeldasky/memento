# 폰 안 AI 창구 (MementoAiService) — 시험판 전용

메멘토 시험판은 퀄컴 NPU에서 도는 언어 모델(GenieX + llama.cpp, `unsloth/Qwen3-4B-Instruct-2507-GGUF` Q4_0, 약 2.4GB · 메모리 약 3GB)을 들고 있어요. 같은 서명 키로 만든 다른 앱(지금은 TD)은 이 창구로 같은 모델을 빌려 써요. 모델을 앱마다 따로 올리면 메모리가 두 배가 들기 때문이에요.

- 시작: 0.19.0 (2026-11-07). 사용자 요청: "같이 설치된 TD 앱에서 api 를 통해서 사용할 수 있게, 요청할 때 올려서 쓰고 일정 시간 이후에 다시 내리는"
- TD 쪽 사용법(HTTP · 파이썬)과 실측: TD 저장소 `mobile/android/docs/폰안AI-API.md`

## 구성 (모두 `android/app/src/debug` — 출시판에는 없음)

| 파일 | 하는 일 |
|---|---|
| `java/.../MementoAiEngine.kt` | 모델 하나를 화면과 창구가 같이 쓴다. 요청 때 올리고 `keepAliveSec` 뒤에 내린다. 한 번에 한 요청, 줄은 4개까지 |
| `java/.../MementoAiPlugin.kt` | 메멘토 화면(www/js/ai.js)용 Capacitor 플러그인. 엔진을 쓴다 |
| `java/.../MementoAiService.kt` | 다른 앱용 바인드 서비스. 부를 때마다 서명을 확인한다 |
| `aidl/io/github/zeldasky/memento/ai/IMementoAi.aidl` · `IMementoAiCallback.aidl` | 창구 정의 |
| `AndroidManifest.xml` | 서비스 등록(`exported`, action `io.github.zeldasky.memento.AI`) |

## 붙는 법

```java
Intent i = new Intent("io.github.zeldasky.memento.AI").setPackage("io.github.zeldasky.memento");
ctx.bindService(i, conn, Context.BIND_AUTO_CREATE);
// 부르는 앱의 매니페스트: <queries><package android:name="io.github.zeldasky.memento" /></queries>
```

- **서명:** `PackageManager.checkSignatures(부른 uid, 내 uid)` 가 같지 않으면 모든 메서드가 `SecurityException("signature")` 를 던져요.
  - 시험판은 이 PC 의 debug 키라 TD 와 같아요(인증서 `5e280db6`).
  - 출시판처럼 키가 다르면 허용 인증서 목록이나 `knownSigner` 권한이 필요해요.

## 메서드

| 메서드 | 설명 |
|---|---|
| `int apiVersion()` | 지금 1 |
| `String status()` | JSON — `api, supported, soc, downloaded, loaded, busy, waiting, availMem, model, precision, nCtx, keepAliveSec, idleUnloadInSec` |
| `int generate(String requestJson, IMementoAiCallback cb)` | 줄에 세우고 번호를 돌려준다. 글은 `cb` 로 흘려 보낸다 |
| `void cancel(int id)` | 쓰는 중이면 끊고, 기다리는 중이면 시작하지 않는다 |
| `void unload()` | 쓰는 요청 · 기다리는 요청이 없으면 바로 내린다 |

**요청 JSON:**

```json
{"messages": [{"role": "system|user|assistant", "content": "…"}], "maxTokens": 512, "temperature": 0.7, "keepAliveSec": 180}
```

- `maxTokens`: 1~2048, 기본 512.
- `temperature`: 생략하면 모델 기본값이에요.
- `keepAliveSec`: 0~1800, 기본 180. 마지막 요청의 값이 적용돼요.
- 기억 칸은 4096토큰이에요. 이 쪽에서는 길이를 검사하지 않으니 부르는 쪽이 맞춰야 해요(TD 는 보내기 전에 어림으로 막아요).

**콜백(oneway):**
- `onToken(id, text)`: 글자가 나오는 대로 와요.
- `onDone(id, json)`: `{text, model, loadMs, ttftMs, tokPerSec, generated, stop, cancelled}`
- `onError(id, code, message)`: `code` 는 `unsupported` · `nomodel` · `memory` · `busy` · `cancelled` · `bad_request` · `internal` 중 하나예요.

받는 쪽이 사라지면(`RemoteException`) 그 요청을 멈춰요.

## 모델 수명

- **요청이 오면 올린다:** 실측 약 3.8초 걸려요. 여유 메모리가 1.8GB 아래면 `memory` 예요.
- **답한 뒤:** `keepAliveSec` 동안 아무 요청이 없으면 내려요.
- **메멘토 화면이 내려갈 때(onPause):** 메멘토 자기 요청만 멈추고, 다른 앱 요청이 없으면 바로 내려요. 브리핑을 닫을 때도 같아요.
- **TD 쪽:** 쓰지 않으면 `max(240초, keepAlive+60초)` 뒤에 연결을 풀어요. 모델을 내린 뒤라 메멘토 프로세스가 3GB 를 쥔 채 얼지 않아요.

## 로그

```
adb logcat -s MementoAi
요청 #1 from=com.zelda.tradedesk msgs=2 maxTokens=120 keepAlive=40s
끝 #1 generated=82 tok/s=22.9 load=3784ms cancelled=false
```
