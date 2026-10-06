import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wallet, ShieldCheck, CheckCircle2, Clock, Calendar,
  Search, Filter, RefreshCw, AlertCircle, Save,
  Building2, User, CreditCard, X, ArrowUpRight, Check,
  ChevronDown, Edit3, Settings, Sparkles, Hash, Eye
} from 'lucide-react';
import { useCashbackStore, useAuthStore, getMonthKey } from '../../backend/store';
import { CashbackConfig, CashbackRecord } from '../../shared/types';
import toast from 'react-hot-toast';

export default function AdminCashbackManagementView() {
  const {
    config, records, loading, initCashback,
    updateCashbackConfig, processPayout, markRecordEligible, markRecordFailed
  } = useCashbackStore();
  const { user } = useAuthStore();

  // Local Form state for Configuration
  const [formConfig, setFormConfig] = useState<CashbackConfig>(config);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isConfigExpanded, setIsConfigExpanded] = useState(true);

  // Filters & Search for Records
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'eligible' | 'paid' | 'failed'>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');

  // Modals for admin actions
  const [payoutModalRecord, setPayoutModalRecord] = useState<CashbackRecord | null>(null);
  const [payoutReference, setPayoutReference] = useState('');
  const [isProcessingPayout, setIsProcessingPayout] = useState(false);

  const [failModalRecord, setFailModalRecord] = useState<CashbackRecord | null>(null);
  const [failReason, setFailReason] = useState('');
  const [isFailingRecord, setIsFailingRecord] = useState(false);

  // Initialize store as Admin
  useEffect(() => {
    const unsub = initCashback(user?.uid, user?.role || 'admin');
    return () => {
      if (unsub) unsub();
    };
  }, [user?.uid, user?.role]);

  // Sync local form state when remote config changes
  useEffect(() => {
    setFormConfig(config);
  }, [config]);

  // Unique months list for dropdown
  const availableMonths = useMemo(() => {
    const monthsMap = new Map<string, string>();
    const cur = getMonthKey();
    monthsMap.set(cur.key, cur.name);

    records.forEach(r => {
      if (r.monthKey && r.monthName) {
        monthsMap.set(r.monthKey, r.monthName);
      }
    });

    return Array.from(monthsMap.entries()).map(([key, name]) => ({ key, name }));
  }, [records]);

  // Overall KPI Metrics
  const metrics = useMemo(() => {
    const totalPaid = records.reduce((sum, r) => sum + (r.status === 'paid' ? r.amount : 0), 0);
    const totalEligible = records.reduce((sum, r) => sum + (r.status === 'eligible' ? r.amount : 0), 0);
    const totalPending = records.reduce((sum, r) => sum + (r.status === 'pending' ? r.amount : 0), 0);
    const totalCustomers = new Set(records.map(r => r.userId).filter(Boolean)).size;

    return { totalPaid, totalEligible, totalPending, totalCustomers };
  }, [records]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      // Month Filter
      if (monthFilter !== 'all' && record.monthKey !== monthFilter) {
        return false;
      }

      // Status Filter
      if (statusFilter !== 'all' && record.status !== statusFilter) {
        return false;
      }

      // Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (record.userName || '').toLowerCase().includes(q);
        const emailMatch = (record.userEmail || '').toLowerCase().includes(q);
        const phoneMatch = (record.userPhone || '').toLowerCase().includes(q);
        const orderIdMatch = (record.orderId || '').toLowerCase().includes(q) || (record.customOrderId || '').toLowerCase().includes(q);
        const upiMatch = (record.payoutInfo?.upiId || '').toLowerCase().includes(q);
        const refMatch = (record.payoutReference || '').toLowerCase().includes(q);
        return nameMatch || emailMatch || phoneMatch || orderIdMatch || upiMatch || refMatch;
      }

      return true;
    });
  }, [records, monthFilter, statusFilter, searchQuery]);

  // Save Configuration Handler
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate ₹30 - ₹100
    const first = Number(formConfig.firstOrderAmount);
    const second = Number(formConfig.secondOrderAmount);
    const third = Number(formConfig.thirdOrderAmount);

    if (first < 30 || first > 100 || second < 30 || second > 100 || third < 30 || third > 100) {
      toast.error('Each order cashback amount must be configured between ₹30 and ₹100.');
      return;
    }

    setIsSavingConfig(true);
    try {
      await updateCashbackConfig(formConfig);
      toast.success('Cashback program settings updated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update cashback settings.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Submit Payout Handler
  const handleConfirmPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutModalRecord) return;

    if (!payoutReference.trim()) {
      toast.error('Please enter the Payout Reference / Transaction UTR');
      return;
    }

    setIsProcessingPayout(true);
    const res = await processPayout(payoutModalRecord.id, payoutReference.trim());
    setIsProcessingPayout(false);

    if (res.success) {
      toast.success(res.message);
      setPayoutModalRecord(null);
      setPayoutReference('');
    } else {
      toast.error(res.message);
    }
  };

  // Submit Failure Handler
  const handleConfirmFail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!failModalRecord) return;

    setIsFailingRecord(true);
    const res = await markRecordFailed(failModalRecord.id, failReason.trim() || 'Ineligible order');
    setIsFailingRecord(false);

    if (res.success) {
      toast.success(res.message);
      setFailModalRecord(null);
      setFailReason('');
    } else {
      toast.error(res.message);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <Wallet className="w-7 h-7 text-emerald-600" />
            Monthly First 3 Orders Cashback Program
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 font-medium mt-1">
            Configure monthly order cashback amounts (₹30–₹100), view customer sequences, and process verified UPI / Bank payouts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
            config.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
          }`}>
            <span className={`w-2 h-2 rounded-full ${config.enabled ? 'bg-emerald-600 animate-pulse' : 'bg-rose-600'}`} />
            {config.enabled ? 'Program Active' : 'Program Disabled'}
          </span>
        </div>
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 block">Total Cashback Paid</span>
            <p className="text-2xl font-black text-emerald-600 mt-1">₹{metrics.totalPaid.toLocaleString('en-IN')}</p>
            <span className="text-[10px] text-gray-400 font-medium">Successfully transferred</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 block">Eligible For Payout</span>
            <p className="text-2xl font-black text-blue-600 mt-1">₹{metrics.totalEligible.toLocaleString('en-IN')}</p>
            <span className="text-[10px] text-gray-400 font-medium">Return period completed</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 block">Pending Verification</span>
            <p className="text-2xl font-black text-amber-600 mt-1">₹{metrics.totalPending.toLocaleString('en-IN')}</p>
            <span className="text-[10px] text-gray-400 font-medium">In return window</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 block">Participating Customers</span>
            <p className="text-2xl font-black text-gray-900 mt-1">{metrics.totalCustomers.toLocaleString('en-IN')}</p>
            <span className="text-[10px] text-gray-400 font-medium">{records.length} total monthly orders</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <User className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Program Settings & Configuration Accordion/Card */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
        <button
          onClick={() => setIsConfigExpanded(!isConfigExpanded)}
          className="w-full p-5 sm:p-6 bg-gray-50/50 hover:bg-gray-50 flex items-center justify-between text-left transition-colors border-b border-gray-100"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 tracking-tight">Program Configuration</h3>
              <p className="text-xs text-gray-500 font-medium">
                Set monthly order reward amounts (₹30–₹100), return safety period, and customer banner text.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 hidden sm:inline">
              {isConfigExpanded ? 'Collapse Settings' : 'Expand Settings'}
            </span>
            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isConfigExpanded ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {isConfigExpanded && (
          <form onSubmit={handleSaveConfig} className="p-5 sm:p-7 space-y-6">
            {/* Status & Amounts Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {/* Program Enabled Toggle */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-gray-700 block">
                  Program Status
                </label>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-bold text-gray-650">
                    {formConfig.enabled ? 'Active on Storefront' : 'Disabled / Hidden'}
                  </span>
                  <input
                    type="checkbox"
                    checked={formConfig.enabled}
                    onChange={(e) => setFormConfig({ ...formConfig, enabled: e.target.checked })}
                    className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* 1st Order Amount (₹30 - ₹100) */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-gray-700">
                    1st Order Cashback
                  </label>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    ₹30 – ₹100
                  </span>
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-sm font-black text-gray-500">₹</span>
                  <input
                    type="number"
                    min={30}
                    max={100}
                    value={formConfig.firstOrderAmount}
                    onChange={(e) => setFormConfig({ ...formConfig, firstOrderAmount: Number(e.target.value) })}
                    className="w-full bg-white border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              {/* 2nd Order Amount (₹30 - ₹100) */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-gray-700">
                    2nd Order Cashback
                  </label>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    ₹30 – ₹100
                  </span>
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-sm font-black text-gray-500">₹</span>
                  <input
                    type="number"
                    min={30}
                    max={100}
                    value={formConfig.secondOrderAmount}
                    onChange={(e) => setFormConfig({ ...formConfig, secondOrderAmount: Number(e.target.value) })}
                    className="w-full bg-white border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              {/* 3rd Order Amount (₹30 - ₹100) */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-gray-700">
                    3rd Order Cashback
                  </label>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    ₹30 – ₹100
                  </span>
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-sm font-black text-gray-500">₹</span>
                  <input
                    type="number"
                    min={30}
                    max={100}
                    value={formConfig.thirdOrderAmount}
                    onChange={(e) => setFormConfig({ ...formConfig, thirdOrderAmount: Number(e.target.value) })}
                    className="w-full bg-white border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Return Period & Titles Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              {/* Return Period Days */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-gray-700 block">
                  Return Safety Buffer (Days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={formConfig.returnPeriodDays}
                  onChange={(e) => setFormConfig({ ...formConfig, returnPeriodDays: Number(e.target.value) })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <p className="text-[10px] text-gray-400 font-medium">Cashback stays Pending until this number of days after order placement.</p>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-gray-700 block">
                  Customer Section Title
                </label>
                <input
                  type="text"
                  value={formConfig.title}
                  onChange={(e) => setFormConfig({ ...formConfig, title: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* Subtitle */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-gray-700 block">
                  Customer Section Subtitle
                </label>
                <input
                  type="text"
                  value={formConfig.subtitle}
                  onChange={(e) => setFormConfig({ ...formConfig, subtitle: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            {/* Terms & Conditions Editor */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-gray-700 block">
                Customer-Facing Terms & Conditions
              </label>
              <textarea
                rows={4}
                value={formConfig.termsAndConditions}
                onChange={(e) => setFormConfig({ ...formConfig, termsAndConditions: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs sm:text-sm font-medium text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                type="submit"
                disabled={isSavingConfig}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isSavingConfig ? 'Saving Settings...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Customer Cashback Records Section */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-5 sm:p-7 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              Customer Cashback Records
            </h3>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Track customer order sequence, verification status, and process payouts.
            </p>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search name, email, order..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48 sm:w-56"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            </div>

            {/* Month Filter */}
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-gray-800 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Months</option>
              {availableMonths.map(m => (
                <option key={m.key} value={m.key}>{m.name}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-gray-50 border border-gray-200 text-gray-800 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="eligible">Eligible</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-[10px] font-black uppercase tracking-wider text-gray-400 bg-gray-50/50">
                <th className="p-3.5 rounded-l-xl">Customer</th>
                <th className="p-3.5">Month & Order Pos</th>
                <th className="p-3.5">Order ID & Total</th>
                <th className="p-3.5">Cashback Amount</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Payout Account</th>
                <th className="p-3.5">Payout Details</th>
                <th className="p-3.5 text-right rounded-r-xl">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-xs">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-400 italic">
                    No cashback records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const isPaid = rec.status === 'paid';
                  const isEligible = rec.status === 'eligible';
                  const isPending = rec.status === 'pending';
                  const isFailed = rec.status === 'failed';

                  return (
                    <tr key={rec.id} className="hover:bg-gray-50/60 transition-colors">
                      {/* Customer Info */}
                      <td className="p-3.5">
                        <div className="font-bold text-gray-900">{rec.userName || 'Customer'}</div>
                        <div className="text-[10px] text-gray-500 font-medium">{rec.userEmail}</div>
                        {rec.userPhone && <div className="text-[10px] text-gray-400">{rec.userPhone}</div>}
                      </td>

                      {/* Month & Position */}
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-black uppercase tracking-wider rounded-md border border-emerald-200/60">
                          {rec.position === 1 ? '1st Order' : rec.position === 2 ? '2nd Order' : '3rd Order'}
                        </span>
                        <div className="text-[10px] text-gray-500 font-bold mt-1">{rec.monthName}</div>
                      </td>

                      {/* Order ID & Total */}
                      <td className="p-3.5">
                        <div className="font-bold text-gray-900">
                          #{rec.customOrderId || rec.orderId.slice(-8).toUpperCase()}
                        </div>
                        <div className="text-[10px] text-gray-500 font-medium">
                          ₹{rec.orderTotal?.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[9px] text-gray-400">
                          {new Date(rec.orderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </div>
                      </td>

                      {/* Cashback Amount */}
                      <td className="p-3.5">
                        <span className="font-black text-emerald-600 text-sm">₹{rec.amount}</span>
                      </td>

                      {/* Status */}
                      <td className="p-3.5">
                        {isPaid && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Paid
                          </span>
                        )}
                        {isEligible && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-800">
                            <Clock className="w-3 h-3 text-blue-600" />
                            Eligible
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Pending
                          </span>
                        )}
                        {isFailed && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800">
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            Failed
                          </span>
                        )}
                      </td>

                      {/* Payout Account */}
                      <td className="p-3.5">
                        {rec.payoutInfo ? (
                          rec.payoutInfo.payoutType === 'upi' ? (
                            <div>
                              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-800 text-[9px] font-black uppercase rounded">UPI</span>
                              <p className="text-[11px] font-bold text-gray-900 mt-0.5">{rec.payoutInfo.upiId}</p>
                            </div>
                          ) : (
                            <div>
                              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-800 text-[9px] font-black uppercase rounded">Bank</span>
                              <p className="text-[11px] font-bold text-gray-900 mt-0.5">{rec.payoutInfo.accountNumber}</p>
                              <p className="text-[10px] text-gray-500 font-mono">{rec.payoutInfo.ifscCode}</p>
                            </div>
                          )
                        ) : (
                          <span className="text-[11px] text-gray-400 italic">Not Added Yet</span>
                        )}
                      </td>

                      {/* Payout Details */}
                      <td className="p-3.5">
                        {isPaid ? (
                          <div>
                            <p className="text-[11px] font-bold text-gray-900">
                              {new Date(rec.payoutDate || rec.updatedAt || '').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </p>
                            <p className="text-[10px] font-mono text-gray-500 truncate max-w-[120px]" title={rec.payoutReference}>
                              Ref: {rec.payoutReference}
                            </p>
                          </div>
                        ) : isFailed ? (
                          <p className="text-[10px] text-rose-600 font-medium">{rec.failureReason || 'Cancelled'}</p>
                        ) : (
                          <span className="text-[10px] text-gray-400">
                            Return buffer: {new Date(rec.returnPeriodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right space-x-1.5">
                        {isPending && (
                          <button
                            onClick={async () => {
                              const res = await markRecordEligible(rec.id);
                              if (res.success) toast.success(res.message);
                              else toast.error(res.message);
                            }}
                            className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 text-[10px] font-bold rounded-lg transition-colors"
                            title="Mark as Eligible for Payout"
                          >
                            Mark Eligible
                          </button>
                        )}

                        {isEligible && (
                          <button
                            onClick={() => {
                              setPayoutModalRecord(rec);
                              setPayoutReference(`PAYOUT-${Date.now()}`);
                            }}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-xs transition-all active:scale-95"
                          >
                            Process Pay
                          </button>
                        )}

                        {!isPaid && !isFailed && (
                          <button
                            onClick={() => {
                              setFailModalRecord(rec);
                              setFailReason('');
                            }}
                            className="p-1 text-gray-400 hover:text-rose-600 transition-colors"
                            title="Reject / Mark Failed"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payout Modal */}
      <AnimatePresence>
        {payoutModalRecord && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPayoutModalRecord(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-gray-100 z-10 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h4 className="text-base font-black text-gray-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                  Record Cashback Payout
                </h4>
                <button
                  onClick={() => setPayoutModalRecord(null)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-emerald-50 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500 font-bold">Customer:</span>
                  <span className="font-black text-gray-900">{payoutModalRecord.userName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-bold">Reward Amount:</span>
                  <span className="font-black text-emerald-700 text-sm">₹{payoutModalRecord.amount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-bold">Monthly Sequence:</span>
                  <span className="font-bold text-gray-800">{payoutModalRecord.position === 1 ? '1st Order' : payoutModalRecord.position === 2 ? '2nd Order' : '3rd Order'}</span>
                </div>

                <div className="pt-2 border-t border-emerald-200/60">
                  <span className="text-gray-500 font-bold block mb-1">Customer Payout Account:</span>
                  {payoutModalRecord.payoutInfo ? (
                    payoutModalRecord.payoutInfo.payoutType === 'upi' ? (
                      <p className="font-black text-gray-900 font-mono text-sm bg-white p-2 rounded-xl border border-emerald-100">
                        UPI: {payoutModalRecord.payoutInfo.upiId}
                      </p>
                    ) : (
                      <div className="bg-white p-2 rounded-xl border border-emerald-100 font-mono text-xs space-y-0.5">
                        <p className="font-bold text-gray-900">A/C: {payoutModalRecord.payoutInfo.accountNumber}</p>
                        <p className="text-gray-600">IFSC: {payoutModalRecord.payoutInfo.ifscCode}</p>
                        <p className="text-gray-600">Name: {payoutModalRecord.payoutInfo.accountHolderName}</p>
                      </div>
                    )
                  ) : (
                    <p className="text-rose-600 italic">No payout details provided by customer yet.</p>
                  )}
                </div>
              </div>

              <form onSubmit={handleConfirmPayout} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-gray-800 block mb-1">
                    Payout Transaction Reference / UTR Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTR123456789 or UPI reference ID"
                    value={payoutReference}
                    onChange={(e) => setPayoutReference(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-bold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setPayoutModalRecord(null)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessingPayout}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md flex items-center gap-1.5"
                  >
                    {isProcessingPayout ? 'Processing...' : 'Mark as Paid'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Fail / Reject Modal */}
      <AnimatePresence>
        {failModalRecord && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFailModalRecord(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-gray-100 z-10 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h4 className="text-base font-black text-gray-900 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                  Mark Cashback as Ineligible
                </h4>
                <button
                  onClick={() => setFailModalRecord(null)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmFail} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-gray-800 block mb-1">
                    Reason for Rejection / Ineligibility
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Order returned / cancelled by user"
                    value={failReason}
                    onChange={(e) => setFailReason(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-bold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setFailModalRecord(null)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isFailingRecord}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md"
                  >
                    {isFailingRecord ? 'Saving...' : 'Confirm Ineligible'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
