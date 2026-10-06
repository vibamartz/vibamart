import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShieldCheck, CheckCircle2, Clock, Calendar, Wallet, RefreshCw, Sparkles } from 'lucide-react';
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
                <p className="text-xs text-emerald-100/90 font-medium">Monthly Cashback Schedule (0 → 1 → 2 → 3)</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
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
                  <RefreshCw className="w-4 h-4 text-emerald-600 shrink-0" />
                  0 → 1 → 2 → 3 Progress
                </div>
                <p className="text-[11px] text-emerald-950 font-medium">
                  Monthly progress starts at 0 and advances with your first 3 eligible orders.
                </p>
              </div>

              <div className="bg-amber-50/70 border border-amber-200/60 rounded-2xl p-3.5 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-amber-800 font-black text-xs">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  Pending Period
                </div>
                <p className="text-[11px] text-amber-950 font-medium">
                  Cashback remains pending until the product return and cancellation window ends.
                </p>
              </div>

              <div className="bg-blue-50/70 border border-blue-200/60 rounded-2xl p-3.5 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-blue-800 font-black text-xs">
                  <Wallet className="w-4 h-4 text-blue-600 shrink-0" />
                  UPI & Bank Payout
                </div>
                <p className="text-[11px] text-blue-950 font-medium">
                  Eligible cashback is transferred directly through your saved UPI or bank account.
                </p>
              </div>
            </div>

            {/* Program Summary Box */}
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5 mb-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Monthly Cashback Range
                </span>
                <div className="text-2xl sm:text-3xl font-black text-emerald-700">
                  ₹30 – ₹100
                </div>
                <p className="text-[11px] text-gray-600 font-medium mt-0.5">
                  Per eligible order across your first 3 monthly orders
                </p>
              </div>

              <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-emerald-100 shadow-xs">
                <span className="text-xs font-black text-gray-400">Track:</span>
                <span className="text-sm font-black text-emerald-800 tracking-wider">0 → 1 → 2 → 3</span>
              </div>
            </div>

            {/* Detailed Terms */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-900">
                Cashback Terms of Participation
              </h4>
              <div className="space-y-3 pl-1">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <p className="text-xs text-gray-650">
                    <strong className="text-gray-900">First 3 Eligible Orders:</strong> Customers can receive cashback on their first 3 eligible orders placed in each calendar month.
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <p className="text-xs text-gray-650">
                    <strong className="text-gray-900">Monthly Progress (0 → 1 → 2 → 3):</strong> The monthly progress starts from 0 (starting point), advances to 1 on your first completed eligible order, 2 on your second, and 3 on your third completed eligible order.
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <p className="text-xs text-gray-650">
                    <strong className="text-gray-900">Cashback Range & Amount:</strong> The cashback range displayed to customers is ₹30 – ₹100. The actual cashback amount for each eligible order is determined by the current cashback offer and program configuration.
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">4</span>
                  <p className="text-xs text-gray-650">
                    <strong className="text-gray-900">Pending Return Period:</strong> Cashback remains pending until the applicable product return and cancellation period ends for that order.
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">5</span>
                  <p className="text-xs text-gray-650">
                    <strong className="text-gray-900">Cancelled or Returned Orders:</strong> Cancelled, returned, or otherwise ineligible orders do not qualify for finalized cashback according to the existing eligibility rules.
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">6</span>
                  <p className="text-xs text-gray-650">
                    <strong className="text-gray-900">Payout Transfer:</strong> Once eligible, cashback can be transferred through the customer's available UPI or bank-transfer payout method.
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">7</span>
                  <p className="text-xs text-gray-650">
                    <strong className="text-gray-900">Automatic Monthly Reset:</strong> At the beginning of every new calendar month (1st of each month), the cashback progress automatically resets to 0.
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">8</span>
                  <p className="text-xs text-gray-650">
                    <strong className="text-gray-900">Monthly Limit:</strong> After reaching 3 eligible orders in a month, no additional first-three-order cashback is earned for that month. The program starts again from 0 in the next calendar month.
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">9</span>
                  <p className="text-xs text-gray-650">
                    <strong className="text-gray-900">Cashback History:</strong> Cashback history remains permanently accessible to the customer in their account.
                  </p>
                </div>
              </div>
            </div>

            {/* Custom Terms if configured */}
            {config.termsAndConditions && config.termsAndConditions !== '' && (
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
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
            >
              I Understand
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

