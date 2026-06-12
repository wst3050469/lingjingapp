package com.zhejiangjinmo.lingjing.ui.environment

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.zhejiangjinmo.lingjing.ui.navigation.Routes
import com.zhejiangjinmo.lingjing.ui.theme.*
import java.util.UUID

@Composable
fun EnvironmentScreen(navController: NavController) {
    Scaffold(containerColor = DarkBg) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(20.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { navController.popBackStack() }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回", tint = DarkText)
                }
                Text("选择环境", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = DarkText)
            }
            Spacer(modifier = Modifier.height(20.dp))

            // 云端环境
            EnvCard(
                icon = Icons.Filled.Cloud,
                title = "云端",
                subtitle = "在灵境云端沙箱中运行",
                color = PrimaryBlue
            ) {
                val sessionId = UUID.randomUUID().toString()
                navController.navigate(Routes.workspace(sessionId))
            }
            Spacer(modifier = Modifier.height(12.dp))

            // 桌面端
            EnvCard(
                icon = Icons.Filled.DesktopWindows,
                title = "桌面端",
                subtitle = "连接到你的电脑",
                color = SuccessGreen
            ) {
                navController.navigate(Routes.PAIRING)
            }
            Spacer(modifier = Modifier.height(12.dp))

            // 本地
            EnvCard(
                icon = Icons.Filled.PhoneAndroid,
                title = "本地",
                subtitle = "直接在手机上运行",
                color = WarningYellow
            ) {
                val sessionId = UUID.randomUUID().toString()
                navController.navigate(Routes.workspace(sessionId))
            }
        }
    }
}

@Composable
private fun EnvCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    subtitle: String,
    color: androidx.compose.ui.graphics.Color,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = DarkSurface),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(modifier = Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(48.dp),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, null, tint = color, modifier = Modifier.size(36.dp))
            }
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(title, fontWeight = FontWeight.SemiBold, color = DarkText, fontSize = 17.sp)
                Text(subtitle, color = DarkTextSecondary, fontSize = 14.sp)
            }
            Icon(Icons.Filled.ChevronRight, null, tint = DarkTextTertiary)
        }
    }
}
