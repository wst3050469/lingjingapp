package com.zhejiangjinmo.lingjing.ui.terminal

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardReturn
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.zhejiangjinmo.lingjing.data.api.LingJingApi
import com.zhejiangjinmo.lingjing.data.local.AuthDataStore
import com.zhejiangjinmo.lingjing.ui.theme.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

data class TerminalLine(val text: String, val isCommand: Boolean = false, val isError: Boolean = false)

@Composable
fun TerminalScreen(navController: NavController, sessionId: String) {
    var lines by remember { mutableStateOf(listOf(
        TerminalLine("灵境 Terminal v${com.zhejiangjinmo.lingjing.BuildConfig.VERSION_NAME}"),
        TerminalLine("session: ${sessionId.take(8)}..."),
        TerminalLine("")
    )) }
    var command by remember { mutableStateOf("") }
    var executing by remember { mutableStateOf(false) }
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()

    fun execute() {
        if (command.isBlank() || executing) return
        val cmd = command.trim()
        lines = lines + TerminalLine("$ $cmd", isCommand = true)
        command = ""
        executing = true

        scope.launch {
            try {
                val ctx = navController.context.applicationContext
                val api = LingJingApi()
                AuthDataStore(ctx).tokenFlow.first()?.let { api.setToken(it) }
                val res = api.execCommand(sessionId, cmd)
                if (res.ok) {
                    lines = lines + TerminalLine(res.error ?: "ok")
                } else {
                    lines = lines + TerminalLine(res.error ?: "command failed", isError = true)
                }
            } catch (e: Exception) {
                lines = lines + TerminalLine("error: ${e.message}", isError = true)
            }
            lines = lines + TerminalLine("")
            executing = false

            launch {
                listState.animateScrollToItem(lines.size - 1)
            }
        }
    }

    Scaffold(containerColor = DarkBg) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            Row(
                modifier = Modifier.fillMaxWidth()
                    .background(DarkSurface)
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = { navController.popBackStack() }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回", tint = DarkText)
                }
                Text("终端", color = DarkText, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, modifier = Modifier.weight(1f))
                IconButton(onClick = {
                    lines = listOf(TerminalLine("灵境 Terminal v${com.zhejiangjinmo.lingjing.BuildConfig.VERSION_NAME}"), TerminalLine(""))
                }) {
                    Icon(Icons.Filled.Delete, "清空", tint = DarkTextSecondary)
                }
            }
            HorizontalDivider(color = DarkBorder)

            LazyColumn(
                state = listState,
                modifier = Modifier.weight(1f).padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                items(lines) { line ->
                    val color = when {
                        line.isError -> DangerRed
                        line.isCommand -> SuccessGreen
                        else -> DarkTextSecondary
                    }
                    Text(
                        line.text,
                        color = color,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 13.sp,
                        lineHeight = 18.sp
                    )
                }
                if (executing) {
                    item {
                        Text("...", color = DarkTextTertiary, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth()
                    .background(DarkSurface)
                    .padding(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("$", color = SuccessGreen, fontFamily = FontFamily.Monospace, fontSize = 14.sp)
                Spacer(modifier = Modifier.width(8.dp))
                OutlinedTextField(
                    value = command,
                    onValueChange = { command = it },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    enabled = !executing,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = DarkText,
                        unfocusedTextColor = DarkText,
                        focusedBorderColor = DarkSurface,
                        unfocusedBorderColor = DarkSurface,
                        cursorColor = PrimaryBlue
                    ),
                    textStyle = androidx.compose.ui.text.TextStyle(fontFamily = FontFamily.Monospace, fontSize = 14.sp)
                )
                IconButton(onClick = { execute() }, enabled = !executing && command.isNotBlank()) {
                    Icon(Icons.AutoMirrored.Filled.KeyboardReturn, "执行", tint = if (executing) DarkTextTertiary else PrimaryBlue)
                }
            }
        }
    }
}
