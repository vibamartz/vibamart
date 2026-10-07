import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Wallet, CheckCircle2, Clock, Calendar, ArrowLeft,
  CreditCard, ShieldCheck, AlertCircle, Sparkles,
  Building2, ChevronRight, RefreshCw, ArrowRight
} from 'lucide-react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useCashbackStore, useAuthStore, getMonthKey } from '../../backend/store';
import { CustomerPayoutInfo } from '../../shared/types';
import toast from 'react-hot-toast';

interface CashbackHistoryPageProps {
  defaultTab?: 'history' | 'payout_settings';
}

export default function CashbackHistoryPage({ defaultTab = 'history' }: CashbackHistoryPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') as 'history' | 'payout_settings' | null;
  const initialTab = urlTab === 'payout_settings' || defaultTab === 'payout_settings' ? 'payout_settings' : 'history';

  const { records, payoutInfo, savePayoutInfo, config, initCashback } = useCashbackStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'history' | 'payout_settings'>(initialTab);
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

  // Sync tab with URL query parameter
  useEffect(() => {
    if (urlTab === 'payout_settings' || urlTab === 'history') {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  // Init store if user is logged in
  useEffect(() => {
    const unsub = initCashback(user?.uid, user?.role);
    return () => {
      if (unsub) unsub();
    };
  }, [user?.uid, user?.role]);

  // Sync form when payoutInfo changes
  useEffect(() => {
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

  const handleTabChange = (tab: 'history' | 'payout_settings') => {
    setActiveTab(tab);
    setSearchParams(tab === 'history' ? {} : { tab });
  };

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
      navigate('/login');
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
      handleTabChange('history');
    } else {
      toast.error(res.message);
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  if (!user) {
    return (
      <div className="min-h-[80vh] bg-gray-50/50 py-8 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-gray-100 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <Wallet className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-gray-900">Sign in to View Cashback</h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            Please log in to track your monthly cashback schedule, completed payouts, and UPI / bank settings.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg transition-all active:scale-95"
          >
            Login / Sign Up
          </button>
          <div>
            <button
              onClick={handleBack}
              className="text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors"
            >
              ← Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 py-4 sm:py-8 px-3 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        
        {/* Top Header Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 rounded-3xl p-5 sm:p-7 text-white shadow-xl border border-emerald-500/30"
        >
          {/* Top Bar with Back Button and Terms Link */}
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/15">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md transition-all active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <Link
              to="/terms"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md transition-all"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-200" />
              <span>Terms & Conditions</span>
            </Link>
          </div>

          {/* Main Title Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shrink-0">
                <Wallet className="w-6 h-6 text-emerald-200" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white">
                  Monthly Cashback Rewards
                </h1>
                <p className="text-xs sm:text-sm text-emerald-100/90 font-medium">
                  Earn ₹30 – ₹100 on your first 3 eligible orders every month
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 text-white text-xs font-bold rounded-full border border-white/25 backdrop-blur-md">
              <RefreshCw className="w-3.5 h-3.5 text-white" />
              <span>Resets 1st of every month</span>
            </div>
          </div>

          {/* Metrics Overview Bar */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-5 pt-4 border-t border-white/15">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 sm:p-4 border border-white/10">
              <span className="text-[10px] sm:text-xs text-emerald-100 uppercase tracking-wider font-bold block">
                Cashback Paid
              </span>
              <span className="text-base sm:text-2xl font-black text-white">
                ₹{metrics.totalEarned}
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 sm:p-4 border border-white/10">
              <span className="text-[10px] sm:text-xs text-emerald-100 uppercase tracking-wider font-bold block">
                Pending / Eligible
              </span>
              <span className="text-base sm:text-2xl font-black text-white">
                ₹{metrics.pendingAmount}
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 sm:p-4 border border-white/10">
              <span className="text-[10px] sm:text-xs text-emerald-100 uppercase tracking-wider font-bold block">
                Orders Rewarded
              </span>
              <span className="text-base sm:text-2xl font-black text-white">
                {metrics.totalOrdersRewarded} Orders
              </span>
            </div>
          </div>

          {/* Page Tabs */}
          <div className="flex gap-2 mt-5">
            <button
              onClick={() => handleTabChange('history')}
              className={`px-4 sm:px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'history'
                  ? 'bg-white text-emerald-900 shadow-md'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Cashback History
            </button>
            <button
              onClick={() => handleTabChange('payout_settings')}
              className={`px-4 sm:px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === 'payout_settings'
                  ? 'bg-white text-emerald-900 shadow-md'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Payout Account {payoutInfo?.upiId || payoutInfo?.accountNumber ? '✓' : ''}
            </button>
          </div>
        </motion.div>

        {/* Main Content Area */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-3xl p-4 sm:p-8 shadow-xl border border-gray-100 space-y-6"
        >
          {activeTab === 'history' ? (
            <>
              {/* Month Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-black uppercase text-gray-700 tracking-wider">
                    Select Filter:
                  </span>
                </div>

                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-gray-50 border border-gray-200 text-gray-800 text-xs sm:text-sm font-bold rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">All Months (Complete History)</option>
                  {availableMonths.map(m => (
                    <option key={m.key} value={m.key}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* Payout Details Notice Banner */}
              {!payoutInfo?.upiId && !payoutInfo?.accountNumber && (
                <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-black text-amber-900">Add Your Payout Details</p>
                      <p className="text-xs text-amber-750 font-medium">
                        Save your UPI ID or Bank account to receive eligible cashback transfers directly.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleTabChange('payout_settings')}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shrink-0 transition-all shadow-sm active:scale-95"
                  >
                    Add Account Now
                  </button>
                </div>
              )}

              {/* Cashback Records List */}
              {filteredRecords.length === 0 ? (
                <div className="text-center py-16 px-4 space-y-4">
                  <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base sm:text-lg font-black text-gray-900">No Cashback Records Found</h4>
                    <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto">
                      Place your first 3 eligible orders this calendar month to receive automatic cashback transfers!
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/')}
                    className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95"
                  >
                    Start Shopping <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {filteredRecords.map((record) => {
                    const isPaid = record.status === 'paid';
                    const isEligible = record.status === 'eligible';
                    const isPending = record.status === 'pending';
                    const isFailed = record.status === 'failed';

                    return (
                      <div
                        key={record.id}
                        className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-xs hover:shadow-md transition-all space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 text-[10px] sm:text-xs font-black uppercase tracking-wider">
                                {record.position === 1 ? '1st Order of Month' : record.position === 2 ? '2nd Order of Month' : '3rd Order of Month'}
                              </span>
                              <span className="text-xs text-gray-400 font-bold">{record.monthName}</span>
                            </div>
                            <h5 className="text-xs sm:text-sm font-black text-gray-900">
                              Order #{record.customOrderId || record.orderId.slice(-8).toUpperCase()}
                            </h5>
                            <p className="text-xs text-gray-500 font-medium">
                              Placed on {new Date(record.orderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-lg sm:text-xl font-black text-emerald-600 block">
                              +₹{record.amount}
                            </span>
                            <span className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">Cashback</span>
                          </div>
                        </div>

                        {/* Status Details */}
                        <div className="pt-3 border-t border-gray-50 flex flex-wrap items-center justify-between gap-2">
                          {isPaid && (
                            <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl text-xs font-bold">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>Paid to Account {record.payoutDate ? `on ${new Date(record.payoutDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}</span>
                              {record.payoutReference && (
                                <span className="text-[11px] text-gray-500 font-mono font-normal">({record.payoutReference})</span>
                              )}
                            </div>
                          )}

                          {isEligible && (
                            <div className="flex items-center gap-1.5 text-blue-700 bg-blue-50 px-3 py-1 rounded-xl text-xs font-bold">
                              <CheckCircle2 className="w-4 h-4 text-blue-600" />
                              <span>Eligible • Payout in Progress</span>
                            </div>
                          )}

                          {isPending && (
                            <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-3 py-1 rounded-xl text-xs font-bold">
                              <Clock className="w-4 h-4 text-amber-600" />
                              <span>Pending Return Window</span>
                            </div>
                          )}

                          {isFailed && (
                            <div className="flex items-center gap-1.5 text-rose-700 bg-rose-50 px-3 py-1 rounded-xl text-xs font-bold">
                              <AlertCircle className="w-4 h-4 text-rose-600" />
                              <span>Ineligible (Order Cancelled/Returned)</span>
                            </div>
                          )}

                          {isPending && (
                            <span className="text-[11px] text-gray-400 font-medium italic">
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
            <form onSubmit={handleSavePayout} className="space-y-6">
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 space-y-1.5">
                <h4 className="text-xs sm:text-sm font-black text-emerald-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  Secure Payout Account Details
                </h4>
                <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                  Your monthly cashback rewards will be transferred directly to this account once your orders pass the return verification window. You can modify these details anytime.
                </p>
              </div>

              {/* Payout Type Selection */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-gray-700">Choose Payout Method</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPayoutType('upi')}
                    className={`p-4 rounded-2xl border text-left flex items-center gap-3.5 transition-all ${
                      payoutType === 'upi'
                        ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${payoutType === 'upi' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      UPI
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-black text-gray-900">UPI ID</p>
                      <p className="text-[11px] text-gray-500 font-medium">Google Pay, PhonePe, Paytm, BHIM</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayoutType('bank')}
                    className={`p-4 rounded-2xl border text-left flex items-center gap-3.5 transition-all ${
                      payoutType === 'bank'
                        ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${payoutType === 'bank' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-black text-gray-900">Bank Transfer</p>
                      <p className="text-[11px] text-gray-500 font-medium">Direct NEFT / IMPS Bank Account</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* UPI Fields */}
              {payoutType === 'upi' ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-800 block mb-1">
                      UPI ID (Virtual Payment Address) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. mobile@upi or yourname@okhdfcbank"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                      required
                    />
                    <p className="text-[11px] text-gray-400 font-medium mt-1">Make sure the UPI ID is active and linked to your primary bank account.</p>
                  </div>
                </div>
              ) : (
                /* Bank Fields */
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-800 block mb-1">
                      Account Holder Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="As shown on your bank passbook"
                      value={accountHolderName}
                      onChange={(e) => setAccountHolderName(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-800 block mb-1">
                        Bank Account Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="password"
                        placeholder="Enter account number"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
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
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-800 block mb-1">
                        IFSC Code <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. HDFC0001234"
                        value={ifscCode}
                        onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold text-gray-900 uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
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
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => handleTabChange('history')}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-7 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                >
                  {isSaving ? 'Saving...' : 'Save Payout Details'}
                </button>
              </div>
            </form>
          )}
        </motion.div>

      </div>
    </div>
  );
}
