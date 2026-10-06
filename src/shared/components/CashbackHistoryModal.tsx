import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Wallet, CheckCircle2, Clock, Calendar, ArrowRight,
  CreditCard, ShieldCheck, AlertCircle, Sparkles, ChevronRight,
  TrendingUp, Building2, User, Hash, Check
} from 'lucide-react';
import { useCashbackStore, useAuthStore, getMonthKey } from '../../backend/store';
import { CustomerPayoutInfo } from '../types';
import toast from 'react-hot-toast';

interface CashbackHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'history' | 'payout_settings';
}

export default function CashbackHistoryModal({ isOpen, onClose, defaultTab = 'history' }: CashbackHistoryModalProps) {
  const { records, payoutInfo, savePayoutInfo, config } = useCashbackStore();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'history' | 'payout_settings'>(defaultTab);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // Payout form state
  const [payoutType, setPayoutType] = useState<'upi' | 'bank'>(payoutInfo?.payoutType || 'upi');
  const [upiId, setUpiId] = useState(payoutInfo?.upiId || '');
  const [accountHolderName, setAccountHolderName] = useState(payoutInfo?.accountHolderName || user?.displayName || '');
  const [accountNumber, setAccountNumber] = useState(payoutInfo?.accountNumber || '');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState(payoutInfo?.accountNumber || '');
  const [ifscCode, setIfscCode] = useState(payoutInfo?.ifscCode || '');
  const [bankName, setBankName] = useState(payoutInfo?.bankName || '');
  const [isSaving, setIsSaving] = useState(false);

  // Sync form when payoutInfo changes
  React.useEffect(() => {
    if (payoutInfo) {
      setPayoutType(payoutInfo.payoutType || 'upi');
      setUpiId(payoutInfo.upiId || '');
      setAccountHolderName(payoutInfo.accountHolderName || user?.displayName || '');
      setAccountNumber(payoutInfo.accountNumber || '');
      setConfirmAccountNumber(payoutInfo.accountNumber || '');
      setIfscCode(payoutInfo.ifscCode || '');
      setBankName(payoutInfo.bankName || '');
    }
  }, [payoutInfo, user]);

  // Unique months from records
  const availableMonths = useMemo(() => {
    const monthsMap = new Map<string, string>();
    const currentMonth = getMonthKey();
    monthsMap.set(currentMonth.key, currentMonth.name);

    records.forEach(r => {
      if (r.monthKey && r.monthName) {
        monthsMap.set(r.monthKey, r.monthName);
      }
    });

    return Array.from(monthsMap.entries()).map(([key, name]) => ({ key, name }));
  }, [records]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    if (selectedMonth === 'all') return records;
    return records.filter(r => r.monthKey === selectedMonth);
  }, [records, selectedMonth]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalEarned = records.reduce((sum, r) => sum + (r.status === 'paid' ? r.amount : 0), 0);
    const pendingAmount = records.reduce((sum, r) => sum + (r.status === 'pending' || r.status === 'eligible' ? r.amount : 0), 0);
    const totalOrdersRewarded = records.filter(r => r.status !== 'failed').length;
    return { totalEarned, pendingAmount, totalOrdersRewarded };
  }, [records]);

  const handleSavePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please sign in to save your payout details');
      return;
    }

    if (payoutType === 'upi') {
      const cleanUpi = upiId.trim();
      if (!cleanUpi || !cleanUpi.includes('@')) {
        toast.error('Please enter a valid UPI ID (e.g. mobile@upi or name@okaxis)');
        return;
      }
    } else {
      if (!accountHolderName.trim()) {
        toast.error('Please enter the Account Holder Name');
        return;
      }
      if (!accountNumber.trim() || accountNumber.length < 8) {
        toast.error('Please enter a valid Bank Account Number');
        return;
      }
      if (accountNumber !== confirmAccountNumber) {
        toast.error('Account numbers do not match');
        return;
      }
      if (!ifscCode.trim() || ifscCode.length < 5) {
        toast.error('Please enter a valid Bank IFSC Code');
        return;
      }
    }

    setIsSaving(true);
    const payload: CustomerPayoutInfo = {
      payoutType,
      upiId: payoutType === 'upi' ? upiId.trim() : undefined,
      accountHolderName: accountHolderName.trim(),
      accountNumber: payoutType === 'bank' ? accountNumber.trim() : undefined,
      ifscCode: payoutType === 'bank' ? ifscCode.trim().toUpperCase() : undefined,
      bankName: payoutType === 'bank' ? bankName.trim() : undefined,
    };

    const res = await savePayoutInfo(user.uid, payload);
    setIsSaving(false);
    if (res.success) {
      toast.success(res.message);
      setActiveTab('history');
    } else {
      toast.error(res.message);
    }
  };

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
          className="relative bg-white w-full max-w-3xl rounded-3xl sm:rounded-[32px] shadow-2xl border border-emerald-100 overflow-hidden z-10 flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 p-5 sm:p-6 text-white shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20">
                  <Wallet className="w-6 h-6 text-emerald-200" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black tracking-tight">Cashback Rewards & History</h3>
                  <p className="text-xs text-emerald-100/90 font-medium">Monthly First 3 Orders Program</p>
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

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4 pt-4 border-t border-white/15">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 border border-white/10">
                <span className="text-[10px] text-emerald-100 uppercase tracking-wider font-bold block">Cashback Paid</span>
                <span className="text-sm sm:text-lg font-black text-white">₹{metrics.totalEarned}</span>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 border border-white/10">
                <span className="text-[10px] text-emerald-100 uppercase tracking-wider font-bold block">Pending / Eligible</span>
                <span className="text-sm sm:text-lg font-black text-white">₹{metrics.pendingAmount}</span>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 border border-white/10">
                <span className="text-[10px] text-emerald-100 uppercase tracking-wider font-bold block">Orders Rewarded</span>
                <span className="text-sm sm:text-lg font-black text-white">{metrics.totalOrdersRewarded} Orders</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  activeTab === 'history'
                    ? 'bg-white text-emerald-800 shadow-md'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                Cashback History
              </button>
              <button
                onClick={() => setActiveTab('payout_settings')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                  activeTab === 'payout_settings'
                    ? 'bg-white text-emerald-800 shadow-md'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                Payout Account {payoutInfo?.upiId || payoutInfo?.accountNumber ? '✓' : ''}
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
            {activeTab === 'history' ? (
              <>
                {/* Month Filter Bar */}
                <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-black uppercase text-gray-700 tracking-wider">Select Month:</span>
                  </div>

                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-gray-50 border border-gray-200 text-gray-800 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="all">All Months</option>
                    {availableMonths.map(m => (
                      <option key={m.key} value={m.key}>{m.name}</option>
                    ))}
                  </select>
                </div>

                {/* Payout Details Notice Banner */}
                {!payoutInfo?.upiId && !payoutInfo?.accountNumber && (
                  <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                      <div>
                        <p className="text-xs font-black text-amber-900">Add Your Payout Details</p>
                        <p className="text-[11px] text-amber-750 font-medium">Save your UPI ID or Bank account to receive eligible cashback seamlessly.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('payout_settings')}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black rounded-xl shrink-0 transition-all"
                    >
                      Add Now
                    </button>
                  </div>
                )}

                {/* Cashback Records List */}
                {filteredRecords.length === 0 ? (
                  <div className="text-center py-12 px-4 space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                      <Sparkles className="w-7 h-7" />
                    </div>
                    <h4 className="text-base font-black text-gray-900">No Cashback Records Yet</h4>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                      Place your first 3 eligible orders this calendar month to unlock up to ₹{config.firstOrderAmount + config.secondOrderAmount + config.thirdOrderAmount} cashback!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredRecords.map((record) => {
                      const isPaid = record.status === 'paid';
                      const isEligible = record.status === 'eligible';
                      const isPending = record.status === 'pending';
                      const isFailed = record.status === 'failed';

                      return (
                        <div
                          key={record.id}
                          className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs hover:shadow-sm transition-all space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 text-[10px] font-black uppercase tracking-wider">
                                  {record.position === 1 ? '1st Order of Month' : record.position === 2 ? '2nd Order of Month' : '3rd Order of Month'}
                                </span>
                                <span className="text-[11px] text-gray-400 font-bold">{record.monthName}</span>
                              </div>
                              <h5 className="text-xs font-black text-gray-900">
                                Order #{record.customOrderId || record.orderId.slice(-8).toUpperCase()}
                              </h5>
                              <p className="text-[11px] text-gray-500 font-medium">
                                Placed on {new Date(record.orderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            </div>

                            <div className="text-right">
                              <span className="text-base sm:text-lg font-black text-emerald-600 block">
                                +₹{record.amount}
                              </span>
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cashback</span>
                            </div>
                          </div>

                          {/* Status Badge & Details */}
                          <div className="pt-2 border-t border-gray-50 flex flex-wrap items-center justify-between gap-2">
                            {isPaid && (
                              <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl text-[11px] font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Paid to Account {record.payoutDate ? `on ${new Date(record.payoutDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}</span>
                                {record.payoutReference && (
                                  <span className="text-[10px] text-gray-500 font-mono font-normal">({record.payoutReference})</span>
                                )}
                              </div>
                            )}

                            {isEligible && (
                              <div className="flex items-center gap-1.5 text-blue-700 bg-blue-50 px-2.5 py-1 rounded-xl text-[11px] font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                                <span>Eligible • Payout in Progress</span>
                              </div>
                            )}

                            {isPending && (
                              <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-xl text-[11px] font-bold">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                <span>Pending Return Window</span>
                              </div>
                            )}

                            {isFailed && (
                              <div className="flex items-center gap-1.5 text-rose-700 bg-rose-50 px-2.5 py-1 rounded-xl text-[11px] font-bold">
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                                <span>Ineligible (Order Cancelled/Returned)</span>
                              </div>
                            )}

                            {isPending && (
                              <span className="text-[10px] text-gray-400 font-medium italic">
                                Verification ends around {new Date(record.returnPeriodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              /* Payout Account Form */
              <form onSubmit={handleSavePayout} className="space-y-5">
                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 space-y-1">
                  <h4 className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Secure Payout Account
                  </h4>
                  <p className="text-[11px] text-emerald-800 leading-relaxed font-medium">
                    Your cashback earnings will be transferred directly to this account once verified. You can update this at any time.
                  </p>
                </div>

                {/* Payout Type Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-wider text-gray-700">Choose Payout Method</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPayoutType('upi')}
                      className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                        payoutType === 'upi'
                          ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${payoutType === 'upi' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                        UPI
                      </div>
                      <div>
                        <p className="text-xs font-black text-gray-900">UPI ID</p>
                        <p className="text-[10px] text-gray-500 font-medium">Google Pay, PhonePe, Paytm</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPayoutType('bank')}
                      className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                        payoutType === 'bank'
                          ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${payoutType === 'bank' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-gray-900">Bank Transfer</p>
                        <p className="text-[10px] text-gray-500 font-medium">Direct NEFT/IMPS Transfer</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* UPI Fields */}
                {payoutType === 'upi' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-gray-800 block mb-1">
                        UPI ID (Virtual Payment Address) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. yourname@okhdfcbank or 9876543210@paytm"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        required
                      />
                      <p className="text-[10px] text-gray-400 font-medium mt-1">Make sure the UPI ID is active and linked to your bank account.</p>
                    </div>
                  </div>
                ) : (
                  /* Bank Fields */
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-gray-800 block mb-1">
                        Account Holder Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="As shown on your bank passbook"
                        value={accountHolderName}
                        onChange={(e) => setAccountHolderName(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-gray-800 block mb-1">
                          Bank Account Number <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="password"
                          placeholder="Enter account number"
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-gray-800 block mb-1">
                          Confirm Account Number <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Re-enter account number"
                          value={confirmAccountNumber}
                          onChange={(e) => setConfirmAccountNumber(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-gray-800 block mb-1">
                          IFSC Code <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. HDFC0001234"
                          value={ifscCode}
                          onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-gray-900 uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-gray-800 block mb-1">
                          Bank Name (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. HDFC Bank, SBI, ICICI"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    {isSaving ? 'Saving...' : 'Save Payout Details'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
