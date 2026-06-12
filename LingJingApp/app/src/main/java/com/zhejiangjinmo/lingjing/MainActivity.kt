package com.zhejiangjinmo.lingjing

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.compose.rememberNavController
import com.zhejiangjinmo.lingjing.ui.navigation.LingJingNavGraph
import com.zhejiangjinmo.lingjing.ui.navigation.Routes
import com.zhejiangjinmo.lingjing.ui.theme.LingJingTheme
import com.zhejiangjinmo.lingjing.ui.splash.SplashScreen
import com.zhejiangjinmo.lingjing.ui.auth.*
import com.zhejiangjinmo.lingjing.ui.home.HomeScreen
import com.zhejiangjinmo.lingjing.ui.environment.EnvironmentScreen
import com.zhejiangjinmo.lingjing.ui.workspace.WorkspaceScreen
import com.zhejiangjinmo.lingjing.ui.tasks.TasksScreen
import com.zhejiangjinmo.lingjing.ui.approval.ApprovalScreen
import com.zhejiangjinmo.lingjing.ui.planreview.PlanReviewScreen
import com.zhejiangjinmo.lingjing.ui.qa.QAScreen
import com.zhejiangjinmo.lingjing.ui.editor.CodeEditorScreen
import com.zhejiangjinmo.lingjing.ui.filetree.FileTreeScreen
import com.zhejiangjinmo.lingjing.ui.terminal.TerminalScreen
import com.zhejiangjinmo.lingjing.ui.projects.ProjectsScreen
import com.zhejiangjinmo.lingjing.ui.plugins.PluginsScreen
import com.zhejiangjinmo.lingjing.ui.pairing.PairingScreen
import com.zhejiangjinmo.lingjing.ui.settings.SettingsScreen
import com.zhejiangjinmo.lingjing.ui.usage.UsageScreen
import com.zhejiangjinmo.lingjing.ui.notification.NotificationScreen
import com.zhejiangjinmo.lingjing.ui.update.UpdateScreen
import com.zhejiangjinmo.lingjing.ui.theme.DarkBg
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            LingJingTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = DarkBg) {
                    val navController = rememberNavController()

                    LingJingNavGraph(
                        navController = navController,
                        splashScreen = { SplashScreen(navController) },
                        welcomeScreen = { WelcomeScreen(navController) },
                        loginScreen = { LoginScreen(navController) },
                        smsLoginScreen = { SmsLoginScreen(navController) },
                        enterpriseLoginScreen = { EnterpriseLoginScreen(navController) },
                        homeScreen = { HomeScreen(navController) },
                        environmentScreen = { EnvironmentScreen(navController) },
                        workspaceScreen = { sessionId -> WorkspaceScreen(navController, sessionId) },
                        tasksScreen = { TasksScreen(navController) },
                        approvalScreen = { sid, aid -> ApprovalScreen(navController, sid, aid) },
                        planReviewScreen = { sid -> PlanReviewScreen(navController, sid) },
                        qaScreen = { sid, qid -> QAScreen(navController, sid, qid) },
                        codeEditorScreen = { path -> CodeEditorScreen(navController, path) },
                        fileTreeScreen = { FileTreeScreen(navController) },
                        terminalScreen = { sid -> TerminalScreen(navController, sid) },
                        projectsScreen = { ProjectsScreen(navController) },
                        pluginsScreen = { PluginsScreen(navController) },
                        pairingScreen = { PairingScreen(navController) },
                        settingsScreen = { SettingsScreen(navController) },
                        usageScreen = { UsageScreen(navController) },
                        notificationsScreen = { NotificationScreen(navController) },
                        updateScreen = { UpdateScreen(navController) }
                    )
                }
            }
        }
    }
}
