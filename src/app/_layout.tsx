import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { initDatabase, getSetting } from '../db/database';
import { preloadInstalledApps } from './(tabs)/apps';

export default function RootLayout() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Initialize SQLite Tables and default settings on startup
    initDatabase();
    // Pre-cache installed apps in background to eliminate first-click lag
    preloadInstalledApps();

    // Check if user has completed onboarding
    const onboardingDone = getSetting('onboarding_complete');
    if (onboardingDone !== 'true') {
      // Use setTimeout to ensure the navigation stack is mounted before redirecting
      setTimeout(() => {
        router.replace('/onboarding' as any);
      }, 100);
    }

    setReady(true);
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
        <Stack.Screen
          name="onboarding"
          options={{
            headerShown: false,
            animation: 'fade',
          }}
        />
      </Stack>
    </>
  );
}

