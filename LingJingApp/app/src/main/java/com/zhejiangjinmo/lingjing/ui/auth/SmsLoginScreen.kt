package com.zhejiangjinmo.lingjing.ui.auth

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.zhejiangjinmo.lingjing.data.api.LingJingApi
import com.zhejiangjinmo.lingjing.data.local.AuthDataStore
import com.zhejiangjinmo.lingjing.ui.navigation.Routes
import com.zhejiangjinmo.lingjing.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun SmsLoginScreen(navController: NavController) {
    var phone by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var sendingCode by remember { mutableStateOf(false) }
    var countdown by remember { mutableIntStateOf(0) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    // 倒计时
    LaunchedEffect(countdown) {
        if (countdown > 0) {
            delay(1000)
            countdown--
        }
    }

    fun sendCode() {
        if (phone.isBlank()) { error = "请输入手机号"; return }
        sendingCode = true; error = ""
        scope.launch {
            try {
                LingJingApi().sendSmsCode(phone.trim())
                countdown = 60
            } catch (e: Exception) { error = "发送失败，请重试" }
            sendingCode = false
        }
    }

    fun doLogin() {
        if (code.isBlank()) { error = "请输入验证码"; return }
        loading = true; error = ""
        scope.launch {
            try {
                val api = LingJingApi()
                val res = api.smsLogin(phone.trim(), code.trim())
                if (res.ok && res.token != null) {
                    api.setToken(res.token)
                    val dataStore = AuthDataStore(navController.context.applicationContext)
                    dataStore.saveToken(res.token)
                    res.user?.let { dataStore.saveUser(it) }
                    api.connectWs()
                    navController.navigate(Routes.HOME) {
                        popUpTo(Routes.SPLASH) { inclusive = true }
                    }
                } else error = res.error ?: "验证码错误"
            } catch (e: Exception) { error = "网络错误，请重试" }
            loading = false
        }
    }

    Scaffold(containerColor = DarkBg) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding)
                .verticalScroll(rememberScrollState()).padding(24.dp)
        ) {
            IconButton(onClick = { navController.popBackStack() }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回", tint = DarkText)
            }
            Spacer(modifier = Modifier.height(16.dp))
            Text("手机号登录", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = DarkText)
            Text("输入手机号获取验证码", fontSize = 16.sp, color = DarkTextSecondary)
            Spacer(modifier = Modifier.height(32.dp))

            // 手机号
            OutlinedTextField(
                value = phone,
                onValueChange = { if (it.length <= 11) { phone = it.filter { c -> c.isDigit() }; error = "" } },
                label = { Text("手机号") },
                placeholder = { Text("请输入手机号") },
                leadingIcon = { Icon(Icons.Filled.Phone, null, tint = DarkTextTertiary) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone, imeAction = ImeAction.Next),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = DarkText,
                    unfocusedTextColor = DarkText,
                    focusedBorderColor = DarkBorder,
                    unfocusedBorderColor = DarkBorder,
                    cursorColor = PrimaryBlue
                )
            )
            Spacer(modifier = Modifier.height(16.dp))

            // 验证码
            Row(modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(
                    value = code,
                    onValueChange = { if (it.length <= 6) { code = it.filter { c -> c.isDigit() }; error = "" } },
                    label = { Text("验证码") },
                    placeholder = { Text("6位验证码") },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = DarkText,
                        unfocusedTextColor = DarkText,
                        focusedBorderColor = DarkBorder,
                        unfocusedBorderColor = DarkBorder,
                        cursorColor = PrimaryBlue
                    )
                )
                Spacer(modifier = Modifier.width(12.dp))
                OutlinedButton(
                    onClick = { sendCode() },
                    enabled = countdown == 0 && !sendingCode,
                    modifier = Modifier.height(56.dp)
                ) {
                    Text(
                        if (countdown > 0) "${countdown}s" else "获取验证码",
                        color = if (countdown > 0) DarkTextSecondary else PrimaryBlue
                    )
                }
            }

            if (error.isNotBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(error, color = DangerRed, fontSize = 14.sp)
            }

            Spacer(modifier = Modifier.height(24.dp))
            Button(
                onClick = { doLogin() },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                enabled = !loading && code.length == 6,
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                shape = MaterialTheme.shapes.medium
            ) {
                if (loading) CircularProgressIndicator(modifier = Modifier.size(24.dp), color = DarkText)
                else Text("确认登录", fontSize = 16.sp, fontWeight = FontWeight.Medium)
            }
        }
    }
}
