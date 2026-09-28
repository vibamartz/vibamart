export type CapabilityId =
  | 'camera'
  | 'location'
  | 'microphone'
  | 'notifications'
  | 'network'
  | 'contacts'
  | 'sms'
  | 'deviceInfo'
  | 'storageMedia'
  | 'bluetooth'
  | 'biometrics'
  | 'vibration'
  | 'audio'
  | 'backgroundTasks'
  | 'foregroundServices'
  | 'appShortcuts'
  | 'googleServices'
  | 'advertising'
  | 'deviceCapabilities'
  | 'appSecurity';

export type PermissionState =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'permanently_denied'
  | 'restricted'
  | 'not_applicable';

export interface AndroidCapability {
  id: CapabilityId;
  name: string;
  category: 'hardware' | 'system' | 'privacy' | 'network' | 'security' | 'engagement';
  androidPermission?: string[];
  description: string;
  rationale: string;
  isHardwareAvailable: boolean;
  isSupportedByPlatform: boolean;
  permissionState: PermissionState;
  featureEnabledByAdmin: boolean;
  iconName: string;
  subFeatures: string[];
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  area?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  address?: string;
}

export interface DeviceDiagnostics {
  platform: string;
  userAgent: string;
  appVersion: string;
  online: boolean;
  networkType?: string;
  downlinkSpeed?: number;
  batteryLevel?: number;
  batteryCharging?: boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  maxTouchPoints?: number;
  screenResolution: string;
  isBiometricSupported: boolean;
  isCameraSupported: boolean;
  isMicSupported: boolean;
  isBluetoothSupported: boolean;
  isVibrationSupported: boolean;
}

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  credentialId?: string;
}
