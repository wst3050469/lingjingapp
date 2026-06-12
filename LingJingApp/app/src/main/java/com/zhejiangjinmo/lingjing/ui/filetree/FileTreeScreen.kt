package com.zhejiangjinmo.lingjing.ui.filetree

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Article
import androidx.compose.material.icons.automirrored.filled.InsertDriveFile
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
import com.zhejiangjinmo.lingjing.data.model.FileEntry
import com.zhejiangjinmo.lingjing.ui.navigation.Routes
import com.zhejiangjinmo.lingjing.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun FileTreeScreen(navController: NavController) {
    var rootEntries by remember { mutableStateOf<List<FileEntry>>(emptyList()) }
    var expandedDirs by remember { mutableStateOf<Map<String, List<FileEntry>>>(emptyMap()) }
    var loading by remember { mutableStateOf(true) }
    var currentPath by remember { mutableStateOf("/root/cloud-server") }
    var errorMsg by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val api = remember { LingJingApi() }

    fun loadDir(path: String) {
        scope.launch {
            try {
                val resp = api.listFiles(path)
                val sorted = resp.entries.sortedWith(compareByDescending<FileEntry> { it.type == "dir" }.thenBy { it.name })
                if (path == currentPath) {
                    rootEntries = sorted
                } else {
                    expandedDirs = expandedDirs + (path to sorted)
                }
            } catch (e: Exception) {
                errorMsg = "加载失败: ${e.message}"
            }
            loading = false
        }
    }

    fun toggleDir(entry: FileEntry) {
        if (expandedDirs.containsKey(entry.path)) {
            expandedDirs = expandedDirs - entry.path
        } else {
            loadDir(entry.path)
        }
    }

    fun goUp() {
        val parent = currentPath.substringBeforeLast("/").ifEmpty { "/" }
        currentPath = parent
        loading = true
        loadDir(parent)
    }

    LaunchedEffect(Unit) {
        loadDir(currentPath)
    }

    Scaffold(containerColor = DarkBg) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            // 顶部栏
            Row(
                modifier = Modifier.padding(12.dp, 16.dp, 20.dp, 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = { navController.popBackStack() }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回", tint = DarkText)
                }
                Text("文件", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = DarkText, modifier = Modifier.weight(1f))
                IconButton(onClick = { goUp() }, enabled = currentPath != "/") {
                    Icon(Icons.Filled.ArrowUpward, "上级目录", tint = if (currentPath != "/") PrimaryBlue else DarkTextTertiary)
                }
            }

            // 当前路径
            Surface(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                shape = RoundedCornerShape(6.dp),
                color = DarkSurface2
            ) {
                Text(
                    currentPath,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    color = DarkTextSecondary,
                    fontSize = 12.sp
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            when {
                loading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(color = PrimaryBlue, modifier = Modifier.size(32.dp))
                            Spacer(modifier = Modifier.height(12.dp))
                            Text("加载中...", color = DarkTextSecondary)
                        }
                    }
                }
                errorMsg != null -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Filled.ErrorOutline, null, tint = DangerRed, modifier = Modifier.size(48.dp))
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(errorMsg!!, color = DangerRed)
                        }
                    }
                }
                rootEntries.isEmpty() -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Filled.FolderOpen, null, tint = DarkTextTertiary, modifier = Modifier.size(48.dp))
                            Spacer(modifier = Modifier.height(12.dp))
                            Text("空目录", color = DarkTextSecondary, fontSize = 16.sp)
                        }
                    }
                }
                else -> {
                    LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)) {
                        items(rootEntries) { entry ->
                            FileNodeItem(
                                entry = entry,
                                depth = 0,
                                expandedDirs = expandedDirs,
                                onToggle = { toggleDir(entry) },
                                onClickFile = { path ->
                                    // URL encode 路径
                                    navController.navigate(Routes.editor(path))
                                },
                                api = api,
                                scope = scope
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun FileNodeItem(
    entry: FileEntry,
    depth: Int,
    expandedDirs: Map<String, List<FileEntry>>,
    onToggle: () -> Unit,
    onClickFile: (String) -> Unit,
    api: LingJingApi,
    scope: kotlinx.coroutines.CoroutineScope
) {
    val isDir = entry.type == "dir"
    val isExpanded = expandedDirs.containsKey(entry.path)
    val children = expandedDirs[entry.path] ?: emptyList()

    val icon = if (isDir) {
        if (isExpanded) Icons.Filled.FolderOpen else Icons.Filled.Folder
    } else {
        when {
            entry.name.endsWith(".kt") -> Icons.Filled.Code
            entry.name.endsWith(".xml") -> Icons.Filled.DataObject
            entry.name.endsWith(".md") -> Icons.AutoMirrored.Filled.Article
            entry.name.endsWith(".json") -> Icons.Filled.DataObject
            else -> Icons.AutoMirrored.Filled.InsertDriveFile
        }
    }

    Column {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable {
                    if (isDir) onToggle()
                    else onClickFile(entry.path)
                }
                .padding(start = (depth * 20).dp, top = 6.dp, bottom = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (isDir) {
                Icon(
                    if (isExpanded) Icons.Filled.ExpandMore else Icons.Filled.ChevronRight,
                    null,
                    tint = DarkTextTertiary,
                    modifier = Modifier.size(20.dp)
                )
            } else {
                Spacer(modifier = Modifier.width(20.dp))
            }
            Spacer(modifier = Modifier.width(4.dp))
            Icon(icon, null, tint = if (isDir) WarningYellow else PrimaryBlue, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text(entry.name, color = DarkText, fontSize = 14.sp)
            if (!isDir && entry.size > 0) {
                Spacer(modifier = Modifier.weight(1f))
                Text(formatSize(entry.size), color = DarkTextTertiary, fontSize = 11.sp)
            }
        }

        if (isExpanded && isDir) {
            children.forEach { child ->
                FileNodeItem(
                    entry = child,
                    depth = depth + 1,
                    expandedDirs = expandedDirs,
                    onToggle = {
                        // 递归展开
                    },
                    onClickFile = onClickFile,
                    api = api,
                    scope = scope
                )
            }
        }
    }
}

private fun formatSize(bytes: Long): String = when {
    bytes < 1024 -> "$bytes B"
    bytes < 1024 * 1024 -> "${bytes / 1024} KB"
    else -> "%.1f MB".format(bytes.toDouble() / (1024 * 1024))
}
