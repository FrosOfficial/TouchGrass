import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, Plus, Trash2, ShieldAlert } from 'lucide-react-native';
import * as DB from '../../db/database';
import * as TouchGrass from 'touch-grass';

export default function SchedulesScreen() {
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [isGlobalEnabled, setIsGlobalEnabled] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    const start = DB.getSetting('global_lock_start') || '09:00';
    const end = DB.getSetting('global_lock_end') || '17:00';
    const enabled = DB.getSetting('global_lock_enabled') === 'true';
    const preset = DB.getSetting('global_lock_preset') || null;

    setStartTime(start);
    setEndTime(end);
    setIsGlobalEnabled(enabled);
    setActivePreset(preset);
  };

  const saveSettings = (start: string, end: string, enabled: boolean, preset: string | null) => {
    // Basic format validation hh:mm
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(start) || !timeRegex.test(end)) {
      Alert.alert("Invalid Format", "Please use 24-hour format HH:MM (e.g. 09:30)");
      return;
    }

    DB.setSetting('global_lock_start', start);
    DB.setSetting('global_lock_end', end);
    DB.setSetting('global_lock_enabled', enabled ? 'true' : 'false');
    if (preset) {
      DB.setSetting('global_lock_preset', preset);
    } else {
      DB.setSetting('global_lock_preset', '');
    }

    setStartTime(start);
    setEndTime(end);
    setIsGlobalEnabled(enabled);
    setActivePreset(preset);

    // Sync to background service if enabled!
    if (Platform.OS === 'android') {
      const activeState = TouchGrass.getLockState();
      
      if (enabled) {
        // If global time block is enabled, calculate current lock parameters
        const now = new Date();
        const [startH, startM] = start.split(':').map(Number);
        const [endH, endM] = end.split(':').map(Number);

        const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startH, startM);
        const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, endM);

        // Adjust if end time is next day
        if (endDate <= startDate) {
          endDate.setDate(endDate.getDate() + 1);
        }

        const isCurrentlyInLockWindow = now >= startDate && now <= endDate;
        if (isCurrentlyInLockWindow) {
          // If we are currently within the locked window, activate native lock until window ends!
          const schedules = DB.getSchedules();
          const activePackages = schedules.filter(s => s.is_enabled).map(s => s.app_package).join(',');
          
          TouchGrass.updateLockState(true, endDate.getTime(), activePackages);
        } else {
          // Outside window, disable active lock
          const schedules = DB.getSchedules();
          const activePackages = schedules.filter(s => s.is_enabled).map(s => s.app_package).join(',');
          TouchGrass.updateLockState(false, 0, activePackages);
        }
      }
    }
  };

  const applyPreset = (name: string, start: string, end: string) => {
    saveSettings(start, end, true, name);
  };

  const toggleGlobalLock = () => {
    const nextEnabled = !isGlobalEnabled;
    saveSettings(startTime, endTime, nextEnabled, activePreset);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>TIME BARRIER</Text>
            <Text style={styles.headerSubtitle}>AUTOMATED HUSTLE SCHEDULE</Text>
          </View>
          <Clock color="#00C7FC" size={24} />
        </View>

        {/* Global Toggle Card */}
        <View style={[styles.card, isGlobalEnabled && styles.cardActive]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Global Lockdown Window</Text>
            <TouchableOpacity 
              style={[styles.toggleBtn, isGlobalEnabled && styles.toggleBtnActive]}
              onPress={toggleGlobalLock}
            >
              <Text style={styles.toggleText}>{isGlobalEnabled ? 'ACTIVE' : 'OFF'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.cardDesc}>
            When active, apps in your Shield List will automatically lock down tight between these times.
          </Text>

          {/* Time Picker Inputs */}
          <View style={styles.timeInputsRow}>
            <View style={styles.timeInputCol}>
              <Text style={styles.timeLabel}>START LOCK</Text>
              <TextInput
                style={styles.timeInput}
                value={startTime}
                onChangeText={(text) => saveSettings(text, endTime, isGlobalEnabled, null)}
                placeholder="09:00"
                placeholderTextColor="#444444"
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
            <View style={styles.timeInputSeparator}>
              <Text style={styles.separatorText}>UNTIL</Text>
            </View>
            <View style={styles.timeInputCol}>
              <Text style={styles.timeLabel}>RELEASE LOCK</Text>
              <TextInput
                style={styles.timeInput}
                value={endTime}
                onChangeText={(text) => saveSettings(startTime, text, isGlobalEnabled, null)}
                placeholder="17:00"
                placeholderTextColor="#444444"
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
          </View>
          <Text style={styles.timeTip}>Use 24-hour formatting (HH:MM) e.g., 22:30 for 10:30 PM.</Text>
        </View>

        {/* Preset Header */}
        <Text style={styles.sectionTitle}>LOCKOUT PRESETS</Text>

        {/* Presets Grid */}
        <TouchableOpacity 
          style={[styles.presetCard, activePreset === 'hustle' && styles.presetCardActive]}
          onPress={() => applyPreset('hustle', '09:00', '17:00')}
        >
          <View style={styles.presetHeader}>
            <Text style={styles.presetName}>💼 The 9-to-5 Hustle</Text>
            <Text style={styles.presetTime}>09:00 - 17:00</Text>
          </View>
          <Text style={styles.presetDesc}>Blocks procrastination apps completely during prime working hours.</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.presetCard, activePreset === 'morning' && styles.presetCardActive]}
          onPress={() => applyPreset('morning', '06:00', '09:00')}
        >
          <View style={styles.presetHeader}>
            <Text style={styles.presetName}>🌅 Sunrise Focus</Text>
            <Text style={styles.presetTime}>06:00 - 09:00</Text>
          </View>
          <Text style={styles.presetDesc}>Guarantees a doomscroll-free morning so you can wake up properly.</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.presetCard, activePreset === 'sleep' && styles.presetCardActive]}
          onPress={() => applyPreset('sleep', '22:00', '06:00')}
        >
          <View style={styles.presetHeader}>
            <Text style={styles.presetName}>🌙 Sleep Shield</Text>
            <Text style={styles.presetTime}>22:00 - 06:00</Text>
          </View>
          <Text style={styles.presetDesc}>Ensures no late-night feeds interrupt your recovery sleep cycle.</Text>
        </TouchableOpacity>

        {/* Custom Info Row */}
        <View style={styles.infoBox}>
          <ShieldAlert color="#555555" size={20} />
          <Text style={styles.infoText}>
            Note: If you attempt to alter these lock settings while the shield is actively locked down, your AI coach may intervene and penalize you.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  scrollContainer: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
    marginBottom: 20,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
  },
  headerSubtitle: {
    color: '#00C7FC',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#1E1E1E',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  cardActive: {
    borderColor: '#00C7FC',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  toggleBtn: {
    backgroundColor: '#333333',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  toggleBtnActive: {
    backgroundColor: '#00C7FC',
  },
  toggleText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1,
  },
  cardDesc: {
    color: '#888888',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  timeInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0A0A0A',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  timeInputCol: {
    flex: 1,
    alignItems: 'center',
  },
  timeLabel: {
    color: '#555555',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 6,
  },
  timeInput: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    width: '100%',
    fontFamily: 'System',
  },
  timeInputSeparator: {
    paddingHorizontal: 10,
  },
  separatorText: {
    color: '#333333',
    fontWeight: '900',
    fontSize: 11,
  },
  timeTip: {
    color: '#555555',
    fontSize: 10,
    marginTop: 10,
    textAlign: 'center',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 12,
    marginTop: 10,
  },
  presetCard: {
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#1E1E1E',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  presetCardActive: {
    borderColor: '#00C7FC',
    backgroundColor: '#0B151A',
  },
  presetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  presetName: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },
  presetTime: {
    color: '#00C7FC',
    fontSize: 12,
    fontWeight: '800',
  },
  presetDesc: {
    color: '#777777',
    fontSize: 11,
    lineHeight: 16,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151515',
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  infoText: {
    color: '#666666',
    fontSize: 11,
    flex: 1,
    marginLeft: 10,
    lineHeight: 16,
  },
});
