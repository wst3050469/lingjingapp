package com.zhejiangjinmo.lingjing.ui.qa

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
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
fun QAScreen(navController: NavController, sessionId: String, questionId: String) {
    var loading by remember { mutableStateOf(false) }
    var done by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    fun answer(response: Boolean) {
        loading = true; error = ""
        scope.launch {
            try {
                val ctx = navController.context.applicationContext
                val api = LingJingApi()
                AuthDataStore(ctx).tokenFlow.first()?.let { api.setToken(it) }
                val res = api.submitQaAnswer(sessionId, questionId, response)
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
            Text("问题确认", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = DarkText)
            Spacer(modifier = Modifier.height(8.dp))
            Text("需要你的回复后才能继续", fontSize = 15.sp, color = DarkTextSecondary)
            Spacer(modifier = Modifier.height(20.dp))

            if (done) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Filled.CheckCircle, null, tint = SuccessGreen, modifier = Modifier.size(64.dp))
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("已回复", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = DarkText)
                        Spacer(modifier = Modifier.height(24.dp))
                        Button(onClick = { navController.popBackStack() }) { Text("返回") }
                    }
                }
                return@Scaffold
            }

            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = DarkSurface),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("灵境AI 想要确认", fontWeight = FontWeight.Medium, color = DarkText, fontSize = 16.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("是否使用 Kotlin 作为主要开发语言？", color = DarkTextSecondary, fontSize = 14.sp)
                }
            }

            if (error.isNotBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(error, color = DangerRed, fontSize = 14.sp)
            }

            Spacer(modifier = Modifier.height(24.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(
                    onClick = { answer(false) },
                    modifier = Modifier.weight(1f).height(48.dp),
                    enabled = !loading,
                    shape = RoundedCornerShape(12.dp)
                ) { Text("否") }
                Button(
                    onClick = { answer(true) },
                    modifier = Modifier.weight(1f).height(48.dp),
                    enabled = !loading,
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                    shape = RoundedCornerShape(12.dp)
                ) { Text("是", fontWeight = FontWeight.Medium) }
            }
        }
    }
}
