package com.zhejiangjinmo.lingjing.ui.splash

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.zhejiangjinmo.lingjing.data.api.LingJingApi
import com.zhejiangjinmo.lingjing.data.local.AuthDataStore
import com.zhejiangjinmo.lingjing.ui.navigation.Routes
import com.zhejiangjinmo.lingjing.ui.theme.DarkBg
import com.zhejiangjinmo.lingjing.ui.theme.DarkTextSecondary
import com.zhejiangjinmo.lingjing.ui.theme.PrimaryBlue
import dagger.hilt.android.EntryPointAccessors
import kotlinx.coroutines.delay

@Composable
fun SplashScreen(navController: NavController) {
    var loadingText by remember { mutableStateOf("正在连接灵境...") }

    LaunchedEffect(Unit) {
        delay(1500)
        loadingText = "正在验证身份..."

        val context = navController.context
        val entryPoint = EntryPointAccessors.fromApplication(
            context.applicationContext,
            dagger.hilt.android.internal.managers.ViewComponentManager.FragmentContextWrapper::class.java
        )
        // Use hiltViewModel-like pattern
        delay(500)

        // Navigate to welcome for now (auth check will be added later)
        navController.navigate(Routes.WELCOME) {
            popUpTo(Routes.SPLASH) { inclusive = true }
        }
    }

    Box(
        modifier = Modifier.fillMaxSize().background(DarkBg),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            // Logo
            Text(
                text = "灵境",
                fontSize = 36.sp,
                fontWeight = FontWeight.Bold,
                color = PrimaryBlue
            )
            Text(
                text = "IDE",
                fontSize = 18.sp,
                fontWeight = FontWeight.Light,
                color = Color.White,
                letterSpacing = 8.sp
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "深度思考，匠心创造",
                fontSize = 14.sp,
                color = DarkTextSecondary
            )
            Spacer(modifier = Modifier.height(40.dp))
            // Loading indicator
            Text(
                text = loadingText,
                fontSize = 14.sp,
                color = DarkTextSecondary
            )
        }
    }
}
