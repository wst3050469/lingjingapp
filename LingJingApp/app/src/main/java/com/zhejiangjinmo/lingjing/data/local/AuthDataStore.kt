package com.zhejiangjinmo.lingjing.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import com.zhejiangjinmo.lingjing.data.model.StoredNotification
import com.zhejiangjinmo.lingjing.data.model.UserInfo
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

private val Context.authDataStore: DataStore<Preferences> by preferencesDataStore(name = "lingjing_auth")

@Singleton
class AuthDataStore @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val json = Json { ignoreUnknownKeys = true }

    companion object {
        private val KEY_TOKEN = stringPreferencesKey("token")
        private val KEY_USER = stringPreferencesKey("user")
        private val KEY_THEME = stringPreferencesKey("theme_mode")
        private val KEY_NOTIFICATION_SYSTEM = booleanPreferencesKey("notification_system")
        private val KEY_NOTIFICATION_TASKS = booleanPreferencesKey("notification_tasks")
        private val KEY_NOTIFICATION_APPROVAL = booleanPreferencesKey("notification_approval")
        private val KEY_NOTIFICATIONS = stringPreferencesKey("notifications_list")
    }

    // Token
    val tokenFlow: Flow<String?> = context.authDataStore.data.map { it[KEY_TOKEN] }
    suspend fun saveToken(token: String) {
        context.authDataStore.edit { it[KEY_TOKEN] = token }
    }

    // User
    val userFlow: Flow<UserInfo?> = context.authDataStore.data.map { prefs ->
        prefs[KEY_USER]?.let { try { json.decodeFromString(it) } catch (_: Exception) { null } }
    }
    suspend fun saveUser(user: UserInfo) {
        context.authDataStore.edit { it[KEY_USER] = json.encodeToString(user) }
    }

    // Theme
    val themeFlow: Flow<String> = context.authDataStore.data.map { it[KEY_THEME] ?: "system" }
    suspend fun saveTheme(mode: String) {
        context.authDataStore.edit { it[KEY_THEME] = mode }
    }

    // Notification settings
    val notificationSystemFlow: Flow<Boolean> = context.authDataStore.data.map { it[KEY_NOTIFICATION_SYSTEM] ?: true }
    val notificationTasksFlow: Flow<Boolean> = context.authDataStore.data.map { it[KEY_NOTIFICATION_TASKS] ?: true }
    val notificationApprovalFlow: Flow<Boolean> = context.authDataStore.data.map { it[KEY_NOTIFICATION_APPROVAL] ?: true }

    suspend fun saveNotificationSetting(key: String, value: Boolean) {
        val prefKey = when (key) {
            "system" -> KEY_NOTIFICATION_SYSTEM
            "tasks" -> KEY_NOTIFICATION_TASKS
            "approval" -> KEY_NOTIFICATION_APPROVAL
            else -> return
        }
        context.authDataStore.edit { it[prefKey] = value }
    }

    suspend fun clear() {
        context.authDataStore.edit { it.clear() }
    }

    // Notification items
    suspend fun saveNotifications(list: List<StoredNotification>) {
        context.authDataStore.edit { it[KEY_NOTIFICATIONS] = json.encodeToString(list) }
    }

    suspend fun getNotifications(): List<StoredNotification> {
        return try {
            val raw = context.authDataStore.data.first()[KEY_NOTIFICATIONS]
            raw?.let { json.decodeFromString(it) } ?: emptyList()
        } catch (_: Exception) { emptyList() }
    }

    // Plugin states
    suspend fun savePluginStates(states: Map<String, Boolean>) {
        context.authDataStore.edit { it[stringPreferencesKey("plugin_states")] = json.encodeToString(states) }
    }

    suspend fun getPluginStates(): Map<String, Boolean> {
        return try {
            val raw = context.authDataStore.data.first()[stringPreferencesKey("plugin_states")]
            raw?.let { json.decodeFromString(it) } ?: emptyMap()
        } catch (_: Exception) { emptyMap() }
    }

    // Paired desktop
    suspend fun savePairedDesktop(paired: Boolean) {
        context.authDataStore.edit { it[booleanPreferencesKey("paired_desktop")] = paired }
    }
}
