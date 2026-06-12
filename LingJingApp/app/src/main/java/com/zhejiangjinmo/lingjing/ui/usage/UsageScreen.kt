package com.zhejiangjinmo.lingjing.ui.usage

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
import androidx.compose.ui.graphics.StrokeCap
import androidx.navigation.NavController
import com.zhejiangjinmo.lingjing.data.api.LingJingApi
import com.zhejiangjinmo.lingjing.data.local.AuthDataStore
import com.zhejiangjinmo.lingjing.data.model.UsageInfo
import com.zhejiangjinmo.lingjing.ui.theme.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

@Composable
fun UsageScreen(navController: NavController) {
    var usage by remember { mutableStateOf<UsageInfo?>(null) }
    var loading by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        scope.launch {
            try {
                val ctx = navController.context.applicationContext
                val api = LingJingApi()
                AuthDataStore(ctx).tokenFlow.first()?.let { api.setToken(it) }
                usage = api.getUsage()
            } catch (_: Exception) {}
            loading = false
        }
    }

    val available = (usage?.cap ?: 0) - (usage?.used ?: 0)
    val progress = if ((usage?.cap ?: 1) > 0) (usage?.used ?: 0).toFloat() / (usage?.cap ?: 1) else 0f

    Scaffold(containerColor = DarkBg) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(20.dp)) {
            IconButton(onClick = { navController.popBackStack() }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回", tint = DarkText)
            }
            Text("用量与积分", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = DarkText)
            Spacer(modifier = Modifier.height(24.dp))

            if (loading) {
                Box(modifier = Modifier.fillMaxWidth().height(200.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = PrimaryBlue)
                }
            } else {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = PrimaryBlueBg),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(modifier = Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Filled.CardGiftcard, null, tint = PrimaryBlue, modifier = Modifier.size(48.dp))
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            "${available.coerceAtLeast(0)}",
                            fontSize = 40.sp, fontWeight = FontWeight.Bold, color = PrimaryBlue
                        )
                        Text("可用积分", color = DarkTextSecondary, fontSize = 14.sp)
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))
                Text("用量详情", fontWeight = FontWeight.SemiBold, color = DarkText, fontSize = 16.sp)
                Spacer(modifier = Modifier.height(12.dp))

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = DarkSurface),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        UsageRow("累计用量", "${usage?.used ?: 0}/${usage?.cap ?: 0} 积分", progress.coerceIn(0f, 1f))
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "计划积分: ${usage?.planCredits ?: 0} + 附加积分: ${usage?.addOnCredits ?: 0}",
                            color = DarkTextTertiary, fontSize = 13.sp
                        )
                        usage?.renewsOn?.let {
                            Spacer(modifier = Modifier.height(4.dp))
                            Text("续期日期: $it", color = DarkTextTertiary, fontSize = 12.sp)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.weight(1f))
            Button(
                onClick = { },
                modifier = Modifier.fillMaxWidth().height(48.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                shape = RoundedCornerShape(12.dp)
            ) { Text("充值积分", fontWeight = FontWeight.Medium) }
        }
    }
}

@Composable
private fun UsageRow(label: String, usage: String, progress: Float) {
    Column(modifier = Modifier.padding(vertical = 8.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, color = DarkText, fontSize = 14.sp)
            Text(usage, color = DarkTextSecondary, fontSize = 13.sp)
        }
        Spacer(modifier = Modifier.height(4.dp))
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier.fillMaxWidth().height(6.dp),
            color = ProgressColor(progress), trackColor = DarkSurface2, strokeCap = StrokeCap.Round
        )
    }
}

@Composable
private fun ProgressColor(progress: Float): androidx.compose.ui.graphics.Color =
    when { progress > 0.8f -> DangerRed; progress > 0.5f -> WarningYellow; else -> PrimaryBlue }
