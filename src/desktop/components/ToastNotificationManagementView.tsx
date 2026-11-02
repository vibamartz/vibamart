import React, { useState, useEffect, useMemo } from 'react';
import {
  Bell, CheckCircle2, AlertTriangle, XCircle, Search, Plus, Save,
  RotateCcw, Filter, Check, X, Edit3, Trash2, Shield, Eye,
  Sparkles, RefreshCw, Smartphone, Layers, AlertCircle, Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../backend/store';
import { logAdminAction, AdminAction } from '../../backend/services/adminLogService';
import { ToastType } from '../../shared/components/toast/types';
import {
  ToastNotificationConfigItem,
  ToastModuleId,
  TOAST_MODULES,
  DEFAULT_TOAST_NOTIFICATIONS,
  fetchToastNotificationSettings,
  saveToastNotificationSettings,
  subscribeToastNotificationSettings
} from '../../shared/types/toastNotificationManagement';

export default function ToastNotificationManagementView() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin' || user?.email === 'vk311779@gmail.com';

  const [notifications, setNotifications] = useState<ToastNotificationConfigItem[]>([]);
  const [initialNotifications, setInitialNotifications] = useState<ToastNotificationConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters & Search
  const [selectedModule, setSelectedModule] = useState<ToastModuleId | 'all'>('all');
  const [selectedType, setSelectedType] = useState<ToastType | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [editingItem, setEditingItem] = useState<ToastNotificationConfigItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItem, setNewItem] = useState<Partial<ToastNotificationConfigItem>>({
    module: 'cart',
    type: 'success',
    title: '',
    message: '',
    operationKey: '',
    matchPatterns: [],
    enabled: true,
    description: '',
    isCustom: true
  });
  const [patternsInput, setPatternsInput] = useState('');

  // Track if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (loading) return false;
    if (notifications.length !== initialNotifications.length) return true;
    return JSON.stringify(notifications) !== JSON.stringify(initialNotifications);
  }, [notifications, initialNotifications, loading]);

  const unsavedCount = useMemo(() => {
    if (!hasUnsavedChanges) return 0;
    let count = 0;
    const initialMap = new Map(initialNotifications.map(i => [i.id, i]));
    notifications.forEach(n => {
      const orig = initialMap.get(n.id);
      if (!orig || JSON.stringify(orig) !== JSON.stringify(n)) {
        count++;
      }
    });
    return count;
  }, [notifications, initialNotifications, hasUnsavedChanges]);

  // Load toast notifications from Firestore
  useEffect(() => {
    let isMounted = true;
    const unsubscribe = subscribeToastNotificationSettings((items) => {
      if (isMounted) {
        setNotifications(items);
        setInitialNotifications(items);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Save changes to Firestore
  const handleSaveChanges = async () => {
    setSaving(true);
    const toastId = toast.loading('Saving Toast Notification messages...');
    try {
      await saveToastNotificationSettings(notifications, user?.email || undefined);
      await logAdminAction(
        AdminAction.SETTINGS_UPDATE,
        `Admin updated ${unsavedCount} toast notification message configuration(s).`,
        'toast_notifications',
        'settings'
      );
      setInitialNotifications([...notifications]);
      toast.success('Toast Notification messages saved successfully!', { id: toastId });
    } catch (error: any) {
      console.error('Failed to save toast notification settings:', error);
      toast.error(error.message || 'Failed to save toast notification messages.', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  // Reset to default official configuration
  const handleResetToDefault = async () => {
    if (!window.confirm('Are you sure you want to restore all toast notifications to system defaults? Any custom added or modified messages will be overwritten.')) {
      return;
    }
    setSaving(true);
    const toastId = toast.loading('Resetting to default messages...');
    try {
      await saveToastNotificationSettings(DEFAULT_TOAST_NOTIFICATIONS, user?.email || undefined);
      setNotifications([...DEFAULT_TOAST_NOTIFICATIONS]);
      setInitialNotifications([...DEFAULT_TOAST_NOTIFICATIONS]);
      toast.success('Toast notifications restored to system defaults!', { id: toastId });
    } catch (error: any) {
      console.error('Failed to reset toast notifications:', error);
      toast.error('Failed to reset toast notifications.', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  // Toggle enable/disable for a single item
  const handleToggleEnabled = (id: string) => {
    setNotifications(prev =>
      prev.map(item =>
        item.id === id ? { ...item, enabled: !item.enabled, updatedAt: new Date().toISOString() } : item
      )
    );
  };

  // Trigger preview toast
  const handleTestNotification = (item: ToastNotificationConfigItem) => {
    if (!item.enabled) {
      toast.warning(`"${item.title}" is currently DISABLED by Admin and will not be displayed to users.`);
      return;
    }

    if (item.type === 'success') {
      toast.success(item.message, { title: item.title });
    } else if (item.type === 'error') {
      toast.error(item.message, { title: item.title });
    } else {
      toast.warning(item.message, { title: item.title });
    }
  };

  // Delete custom notification
  const handleDeleteNotification = (id: string) => {
    if (!window.confirm('Are you sure you want to delete this custom notification message?')) return;
    setNotifications(prev => prev.filter(item => item.id !== id));
    toast.success('Notification message removed from list. Remember to Save Changes.');
  };

  // Save edited notification from modal
  const handleSaveEditModal = () => {
    if (!editingItem) return;
    if (!editingItem.title.trim() || !editingItem.message.trim()) {
      toast.error('Both Title and Message are required.');
      return;
    }

    setNotifications(prev =>
      prev.map(item =>
        item.id === editingItem.id
          ? {
              ...editingItem,
              matchPatterns: patternsInput
                .split(',')
                .map(p => p.trim())
                .filter(Boolean),
              updatedAt: new Date().toISOString(),
              updatedBy: user?.email || 'Admin'
            }
          : item
      )
    );
    setEditingItem(null);
    toast.success('Notification updated locally. Remember to click "Save Changes" to publish.');
  };

  // Add new notification
  const handleAddNewNotification = () => {
    if (!newItem.title?.trim() || !newItem.message?.trim() || !newItem.operationKey?.trim()) {
      toast.error('Please enter Operation Key, Title, and Message.');
      return;
    }

    const newId = `custom_${Date.now()}_${newItem.operationKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
    const patterns = patternsInput
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);

    // If no patterns entered, default to the title and message text
    if (patterns.length === 0) {
      patterns.push(newItem.title.trim());
      patterns.push(newItem.message.trim());
    }

    const createdItem: ToastNotificationConfigItem = {
      id: newId,
      operationKey: newItem.operationKey.trim().toUpperCase(),
      matchPatterns: patterns,
      module: (newItem.module as ToastModuleId) || 'general',
      type: (newItem.type as ToastType) || 'success',
      title: newItem.title.trim(),
      message: newItem.message.trim(),
      enabled: newItem.enabled ?? true,
      description: newItem.description?.trim() || 'Custom notification message created by Admin.',
      isCustom: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: user?.email || 'Admin'
    };

    setNotifications(prev => [createdItem, ...prev]);
    setIsAddModalOpen(false);
    setNewItem({
      module: 'cart',
      type: 'success',
      title: '',
      message: '',
      operationKey: '',
      matchPatterns: [],
      enabled: true,
      description: '',
      isCustom: true
    });
    setPatternsInput('');
    toast.success('New notification added! Click "Save Changes" to publish globally.');
  };

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter(item => {
      // Module filter
      if (selectedModule !== 'all' && item.module !== selectedModule) return false;

      // Type filter
      if (selectedType !== 'all' && item.type !== selectedType) return false;

      // Status filter
      if (selectedStatus === 'enabled' && !item.enabled) return false;
      if (selectedStatus === 'disabled' && item.enabled) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const inTitle = item.title.toLowerCase().includes(query);
        const inMessage = item.message.toLowerCase().includes(query);
        const inKey = item.operationKey.toLowerCase().includes(query);
        const inDesc = item.description?.toLowerCase().includes(query) ?? false;
        const inPatterns = item.matchPatterns?.some(p => p.toLowerCase().includes(query)) ?? false;
        if (!inTitle && !inMessage && !inKey && !inDesc && !inPatterns) return false;
      }

      return true;
    });
  }, [notifications, selectedModule, selectedType, selectedStatus, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = notifications.length;
    const successCount = notifications.filter(n => n.type === 'success').length;
    const warningCount = notifications.filter(n => n.type === 'warning').length;
    const errorCount = notifications.filter(n => n.type === 'error').length;
    const enabledCount = notifications.filter(n => n.enabled).length;
    const disabledCount = notifications.filter(n => !n.enabled).length;
    return { total, successCount, warningCount, errorCount, enabledCount, disabledCount };
  }, [notifications]);

  // Module counts
  const moduleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    notifications.forEach(n => {
      counts[n.module] = (counts[n.module] || 0) + 1;
    });
    return counts;
  }, [notifications]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-gray-100 shadow-sm">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
        <p className="text-gray-600 font-medium text-sm">Loading Toast Notification configurations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Global Actions */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                    Toast Notification Message Management
                  </h1>
                  {isSuperAdmin ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                      <Shield className="w-3 h-3" />
                      Super Admin
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                      Admin Access
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                  View, customize, enable/disable, and preview global Warning (Yellow), Error (Red), and Success (Green) toast messages.
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleResetToDefault}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              title="Reset all messages to system defaults"
            >
              <RotateCcw className="w-4 h-4 text-gray-500" />
              Reset to Defaults
            </button>

            <button
              type="button"
              onClick={() => {
                setNewItem({
                  module: selectedModule !== 'all' ? selectedModule : 'cart',
                  type: selectedType !== 'all' ? selectedType : 'success',
                  title: '',
                  message: '',
                  operationKey: '',
                  matchPatterns: [],
                  enabled: true,
                  description: '',
                  isCustom: true
                });
                setPatternsInput('');
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-600" />
              Add Notification
            </button>

            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={saving || !hasUnsavedChanges}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold text-white rounded-xl shadow-sm transition-all cursor-pointer ${
                hasUnsavedChanges
                  ? 'bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-500/20 animate-pulse'
                  : 'bg-gray-400 cursor-not-allowed opacity-60'
              }`}
            >
              <Save className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
              {saving ? 'Saving...' : hasUnsavedChanges ? `Save Changes (${unsavedCount})` : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Unsaved changes alert bar */}
        {hasUnsavedChanges && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-amber-800 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>
                You have <strong>{unsavedCount}</strong> unsaved notification modification(s). Click <strong>"Save Changes"</strong> to apply them globally across desktop and mobile.
              </span>
            </div>
            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={saving}
              className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition cursor-pointer flex-shrink-0"
            >
              Save Now
            </button>
          </div>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Messages</span>
          <span className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</span>
          <span className="text-[11px] text-gray-400 mt-0.5">Across {TOAST_MODULES.length} modules</span>
        </div>

        {/* Success */}
        <div
          onClick={() => setSelectedType(selectedType === 'success' ? 'all' : 'success')}
          className={`p-4 rounded-xl border transition-all cursor-pointer shadow-sm flex flex-col ${
            selectedType === 'success'
              ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/20'
              : 'bg-white border-gray-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Success</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-2xl font-bold text-emerald-700 mt-1">{stats.successCount}</span>
          <span className="text-[11px] text-emerald-600/80 mt-0.5">Green notifications</span>
        </div>

        {/* Warning */}
        <div
          onClick={() => setSelectedType(selectedType === 'warning' ? 'all' : 'warning')}
          className={`p-4 rounded-xl border transition-all cursor-pointer shadow-sm flex flex-col ${
            selectedType === 'warning'
              ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/20'
              : 'bg-white border-gray-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Warning</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <span className="text-2xl font-bold text-amber-700 mt-1">{stats.warningCount}</span>
          <span className="text-[11px] text-amber-600/80 mt-0.5">Yellow notifications</span>
        </div>

        {/* Error */}
        <div
          onClick={() => setSelectedType(selectedType === 'error' ? 'all' : 'error')}
          className={`p-4 rounded-xl border transition-all cursor-pointer shadow-sm flex flex-col ${
            selectedType === 'error'
              ? 'bg-red-50 border-red-400 ring-2 ring-red-400/20'
              : 'bg-white border-gray-200 hover:border-red-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-700 uppercase tracking-wider">Error</span>
            <XCircle className="w-4 h-4 text-red-600" />
          </div>
          <span className="text-2xl font-bold text-red-700 mt-1">{stats.errorCount}</span>
          <span className="text-[11px] text-red-600/80 mt-0.5">Red notifications</span>
        </div>

        {/* Enabled */}
        <div
          onClick={() => setSelectedStatus(selectedStatus === 'enabled' ? 'all' : 'enabled')}
          className={`p-4 rounded-xl border transition-all cursor-pointer shadow-sm flex flex-col ${
            selectedStatus === 'enabled'
              ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-400/20'
              : 'bg-white border-gray-200 hover:border-blue-300'
          }`}
        >
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Active</span>
          <span className="text-2xl font-bold text-blue-700 mt-1">{stats.enabledCount}</span>
          <span className="text-[11px] text-blue-600/80 mt-0.5">Currently enabled</span>
        </div>

        {/* Disabled */}
        <div
          onClick={() => setSelectedStatus(selectedStatus === 'disabled' ? 'all' : 'disabled')}
          className={`p-4 rounded-xl border transition-all cursor-pointer shadow-sm flex flex-col ${
            selectedStatus === 'disabled'
              ? 'bg-gray-100 border-gray-400 ring-2 ring-gray-400/20'
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Suppressed</span>
          <span className="text-2xl font-bold text-gray-700 mt-1">{stats.disabledCount}</span>
          <span className="text-[11px] text-gray-500 mt-0.5">Disabled by Admin</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, message text, operation key, or pattern..."
              className="w-full pl-9 pr-9 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Type Filter Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-gray-400 mr-1 hidden sm:inline">Type:</span>
            <button
              type="button"
              onClick={() => setSelectedType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedType === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Types ({stats.total})
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('success')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedType === 'success'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Success ({stats.successCount})
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('warning')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedType === 'warning'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Warning ({stats.warningCount})
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('error')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedType === 'error'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              Error ({stats.errorCount})
            </button>
          </div>
        </div>

        {/* Module Horizontal Scroll Tabs */}
        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
            <span className="text-gray-400 font-semibold uppercase tracking-wider text-[11px] shrink-0 mr-1">
              Modules:
            </span>

            <button
              type="button"
              onClick={() => setSelectedModule('all')}
              className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition cursor-pointer ${
                selectedModule === 'all'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Modules ({notifications.length})
            </button>

            {TOAST_MODULES.map(mod => {
              const count = moduleCounts[mod.id] || 0;
              const isActive = selectedModule === mod.id;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => setSelectedModule(mod.id)}
                  className={`px-3 py-1 rounded-lg whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-emerald-600 text-white font-bold shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span>{mod.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-white/30 text-white' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Notifications List Table / Cards */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Table header bar */}
        <div className="px-5 py-3.5 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <span>Showing {filteredNotifications.length} of {notifications.length} notifications</span>
            {selectedModule !== 'all' && (
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                {TOAST_MODULES.find(m => m.id === selectedModule)?.label}
              </span>
            )}
          </div>
          <div className="text-[11px] text-gray-400 font-normal normal-case">
            Changes are applied globally across both desktop & mobile apps
          </div>
        </div>

        {filteredNotifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-800">No toast notification messages found</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              No notifications matched your active filter or search criteria. Try selecting another module or resetting the search term.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedModule('all');
                setSelectedType('all');
                setSelectedStatus('all');
                setSearchQuery('');
              }}
              className="mt-4 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredNotifications.map((item) => {
              const moduleMeta = TOAST_MODULES.find(m => m.id === item.module);

              // Styling per type
              const typeBadge = {
                success: {
                  bg: 'bg-emerald-50',
                  text: 'text-emerald-700',
                  border: 'border-emerald-200',
                  icon: CheckCircle2,
                  label: 'Success'
                },
                warning: {
                  bg: 'bg-amber-50',
                  text: 'text-amber-700',
                  border: 'border-amber-200',
                  icon: AlertTriangle,
                  label: 'Warning'
                },
                error: {
                  bg: 'bg-red-50',
                  text: 'text-red-700',
                  border: 'border-red-200',
                  icon: XCircle,
                  label: 'Error'
                }
              }[item.type];

              const TypeIcon = typeBadge.icon;

              return (
                <div
                  key={item.id}
                  className={`p-4 sm:p-5 transition hover:bg-gray-50/70 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                    !item.enabled ? 'bg-gray-50/50 opacity-75' : ''
                  }`}
                >
                  {/* Left Column: Notification info */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Type Badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${typeBadge.bg} ${typeBadge.text} ${typeBadge.border}`}
                      >
                        <TypeIcon className="w-3.5 h-3.5" />
                        {typeBadge.label}
                      </span>

                      {/* Module Badge */}
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
                        {moduleMeta?.label || item.module}
                      </span>

                      {/* Operation Key */}
                      <span className="font-mono text-[11px] font-semibold text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                        {item.operationKey}
                      </span>

                      {/* Custom tag */}
                      {item.isCustom && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          Custom Added
                        </span>
                      )}

                      {/* Status indicator */}
                      {!item.enabled && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-200 text-gray-600">
                          Disabled (Suppressed)
                        </span>
                      )}
                    </div>

                    {/* Notification Title & Message Preview */}
                    <div>
                      <h4 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
                        <span>{item.title}</span>
                      </h4>
                      <p className="text-xs sm:text-sm text-gray-700 mt-0.5 font-normal leading-relaxed">
                        {item.message}
                      </p>
                    </div>

                    {/* Operational description / trigger notes */}
                    {item.description && (
                      <p className="text-[11px] text-gray-400 italic">
                        Trigger: {item.description}
                      </p>
                    )}
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex items-center gap-2.5 shrink-0 self-end lg:self-center">
                    {/* Enable / Disable Switch */}
                    <div className="flex items-center gap-2 mr-2">
                      <span className="text-xs font-medium text-gray-500">
                        {item.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleEnabled(item.id)}
                        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out ${
                          item.enabled ? 'bg-emerald-600' : 'bg-gray-300'
                        }`}
                        aria-label={`Toggle ${item.title}`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                            item.enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Test Live Toast Preview */}
                    <button
                      type="button"
                      onClick={() => handleTestNotification(item)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-2xs transition cursor-pointer"
                      title="Trigger this toast on your screen"
                    >
                      <Eye className="w-3.5 h-3.5 text-gray-500" />
                      <span className="hidden sm:inline">Preview</span>
                    </button>

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItem({ ...item });
                        setPatternsInput((item.matchPatterns || []).join(', '));
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Edit</span>
                    </button>

                    {/* Delete custom button */}
                    {item.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleDeleteNotification(item.id)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title="Delete custom notification"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Notification Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Edit Notification Message</h3>
                  <p className="text-xs text-gray-500">Operation: {editingItem.operationKey}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {/* Type selector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Notification Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingItem({ ...editingItem, type: 'success' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      editingItem.type === 'success'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-500/20'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Success (Green)
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingItem({ ...editingItem, type: 'warning' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      editingItem.type === 'warning'
                        ? 'bg-amber-50 border-amber-500 text-amber-700 ring-2 ring-amber-500/20'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Warning (Yellow)
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingItem({ ...editingItem, type: 'error' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      editingItem.type === 'error'
                        ? 'bg-red-50 border-red-500 text-red-700 ring-2 ring-red-500/20'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <XCircle className="w-4 h-4 text-red-600" />
                    Error (Red)
                  </button>
                </div>
              </div>

              {/* Module selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Application Module
                </label>
                <select
                  value={editingItem.module}
                  onChange={(e) => setEditingItem({ ...editingItem, module: e.target.value as ToastModuleId })}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  {TOAST_MODULES.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Notification Title *
                </label>
                <input
                  type="text"
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  placeholder="e.g. Added to Cart"
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold"
                />
              </div>

              {/* Message Input */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Message Text *
                </label>
                <textarea
                  rows={3}
                  value={editingItem.message}
                  onChange={(e) => setEditingItem({ ...editingItem, message: e.target.value })}
                  placeholder="Notification message body..."
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Trigger description */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Operational Description / Context
                </label>
                <input
                  type="text"
                  value={editingItem.description || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  placeholder="When does this toast trigger in the application?"
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Match Patterns */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Match Patterns (comma-separated keywords or phrases)
                </label>
                <input
                  type="text"
                  value={patternsInput}
                  onChange={(e) => setPatternsInput(e.target.value)}
                  placeholder="e.g. Added to Cart, Item added to cart, In bag"
                  className="w-full px-3 py-2 text-xs font-mono bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <span className="text-[11px] text-gray-400 mt-0.5 block">
                  Any toast triggered containing these phrases will automatically adopt this title and message.
                </span>
              </div>

              {/* Enabled toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <div>
                  <span className="text-xs font-bold text-gray-800">Notification Active</span>
                  <p className="text-[11px] text-gray-500">
                    If disabled, this notification will be suppressed globally.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingItem({ ...editingItem, enabled: !editingItem.enabled })}
                  className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out ${
                    editingItem.enabled ? 'bg-emerald-600' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                      editingItem.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100 gap-3">
              <button
                type="button"
                onClick={() => handleTestNotification(editingItem)}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                Preview in Real Toast
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditModal}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition cursor-pointer"
                >
                  Apply Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add New Notification Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Add New Notification Message</h3>
                  <p className="text-xs text-gray-500">
                    Define a new notification for an existing or custom application operation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {/* Operation Key */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Operation Key *
                </label>
                <input
                  type="text"
                  value={newItem.operationKey}
                  onChange={(e) => setNewItem({ ...newItem, operationKey: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                  placeholder="e.g. ORDER_PAYMENT_PENDING"
                  className="w-full px-3 py-2 text-sm font-mono bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <span className="text-[11px] text-gray-400 mt-0.5 block">
                  Unique identifier used by application operations to trigger this notification.
                </span>
              </div>

              {/* Type selector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Notification Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewItem({ ...newItem, type: 'success' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      newItem.type === 'success'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-500/20'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Success (Green)
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewItem({ ...newItem, type: 'warning' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      newItem.type === 'warning'
                        ? 'bg-amber-50 border-amber-500 text-amber-700 ring-2 ring-amber-500/20'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Warning (Yellow)
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewItem({ ...newItem, type: 'error' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      newItem.type === 'error'
                        ? 'bg-red-50 border-red-500 text-red-700 ring-2 ring-red-500/20'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <XCircle className="w-4 h-4 text-red-600" />
                    Error (Red)
                  </button>
                </div>
              </div>

              {/* Module selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Application Module
                </label>
                <select
                  value={newItem.module}
                  onChange={(e) => setNewItem({ ...newItem, module: e.target.value as ToastModuleId })}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  {TOAST_MODULES.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Notification Title *
                </label>
                <input
                  type="text"
                  value={newItem.title}
                  onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                  placeholder="e.g. Payment Pending"
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold"
                />
              </div>

              {/* Message Input */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Message Text *
                </label>
                <textarea
                  rows={3}
                  value={newItem.message}
                  onChange={(e) => setNewItem({ ...newItem, message: e.target.value })}
                  placeholder="e.g. We are waiting for bank confirmation for your payment."
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Trigger description */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Operational Description / Context
                </label>
                <input
                  type="text"
                  value={newItem.description || ''}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  placeholder="Describe when this notification will be shown..."
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Match Patterns */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Match Patterns (comma-separated keywords)
                </label>
                <input
                  type="text"
                  value={patternsInput}
                  onChange={(e) => setPatternsInput(e.target.value)}
                  placeholder="e.g. payment pending, bank verification, payment awaiting"
                  className="w-full px-3 py-2 text-xs font-mono bg-gray-50 border border-gray-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <span className="text-[11px] text-gray-400 mt-0.5 block">
                  Leave blank to auto-use title and message keywords.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100 gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!newItem.title || !newItem.message) {
                    toast.warning('Please enter a Title and Message to preview.');
                    return;
                  }
                  if (newItem.type === 'success') {
                    toast.success(newItem.message, { title: newItem.title });
                  } else if (newItem.type === 'error') {
                    toast.error(newItem.message, { title: newItem.title });
                  } else {
                    toast.warning(newItem.message, { title: newItem.title });
                  }
                }}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                Test Preview
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddNewNotification}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition cursor-pointer"
                >
                  Add Notification
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

