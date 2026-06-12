// 认证导航栈
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SmsLoginScreen from '../screens/auth/SmsLoginScreen';
import EnterpriseLoginScreen from '../screens/auth/EnterpriseLoginScreen';

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  SmsLogin: undefined;
  EnterpriseLogin: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

interface Props {
  onLoginSuccess: () => void;
}

export default function AuthNavigator({ onLoginSuccess }: Props) {
  return (
    <Stack.Navigator screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: '#0d1117' },
      animation: 'slide_from_right',
    }}>
      <Stack.Screen name="Welcome">
        {(props) => <WelcomeScreen {...props} onLoginSuccess={onLoginSuccess} />}
      </Stack.Screen>
      <Stack.Screen name="Login">
        {(props) => <LoginScreen {...props} onLoginSuccess={onLoginSuccess} />}
      </Stack.Screen>
      <Stack.Screen name="SmsLogin">
        {(props) => <SmsLoginScreen {...props} onLoginSuccess={onLoginSuccess} />}
      </Stack.Screen>
      <Stack.Screen name="EnterpriseLogin" component={EnterpriseLoginScreen} />
    </Stack.Navigator>
  );
}
