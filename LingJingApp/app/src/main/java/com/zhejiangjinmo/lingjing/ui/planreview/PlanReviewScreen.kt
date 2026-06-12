package com.zhejiangjinmo.lingjing.ui.planreview

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
fun PlanReviewScreen(navController: NavController, sessionId: String) {
    var feedback by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var done by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    val steps = listOf("分析项目结构", "确认技术栈", "实现核心功能", "编写测试", "代码审查")

    fun submit(approved: Boolean) {
        loading = true; error = ""
        scope.launch {
            try {
                val ctx = navController.context.applicationContext
                val api = LingJingApi()
                AuthDataStore(ctx).tokenFlow.first()?.let { api.setToken(it) }
                val res = api.submitPlanReview(sessionId, approved, if (!approved) feedback else "")
                if (res.ok) done = true
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
            Text("方案审查", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = DarkText)
            Spacer(modifier = Modifier.height(8.dp))
            Text("灵境AI 已生成执行计划，请审查", fontSize = 15.sp, color = DarkTextSecondary)
            Spacer(modifier = Modifier.height(20.dp))

            if (done) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Filled.CheckCircle, null, tint = SuccessGreen, modifier = Modifier.size(64.dp))
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("审查已提交", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = DarkText)
                        Spacer(modifier = Modifier.height(24.dp))
                        Button(onClick = { navController.popBackStack() }) { Text("返回") }
                    }
                }
                return@Scaffold
            }

            // 计划步骤
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = DarkSurface),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    steps.forEach { step ->
                        Row(modifier = Modifier.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Filled.CheckCircle, null, tint = SuccessGreen, modifier = Modifier.size(20.dp))
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(step, color = DarkText, fontSize = 15.sp)
                        }
                    }
                }
            }

            // 反馈输入
            Spacer(modifier = Modifier.height(16.dp))
            OutlinedTextField(
                value = feedback,
                onValueChange = { feedback = it },
                label = { Text("修改建议（可选）") },
                modifier = Modifier.fillMaxWidth().height(100.dp),
                maxLines = 4,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = DarkText, unfocusedTextColor = DarkText,
                    focusedBorderColor = PrimaryBlue, unfocusedBorderColor = DarkBorder,
                    cursorColor = PrimaryBlue
                )
            )

            if (error.isNotBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(error, color = DangerRed, fontSize = 14.sp)
            }

            Spacer(modifier = Modifier.weight(1f))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(
                    onClick = { submit(false) },
                    modifier = Modifier.weight(1f).height(48.dp),
                    enabled = !loading,
                    shape = RoundedCornerShape(12.dp)
                ) { Text("建议修改", color = DarkTextSecondary) }
                Button(
                    onClick = { submit(true) },
                    modifier = Modifier.weight(1f).height(48.dp),
                    enabled = !loading,
                    colors = ButtonDefaults.buttonColors(containerColor = SuccessGreen),
                    shape = RoundedCornerShape(12.dp)
                ) { Text("同意执行", fontWeight = FontWeight.Medium) }
            }
        }
    }
}
