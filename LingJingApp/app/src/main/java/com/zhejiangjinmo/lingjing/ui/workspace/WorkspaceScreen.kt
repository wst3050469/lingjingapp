package com.zhejiangjinmo.lingjing.ui.workspace

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.zhejiangjinmo.lingjing.data.api.LingJingApi
import com.zhejiangjinmo.lingjing.ui.components.MarkdownText
import com.zhejiangjinmo.lingjing.ui.components.VoiceInputBar
import com.zhejiangjinmo.lingjing.ui.theme.*
import kotlinx.coroutines.launch

data class ChatMessage(
    val id: String,
    val role: String,
    val content: String
)

@Composable
fun WorkspaceScreen(navController: NavController, sessionId: String) {
    var messages by remember { mutableStateOf<List<ChatMessage>>(emptyList()) }
    var inputText by remember { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    var showVoice by remember { mutableStateOf(false) }
    var selectedModel by remember { mutableStateOf("灵境 AI") }
    var modelMenuExpanded by remember { mutableStateOf(false) }
    val models = listOf("灵境 AI", "Code Expert", "Architect", "Reviewer")
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()
    val api = remember { LingJingApi() }

    LaunchedEffect(sessionId) {
        if (messages.isEmpty()) {
            messages = listOf(ChatMessage("welcome", "assistant",
                "你好！我是灵境 AI 编程助手。\n\n我可以帮你：\n- 编写和调试代码\n- 审查代码质量\n- 解释项目结构\n- 执行命令和脚本\n\n请告诉我你需要什么帮助？"))
        }
    }

    fun send() {
        val text = inputText.trim()
        if (text.isEmpty() || sending) return
        sending = true
        val userMsg = ChatMessage(System.currentTimeMillis().toString(), "user", text)
        messages = messages + userMsg
        inputText = ""

        scope.launch {
            try {
                api.sendMessage(sessionId, text)
            } catch (_: Exception) {}
            sending = false
        }
    }

    Scaffold(containerColor = DarkBg) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            // 顶部栏
            Row(
                modifier = Modifier.fillMaxWidth()
                    .background(DarkSurface)
                    .padding(horizontal = 4.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = { navController.popBackStack() }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回", tint = DarkText)
                }
                Text("工作区", fontWeight = FontWeight.SemiBold, color = DarkText, fontSize = 16.sp, modifier = Modifier.weight(1f))
                // Model selector
                Box {
                    TextButton(onClick = { modelMenuExpanded = true }) {
                        Text(selectedModel, color = PrimaryBlue, fontSize = 13.sp)
                        Icon(Icons.Filled.ArrowDropDown, null, tint = PrimaryBlue)
                    }
                    DropdownMenu(
                        expanded = modelMenuExpanded,
                        onDismissRequest = { modelMenuExpanded = false }
                    ) {
                        models.forEach { model ->
                            DropdownMenuItem(
                                text = { Text(model) },
                                onClick = {
                                    selectedModel = model
                                    modelMenuExpanded = false
                                }
                            )
                        }
                    }
                }
                IconButton(onClick = { /* settings */ }) {
                    Icon(Icons.Filled.MoreHoriz, "更多", tint = DarkTextSecondary)
                }
            }
            HorizontalDivider(color = DarkBorder)

            // 消息列表
            LazyColumn(
                state = listState,
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                items(messages) { msg ->
                    MessageBubble(msg)
                }
            }

            // 输入栏
            Column(modifier = Modifier.fillMaxWidth().background(DarkSurface)) {
                if (showVoice) {
                    VoiceInputBar(
                        onVoiceResult = { result ->
                            inputText = result
                            showVoice = false
                        },
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth().padding(8.dp),
                    verticalAlignment = Alignment.Bottom
                ) {
                    IconButton(onClick = { showVoice = !showVoice }) {
                        Icon(
                            if (showVoice) Icons.Filled.Keyboard else Icons.Filled.Mic,
                            if (showVoice) "键盘" else "语音",
                            tint = if (showVoice) PrimaryBlue else DarkTextSecondary
                        )
                    }
                OutlinedTextField(
                    value = inputText,
                    onValueChange = { inputText = it },
                    placeholder = { Text("输入消息...", color = DarkTextTertiary) },
                    modifier = Modifier.weight(1f),
                    maxLines = 4,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = DarkText,
                        unfocusedTextColor = DarkText,
                        focusedBorderColor = DarkBorder,
                        unfocusedBorderColor = DarkBorder,
                        cursorColor = PrimaryBlue
                    )
                )
                Spacer(modifier = Modifier.width(8.dp))
                FilledIconButton(
                    onClick = { send() },
                    enabled = inputText.isNotBlank() && !sending,
                    modifier = Modifier.size(44.dp),
                    colors = IconButtonDefaults.filledIconButtonColors(
                        containerColor = PrimaryBlue,
                        disabledContainerColor = DarkSurface2
                    )
                ) {
                    Icon(Icons.AutoMirrored.Filled.Send, "发送", tint = DarkBg)
                }
            }
        }
    }
}
}

@Composable
fun MessageBubble(msg: ChatMessage) {
    val isUser = msg.role == "user"
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        if (!isUser) {
            Box(
                modifier = Modifier.size(30.dp).clip(CircleShape).background(PrimaryBlueBg),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Filled.FlashOn, null, tint = PrimaryBlue, modifier = Modifier.size(18.dp))
            }
            Spacer(modifier = Modifier.width(8.dp))
        }

        Surface(
            modifier = Modifier.widthIn(max = if (isUser) 300.dp else 340.dp),
            shape = if (isUser)
                RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp, bottomStart = 12.dp, bottomEnd = 4.dp)
            else
                RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp, bottomStart = 4.dp, bottomEnd = 12.dp),
            color = if (isUser) PrimaryBlue else DarkSurface2,
            border = if (isUser) null else androidx.compose.foundation.BorderStroke(1.dp, DarkBorder)
        ) {
            if (isUser) {
                Text(
                    text = msg.content,
                    modifier = Modifier.padding(12.dp),
                    color = DarkBg,
                    fontSize = 15.sp,
                    lineHeight = 22.sp
                )
            } else {
                MarkdownText(
                    markdown = msg.content,
                    modifier = Modifier.padding(12.dp),
                    textColor = DarkText
                )
            }
        }
    }
}
