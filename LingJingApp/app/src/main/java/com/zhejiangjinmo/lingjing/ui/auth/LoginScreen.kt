package com.zhejiangjinmo.lingjing.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.zhejiangjinmo.lingjing.data.api.LingJingApi
import com.zhejiangjinmo.lingjing.data.local.AuthDataStore
import com.zhejiangjinmo.lingjing.ui.navigation.Routes
import com.zhejiangjinmo.lingjing.ui.theme.*
import dagger.hilt.android.EntryPointAccessors
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(navController: NavController) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    fun doLogin() {
        if (username.isBlank()) { error = "请输入账号"; return }
        if (password.isBlank()) { error = "请输入密码"; return }
        loading = true; error = ""
        scope.launch {
            try {
                val api = LingJingApi()
                val res = api.login(username.trim(), password)
                if (res.ok && res.token != null) {
                    api.setToken(res.token)
                    // Save token
                    val context = navController.context
                    val dataStore = AuthDataStore(context.applicationContext)
                    dataStore.saveToken(res.token)
                    res.user?.let { dataStore.saveUser(it) }
                    api.connectWs()
                    navController.navigate(Routes.HOME) {
                        popUpTo(Routes.SPLASH) { inclusive = true }
                    }
                } else error = res.error ?: "账号或密码错误"
            } catch (e: Exception) { error = "网络错误，请重试" }
            loading = false
        }
    }

    Scaffold(
        containerColor = DarkBg
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(24.dp)
        ) {
            // 返回按钮
            IconButton(onClick = { navController.popBackStack() }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "返回", tint = DarkText)
            }
            Spacer(modifier = Modifier.height(16.dp))

            Text("账号登录", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = DarkText)
            Text("输入你的灵境账号和密码", fontSize = 16.sp, color = DarkTextSecondary)
            Spacer(modifier = Modifier.height(32.dp))

            // 账号
            OutlinedTextField(
                value = username,
                onValueChange = { username = it; error = "" },
                label = { Text("账号") },
                placeholder = { Text("邮箱/手机号/用户名") },
                leadingIcon = { Icon(Icons.Filled.Person, null, tint = DarkTextTertiary) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                colors = outlinedFieldColors()
            )
            Spacer(modifier = Modifier.height(16.dp))

            // 密码
            OutlinedTextField(
                value = password,
                onValueChange = { password = it; error = "" },
                label = { Text("密码") },
                placeholder = { Text("输入密码") },
                leadingIcon = { Icon(Icons.Filled.Lock, null, tint = DarkTextTertiary) },
                trailingIcon = {
                    IconButton(onClick = { showPassword = !showPassword }) {
                        Icon(
                            if (showPassword) Icons.Filled.Visibility else Icons.Filled.VisibilityOff,
                            contentDescription = null,
                            tint = DarkTextTertiary
                        )
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                colors = outlinedFieldColors()
            )

            if (error.isNotBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(error, color = DangerRed, fontSize = 14.sp)
            }

            Spacer(modifier = Modifier.height(24.dp))
            Button(
                onClick = { doLogin() },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                enabled = !loading,
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                shape = MaterialTheme.shapes.medium
            ) {
                if (loading) CircularProgressIndicator(modifier = Modifier.size(24.dp), color = DarkText)
                else Text("登录", fontSize = 16.sp, fontWeight = FontWeight.Medium)
            }

            Spacer(modifier = Modifier.height(12.dp))
            Text(
                "忘记密码？",
                color = PrimaryBlue,
                fontSize = 14.sp,
                modifier = Modifier.align(Alignment.End).clickable { }
            )

            // 分隔线
            Spacer(modifier = Modifier.height(32.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                HorizontalDivider(modifier = Modifier.weight(1f), color = DarkBorder)
                Text(" 或 ", color = DarkTextTertiary, fontSize = 14.sp)
                HorizontalDivider(modifier = Modifier.weight(1f), color = DarkBorder)
            }
            Spacer(modifier = Modifier.height(24.dp))

            // 其他登录方式
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                TextButton(onClick = { navController.navigate(Routes.SMS_LOGIN) }) {
                    Text("手机号登录", color = PrimaryBlue, fontSize = 16.sp)
                }
                TextButton(onClick = { navController.navigate(Routes.ENTERPRISE_LOGIN) }) {
                    Text("企业登录", color = Purple, fontSize = 16.sp)
                }
            }
        }
    }

    // 键盘提交
    LaunchedEffect(Unit) {}
}

@Composable
private fun outlinedFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = DarkText,
    unfocusedTextColor = DarkText,
    focusedBorderColor = PrimaryBlue,
    unfocusedBorderColor = DarkBorder,
    focusedLabelColor = PrimaryBlue,
    unfocusedLabelColor = DarkTextSecondary,
    cursorColor = PrimaryBlue
)
