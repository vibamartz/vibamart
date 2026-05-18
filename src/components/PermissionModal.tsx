import React, { useState } from 'react';
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

interface PermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

const permissions = [
  {
    icon: MessageSquare,
    title: 'SMS',
    description: 'We collect, monitor and transmit to our servers only your SMSs data which helps us in identifying various bank accounts, cash flow patterns, description, and amount of the transactions for credit risk assessment.'
  },
  {
    icon: Mic,
    title: 'Microphone',
    description: 'Permission access for microphone is required to initiate voice commands and search.'
  },
  {
    icon: Bell,
    title: 'Notification',
    description: 'Permission to access notifications is required to receive product updates, alerts, and promotional communications.'
  },
  {
    icon: MapPin,
    title: 'Location',
    description: 'Required to assess your location for localized services and delivery.'
  },
  {
    icon: Smartphone,
    title: 'Device',
    description: 'Collected for security purposes, including device hardware model, OS, RAM, Storage, and unique identifiers like IMEI/Serial to prevent fraud.'
  },
  {
    icon: Camera,
    title: 'Camera',
    description: 'Permission to access Camera is required to easily scan or capture documents for a seamless experience.'
  },
  {
    icon: User,
    title: 'User Personal Information',
    description: 'Required to collect user account data (email, name, photo) for login and mobile number verification.'
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
              onClick={onAccept}
              className="flex-1 py-4 font-black text-white bg-primary rounded-2xl flex items-center justify-center gap-2 hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all"
            >
              <ShieldCheck className="w-5 h-5" />
              Accept All
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
