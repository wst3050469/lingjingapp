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
import com.zhejiangjinmo.lingjing.ui.navigation.Routes
import com.zhejiangjinmo.lingjing.ui.theme.*

data class FileNode(
    val name: String,
    val isDirectory: Boolean,
    val children: List<FileNode> = emptyList()
)

@Composable
fun FileTreeScreen(navController: NavController) {
    val rootFiles = remember {
        listOf(
            FileNode("app/", true, listOf(
                FileNode("src/", true, listOf(
                    FileNode("main/", true, listOf(
                        FileNode("java/", true, listOf(
                            FileNode("HomeScreen.kt", false),
                            FileNode("WorkspaceScreen.kt", false)
                        )),
                        FileNode("res/", true)
                    )),
                    FileNode("test/", true)
                )),
                FileNode("build.gradle.kts", false)
            )),
            FileNode("settings.gradle.kts", false),
            FileNode("README.md", false)
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
                Text("文件", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = DarkText)
            }

            LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp)) {
                items(rootFiles) { file ->
                    FileNodeItem(file, 0, navController)
                }
            }
        }
    }
}

@Composable
fun FileNodeItem(node: FileNode, depth: Int, navController: NavController) {
    var expanded by remember { mutableStateOf(true) }
    val icon = if (node.isDirectory) {
        if (expanded) Icons.Filled.FolderOpen else Icons.Filled.Folder
    } else {
        when {
            node.name.endsWith(".kt") -> Icons.Filled.Code
            node.name.endsWith(".xml") -> Icons.Filled.DataObject
            node.name.endsWith(".md") -> Icons.AutoMirrored.Filled.Article
            else -> Icons.AutoMirrored.Filled.InsertDriveFile
        }
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable {
                if (node.isDirectory) expanded = !expanded
                else navController.navigate(Routes.editor(node.name))
            }
            .padding(start = (depth * 20).dp, top = 4.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (node.isDirectory) {
            Icon(
                if (expanded) Icons.Filled.ExpandMore else Icons.Filled.ChevronRight,
                null,
                tint = DarkTextTertiary,
                modifier = Modifier.size(20.dp)
            )
        } else {
            Spacer(modifier = Modifier.width(20.dp))
        }
        Spacer(modifier = Modifier.width(4.dp))
        Icon(icon, null, tint = if (node.isDirectory) WarningYellow else PrimaryBlue, modifier = Modifier.size(20.dp))
        Spacer(modifier = Modifier.width(8.dp))
        Text(node.name, color = DarkText, fontSize = 14.sp)
    }

    if (expanded && node.isDirectory) {
        node.children.forEach { child ->
            FileNodeItem(child, depth + 1, navController)
        }
    }
}
