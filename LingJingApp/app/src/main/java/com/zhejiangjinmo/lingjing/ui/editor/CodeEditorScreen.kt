package com.zhejiangjinmo.lingjing.ui.editor

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.zhejiangjinmo.lingjing.data.api.LingJingApi
import com.zhejiangjinmo.lingjing.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun CodeEditorScreen(navController: NavController, filePath: String) {
    var code by remember { mutableStateOf("") }
    var language by remember { mutableStateOf("kotlin") }
    var loading by remember { mutableStateOf(true) }
    var saving by remember { mutableStateOf(false) }
    var isDirty by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val api = remember { LingJingApi() }
    val context = LocalContext.current

    // 加载文件内容
    LaunchedEffect(filePath) {
        if (filePath.isBlank()) {
            code = "// 未命名文件\n\nfun main() {\n    println(\"Hello, 灵境!\")\n}\n"
            loading = false
            return@LaunchedEffect
        }
        try {
            val resp = api.readFile(filePath)
            code = resp.content
            // 根据扩展名推断语言
            language = when {
                filePath.endsWith(".kt") -> "kotlin"
                filePath.endsWith(".java") -> "java"
                filePath.endsWith(".py") -> "python"
                filePath.endsWith(".js") -> "javascript"
                filePath.endsWith(".ts") -> "typescript"
                filePath.endsWith(".xml") -> "xml"
                filePath.endsWith(".md") -> "markdown"
                filePath.endsWith(".json") -> "json"
                else -> "text"
            }
        } catch (e: Exception) {
            errorMsg = "加载失败: ${e.message}"
            code = "// 加载文件失败\n// ${e.message}"
        }
        loading = false
    }

    fun saveFile() {
        if (!isDirty || saving) return
        saving = true
        scope.launch {
            try {
                val resp = api.writeFile(filePath, code)
                if (resp.ok == true) {
                    isDirty = false
                    Toast.makeText(context, "已保存", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(context, "保存失败: ${resp.error}", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, "保存异常: ${e.message}", Toast.LENGTH_SHORT).show()
            }
            saving = false
        }
    }

    Scaffold(containerColor = DarkBg) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            // 顶部工具栏
            Row(
                modifier = Modifier.fillMaxWidth()
                    .background(DarkSurface)
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = {
                    if (isDirty) saveFile()
                    navController.popBackStack()
                }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回", tint = DarkText)
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(filePath.ifEmpty { "未命名文件" }, color = DarkText, fontSize = 15.sp)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(language.uppercase(), color = PrimaryBlue, fontSize = 12.sp)
                        if (isDirty) {
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("●", color = WarningYellow, fontSize = 12.sp)
                        }
                    }
                }
                IconButton(onClick = { saveFile() }, enabled = isDirty && !saving) {
                    if (saving)
                        CircularProgressIndicator(modifier = Modifier.size(20.dp), color = SuccessGreen, strokeWidth = 2.dp)
                    else
                        Icon(Icons.Filled.Save, "保存", tint = if (isDirty) SuccessGreen else DarkTextTertiary)
                }
                IconButton(onClick = {
                    Toast.makeText(context, "运行功能需要终端会话上下文", Toast.LENGTH_SHORT).show()
                }) {
                    Icon(Icons.Filled.PlayArrow, "运行", tint = PrimaryBlue)
                }
                IconButton(onClick = { /* Diff */ }) {
                    Icon(Icons.Filled.Difference, "差异", tint = DarkTextSecondary)
                }
            }
            HorizontalDivider(color = DarkBorder)

            // Loading / Error 状态
            if (loading) {
                Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = PrimaryBlue, modifier = Modifier.size(32.dp))
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("加载中...", color = DarkTextSecondary, fontSize = 14.sp)
                    }
                }
            } else if (errorMsg != null) {
                Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Filled.ErrorOutline, null, tint = DangerRed, modifier = Modifier.size(48.dp))
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(errorMsg!!, color = DangerRed, fontSize = 14.sp)
                    }
                }
            } else {
                // 行号 + 代码区
                Row(modifier = Modifier.weight(1f)) {
                    // 行号列
                    val scrollState = rememberScrollState()
                    Column(
                        modifier = Modifier.width(44.dp)
                            .fillMaxHeight()
                            .background(DarkSurface2)
                            .verticalScroll(scrollState)
                            .padding(vertical = 8.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        val lines = code.split("\n")
                        lines.forEachIndexed { index, _ ->
                            Text(
                                "${index + 1}",
                                color = DarkTextTertiary,
                                fontSize = 13.sp,
                                fontFamily = FontFamily.Monospace,
                                lineHeight = 20.sp
                            )
                        }
                    }

                    // 代码编辑区
                    OutlinedTextField(
                        value = code,
                        onValueChange = { newCode ->
                            code = newCode
                            isDirty = true
                        },
                        modifier = Modifier.weight(1f).fillMaxHeight(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = DarkText,
                            unfocusedTextColor = DarkText,
                            focusedBorderColor = DarkBg,
                            unfocusedBorderColor = DarkBg,
                            cursorColor = PrimaryBlue
                        ),
                        textStyle = androidx.compose.ui.text.TextStyle(
                            fontFamily = FontFamily.Monospace,
                            fontSize = 14.sp,
                            lineHeight = 20.sp
                        )
                    )
                }
            }
        }
    }
}
