package com.zhejiangjinmo.lingjing.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Business
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.zhejiangjinmo.lingjing.ui.theme.*

@Composable
fun EnterpriseLoginScreen(navController: NavController) {
    Scaffold(containerColor = DarkBg) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp)
        ) {
            IconButton(onClick = { navController.popBackStack() }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回", tint = DarkText)
            }
            Spacer(modifier = Modifier.height(16.dp))
            Text("企业账号登录", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = DarkText)
            Text("此入口仅支持企业账号登录", fontSize = 16.sp, color = DarkTextSecondary)
            Spacer(modifier = Modifier.height(48.dp))

            Box(
                modifier = Modifier.fillMaxWidth().weight(1f),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Filled.Business, null, modifier = Modifier.size(64.dp), tint = Purple)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        "企业 SSO 登录",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Medium,
                        color = DarkText
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "企业用户请通过公司SSO系统登录\n即将支持 SAML/OAuth 等协议",
                        fontSize = 14.sp,
                        color = DarkTextSecondary,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}
