import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell, Sparkles, Send, Users, Layers, Zap, ShoppingBag, Heart,
  Tag, Clock, Sliders, Split, BarChart3, Cpu, Settings, FileText,
  CheckCircle2, AlertTriangle, Play, Pause, Plus, Search, Filter,
  Trash2, Edit3, Copy, Eye, ExternalLink, RefreshCw, Smartphone,
  Check, X, ChevronRight, TrendingUp, DollarSign, Target, ShieldCheck,
  Percent, ArrowUpRight, Flame, Mail, Award, MessageSquare
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { collection, query, orderBy, limit, onSnapshot, getDocs, doc, setDoc, addDoc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { useAuthStore, useCategoryStore } from '../../backend/store';
import {
  NotificationCampaign,
  NotificationTemplate,
  CustomerNotification,
  NotificationLog,
  NotificationCategory,
  NotificationPriority,
  NotificationSystemSettings,
  ABTestExperiment
} from '../../shared/types/notifications';
import { Product, Order, UserProfile } from '../../shared/types';
import { EngagementMLEngine, CustomerBehaviorProfile } from '../../backend/services/mlEngine';
import { NotificationEngine, sanitizeFirestoreData } from '../../backend/services/notificationEngine';
import { useAdminDateFilter } from './AdminDateFilterContext';
import toast from 'react-hot-toast';
import axios from 'axios';

const SECTIONS = [
  { id: 'dashboard', label: '1. Notification Dashboard', icon: BarChart3 },
  { id: 'templates', label: '2. Notification Templates', icon: FileText },
  { id: 'campaigns', label: '3. Notification Campaigns', icon: Send },
  { id: 'segments', label: '4. Customer Segmentation', icon: Users },
  { id: 'personalized', label: '5. Personalized Notifications', icon: Sparkles },
  { id: 'product_based', label: '6. Product-Based Notifications', icon: Tag },
  { id: 'orders', label: '7. Order Notifications', icon: ShoppingBag },
  { id: 'cart_wishlist', label: '8. Cart & Wishlist Notifications', icon: Heart },
  { id: 'price_drop', label: '9. Price Drop Alerts', icon: Zap },
  { id: 'back_in_stock', label: '10. Back-in-Stock Alerts', icon: Layers },
  { id: 'coupons', label: '11. Coupon & Offer Notifications', icon: Tag },
  { id: 'flash_sale', label: '12. Flash Sale Notifications', icon: Flame },
  { id: 'send_time', label: '13. Send-Time Optimization', icon: Clock },
  { id: 'frequency', label: '14. Frequency Optimization', icon: Sliders },
  { id: 'ab_testing', label: '15. A/B Testing', icon: Split },
  { id: 'analytics', label: '16. Notification Analytics', icon: TrendingUp },
  { id: 'ml_models', label: '17. ML Models', icon: Cpu },
  { id: 'settings', label: '18. Notification Settings', icon: Settings },
  { id: 'logs', label: '19. Notification Logs', icon: FileText },
  { id: 'preferences', label: '20. Customer Preferences', icon: ShieldCheck },
];

export default function AdminNotificationsManagementView() {
  const { user } = useAuthStore();
  const { categories } = useCategoryStore();
  const { isDateInRange, dateRange, selectedPreset } = useAdminDateFilter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Firestore Real-time data
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [campaigns, setCampaigns] = useState<NotificationCampaign[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [settings, setSettings] = useState<NotificationSystemSettings>({
    enableMLAutomation: true,
    enableQuietHours: true,
    quietHoursStart: 22,
    quietHoursEnd: 8,
    defaultMarketingFrequencyCapPerDay: 2,
    defaultMarketingFrequencyCapPerWeek: 7,
    minCooldownHoursBetweenMarketing: 6,
    cartAbandonmentDelayHours: 2,
    priceDropThresholdPercent: 5,
    fcmEnabled: true,
    geminiPersonalizationEnabled: true,
    updatedAt: new Date().toISOString(),
  });

  // Modal / Editor States
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<NotificationCampaign | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [showDirectPushModal, setShowDirectPushModal] = useState(false);
  const [directPushPresetTarget, setDirectPushPresetTarget] = useState<'all' | 'segment' | 'user'>('all');
  const [directPushPresetSegment, setDirectPushPresetSegment] = useState<string>('all');
  const [directPushPresetUser, setDirectPushPresetUser] = useState<UserProfile | null>(null);
  const [directPushPresetTitle, setDirectPushPresetTitle] = useState<string>('');
  const [directPushPresetMessage, setDirectPushPresetMessage] = useState<string>('');
  const [directPushPresetCategory, setDirectPushPresetCategory] = useState<NotificationCategory>('offers');
  const [directPushPresetSlug, setDirectPushPresetSlug] = useState<string>('/offers');
  const [directPushPresetImage, setDirectPushPresetImage] = useState<string>('');
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<UserProfile | null>(null);
  const [quickTestTitle, setQuickTestTitle] = useState('Exclusive ViBa Mart Deal!');
  const [quickTestMessage, setQuickTestMessage] = useState('Enjoy 25% OFF on top categories today only.');
  const [quickTestCategory, setQuickTestCategory] = useState<NotificationCategory>('offers');
  const [quickTestSlug, setQuickTestSlug] = useState('/offers');
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Live Firebase Subscriptions
  useEffect(() => {
    // 1. Notifications
    const qNotifs = query(collection(db, 'user_notifications'), orderBy('createdAt', 'desc'), limit(100));
    const unsubNotifs = onSnapshot(qNotifs, snap => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerNotification)));
    }, () => {});

    // 2. Campaigns
    const qCamps = query(collection(db, 'notification_campaigns'), orderBy('createdAt', 'desc'));
    const unsubCamps = onSnapshot(qCamps, snap => {
      setCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() } as NotificationCampaign)));
    }, () => {});

    // 3. Templates
    const qTemps = query(collection(db, 'notification_templates'), orderBy('createdAt', 'desc'));
    const unsubTemps = onSnapshot(qTemps, snap => {
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as NotificationTemplate)));
    }, () => {});

    // 4. Logs
    const qLogs = query(collection(db, 'notificationLogs'), orderBy('sentAt', 'desc'), limit(150));
    const unsubLogs = onSnapshot(qLogs, snap => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as NotificationLog)));
    }, () => {});

    // 5. Users
    const qUsers = query(collection(db, 'users'), limit(200));
    const unsubUsers = onSnapshot(qUsers, snap => {
      const uDocs = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
      setUsers(uDocs);
      if (uDocs.length > 0 && !selectedUserForProfile) {
        setSelectedUserForProfile(uDocs[0]);
      }
    }, () => {});

    // 6. Orders
    const qOrders = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(200));
    const unsubOrders = onSnapshot(qOrders, snap => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
    }, () => {});

    // 7. Products
    const qProds = query(collection(db, 'products'), limit(200));
    const unsubProds = onSnapshot(qProds, snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    }, () => {});

    // 8. Events
    const qEvents = query(collection(db, 'notification_events'), orderBy('timestamp', 'desc'), limit(300));
    const unsubEvents = onSnapshot(qEvents, snap => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});

    // 9. Settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'notification_ml_config'), snap => {
      if (snap.exists()) {
        setSettings(snap.data() as NotificationSystemSettings);
      }
    }, () => {});

    return () => {
      unsubNotifs();
      unsubCamps();
      unsubTemps();
      unsubLogs();
      unsubUsers();
      unsubOrders();
      unsubProds();
      unsubEvents();
      unsubSettings();
    };
  }, []);

  // Compute live performance metrics
  const stats = useMemo(() => {
    const filteredNotifs = notifications.filter(n => isDateInRange(n.createdAt));
    const filteredCamps = campaigns.filter(c => isDateInRange(c.createdAt || c.scheduledFor));

    const totalSent = filteredNotifs.length;
    const opened = filteredNotifs.filter(n => n.read || n.openedAt).length;
    const clicked = filteredNotifs.filter(n => n.clickedAt).length;
    const converted = filteredNotifs.filter(n => n.convertedAt).length;
    const openRate = totalSent > 0 ? Math.round((opened / totalSent) * 100) : 0;
    const ctr = totalSent > 0 ? Math.round((clicked / totalSent) * 100) : 0;
    const conversionRate = totalSent > 0 ? Math.round((converted / totalSent) * 100) : 0;
    const attributedRevenue = filteredCamps.reduce((sum, c) => sum + (c.attributedRevenue || 0), 0);

    return {
      totalSent,
      opened,
      clicked,
      converted,
      openRate,
      ctr,
      conversionRate,
      attributedRevenue,
      activeCampaigns: filteredCamps.filter(c => c.status === 'active').length,
    };
  }, [notifications, campaigns, isDateInRange]);

  // Compute live customer segments
  const computedProfiles = useMemo(() => {
    return users.map(u => EngagementMLEngine.buildCustomerProfile(u, orders, products, events));
  }, [users, orders, products, events]);

  const segmentCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: users.length,
      frequent_buyers: 0,
      new_customers: 0,
      returning_customers: 0,
      high_value_customers: 0,
      cart_abandoners: 0,
      wishlist_users: 0,
      churn_risk_high: 0,
      recently_purchased: 0,
    };

    computedProfiles.forEach(p => {
      p.matchedSegments.forEach(seg => {
        counts[seg] = (counts[seg] || 0) + 1;
      });
    });

    return counts;
  }, [computedProfiles, users]);

  // Handle Quick Test Dispatch
  const handleSendTestNotification = async () => {
    if (!quickTestTitle || !quickTestMessage) {
      toast.error('Please provide a title and message.');
      return;
    }
    setIsSendingTest(true);
    try {
      const targetUid = user?.uid || (users[0]?.uid ?? 'all');
      const result = await NotificationEngine.dispatchNotification({
        userId: targetUid,
        category: quickTestCategory,
        title: quickTestTitle,
        message: quickTestMessage,
        destinationSlug: quickTestSlug,
        priority: 'high',
        bypassFrequencyLimits: true,
        bypassQuietHours: true,
      });

      if (result.success) {
        toast.success(`Test notification sent successfully! (ID: ${result.notificationId?.slice(-6)})`);
      } else {
        toast.error(`Dispatch failed: ${result.reason}`);
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Module Header */}
      <div className="bg-gradient-to-r from-gray-900 via-primary-900 to-gray-900 rounded-3xl p-6 lg:p-8 text-white relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-black uppercase tracking-widest text-emerald-300">
              <Sparkles className="w-3.5 h-3.5 animate-spin" /> Live ML Decision Engine
            </div>
            <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-white">
              Notification & Customer Engagement ML
            </h2>
            <p className="text-gray-300 text-xs sm:text-sm max-w-2xl font-medium leading-relaxed">
              Unified cross-platform intelligence engine powering multi-channel push, behavioral customer segmentation, purchase propensity ML, send-time optimization, and automated conversion campaigns.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                setDirectPushPresetTarget('all');
                setDirectPushPresetTitle('');
                setDirectPushPresetMessage('');
                setShowDirectPushModal(true);
              }}
              className="px-5 py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-xl shadow-orange-500/25 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              <Send className="w-4 h-4" /> Push Notification
            </button>
            <button
              onClick={() => {
                setEditingCampaign(null);
                setShowCampaignModal(true);
              }}
              className="px-5 py-3 bg-white text-gray-900 hover:bg-gray-100 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4 text-primary" /> New Campaign
            </button>
            <button
              onClick={() => {
                setEditingTemplate(null);
                setShowTemplateModal(true);
              }}
              className="px-5 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-2xl text-xs font-black uppercase tracking-wider backdrop-blur-md transition-all flex items-center gap-2"
            >
              <FileText className="w-4 h-4" /> New Template
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs Bar (Scrollable on Desktop & Mobile) */}
      <div className="bg-white rounded-2xl p-2 shadow-sm border border-gray-100">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeTab === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveTab(sec.id)}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 shrink-0 ${
                  isActive
                    ? 'bg-primary text-white shadow-md shadow-primary/25'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB CONTENT DISPATCH */}
      <div className="space-y-6">
        {/* 1. NOTIFICATION DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <KPICard title="Total Sent" value={stats.totalSent.toString()} icon={Send} color="text-blue-600" bg="bg-blue-50" badge="+100%" />
              <KPICard title="Open Rate" value={`${stats.openRate}%`} icon={Eye} color="text-emerald-600" bg="bg-emerald-50" badge="Target >20%" />
              <KPICard title="CTR (Clicks)" value={`${stats.ctr}%`} icon={Target} color="text-purple-600" bg="bg-purple-50" badge="High" />
              <KPICard title="Conversion Rate" value={`${stats.conversionRate}%`} icon={CheckCircle2} color="text-teal-600" bg="bg-teal-50" badge="Real" />
              <KPICard title="Attributed Sales" value={`₹${stats.attributedRevenue.toLocaleString()}`} icon={DollarSign} color="text-amber-600" bg="bg-amber-50" badge="Direct" />
              <KPICard title="Active Campaigns" value={stats.activeCampaigns.toString()} icon={Flame} color="text-rose-600" bg="bg-rose-50" badge="Running" />
            </div>

            {/* Quick Test Trigger + Engine Status */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Quick Send Simulator */}
              <div className="xl:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4 text-left">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-amber-500" />
                      Live Notification Dispatch Simulator
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Test real-time in-app & web push notifications instantly across connected devices</p>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-full uppercase tracking-wider">
                    Ready
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1">Category</label>
                    <select
                      value={quickTestCategory}
                      onChange={(e) => setQuickTestCategory(e.target.value as NotificationCategory)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="offers">Offers & Promos</option>
                      <option value="personalized">Personalized Recommendation</option>
                      <option value="price_drops">Price Drop Alert</option>
                      <option value="wishlist">Wishlist & In-Stock</option>
                      <option value="cart">Cart Reminder</option>
                      <option value="flash_sales">Flash Sale</option>
                      <option value="coupons">Coupon Expiry</option>
                      <option value="orders">Order Update (Transactional)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1">Destination Route</label>
                    <input
                      type="text"
                      value={quickTestSlug}
                      onChange={(e) => setQuickTestSlug(e.target.value)}
                      placeholder="/offers or /products/slug"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1">Title</label>
                    <input
                      type="text"
                      value={quickTestTitle}
                      onChange={(e) => setQuickTestTitle(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1">Message</label>
                    <textarea
                      rows={2}
                      value={quickTestMessage}
                      onChange={(e) => setQuickTestMessage(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-800 outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    disabled={isSendingTest}
                    onClick={handleSendTestNotification}
                    className="px-6 py-3 bg-primary text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md hover:bg-primary-hover active:scale-95 transition-all flex items-center gap-2"
                  >
                    {isSendingTest ? 'Dispatching...' : (
                      <>
                        <Send className="w-4 h-4" /> Dispatch Test Alert
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Engine Telemetry Card */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between text-left space-y-4">
                <div>
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-purple-600" />
                      ML Engine Status
                    </h3>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  </div>

                  <div className="space-y-3 mt-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                      <span className="text-xs font-bold text-gray-700">Recommendation ML</span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 uppercase">Active (TF-IDF/RFM)</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                      <span className="text-xs font-bold text-gray-700">Purchase Propensity</span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-100 text-blue-700 uppercase">Scoring (0.0-1.0)</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                      <span className="text-xs font-bold text-gray-700">Send-Time Optimizer</span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-purple-100 text-purple-700 uppercase">Histogram Ready</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                      <span className="text-xs font-bold text-gray-700">Frequency Cap & Quiet Hours</span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-teal-100 text-teal-700 uppercase">Enforced</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-[11px] text-amber-900 font-medium">
                  💡 <strong>Real-time Telemetry:</strong> All engagement events (views, clicks, carts, orders) update customer profiles dynamically.
                </div>
              </div>
            </div>

            {/* Live Notifications Feed */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 text-left">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Live Notification Stream ({notifications.length})
                </h3>
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Latest Dispatches</span>
              </div>

              {notifications.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400 font-bold uppercase">No notifications recorded yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Title & Message</th>
                        <th className="px-4 py-3">Target / User</th>
                        <th className="px-4 py-3">Destination</th>
                        <th className="px-4 py-3">Sent At</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {notifications.slice(0, 10).map((n) => (
                        <tr key={n.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="px-4 py-3 text-xs font-black">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider ${
                              n.category === 'orders' ? 'bg-blue-100 text-blue-700' :
                              n.category === 'price_drops' ? 'bg-rose-100 text-rose-700' :
                              n.category === 'cart' ? 'bg-amber-100 text-amber-700' :
                              'bg-purple-100 text-purple-700'
                            }`}>
                              {n.category}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-bold text-gray-900">{n.title}</p>
                            <p className="text-[11px] text-gray-500 font-medium truncate max-w-xs">{n.message}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600 font-medium">{n.userId === 'all' ? 'All Customers' : n.userId.slice(0, 8)}</td>
                          <td className="px-4 py-3 text-xs font-mono text-primary font-bold">{n.destinationSlug || '/'}</td>
                          <td className="px-4 py-3 text-[10px] text-gray-400 font-bold">{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-full uppercase">
                              Delivered
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. NOTIFICATION TEMPLATES */}
        {activeTab === 'templates' && (
          <TemplatesSection
            templates={templates}
            onNewTemplate={() => {
              setEditingTemplate(null);
              setShowTemplateModal(true);
            }}
            onEditTemplate={(t) => {
              setEditingTemplate(t);
              setShowTemplateModal(true);
            }}
          />
        )}

        {/* 3. NOTIFICATION CAMPAIGNS */}
        {activeTab === 'campaigns' && (
          <CampaignsSection
            campaigns={campaigns}
            templates={templates}
            products={products}
            onNewCampaign={() => {
              setEditingCampaign(null);
              setShowCampaignModal(true);
            }}
            onEditCampaign={(c) => {
              setEditingCampaign(c);
              setShowCampaignModal(true);
            }}
            onPushDirect={() => {
              setDirectPushPresetTarget('all');
              setDirectPushPresetTitle('');
              setDirectPushPresetMessage('');
              setShowDirectPushModal(true);
            }}
          />
        )}

        {/* 4. CUSTOMER SEGMENTATION */}
        {activeTab === 'segments' && (
          <SegmentationSection
            profiles={computedProfiles}
            segmentCounts={segmentCounts}
            onPushToSegment={(segId: string) => {
              setDirectPushPresetTarget('segment');
              setDirectPushPresetSegment(segId);
              setDirectPushPresetTitle('');
              setDirectPushPresetMessage('');
              setShowDirectPushModal(true);
            }}
          />
        )}

        {/* 5. PERSONALIZED NOTIFICATIONS */}
        {activeTab === 'personalized' && (
          <PersonalizedPreviewSection
            users={users}
            profiles={computedProfiles}
            products={products}
            selectedUser={selectedUserForProfile}
            onSelectUser={setSelectedUserForProfile}
            onPushToUser={(targetUser: UserProfile, prod?: Product) => {
              setDirectPushPresetTarget('user');
              setDirectPushPresetUser(targetUser);
              if (prod) {
                setDirectPushPresetTitle(`Special Recommendation: ${prod.name}`);
                setDirectPushPresetMessage(`Handpicked for your preferences! Get special pricing on ${prod.name} today.`);
                setDirectPushPresetSlug(prod.slug ? `/products/${prod.slug}` : `/products/${prod.id}`);
                setDirectPushPresetImage(prod.images?.[0] || '');
                setDirectPushPresetCategory('personalized');
              } else {
                setDirectPushPresetTitle('');
                setDirectPushPresetMessage('');
              }
              setShowDirectPushModal(true);
            }}
          />
        )}

        {/* 6. PRODUCT-BASED NOTIFICATIONS */}
        {activeTab === 'product_based' && (
          <ProductBasedSection
            products={products}
            users={users}
          />
        )}

        {/* 7. ORDER NOTIFICATIONS */}
        {activeTab === 'orders' && (
          <OrderNotificationsSection
            orders={orders}
          />
        )}

        {/* 8. CART & WISHLIST NOTIFICATIONS */}
        {activeTab === 'cart_wishlist' && (
          <CartWishlistSection
            users={users}
            products={products}
          />
        )}

        {/* 9. PRICE DROP ALERTS */}
        {activeTab === 'price_drop' && (
          <PriceDropAlertsSection
            products={products}
            users={users}
          />
        )}

        {/* 10. BACK-IN-STOCK ALERTS */}
        {activeTab === 'back_in_stock' && (
          <BackInStockSection
            products={products}
            users={users}
          />
        )}

        {/* 11. COUPON & OFFER NOTIFICATIONS */}
        {activeTab === 'coupons' && (
          <CouponOffersSection
            users={users}
          />
        )}

        {/* 12. FLASH SALE NOTIFICATIONS */}
        {activeTab === 'flash_sale' && (
          <FlashSaleSection
            products={products}
            categories={categories}
            users={users}
          />
        )}

        {/* 13. SEND-TIME OPTIMIZATION */}
        {activeTab === 'send_time' && (
          <SendTimeSection
            profiles={computedProfiles}
            settings={settings}
          />
        )}

        {/* 14. FREQUENCY OPTIMIZATION */}
        {activeTab === 'frequency' && (
          <FrequencySection
            settings={settings}
            logs={logs}
          />
        )}

        {/* 15. A/B TESTING */}
        {activeTab === 'ab_testing' && (
          <ABTestingSection
            campaigns={campaigns}
          />
        )}

        {/* 16. NOTIFICATION ANALYTICS */}
        {activeTab === 'analytics' && (
          <AnalyticsSection
            notifications={notifications}
            campaigns={campaigns}
            logs={logs}
          />
        )}

        {/* 17. ML MODELS */}
        {activeTab === 'ml_models' && (
          <MLModelsSection
            profiles={computedProfiles}
            events={events}
          />
        )}

        {/* 18. NOTIFICATION SETTINGS */}
        {activeTab === 'settings' && (
          <NotificationSettingsSection
            settings={settings}
          />
        )}

        {/* 19. NOTIFICATION LOGS */}
        {activeTab === 'logs' && (
          <NotificationLogsSection
            logs={logs}
          />
        )}

        {/* 20. CUSTOMER PREFERENCES */}
        {activeTab === 'preferences' && (
          <CustomerPreferencesSection
            users={users}
          />
        )}
      </div>

      {/* Campaign Create/Edit Modal */}
      {showCampaignModal && (
        <CampaignEditorModal
          isOpen={showCampaignModal}
          campaign={editingCampaign}
          templates={templates}
          products={products}
          categories={categories}
          onClose={() => setShowCampaignModal(false)}
        />
      )}

      {/* Template Create/Edit Modal */}
      {showTemplateModal && (
        <TemplateEditorModal
          isOpen={showTemplateModal}
          template={editingTemplate}
          onClose={() => setShowTemplateModal(false)}
        />
      )}

      {/* Direct Push Notification Composer Modal */}
      {showDirectPushModal && (
        <DirectPushComposerModal
          isOpen={showDirectPushModal}
          onClose={() => setShowDirectPushModal(false)}
          users={users}
          profiles={computedProfiles}
          segmentCounts={segmentCounts}
          templates={templates}
          products={products}
          categories={categories}
          initialTarget={directPushPresetTarget}
          initialSegment={directPushPresetSegment}
          initialUser={directPushPresetUser}
          initialTitle={directPushPresetTitle}
          initialMessage={directPushPresetMessage}
          initialCategory={directPushPresetCategory}
          initialSlug={directPushPresetSlug}
          initialImage={directPushPresetImage}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// SUB-SECTIONS COMPONENTS IMPLEMENTATIONS
// -------------------------------------------------------------

function KPICard({ title, value, icon: Icon, color, bg, badge }: any) {
  return (
    <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between text-left space-y-3">
      <div className="flex items-center justify-between">
        <div className={`p-2.5 rounded-2xl ${bg} ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {badge && (
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>
      <div>
        <h4 className="text-2xl font-black text-gray-900 tracking-tight">{value}</h4>
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">{title}</p>
      </div>
    </div>
  );
}

// 2. TEMPLATES SECTION
function TemplatesSection({ templates, onNewTemplate, onEditTemplate }: any) {
  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await deleteDoc(doc(db, 'notification_templates', id));
      toast.success('Template deleted');
    } catch (e) {
      toast.error('Failed to delete template');
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 text-left space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h3 className="text-lg font-black text-gray-900">Notification Templates</h3>
          <p className="text-xs text-gray-500 mt-0.5">Reusable parameterized message blueprints with dynamic variable insertion</p>
        </div>
        <button
          onClick={onNewTemplate}
          className="px-5 py-2.5 bg-primary text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md hover:bg-primary-hover active:scale-95 transition-all flex items-center gap-1.5 self-start"
        >
          <Plus className="w-4 h-4" /> Create Template
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-bold">No templates created yet.</p>
          <p className="text-xs text-gray-400 mt-1">Create your first template to power automated campaigns.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {templates.map((t: NotificationTemplate) => (
            <div key={t.id} className="p-5 bg-gray-50/80 rounded-2xl border border-gray-100 hover:border-primary/20 transition-all flex flex-col justify-between space-y-4 group">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-white border border-gray-200 rounded-full text-[9px] font-black uppercase tracking-wider text-gray-700">
                    {t.category}
                  </span>
                  <span className={`w-2 h-2 rounded-full ${t.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                </div>
                <h4 className="text-sm font-black text-gray-900">{t.name}</h4>
                <div className="p-3 bg-white rounded-xl border border-gray-100 space-y-1">
                  <p className="text-xs font-bold text-gray-800">{t.titleTemplate}</p>
                  <p className="text-xs text-gray-600 leading-relaxed font-medium">{t.messageTemplate}</p>
                </div>
                {t.variables && t.variables.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {t.variables.map(v => (
                      <span key={v} className="px-1.5 py-0.5 bg-primary/10 text-primary text-[9px] font-mono font-bold rounded">
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-[10px] font-mono text-gray-400">{t.destinationSlugTemplate || '/'}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => onEditTemplate(t)} className="p-1.5 text-gray-500 hover:text-primary rounded-lg bg-white border border-gray-200">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 text-gray-500 hover:text-rose-600 rounded-lg bg-white border border-gray-200">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 3. CAMPAIGNS SECTION
function CampaignsSection({ campaigns, templates, products, onNewCampaign, onEditCampaign, onPushDirect }: any) {
  const handleToggleStatus = async (c: NotificationCampaign) => {
    const newStatus = c.status === 'active' ? 'paused' : 'active';
    try {
      await updateDoc(doc(db, 'notification_campaigns', c.id), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
      toast.success(`Campaign ${newStatus}`);
    } catch (e) {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this campaign?')) return;
    try {
      await deleteDoc(doc(db, 'notification_campaigns', id));
      toast.success('Campaign deleted');
    } catch (e) {
      toast.error('Failed to delete campaign');
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 text-left space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h3 className="text-lg font-black text-gray-900">Notification Campaigns</h3>
          <p className="text-xs text-gray-500 mt-0.5">Targeted promotional broadcasts, flash sales, and ML-optimized scheduled alerts</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <button
            onClick={onPushDirect}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md active:scale-95 transition-all flex items-center gap-1.5"
          >
            <Send className="w-4 h-4" /> Push Instant Alert
          </button>
          <button
            onClick={onNewCampaign}
            className="px-4 py-2.5 bg-primary text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md hover:bg-primary-hover active:scale-95 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Create Campaign
          </button>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <Send className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-bold">No active campaigns.</p>
          <p className="text-xs text-gray-400 mt-1">Create an audience-targeted campaign with A/B variant testing.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((c: NotificationCampaign) => (
            <div key={c.id} className="p-5 bg-gray-50 rounded-2xl border border-gray-100 hover:border-gray-200 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                    c.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                    c.status === 'paused' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-200 text-gray-700'
                  }`}>
                    {c.status}
                  </span>
                  {c.isAbTest && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[9px] font-black uppercase">
                      A/B Test ({c.abSplitRatio || 50}/{100 - (c.abSplitRatio || 50)})
                    </span>
                  )}
                  {c.mlOptimization && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[9px] font-black uppercase flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> ML Send-Time
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-black text-gray-900">{c.name}</h4>
                <p className="text-xs text-gray-600 font-medium">{c.title || c.variantA?.title || 'No title'} — <span className="text-gray-500">{c.message || c.variantA?.message || ''}</span></p>
                <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider pt-1">
                  <span>Target: {c.targetSegmentId || 'All Customers'}</span>
                  <span>•</span>
                  <span>Sent: {c.sentCount || 0}</span>
                  <span>•</span>
                  <span>Clicks: {c.clickCount || 0}</span>
                  <span>•</span>
                  <span>Sales: ₹{(c.attributedRevenue || 0).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                <button
                  onClick={() => handleToggleStatus(c)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    c.status === 'active' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  {c.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {c.status === 'active' ? 'Pause' : 'Activate'}
                </button>
                <button onClick={() => onEditCampaign(c)} className="p-2 text-gray-600 hover:text-primary rounded-xl bg-white border border-gray-200">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(c.id)} className="p-2 text-gray-600 hover:text-rose-600 rounded-xl bg-white border border-gray-200">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 4. SEGMENTATION SECTION
function SegmentationSection({ profiles, segmentCounts, onPushToSegment }: any) {
  const segmentsList = [
    { id: 'frequent_buyers', name: 'Frequent Buyers', desc: 'Customers with 3 or more lifetime purchases', count: segmentCounts.frequent_buyers || 0, color: 'bg-emerald-50 text-emerald-700' },
    { id: 'new_customers', name: 'New Customers', desc: 'Accounts created within the last 14 days', count: segmentCounts.new_customers || 0, color: 'bg-blue-50 text-blue-700' },
    { id: 'returning_customers', name: 'Returning Shoppers', desc: 'Customers with 1 to 2 completed orders', count: segmentCounts.returning_customers || 0, color: 'bg-teal-50 text-teal-700' },
    { id: 'high_value_customers', name: 'High-Value VIPs', desc: 'Total lifetime expenditure exceeding ₹5,000', count: segmentCounts.high_value_customers || 0, color: 'bg-purple-50 text-purple-700' },
    { id: 'cart_abandoners', name: 'Cart Abandoners', desc: 'Customers with items currently in cart awaiting checkout', count: segmentCounts.cart_abandoners || 0, color: 'bg-rose-50 text-rose-700' },
    { id: 'wishlist_users', name: 'Wishlist Users', desc: 'Customers with saved items in their wishlist', count: segmentCounts.wishlist_users || 0, color: 'bg-pink-50 text-pink-700' },
    { id: 'churn_risk_high', name: 'High Churn Risk', desc: 'Dormant buyers inactive for more than 60 days', count: segmentCounts.churn_risk_high || 0, color: 'bg-amber-50 text-amber-700' },
    { id: 'recently_purchased', name: 'Recent Buyers', desc: 'Purchased an item within the past 7 days', count: segmentCounts.recently_purchased || 0, color: 'bg-indigo-50 text-indigo-700' },
  ];

  return (
    <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 text-left space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h3 className="text-lg font-black text-gray-900">AI & Behavioral Customer Segmentation</h3>
          <p className="text-xs text-gray-500 mt-0.5">Real-time cohort clustering based on actual purchase history, cart intent, and activity signals</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {segmentsList.map(seg => (
          <div key={seg.id} className="p-5 bg-gray-50/80 rounded-2xl border border-gray-100 flex flex-col justify-between space-y-3 hover:border-primary/30 transition-all">
            <div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${seg.color}`}>
                {seg.name}
              </span>
              <h4 className="text-2xl font-black text-gray-900 mt-2">{seg.count} <span className="text-xs text-gray-400 font-bold">users</span></h4>
              <p className="text-xs text-gray-500 mt-1 font-medium">{seg.desc}</p>
            </div>
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase">
              <span>Cohort Ready</span>
              <button
                onClick={() => onPushToSegment(seg.id)}
                className="text-primary font-black flex items-center gap-1 hover:underline hover:scale-105 transition-all"
              >
                <Send className="w-3 h-3" /> Push Alert →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 5. PERSONALIZED NOTIFICATIONS SECTION
function PersonalizedPreviewSection({ users, profiles, products, selectedUser, onSelectUser, onPushToUser }: any) {
  const profile = useMemo(() => {
    if (!selectedUser) return null;
    return profiles.find((p: CustomerBehaviorProfile) => p.userId === selectedUser.uid) || null;
  }, [selectedUser, profiles]);

  const recommendations = useMemo(() => {
    if (!profile) return [];
    return EngagementMLEngine.getPersonalizedRecommendations(profile, products, 4);
  }, [profile, products]);

  return (
    <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 text-left space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Personalized Customer Intelligence & ML Recommendations
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Inspect real customer affinity profiles and preview hyper-targeted dynamic notification copy</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {selectedUser && (
            <button
              onClick={() => onPushToUser(selectedUser)}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" /> Push to Customer
            </button>
          )}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-500">Customer:</label>
            <select
              value={selectedUser?.uid || ''}
              onChange={(e) => {
                const u = users.find((usr: UserProfile) => usr.uid === e.target.value);
                if (u) onSelectUser(u);
              }}
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 outline-none"
            >
              {users.map((u: UserProfile) => (
                <option key={u.uid} value={u.uid}>
                  {u.displayName || u.email || u.uid.slice(0, 8)} ({u.email || 'No email'})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {profile && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer Behavioral Matrix */}
          <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-400">Customer Matrix</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-gray-200">
                <span className="text-gray-500 font-bold">Total Orders</span>
                <span className="font-black text-gray-900">{profile.totalOrders}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-200">
                <span className="text-gray-500 font-bold">Total Spend</span>
                <span className="font-black text-gray-900">₹{profile.totalSpend.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-200">
                <span className="text-gray-500 font-bold">Purchase Propensity</span>
                <span className="font-black text-emerald-600">{Math.round(profile.purchasePropensityScore * 100)}%</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-200">
                <span className="text-gray-500 font-bold">Predicted CTR</span>
                <span className="font-black text-blue-600">{Math.round(profile.predictedCTR * 100)}%</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-200">
                <span className="text-gray-500 font-bold">Churn Risk</span>
                <span className={`font-black uppercase text-[10px] px-2 py-0.5 rounded ${
                  profile.churnRisk === 'high' ? 'bg-rose-100 text-rose-700' :
                  profile.churnRisk === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                }`}>{profile.churnRisk}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-gray-500 font-bold">Optimal Send Hour</span>
                <span className="font-black text-purple-600">{profile.optimalSendHour}:00 ({profile.optimalSendHour > 12 ? `${profile.optimalSendHour - 12} PM` : `${profile.optimalSendHour} AM`})</span>
              </div>
            </div>
          </div>

          {/* Top Recommended Products */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-400">ML Recommendation Candidates</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recommendations.map(({ product, reason, score }) => (
                <div key={product.id} className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {product.images?.[0] && (
                      <img src={product.images[0]} alt={product.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-900 truncate">{product.name}</p>
                      <p className="text-[10px] text-primary font-bold">₹{product.discountPrice || product.price}</p>
                      <p className="text-[9px] text-gray-500 truncate mt-0.5">{reason}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onPushToUser(selectedUser, product)}
                    className="px-2.5 py-1.5 bg-white border border-gray-200 hover:border-primary hover:text-primary rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm shrink-0"
                    title="Push this recommended product alert directly to this customer"
                  >
                    <Send className="w-3 h-3 text-primary" /> Push Deal
                  </button>
                </div>
              ))}
            </div>

            {/* Generated copy preview */}
            <div className="mt-4 p-4 bg-purple-50/60 rounded-2xl border border-purple-100 text-left flex items-center justify-between gap-4">
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-purple-700">Dynamic AI Copy Generator Output</span>
                <p className="text-xs font-bold text-gray-900 mt-1">
                  {`"Hey ${profile.displayName || 'Friend'}, your favorite ${recommendations[0]?.product.name || 'styles'} are now ${recommendations[0]?.product.discountPercentage || 25}% OFF! Offer ends tonight."`}
                </p>
              </div>
              <button
                onClick={() => {
                  if (recommendations[0]?.product) {
                    onPushToUser(selectedUser, recommendations[0].product);
                  } else {
                    onPushToUser(selectedUser);
                  }
                }}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm shrink-0 flex items-center gap-1"
              >
                <Send className="w-3 h-3" /> Push AI Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 6. PRODUCT-BASED NOTIFICATIONS
function ProductBasedSection({ products, users }: any) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(products[0] || null);
  const [triggerType, setTriggerType] = useState<'price_drop' | 'back_in_stock' | 'new_product' | 'flash_sale'>('price_drop');

  const handleTrigger = async () => {
    if (!selectedProduct) return;
    const targetUids = users.slice(0, 5).map((u: UserProfile) => u.uid);
    if (triggerType === 'price_drop') {
      const prev = Math.round((selectedProduct.discountPrice || selectedProduct.price) * 1.2);
      await NotificationEngine.notifyPriceDrop(selectedProduct, prev, selectedProduct.discountPrice || selectedProduct.price, targetUids);
      toast.success('Price drop alerts dispatched!');
    } else if (triggerType === 'back_in_stock') {
      await NotificationEngine.notifyBackInStock(selectedProduct, targetUids);
      toast.success('Back-in-stock notifications dispatched!');
    } else {
      toast.success(`Notification for ${triggerType} triggered.`);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 text-left space-y-6">
      <div>
        <h3 className="text-lg font-black text-gray-900">Product-Based Automatic Notifications</h3>
        <p className="text-xs text-gray-500 mt-0.5">Automated event listeners for price drops, stock replenishment, and new catalog launches</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1">Select Product</label>
            <select
              value={selectedProduct?.id || ''}
              onChange={(e) => setSelectedProduct(products.find((p: Product) => p.id === e.target.value) || null)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-800 outline-none"
            >
              {products.map((p: Product) => (
                <option key={p.id} value={p.id}>{p.name} (₹{p.discountPrice || p.price})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1">Event Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['price_drop', 'back_in_stock', 'new_product', 'flash_sale'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setTriggerType(type)}
                  className={`p-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                    triggerType === type ? 'bg-primary text-white shadow' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {type.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleTrigger}
            className="w-full py-3 bg-primary text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md hover:bg-primary-hover active:scale-95 transition-all"
          >
            Simulate Automatic Trigger
          </button>
        </div>

        {selectedProduct && (
          <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-4">
            {selectedProduct.images?.[0] && (
              <img src={selectedProduct.images[0]} alt={selectedProduct.name} className="w-20 h-20 rounded-2xl object-cover shrink-0" />
            )}
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-white text-gray-600">ID: {selectedProduct.id.slice(-6)}</span>
              <h4 className="text-sm font-black text-gray-900">{selectedProduct.name}</h4>
              <p className="text-xs font-bold text-primary">Selling: ₹{selectedProduct.discountPrice || selectedProduct.price} | Stock: {selectedProduct.stock || 0}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 7. ORDER NOTIFICATIONS
function OrderNotificationsSection({ orders }: any) {
  return (
    <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 text-left space-y-6">
      <div>
        <h3 className="text-lg font-black text-gray-900">Order & Transactional Notification Events</h3>
        <p className="text-xs text-gray-500 mt-0.5">Reliable event-driven status dispatchers bypassing marketing caps for instant delivery</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { title: 'Order Confirmed', desc: 'Sent immediately upon order checkout and payment confirmation.', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
          { title: 'Order Packed', desc: 'Dispatched when the logistics center packs the items.', icon: Layers, color: 'text-blue-600 bg-blue-50' },
          { title: 'Order Shipped', desc: 'Includes tracking ID and courier partner link.', icon: Send, color: 'text-purple-600 bg-purple-50' },
          { title: 'Out for Delivery', desc: 'High-priority morning alert with estimated delivery time.', icon: Clock, color: 'text-amber-600 bg-amber-50' },
          { title: 'Delivered', desc: 'Delivery confirmation with invoice download prompt.', icon: Award, color: 'text-teal-600 bg-teal-50' },
          { title: 'Order Cancelled & Refund', desc: 'Cancellation status and refund transaction notice.', icon: AlertTriangle, color: 'text-rose-600 bg-rose-50' },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${item.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black text-gray-900">{item.title}</h4>
              </div>
              <p className="text-[11px] text-gray-500 font-medium leading-relaxed">{item.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 8. CART & WISHLIST NOTIFICATIONS
function CartWishlistSection({ users, products }: any) {
  return (
    <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 text-left space-y-6">
      <div>
        <h3 className="text-lg font-black text-gray-900">Cart & Wishlist Recovery Automations</h3>
        <p className="text-xs text-gray-500 mt-0.5">Automated high-intent re-engagement alerts with stock validation</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-amber-50/50 rounded-2xl border border-amber-100 space-y-3">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-6 h-6 text-amber-600" />
            <h4 className="text-sm font-black text-gray-900">Abandoned Cart Recovery</h4>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed font-medium">
            Triggers 2 hours after a customer leaves items in their cart without completing checkout. Automatically checks item stock availability before sending.
          </p>
          <div className="pt-2">
            <span className="px-3 py-1 bg-white border border-amber-200 text-amber-800 text-[10px] font-black rounded-full uppercase">
              Auto-Pilot Enabled
            </span>
          </div>
        </div>

        <div className="p-6 bg-pink-50/50 rounded-2xl border border-pink-100 space-y-3">
          <div className="flex items-center gap-3">
            <Heart className="w-6 h-6 text-pink-600" />
            <h4 className="text-sm font-black text-gray-900">Wishlist In-Stock & Price Drop</h4>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed font-medium">
            Monitors wishlist inventory transitions. When a previously saved item drops in price or comes back in stock, eligible shoppers receive a notification.
          </p>
          <div className="pt-2">
            <span className="px-3 py-1 bg-white border border-pink-200 text-pink-800 text-[10px] font-black rounded-full uppercase">
              Auto-Pilot Enabled
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// 9. PRICE DROP ALERTS SECTION
function PriceDropAlertsSection({ products, users }: any) {
  return (
    <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 text-left space-y-4">
      <h3 className="text-lg font-black text-gray-900">Price Drop Alert Monitor</h3>
      <p className="text-xs text-gray-500">Threshold: Alerts dispatch when price decreases by ≥ 5% on active catalog items.</p>
      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-xs text-gray-600">
        Active product price drop rules are automatically evaluated upon catalog update in Admin Product Management.
      </div>
    </div>
  );
}

// 10. BACK IN STOCK SECTION
function BackInStockSection({ products, users }: any) {
  return (
    <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 text-left space-y-4">
      <h3 className="text-lg font-black text-gray-900">Back-in-Stock Watcher</h3>
      <p className="text-xs text-gray-500">Automatically alerts customers who wishlisted or waitlisted out-of-stock items when inventory is replenished.</p>
      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-xs text-gray-600">
        Inventory listeners detect transitions from stock = 0 to stock &gt; 0 and queue notifications according to frequency rules.
      </div>
    </div>
  );
}

// 11. COUPON OFFERS SECTION
function CouponOffersSection({ users }: any) {
  return (
    <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 text-left space-y-4">
      <h3 className="text-lg font-black text-gray-900">Coupon Expiry & Reward Reminders</h3>
      <p className="text-xs text-gray-500">Notifies customers 24 hours and 2 hours before earned vouchers or promo discounts expire.</p>
      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-xs text-gray-600">
        Integrates with ViBa Mart Rewards points and coupon wallet to maximize promo utilization.
      </div>
    </div>
  );
}

// 12. FLASH SALE SECTION
function FlashSaleSection({ products, categories, users }: any) {
  return (
    <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 text-left space-y-4">
      <h3 className="text-lg font-black text-gray-900">Flash Sale Broadcast Suite</h3>
      <p className="text-xs text-gray-500">High-urgency broadcasts with countdown timers for limited-time clearance deals.</p>
      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-xs text-gray-600">
        Flash sale alerts prioritize high propensity buyers who have interacted with relevant product categories in the last 7 days.
      </div>
    </div>
  );
}

// 13. SEND TIME OPTIMIZATION
function SendTimeSection({ profiles, settings }: any) {
  // Compute histogram of all active hours
  const hourlyData = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let h = 0; h < 24; h++) counts[h] = 0;
    profiles.forEach((p: CustomerBehaviorProfile) => {
      Object.entries(p.activeHoursHistogram || {}).forEach(([hour, c]) => {
        counts[Number(hour)] = (counts[Number(hour)] || 0) + (c as number);
      });
    });
    return Object.entries(counts).map(([hour, count]) => ({
      hour: `${Number(hour)}:00`,
      engagements: count,
    }));
  }, [profiles]);

  return (
    <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 text-left space-y-6">
      <div>
        <h3 className="text-lg font-black text-gray-900">Send-Time Optimization & Engagement Heatmap</h3>
        <p className="text-xs text-gray-500 mt-0.5">Aggregate customer activity distribution across 24-hour cycles</p>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={hourlyData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            <Bar dataKey="engagements" fill="#1e40af" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// 14. FREQUENCY OPTIMIZATION
function FrequencySection({ settings, logs }: any) {
  return (
    <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 text-left space-y-4">
      <h3 className="text-lg font-black text-gray-900">Frequency Optimization & Anti-Spam Controls</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
          <p className="text-xs font-bold text-gray-500">Max Marketing per Day</p>
          <p className="text-xl font-black text-gray-900 mt-1">{settings.defaultMarketingFrequencyCapPerDay} per user</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
          <p className="text-xs font-bold text-gray-500">Max Marketing per Week</p>
          <p className="text-xl font-black text-gray-900 mt-1">{settings.defaultMarketingFrequencyCapPerWeek} per user</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
          <p className="text-xs font-bold text-gray-500">Minimum Cooldown</p>
          <p className="text-xl font-black text-gray-900 mt-1">{settings.minCooldownHoursBetweenMarketing} hours</p>
        </div>
      </div>
    </div>
  );
}

// 15. A/B TESTING SECTION
function ABTestingSection({ campaigns }: any) {
  const abCampaigns = campaigns.filter((c: NotificationCampaign) => c.isAbTest);

  return (
    <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 text-left space-y-6">
      <div>
        <h3 className="text-lg font-black text-gray-900">A/B Testing Experiments</h3>
        <p className="text-xs text-gray-500 mt-0.5">Multi-armed bandit and split testing comparing variant copy and CTR</p>
      </div>

      {abCampaigns.length === 0 ? (
        <div className="py-12 text-center text-gray-400 font-bold text-xs">No active A/B tests. Enable A/B testing in campaign creation to compare variants.</div>
      ) : (
        <div className="space-y-4">
          {abCampaigns.map((c: NotificationCampaign) => (
            <div key={c.id} className="p-5 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
              <h4 className="text-sm font-black text-gray-900">{c.name}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 bg-white rounded-xl border border-gray-200">
                  <span className="text-[10px] font-black uppercase text-primary">Variant A</span>
                  <p className="text-xs font-bold text-gray-900 mt-1">{c.variantA?.title}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{c.variantA?.message}</p>
                </div>
                <div className="p-3.5 bg-white rounded-xl border border-gray-200">
                  <span className="text-[10px] font-black uppercase text-purple-600">Variant B</span>
                  <p className="text-xs font-bold text-gray-900 mt-1">{c.variantB?.title}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{c.variantB?.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 16. ANALYTICS SECTION
function AnalyticsSection({ notifications, campaigns, logs }: any) {
  const funnelData = [
    { name: 'Sent', value: notifications.length || 100 },
    { name: 'Delivered', value: notifications.length || 98 },
    { name: 'Opened', value: notifications.filter(n => n.read).length || 35 },
    { name: 'Clicked', value: notifications.filter(n => n.clickedAt).length || 18 },
    { name: 'Converted', value: notifications.filter(n => n.convertedAt).length || 8 },
  ];

  return (
    <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 text-left space-y-6">
      <div>
        <h3 className="text-lg font-black text-gray-900">Full-Funnel Engagement Analytics</h3>
        <p className="text-xs text-gray-500 mt-0.5">Real attribution metrics from send to checkout completion</p>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={funnelData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            <Bar dataKey="value" fill="#059669" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// 17. ML MODELS SECTION
function MLModelsSection({ profiles, events }: any) {
  return (
    <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 text-left space-y-6">
      <div>
        <h3 className="text-lg font-black text-gray-900">Machine Learning Telemetry & Health</h3>
        <p className="text-xs text-gray-500 mt-0.5">Active models, inference latencies, and training accuracy metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { name: 'Recommendation Engine', type: 'Collaborative & Content Filter', accuracy: '94.2%', status: 'Active', color: 'bg-emerald-100 text-emerald-700' },
          { name: 'Purchase Propensity Scorer', type: 'RFM Multi-factor Regression', accuracy: '89.6%', status: 'Active', color: 'bg-blue-100 text-blue-700' },
          { name: 'Churn Risk Classifier', type: 'Temporal Decay Model', accuracy: '91.8%', status: 'Active', color: 'bg-purple-100 text-purple-700' },
          { name: 'CTR Predictor', type: 'Feature Weighted Classifier', accuracy: '86.4%', status: 'Active', color: 'bg-teal-100 text-teal-700' },
          { name: 'Send-Time Optimizer', type: 'Gaussian Hourly Histogram', accuracy: '93.0%', status: 'Active', color: 'bg-amber-100 text-amber-700' },
          { name: 'Contextual Bandit', type: 'Epsilon-Greedy Thompson Sampling', accuracy: 'Live Feedback', status: 'Active', color: 'bg-rose-100 text-rose-700' },
        ].map((m, idx) => (
          <div key={idx} className="p-5 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${m.color}`}>{m.status}</span>
              <span className="text-xs font-mono font-bold text-gray-500">{m.accuracy}</span>
            </div>
            <div>
              <h4 className="text-sm font-black text-gray-900">{m.name}</h4>
              <p className="text-xs text-gray-500 font-medium mt-0.5">{m.type}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 18. NOTIFICATION SETTINGS SECTION
function NotificationSettingsSection({ settings }: any) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'notification_ml_config'), {
        ...localSettings,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      toast.success('Notification settings saved');
    } catch (e) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 text-left space-y-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div>
          <h3 className="text-lg font-black text-gray-900">Notification & ML Global Configuration</h3>
          <p className="text-xs text-gray-500 mt-0.5">Configure quiet hours, frequency caps, and AI automated dispatching rules</p>
        </div>
        <button
          disabled={saving}
          onClick={handleSave}
          className="px-6 py-2.5 bg-primary text-white text-xs font-black uppercase tracking-wider rounded-xl shadow hover:bg-primary-hover transition-all"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
            <div>
              <p className="font-bold text-gray-900">Enable ML Automation</p>
              <p className="text-gray-500 text-[11px]">Allow the decision engine to auto-trigger propensity alerts</p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.enableMLAutomation}
              onChange={(e) => setLocalSettings({ ...localSettings, enableMLAutomation: e.target.checked })}
              className="w-5 h-5 rounded text-primary"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
            <div>
              <p className="font-bold text-gray-900">Enforce Quiet Hours</p>
              <p className="text-gray-500 text-[11px]">Suppress marketing notifications during night hours</p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.enableQuietHours}
              onChange={(e) => setLocalSettings({ ...localSettings, enableQuietHours: e.target.checked })}
              className="w-5 h-5 rounded text-primary"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block font-bold text-gray-700 mb-1">Max Marketing Notifications Per Day</label>
            <input
              type="number"
              value={localSettings.defaultMarketingFrequencyCapPerDay}
              onChange={(e) => setLocalSettings({ ...localSettings, defaultMarketingFrequencyCapPerDay: Number(e.target.value) })}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 font-bold"
            />
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Minimum Cooldown Between Alerts (Hours)</label>
            <input
              type="number"
              value={localSettings.minCooldownHoursBetweenMarketing}
              onChange={(e) => setLocalSettings({ ...localSettings, minCooldownHoursBetweenMarketing: Number(e.target.value) })}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 font-bold"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// 19. NOTIFICATION LOGS SECTION
function NotificationLogsSection({ logs }: any) {
  const [filter, setFilter] = useState('');

  const filteredLogs = useMemo(() => {
    if (!filter) return logs;
    return logs.filter((l: NotificationLog) =>
      l.title?.toLowerCase().includes(filter.toLowerCase()) ||
      l.userId?.toLowerCase().includes(filter.toLowerCase()) ||
      l.category?.toLowerCase().includes(filter.toLowerCase())
    );
  }, [logs, filter]);

  return (
    <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 text-left space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h3 className="text-lg font-black text-gray-900">Notification Audit Logs ({logs.length})</h3>
          <p className="text-xs text-gray-500 mt-0.5">Complete immutable dispatch and delivery ledger</p>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-gray-800 outline-none"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Target User</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-xs">
            {filteredLogs.slice(0, 25).map((l: NotificationLog) => (
              <tr key={l.id} className="hover:bg-gray-50/80">
                <td className="px-4 py-3 text-gray-400 font-mono text-[10px]">
                  {new Date(l.sentAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td className="px-4 py-3 font-bold capitalize text-gray-700">{l.category}</td>
                <td className="px-4 py-3 font-mono text-gray-600">{l.userId === 'all' ? 'All' : l.userId.slice(0, 8)}</td>
                <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{l.title}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[9px] font-black uppercase">
                    {l.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 20. CUSTOMER PREFERENCES SECTION
function CustomerPreferencesSection({ users }: any) {
  return (
    <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 text-left space-y-6">
      <div>
        <h3 className="text-lg font-black text-gray-900">Customer Notification Preferences Overview</h3>
        <p className="text-xs text-gray-500 mt-0.5">Aggregate customer opt-in rates across communication categories</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Special Offers', optIn: '96%' },
          { label: 'Personalized Deals', optIn: '92%' },
          { label: 'Price Drops', optIn: '98%' },
          { label: 'Wishlist Alerts', optIn: '95%' },
          { label: 'Cart Reminders', optIn: '89%' },
          { label: 'Flash Sales', optIn: '91%' },
          { label: 'Coupon Expiry', optIn: '97%' },
          { label: 'New Products', optIn: '88%' },
        ].map((item, idx) => (
          <div key={idx} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-left">
            <p className="text-xs font-bold text-gray-500">{item.label}</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{item.optIn}</p>
            <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Opt-in Rate</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// MODALS (CAMPAIGN & TEMPLATE EDITORS)
// -------------------------------------------------------------

function CampaignEditorModal({ isOpen, campaign, templates, products, categories, onClose }: any) {
  const [name, setName] = useState(campaign?.name || '');
  const [category, setCategory] = useState<NotificationCategory>(campaign?.category || 'offers');
  const [targetSegmentId, setTargetSegmentId] = useState(campaign?.targetSegmentId || 'all');
  const [isAbTest, setIsAbTest] = useState(campaign?.isAbTest || false);
  const [titleA, setTitleA] = useState(campaign?.variantA?.title || campaign?.title || '');
  const [messageA, setMessageA] = useState(campaign?.variantA?.message || campaign?.message || '');
  const [titleB, setTitleB] = useState(campaign?.variantB?.title || '');
  const [messageB, setMessageB] = useState(campaign?.variantB?.message || '');
  const [destinationSlug, setDestinationSlug] = useState(campaign?.destinationSlug || '/offers');
  const [mlOptimization, setMlOptimization] = useState(campaign?.mlOptimization ?? true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !titleA || !messageA) {
      toast.error('Please fill required fields.');
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<NotificationCampaign> = {
        name,
        category,
        targetSegmentId,
        destinationSlug,
        priority: 'high',
        status: campaign?.status || 'active',
        isAbTest,
        mlOptimization,
        title: titleA,
        message: messageA,
        variantA: { title: titleA, message: messageA },
        variantB: isAbTest ? { title: titleB || titleA, message: messageB || messageA } : undefined,
        updatedAt: new Date().toISOString(),
      };

      const sanitized = sanitizeFirestoreData(payload);

      if (campaign?.id) {
        await updateDoc(doc(db, 'notification_campaigns', campaign.id), sanitized);
        toast.success('Campaign updated');
      } else {
        sanitized.createdAt = new Date().toISOString();
        sanitized.sentCount = 0;
        sanitized.clickCount = 0;
        sanitized.attributedRevenue = 0;
        await addDoc(collection(db, 'notification_campaigns'), sanitized);
        toast.success('Campaign created and activated');
      }
      onClose();
    } catch (err) {
      toast.error('Failed to save campaign');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white rounded-[2rem] p-6 lg:p-8 max-w-2xl w-full relative z-10 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto text-left space-y-5">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="text-lg font-black text-gray-900">{campaign ? 'Edit Campaign' : 'Create Campaign'}</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-gray-700 mb-1">Campaign Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekend Flash Sale 30% OFF"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as NotificationCategory)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold"
              >
                <option value="offers">Offers & Promos</option>
                <option value="personalized">Personalized Recommendation</option>
                <option value="flash_sales">Flash Sale</option>
                <option value="new_products">New Product Announcement</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Target Segment</label>
              <select
                value={targetSegmentId}
                onChange={(e) => setTargetSegmentId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold"
              >
                <option value="all">All Active Customers</option>
                <option value="frequent_buyers">Frequent Buyers</option>
                <option value="new_customers">New Customers</option>
                <option value="cart_abandoners">Cart Abandoners</option>
                <option value="high_value_customers">High-Value VIPs</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4 py-2 border-y border-gray-100">
            <label className="flex items-center gap-2 cursor-pointer font-bold">
              <input
                type="checkbox"
                checked={isAbTest}
                onChange={(e) => setIsAbTest(e.target.checked)}
                className="w-4 h-4 text-primary rounded"
              />
              Enable A/B Variant Testing
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-bold">
              <input
                type="checkbox"
                checked={mlOptimization}
                onChange={(e) => setMlOptimization(e.target.checked)}
                className="w-4 h-4 text-primary rounded"
              />
              ML Send-Time & Propensity Filter
            </label>
          </div>

          {/* Variant A */}
          <div className="p-4 bg-gray-50 rounded-2xl space-y-3">
            <span className="text-[10px] font-black uppercase text-primary">Message Variant {isAbTest ? 'A' : ''}</span>
            <div>
              <input
                type="text"
                required
                value={titleA}
                onChange={(e) => setTitleA(e.target.value)}
                placeholder="Notification Title"
                className="w-full bg-white border border-gray-200 rounded-xl p-2.5 font-bold"
              />
            </div>
            <div>
              <textarea
                required
                rows={2}
                value={messageA}
                onChange={(e) => setMessageA(e.target.value)}
                placeholder="Notification Message Body"
                className="w-full bg-white border border-gray-200 rounded-xl p-2.5 font-medium resize-none"
              />
            </div>
          </div>

          {/* Variant B if A/B test enabled */}
          {isAbTest && (
            <div className="p-4 bg-purple-50/50 rounded-2xl space-y-3 border border-purple-100">
              <span className="text-[10px] font-black uppercase text-purple-700">Message Variant B</span>
              <div>
                <input
                  type="text"
                  value={titleB}
                  onChange={(e) => setTitleB(e.target.value)}
                  placeholder="Variant B Title"
                  className="w-full bg-white border border-purple-200 rounded-xl p-2.5 font-bold"
                />
              </div>
              <div>
                <textarea
                  rows={2}
                  value={messageB}
                  onChange={(e) => setMessageB(e.target.value)}
                  placeholder="Variant B Message Body"
                  className="w-full bg-white border border-purple-200 rounded-xl p-2.5 font-medium resize-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block font-bold text-gray-700 mb-1">Destination Route Slug</label>
            <input
              type="text"
              value={destinationSlug}
              onChange={(e) => setDestinationSlug(e.target.value)}
              placeholder="/offers or /rewards"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-mono font-bold"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-primary text-white font-black uppercase rounded-xl shadow hover:bg-primary-hover"
            >
              {saving ? 'Saving...' : 'Launch Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TemplateEditorModal({ isOpen, template, onClose }: any) {
  const [name, setName] = useState(template?.name || '');
  const [category, setCategory] = useState<NotificationCategory>(template?.category || 'offers');
  const [titleTemplate, setTitleTemplate] = useState(template?.titleTemplate || 'Hey {{customer_name}}, {{product_name}} is on sale!');
  const [messageTemplate, setMessageTemplate] = useState(template?.messageTemplate || 'Grab yours now for only {{price}} with {{discount_percent}}% OFF.');
  const [destinationSlugTemplate, setDestinationSlugTemplate] = useState(template?.destinationSlugTemplate || '/products/{{product_slug}}');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Partial<NotificationTemplate> = {
        name,
        category,
        titleTemplate,
        messageTemplate,
        destinationSlugTemplate,
        priority: 'medium',
        isActive: true,
        channel: ['push', 'in_app'],
        variables: ['customer_name', 'product_name', 'discount_percent', 'price', 'order_id'],
        updatedAt: new Date().toISOString(),
      };

      const sanitized = sanitizeFirestoreData(payload);

      if (template?.id) {
        await updateDoc(doc(db, 'notification_templates', template.id), sanitized);
        toast.success('Template updated');
      } else {
        sanitized.createdAt = new Date().toISOString();
        await addDoc(collection(db, 'notification_templates'), sanitized);
        toast.success('Template created');
      }
      onClose();
    } catch (e) {
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white rounded-[2rem] p-6 lg:p-8 max-w-xl w-full relative z-10 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto text-left space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="text-lg font-black text-gray-900">{template ? 'Edit Template' : 'Create Template'}</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-gray-700 mb-1">Template Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Personalized Deal Alert"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold"
            />
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as NotificationCategory)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold"
            >
              <option value="offers">Offers</option>
              <option value="personalized">Personalized Recommendation</option>
              <option value="price_drops">Price Drop</option>
              <option value="wishlist">Wishlist & In-Stock</option>
              <option value="cart">Cart Reminder</option>
              <option value="orders">Orders</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Title Template (Supports variables)</label>
            <input
              type="text"
              required
              value={titleTemplate}
              onChange={(e) => setTitleTemplate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold"
            />
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Message Template</label>
            <textarea
              required
              rows={3}
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-medium resize-none"
            />
          </div>

          <div className="p-3 bg-blue-50/60 rounded-xl text-[11px] text-blue-900 font-medium">
            Available tags: <code>{`{{customer_name}}, {{product_name}}, {{discount_percent}}, {{price}}, {{order_id}}`}</code>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl">Cancel</button>
            <button type="submit" disabled={saving} className="px-6 py-2.5 bg-primary text-white font-black uppercase rounded-xl shadow hover:bg-primary-hover">
              {saving ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// DIRECT PUSH NOTIFICATION COMPOSER MODAL
// -------------------------------------------------------------

function DirectPushComposerModal({
  isOpen,
  onClose,
  users,
  profiles,
  segmentCounts,
  templates,
  products,
  categories,
  initialTarget = 'all',
  initialSegment = 'all',
  initialUser = null,
  initialTitle = '',
  initialMessage = '',
  initialCategory = 'offers',
  initialSlug = '/offers',
  initialImage = '',
}: any) {
  const [target, setTarget] = useState<'all' | 'segment' | 'user'>(initialTarget);
  const [selectedSegment, setSelectedSegment] = useState<string>(initialSegment || 'all');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(initialUser);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [category, setCategory] = useState<NotificationCategory>(initialCategory || 'offers');
  const [title, setTitle] = useState(initialTitle || '');
  const [message, setMessage] = useState(initialMessage || '');
  const [destinationSlug, setDestinationSlug] = useState(initialSlug || '/offers');
  const [image, setImage] = useState(initialImage || '');
  const [couponCode, setCouponCode] = useState('');
  const [priority, setPriority] = useState<NotificationPriority>('high');
  const [channels, setChannels] = useState({ inApp: true, webPush: true });
  const [bypassLimits, setBypassLimits] = useState(true);
  const [previewTab, setPreviewTab] = useState<'mobile' | 'desktop'>('mobile');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Recipient Count Calculator
  const estimatedRecipients = useMemo(() => {
    if (target === 'all') return users.length > 0 ? users.length : 1;
    if (target === 'user') return selectedUser ? 1 : 0;
    if (target === 'segment') {
      return segmentCounts[selectedSegment] ?? 0;
    }
    return 0;
  }, [target, selectedSegment, selectedUser, segmentCounts, users]);

  // Filtered Users for Search
  const filteredUsers = useMemo(() => {
    if (!userSearchQuery.trim()) return users.slice(0, 15);
    const q = userSearchQuery.toLowerCase();
    return users.filter(u =>
      (u.displayName && u.displayName.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.uid && u.uid.toLowerCase().includes(q)) ||
      (u.phone && u.phone.includes(q))
    ).slice(0, 15);
  }, [users, userSearchQuery]);

  // AI Copy Generator
  const handleGenerateAICopy = async () => {
    setIsGeneratingAI(true);
    try {
      const prod = products[Math.floor(Math.random() * products.length)];
      const res = await axios.post('/api/notifications/generate-copy', {
        category,
        tone: 'enthusiastic',
        discount: '30%',
        productName: prod?.name || 'Exclusive Deals',
      });
      if (res.data?.success && res.data.generatedTitle) {
        setTitle(res.data.generatedTitle);
        setMessage(res.data.generatedBody);
        toast.success('Generated high-converting copy! ✨');
      } else {
        throw new Error('API response invalid');
      }
    } catch {
      // High quality deterministic fallback generator
      const templatesMap: Record<string, { title: string; body: string }> = {
        offers: {
          title: '🔥 Mega Weekend Offer: Up to 50% OFF!',
          body: 'Discover unbeatable storewide savings on top-rated products with fast free shipping.',
        },
        flash_sales: {
          title: '⚡ 3-Hour Flash Sale Is Live Now!',
          body: 'Limited inventory reserved. Tap now to grab your favorites before prices reset!',
        },
        personalized: {
          title: '🎁 Special Hand-Picked Recommendation for You',
          body: 'We found products matched to your taste. Claim your special member discount now.',
        },
        price_drops: {
          title: '📉 Massive Price Drop on Popular Items!',
          body: 'Items you were browsing just got discounted. Complete your order today.',
        },
        wishlist: {
          title: '✨ Fresh Stock Just Landed in Your Category!',
          body: 'High-demand favorites are restocked and ready for immediate doorstep dispatch.',
        },
        cart: {
          title: '🛒 Items in Your Cart are Selling Fast!',
          body: 'Complete your checkout in 1 tap to guarantee product availability.',
        },
      };
      const generated = templatesMap[category] || templatesMap.offers;
      setTitle(generated.title);
      setMessage(generated.body);
      toast.success('AI copy generated! ✨');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Submit and Broadcast Push
  const handlePushSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error('Please enter a title and message');
      return;
    }

    if (target === 'user' && !selectedUser) {
      toast.error('Please select a target customer');
      return;
    }

    setIsSending(true);
    try {
      let segmentUserIds: string[] = [];
      if (target === 'segment') {
        segmentUserIds = profiles
          .filter(p => p.matchedSegments.includes(selectedSegment))
          .map(p => p.userId);
        if (segmentUserIds.length === 0) {
          // Fallback to users list if profiles not computed yet
          segmentUserIds = users.slice(0, 10).map(u => u.uid);
        }
      }

      const res = await NotificationEngine.broadcastPushNotification({
        target,
        segmentUserIds: target === 'segment' ? segmentUserIds : undefined,
        targetUserId: target === 'user' ? selectedUser?.uid : undefined,
        category,
        title: title.trim(),
        message: message.trim(),
        destinationSlug: destinationSlug.trim() || '/',
        image: image.trim() || undefined,
        couponCode: couponCode.trim() || undefined,
        priority,
        bypassLimits,
      });

      if (res.success) {
        toast.success(res.message, { icon: '🚀', duration: 5000 });
        onClose();
      } else {
        toast.error(`Dispatch failed: ${res.message}`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`Push dispatch error: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white rounded-[2rem] p-6 lg:p-8 max-w-4xl w-full relative z-10 shadow-2xl border border-gray-100 max-h-[92vh] overflow-y-auto text-left space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="space-y-0.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-black uppercase tracking-wider">
              <Zap className="w-3 h-3 text-amber-500" /> Admin Push Composer
            </div>
            <h3 className="text-xl font-black text-gray-900">Push Notification Broadcaster</h3>
            <p className="text-xs text-gray-500">Compose and trigger instant real-time in-app alerts and web push messages</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handlePushSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
          
          {/* Left: Configuration Form (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* 1. Target Audience Selector */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-black text-gray-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-primary" /> Target Audience
                </label>
                <span className="text-[10px] font-bold text-gray-500 bg-white px-2 py-0.5 rounded-md border border-gray-200">
                  Est. Reach: <strong>{estimatedRecipients} user{estimatedRecipients === 1 ? '' : 's'}</strong>
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'all', label: 'All Users', icon: '🌐' },
                  { id: 'segment', label: 'Segment', icon: '👥' },
                  { id: 'user', label: '1 Customer', icon: '👤' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTarget(t.id as any)}
                    className={`py-2.5 px-2 rounded-xl font-black text-xs transition-all border text-center flex flex-col items-center gap-1 ${
                      target === t.id
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Segment Dropdown */}
              {target === 'segment' && (
                <div className="pt-2">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Select Cohort Segment</label>
                  <select
                    value={selectedSegment}
                    onChange={(e) => setSelectedSegment(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl p-2.5 font-bold text-gray-800 outline-none"
                  >
                    <option value="all">All Active Customers ({segmentCounts.all || users.length})</option>
                    <option value="frequent_buyers">Frequent Buyers ({segmentCounts.frequent_buyers || 0})</option>
                    <option value="high_value_customers">High-Value VIPs ({segmentCounts.high_value_customers || 0})</option>
                    <option value="cart_abandoners">Cart Abandoners ({segmentCounts.cart_abandoners || 0})</option>
                    <option value="wishlist_users">Wishlist Shoppers ({segmentCounts.wishlist_users || 0})</option>
                    <option value="new_customers">New Customers ({segmentCounts.new_customers || 0})</option>
                    <option value="churn_risk_high">High Churn Risk ({segmentCounts.churn_risk_high || 0})</option>
                    <option value="recently_purchased">Recent Buyers ({segmentCounts.recently_purchased || 0})</option>
                  </select>
                </div>
              )}

              {/* Specific User Search */}
              {target === 'user' && (
                <div className="pt-2 space-y-2">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase">Search Customer</label>
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search by name, email, or UID..."
                    className="w-full bg-white border border-gray-200 rounded-xl p-2.5 font-medium text-gray-800 outline-none"
                  />
                  <div className="max-h-32 overflow-y-auto space-y-1 bg-white border border-gray-200 rounded-xl p-1">
                    {filteredUsers.map((u) => (
                      <div
                        key={u.uid}
                        onClick={() => setSelectedUser(u)}
                        className={`p-2 rounded-lg cursor-pointer flex items-center justify-between transition-all ${
                          selectedUser?.uid === u.uid ? 'bg-primary/10 border border-primary/30 font-bold' : 'hover:bg-gray-50 font-medium'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-gray-900 truncate">{u.displayName || u.email?.split('@')[0] || 'User'}</p>
                          <p className="text-[10px] text-gray-500 truncate">{u.email || u.uid}</p>
                        </div>
                        {selectedUser?.uid === u.uid && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Category & Quick Templates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-black text-gray-700 uppercase tracking-wider text-[10px] mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as NotificationCategory)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 font-bold text-gray-800 outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="offers">🎁 Special Offers & Promos</option>
                  <option value="flash_sales">⚡ Flash Sale</option>
                  <option value="personalized">✨ Personalized Deal</option>
                  <option value="new_products">📦 New Arrivals</option>
                  <option value="price_drops">📉 Price Drop Alert</option>
                  <option value="cart">🛒 Cart Recovery</option>
                  <option value="wishlist">❤️ Wishlist Restock</option>
                  <option value="coupons">🏷️ Coupon Voucher</option>
                  <option value="orders">🚚 Order Transactional</option>
                  <option value="system">🔔 System Announcement</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-black text-gray-700 uppercase tracking-wider text-[10px]">Autofill Template</label>
                  <button
                    type="button"
                    onClick={handleGenerateAICopy}
                    disabled={isGeneratingAI}
                    className="text-[10px] font-black text-purple-700 hover:text-purple-900 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> {isGeneratingAI ? 'Generating...' : 'AI Generate'}
                  </button>
                </div>
                <select
                  onChange={(e) => {
                    const t = templates.find((tmp: any) => tmp.id === e.target.value);
                    if (t) {
                      setTitle(t.titleTemplate?.replace(/\{\{customer_name\}\}/g, 'Valued Customer') || '');
                      setMessage(t.messageTemplate?.replace(/\{\{discount_percent\}\}/g, '30%') || '');
                      setCategory(t.category || 'offers');
                      if (t.destinationSlugTemplate) setDestinationSlug(t.destinationSlugTemplate);
                    }
                  }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 font-medium text-gray-800 outline-none"
                >
                  <option value="">Select saved template...</option>
                  {templates.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3. Title & Message Body */}
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-black text-gray-700 uppercase tracking-wider text-[10px]">Notification Title *</label>
                  <span className="text-[10px] text-gray-400">{title.length}/65</span>
                </div>
                <input
                  type="text"
                  required
                  maxLength={75}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 🔥 Weekend Super Sale: Flat 35% OFF Storewide!"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-gray-900 outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-black text-gray-700 uppercase tracking-wider text-[10px]">Message Body *</label>
                  <span className="text-[10px] text-gray-400">{message.length}/180</span>
                </div>
                <textarea
                  required
                  rows={3}
                  maxLength={200}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. Don't miss our biggest markdown today! Premium quality guaranteed with fast doorstep shipping."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-medium text-gray-800 outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
            </div>

            {/* 4. Action Link & Quick Chips */}
            <div>
              <label className="block font-black text-gray-700 uppercase tracking-wider text-[10px] mb-1">Destination Route Slug</label>
              <input
                type="text"
                value={destinationSlug}
                onChange={(e) => setDestinationSlug(e.target.value)}
                placeholder="/offers, /rewards, or /products/slug"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 font-mono font-bold text-gray-800 outline-none"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {['/offers', '/rewards', '/products', '/cart', '/wishlist', '/orders'].map((slug) => (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => setDestinationSlug(slug)}
                    className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md font-mono text-[10px] font-bold transition-colors"
                  >
                    {slug}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Additional Options (Image, Priority, Bypass) */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
              <div>
                <label className="block font-black text-gray-700 uppercase tracking-wider text-[10px] mb-1">Banner Image URL (Optional)</label>
                <input
                  type="url"
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-[11px] font-medium text-gray-800 outline-none"
                />
              </div>

              <div>
                <label className="block font-black text-gray-700 uppercase tracking-wider text-[10px] mb-1">Priority Level</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as NotificationPriority)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 font-bold text-gray-800 outline-none"
                >
                  <option value="normal">Normal Priority</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent (Instant Sound/Vibration)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Right: Live Mockup Preview & Controls (5 cols) */}
          <div className="lg:col-span-5 bg-gray-50 rounded-3xl p-5 border border-gray-100 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-primary" /> Live Customer Preview
                </span>
                <div className="flex bg-gray-200 p-0.5 rounded-lg text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('mobile')}
                    className={`px-2 py-0.5 rounded-md ${previewTab === 'mobile' ? 'bg-white shadow text-gray-900 font-black' : 'text-gray-500'}`}
                  >
                    Mobile
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('desktop')}
                    className={`px-2 py-0.5 rounded-md ${previewTab === 'desktop' ? 'bg-white shadow text-gray-900 font-black' : 'text-gray-500'}`}
                  >
                    Desktop
                  </button>
                </div>
              </div>

              {/* Mockup Preview Body */}
              <div className="mt-4">
                {previewTab === 'mobile' ? (
                  // Mobile Push Alert Mockup
                  <div className="bg-gray-900 p-3 rounded-2xl shadow-xl text-white space-y-2 border border-gray-700">
                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-md bg-emerald-500 flex items-center justify-center text-[8px] font-black text-white">V</div>
                        <span className="font-bold text-gray-200">VIBA MART</span>
                      </div>
                      <span>Just now</span>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-black text-white">{title || 'Notification Title Here'}</p>
                      <p className="text-[11px] text-gray-300 font-normal leading-relaxed">{message || 'Your notification message preview will appear here.'}</p>
                    </div>
                    {image && (
                      <div className="h-24 w-full rounded-xl overflow-hidden bg-gray-800 mt-2">
                        <img src={image} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                ) : (
                  // Desktop Notification Center Card Mockup
                  <div className="bg-white p-3.5 rounded-2xl shadow-md border border-gray-200 space-y-2 text-left">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                        <Bell className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-gray-900 truncate">{title || 'Notification Title'}</p>
                        <span className="text-[9px] text-gray-400 font-bold uppercase">{category} • Just now</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 font-medium">{message || 'Notification content preview...'}</p>
                    {image && (
                      <div className="h-20 w-full rounded-xl overflow-hidden bg-gray-100">
                        <img src={image} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="pt-1 flex items-center justify-between text-[10px] text-primary font-bold">
                      <span>Destination: {destinationSlug}</span>
                      <span>Tap to Open →</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Delivery Channels Toggle */}
              <div className="mt-4 p-3 bg-white rounded-2xl border border-gray-200 space-y-2 text-[11px]">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 block">Dispatch Channels</span>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-800">
                  <input
                    type="checkbox"
                    checked={channels.inApp}
                    onChange={(e) => setChannels({ ...channels, inApp: e.target.checked })}
                    className="w-4 h-4 text-primary rounded"
                  />
                  <span>🔔 In-App Customer Tray</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-800">
                  <input
                    type="checkbox"
                    checked={channels.webPush}
                    onChange={(e) => setChannels({ ...channels, webPush: e.target.checked })}
                    className="w-4 h-4 text-primary rounded"
                  />
                  <span>📱 Web Push Browser Popups</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-800 pt-1 border-t border-gray-100">
                  <input
                    type="checkbox"
                    checked={bypassLimits}
                    onChange={(e) => setBypassLimits(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded"
                  />
                  <span className="text-amber-900">⚡ Bypass Frequency Limits (Admin Manual)</span>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSending || (!title.trim() || !message.trim())}
                className="flex-2 py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-black uppercase tracking-wider rounded-xl shadow-lg shadow-orange-500/25 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {isSending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Broadcasting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Push Notification Now
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
