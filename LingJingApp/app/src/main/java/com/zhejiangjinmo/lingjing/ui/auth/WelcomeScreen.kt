package com.zhejiangjinmo.lingjing.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.zhejiangjinmo.lingjing.ui.navigation.Routes
import com.zhejiangjinmo.lingjing.ui.theme.*

@Composable
fun WelcomeScreen(navController: NavController) {
    var showTermsDialog by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier.fillMaxSize().background(DarkBg),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(32.dp)
        ) {
            Text("灵境 IDE", fontSize = 32.sp, fontWeight = FontWeight.Bold, color = PrimaryBlue)
            Spacer(modifier = Modifier.height(4.dp))
            Text("AI 驱动的智能开发平台", fontSize = 16.sp, color = DarkTextSecondary)
            Spacer(modifier = Modifier.height(48.dp))
            Text(
                "深度思考，匠心创造",
                fontSize = 18.sp,
                color = DarkTextTertiary,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(64.dp))
            Button(
                onClick = { showTermsDialog = true },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                shape = MaterialTheme.shapes.medium
            ) {
                Text("开始使用", fontSize = 16.sp, fontWeight = FontWeight.Medium)
            }
        }
    }

    // 条款确认弹窗
    if (showTermsDialog) {
        AlertDialog(
            onDismissRequest = {},
            title = { Text("条款与隐私", fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "欢迎使用灵境IDE！在继续之前，请阅读并同意我们的服务协议和隐私政策。" +
                    "\n\n本应用需要联网使用，可能会产生流量费用。为保障正常功能运行，" +
                    "我们会申请必要的系统权限（如网络、存储、相机、麦克风等）。"
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    showTermsDialog = false
                    navController.navigate(Routes.LOGIN)
                }) {
                    Text("同意", color = PrimaryBlue)
                }
            },
            dismissButton = {
                TextButton(onClick = { showTermsDialog = false }) {
                    Text("不同意", color = DarkTextSecondary)
                }
            }
        )
    }
}
