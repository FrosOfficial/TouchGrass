import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Alert,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Skull, Send, ShieldAlert, Sparkles } from 'lucide-react-native';
import * as TouchGrass from 'touch-grass';
import * as DB from '../db/database';
import { negotiateExcuse } from '../services/aiEngine';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

function isCurrentLockActive(): boolean {
  if (Platform.OS !== 'android') return false;
  try {
    const state = TouchGrass.getLockState();
    const now = Date.now();
    const isManualLockActive = state.isLocked && state.lockUntil > now;
    let active = isManualLockActive;
    const globalEnabled = DB.getSetting('global_lock_enabled') === 'true';
    if (!active && globalEnabled) {
      const start = DB.getSetting('global_lock_start') || '09:00';
      const end = DB.getSetting('global_lock_end') || '17:00';
      if (isCurrentTimeInWindowJS(start, end)) active = true;
    }
    const autoTimeEnabled = TouchGrass.isAutoTimeEnabled();
    if (!autoTimeEnabled && (isManualLockActive || globalEnabled)) active = true;
    return active;
  } catch (e) {
    console.error(e);
  }
  return false;
}

/** Format ms remaining as MM:SS or HH:MM:SS */
function formatCountdown(ms: number): { hours: string; minutes: string; seconds: string } {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return {
    hours: h.toString().padStart(2, '0'),
    minutes: m.toString().padStart(2, '0'),
    seconds: s.toString().padStart(2, '0'),
  };
}

