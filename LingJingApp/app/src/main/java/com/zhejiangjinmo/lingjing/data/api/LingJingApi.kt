package com.zhejiangjinmo.lingjing.data.api

import com.zhejiangjinmo.lingjing.BuildConfig
import com.zhejiangjinmo.lingjing.data.model.*
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.logging.HttpLoggingInterceptor
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class LingJingApi @Inject constructor() {

    @PublishedApi internal val json = Json { ignoreUnknownKeys = true; isLenient = true }
    @PublishedApi internal val mediaType = "application/json".toMediaType()

    private var token: String? = null
    private var wsUrl: String = BuildConfig.CLOUD_SERVER_WS
    private var webSocket: WebSocket? = null
    private var wsListeners = mutableMapOf<String, MutableSet<(String) -> Unit>>()

    private val okHttpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .addInterceptor { chain ->
                val req = token?.let {
                    chain.request().newBuilder()
                        .header("Authorization", "Bearer $it")
                        .build()
                } ?: chain.request()
                chain.proceed(req)
            }
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = if (BuildConfig.DEBUG)
                    HttpLoggingInterceptor.Level.BODY
                else HttpLoggingInterceptor.Level.NONE
            })
            .build()
    }

    fun setToken(token: String?) { this.token = token }

    // ── HTTP Methods ──
    suspend fun get(path: String, params: Map<String, String> = emptyMap()): String {
        val url = buildUrl(path, params)
        val req = Request.Builder().url(url).get().build()
        return execute(req)
    }

    suspend inline fun <reified T> post(path: String, body: T): String {
        val url = buildUrl(path)
        val bodyStr = json.encodeToString(body)
        val reqBody = bodyStr.toRequestBody(mediaType)
        val req = Request.Builder().url(url).post(reqBody).build()
        return execute(req)
    }

    suspend fun postEmpty(path: String): String {
        val url = buildUrl(path)
        val reqBody = "{}".toRequestBody(mediaType)
        val req = Request.Builder().url(url).post(reqBody).build()
        return execute(req)
    }

    suspend inline fun <reified T> put(path: String, body: T): String {
        val url = buildUrl(path)
        val bodyStr = json.encodeToString(body)
        val reqBody = bodyStr.toRequestBody(mediaType)
        val req = Request.Builder().url(url).put(reqBody).build()
        return execute(req)
    }

    @PublishedApi internal suspend fun execute(req: Request): String {
        return kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            okHttpClient.newCall(req).execute().use { response ->
                if (response.isSuccessful) response.body?.string() ?: "{}"
                else "{\"ok\":false,\"error\":\"HTTP ${response.code}\"}"
            }
        }
    }

    // ── WebSocket ──
    fun connectWs() {
        disconnectWs()
        val req = Request.Builder().url(wsUrl)
            .header("Authorization", "Bearer ${token ?: ""}")
            .build()
        webSocket = okHttpClient.newWebSocket(req, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                emit("_connected", "{}")
            }
            override fun onMessage(ws: WebSocket, text: String) {
                try {
                    val msg = json.decodeFromString(kotlinx.serialization.serializer<Map<String, kotlinx.serialization.json.JsonElement>>(), text)
                    val type = msg["type"]?.toString()?.trim('"') ?: "message"
                    emit(type, text)
                } catch (_: Exception) {}
            }
            override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                emit("_disconnected", "{}")
            }
            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                emit("_disconnected", "{}")
            }
        })
    }

    fun disconnectWs() {
        webSocket?.close(1000, "user")
        webSocket = null
    }

    fun onWsEvent(event: String, listener: (String) -> Unit) {
        wsListeners.getOrPut(event) { mutableSetOf() }.add(listener)
    }

    fun offWsEvent(event: String, listener: (String) -> Unit) {
        wsListeners[event]?.remove(listener)
    }

    private fun emit(event: String, data: String) {
        wsListeners[event]?.forEach { it(data) }
    }

    // ── Auth APIs ──
    suspend fun login(username: String, password: String): AuthResponse =
        json.decodeFromString(post("/api/auth/login", LoginRequest(username, password)))

    suspend fun verifyToken(): VerifyResponse =
        json.decodeFromString(get("/api/auth/verify"))

    suspend fun sendSmsCode(phone: String): SimpleResponse =
        json.decodeFromString(post("/api/auth/sms/send", SmsCodeRequest(phone)))

    suspend fun smsLogin(phone: String, code: String): AuthResponse =
        json.decodeFromString(post("/api/auth/sms/login", SmsLoginRequest(phone, code)))

    // ── Sessions ──
    suspend fun getSessions(): List<Session> =
        json.decodeFromString(get("/api/sessions"))

    suspend fun createSession(data: Map<String, String>): Session =
        json.decodeFromString(post("/api/sessions", data))

    suspend fun archiveSession(id: String): SimpleResponse =
        json.decodeFromString(post("/api/sessions/archive", ArchiveRequest(id)))

    // ── Tasks ──
    suspend fun getTasks(tab: String? = null): List<Task> {
        val params = tab?.let { mapOf("tab" to it) } ?: emptyMap()
        return json.decodeFromString(get("/api/tasks", params))
    }

    suspend fun sendMessage(sessionId: String, content: String): SimpleResponse =
        json.decodeFromString(post("/api/conversations", MessageRequest(sessionId, content)))

    // ── Usage ──
    suspend fun getUsage(): UsageInfo =
        json.decodeFromString(get("/api/usage"))

    // ── Check Update ──
    suspend fun checkUpdate(current: String): UpdateInfo =
        json.decodeFromString(get("/api/latest", mapOf("current" to current)))

    // ── Pairing ──
    suspend fun pairDesktop(code: String): SimpleResponse =
        json.decodeFromString(post("/api/pairing/desktop", PairingRequest(code)))

    // ── Terminal / Commands ──
    suspend fun execCommand(sessionId: String, command: String): SimpleResponse =
        json.decodeFromString(post("/api/sessions/exec", ExecRequest(sessionId, command)))

    // ── Approval / Review / QA ──
    suspend fun submitApproval(sessionId: String, actionId: String, choice: String): SimpleResponse =
        json.decodeFromString(post("/api/sessions/approval", ApprovalSubmitRequest(sessionId, actionId, choice)))

    suspend fun submitPlanReview(sessionId: String, approved: Boolean, feedback: String = ""): SimpleResponse =
        json.decodeFromString(post("/api/sessions/plan-review", PlanReviewRequest(sessionId, approved, feedback)))

    suspend fun submitQaAnswer(sessionId: String, questionId: String, answer: Boolean): SimpleResponse =
        json.decodeFromString(post("/api/sessions/qa", QaAnswerRequest(sessionId, questionId, answer)))

    // ── Requirements ──
    suspend fun getRequirements(): List<Requirement> =
        json.decodeFromString(get("/api/requirements"))

    // ── Helper ──
    @PublishedApi internal fun buildUrl(path: String, params: Map<String, String> = emptyMap()): HttpUrl {
        val builder = "${BuildConfig.CLOUD_SERVER_URL}$path".toHttpUrl().newBuilder()
        params.forEach { (k, v) -> builder.addQueryParameter(k, v) }
        return builder.build()
    }
}

private fun String.toHttpUrl(): HttpUrl = HttpUrl.Builder().scheme("https")
    .host(this.substringAfter("://").substringBefore("/"))
    .encodedPath(this.substringAfter(this.substringAfter("://").substringBefore("/")))
    .build()
