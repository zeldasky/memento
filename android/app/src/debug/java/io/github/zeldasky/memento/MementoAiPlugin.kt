package io.github.zeldasky.memento

import android.app.ActivityManager
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import com.geniex.sdk.GenieXSdk
import com.geniex.sdk.LlmWrapper
import com.geniex.sdk.ModelManagerWrapper
import com.geniex.sdk.bean.ChatMessage
import com.geniex.sdk.bean.GenerationConfig
import com.geniex.sdk.bean.HubSource
import com.geniex.sdk.bean.LlmCreateInput
import com.geniex.sdk.bean.LlmStreamResult
import com.geniex.sdk.bean.ModelConfig
import com.geniex.sdk.bean.ModelPullInput
import com.geniex.sdk.bean.SamplerConfig
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

// 퀄컴 NPU(GenieX + llama.cpp)로 폰 안에서 글을 쓴다 — 시험판 빌드에만 들어간다(src/debug).
// 모델은 처음 쓸 때 받고, 앱 화면이 내려가거나 브리핑을 닫으면 메모리에서 내린다(약 3GB를 쓴다).
@CapacitorPlugin(name = "MementoAi")
class MementoAiPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val lock = Mutex()
    private val ready = CompletableDeferred<Boolean>()
    private var llm: LlmWrapper? = null
    private var pulling: Job? = null

    private val soc: String get() = if (Build.VERSION.SDK_INT >= 31) Build.SOC_MODEL else ""

    override fun load() {
        // 지원하지 않는 칩에서는 네이티브 라이브러리를 아예 올리지 않는다
        if (soc !in SOCS) { ready.complete(false); return }
        scope.launch {
            runCatching {
                GenieXSdk.getInstance().init(context, object : GenieXSdk.InitCallback {
                    override fun onSuccess() { ready.complete(true) }
                    override fun onFailure(reason: String) { ready.complete(false) }
                })
            }.onFailure { ready.complete(false) }
        }
    }

    private fun availMem(): Long {
        val info = ActivityManager.MemoryInfo()
        (context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(info)
        return info.availMem
    }

    private fun onWifi(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return true
        return !caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)
    }

    @PluginMethod
    fun status(call: PluginCall) {
        scope.launch {
            val ok = ready.await()
            val r = JSObject()
            r.put("supported", ok && soc in SOCS)
            r.put("soc", soc)
            r.put("downloaded", ok && ModelManagerWrapper.getPaths(MODEL) != null)
            r.put("downloading", pulling?.isActive == true)
            r.put("loaded", llm != null)
            r.put("availMem", availMem())
            r.put("wifi", onWifi())
            r.put("size", MODEL_BYTES)
            call.resolve(r)
        }
    }

    @PluginMethod
    fun download(call: PluginCall) {
        if (pulling?.isActive == true) { call.reject("busy"); return }
        pulling = scope.launch {
            try {
                ready.await()
                ModelManagerWrapper.pullFlow(ModelPullInput(model_name = MODEL, precision = PRECISION, hub = HubSource.HUGGINGFACE)).collect { e ->
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
            lock.withLock { unloadNow() }
            ready.await()
            ModelManagerWrapper.remove(MODEL)
            call.resolve()
        }
    }

    private suspend fun loaded(): LlmWrapper {
        llm?.let { return it }
        if (availMem() < MIN_FREE) throw IllegalStateException("memory")
        val paths = ModelManagerWrapper.getPaths(MODEL) ?: throw IllegalStateException("nomodel")
        return LlmWrapper.builder().llmCreateInput(
            LlmCreateInput(model_path = paths.model_path, tokenizer_path = paths.tokenizer_path, config = ModelConfig(nCtx = 4096), runtime_id = paths.runtime_id, compute_unit = "npu"),
        ).build().getOrThrow().also { llm = it }
    }

    @PluginMethod
    fun generate(call: PluginCall) {
        val id = call.getInt("id", 0)
        val system = call.getString("system", "") ?: ""
        val user = call.getString("user", "") ?: ""
        val history = call.getArray("messages")
        val maxTokens = call.getInt("maxTokens", 220) ?: 220
        val temperature = call.getFloat("temperature", -1f) ?: -1f
        scope.launch {
            lock.withLock {
                try {
                    ready.await()
                    val t0 = System.currentTimeMillis()
                    val model = loaded()
                    val loadMs = System.currentTimeMillis() - t0
                    model.reset()
                    // 대화는 매번 앞선 말까지 다시 넣는다(모델은 기억을 따로 두지 않는다)
                    val chat = if (history != null) {
                        Array(history.length()) { i -> history.getJSONObject(i).let { ChatMessage(role = it.getString("role"), it.getString("content")) } }
                    } else {
                        arrayOf(ChatMessage(role = "system", system), ChatMessage(role = "user", user))
                    }
                    val tpl = model.applyChatTemplate(chat, null, false).getOrThrow()
                    val r = JSObject().put("loadMs", loadMs)
                    var failed: Throwable? = null
                    model.generateStreamFlow(tpl.formattedText, config = GenerationConfig(maxTokens = maxTokens, samplerConfig = if (temperature >= 0f) SamplerConfig(temperature = temperature, seed = (System.nanoTime() and 0x7fffffff).toInt()) else null)).collect { s ->
                        when (s) {
                            is LlmStreamResult.Token -> notifyListeners("token", JSObject().put("id", id).put("text", s.text))
                            is LlmStreamResult.Completed -> r.put("ttftMs", s.profile.ttftMs).put("tokPerSec", s.profile.decodingSpeed).put("generated", s.profile.generatedTokens).put("stop", s.profile.stopReason)
                            is LlmStreamResult.Error -> failed = s.throwable
                        }
                    }
                    failed?.let { throw it }
                    call.resolve(r)
                } catch (t: Throwable) {
                    call.reject(t.message ?: "generate")
                }
            }
        }
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        scope.launch { runCatching { llm?.stopStream() }; call.resolve() }
    }

    @PluginMethod
    fun unload(call: PluginCall) {
        scope.launch {
            runCatching { llm?.stopStream() }
            lock.withLock { unloadNow() }
            call.resolve()
        }
    }

    private fun unloadNow() {
        runCatching { llm?.destroy() }
        llm = null
    }

    // 화면이 내려가면 메모리를 돌려준다 — 뒤에서 다른 앱을 밀어내지 않게
    override fun handleOnPause() {
        scope.launch {
            runCatching { llm?.stopStream() }
            lock.withLock { unloadNow() }
        }
    }

    private companion object {
        const val MODEL = "unsloth/Qwen3-4B-Instruct-2507-GGUF"
        const val PRECISION = "Q4_0"
        const val MODEL_BYTES = 2375773280L
        const val MIN_FREE = 1800L * 1024 * 1024
        val SOCS = setOf("SM8850", "SM8750")
    }
}
