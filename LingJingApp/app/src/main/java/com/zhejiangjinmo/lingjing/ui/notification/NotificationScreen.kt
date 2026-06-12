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
import com.zhejiangjinmo.lingjing.ui.theme.*

data class NotificationItem(val title: String, val body: String, val time: String, val read: Boolean)

@Composable
fun NotificationScreen(navController: NavController) {
    val notifications = remember {
        listOf(
            NotificationItem("任务完成", "「修复登录Bug」任务已成功完成", "5分钟前", false),
            NotificationItem("积分到账", "300积分已成功充值到你的账户", "1小时前", true),
            NotificationItem("新版本", "灵境IDE v1.0.1 已发布", "3小时前", true),
            NotificationItem("构建成功", "LingJingApp 构建成功", "昨天", true)
        )
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
                Spacer(modifier = Modifier.weight(1f))
                TextButton(onClick = { }) { Text("全部已读", color = PrimaryBlue, fontSize = 14.sp) }
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
                            modifier = Modifier.fillMaxWidth().clickable { },
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