export default function LockScreen() {
  const router = useRouter();

  const [blockedApp, setBlockedApp] = useState('');
  const [lockUntil, setLockUntil] = useState(0);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [excuse, setExcuse] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [chatLog, setChatLog] = useState<{ role: 'user' | 'ai'; message: string; mood: string }[]>([]);
  const [aiTypingText, setAiTypingText] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [aiMood, setAiMood] = useState('sarcastic');

  // Penalty pop animation state
  const [penaltyPopText, setPenaltyPopText] = useState('');

  // Animations
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const redFlashAnim = useRef(new Animated.Value(0)).current;
  const bombPulseAnim = useRef(new Animated.Value(1)).current;
  const penaltyPopAnim = useRef(new Animated.Value(0)).current;
  const penaltyPopY = useRef(new Animated.Value(0)).current;
  const bgRedAnim = useRef(new Animated.Value(0)).current;

  const bombPulseRef = useRef<Animated.CompositeAnimation | null>(null);

  const handleGiveUp = () => {
    if (Platform.OS === 'android') {
      TouchGrass.clearActiveBlockedPackage();
      try {
        if (typeof TouchGrass.exitToHomeScreen === 'function') {
          TouchGrass.exitToHomeScreen();
        }
      } catch (e) { /* fallback */ }
    }
    router.replace('/(tabs)');
  };

  useEffect(() => {
    loadActiveBlockedPackage();
    loadChatHistory();

    const backAction = () => { handleGiveUp(); return true; };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    const interval = setInterval(() => {
      if (Platform.OS === 'android') {
        const state = TouchGrass.getLockState();
        setLockUntil(state.lockUntil);
        setCurrentTime(Date.now());
        const active = isCurrentLockActive();
        if (!active) {
          try {
            const currentState = TouchGrass.getLockState();
            TouchGrass.updateLockState(false, 0, currentState.blockedPackages);
          } catch (e) {
            console.error('Failed to reset lock state natively:', e);
          }
          TouchGrass.clearActiveBlockedPackage();
          setTimeout(() => { router.replace('/(tabs)'); }, 0);
        }
      }
    }, 1000);

    return () => {
      backHandler.remove();
      clearInterval(interval);
    };
  }, []);

  // Bomb pulse animation based on remaining time
  useEffect(() => {
    if (bombPulseRef.current) {
      bombPulseRef.current.stop();
    }
    const remaining = lockUntil - currentTime;
    const isNearEnd = remaining > 0 && remaining < 10000;

    if (isNearEnd) {
      // Rapid frantic pulse when < 10s
      bombPulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(bombPulseAnim, { toValue: 1.12, duration: 250, useNativeDriver: true }),
          Animated.timing(bombPulseAnim, { toValue: 0.95, duration: 250, useNativeDriver: true }),
        ])
      );
    } else if (remaining > 0) {
      // Slow menacing pulse
      bombPulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(bombPulseAnim, { toValue: 1.04, duration: 800, useNativeDriver: true }),
          Animated.timing(bombPulseAnim, { toValue: 0.97, duration: 800, useNativeDriver: true }),
        ])
      );
    }
    bombPulseRef.current?.start();
    return () => bombPulseRef.current?.stop();
  }, [lockUntil > 0 && lockUntil - currentTime < 10000]);

  const loadActiveBlockedPackage = () => {
    if (Platform.OS === 'android') {
      const activePackage = TouchGrass.getActiveBlockedPackage();
      if (activePackage) {
        const parts = activePackage.split('.');
        const humanName = parts[parts.length - 1] || activePackage;
        setBlockedApp(humanName.toUpperCase());
      } else {
        setBlockedApp('TIKTOK / SOCIAL');
      }
    } else {
      setBlockedApp('INSTAGRAM');
    }
  };

  const loadChatHistory = () => {
    const history = DB.getChatHistory();
    const formatted = history.map(item => ({
      role: item.role,
      message: item.message,
      mood: item.mood,
    }));
    if (formatted.length === 0) {
      const initialRoast =
        "Oh look, the CEO of Doomscrolling is trying to access social media early again. Didn't you swear you were going to be productive today? Put the phone down.";
      DB.addChatMessage('ai', initialRoast, 'sarcastic');
      setChatLog([{ role: 'ai', message: initialRoast, mood: 'sarcastic' }]);
      simulateAiTyping(initialRoast);
    } else {
      setChatLog(formatted);
      const latestMsg = formatted[formatted.length - 1];
      if (latestMsg && latestMsg.role === 'ai') setAiMood(latestMsg.mood);
    }
  };

  const simulateAiTyping = (text: string) => {
    setIsAiTyping(true);
    setAiTypingText('');
    let index = 0;
    const interval = setInterval(() => {
      setAiTypingText(prev => prev + text.charAt(index));
      index++;
      if (index >= text.length) {
        clearInterval(interval);
        setIsAiTyping(false);
      }
    }, 15);
  };

  const triggerPenaltyAdded = (penaltyMs: number) => {
    const secs = Math.round(penaltyMs / 1000);
    const mins = Math.floor(secs / 60);
    const label = mins > 0 ? `+${mins}m PENALTY ADDED` : `+${secs}s PENALTY ADDED`;
    setPenaltyPopText(label);

    penaltyPopAnim.setValue(0);
    penaltyPopY.setValue(0);

    // Shake animation (harder than before)
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 18, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -18, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 14, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -14, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();

    // Red flash overlay
    Animated.sequence([
      Animated.timing(redFlashAnim, { toValue: 0.7, duration: 80, useNativeDriver: true }),
      Animated.timing(redFlashAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    // Background red tint
    Animated.sequence([
      Animated.timing(bgRedAnim, { toValue: 1, duration: 100, useNativeDriver: false }),
      Animated.timing(bgRedAnim, { toValue: 0, duration: 1200, useNativeDriver: false }),
    ]).start();

    // Floating "+Xs PENALTY ADDED" pop
    Animated.parallel([
      Animated.sequence([
        Animated.timing(penaltyPopAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.delay(800),
        Animated.timing(penaltyPopAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.timing(penaltyPopY, { toValue: -70, duration: 1350, useNativeDriver: true }),
    ]).start(() => setPenaltyPopText(''));
  };

  const submitExcuse = async () => {
    if (!excuse.trim()) return;
    setLoading(true);
    setLoadingStep('TOUCHGRASS IS ASSESSING YOUR LAZY EXCUSE...');
    DB.addChatMessage('user', excuse, 'neutral');
    const nextChatLog = [...chatLog, { role: 'user' as const, message: excuse, mood: 'neutral' }];
    setChatLog(nextChatLog);
    setExcuse('');

    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      const evaluation = await negotiateExcuse(excuse);
      setAiMood(evaluation.mood);

      if (evaluation.approved) {
        if (Platform.OS === 'android') {
          TouchGrass.clearActiveBlockedPackage();
          const currentState = TouchGrass.getLockState();
          TouchGrass.updateLockState(false, 0, currentState.blockedPackages);
        }
        DB.addChatMessage('ai', evaluation.response, evaluation.mood);
        setChatLog(prev => [...prev, { role: 'ai', message: evaluation.response, mood: evaluation.mood }]);
        setLoading(false);
        Alert.alert(
          'NEGOTIATION GRANTED',
          'The AI successfully unlocked your phone... for now.',
          [{ text: 'DISMISS', onPress: () => router.replace('/(tabs)') }]
        );
      } else {
        DB.addChatMessage('ai', evaluation.response, evaluation.mood);
        setChatLog(prev => [...prev, { role: 'ai', message: evaluation.response, mood: evaluation.mood }]);

        let penaltyMs = 5 * 1000; // 5 seconds
        if (Platform.OS === 'android') {
          const currentState = TouchGrass.getLockState();
          const currentUntil = currentState.lockUntil > Date.now() ? currentState.lockUntil : Date.now();
          const newLockUntil = currentUntil + penaltyMs;
          TouchGrass.updateLockState(true, newLockUntil, currentState.blockedPackages);
          setLockUntil(newLockUntil);
        }

        setLoading(false);
        triggerPenaltyAdded(penaltyMs);
        simulateAiTyping(evaluation.response);
      }
    } catch (e) {
      setLoading(false);
      console.error('Excuse negotiation failed:', e);
    }
  };

  const getThemeColor = () => {
    switch (aiMood) {
      case 'angry': return '#FF3B30';
      case 'annoyed': return '#FF9500';
      case 'sarcastic': return '#00C7FC';
      default: return '#34C759';
    }
  };

  const accentColor = getThemeColor();
  const remaining = lockUntil - currentTime;
  const hasCountdown = lockUntil > currentTime;
  const countdown = formatCountdown(remaining);
  const isNearEnd = remaining > 0 && remaining < 10000;

  const bgColor = bgRedAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#070707', '#1A0505'],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View style={[styles.container, { backgroundColor: bgColor }]}>
        {/* Red flash full-screen overlay */}
        <Animated.View
          style={[styles.redFlashOverlay, { opacity: redFlashAnim }]}
          pointerEvents="none"
        />

        {/* Floating penalty pop text */}
        {penaltyPopText !== '' && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.penaltyPop,
              {
                opacity: penaltyPopAnim,
                transform: [{ translateY: penaltyPopY }],
              },
            ]}
          >
            <Text style={styles.penaltyPopText}>{penaltyPopText}</Text>
          </Animated.View>
        )}

        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.shieldWrapper}>
                <ShieldAlert color={accentColor} size={28} />
              </View>
              <View style={styles.headerTextWrapper}>
                <Text style={[styles.headerTitle, { color: accentColor }]}>ACCESS DENIED</Text>
                <Text style={styles.headerSubtitle}>{blockedApp} IS LOCKED DOWN</Text>
              </View>
            </View>

            {/* BOMB TIMER - The dramatic centerpiece */}
            {hasCountdown && (
              <Animated.View
                style={[
                  styles.bombTimerContainer,
                  {
                    borderColor: isNearEnd ? '#FF3B30' : accentColor,
                    shadowColor: isNearEnd ? '#FF3B30' : accentColor,
                    transform: [{ scale: bombPulseAnim }],
                  },
                ]}
              >
                <Text style={styles.bombTimerLabel}>⏱ AI PENALTY EXTENSION</Text>
                <View style={styles.bombDigitsRow}>
                  {countdown.hours !== '00' && (
                    <>
                      <View style={[styles.bombDigitBlock, { borderColor: isNearEnd ? '#FF3B30' : accentColor + '55' }]}>
                        <Text style={[styles.bombDigit, { color: isNearEnd ? '#FF3B30' : accentColor }]}>
                          {countdown.hours}
                        </Text>
                      </View>
                      <Text style={[styles.bombSep, { color: isNearEnd ? '#FF3B30' : accentColor }]}>:</Text>
                    </>
                  )}
                  <View style={[styles.bombDigitBlock, { borderColor: isNearEnd ? '#FF3B30' : accentColor + '55' }]}>
                    <Text style={[styles.bombDigit, { color: isNearEnd ? '#FF3B30' : accentColor }]}>
                      {countdown.minutes}
                    </Text>
                  </View>
                  <Text style={[styles.bombSep, { color: isNearEnd ? '#FF3B30' : accentColor }]}>:</Text>
                  <View style={[styles.bombDigitBlock, { borderColor: isNearEnd ? '#FF3B30' : accentColor + '55' }]}>
                    <Text style={[styles.bombDigit, { color: isNearEnd ? '#FF3B30' : accentColor }]}>
                      {countdown.seconds}
                    </Text>
                  </View>
                </View>
                {isNearEnd && (
                  <Text style={styles.bombNearEndLabel}>ALMOST FREE... ALMOST.</Text>
                )}
              </Animated.View>
            )}

            {/* Conversation Panel */}
            <Animated.View
              style={[
                styles.chatConsole,
                { borderColor: accentColor },
                { transform: [{ translateX: shakeAnim }] },
              ]}
            >
              <View style={styles.aiConsoleHeader}>
                <Skull color={accentColor} size={20} />
                <Text style={styles.aiConsoleTitle}>
                  TOUCHGRASS NEGOTIATOR {aiMood === 'angry' ? '🙄💀' : '🙄'}
                </Text>
                <Text style={[styles.moodBadge, { color: accentColor, borderColor: accentColor }]}>
                  {aiMood.toUpperCase()}
                </Text>
              </View>

              <ScrollView
                style={styles.chatScroller}
                contentContainerStyle={styles.chatScrollerContent}
                ref={ref => ref?.scrollToEnd({ animated: true })}
              >
                {chatLog.map((chat, idx) => {
                  const isUser = chat.role === 'user';
                  const isLatestAi = !isUser && idx === chatLog.length - 1;
                  return (
                    <View
                      key={idx}
                      style={[styles.chatBubble, isUser ? styles.userBubble : styles.aiBubble]}
                    >
                      <Text style={styles.bubbleRole}>{isUser ? 'YOU' : 'TOUCHGRASS'}</Text>
                      <Text style={styles.bubbleText}>
                        {isLatestAi && isAiTyping ? aiTypingText : chat.message}
                      </Text>
                    </View>
                  );
                })}
                {loading && (
                  <View style={styles.evaluatingContainer}>
                    <Sparkles color={accentColor} size={16} style={styles.evaluatingIcon} />
                    <Text style={[styles.evaluatingText, { color: accentColor }]}>{loadingStep}</Text>
                  </View>
                )}
              </ScrollView>
            </Animated.View>

            {/* Excuse Input */}
            <View style={styles.excuseInputCard}>
              <Text style={styles.inputCardLabel}>PROVE YOUR SANITY</Text>
              <Text style={styles.inputCardDesc}>
                State a valid, high-effort excuse. Lies will trigger severe penalties.
              </Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder="I am trying to bypass because..."
                  placeholderTextColor="#555555"
                  value={excuse}
                  onChangeText={setExcuse}
                  editable={!loading && !isAiTyping}
                  maxLength={200}
                  multiline
                />
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    { backgroundColor: accentColor },
                    (!excuse.trim() || loading || isAiTyping) && styles.sendButtonDisabled,
                  ]}
                  onPress={submitExcuse}
                  disabled={!excuse.trim() || loading || isAiTyping}
                >
                  <Send color="#FFFFFF" size={16} fill="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.cancelLink} onPress={handleGiveUp}>
              <Text style={styles.cancelLinkText}>GIVE UP & BACK TO SAFETY</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070707',
  },
  container: {
    flex: 1,
  },
  redFlashOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#FF3B30',
    zIndex: 999,
  },
  penaltyPop: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    zIndex: 1000,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  penaltyPopText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 1,
    textAlign: 'center',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
    backgroundColor: '#111111',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#222222',
    padding: 14,
  },
  shieldWrapper: {
    marginRight: 14,
  },
  headerTextWrapper: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  },
  headerSubtitle: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 1,
  },
  // Bomb Timer
  bombTimerContainer: {
    width: '100%',
    backgroundColor: '#0A0A0A',
    borderWidth: 2,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  bombTimerLabel: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 14,
  },
  bombDigitsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bombDigitBlock: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  bombDigit: {
    fontSize: 52,
    fontWeight: '900',
    fontFamily: 'System',
    letterSpacing: 2,
  },
  bombSep: {
    fontSize: 40,
    fontWeight: '900',
    marginTop: -6,
  },
  bombNearEndLabel: {
    color: '#FF3B30',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 12,
  },
  // Chat
  chatConsole: {
    width: '100%',
    height: 260,
    backgroundColor: '#0F0F0F',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  aiConsoleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
    paddingBottom: 10,
    marginBottom: 10,
  },
  aiConsoleTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1.5,
    marginLeft: 8,
    flex: 1,
  },
  moodBadge: {
    fontSize: 9,
    fontWeight: '900',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    letterSpacing: 0.5,
  },
  chatScroller: {
    flex: 1,
  },
  chatScrollerContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  chatBubble: {
    borderRadius: 8,
    padding: 10,
    marginVertical: 5,
    maxWidth: '90%',
  },
  userBubble: {
    backgroundColor: '#1E1C1C',
    borderColor: '#3D3030',
    borderWidth: 1,
    alignSelf: 'flex-end',
  },
  aiBubble: {
    backgroundColor: '#12161A',
    borderColor: '#1C2630',
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  bubbleRole: {
    color: '#666666',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  bubbleText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'System',
  },
  evaluatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 6,
  },
  evaluatingIcon: {
    marginRight: 8,
  },
  evaluatingText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  excuseInputCard: {
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#1E1E1E',
    borderRadius: 12,
    width: '100%',
    padding: 16,
    marginBottom: 16,
  },
  inputCardLabel: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  inputCardDesc: {
    color: '#777777',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#080808',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 8,
    paddingLeft: 12,
    paddingRight: 6,
    minHeight: 56,
  },
  textInput: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 13,
    paddingVertical: 10,
    maxHeight: 100,
    fontFamily: 'System',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  sendButtonDisabled: {
    backgroundColor: '#333333',
    opacity: 0.5,
  },
  cancelLink: {
    padding: 12,
  },
  cancelLinkText: {
    color: '#666666',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1.5,
  },
});
