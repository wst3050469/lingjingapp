package com.zhejiangjinmo.lingjing.ui.settings

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

@Composable
fun SettingsScreen(navController: NavController) {
    Scaffold(containerColor = DarkBg) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            Row(modifier = Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { navController.popBackStack() }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回", tint = DarkText)
                }
                Text("设置", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = DarkText)
            }

            Column(modifier = Modifier.padding(horizontal = 20.dp)) {
                SettingsGroup("账户") {
                    SettingsRow(Icons.Filled.Person, "个人资料", "查看和编辑个人资料") { navController.navigate(Routes.USAGE) }
                    SettingsRow(Icons.Filled.Security, "安全设置", "密码和双重验证") { }
                }
                SettingsGroup("通用") {
                    SettingsRow(Icons.Filled.Notifications, "通知", "管理通知偏好") { navController.navigate(Routes.NOTIFICATIONS) }
                    SettingsRow(Icons.Filled.Cloud, "云端同步", "同步状态: 已连接") { }
                }
                SettingsGroup("开发设置") {
                    SettingsRow(Icons.Filled.Terminal, "Shell配置", "默认 shell: bash") { }
                    SettingsRow(Icons.Filled.Code, "编辑器", "主题: Monokai Dark") { }
                    SettingsRow(Icons.Filled.Extension, "插件市场") { navController.navigate(Routes.PLUGINS) }
                }
                SettingsGroup("其他") {
                    SettingsRow(Icons.Filled.SystemUpdate, "检查更新", "版本 1.0.0") { navController.navigate(Routes.UPDATE) }
                    SettingsRow(Icons.Filled.Info, "关于灵境", "了解更多") { }
                }
                Spacer(modifier = Modifier.height(20.dp))
                OutlinedButton(
                    onClick = { navController.navigate(Routes.LOGIN) { popUpTo(Routes.HOME) { inclusive = true } } },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = DangerRed),
                    shape = RoundedCornerShape(12.dp)
                ) { Text("退出登录", fontWeight = FontWeight.Medium) }
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}

@Composable
fun SettingsGroup(title: String, content: @Composable ColumnScope.() -> Unit) {
    Text(title, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = DarkTextSecondary,
        modifier = Modifier.padding(bottom = 8.dp, top = 16.dp))
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = DarkSurface),
        shape = RoundedCornerShape(12.dp)
    ) { Column(modifier = Modifier.padding(8.dp)) { content() } }
}

@Composable
fun SettingsRow(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String,
    subtitle: String? = null, onClick: () -> Unit = {}) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(12.dp, 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, null, tint = PrimaryBlue, modifier = Modifier.size(22.dp))
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = DarkText, fontSize = 15.sp)
            if (subtitle != null) Text(subtitle, color = DarkTextTertiary, fontSize = 13.sp)
        }
        Icon(Icons.Filled.ChevronRight, null, tint = DarkTextTertiary)
    }
}
