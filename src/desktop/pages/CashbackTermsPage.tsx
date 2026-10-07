import React from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, CheckCircle2, Clock, Calendar, Wallet, ArrowLeft, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCashbackStore } from '../../backend/store';

export default function CashbackTermsPage() {
  const { config } = useCashbackStore();
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 py-4 sm:py-8 px-3 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        
        {/* Header Banner */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 rounded-3xl p-5 sm:p-8 text-white shadow-xl border border-emerald-500/30"
        >
          {/* Top Bar with Back Button */}
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/15">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md transition-all active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 text-white text-xs font-bold rounded-full border border-white/25 backdrop-blur-md">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" />
              <span>Official Program Terms</span>
            </span>
          </div>

          <div className="pt-4 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shrink-0">
              <ShieldCheck className="w-7 h-7 text-emerald-200" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white">
                Terms & Conditions
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/90 font-medium mt-0.5">
                Monthly Cashback Rewards Program
              </p>
            </div>
          </div>
        </motion.div>

        {/* Content Body */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-3xl p-5 sm:p-8 shadow-xl border border-gray-100 space-y-6 text-gray-700 text-xs sm:text-sm leading-relaxed"
        >
          {/* Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-emerald-50/80 border border-emerald-200/70 rounded-2xl p-4 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-emerald-800 font-black text-xs sm:text-sm">
                <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                Monthly Reset
              </div>
              <p className="text-xs text-emerald-950 font-medium">
                Monthly progress starts again from 0 at the beginning of each new calendar month.
              </p>
            </div>

            <div className="bg-amber-50/80 border border-amber-200/70 rounded-2xl p-4 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-amber-800 font-black text-xs sm:text-sm">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                Pending Period
              </div>
              <p className="text-xs text-amber-950 font-medium">
                Cashback remains pending until the applicable product return/cancellation period ends.
              </p>
            </div>

            <div className="bg-blue-50/80 border border-blue-200/70 rounded-2xl p-4 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-blue-800 font-black text-xs sm:text-sm">
                <Wallet className="w-4 h-4 text-blue-600 shrink-0" />
                Direct Transfer
              </div>
              <p className="text-xs text-blue-950 font-medium">
                Eligible cashback can be transferred directly to your registered UPI or bank account.
              </p>
            </div>
          </div>

          {/* Program Summary Card */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Monthly Cashback Rewards
            </h3>
            <div className="space-y-1.5 text-xs sm:text-sm font-bold text-emerald-950 pl-1">
              <p>• 1st Eligible Order: ₹30 - ₹100 Cashback</p>
              <p>• 2nd Eligible Order: ₹30 - ₹100 Cashback</p>
              <p>• 3rd Eligible Order: ₹30 - ₹100 Cashback</p>
            </div>
          </div>

          {/* Detailed Clauses */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-gray-900 border-b border-gray-100 pb-3">
              Detailed Terms of Participation
            </h3>
            <div className="space-y-4 pl-1">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">1</span>
                <p className="text-xs sm:text-sm text-gray-700">
                  <strong className="text-gray-900 font-black">First 3 Eligible Orders:</strong> Customers can receive cashback on their first 3 eligible orders of each calendar month.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">2</span>
                <div className="text-xs sm:text-sm text-gray-700 space-y-1">
                  <strong className="text-gray-900 font-black block">Eligible Orders Cashback:</strong>
                  <p className="font-semibold text-gray-800">• 1st Eligible Order: ₹30 - ₹100 Cashback</p>
                  <p className="font-semibold text-gray-800">• 2nd Eligible Order: ₹30 - ₹100 Cashback</p>
                  <p className="font-semibold text-gray-800">• 3rd Eligible Order: ₹30 - ₹100 Cashback</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">3</span>
                <p className="text-xs sm:text-sm text-gray-700">
                  <strong className="text-gray-900 font-black">Progress Tracking (0 → 1 → 2 → 3):</strong> Monthly progress is tracked as 0 → 1 → 2 → 3 upon placing eligible orders.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">4</span>
                <p className="text-xs sm:text-sm text-gray-700">
                  <strong className="text-gray-900 font-black">Automatic Monthly Reset:</strong> The monthly progress starts again from 0 at the beginning of each new calendar month.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">5</span>
                <p className="text-xs sm:text-sm text-gray-700">
                  <strong className="text-gray-900 font-black">Pending Return/Cancellation Window:</strong> Cashback remains pending until the applicable product return/cancellation period has ended.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">6</span>
                <p className="text-xs sm:text-sm text-gray-700">
                  <strong className="text-gray-900 font-black">Ineligible / Cancelled Orders:</strong> Cancelled, returned, or otherwise ineligible orders do not receive finalized cashback according to the existing eligibility rules.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">7</span>
                <p className="text-xs sm:text-sm text-gray-700">
                  <strong className="text-gray-900 font-black">Transfer Methods:</strong> Eligible cashback can be transferred to the customer's UPI or bank account.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">8</span>
                <p className="text-xs sm:text-sm text-gray-700">
                  <strong className="text-gray-900 font-black">Permanent Cashback History:</strong> Cashback history remains available to the customer. Previous months' cashback history is not deleted when the new month begins.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">9</span>
                <p className="text-xs sm:text-sm text-gray-700">
                  <strong className="text-gray-900 font-black">Program Conditions:</strong> All cashback eligibility and payout conditions are controlled by the existing cashback system.
                </p>
              </div>
            </div>
          </div>

          {/* Custom Terms if configured in Admin */}
          {config.termsAndConditions && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-500 whitespace-pre-line bg-gray-50 p-4 rounded-2xl border border-gray-100 leading-relaxed">
                {config.termsAndConditions}
              </p>
            </div>
          )}

          {/* Bottom Actions */}
          <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => navigate('/cashback-history')}
              className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700 hover:text-emerald-800"
            >
              View My Cashback History <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleBack}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95"
            >
              Back to Store
            </button>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
