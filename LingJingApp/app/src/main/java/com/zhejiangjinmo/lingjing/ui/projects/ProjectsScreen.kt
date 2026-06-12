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
import com.zhejiangjinmo.lingjing.data.api.LingJingApi
import com.zhejiangjinmo.lingjing.data.local.AuthDataStore
import com.zhejiangjinmo.lingjing.data.model.Requirement
import com.zhejiangjinmo.lingjing.ui.theme.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

@Composable
fun ProjectsScreen(navController: NavController) {
    var requirements by remember { mutableStateOf<List<Requirement>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        scope.launch {
            try {
                val context = navController.context.applicationContext
                val dataStore = AuthDataStore(context)
                val api = LingJingApi()
                dataStore.tokenFlow.first()?.let { api.setToken(it) }
                requirements = api.getRequirements()
            } catch (e: Exception) {
                error = "加载失败: ${e.message}"
            }
            loading = false
        }
    }

    Scaffold(
        containerColor = DarkBg,
        floatingActionButton = {
            FloatingActionButton(
                onClick = { /* 新建需求 */ },
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
                Text("需求/项目", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = DarkText)
            }

            if (loading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = PrimaryBlue)
                }
            } else if (error.isNotBlank()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(error, color = DangerRed, fontSize = 14.sp)
                }
            } else if (requirements.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Filled.Code, null, tint = DarkTextTertiary, modifier = Modifier.size(48.dp))
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("暂无需求", color = DarkTextSecondary, fontSize = 16.sp)
                        Text("点击 + 创建新需求", color = DarkTextTertiary, fontSize = 14.sp)
                    }
                }
            } else {
                LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(requirements) { req ->
                        Card(
                            modifier = Modifier.fillMaxWidth().clickable { },
                            colors = CardDefaults.cardColors(containerColor = DarkSurface),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                                val icon = when (req.priority) {
                                    "high" -> Icons.Filled.PriorityHigh
                                    "low" -> Icons.Filled.ArrowDownward
                                    else -> Icons.Filled.Info
                                }
                                Icon(icon, null, tint = when(req.priority) {
                                    "high" -> DangerRed; "medium" -> WarningYellow; else -> SuccessGreen
                                }, modifier = Modifier.size(28.dp))
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(req.title, fontWeight = FontWeight.SemiBold, color = DarkText, fontSize = 15.sp)
                                    if (!req.description.isNullOrBlank()) {
                                        Text(req.description, color = DarkTextSecondary, fontSize = 13.sp, maxLines = 2)
                                    }
                                    Row {
                                        Surface(
                                            shape = RoundedCornerShape(4.dp),
                                            color = DarkSurface2
                                        ) {
                                            Text(
                                                req.status.uppercase(),
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                                fontSize = 11.sp,
                                                color = DarkTextTertiary
                                            )
                                        }
                                        if (req.assignee != null) {
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Text(req.assignee, color = PrimaryBlue, fontSize = 12.sp)
                                        }
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
