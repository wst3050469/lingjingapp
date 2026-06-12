package com.zhejiangjinmo.lingjing.ui.projects

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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

data class ProjectInfo(
    val name: String,
    val description: String,
    val language: String,
    val lastModified: String
)

@Composable
fun ProjectsScreen(navController: NavController) {
    val projects = remember {
        listOf(
            ProjectInfo("LingJingApp", "灵境 Android 原生应用", "Kotlin", "2分钟前"),
            ProjectInfo("lingjing-server", "后端API服务", "Python", "1小时前"),
            ProjectInfo("lingjing-web", "Web前端", "TypeScript", "3天前")
        )
    }

    Scaffold(
        containerColor = DarkBg,
        floatingActionButton = {
            FloatingActionButton(
                onClick = { /* 新建项目 */ },
                containerColor = PrimaryBlue
            ) {
                Icon(Icons.Filled.Add, "新建", tint = DarkBg)
            }
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            Row(
                modifier = Modifier.padding(20.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = { navController.popBackStack() }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回", tint = DarkText)
                }
                Text("项目", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = DarkText)
            }

            if (projects.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Filled.Code, null, tint = DarkTextTertiary, modifier = Modifier.size(48.dp))
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("暂无项目", color = DarkTextSecondary, fontSize = 16.sp)
                        Text("点击 + 创建新项目", color = DarkTextTertiary, fontSize = 14.sp)
                    }
                }
            } else {
                LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(projects) { project ->
                        Card(
                            modifier = Modifier.fillMaxWidth().clickable { /* 进入项目 */ },
                            colors = CardDefaults.cardColors(containerColor = DarkSurface),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier.size(44.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Filled.Folder, null, tint = PrimaryBlue, modifier = Modifier.size(32.dp))
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(project.name, fontWeight = FontWeight.SemiBold, color = DarkText, fontSize = 16.sp)
                                    Text(project.description, color = DarkTextSecondary, fontSize = 13.sp)
                                    Row {
                                        Text(project.language, color = PrimaryBlue, fontSize = 12.sp)
                                        Text(" · ${project.lastModified}", color = DarkTextTertiary, fontSize = 12.sp)
                                    }
                                }
                                Icon(Icons.Filled.ChevronRight, null, tint = DarkTextTertiary)
                            }
                        }
                    }
                }
            }
        }
    }
}
