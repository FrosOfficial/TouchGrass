import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Shield, ShieldAlert, Eye, Layers, ChevronRight, Check } from 'lucide-react-native';
import * as TouchGrass from 'touch-grass';
import * as DB from '../db/database';

const { width, height } = Dimensions.get('window');

const STEPS = [
  {
    id: 'welcome',
    title: 'WELCOME TO\nTOUCHGRASS',
    subtitle: 'Your AI-powered brain rot terminator.',
    desc: 'This app will block your most addictive apps and force you to negotiate with a sarcastic AI to get them back. Let\'s get you set up.',
    icon: 'shield',
    color: '#00C7FC',
    actionLabel: 'GET STARTED',
  },
  {
    id: 'accessibility',
    title: 'STEP 1 OF 2\nACCESSIBILITY',
    subtitle: 'Required to detect and block apps.',
    desc: 'We need Android Accessibility Service to see which app is in the foreground and intercept it instantly. We never read your screen content.',
    icon: 'eye',
    color: '#FF9500',
    actionLabel: 'OPEN ACCESSIBILITY SETTINGS',
    instructions: [
      '1. Tap "OPEN ACCESSIBILITY SETTINGS" below',
      '2. Find "Downloaded apps" or "Installed apps"',
      '3. Tap "TouchGrass Shield Service"',
      '4. Toggle it ON and confirm',
      '5. Come back here and tap NEXT',
    ],
  },
  {
    id: 'overlay',
    title: 'STEP 2 OF 2\nOVERLAY WINDOW',
    subtitle: 'Required to draw the lockscreen over apps.',
    desc: 'We need Draw Over Apps permission to instantly show the lockscreen on top of blocked apps the moment you open them.',
    icon: 'layers',
    color: '#FF3B30',
    actionLabel: 'OPEN OVERLAY SETTINGS',
    instructions: [
      '1. Tap "OPEN OVERLAY SETTINGS" below',
      '2. Find "TouchGrass" in the list',
      '3. Toggle "Allow display over other apps" ON',
      '4. Come back here and tap NEXT',
    ],
  },
  {
    id: 'done',
    title: 'YOU\'RE ALL SET',
    subtitle: 'TouchGrass is fully armed.',
    desc: 'Your digital discipline system is now active. Head to the APPS tab to choose which apps to block, then hit the big shield button to lock them down.',
    icon: 'check',
    color: '#34C759',
    actionLabel: 'START USING TOUCHGRASS',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [accessibilityDone, setAccessibilityDone] = useState(false);
  const [overlayDone, setOverlayDone] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const iconPulse = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const step = STEPS[currentStep];

  useEffect(() => {
    // Pulse icon continuously
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(iconPulse, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(iconPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();

    // Animate progress bar
    Animated.timing(progressAnim, {
      toValue: currentStep / (STEPS.length - 1),
      duration: 400,
      useNativeDriver: false,
    }).start();

    return () => pulse.stop();
  }, [currentStep]);

  // Re-check permissions whenever step changes (user might have just granted)
  useEffect(() => {
    if (Platform.OS === 'android') {
      setAccessibilityDone(TouchGrass.isAccessibilityServiceEnabled());
      setOverlayDone(TouchGrass.isOverlayPermissionGranted());
    }
  }, [currentStep]);

  const animateTransition = (toStep: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -30, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setCurrentStep(toStep);
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleAction = () => {
    if (step.id === 'accessibility') {
      TouchGrass.openAccessibilitySettings();
      return;
    }
    if (step.id === 'overlay') {
      TouchGrass.openOverlaySettings();
      return;
    }
    if (step.id === 'done') {
      DB.setSetting('onboarding_complete', 'true');
      router.replace('/(tabs)');
      return;
    }
    // Welcome step
    animateTransition(currentStep + 1);
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      animateTransition(currentStep + 1);
    }
  };

  const handleSkip = () => {
    DB.setSetting('onboarding_complete', 'true');
    router.replace('/(tabs)');
  };

  const renderIcon = () => {
    const size = 72;
    const color = step.color;
    switch (step.icon) {
      case 'shield':
        return <Shield color={color} size={size} />;
      case 'eye':
        return <Eye color={color} size={size} />;
      case 'layers':
        return <Layers color={color} size={size} />;
      case 'check':
        return <Check color={color} size={size} strokeWidth={3} />;
      default:
        return <Shield color={color} size={size} />;
    }
  };

  const isPermStep = step.id === 'accessibility' || step.id === 'overlay';
  const isPermGranted = step.id === 'accessibility' ? accessibilityDone : overlayDone;

  return (
    <SafeAreaView style={styles.container}>
      {/* Skip button */}
      {currentStep < STEPS.length - 1 && (
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipText}>SKIP</Text>
        </TouchableOpacity>
      )}

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              backgroundColor: step.color,
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      {/* Step dots */}
      <View style={styles.dotsRow}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === currentStep && { backgroundColor: step.color, width: 20 },
              i < currentStep && { backgroundColor: '#34C759' },
            ]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Icon with glow */}
          <Animated.View
            style={[
              styles.iconContainer,
              {
                borderColor: step.color,
                shadowColor: step.color,
                transform: [{ scale: iconPulse }],
              },
            ]}
          >
            {renderIcon()}
          </Animated.View>

          {/* Title */}
          <Text style={[styles.title, { color: step.color }]}>{step.title}</Text>
          <Text style={styles.subtitle}>{step.subtitle}</Text>
          <Text style={styles.desc}>{step.desc}</Text>

          {/* Instructions card for permission steps */}
          {isPermStep && step.instructions && (
            <View style={[styles.instructionCard, { borderColor: step.color + '55' }]}>
              <Text style={[styles.instructionTitle, { color: step.color }]}>HOW TO DO IT</Text>
              {step.instructions.map((line, i) => (
                <View key={i} style={styles.instructionLine}>
                  {isPermGranted && i === step.instructions!.length - 1 ? (
                    <Check color="#34C759" size={14} strokeWidth={3} style={styles.instructionCheck} />
                  ) : (
                    <View style={[styles.instructionBullet, { backgroundColor: step.color }]} />
                  )}
                  <Text style={styles.instructionText}>{line}</Text>
                </View>
              ))}

              {/* Permission status */}
              <View style={[styles.permStatusRow, { borderColor: isPermGranted ? '#34C759' : step.color }]}>
                <View style={[styles.permStatusDot, { backgroundColor: isPermGranted ? '#34C759' : '#555555' }]} />
                <Text style={[styles.permStatusText, { color: isPermGranted ? '#34C759' : '#888888' }]}>
                  {isPermGranted ? 'PERMISSION GRANTED ✓' : 'WAITING FOR PERMISSION...'}
                </Text>
              </View>
            </View>
          )}

          {/* Done step extra info */}
          {step.id === 'done' && (
            <View style={styles.doneChecklist}>
              <View style={styles.doneCheckRow}>
                <Check color="#34C759" size={16} strokeWidth={3} />
                <Text style={styles.doneCheckText}>Accessibility Service</Text>
                <Text style={[styles.doneCheckStatus, { color: accessibilityDone ? '#34C759' : '#FF9500' }]}>
                  {accessibilityDone ? 'ACTIVE' : 'SKIPPED'}
                </Text>
              </View>
              <View style={styles.doneCheckRow}>
                <Check color="#34C759" size={16} strokeWidth={3} />
                <Text style={styles.doneCheckText}>Overlay Permission</Text>
                <Text style={[styles.doneCheckStatus, { color: overlayDone ? '#34C759' : '#FF9500' }]}>
                  {overlayDone ? 'ACTIVE' : 'SKIPPED'}
                </Text>
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Bottom action area */}
      <View style={styles.bottomArea}>
        {/* For permission steps: Open settings + Next buttons */}
        {isPermStep ? (
          <View style={styles.permButtonRow}>
            <TouchableOpacity
              style={[styles.openSettingsBtn, { backgroundColor: step.color }]}
              onPress={handleAction}
            >
              <Text style={styles.openSettingsBtnText}>{step.actionLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.nextBtn, isPermGranted && { borderColor: '#34C759' }]}
              onPress={handleNext}
            >
              <Text style={[styles.nextBtnText, isPermGranted && { color: '#34C759' }]}>
                {isPermGranted ? 'NEXT ✓' : 'NEXT →'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.mainActionBtn, { backgroundColor: step.color }]}
            onPress={handleAction}
          >
            <Text style={styles.mainActionBtnText}>{step.actionLabel}</Text>
            {step.id !== 'done' && <ChevronRight color="#FFFFFF" size={20} />}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
  },
  skipBtn: {
    position: 'absolute',
    top: 52,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  skipText: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  progressTrack: {
    height: 2,
    backgroundColor: '#1E1E1E',
    marginTop: 8,
  },
  progressFill: {
    height: 2,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2A2A2A',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 20,
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111111',
    marginBottom: 32,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 10,
  },
  subtitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
  },
  desc: {
    color: '#888888',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  instructionCard: {
    width: '100%',
    backgroundColor: '#101010',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  instructionTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  instructionLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  instructionBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 10,
  },
  instructionCheck: {
    marginRight: 10,
  },
  instructionText: {
    color: '#CCCCCC',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  permStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    marginTop: 12,
  },
  permStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  permStatusText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  doneChecklist: {
    width: '100%',
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    gap: 14,
  },
  doneCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  doneCheckText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  doneCheckStatus: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bottomArea: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
  },
  mainActionBtn: {
    height: 56,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  mainActionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  permButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  openSettingsBtn: {
    flex: 1,
    height: 52,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  openSettingsBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  nextBtn: {
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
