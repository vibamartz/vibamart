import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShieldCheck, CheckCircle2, Clock, Calendar, Wallet } from 'lucide-react';
import { useCashbackStore } from '../../backend/store';

interface CashbackTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CashbackTermsModal({ isOpen, onClose }: CashbackTermsModalProps) {
  const { config } = useCashbackStore();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative bg-white w-full max-w-2xl rounded-3xl sm:rounded-[32px] shadow-2xl border border-emerald-100 overflow-hidden z-10 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 p-5 sm:p-6 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20">
                <ShieldCheck className="w-6 h-6 text-emerald-200" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black tracking-tight">Terms & Conditions</h3>
                <p className="text-xs text-emerald-100/90 font-medium">Monthly Cashback Program</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Body */}
          <div className="p-5 sm:p-7 overflow-y-auto space-y-6 text-gray-700 text-xs sm:text-sm leading-relaxed">
            {/* Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-2xl p-3.5 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-emerald-800 font-black text-xs">
                  <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                  Monthly Reset
                </div>
                <p className="text-[11px] text-emerald-950 font-medium">
                  Monthly progress starts again from 0 at the beginning of each new calendar month.
                </p>
              </div>

              <div className="bg-amber-50/70 border border-amber-200/60 rounded-2xl p-3.5 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-amber-800 font-black text-xs">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  Pending Period
                </div>
                <p className="text-[11px] text-amber-950 font-medium">
                  Cashback remains pending until the applicable product return/cancellation period ends.
                </p>
              </div>

              <div className="bg-blue-50/70 border border-blue-200/60 rounded-2xl p-3.5 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-blue-800 font-black text-xs">
                  <Wallet className="w-4 h-4 text-blue-600 shrink-0" />
                  Direct Transfer
                </div>
                <p className="text-[11px] text-blue-950 font-medium">
                  Eligible cashback can be transferred to your registered UPI or bank account.
                </p>
              </div>
            </div>

            {/* Program Summary Card */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 space-y-2.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Monthly Cashback Rewards
              </h4>
              <div className="space-y-1 text-xs font-bold text-emerald-950 pl-1">
                <p>• 1st Eligible Order: ₹30 - ₹100 Cashback</p>
                <p>• 2nd Eligible Order: ₹30 - ₹100 Cashback</p>
                <p>• 3rd Eligible Order: ₹30 - ₹100 Cashback</p>
              </div>
            </div>

            {/* Detailed Clauses */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-900">
                Detailed Terms of Participation
              </h4>
              <div className="space-y-3 pl-1">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <p className="text-xs text-gray-650">
                    <strong className="text-gray-900">First 3 Eligible Orders:</strong> Customers can receive cashback on their first 3 eligible orders of each calendar month.
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <div className="text-xs text-gray-650 space-y-1">
                    <strong className="text-gray-900 block">Eligible Orders Cashback:</strong>
                    <p className="font-semibold text-gray-800">• 1st Eligible Order: ₹30 - ₹100 Cashback</p>
                    <p className="font-semibold text-gray-800">• 2nd Eligible Order: ₹30 - ₹100 Cashback</p>
                    <p className="font-semibold text-gray-800">• 3rd Eligible Order: ₹30 - ₹100 Cashback</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <p className="text-xs text-gray-650">
                    <strong className="text-gray-900">Progress Tracking (0 → 1 → 2 → 3):</strong> Monthly progress is tracked as 0 → 1 → 2 → 3 upon placing eligible orders.
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">4</span>
                  <p className="text-xs text-gray-650">
                    <strong className="text-gray-900">Automatic Monthly Reset:</strong> The monthly progress starts again from 0 at the beginning of each new calendar month.
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">5</span>
                  <p className="text-xs text-gray-650">
                    <strong className="text-gray-900">Pending Return/Cancellation Window:</strong> Cashback remains pending until the applicable product return/cancellation period has ended.
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">6</span>
                  <p className="text-xs text-gray-650">
                    <strong className="text-gray-900">Ineligible / Cancelled Orders:</strong> Cancelled, returned, or otherwise ineligible orders do not receive finalized cashback according to the existing eligibility rules.
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">7</span>
                  <p className="text-xs text-gray-650">
                    <strong className="text-gray-900">Transfer Methods:</strong> Eligible cashback can be transferred to the customer's UPI or bank account.
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">8</span>
                  <p className="text-xs text-gray-650">
                    <strong className="text-gray-900">Permanent Cashback History:</strong> Cashback history remains available to the customer. Previous months' cashback history is not deleted when the new month begins.
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">9</span>
                  <p className="text-xs text-gray-650">
                    <strong className="text-gray-900">Program Conditions:</strong> All cashback eligibility and payout conditions are controlled by the existing cashback system.
                  </p>
                </div>
              </div>
            </div>

            {/* Custom Terms if configured */}
            {config.termsAndConditions && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-[11px] text-gray-500 whitespace-pre-line bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                  {config.termsAndConditions}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-5 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95"
            >
              I Understand
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
