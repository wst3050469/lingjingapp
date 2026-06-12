package com.zhejiangjinmo.lingjing.ui.editor

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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

@Composable
fun CodeEditorScreen(navController: NavController, filePath: String) {
    var code by remember { mutableStateOf(
        "// ${filePath.ifEmpty { "example.kt" }}\n\n" +
        "fun main() {\n" +
        "    println(\"Hello, 灵境!\")\n" +
        "}\n"
    ) }
    var language by remember { mutableStateOf("kotlin") }

    Scaffold(containerColor = DarkBg) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            // 顶部工具栏
            Row(
                modifier = Modifier.fillMaxWidth()
                    .background(DarkSurface)
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = { navController.popBackStack() }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回", tint = DarkText)
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(filePath.ifEmpty { "未命名文件" }, color = DarkText, fontSize = 15.sp)
                    Text(language.uppercase(), color = PrimaryBlue, fontSize = 12.sp)
                }
                IconButton(onClick = { /* 保存 */ }) {
                    Icon(Icons.Filled.Save, "保存", tint = SuccessGreen)
                }
                IconButton(onClick = { /* 运行 */ }) {
                    Icon(Icons.Filled.PlayArrow, "运行", tint = PrimaryBlue)
                }
                IconButton(onClick = { /* Diff */ }) {
                    Icon(Icons.Filled.Difference, "差异", tint = DarkTextSecondary)
                }
            }
            HorizontalDivider(color = DarkBorder)

            // 行号 + 代码区
            Row(modifier = Modifier.weight(1f)) {
                // 行号列
                Column(
                    modifier = Modifier.width(44.dp)
                        .fillMaxHeight()
                        .background(DarkSurface2)
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
                    onValueChange = { code = it },
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
