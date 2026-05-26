import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, ShieldAlert } from 'lucide-react-native';
import * as DB from '../../db/database';
import * as TouchGrass from 'touch-grass';
import WheelPicker from '../../components/WheelPicker';

// Build hour/minute lists
const HOURS = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
const AMPMS = ['AM', 'PM'];

function parse24To12(time24: string) {
  const [hStr, mStr] = (time24 || '09:00').split(':');
  let h = parseInt(hStr, 10);
  if (isNaN(h)) h = 9;
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return {
    hours: h.toString(),
    minutes: m.padStart(2, '0'),
    ampm,
  };
}

function compose12To24(hours12: string, minutes: string, ampm: 'AM' | 'PM') {
  let h = parseInt(hours12, 10);
  if (isNaN(h) || h < 1 || h > 12) h = 12;
  const m = minutes.padStart(2, '0');
  if (ampm === 'PM' && h !== 12) {
    h += 12;
  } else if (ampm === 'AM' && h === 12) {
    h = 0;
  }
  const hStr = h.toString().padStart(2, '0');
  return `${hStr}:${m}`;
}

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
    DB.setSetting('global_lock_start', start);
    DB.setSetting('global_lock_end', end);
    DB.setSetting('global_lock_enabled', enabled ? 'true' : 'false');
    DB.setSetting('global_lock_preset', preset ?? '');

    setStartTime(start);
    setEndTime(end);
    setIsGlobalEnabled(enabled);
    setActivePreset(preset);

    if (Platform.OS === 'android') {
      try {
        const schedules = DB.getSchedules();
        const activePackages = schedules.filter(s => s.is_enabled).map(s => s.app_package).join(',');
        TouchGrass.updateGlobalLockSettings(enabled, start, end);
        const activeState = TouchGrass.getLockState();
        TouchGrass.updateLockState(activeState.isLocked, activeState.lockUntil, activePackages);
      } catch (e) {
        console.error('Failed to sync global lock settings natively:', e);
      }
    }
  };

  const applyPreset = (name: string, start: string, end: string) => {
    saveSettings(start, end, true, name);
  };

  const toggleGlobalLock = () => {
    saveSettings(startTime, endTime, !isGlobalEnabled, activePreset);
  };

  // Derived wheel values
  const start12 = parse24To12(startTime);
  const end12 = parse24To12(endTime);

  const handleWheelChange = (type: 'start' | 'end', key: 'hours' | 'minutes' | 'ampm', val: string) => {
    const current = type === 'start' ? start12 : end12;
    const next = { ...current, [key]: val };
    const next24 = compose12To24(next.hours, next.minutes, next.ampm as 'AM' | 'PM');
    if (type === 'start') {
      saveSettings(next24, endTime, isGlobalEnabled, null);
    } else {
      saveSettings(startTime, next24, isGlobalEnabled, null);
    }
  };

  const renderTimePicker = (type: 'start' | 'end') => {
    const t12 = type === 'start' ? start12 : end12;
    return (
      <View style={styles.wheelPickerContainer}>
        <WheelPicker
          items={HOURS}
          selectedValue={t12.hours}
          onChange={val => handleWheelChange(type, 'hours', val)}
          itemHeight={44}
          visibleItems={5}
          accentColor="#00C7FC"
          width={52}
        />
        <Text style={styles.wheelColon}>:</Text>
        <WheelPicker
          items={MINUTES}
          selectedValue={t12.minutes}
          onChange={val => handleWheelChange(type, 'minutes', val)}
          itemHeight={44}
          visibleItems={5}
          accentColor="#00C7FC"
          width={52}
        />
        <WheelPicker
          items={AMPMS}
          selectedValue={t12.ampm}
          onChange={val => handleWheelChange(type, 'ampm', val)}
          itemHeight={44}
          visibleItems={5}
          accentColor="#FF9500"
          width={48}
          style={{ marginLeft: 8 }}
        />
      </View>
    );
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

          {/* Time Pickers Row */}
          <View style={styles.timePickersRow}>
            <View style={styles.timePickerCol}>
              <Text style={styles.timeLabel}>START LOCK</Text>
              {renderTimePicker('start')}
            </View>

            <View style={styles.separatorCol}>
              <Text style={styles.separatorText}>TO</Text>
            </View>

            <View style={styles.timePickerCol}>
              <Text style={styles.timeLabel}>RELEASE LOCK</Text>
              {renderTimePicker('end')}
            </View>
          </View>

          {/* Display selected times */}
          <View style={styles.timeDisplayRow}>
            <Text style={styles.timeDisplayText}>
              {start12.hours}:{start12.minutes} {start12.ampm}
            </Text>
            <Text style={styles.timeDisplayArrow}>→</Text>
            <Text style={styles.timeDisplayText}>
              {end12.hours}:{end12.minutes} {end12.ampm}
            </Text>
          </View>
        </View>

        {/* Preset Header */}
        <Text style={styles.sectionTitle}>LOCKOUT PRESETS</Text>

        <TouchableOpacity
          style={[styles.presetCard, activePreset === 'hustle' && styles.presetCardActive]}
          onPress={() => applyPreset('hustle', '09:00', '17:00')}
        >
          <View style={styles.presetHeader}>
            <Text style={styles.presetName}>💼 The 9-to-5 Hustle</Text>
            <Text style={styles.presetTime}>9:00 AM – 5:00 PM</Text>
          </View>
          <Text style={styles.presetDesc}>Blocks procrastination apps completely during prime working hours.</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.presetCard, activePreset === 'morning' && styles.presetCardActive]}
          onPress={() => applyPreset('morning', '06:00', '09:00')}
        >
          <View style={styles.presetHeader}>
            <Text style={styles.presetName}>🌅 Sunrise Focus</Text>
            <Text style={styles.presetTime}>6:00 AM – 9:00 AM</Text>
          </View>
          <Text style={styles.presetDesc}>Guarantees a doomscroll-free morning so you can wake up properly.</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.presetCard, activePreset === 'sleep' && styles.presetCardActive]}
          onPress={() => applyPreset('sleep', '22:00', '06:00')}
        >
          <View style={styles.presetHeader}>
            <Text style={styles.presetName}>🌙 Sleep Shield</Text>
            <Text style={styles.presetTime}>10:00 PM – 6:00 AM</Text>
          </View>
          <Text style={styles.presetDesc}>Ensures no late-night feeds interrupt your recovery sleep cycle.</Text>
        </TouchableOpacity>

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
    borderRadius: 12,
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
    marginBottom: 20,
  },
  timePickersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 14,
  },
  timePickerCol: {
    flex: 1,
    alignItems: 'center',
  },
  timeLabel: {
    color: '#555555',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  wheelPickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelColon: {
    color: '#555555',
    fontSize: 22,
    fontWeight: '900',
    marginHorizontal: 2,
    marginTop: -4,
  },
  separatorCol: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  separatorText: {
    color: '#444444',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1,
  },
  timeDisplayRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0A0A0A',
    borderRadius: 8,
    padding: 10,
  },
  timeDisplayText: {
    color: '#00C7FC',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  timeDisplayArrow: {
    color: '#444444',
    fontSize: 16,
    fontWeight: '900',
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
