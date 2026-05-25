import { requireNativeModule } from 'expo-modules-core';

const TouchGrassModule = requireNativeModule('TouchGrassModule');

export interface InstalledApp {
  packageName: string;
  label: string;
  iconBase64: string;
}

export interface LockState {
  isLocked: boolean;
  lockUntil: number;
  blockedPackages: string;
}

export function isAccessibilityServiceEnabled(): boolean {
  return TouchGrassModule.isAccessibilityServiceEnabled();
}

export function openAccessibilitySettings(): void {
  TouchGrassModule.openAccessibilitySettings();
}

export function isOverlayPermissionGranted(): boolean {
  return TouchGrassModule.isOverlayPermissionGranted();
}

export function openOverlaySettings(): void {
  TouchGrassModule.openOverlaySettings();
}

export function isAutoTimeEnabled(): boolean {
  if (TouchGrassModule && typeof TouchGrassModule.isAutoTimeEnabled === 'function') {
    return TouchGrassModule.isAutoTimeEnabled();
  }
  return true;
}

export function updateLockState(isLocked: boolean, lockUntilMs: number, blockedPackages: string): void {
  TouchGrassModule.updateLockState(isLocked, lockUntilMs, blockedPackages);
}

export function updateGlobalLockSettings(enabled: boolean, start: string, end: string): void {
  if (TouchGrassModule && typeof TouchGrassModule.updateGlobalLockSettings === 'function') {
    TouchGrassModule.updateGlobalLockSettings(enabled, start, end);
  } else {
    console.warn("updateGlobalLockSettings is not available in the current native build. Please rebuild your development client APK.");
  }
}

export function getLockState(): LockState {
  return TouchGrassModule.getLockState();
}

export function getActiveBlockedPackage(): string {
  return TouchGrassModule.getActiveBlockedPackage();
}

export function clearActiveBlockedPackage(): void {
  TouchGrassModule.clearActiveBlockedPackage();
}

export function getInstalledApps(): InstalledApp[] {
  return TouchGrassModule.getInstalledApps();
}

export function exitToHomeScreen(): void {
  TouchGrassModule.exitToHomeScreen();
}
