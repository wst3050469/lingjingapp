package com.zhejiangjinmo.lingjing.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// ── 认证模型 ──
@Serializable
data class LoginRequest(val username: String, val password: String)

@Serializable
data class SmsCodeRequest(val phone: String)

@Serializable
data class SmsLoginRequest(val phone: String, val code: String)

@Serializable
data class AuthResponse(
    val ok: Boolean = false,
    val token: String? = null,
    val user: UserInfo? = null,
    val error: String? = null
)

@Serializable
data class VerifyResponse(
    val ok: Boolean = false,
    val user: UserInfo? = null
)

@Serializable
data class UserInfo(
    val id: String = "",
    val username: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val avatar: String? = null,
    @SerialName("displayName") val displayName: String? = null
)

// ── 会话/消息模型 ──
@Serializable
data class Session(
    val id: String = "",
    val title: String? = null,
    val environment: String? = null,
    val phase: String? = null,
    @SerialName("createdAt") val createdAt: String? = null,
    @SerialName("updatedAt") val updatedAt: String? = null
)

@Serializable
data class Message(
    val id: String = "",
    val role: String = "user",
    val content: String = "",
    val timestamp: Long = 0L,
    val tools: List<ToolUse>? = null,
    val plan: PlanPreview? = null
)

@Serializable
data class ToolUse(
    val id: String = "",
    val name: String = "",
    val action: String = "",
    val path: String? = null,
    val command: String? = null,
    val status: String = "pending",
    val output: String? = null,
    val error: String? = null
)

@Serializable
data class PlanPreview(
    val title: String? = null,
    val steps: List<String> = emptyList()
)

// ── 任务模型 ──
@Serializable
data class Task(
    val id: String = "",
    val title: String? = null,
    val sessionId: String? = null,
    val environment: String? = null,
    val phase: String = "idle",
    @SerialName("createdAt") val createdAt: String? = null,
    @SerialName("updatedAt") val updatedAt: String? = null
)

// ── 审批模型 ──
@Serializable
data class ApprovalRequest(
    val id: String = "",
    val sessionId: String = "",
    val actionId: String = "",
    val type: String = "edit",
    val title: String = "",
    val detail: String? = null,
    val options: List<String> = emptyList()
)

// ── 环境模型 ──
@Serializable
data class Environment(
    val id: String = "",
    val name: String = "",
    val type: String = "desktop",
    val status: String = "online"
)

// ── 用量模型 ──
@Serializable
data class UsageInfo(
    val used: Long = 0,
    val cap: Long = 0,
    @SerialName("planCredits") val planCredits: Long = 0,
    @SerialName("addOnCredits") val addOnCredits: Long = 0,
    @SerialName("renewsOn") val renewsOn: String? = null
)

// ── 版本更新模型 ──
@Serializable
data class UpdateInfo(
    val hasUpdate: Boolean = false,
    val version: String? = null,
    val files: UpdateFiles? = null
)

@Serializable
data class UpdateFiles(
    val android: String? = null
)

// ── 需求/项目模型 ──
@Serializable
data class Requirement(
    val id: String = "",
    val title: String = "",
    val description: String? = null,
    val priority: String = "medium",
    val status: String = "open",
    val assignee: String? = null,
    @SerialName("createdAt") val createdAt: String? = null
)

// ── 通用响应 ──
@Serializable
data class ApiError(val error: String = "")

@Serializable
data class SimpleResponse(val ok: Boolean = false, val error: String? = null)
