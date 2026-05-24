import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { initDatabase } from '../db/database';

export default function RootLayout() {
  useEffect(() => {
    // Initialize SQLite Tables and default settings on startup
    initDatabase();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0D0D0D' },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen 
          name="lockscreen" 
          options={{ 
            headerShown: false, 
            presentation: 'transparentModal',
            animation: 'slide_from_bottom'
          }} 
        />
      </Stack>
    </>
  );
}
