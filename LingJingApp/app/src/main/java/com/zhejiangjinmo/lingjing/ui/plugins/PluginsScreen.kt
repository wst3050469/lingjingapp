package com.zhejiangjinmo.lingjing.ui.plugins

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.zhejiangjinmo.lingjing.ui.theme.*

data class PluginInfo(
    val name: String,
    val description: String,
    val icon: String,
    val installed: Boolean
)

@Composable
fun PluginsScreen(navController: NavController) {
    val plugins = remember {
        listOf(
            PluginInfo("Python", "Python语言支持，包括代码补全和语法高亮", "code", true),
            PluginInfo("Git", "内置Git支持，查看状态、提交、推送", "source", true),
            PluginInfo("Docker", "Docker容器管理，构建和部署", "deployed_code", false),
            PluginInfo("数据库", "SQL数据库连接和管理工具", "storage", false),
            PluginInfo("AI模型", "本地AI模型运行和推理", "psychology", true),
            PluginInfo("终端主题", "自定义终端配色方案", "palette", false)
        )
    }

    Scaffold(containerColor = DarkBg) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            Row(
                modifier = Modifier.padding(20.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = { navController.popBackStack() }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回", tint = DarkText)
                }
                Text("插件", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = DarkText)
            }

            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                contentPadding = PaddingValues(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(plugins) { plugin ->
                    Card(
                        modifier = Modifier.fillMaxWidth().clickable { /* toggle */ },
                        colors = CardDefaults.cardColors(containerColor = DarkSurface),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Icon(Icons.Filled.Extension, null, tint = if (plugin.installed) SuccessGreen else DarkTextTertiary, modifier = Modifier.size(32.dp))
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(plugin.name, fontWeight = FontWeight.SemiBold, color = DarkText, fontSize = 15.sp)
                            Text(
                                plugin.description,
                                color = DarkTextSecondary,
                                fontSize = 12.sp,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.padding(top = 4.dp)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Surface(
                                    shape = RoundedCornerShape(4.dp),
                                    color = if (plugin.installed) SuccessBg else DarkSurface2
                                ) {
                                    Text(
                                        if (plugin.installed) "已安装" else "安装",
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                        fontSize = 11.sp,
                                        color = if (plugin.installed) SuccessGreen else DarkTextSecondary
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
