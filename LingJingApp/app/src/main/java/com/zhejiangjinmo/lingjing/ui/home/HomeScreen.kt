package com.zhejiangjinmo.lingjing.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.zhejiangjinmo.lingjing.ui.navigation.Routes
import com.zhejiangjinmo.lingjing.ui.theme.*

@Composable
fun HomeScreen(navController: NavController) {
    Scaffold(
        containerColor = DarkBg,
        bottomBar = { BottomNavBar(navController) }
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding)
                .verticalScroll(rememberScrollState()).padding(20.dp)
        ) {
            // 问候语
            Spacer(modifier = Modifier.height(16.dp))
            Text("你好 👋", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = DarkText)
            Text("灵境可以帮你做什么？", fontSize = 16.sp, color = DarkTextSecondary)
            Spacer(modifier = Modifier.height(20.dp))

            // 积分横幅
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = PrimaryBlueBg),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Filled.CardGiftcard, null, tint = PrimaryBlue, modifier = Modifier.size(32.dp))
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text("300 积分已到账", fontWeight = FontWeight.Bold, color = PrimaryBlue, fontSize = 16.sp)
                        Text("快开始一个任务体验一下吧！", color = DarkTextSecondary, fontSize = 14.sp)
                    }
                }
            }
            Spacer(modifier = Modifier.height(24.dp))

            // 快捷提示词
            Text("快速开始", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = DarkText)
            Spacer(modifier = Modifier.height(12.dp))

            val prompts = listOf(
                Triple("搭建新应用", "帮我搭建一个简洁的待办事项应用", Icons.Filled.Apps),
                Triple("修复缺陷", "排查项目中的错误和性能问题", Icons.Filled.BugReport),
                Triple("快速看懂项目", "帮我快速了解项目结构和主要功能", Icons.AutoMirrored.Filled.MenuBook),
                Triple("从截图做界面", "根据截图实现还原的界面", Icons.Filled.Screenshot)
            )

            prompts.forEach { (title, desc, icon) ->
                Card(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)
                        .clickable {
                            navController.navigate(Routes.ENVIRONMENT)
                        },
                    colors = CardDefaults.cardColors(containerColor = DarkSurface),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier.size(40.dp).clip(RoundedCornerShape(10.dp))
                                .background(PrimaryBlueBg),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(icon, null, tint = PrimaryBlue, modifier = Modifier.size(22.dp))
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(title, fontWeight = FontWeight.Medium, color = DarkText, fontSize = 15.sp)
                            Text(desc, color = DarkTextSecondary, fontSize = 13.sp, maxLines = 1)
                        }
                        Icon(Icons.Filled.ChevronRight, null, tint = DarkTextTertiary)
                    }
                }
            }
            Spacer(modifier = Modifier.height(80.dp))
        }
    }
}

@Composable
fun BottomNavBar(navController: NavController) {
    NavigationBar(containerColor = DarkSurface, contentColor = PrimaryBlue) {
        NavigationBarItem(
            selected = true,
            onClick = {},
            icon = { Icon(Icons.Filled.ChatBubble, "对话") },
            label = { Text("对话") }
        )
        NavigationBarItem(
            selected = false,
            onClick = { navController.navigate(Routes.TASKS) },
            icon = { Icon(Icons.Filled.CheckCircle, "任务") },
            label = { Text("任务") }
        )
        NavigationBarItem(
            selected = false,
            onClick = { navController.navigate(Routes.FILE_TREE) },
            icon = { Icon(Icons.Filled.FolderOpen, "文件") },
            label = { Text("文件") }
        )
        NavigationBarItem(
            selected = false,
            onClick = { navController.navigate(Routes.PROJECTS) },
            icon = { Icon(Icons.Filled.Code, "开发") },
            label = { Text("开发") }
        )
        NavigationBarItem(
            selected = false,
            onClick = { navController.navigate(Routes.SETTINGS) },
            icon = { Icon(Icons.Filled.Settings, "设置") },
            label = { Text("设置") }
        )
    }
}
