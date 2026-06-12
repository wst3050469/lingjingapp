package com.zhejiangjinmo.lingjing.ui.pairing

import androidx.compose.foundation.layout.*
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

@Composable
fun PairingScreen(navController: NavController) {
    var pairingCode by remember { mutableStateOf("") }
    var isScanning by remember { mutableStateOf(true) }

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
                colors = CardDefaults.cardColors(containerColor = PrimaryBlueBg)
            ) {
                Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                    Icon(
                        Icons.Filled.DesktopWindows,
                        null,
                        tint = PrimaryBlue,
                        modifier = Modifier.size(52.dp)
                    )
                }
            }
            Spacer(modifier = Modifier.height(24.dp))

            Text("连接桌面端", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = DarkText)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                "在你的桌面端灵境IDE中查看配对码，\n输入下方完成连接",
                color = DarkTextSecondary,
                fontSize = 15.sp,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )

            Spacer(modifier = Modifier.height(32.dp))

            // 配对码输入
            Row(verticalAlignment = Alignment.CenterVertically) {
                (0..5).forEach { i ->
                    OutlinedTextField(
                        value = pairingCode.getOrElse(i) { ' ' }.toString().trim(),
                        onValueChange = { newChar ->
                            if (newChar.length <= 1 && pairingCode.length < 6) {
                                pairingCode = pairingCode + newChar
                            }
                        },
                        modifier = Modifier.width(46.dp),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = DarkText,
                            unfocusedTextColor = DarkText,
                            focusedBorderColor = PrimaryBlue,
                            unfocusedBorderColor = DarkBorder
                        )
                    )
                    if (i < 5) Spacer(modifier = Modifier.width(8.dp))
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            Button(
                onClick = { /* 开始配对 */ },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                enabled = pairingCode.length == 6,
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("连接", fontSize = 16.sp, fontWeight = FontWeight.Medium)
            }

            Spacer(modifier = Modifier.height(24.dp))
            TextButton(onClick = { /* QR扫描 */ }) {
                Icon(Icons.Filled.QrCodeScanner, null, tint = PrimaryBlue)
                Spacer(modifier = Modifier.width(8.dp))
                Text("扫描二维码", color = PrimaryBlue)
            }
        }
    }
}
