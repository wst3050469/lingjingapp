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
import com.zhejiangjinmo.lingjing.ui.theme.*
import kotlinx.coroutines.launch

data class TerminalLine(val text: String, val isCommand: Boolean = false)

@Composable
fun TerminalScreen(navController: NavController, sessionId: String) {
    var lines by remember { mutableStateOf(listOf(
        TerminalLine("灵境 Terminal v1.0.0", false),
        TerminalLine("session: $sessionId", false),
        TerminalLine("", false)
    )) }
    var command by remember { mutableStateOf("") }
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()

    fun execute() {
        if (command.isBlank()) return
        val cmd = command.trim()
        lines = lines + TerminalLine("$ $cmd", true)
        command = ""
        // 模拟输出
        lines = lines + TerminalLine("executing: $cmd", false)
        lines = lines + TerminalLine("", false)

        scope.launch {
            listState.animateScrollToItem(lines.size - 1)
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
                IconButton(onClick = { lines = emptyList() }) {
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
                    Text(
                        line.text,
                        color = if (line.isCommand) SuccessGreen else DarkTextSecondary,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 13.sp,
                        lineHeight = 18.sp
                    )
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
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = DarkText,
                        unfocusedTextColor = DarkText,
                        focusedBorderColor = DarkSurface,
                        unfocusedBorderColor = DarkSurface,
                        cursorColor = PrimaryBlue
                    ),
                    textStyle = androidx.compose.ui.text.TextStyle(fontFamily = FontFamily.Monospace, fontSize = 14.sp)
                )
                IconButton(onClick = { execute() }) {
                    Icon(Icons.AutoMirrored.Filled.KeyboardReturn, "执行", tint = PrimaryBlue)
                }
            }
        }
    }
}
