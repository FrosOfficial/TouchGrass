import { Tabs } from 'expo-router';
import { Shield, Clock, Grid, Settings } from 'lucide-react-native';
import { View, StyleSheet } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#00C7FC', // Cyber Blue by default
        tabBarInactiveTintColor: '#5A5A5A',
        tabBarStyle: {
          backgroundColor: '#0F0F0F',
          borderTopWidth: 1,
          borderTopColor: '#1E1E1E',
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'System',
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'SHIELD',
          tabBarIcon: ({ color, size }) => <Shield color={color} size={size} strokeWidth={2.5} />,
        }}
      />
      <Tabs.Screen
        name="schedules"
        options={{
          title: 'TIMER',
          tabBarIcon: ({ color, size }) => <Clock color={color} size={size} strokeWidth={2.5} />,
        }}
      />
      <Tabs.Screen
        name="apps"
        options={{
          title: 'APPS',
          tabBarIcon: ({ color, size }) => <Grid color={color} size={size} strokeWidth={2.5} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'CONSOLE',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} strokeWidth={2.5} />,
        }}
      />
    </Tabs>
  );
}
