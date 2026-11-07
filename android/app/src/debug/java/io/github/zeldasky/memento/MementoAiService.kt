package io.github.zeldasky.memento

import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Binder
import android.os.IBinder
import android.os.Process
import android.os.RemoteException
import android.util.Log
import io.github.zeldasky.memento.ai.IMementoAi
import io.github.zeldasky.memento.ai.IMementoAiCallback
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout

// 다른 앱(TD)이 메멘토의 폰 안 AI 를 쓰는 창구 — 시험판 전용(src/debug).
// 같은 서명 키로 만든 앱만 받는다(부를 때마다 PackageManager.checkSignatures). 모델은 MementoAiEngine 이 요청 때 올리고
// 요청이 keepAliveSec 동안 없으면 내린다. 계약(요청 · 결과 JSON · 오류 코드)은 docs/AI-서비스.md
class MementoAiService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val engine = MementoAiEngine

    override fun onCreate() {
        super.onCreate()
        engine.init(this)
    }

    // 같은 서명이 아니면 막는다. 부른 앱 이름을 돌려준다(로그 · 요청 주인 표시용)
    private fun caller(): String {
        val uid = Binder.getCallingUid()
        if (uid == Process.myUid()) return packageName
        if (packageManager.checkSignatures(uid, Process.myUid()) != PackageManager.SIGNATURE_MATCH) {
            Log.w(TAG, "서명이 다른 앱이 불렀다: uid=$uid ${packageManager.getNameForUid(uid)}")
            throw SecurityException("signature")
        }
        return packageManager.getNameForUid(uid) ?: "uid:$uid"
    }

    private val binder = object : IMementoAi.Stub() {
        override fun apiVersion(): Int {
            caller()
            return MementoAiEngine.API
        }

        override fun status(): String {
            caller()
            return runBlocking { withTimeout(10_000) { engine.status() } }.toString()
        }

        override fun generate(requestJson: String?, callback: IMementoAiCallback?): Int {
            val who = caller()
            val cb = callback ?: throw IllegalArgumentException("callback")
            val id = engine.nextId()
            scope.launch {
                val req = try {
                    engine.parse(requestJson ?: "", who)
                } catch (e: AiError) {
                    safe { cb.onError(id, e.code, e.message ?: "") }
                    return@launch
                }
                Log.i(TAG, "요청 #$id from=$who msgs=${req.messages.size} maxTokens=${req.maxTokens} keepAlive=${req.keepAliveSec}s")
                try {
                    // 받는 쪽이 사라지면(앱 종료) 더 쓰지 않고 멈춘다
                    val r = engine.generate(id, req) { t -> if (!safe { cb.onToken(id, t) }) engine.cancel(id) }
                    Log.i(TAG, "끝 #$id generated=${r.optInt("generated")} tok/s=${r.optDouble("tokPerSec")} load=${r.optLong("loadMs")}ms cancelled=${r.optBoolean("cancelled")}")
                    safe { cb.onDone(id, r.toString()) }
                } catch (e: AiError) {
                    Log.i(TAG, "오류 #$id ${e.code} ${e.message}")
                    safe { cb.onError(id, e.code, e.message ?: "") }
                } catch (t: Throwable) {
                    Log.w(TAG, "오류 #$id", t)
                    safe { cb.onError(id, "internal", t.message ?: t.javaClass.simpleName) }
                }
            }
            return id
        }

        override fun cancel(requestId: Int) {
            caller()
            engine.cancel(requestId)
        }

        override fun unload() {
            caller()
            scope.launch { engine.unloadIfIdle() }
        }
    }

    private inline fun safe(block: () -> Unit): Boolean = try { block(); true } catch (e: RemoteException) { false }

    override fun onBind(intent: Intent?): IBinder = binder

    private companion object {
        const val TAG = "MementoAi"
    }
}
