package com.zhejiangjinmo.lingjing.ui.update

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
import com.zhejiangjinmo.lingjing.ui.theme.*

@Composable
fun UpdateScreen(navController: NavController) {
    var checking by remember { mutableStateOf(false) }
    var updateAvailable by remember { mutableStateOf(true) }

    Scaffold(containerColor = DarkBg) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(20.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            IconButton(onClick = { navController.popBackStack() }, modifier = Modifier.align(Alignment.Start)) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回", tint = DarkText)
            }
            Spacer(modifier = Modifier.height(40.dp))

            if (updateAvailable) {
                Icon(Icons.Filled.NewReleases, null, tint = WarningYellow, modifier = Modifier.size(64.dp))
                Spacer(modifier = Modifier.height(20.dp))
                Text("新版本可用", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = DarkText)
                Spacer(modifier = Modifier.height(8.dp))
                Text("v1.0.1 (当前 v1.0.0)", color = DarkTextSecondary, fontSize = 15.sp)
                Spacer(modifier = Modifier.height(24.dp))

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = DarkSurface),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("更新内容", fontWeight = FontWeight.SemiBold, color = DarkText, fontSize = 16.sp)
                        Spacer(modifier = Modifier.height(8.dp))
                        listOf("修复已知问题", "优化性能和稳定性", "新增插件市场").forEach {
                            Row(modifier = Modifier.padding(vertical = 3.dp)) {
                                Icon(Icons.Filled.CheckCircle, null, tint = SuccessGreen, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(it, color = DarkTextSecondary, fontSize = 14.sp)
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(32.dp))
                Button(
                    onClick = { /* 开始下载 */ },
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = SuccessGreen),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Filled.Download, null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("立即更新", fontSize = 16.sp, fontWeight = FontWeight.Medium)
                }
            } else {
                Icon(Icons.Filled.CheckCircle, null, tint = SuccessGreen, modifier = Modifier.size(64.dp))
                Spacer(modifier = Modifier.height(20.dp))
                Text("已是最新版本", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = DarkText)
                Spacer(modifier = Modifier.height(8.dp))
                Text("v1.0.0", color = DarkTextSecondary, fontSize = 15.sp)

                Spacer(modifier = Modifier.height(32.dp))
                OutlinedButton(
                    onClick = { checking = true },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    enabled = !checking,
                    shape = RoundedCornerShape(12.dp)
                ) {
                    if (checking) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                        Spacer(modifier = Modifier.width(8.dp))
                    }
                    Text(if (checking) "检查中..." else "检查更新")
                }
            }
        }
    }
}
