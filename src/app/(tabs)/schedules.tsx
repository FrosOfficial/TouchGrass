import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, Plus, Trash2, ShieldAlert, ChevronUp, ChevronDown } from 'lucide-react-native';
import * as DB from '../../db/database';
import * as TouchGrass from 'touch-grass';

function parse24To12(time24: string) {
  const [hStr, mStr] = (time24 || "09:00").split(':');
  let h = parseInt(hStr, 10);
  if (isNaN(h)) h = 9;
  const m = mStr || "00";
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return {
    hours: h.toString(),
    minutes: m,
    ampm
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
      try {
        const schedules = DB.getSchedules();
        const activePackages = schedules.filter(s => s.is_enabled).map(s => s.app_package).join(',');
        
        // Sync global settings
        TouchGrass.updateGlobalLockSettings(enabled, start, end);
        
        // Sync active packages and preserve the manual lock state
        const activeState = TouchGrass.getLockState();
        TouchGrass.updateLockState(activeState.isLocked, activeState.lockUntil, activePackages);
      } catch (e) {
        console.error("Failed to sync global lock settings natively:", e);
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

  const start12 = parse24To12(startTime);
  const end12 = parse24To12(endTime);

  const handleTimeChange = (type: 'start' | 'end', key: 'hours' | 'minutes' | 'ampm', val: string) => {
    const current = type === 'start' ? start12 : end12;
    const newComponents = { ...current, [key]: val };
    
    // Auto-clamp and format hours
    let cleanHours = newComponents.hours;
    if (key === 'hours') {
      const hInt = parseInt(val, 10);
      if (!isNaN(hInt)) {
        if (hInt < 1) cleanHours = "1";
        else if (hInt > 12) cleanHours = "12";
        else cleanHours = hInt.toString();
      } else {
        cleanHours = "";
      }
    }
    
    // Auto-clamp and format minutes
    let cleanMinutes = newComponents.minutes;
    if (key === 'minutes') {
      const mInt = parseInt(val, 10);
      if (!isNaN(mInt)) {
        if (mInt < 0) cleanMinutes = "00";
        else if (mInt > 59) cleanMinutes = "59";
        else cleanMinutes = val;
      } else {
        cleanMinutes = "";
      }
    }

    const next24 = compose12To24(cleanHours || "12", cleanMinutes || "00", newComponents.ampm as 'AM' | 'PM');
    
    if (type === 'start') {
      saveSettings(next24, endTime, isGlobalEnabled, null);
    } else {
      saveSettings(startTime, next24, isGlobalEnabled, null);
    }
  };

  const adjustTime = (type: 'start' | 'end', key: 'hours' | 'minutes', delta: number) => {
    const current = type === 'start' ? start12 : end12;
    let val = parseInt(current[key], 10);
    if (isNaN(val)) val = 0;

    let newValStr = "";
    if (key === 'hours') {
      let nextVal = val + delta;
      if (nextVal > 12) nextVal = 1;
      if (nextVal < 1) nextVal = 12;
      newValStr = nextVal.toString();
    } else {
      let nextVal = val + delta;
      if (nextVal >= 60) nextVal = 0;
      if (nextVal < 0) nextVal = 59;
      newValStr = nextVal.toString().padStart(2, '0');
    }

    const next24 = compose12To24(
      key === 'hours' ? newValStr : current.hours,
      key === 'minutes' ? newValStr : current.minutes,
      current.ampm as 'AM' | 'PM'
    );

    if (type === 'start') {
      saveSettings(next24, endTime, isGlobalEnabled, null);
    } else {
      saveSettings(startTime, next24, isGlobalEnabled, null);
    }
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
              <View style={styles.timePickerContainer}>
                {/* Hours Spinner */}
                <View style={styles.dialColumn}>
                  <TouchableOpacity onPress={() => adjustTime('start', 'hours', 1)} style={styles.arrowBtn}>
                    <ChevronUp color="#00C7FC" size={22} />
                  </TouchableOpacity>
                  <Text style={styles.timeDigit}>{start12.hours.padStart(2, '0')}</Text>
                  <TouchableOpacity onPress={() => adjustTime('start', 'hours', -1)} style={styles.arrowBtn}>
                    <ChevronDown color="#00C7FC" size={22} />
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.timeColon}>:</Text>
                
                {/* Minutes Spinner */}
                <View style={styles.dialColumn}>
                  <TouchableOpacity onPress={() => adjustTime('start', 'minutes', 1)} style={styles.arrowBtn}>
                    <ChevronUp color="#00C7FC" size={22} />
                  </TouchableOpacity>
                  <Text style={styles.timeDigit}>{start12.minutes}</Text>
                  <TouchableOpacity onPress={() => adjustTime('start', 'minutes', -1)} style={styles.arrowBtn}>
                    <ChevronDown color="#00C7FC" size={22} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  style={styles.ampmButton}
                  onPress={() => handleTimeChange('start', 'ampm', start12.ampm === 'AM' ? 'PM' : 'AM')}
                >
                  <Text style={styles.ampmText}>{start12.ampm}</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.timeInputSeparator}>
              <Text style={styles.separatorText}>UNTIL</Text>
            </View>
            
            <View style={styles.timeInputCol}>
              <Text style={styles.timeLabel}>RELEASE LOCK</Text>
              <View style={styles.timePickerContainer}>
                {/* Hours Spinner */}
                <View style={styles.dialColumn}>
                  <TouchableOpacity onPress={() => adjustTime('end', 'hours', 1)} style={styles.arrowBtn}>
                    <ChevronUp color="#00C7FC" size={22} />
                  </TouchableOpacity>
                  <Text style={styles.timeDigit}>{end12.hours.padStart(2, '0')}</Text>
                  <TouchableOpacity onPress={() => adjustTime('end', 'hours', -1)} style={styles.arrowBtn}>
                    <ChevronDown color="#00C7FC" size={22} />
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.timeColon}>:</Text>
                
                {/* Minutes Spinner */}
                <View style={styles.dialColumn}>
                  <TouchableOpacity onPress={() => adjustTime('end', 'minutes', 1)} style={styles.arrowBtn}>
                    <ChevronUp color="#00C7FC" size={22} />
                  </TouchableOpacity>
                  <Text style={styles.timeDigit}>{end12.minutes}</Text>
                  <TouchableOpacity onPress={() => adjustTime('end', 'minutes', -1)} style={styles.arrowBtn}>
                    <ChevronDown color="#00C7FC" size={22} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  style={styles.ampmButton}
                  onPress={() => handleTimeChange('end', 'ampm', end12.ampm === 'AM' ? 'PM' : 'AM')}
                >
                  <Text style={styles.ampmText}>{end12.ampm}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <Text style={styles.timeTip}>Tap arrows to adjust hours & minutes. Toggle AM/PM.</Text>
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
            <Text style={styles.presetTime}>9:00 AM - 5:00 PM</Text>
          </View>
          <Text style={styles.presetDesc}>Blocks procrastination apps completely during prime working hours.</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.presetCard, activePreset === 'morning' && styles.presetCardActive]}
          onPress={() => applyPreset('morning', '06:00', '09:00')}
        >
          <View style={styles.presetHeader}>
            <Text style={styles.presetName}>🌅 Sunrise Focus</Text>
            <Text style={styles.presetTime}>6:00 AM - 9:00 AM</Text>
          </View>
          <Text style={styles.presetDesc}>Guarantees a doomscroll-free morning so you can wake up properly.</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.presetCard, activePreset === 'sleep' && styles.presetCardActive]}
          onPress={() => applyPreset('sleep', '22:00', '06:00')}
        >
          <View style={styles.presetHeader}>
            <Text style={styles.presetName}>🌙 Sleep Shield</Text>
            <Text style={styles.presetTime}>10:00 PM - 6:00 AM</Text>
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
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  timeInputCol: {
    flex: 1,
    alignItems: 'center',
  },
  timeLabel: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
  },
  timePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 8,
    paddingHorizontal: 6,
    height: 90,
  },
  dialColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
  },
  timeDigit: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    width: 36,
    fontFamily: 'System',
    lineHeight: 28,
  },
  arrowBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeColon: {
    color: '#555555',
    fontSize: 24,
    fontWeight: '900',
    marginHorizontal: 1,
    alignSelf: 'center',
  },
  ampmButton: {
    backgroundColor: '#222222',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 6,
    marginLeft: 6,
    minWidth: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ampmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  timeInputSeparator: {
    paddingHorizontal: 6,
  },
  separatorText: {
    color: '#444444',
    fontWeight: '900',
    fontSize: 10,
  },
  timeTip: {
    color: '#555555',
    fontSize: 10,
    marginTop: 12,
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
