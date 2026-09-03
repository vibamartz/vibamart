import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Camera, Mic, Bell, ShieldAlert, X } from 'lucide-react';
import ProfessionalErrorState from './ProfessionalErrorState';
import { getPermissionInfo } from '../utils/errorUtils';

interface PermissionPromptModalProps {
  isOpen: boolean;
  type: 'location' | 'camera' | 'microphone' | 'notifications';
  onClose: () => void;
  onAllowAccess: () => void;
  customTitle?: string;
  customDescription?: string;
}

export default function PermissionPromptModal({
  isOpen,
  type,
  onClose,
  onAllowAccess,
  customTitle,
  customDescription
}: PermissionPromptModalProps) {
  if (!isOpen) return null;

  const info = getPermissionInfo(type);
  const title = customTitle || info.title;
  const description = customDescription || info.description;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden p-6 z-10"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <ProfessionalErrorState
            type="permission"
            title={title}
            description={description}
            onAction={() => {
              onAllowAccess();
              onClose();
            }}
            actionText={info.actionText}
            secondaryAction={onClose}
            secondaryActionText="Cancel"
            instructions={info.instructions}
            compact
          />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
