package com.zhejiangjinmo.lingjing.ui.approval

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.zhejiangjinmo.lingjing.data.api.LingJingApi
import com.zhejiangjinmo.lingjing.data.local.AuthDataStore
import com.zhejiangjinmo.lingjing.ui.theme.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

@Composable
fun ApprovalScreen(navController: NavController, sessionId: String, actionId: String) {
    val options = listOf("仅本次允许", "本会话内始终允许", "拒绝")
    var selected by remember { mutableIntStateOf(0) }
    var loading by remember { mutableStateOf(false) }
    var done by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    fun submit() {
        loading = true; error = ""
        scope.launch {
            try {
                val ctx = navController.context.applicationContext
                val api = LingJingApi()
                AuthDataStore(ctx).tokenFlow.first()?.let { api.setToken(it) }
                val res = api.submitApproval(sessionId, actionId, options[selected])
                if (res.ok) { done = true }
                else error = res.error ?: "提交失败"
            } catch (e: Exception) { error = "网络错误: ${e.message}" }
            loading = false
        }
    }

    Scaffold(containerColor = DarkBg) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(20.dp)) {
            IconButton(onClick = { navController.popBackStack() }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回", tint = DarkText)
            }
            Spacer(modifier = Modifier.height(8.dp))

            if (done) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Filled.CheckCircle, null, tint = SuccessGreen, modifier = Modifier.size(64.dp))
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("审批已提交", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = DarkText)
                        Spacer(modifier = Modifier.height(24.dp))
                        Button(onClick = { navController.popBackStack() }) { Text("返回") }
                    }
                }
                return@Scaffold
            }

            // 审批标题
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = WarningBg),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Warning, null, tint = WarningYellow, modifier = Modifier.size(28.dp))
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text("需要授权", fontWeight = FontWeight.Bold, color = WarningYellow, fontSize = 16.sp)
                        Text("灵境AI 请求执行操作", color = DarkTextSecondary, fontSize = 14.sp)
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
            Text("选择处理方式", fontWeight = FontWeight.SemiBold, color = DarkText, fontSize = 16.sp)
            Spacer(modifier = Modifier.height(12.dp))

            options.forEachIndexed { index, option ->
                Card(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
                        .clickable { selected = index; error = "" },
                    colors = CardDefaults.cardColors(containerColor = DarkSurface),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = selected == index,
                            onClick = { selected = index; error = "" }
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(option, color = DarkText, fontSize = 15.sp)
                    }
                }
            }

            if (error.isNotBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(error, color = DangerRed, fontSize = 14.sp)
            }

            Spacer(modifier = Modifier.weight(1f))
            Button(
                onClick = { submit() },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                enabled = !loading,
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                shape = RoundedCornerShape(12.dp)
            ) {
                if (loading) CircularProgressIndicator(modifier = Modifier.size(24.dp), color = DarkText)
                else Text("提交", fontSize = 16.sp, fontWeight = FontWeight.Medium)
            }
        }
    }
}
