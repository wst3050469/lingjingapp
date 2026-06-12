package com.zhejiangjinmo.lingjing.ui.pairing

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.zhejiangjinmo.lingjing.data.api.LingJingApi
import com.zhejiangjinmo.lingjing.data.local.AuthDataStore
import com.zhejiangjinmo.lingjing.ui.theme.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

@Composable
fun PairingScreen(navController: NavController) {
    var pairingCode by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var paired by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    fun doPair() {
        if (pairingCode.length != 6) { error = "请输入6位配对码"; return }
        loading = true; error = ""
        scope.launch {
            try {
                val ctx = navController.context.applicationContext
                val api = LingJingApi()
                AuthDataStore(ctx).tokenFlow.first()?.let { api.setToken(it) }
                // Pairing API call
                val res = api.pairDesktop(pairingCode)
                if (res.ok) {
                    paired = true
                    // Save pairing info
                    AuthDataStore(ctx).savePairedDesktop(true)
                } else {
                    error = res.error ?: "配对失败，请检查配对码"
                }
            } catch (e: Exception) {
                error = "连接失败: ${e.message}"
            }
            loading = false
        }
    }

    Scaffold(containerColor = DarkBg) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(20.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            IconButton(
                onClick = { navController.popBackStack() },
                modifier = Modifier.align(Alignment.Start)
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回", tint = DarkText)
            }
            Spacer(modifier = Modifier.height(40.dp))

            // Pairing icon
            Card(
                modifier = Modifier.size(100.dp),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (paired) SuccessBg else PrimaryBlueBg
                )
            ) {
                Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                    Icon(
                        if (paired) Icons.Filled.CheckCircle else Icons.Filled.DesktopWindows,
                        null,
                        tint = if (paired) SuccessGreen else PrimaryBlue,
                        modifier = Modifier.size(52.dp)
                    )
                }
            }
            Spacer(modifier = Modifier.height(24.dp))

            if (paired) {
                Text("配对成功！", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = SuccessGreen)
                Spacer(modifier = Modifier.height(8.dp))
                Text("已成功连接到桌面端灵境IDE", color = DarkTextSecondary, fontSize = 15.sp, textAlign = TextAlign.Center)
                Spacer(modifier = Modifier.height(32.dp))
                OutlinedButton(
                    onClick = { navController.popBackStack() },
                    shape = RoundedCornerShape(12.dp)
                ) { Text("完成") }
            } else {
                Text("连接桌面端", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = DarkText)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    "在桌面端灵境IDE中查看配对码，\n输入下方完成连接",
                    color = DarkTextSecondary,
                    fontSize = 15.sp,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(32.dp))

                // 配对码输入
                OutlinedTextField(
                    value = pairingCode,
                    onValueChange = {
                        if (it.length <= 6) {
                            pairingCode = it.filter { c -> c.isDigit() }
                            error = ""
                        }
                    },
                    label = { Text("配对码") },
                    placeholder = { Text("请输入6位数字配对码") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = DarkText,
                        unfocusedTextColor = DarkText,
                        focusedBorderColor = PrimaryBlue,
                        unfocusedBorderColor = DarkBorder,
                        cursorColor = PrimaryBlue
                    )
                )

                if (error.isNotBlank()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(error, color = DangerRed, fontSize = 14.sp)
                }

                Spacer(modifier = Modifier.height(24.dp))

                Button(
                    onClick = { doPair() },
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    enabled = pairingCode.length == 6 && !loading,
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    if (loading) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp), color = DarkText)
                    } else {
                        Text("连接", fontSize = 16.sp, fontWeight = FontWeight.Medium)
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))
                TextButton(onClick = { /* QR扫描 - 未来实现 */ }) {
                    Icon(Icons.Filled.QrCodeScanner, null, tint = PrimaryBlue)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("扫描二维码", color = PrimaryBlue)
                }
            }
        }
    }
}
