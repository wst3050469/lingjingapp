package com.zhejiangjinmo.lingjing.ui.environment

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
import com.zhejiangjinmo.lingjing.ui.navigation.Routes
import com.zhejiangjinmo.lingjing.ui.theme.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

@Composable
fun EnvironmentScreen(navController: NavController) {
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    fun selectEnv(type: String, title: String) {
        loading = true; error = ""
        scope.launch {
            try {
                val ctx = navController.context.applicationContext
                val api = LingJingApi()
                AuthDataStore(ctx).tokenFlow.first()?.let { api.setToken(it) }
                val session = api.createSession(mapOf("type" to type, "title" to title))
                navController.navigate(Routes.workspace(session.id))
            } catch (e: Exception) {
                error = "创建会话失败: ${e.message}"
            }
            loading = false
        }
    }

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

            if (loading) {
                Box(modifier = Modifier.fillMaxWidth().height(100.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = PrimaryBlue)
                }
            }

            if (error.isNotBlank()) {
                Card(
                    modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                    colors = CardDefaults.cardColors(containerColor = DangerBg),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(error, color = DangerRed, fontSize = 13.sp, modifier = Modifier.padding(12.dp))
                }
            }

            // 云端环境
            EnvCard(
                icon = Icons.Filled.Cloud,
                title = "云端",
                subtitle = "在灵境云端沙箱中运行",
                color = PrimaryBlue,
                enabled = !loading
            ) { selectEnv("cloud", "云端会话") }
            Spacer(modifier = Modifier.height(12.dp))

            // 桌面端
            EnvCard(
                icon = Icons.Filled.DesktopWindows,
                title = "桌面端",
                subtitle = "连接到你的电脑",
                color = SuccessGreen,
                enabled = !loading
            ) { navController.navigate(Routes.PAIRING) }
            Spacer(modifier = Modifier.height(12.dp))

            // 本地
            EnvCard(
                icon = Icons.Filled.PhoneAndroid,
                title = "本地",
                subtitle = "直接在手机上运行",
                color = WarningYellow,
                enabled = !loading
            ) { selectEnv("local", "本地会话") }
        }
    }
}

@Composable
private fun EnvCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    subtitle: String,
    color: androidx.compose.ui.graphics.Color,
    enabled: Boolean = true,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(enabled = enabled, onClick = onClick),
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
