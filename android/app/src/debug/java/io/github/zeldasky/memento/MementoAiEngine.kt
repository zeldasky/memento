package io.github.zeldasky.memento

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import com.geniex.sdk.GenieXSdk
import com.geniex.sdk.LlmWrapper
import com.geniex.sdk.ModelManagerWrapper
import com.geniex.sdk.bean.ChatMessage
import com.geniex.sdk.bean.GenerationConfig
import com.geniex.sdk.bean.LlmCreateInput
import com.geniex.sdk.bean.LlmStreamResult
import com.geniex.sdk.bean.ModelConfig
import com.geniex.sdk.bean.SamplerConfig
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

class AiError(val code: String, message: String) : Exception(message)

// 폰 안 AI(GenieX + llama.cpp, 퀄컴 NPU) 하나를 메멘토 화면(MementoAiPlugin)과 다른 앱(MementoAiService)이 같이 쓴다 — 시험판 전용.
// 모델(약 3GB)은 요청이 오면 올리고, 마지막 요청 뒤 keepAliveSec 이 지나면 내린다. 한 번에 한 요청만 쓰고 나머지는 줄을 선다.
object MementoAiEngine {
    const val API = 1
    const val MODEL = "unsloth/Qwen3-4B-Instruct-2507-GGUF"
    const val PRECISION = "Q4_0"
    const val MODEL_BYTES = 2375773280L
    const val N_CTX = 4096
    const val DEFAULT_KEEP_ALIVE = 180
    const val MAX_KEEP_ALIVE = 1800
    const val MAX_TOKENS = 2048
    const val MAX_WAITING = 4
    private const val MIN_FREE = 1800L * 1024 * 1024
    val SOCS = setOf("SM8850", "SM8750")

    class Request(val messages: Array<ChatMessage>, val maxTokens: Int, val temperature: Float, val keepAliveSec: Int, val client: String)

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val lock = Mutex()
    private val seq = AtomicInteger(0)
    private val waiting = AtomicInteger(0)
    private val cancelled = ConcurrentHashMap.newKeySet<Int>()
    private lateinit var app: Context
    private var ready: CompletableDeferred<Boolean>? = null
    @Volatile private var llm: LlmWrapper? = null
    @Volatile private var running = 0               // 지금 글을 쓰는 요청 번호(0 = 없음)
    @Volatile private var runningClient = ""
    @Volatile private var keepAliveSec = DEFAULT_KEEP_ALIVE
    @Volatile private var unloadAt = 0L
    private var idleJob: Job? = null

    val soc: String get() = if (Build.VERSION.SDK_INT >= 31) Build.SOC_MODEL else ""

    // 지원하지 않는 칩에서는 네이티브 라이브러리를 아예 올리지 않는다
    @Synchronized
    fun init(ctx: Context): CompletableDeferred<Boolean> {
        ready?.let { return it }
        app = ctx.applicationContext
        val d = CompletableDeferred<Boolean>()
        ready = d
        if (soc !in SOCS) { d.complete(false); return d }
        scope.launch {
            runCatching {
                GenieXSdk.getInstance().init(app, object : GenieXSdk.InitCallback {
                    override fun onSuccess() { d.complete(true) }
                    override fun onFailure(reason: String) { d.complete(false) }
                })
            }.onFailure { d.complete(false) }
        }
        return d
    }

    fun nextId(): Int = seq.incrementAndGet()

