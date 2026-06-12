package com.zhejiangjinmo.lingjing.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument

// ── 路由定义 ──
object Routes {
    const val SPLASH = "splash"
    const val WELCOME = "welcome"
    const val LOGIN = "login"
    const val SMS_LOGIN = "sms_login"
    const val ENTERPRISE_LOGIN = "enterprise_login"
    const val HOME = "home"
    const val ENVIRONMENT = "environment"
    const val WORKSPACE = "workspace/{sessionId}"
    const val TASKS = "tasks"
    const val APPROVAL = "approval/{sessionId}/{actionId}"
    const val PLAN_REVIEW = "plan_review/{sessionId}"
    const val QA = "qa/{sessionId}/{questionId}"
    const val CODE_EDITOR = "editor/{filePath}"
    const val FILE_TREE = "file_tree"
    const val TERMINAL = "terminal/{sessionId}"
    const val PROJECTS = "projects"
    const val PLUGINS = "plugins"
    const val PAIRING = "pairing"
    const val SETTINGS = "settings"
    const val USAGE = "usage"
    const val NOTIFICATIONS = "notifications"
    const val UPDATE = "update"

    fun workspace(sessionId: String) = "workspace/$sessionId"
    fun approval(sessionId: String, actionId: String) = "approval/$sessionId/$actionId"
    fun planReview(sessionId: String) = "plan_review/$sessionId"
    fun qa(sessionId: String, questionId: String) = "qa/$sessionId/$questionId"
    fun editor(filePath: String) = "editor/$filePath"
    fun terminal(sessionId: String) = "terminal/$sessionId"
}

@Composable
fun LingJingNavGraph(
    navController: NavHostController,
    startDestination: String = Routes.SPLASH,
    // ── 各Screen的composable函数 ──
    splashScreen: @Composable () -> Unit,
    welcomeScreen: @Composable () -> Unit,
    loginScreen: @Composable () -> Unit,
    smsLoginScreen: @Composable () -> Unit,
    enterpriseLoginScreen: @Composable () -> Unit,
    homeScreen: @Composable () -> Unit,
    environmentScreen: @Composable () -> Unit,
    workspaceScreen: @Composable (String) -> Unit,
    tasksScreen: @Composable () -> Unit,
    approvalScreen: @Composable (String, String) -> Unit,
    planReviewScreen: @Composable (String) -> Unit,
    qaScreen: @Composable (String, String) -> Unit,
    codeEditorScreen: @Composable (String) -> Unit,
    fileTreeScreen: @Composable () -> Unit,
    terminalScreen: @Composable (String) -> Unit,
    projectsScreen: @Composable () -> Unit,
    pluginsScreen: @Composable () -> Unit,
    pairingScreen: @Composable () -> Unit,
    settingsScreen: @Composable () -> Unit,
    usageScreen: @Composable () -> Unit,
    notificationsScreen: @Composable () -> Unit,
    updateScreen: @Composable () -> Unit,
) {
    NavHost(navController = navController, startDestination = startDestination) {

        // ── 认证流 ──
        composable(Routes.SPLASH) { splashScreen() }
        composable(Routes.WELCOME) { welcomeScreen() }
        composable(Routes.LOGIN) { loginScreen() }
        composable(Routes.SMS_LOGIN) { smsLoginScreen() }
        composable(Routes.ENTERPRISE_LOGIN) { enterpriseLoginScreen() }

        // ── 主页面 ──
        composable(Routes.HOME) { homeScreen() }
        composable(Routes.ENVIRONMENT) { environmentScreen() }
        composable(Routes.TASKS) { tasksScreen() }

        // ── 工作区 ──
        composable(
            route = Routes.WORKSPACE,
            arguments = listOf(navArgument("sessionId") { type = NavType.StringType })
        ) { backStackEntry ->
            val sessionId = backStackEntry.arguments?.getString("sessionId") ?: ""
            workspaceScreen(sessionId)
        }

        // ── 审批 / 计划审查 / 问答 ──
        composable(
            route = Routes.APPROVAL,
            arguments = listOf(
                navArgument("sessionId") { type = NavType.StringType },
                navArgument("actionId") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            approvalScreen(
                backStackEntry.arguments?.getString("sessionId") ?: "",
                backStackEntry.arguments?.getString("actionId") ?: ""
            )
        }

        composable(
            route = Routes.PLAN_REVIEW,
            arguments = listOf(navArgument("sessionId") { type = NavType.StringType })
        ) { bs -> planReviewScreen(bs.arguments?.getString("sessionId") ?: "") }

        composable(
            route = Routes.QA,
            arguments = listOf(
                navArgument("sessionId") { type = NavType.StringType },
                navArgument("questionId") { type = NavType.StringType }
            )
        ) { bs -> qaScreen(bs.arguments?.getString("sessionId") ?: "", bs.arguments?.getString("questionId") ?: "") }

        // ── 灵境IDE 特有 ──
        composable(
            route = Routes.CODE_EDITOR,
            arguments = listOf(navArgument("filePath") { type = NavType.StringType })
        ) { bs -> codeEditorScreen(bs.arguments?.getString("filePath") ?: "") }

        composable(Routes.FILE_TREE) { fileTreeScreen() }
        composable(
            route = Routes.TERMINAL,
            arguments = listOf(navArgument("sessionId") { type = NavType.StringType })
        ) { bs -> terminalScreen(bs.arguments?.getString("sessionId") ?: "") }

        composable(Routes.PROJECTS) { projectsScreen() }
        composable(Routes.PLUGINS) { pluginsScreen() }
        composable(Routes.PAIRING) { pairingScreen() }

        // ── 设置 ──
        composable(Routes.SETTINGS) { settingsScreen() }
        composable(Routes.USAGE) { usageScreen() }
        composable(Routes.NOTIFICATIONS) { notificationsScreen() }
        composable(Routes.UPDATE) { updateScreen() }
    }
}
