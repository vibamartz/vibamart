import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare,
  Mic,
  Bell,
  MapPin,
  Smartphone,
  Camera,
  User,
  ShieldCheck,
  X
} from 'lucide-react';
import { PushService } from '../../backend/services/pushService';
import { useAuthStore } from '../../backend/store';

interface PermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

const permissions = [
  {
    icon: Camera,
    title: 'Camera & Vision Search',
    description: 'Used for AI visual search, barcode scanning, and defect product return evidence. Requested only when feature is opened.'
  },
  {
    icon: MapPin,
    title: 'Location Services',
    description: 'Used to auto-detect delivery pincodes, estimate shipping times, and verify service availability in your area.'
  },
  {
    icon: Mic,
    title: 'Microphone & Voice Search',
    description: 'Enables hands-free voice product search and voice commands when triggered by user.'
  },
  {
    icon: Bell,
    title: 'Order Notifications',
    description: 'Sends real-time order delivery updates, shipping progress, and instant discount vouchers.'
  },
  {
    icon: Smartphone,
    title: 'Device & Diagnostics',
    description: 'Used for app performance optimization, RAM diagnostics, and secure session management.'
  },
  {
    icon: MessageSquare,
    title: 'SMS OTP Verification',
    description: 'Supported for zero-tap autofill of single-use OTP verification codes during login or checkout.'
  },
  {
    icon: User,
    title: 'Account Security & Biometrics',
    description: 'Fingerprint / Face ID login and secure profile management. ViBa Mart never accesses raw biometric data.'
  }
];

export default function PermissionModal({ isOpen, onClose, onAccept }: PermissionModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto"
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">User Permissions Required</h2>
              <p className="text-sm text-gray-500">Get the best experience by providing permissions. Your data is 100% safe!</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="space-y-6 mb-8">
            {permissions.map((p, i) => (
              <div key={i} className="flex gap-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <p.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">{p.title}</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">{p.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 py-4 font-black border border-gray-200 rounded-2xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
                  try {
                    const res = await Notification.requestPermission();
                    if (res === 'granted') {
                      await PushService.registerDevice(useAuthStore.getState().user?.uid || 'guest');
                    }
                  } catch (e) {
                    console.error('Notification permission request error:', e);
                  }
                } else {
                  await PushService.registerDevice(useAuthStore.getState().user?.uid || 'guest');
                }
                onAccept();
              }}
              className="flex-1 py-4 font-black text-white bg-primary rounded-2xl flex items-center justify-center gap-2 hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all text-sm"
            >
              <ShieldCheck className="w-5 h-5" />
              Allow Access
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
