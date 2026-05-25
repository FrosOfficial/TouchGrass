import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Search, ShieldAlert, Grid } from 'lucide-react-native';
import * as TouchGrass from 'touch-grass';
import * as DB from '../../db/database';

interface DisplayApp {
  packageName: string;
  label: string;
  iconBase64: string;
  isSelected: boolean;
}

let cachedInstalledApps: TouchGrass.InstalledApp[] | null = null;

export function preloadInstalledApps() {
  if (Platform.OS === 'android' && !cachedInstalledApps) {
    setTimeout(() => {
      try {
        cachedInstalledApps = TouchGrass.getInstalledApps();
      } catch (e) {
        console.error("Error preloading apps:", e);
      }
    }, 100);
  }
}

const AppItem = React.memo(({ item, onSelect }: { item: DisplayApp; onSelect: (packageName: string) => void }) => {
  return (
    <TouchableOpacity 
      style={[
        styles.appCard,
        item.isSelected && styles.appCardSelected
      ]}
      onPress={() => onSelect(item.packageName)}
      activeOpacity={0.7}
    >
      {/* App Icon */}
      {item.iconBase64 ? (
        <Image 
          source={{ uri: `data:image/png;base64,${item.iconBase64}` }}
          style={styles.appIcon}
        />
      ) : (
        <View style={styles.appIconPlaceholder}>
          <ShieldAlert color="#555555" size={20} />
        </View>
      )}

      {/* App Details */}
      <View style={styles.appInfo}>
        <Text style={styles.appLabel}>{item.label}</Text>
        <Text style={styles.appPackage} numberOfLines={1}>{item.packageName}</Text>
      </View>

      {/* Checkbox Indicator */}
      <View style={[
        styles.checkbox,
        item.isSelected && styles.checkboxSelected
      ]}>
        {item.isSelected && <Check color="#FFFFFF" size={14} strokeWidth={3} />}
      </View>
    </TouchableOpacity>
  );
});

export default function AppsScreen() {
  const [apps, setApps] = useState<DisplayApp[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadApps();
  }, []);

  const loadApps = async () => {
    setLoading(true);
    try {
      let installedApps: TouchGrass.InstalledApp[] = [];
      if (Platform.OS === 'android') {
        if (cachedInstalledApps) {
          installedApps = cachedInstalledApps;
        } else {
          installedApps = TouchGrass.getInstalledApps();
          cachedInstalledApps = installedApps;
        }
      } else {
        // Mock data for non-Android design testing
        installedApps = [
          { packageName: 'com.instagram.android', label: 'Instagram', iconBase64: '' },
          { packageName: 'com.zhiliaoapp.musically', label: 'TikTok', iconBase64: '' },
          { packageName: 'com.twitter.android', label: 'X (Twitter)', iconBase64: '' },
          { packageName: 'com.facebook.katana', label: 'Facebook', iconBase64: '' },
          { packageName: 'com.google.android.youtube', label: 'YouTube', iconBase64: '' },
          { packageName: 'com.reddit.frontpage', label: 'Reddit', iconBase64: '' },
        ];
      }

      // Fetch active locked schedules
      const schedules = DB.getSchedules();
      const activePackages = new Set(schedules.filter(s => s.is_enabled).map(s => s.app_package));

      const formatted = installedApps.map(app => ({
        packageName: app.packageName,
        label: app.label,
        iconBase64: app.iconBase64,
        isSelected: activePackages.has(app.packageName),
      })).sort((a, b) => a.label.localeCompare(b.label));

      setApps(formatted);
    } catch (e) {
      console.error("Error loading apps:", e);
    } finally {
      setLoading(false);
    }
  };

  const toggleAppSelection = useCallback((packageName: string) => {
    setApps(prevApps => {
      const updated = prevApps.map(app => {
        if (app.packageName === packageName) {
          const nextSelected = !app.isSelected;
          
          // Update database schedule
          if (nextSelected) {
            DB.addOrUpdateSchedule(packageName, "00:00", "23:59", true);
          } else {
            DB.deleteSchedule(packageName);
          }
          
          return { ...app, isSelected: nextSelected };
        }
        return app;
      });

      // Sync state to native SharedPreferences asynchronously to prevent UI lag
      if (Platform.OS === 'android') {
        setTimeout(() => {
          try {
            const activeState = TouchGrass.getLockState();
            if (activeState.isLocked) {
              const activePackages = updated.filter(a => a.isSelected).map(a => a.packageName).join(',');
              TouchGrass.updateLockState(true, activeState.lockUntil, activePackages);
            }
          } catch (e) {
            console.error("Failed to sync lock state natively:", e);
          }
        }, 10);
      }

      return updated;
    });
  }, []);

  const filteredApps = apps.filter(app => 
    app.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.packageName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedCount = apps.filter(a => a.isSelected).length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>SHIELD LIST</Text>
          <Text style={styles.headerSubtitle}>{selectedCount} APPS BLOCKED</Text>
        </View>
        <Grid color="#FF3B30" size={24} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search color="#888888" size={18} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search installed apps..."
          placeholderTextColor="#555555"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Loading state */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#FF3B30" size="large" />
          <Text style={styles.loadingText}>FETCHING APP REPOSITORIES...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredApps}
          keyExtractor={item => item.packageName}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          updateCellsBatchingPeriod={50}
          renderItem={({ item }) => (
            <AppItem item={item} onSelect={toggleAppSelection} />
          )}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No launcher apps discovered</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
  },
  headerSubtitle: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151515',
    margin: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 14,
    height: '100%',
    fontFamily: 'System',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 15,
    letterSpacing: 1.5,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  appCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  appCardSelected: {
    borderColor: '#FF3B30',
    backgroundColor: '#170E0E',
  },
  appIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
  },
  appIconPlaceholder: {
    width: 42,
    height: 42,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  appLabel: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  appPackage: {
    color: '#666666',
    fontSize: 11,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#333333',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    borderColor: '#FF3B30',
    backgroundColor: '#FF3B30',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    color: '#888888',
    fontSize: 14,
  },
});
