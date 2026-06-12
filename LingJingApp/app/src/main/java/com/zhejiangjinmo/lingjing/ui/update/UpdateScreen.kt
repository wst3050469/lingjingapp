package com.zhejiangjinmo.lingjing.ui.update

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.zhejiangjinmo.lingjing.BuildConfig
import com.zhejiangjinmo.lingjing.data.api.LingJingApi
import com.zhejiangjinmo.lingjing.data.local.AuthDataStore
import com.zhejiangjinmo.lingjing.data.model.UpdateInfo
import com.zhejiangjinmo.lingjing.ui.theme.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

@Composable
fun UpdateScreen(navController: NavController) {
    var checking by remember { mutableStateOf(true) }
    var updateInfo by remember { mutableStateOf<UpdateInfo?>(null) }
    var error by remember { mutableStateOf("") }
    var downloaded by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    fun doCheck() {
        checking = true; error = ""
        scope.launch {
            try {
                val ctx = navController.context.applicationContext
                val api = LingJingApi()
                AuthDataStore(ctx).tokenFlow.first()?.let { api.setToken(it) }
                updateInfo = api.checkUpdate(BuildConfig.VERSION_NAME)
            } catch (e: Exception) {
                error = "检查失败: ${e.message}"
            }
            checking = false
        }
    }

    LaunchedEffect(Unit) { doCheck() }

    val hasUpdate = updateInfo?.hasUpdate == true
    val latestVersion = updateInfo?.version ?: ""
    val downloadUrl = updateInfo?.files?.android ?: ""

    Scaffold(containerColor = DarkBg) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(20.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            IconButton(onClick = { navController.popBackStack() }, modifier = Modifier.align(Alignment.Start)) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回", tint = DarkText)
            }
            Spacer(modifier = Modifier.height(40.dp))

            if (checking) {
                CircularProgressIndicator(color = PrimaryBlue, modifier = Modifier.size(48.dp))
                Spacer(modifier = Modifier.height(16.dp))
                Text("检查更新中...", color = DarkTextSecondary, fontSize = 15.sp)
            } else if (error.isNotBlank()) {
                Icon(Icons.Filled.ErrorOutline, null, tint = DangerRed, modifier = Modifier.size(64.dp))
                Spacer(modifier = Modifier.height(12.dp))
                Text(error, color = DangerRed, fontSize = 14.sp)
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedButton(onClick = { doCheck() }, shape = RoundedCornerShape(12.dp)) {
                    Text("重试")
                }
            } else if (hasUpdate) {
                Icon(Icons.Filled.NewReleases, null, tint = WarningYellow, modifier = Modifier.size(64.dp))
                Spacer(modifier = Modifier.height(20.dp))
                Text("新版本可用", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = DarkText)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    "v$latestVersion (当前 ${BuildConfig.VERSION_NAME})",
                    color = DarkTextSecondary, fontSize = 15.sp
                )
                Spacer(modifier = Modifier.height(24.dp))

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = DarkSurface),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("更新内容", fontWeight = FontWeight.SemiBold, color = DarkText, fontSize = 16.sp)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            updateInfo?.releaseNotes ?: "新版本发布",
                            color = DarkTextSecondary, fontSize = 14.sp
                        )
                    }
                }

                Spacer(modifier = Modifier.height(32.dp))
                Button(
                    onClick = {
                        if (downloadUrl.isNotBlank()) {
                            try {
                                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(downloadUrl)))
                            } catch (_: Exception) {}
                        }
                        downloaded = true
                    },
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (downloaded) SuccessGreen else PrimaryBlue
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(
                        if (downloaded) Icons.Filled.CheckCircle else Icons.Filled.Download,
                        null
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        if (downloaded) "已打开浏览器" else "下载更新",
                        fontSize = 16.sp, fontWeight = FontWeight.Medium
                    )
                }
            } else {
                Icon(Icons.Filled.CheckCircle, null, tint = SuccessGreen, modifier = Modifier.size(64.dp))
                Spacer(modifier = Modifier.height(20.dp))
                Text("已是最新版本", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = DarkText)
                Spacer(modifier = Modifier.height(8.dp))
                Text("v${BuildConfig.VERSION_NAME}", color = DarkTextSecondary, fontSize = 15.sp)

                Spacer(modifier = Modifier.height(32.dp))
                OutlinedButton(
                    onClick = { doCheck() },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    enabled = !checking,
                    shape = RoundedCornerShape(12.dp)
                ) { Text("重新检查") }
            }
        }
    }
}
