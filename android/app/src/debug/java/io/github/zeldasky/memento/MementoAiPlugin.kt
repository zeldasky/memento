package io.github.zeldasky.memento

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import com.geniex.sdk.ModelManagerWrapper
import com.geniex.sdk.bean.ChatMessage
import com.geniex.sdk.bean.HubSource
import com.geniex.sdk.bean.ModelPullInput
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

// 퀄컴 NPU(GenieX + llama.cpp)로 폰 안에서 글을 쓴다 — 시험판 빌드에만 들어간다(src/debug).
// 모델은 MementoAiEngine 하나가 들고 있고, 다른 앱(TD)도 MementoAiService 로 같은 모델을 쓴다.
// 모델은 처음 쓸 때 받고, 앱 화면이 내려가거나 브리핑을 닫으면(다른 앱이 쓰는 중이 아니면) 메모리에서 내린다(약 3GB를 쓴다).
@CapacitorPlugin(name = "MementoAi")
class MementoAiPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val engine = MementoAiEngine
    private var pulling: Job? = null

    override fun load() {
        engine.init(context)
    }

    private fun onWifi(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return true
        return !caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)
    }

    @PluginMethod
    fun status(call: PluginCall) {
        scope.launch {
            val s = engine.status()
            val r = JSObject()
            r.put("supported", s.getBoolean("supported"))
            r.put("soc", s.getString("soc"))
            r.put("downloaded", s.getBoolean("downloaded"))
            r.put("downloading", pulling?.isActive == true)
            r.put("loaded", s.getBoolean("loaded"))
            r.put("availMem", s.getLong("availMem"))
            r.put("wifi", onWifi())
            r.put("size", MementoAiEngine.MODEL_BYTES)
            call.resolve(r)
        }
    }

    @PluginMethod
    fun download(call: PluginCall) {
        if (pulling?.isActive == true) { call.reject("busy"); return }
        pulling = scope.launch {
            try {
                engine.init(context).await()
                ModelManagerWrapper.pullFlow(ModelPullInput(model_name = MementoAiEngine.MODEL, precision = MementoAiEngine.PRECISION, hub = HubSource.HUGGINGFACE)).collect { e ->
                    when (e) {
                        is ModelManagerWrapper.PullEvent.Progress -> {
                            val p = JSObject()
                            p.put("done", e.files.sumOf { it.downloaded_bytes })
                            p.put("total", e.files.sumOf { it.total_bytes })
                            notifyListeners("progress", p)
                        }
                        ModelManagerWrapper.PullEvent.Completed -> call.resolve()
                        is ModelManagerWrapper.PullEvent.Error -> call.reject("download:${e.message}")
                    }
                }
            } catch (t: Throwable) {
                call.reject("download:${t.message}")
            }
        }
    }

    @PluginMethod
    fun remove(call: PluginCall) {
        scope.launch {
            engine.unloadForce()
            engine.init(context).await()
            ModelManagerWrapper.remove(MementoAiEngine.MODEL)
            call.resolve()
        }
    }

    @PluginMethod
    fun generate(call: PluginCall) {
        val jsId = call.getInt("id", 0)
        val system = call.getString("system", "") ?: ""
        val user = call.getString("user", "") ?: ""
        val history = call.getArray("messages")
        val maxTokens = call.getInt("maxTokens", 220) ?: 220
        val temperature = call.getFloat("temperature", -1f) ?: -1f
        val chat = if (history != null) {
            Array(history.length()) { i -> history.getJSONObject(i).let { ChatMessage(role = it.getString("role"), it.getString("content")) } }
        } else {
            arrayOf(ChatMessage(role = "system", system), ChatMessage(role = "user", user))
        }
        val req = MementoAiEngine.Request(chat, maxTokens, temperature, MementoAiEngine.DEFAULT_KEEP_ALIVE, CLIENT)
        scope.launch {
            try {
                val r = engine.generate(engine.nextId(), req) { t -> notifyListeners("token", JSObject().put("id", jsId).put("text", t)) }
                val out = JSObject()
                for (k in listOf("loadMs", "ttftMs", "tokPerSec", "generated", "stop")) if (r.has(k)) out.put(k, r.get(k))
                call.resolve(out)
            } catch (e: AiError) {
                call.reject(e.code)
            } catch (t: Throwable) {
                call.reject(t.message ?: "generate")
            }
        }
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        engine.stopFor(CLIENT)
        call.resolve()
    }

    @PluginMethod
    fun unload(call: PluginCall) {
        scope.launch {
            engine.stopFor(CLIENT)
            engine.unloadIfIdle()
            call.resolve()
        }
    }

    // 화면이 내려가면 메모리를 돌려준다 — 뒤에서 다른 앱을 밀어내지 않게(다른 앱이 쓰는 중이면 그쪽 시간에 맡긴다)
    override fun handleOnPause() {
        scope.launch {
            engine.stopFor(CLIENT)
            engine.unloadIfIdle()
        }
    }

    private companion object {
        const val CLIENT = "memento"
    }
}
