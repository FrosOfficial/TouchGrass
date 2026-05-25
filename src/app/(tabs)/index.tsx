import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Shield, ShieldAlert, Skull, Play, Square, AlertTriangle, RefreshCw } from 'lucide-react-native';
import * as TouchGrass from 'touch-grass';
import * as DB from '../../db/database';

function isCurrentTimeInWindowJS(start: string, end: string): boolean {
  try {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    
    const now = new Date();
    const nowH = now.getHours();
    const nowM = now.getMinutes();
    
    const startTimeMinutes = startH * 60 + startM;
    const endTimeMinutes = endH * 60 + endM;
    const nowTimeMinutes = nowH * 60 + nowM;
    
    if (endTimeMinutes > startTimeMinutes) {
      return nowTimeMinutes >= startTimeMinutes && nowTimeMinutes <= endTimeMinutes;
    } else {
      return nowTimeMinutes >= startTimeMinutes || nowTimeMinutes <= endTimeMinutes;
    }
  } catch (e) {
    return false;
  }
}

export default function DashboardScreen() {
  const router = useRouter();
  const [isLocked, setIsLocked] = useState(false);
  const [lockUntil, setLockUntil] = useState(0);
  const [blockedCount, setBlockedCount] = useState(0);
  const [isCheckingLock, setIsCheckingLock] = useState(true);
  
  // Permissions
  const [accessibilityEnabled, setAccessibilityEnabled] = useState(false);
  const [overlayGranted, setOverlayGranted] = useState(false);
  
  // AI State
  const [aiMood, setAiMood] = useState('neutral');
  const [consequenceLevel, setConsequenceLevel] = useState(0);
  const [latestRoast, setLatestRoast] = useState('');

  const loadData = useCallback(() => {
    try {
      // 1. Sync permissions
      if (Platform.OS === 'android') {
        const isAccessEnabled = TouchGrass.isAccessibilityServiceEnabled();
        const isOverGranted = TouchGrass.isOverlayPermissionGranted();
        setAccessibilityEnabled(isAccessEnabled);
        setOverlayGranted(isOverGranted);
      } else {
        setAccessibilityEnabled(true);
        setOverlayGranted(true);
      }

      // 2. Load settings and database values
      const currentMood = DB.getSetting('ai_mood') || 'neutral';
      const conLevelStr = DB.getSetting('consequence_level') || '0';
      setAiMood(currentMood);
      setConsequenceLevel(parseInt(conLevelStr, 10));

      // 3. Load latest AI message
      const history = DB.getChatHistory();
      const aiMessages = history.filter(m => m.role === 'ai');
      if (aiMessages.length > 0) {
        setLatestRoast(aiMessages[aiMessages.length - 1].message);
      } else {
        setLatestRoast("Oh look, you haven't locked your phone yet. Ready to fail your productivity goals today?");
      }

      // 4. Synchronize database schedules to native SharedPreferences and get current state
      if (Platform.OS === 'android') {
        const schedules = DB.getSchedules();
        const activePackages = schedules.filter(s => s.is_enabled).map(s => s.app_package).join(',');
        
        const state = TouchGrass.getLockState();
        
        let targetLocked = state.isLocked;
        let targetUntil = state.lockUntil;

        // Always make sure latest active packages are synced to SharedPreferences
        TouchGrass.updateLockState(state.isLocked, state.lockUntil, activePackages);

        // Check if the Global Lockdown window is active in JS to show correctly in the UI
        let isGlobalLocked = false;
        const globalEnabled = DB.getSetting('global_lock_enabled') === 'true';
        if (globalEnabled) {
          const start = DB.getSetting('global_lock_start') || '09:00';
          const end = DB.getSetting('global_lock_end') || '17:00';
          isGlobalLocked = isCurrentTimeInWindowJS(start, end);
        }

        const isShieldActive = targetLocked || isGlobalLocked;
        setIsLocked(isShieldActive);
        setLockUntil(targetLocked ? targetUntil : 0);
        
        // Count blocked packages
        const blockedArr = activePackages.split(',').map(s => s.trim()).filter(Boolean);
        setBlockedCount(blockedArr.length);
      } else {
        // Mock for other platforms
        setBlockedCount(0);
      }
    } catch (e) {
      console.error("Error loading dashboard data:", e);
    }
  }, []);

  // Instant bypass check on boot / focus
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'android') {
        const activeBlocked = TouchGrass.getActiveBlockedPackage();
        if (activeBlocked) {
          setIsCheckingLock(true);
          router.replace('/lockscreen');
          return;
        }
      }
      setIsCheckingLock(false);
      loadData();
    }, [loadData])
  );

  const toggleShield = () => {
    if (!accessibilityEnabled || !overlayGranted) {
      // Direct user to Console tab to grant permissions
      router.push('/settings');
      return;
    }

    if (isLocked) {
      // Attempting to stop the shield triggers the sarcastic negotiation!
      // In a regular lock app, users can just toggle it off. Here, trying to turn it off brings you to the Negotiation Room!
      router.push('/lockscreen');
    } else {
      // Start the shield!
      // Fetch all schedules packages or just add all listed packages
      const schedules = DB.getSchedules();
      const activePackages = schedules.filter(s => s.is_enabled).map(s => s.app_package);
      
      if (activePackages.length === 0) {
        // Force navigate to App list if no apps are selected yet
        router.push('/apps');
        return;
      }

      // Lock for 8 hours by default
      const eightHoursMs = 8 * 60 * 60 * 1000;
      const targetTime = Date.now() + eightHoursMs;
      
      const packageString = activePackages.join(',');
      if (Platform.OS === 'android') {
        TouchGrass.updateLockState(true, targetTime, packageString);
      }
      setIsLocked(true);
      setLockUntil(targetTime);
      setBlockedCount(activePackages.length);

      // AI mocks you for beginning your lockdown
      DB.addChatMessage('ai', "Lockdown active. 8 hours of sensory deprivation from your toxic digital pacifiers. Don't even think about disabling this.", 'sarcastic');
      loadData();
    }
  };

  // Format AI avatar and text depending on mood
  const getAiAvatar = () => {
    switch (aiMood) {
      case 'annoyed':
        return { emoji: '🙄', color: '#FF9500', name: 'ANNOPTRON' };
      case 'angry':
        return { emoji: '💀', color: '#FF3B30', name: 'TERMINATOR_6000' };
      case 'sarcastic':
        return { emoji: '😈', color: '#00C7FC', name: 'ROAST_MASTER' };
      default:
        return { emoji: '🤖', color: '#34C759', name: 'TOUCH_GRASS_v1' };
    }
  };

  const ai = getAiAvatar();

  return (
    <SafeAreaView style={styles.container}>
      {isCheckingLock ? (
        <View style={{ flex: 1, backgroundColor: '#0D0D0D' }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>TOUCHGRASS</Text>
            <TouchableOpacity onPress={loadData} style={styles.refreshButton}>
              <RefreshCw color="#FFFFFF" size={16} />
            </TouchableOpacity>
          </View>

          {/* Permission Alerts */}
          {(!accessibilityEnabled || !overlayGranted) && (
            <TouchableOpacity 
              style={styles.permissionAlert} 
              onPress={() => router.push('/settings')}
            >
              <AlertTriangle color="#FF3B30" size={20} />
              <View style={styles.permissionTextContainer}>
                <Text style={styles.permissionAlertTitle}>SYSTEM BYPASSED</Text>
                <Text style={styles.permissionAlertDesc}>Native services offline. Tap here to configure permissions.</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* AI Character Console */}
          <View style={[styles.aiConsole, { borderColor: ai.color }]}>
            <View style={styles.aiHeader}>
              <Text style={[styles.aiEmoji, { color: ai.color }]}>{ai.emoji}</Text>
              <View>
                <Text style={styles.aiName}>{ai.name}</Text>
                <Text style={styles.aiStatusLabel}>CURRENT MOOD: {aiMood.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.aiRoastText}>"{latestRoast}"</Text>
          </View>

          {/* Lock Shield Dial */}
          <View style={styles.dialContainer}>
            <View style={[
              styles.outerDial, 
              { borderColor: isLocked ? '#FF3B30' : '#00C7FC' }
            ]}>
              <View style={styles.innerDial}>
                {isLocked ? (
                  <ShieldAlert color="#FF3B30" size={64} />
                ) : (
                  <Shield color="#00C7FC" size={64} />
                )}
                <Text style={[styles.dialStatus, { color: isLocked ? '#FF3B30' : '#00C7FC' }]}>
                  {isLocked ? 'SHIELD ON' : 'SHIELD OFF'}
                </Text>
                <Text style={styles.dialDetail}>
                  {isLocked ? `${blockedCount} APPS BLOCKED` : 'READY FOR SHIELD'}
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statVal}>{blockedCount}</Text>
              <Text style={styles.statLabel}>Restricted Apps</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statVal, { color: consequenceLevel > 0 ? '#FF3B30' : '#FFFFFF' }]}>
                {consequenceLevel}
              </Text>
              <Text style={styles.statLabel}>Excuse Strikes</Text>
            </View>
          </View>

          {/* Main Action Button */}
          <TouchableOpacity 
            style={[
              styles.actionButton, 
              { backgroundColor: isLocked ? '#FF3B30' : '#00C7FC' }
            ]} 
            onPress={toggleShield}
          >
            {isLocked ? (
              <>
                <Square color="#FFFFFF" size={20} fill="#FFFFFF" />
                <Text style={styles.actionButtonText}>NEGOTIATE DISABLE</Text>
              </>
            ) : (
              <>
                <Play color="#FFFFFF" size={20} fill="#FFFFFF" />
                <Text style={styles.actionButtonText}>LOCK APPS NOW</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  scrollContainer: {
    padding: 20,
    alignItems: 'center',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
    paddingBottom: 15,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: 'System',
    fontWeight: '900',
    letterSpacing: 2,
  },
  refreshButton: {
    padding: 8,
  },
  permissionAlert: {
    width: '100%',
    backgroundColor: '#1E1E1E',
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  permissionTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  permissionAlertTitle: {
    color: '#FF3B30',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
  },
  permissionAlertDesc: {
    color: '#CCCCCC',
    fontSize: 12,
    marginTop: 2,
  },
  aiConsole: {
    width: '100%',
    backgroundColor: '#151515',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  aiName: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 1.5,
  },
  aiStatusLabel: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  aiRoastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
    fontFamily: 'System',
  },
  dialContainer: {
    marginVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outerDial: {
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111111',
    shadowColor: '#00C7FC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 5,
  },
  innerDial: {
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialStatus: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 12,
  },
  dialDetail: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    marginVertical: 24,
  },
  statCard: {
    backgroundColor: '#151515',
    width: '47%',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  statVal: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
  },
  statLabel: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  actionButton: {
    flexDirection: 'row',
    width: '100%',
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginLeft: 10,
  },
});
