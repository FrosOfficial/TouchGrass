import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Animated, KeyboardAvoidingView, Platform, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Skull, AlertTriangle, Send, ShieldAlert, Sparkles } from 'lucide-react-native';
import * as TouchGrass from 'touch-grass';
import * as DB from '../db/database';
import { negotiateExcuse } from '../services/aiEngine';

export default function LockScreen() {
  const router = useRouter();
  
  // App context
  const [blockedApp, setBlockedApp] = useState('');
  
  // Excuse negotiation states
  const [excuse, setExcuse] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  
  // Conversation states
  const [chatLog, setChatLog] = useState<{ role: 'user' | 'ai'; message: string; mood: string }[]>([]);
  const [aiTypingText, setAiTypingText] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);

  // Animated elements
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const redFlashAnim = useRef(new Animated.Value(0)).current;

  // AI Appearance
  const [aiMood, setAiMood] = useState('sarcastic');

  useEffect(() => {
    loadActiveBlockedPackage();
    loadChatHistory();
  }, []);

  const loadActiveBlockedPackage = () => {
    if (Platform.OS === 'android') {
      const activePackage = TouchGrass.getActiveBlockedPackage();
      if (activePackage) {
        // Humanize package name
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
      mood: item.mood
    }));

    if (formatted.length === 0) {
      // Prime with initial Morning Roast if history is empty
      const initialRoast = "Oh look, the CEO of Doomscrolling is trying to access social media early again. Didn't you swear you were going to be productive today? Put the phone down.";
      DB.addChatMessage('ai', initialRoast, 'sarcastic');
      setChatLog([{ role: 'ai', message: initialRoast, mood: 'sarcastic' }]);
      simulateAiTyping(initialRoast);
    } else {
      setChatLog(formatted);
      const latestMsg = formatted[formatted.length - 1];
      if (latestMsg && latestMsg.role === 'ai') {
        setAiMood(latestMsg.mood);
      }
    }
  };

  const simulateAiTyping = (text: string) => {
    setIsAiTyping(true);
    setAiTypingText('');
    let index = 0;
    
    // Quick typing interval
    const interval = setInterval(() => {
      setAiTypingText(prev => prev + text.charAt(index));
      index++;
      if (index >= text.length) {
        clearInterval(interval);
        setIsAiTyping(false);
      }
    }, 15); // Fast typing pace
  };

  const triggerShakeAndRedFlash = () => {
    // 1. Trigger shake Sequence
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();

    // 2. Trigger glowing red flash overlay
    Animated.sequence([
      Animated.timing(redFlashAnim, { toValue: 0.6, duration: 80, useNativeDriver: true }),
      Animated.timing(redFlashAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  };

  const submitExcuse = async () => {
    if (!excuse.trim()) return;

    setLoading(true);
    setLoadingStep('TOUCHGRASS IS ASSESSING YOUR LAZY EXCUSE...');
    
    // Save user message to database
    DB.addChatMessage('user', excuse, 'neutral');
    
    const nextChatLog = [...chatLog, { role: 'user' as const, message: excuse, mood: 'neutral' }];
    setChatLog(nextChatLog);
    setExcuse('');

    // Wait a brief simulated evaluation delay for maximum suspense
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      const evaluation = await negotiateExcuse(excuse);
      setAiMood(evaluation.mood);

      if (evaluation.approved) {
        // Force unlock: update native module state to disabled
        if (Platform.OS === 'android') {
          TouchGrass.clearActiveBlockedPackage();
          const currentState = TouchGrass.getLockState();
          // Turn off lock
          TouchGrass.updateLockState(false, 0, currentState.blockedPackages);
        }
        
        DB.addChatMessage('ai', evaluation.response, evaluation.mood);
        setChatLog(prev => [...prev, { role: 'ai', message: evaluation.response, mood: evaluation.mood }]);
        
        setLoading(false);
        Alert.alert(
          "NEGOTIATION GRANTED", 
          "The AI successfully unlocked your phone... for now.",
          [{ text: "DISMISS", onPress: () => router.replace('/(tabs)') }]
        );
      } else {
        // Lock rejected
        DB.addChatMessage('ai', evaluation.response, evaluation.mood);
        setChatLog(prev => [...prev, { role: 'ai', message: evaluation.response, mood: evaluation.mood }]);
        
        // Apply progressive lockdown penalty
        if (Platform.OS === 'android') {
          const currentState = TouchGrass.getLockState();
          
          // Calculate new duration = current limit + penalty time
          const currentUntil = currentState.lockUntil > Date.now() ? currentState.lockUntil : Date.now();
          const penaltyMs = evaluation.time_penalty_minutes * 60 * 1000;
          const newLockUntil = currentUntil + penaltyMs;
          
          TouchGrass.updateLockState(true, newLockUntil, currentState.blockedPackages);
        }

        // Show visuals
        setLoading(false);
        triggerShakeAndRedFlash();
        simulateAiTyping(evaluation.response);
      }
    } catch (e) {
      setLoading(false);
      console.error("Excuse negotiation failed:", e);
    }
  };

  const getThemeColor = () => {
    switch (aiMood) {
      case 'angry':
        return '#FF3B30'; // Neon Red
      case 'annoyed':
        return '#FF9500'; // Amber/Orange
      case 'sarcastic':
        return '#00C7FC'; // Cyber Blue
      default:
        return '#34C759'; // Mint Green
    }
  };

  const accentColor = getThemeColor();

  return (
    <SafeAreaView style={styles.container}>
      {/* Intimidating red flash panel */}
      <Animated.View 
        style={[
          styles.redFlashOverlay, 
          { opacity: redFlashAnim }
        ]} 
        pointerEvents="none" 
      />

      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header Warning */}
          <View style={styles.header}>
            <View style={styles.shieldWrapper}>
              <ShieldAlert color={accentColor} size={28} />
            </View>
            <View style={styles.headerTextWrapper}>
              <Text style={[styles.headerTitle, { color: accentColor }]}>ACCESS DENIED</Text>
              <Text style={styles.headerSubtitle}>{blockedApp} IS LOCKED DOWN</Text>
            </View>
          </View>

          {/* Sarcastic Conversation Panel */}
          <Animated.View 
            style={[
              styles.chatConsole, 
              { borderColor: accentColor },
              { transform: [{ translateX: shakeAnim }] }
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
                    style={[
                      styles.chatBubble, 
                      isUser ? styles.userBubble : styles.aiBubble
                    ]}
                  >
                    <Text style={styles.bubbleRole}>
                      {isUser ? 'YOU' : 'TOUCHGRASS'}
                    </Text>
                    <Text style={styles.bubbleText}>
                      {isLatestAi && isAiTyping ? aiTypingText : chat.message}
                    </Text>
                  </View>
                );
              })}

              {loading && (
                <View style={styles.evaluatingContainer}>
                  <Sparkles color={accentColor} size={16} style={styles.evaluatingIcon} />
                  <Text style={[styles.evaluatingText, { color: accentColor }]}>
                    {loadingStep}
                  </Text>
                </View>
              )}
            </ScrollView>
          </Animated.View>

          {/* Negotiate Excuse Input Card */}
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
                  (!excuse.trim() || loading || isAiTyping) && styles.sendButtonDisabled
                ]}
                onPress={submitExcuse}
                disabled={!excuse.trim() || loading || isAiTyping}
              >
                <Send color="#FFFFFF" size={16} fill="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Emergency bypass info */}
          <TouchableOpacity 
            style={styles.cancelLink}
            onPress={() => router.replace('/(tabs)')}
          >
            <Text style={styles.cancelLinkText}>GIVE UP & BACK TO SAFETY</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070707',
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
    marginBottom: 20,
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
  chatConsole: {
    width: '100%',
    height: 320,
    backgroundColor: '#0F0F0F',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
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
    marginBottom: 24,
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