    fun availMem(): Long {
        val info = ActivityManager.MemoryInfo()
        (app.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(info)
        return info.availMem
    }

    suspend fun downloaded(): Boolean = ready!!.await() && ModelManagerWrapper.getPaths(MODEL) != null

    suspend fun status(): JSONObject {
        val ok = ready!!.await()
        val left = if (llm != null && running == 0 && unloadAt > 0) maxOf(0L, (unloadAt - System.currentTimeMillis()) / 1000) else -1L
        return JSONObject()
            .put("api", API)
            .put("supported", ok)
            .put("soc", soc)
            .put("downloaded", ok && ModelManagerWrapper.getPaths(MODEL) != null)
            .put("loaded", llm != null)
            .put("busy", running != 0)
            .put("waiting", waiting.get())
            .put("availMem", availMem())
            .put("model", MODEL)
            .put("precision", PRECISION)
            .put("nCtx", N_CTX)
            .put("keepAliveSec", keepAliveSec)
            .put("idleUnloadInSec", left)
    }

    // 다른 앱이 보낸 JSON 요청 → Request. 꼴이 틀리면 bad_request
    fun parse(json: String, client: String): Request {
        val o = try { JSONObject(json) } catch (e: Exception) { throw AiError("bad_request", "json") }
        val arr: JSONArray = o.optJSONArray("messages") ?: throw AiError("bad_request", "messages")
        if (arr.length() == 0) throw AiError("bad_request", "messages")
        val msgs = Array(arr.length()) { i ->
            val m = arr.optJSONObject(i) ?: throw AiError("bad_request", "messages[$i]")
            val role = m.optString("role")
            if (role !in setOf("system", "user", "assistant")) throw AiError("bad_request", "role")
            ChatMessage(role = role, m.optString("content"))
        }
        return Request(
            msgs,
            o.optInt("maxTokens", 512).coerceIn(1, MAX_TOKENS),
            o.optDouble("temperature", -1.0).toFloat(),
            o.optInt("keepAliveSec", DEFAULT_KEEP_ALIVE).coerceIn(0, MAX_KEEP_ALIVE),
            client,
        )
    }

    private suspend fun loaded(): LlmWrapper {
        llm?.let { return it }
        if (availMem() < MIN_FREE) throw AiError("memory", "availMem ${availMem()}")
        val paths = ModelManagerWrapper.getPaths(MODEL) ?: throw AiError("nomodel", MODEL)
        return LlmWrapper.builder().llmCreateInput(
            LlmCreateInput(model_path = paths.model_path, tokenizer_path = paths.tokenizer_path, config = ModelConfig(nCtx = N_CTX), runtime_id = paths.runtime_id, compute_unit = "npu"),
        ).build().getOrElse { throw AiError("internal", "load: ${it.message}") }.also { llm = it }
    }

    // 글을 흘려 보내며 쓴다. 결과 {text, model, loadMs, ttftMs, tokPerSec, generated, stop, cancelled}
    suspend fun generate(id: Int, req: Request, onToken: (String) -> Unit): JSONObject {
        if (waiting.incrementAndGet() > MAX_WAITING) { waiting.decrementAndGet(); throw AiError("busy", "waiting ${MAX_WAITING}") }
        var queued = true
        try {
            return lock.withLock {
                waiting.decrementAndGet(); queued = false
                if (cancelled.remove(id)) throw AiError("cancelled", "before start")
                if (!ready!!.await()) throw AiError("unsupported", soc)
                idleJob?.cancel(); unloadAt = 0
                running = id; runningClient = req.client
                try {
                    val t0 = System.currentTimeMillis()
                    val model = loaded()
                    val loadMs = System.currentTimeMillis() - t0
                    // 대화는 매번 앞선 말까지 다시 넣는다(모델은 기억을 따로 두지 않는다)
                    model.reset()
                    val tpl = model.applyChatTemplate(req.messages, null, false).getOrElse { throw AiError("internal", "template: ${it.message}") }
                    val text = StringBuilder()
                    val r = JSONObject().put("loadMs", loadMs).put("model", MODEL)
                    var failed: Throwable? = null
                    val sampler = if (req.temperature >= 0f) SamplerConfig(temperature = req.temperature, seed = (System.nanoTime() and 0x7fffffff).toInt()) else null
                    model.generateStreamFlow(tpl.formattedText, config = GenerationConfig(maxTokens = req.maxTokens, samplerConfig = sampler)).collect { s ->
                        when (s) {
                            is LlmStreamResult.Token -> { text.append(s.text); onToken(s.text) }
                            is LlmStreamResult.Completed -> r.put("ttftMs", s.profile.ttftMs).put("tokPerSec", s.profile.decodingSpeed).put("generated", s.profile.generatedTokens).put("stop", s.profile.stopReason)
                            is LlmStreamResult.Error -> failed = s.throwable
                        }
                    }
                    failed?.let { throw AiError("internal", "generate: ${it.message}") }
                    r.put("text", text.toString()).put("cancelled", cancelled.remove(id))
                } finally {
                    running = 0; runningClient = ""
                    scheduleIdle(req.keepAliveSec)
                }
            }
        } finally {
            if (queued) waiting.decrementAndGet()
        }
    }

    // 그 번호를 멈춘다 — 쓰는 중이면 흐름을 끊고, 기다리는 중이면 시작하지 않게 적어 둔다
    fun cancel(id: Int) {
        if (id <= 0 || id > seq.get()) return
        cancelled.add(id)
        if (running == id) scope.launch { runCatching { llm?.stopStream() } }
    }

    // 이 쪽(client)이 쓰는 중인 요청만 멈춘다 — 메멘토 화면이 내려갈 때 다른 앱의 요청은 건드리지 않는다
    fun stopFor(client: String) {
        if (running != 0 && runningClient == client) cancel(running)
    }

    // 쓰는 요청도 기다리는 요청도 없으면 바로 내린다
    suspend fun unloadIfIdle(): Boolean {
        if (running != 0 || waiting.get() > 0) return false
        return lock.withLock {
            if (running != 0 || waiting.get() > 0) false else { unloadNow(); true }
        }
    }

    suspend fun unloadForce() {
        runCatching { llm?.stopStream() }
        lock.withLock { unloadNow() }
    }

    private fun scheduleIdle(sec: Int) {
        keepAliveSec = sec
        idleJob?.cancel()
        unloadAt = System.currentTimeMillis() + sec * 1000L
        idleJob = scope.launch {
            delay(sec * 1000L)
            lock.withLock { if (running == 0) drop() }
        }
    }

    private fun unloadNow() {
        idleJob?.cancel()
        drop()
    }

    private fun drop() {
        unloadAt = 0
        runCatching { llm?.destroy() }
        llm = null
    }
}
