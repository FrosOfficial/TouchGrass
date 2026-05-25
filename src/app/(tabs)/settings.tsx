import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Switch, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings, ShieldAlert, Trash2, Award, HeartCrack } from 'lucide-react-native';
import * as DB from '../../db/database';
import * as TouchGrass from 'touch-grass';

export default function SettingsScreen() {
  const [difficulty, setDifficulty] = useState('medium');
  
  // Native Permissions States
  const [accessibilityEnabled, setAccessibilityEnabled] = useState(false);
  const [overlayGranted, setOverlayGranted] = useState(false);

  useEffect(() => {
    loadSettings();
    checkPermissions();
  }, []);

  const loadSettings = () => {
    const diff = DB.getSetting('difficulty') || 'medium';
    setDifficulty(diff);
  };

  const checkPermissions = () => {
    if (Platform.OS === 'android') {
      try {
        setAccessibilityEnabled(TouchGrass.isAccessibilityServiceEnabled());
        setOverlayGranted(TouchGrass.isOverlayPermissionGranted());
      } catch (e) {
        console.error("Error checking permissions natively:", e);
      }
    } else {
      // Mock for development
      setAccessibilityEnabled(true);
      setOverlayGranted(true);
    }
  };

  const handleAccessibilityClick = () => {
    if (Platform.OS === 'android') {
      TouchGrass.openAccessibilitySettings();
      // Add alert to guide the user
      Alert.alert(
        "Accessibility Service",
        "Please look for 'TouchGrass Shield Service' under Downloaded Services / Installed Apps, and toggle it ON to enable blocking."
      );
    } else {
      Alert.alert("Native Permission", "Accessibility services are only applicable on Android devices.");
    }
  };

  const handleOverlayClick = () => {
    if (Platform.OS === 'android') {
      TouchGrass.openOverlaySettings();
    } else {
      Alert.alert("Native Permission", "Draw over apps settings are only applicable on Android devices.");
    }
  };

  const clearLogsAndHistory = () => {
    Alert.alert(
      "CONFIRM WIPE",
      "Are you sure you want to clear your negotiation history and reset the AI's annoyance counters?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "WIPE STATE", 
          style: "destructive", 
          onPress: () => {
            DB.clearChatHistory();
            DB.setSetting('consequence_level', '0');
            DB.setSetting('ai_mood', 'neutral');
            Alert.alert("WIPED", "AI state reset to baseline neutral.");
          } 
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>CONSOLE</Text>
            <Text style={styles.headerSubtitle}>ROOT DIAGNOSTICS & SYSTEM CONFIG</Text>
          </View>
          <Settings color="#34C759" size={24} />
        </View>

        {/* Permissions Section */}
        <Text style={styles.sectionTitle}>SYSTEM LEVEL PRIVILEGES</Text>
        
        <View style={styles.card}>
          <View style={styles.permissionItem}>
            <View style={styles.permissionInfo}>
              <Text style={styles.permissionName}>1. Accessibility Shield</Text>
              <Text style={styles.permissionDesc}>Required to detect foreground apps instantly without battery drain.</Text>
            </View>
            <TouchableOpacity 
              style={[
                styles.permissionStatusBtn, 
                accessibilityEnabled ? styles.statusBtnEnabled : styles.statusBtnDisabled
              ]}
              onPress={handleAccessibilityClick}
            >
              <Text style={styles.statusBtnText}>{accessibilityEnabled ? 'ACTIVE' : 'GRANT'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.permissionItem}>
            <View style={styles.permissionInfo}>
              <Text style={styles.permissionName}>2. Overlay Shield Window</Text>
              <Text style={styles.permissionDesc}>Required to draw the full screen roast negotiation overlay immediately.</Text>
            </View>
            <TouchableOpacity 
              style={[
                styles.permissionStatusBtn, 
                overlayGranted ? styles.statusBtnEnabled : styles.statusBtnDisabled
              ]}
              onPress={handleOverlayClick}
            >
              <Text style={styles.statusBtnText}>{overlayGranted ? 'ACTIVE' : 'GRANT'}</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity onPress={checkPermissions} style={styles.diagnosticsBtn}>
            <Text style={styles.diagnosticsBtnText}>RE-RUN PRIVILEGE DIAGNOSTICS</Text>
          </TouchableOpacity>
        </View>

        {/* System Settings & Maintenance */}
        <Text style={styles.sectionTitle}>SYSTEM WIPE</Text>
        <View style={styles.card}>
          <View style={styles.maintenanceRow}>
            <View style={styles.maintenanceInfo}>
              <Text style={styles.maintenanceName}>Reset AI Hostility</Text>
              <Text style={styles.maintenanceDesc}>Wipe chats, reset strikes, and soothe the AI's boiling anger.</Text>
            </View>
            <TouchableOpacity onPress={clearLogsAndHistory} style={styles.trashBtn}>
              <Trash2 color="#FF3B30" size={18} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Creator Info */}
        <View style={styles.creatorSection}>
          <HeartCrack color="#333333" size={32} />
          <Text style={styles.creatorText}>TOUCHGRASS v1.0.0 (Personal APK Build)</Text>
          <Text style={styles.creatorSubtext}>Made with absolute tough love to save you from brain rot.</Text>
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
    color: '#34C759',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 1,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 12,
    marginTop: 15,
  },
  card: {
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#1E1E1E',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  permissionInfo: {
    flex: 1,
    marginRight: 10,
  },
  permissionName: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },
  permissionDesc: {
    color: '#777777',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  permissionStatusBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    minWidth: 70,
    alignItems: 'center',
  },
  statusBtnEnabled: {
    backgroundColor: '#1E3E28',
    borderWidth: 1,
    borderColor: '#34C759',
  },
  statusBtnDisabled: {
    backgroundColor: '#3D1D1D',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  statusBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: '#1E1E1E',
    marginVertical: 14,
  },
  diagnosticsBtn: {
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    height: 40,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  diagnosticsBtnText: {
    color: '#CCCCCC',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },

  maintenanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  maintenanceInfo: {
    flex: 1,
    marginRight: 10,
  },
  maintenanceName: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },
  maintenanceDesc: {
    color: '#777777',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  trashBtn: {
    backgroundColor: '#201111',
    borderWidth: 1,
    borderColor: '#4A1C1C',
    width: 38,
    height: 38,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  creatorSection: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 50,
  },
  creatorText: {
    color: '#444444',
    fontSize: 10,
    fontWeight: '900',
    marginTop: 10,
    letterSpacing: 1,
  },
  creatorSubtext: {
    color: '#333333',
    fontSize: 9,
    marginTop: 4,
  },
});
