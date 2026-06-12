package com.zhejiangjinmo.lingjing.ui.notification

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
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
import com.zhejiangjinmo.lingjing.data.local.AuthDataStore
import com.zhejiangjinmo.lingjing.data.model.StoredNotification
import com.zhejiangjinmo.lingjing.ui.theme.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

@Composable
fun NotificationScreen(navController: NavController) {
    var notifications by remember { mutableStateOf<List<StoredNotification>>(emptyList()) }
    val scope = rememberCoroutineScope()

    // Load from DataStore or use defaults
    LaunchedEffect(Unit) {
        scope.launch {
            val ds = AuthDataStore(navController.context.applicationContext)
            val saved = ds.getNotifications()
            notifications = if (saved.isNotEmpty()) saved else defaultNotifications()
        }
    }

    val unreadCount = notifications.count { !it.read }

    fun markAllRead() {
        notifications = notifications.map { it.copy(read = true) }
        scope.launch {
            AuthDataStore(navController.context.applicationContext).saveNotifications(notifications)
        }
    }

    fun markRead(item: StoredNotification) {
        notifications = notifications.map { if (it.id == item.id) it.copy(read = true) else it }
        scope.launch {
            AuthDataStore(navController.context.applicationContext).saveNotifications(notifications)
        }
    }

    Scaffold(containerColor = DarkBg) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            Row(
                modifier = Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = { navController.popBackStack() }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回", tint = DarkText)
                }
                Text("通知", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = DarkText)
                if (unreadCount > 0) {
                    Spacer(modifier = Modifier.width(8.dp))
                    Surface(shape = RoundedCornerShape(10.dp), color = DangerRed) {
                        Text(
                            "$unreadCount",
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                            fontSize = 12.sp, color = DarkText
                        )
                    }
                }
                Spacer(modifier = Modifier.weight(1f))
                if (unreadCount > 0) {
                    TextButton(onClick = { markAllRead() }) {
                        Text("全部已读", color = PrimaryBlue, fontSize = 14.sp)
                    }
                }
            }

            if (notifications.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Filled.NotificationsNone, null, tint = DarkTextTertiary, modifier = Modifier.size(48.dp))
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("暂无通知", color = DarkTextSecondary, fontSize = 16.sp)
                    }
                }
            } else {
                LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(notifications) { notification ->
                        Card(
                            modifier = Modifier.fillMaxWidth().clickable {
                                markRead(notification)
                                notification.route?.let { navController.navigate(it) }
                            },
                            colors = CardDefaults.cardColors(containerColor =
                                if (notification.read) DarkSurface else DarkSurface2),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.Top) {
                                if (!notification.read) {
                                    Surface(modifier = Modifier.size(8.dp), shape = CircleShape, color = PrimaryBlue) {}
                                    Spacer(modifier = Modifier.width(8.dp))
                                }
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(notification.title, fontWeight = FontWeight.Medium, color = DarkText, fontSize = 15.sp)
                                    Text(notification.body, color = DarkTextSecondary, fontSize = 13.sp, maxLines = 2)
                                    Text(notification.time, color = DarkTextTertiary, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun defaultNotifications() = listOf(
    StoredNotification(id = "1", title = "欢迎使用灵境", body = "灵境IDE已就绪，开始你的开发之旅吧", time = "刚刚"),
    StoredNotification(id = "2", title = "功能提示", body = "点击「快捷提示词」开始新任务，或切换到任务页查看进度", time = "刚刚")
)
