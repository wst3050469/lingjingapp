package com.zhejiangjinmo.lingjing.ui.tasks

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
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
import com.zhejiangjinmo.lingjing.data.model.Task
import com.zhejiangjinmo.lingjing.ui.navigation.Routes
import com.zhejiangjinmo.lingjing.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TasksScreen(navController: NavController) {
    var selectedTab by remember { mutableIntStateOf(0) }
    var tasks by remember { mutableStateOf<List<Task>>(emptyList()) }
    val scope = rememberCoroutineScope()

    val tabs = listOf("全部", "进行中", "待处理", "运行中", "已就绪", "已归档")

    LaunchedEffect(selectedTab) {
        scope.launch {
            try {
                val tab = when (selectedTab) { 1->"active"; 2->"pending"; 3->"running"; 4->"idle"; 5->"archived"; else->null }
                tasks = LingJingApi().getTasks(tab)
            } catch (_: Exception) {
                tasks = emptyList()
            }
        }
    }

    Scaffold(containerColor = DarkBg) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            Text("任务", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = DarkText, modifier = Modifier.padding(20.dp, 16.dp))

            // Tab 栏
            ScrollableTabRow(
                selectedTabIndex = selectedTab,
                containerColor = DarkBg,
                contentColor = PrimaryBlue,
                edgePadding = 16.dp
            ) {
                tabs.forEachIndexed { index, title ->
                    Tab(
                        selected = selectedTab == index,
                        onClick = { selectedTab = index },
                        text = { Text(title, fontSize = 14.sp) }
                    )
                }
            }
            HorizontalDivider(color = DarkBorder)

            if (tasks.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Filled.Inbox, null, tint = DarkTextTertiary, modifier = Modifier.size(48.dp))
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("暂无任务", color = DarkTextSecondary, fontSize = 16.sp)
                        Text("点击 + 启动任务", color = DarkTextTertiary, fontSize = 14.sp)
                    }
                }
            } else {
                LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(tasks) { task ->
                        TaskCard(task, navController)
                    }
                }
            }
        }
    }
}

@Composable
fun TaskCard(task: Task, navController: NavController) {
    val phaseColor = when (task.phase) {
        "running" -> SuccessGreen
        "failed" -> DangerRed
        "completed" -> PrimaryBlue
        "waiting" -> WarningYellow
        else -> DarkTextTertiary
    }

    Card(
        modifier = Modifier.fillMaxWidth().clickable {
            task.sessionId?.let { navController.navigate(Routes.workspace(it)) }
        },
        colors = CardDefaults.cardColors(containerColor = DarkSurface),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            // Phase indicator
            Box(
                modifier = Modifier.size(8.dp)
                    .padding(0.dp)
                    .then(Modifier.size(8.dp))
            ) {
                Surface(
                    modifier = Modifier.size(8.dp),
                    shape = RoundedCornerShape(4.dp),
                    color = phaseColor
                ) {}
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(task.title ?: "未命名任务", fontWeight = FontWeight.Medium, color = DarkText, fontSize = 15.sp)
                Text(task.phase, color = DarkTextSecondary, fontSize = 13.sp)
            }
            Icon(Icons.Filled.ChevronRight, null, tint = DarkTextTertiary)
        }
    }
}
