// 主界面底部Tab导航
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import NewTaskScreen from '../screens/env/NewTaskScreen';
import WorkspaceScreen from '../screens/workspace/WorkspaceScreen';
import TasksScreen from '../screens/tasks/TasksScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function MainNavigator() {
  const isDark = useColorScheme() !== 'light';
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false,
      tabBarIcon: ({ color, size }) => {
        const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
          NewTask: 'add-circle',
          Workspace: 'chatbubbles',
          Tasks: 'layers',
          Settings: 'settings-sharp',
        };
        return <Ionicons name={icons[route.name] || 'apps'} size={size} color={color} />;
      },
      tabBarActiveTintColor: isDark ? '#58a6ff' : '#0969da',
      tabBarInactiveTintColor: isDark ? '#8b949e' : '#656d76',
      tabBarStyle: {
        backgroundColor: isDark ? '#161b22' : '#f6f8fa',
        borderTopColor: isDark ? '#30363d' : '#d0d7de',
        borderTopWidth: 1,
        paddingBottom: 4,
        height: 56,
      },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
    })}>
      <Tab.Screen name="NewTask" component={NewTaskScreen} options={{ title: '新任务' }} />
      <Tab.Screen name="Workspace" component={WorkspaceScreen} options={{ title: '工作区' }} />
      <Tab.Screen name="Tasks" component={TasksScreen} options={{ title: '任务' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: '设置' }} />
    </Tab.Navigator>
  );
}
