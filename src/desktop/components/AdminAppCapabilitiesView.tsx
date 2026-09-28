import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Smartphone, Shield, Camera, MapPin, Mic, Bell, Wifi,
  UserCheck, MessageSquare, Folder, Bluetooth, Fingerprint,
  Zap, Volume2, RefreshCw, Activity, Grid, ShieldCheck,
  Tag, Cpu, Lock, CheckCircle2, XCircle, AlertTriangle, Info,
  Sliders, Search, Filter, Monitor
} from 'lucide-react';
import { ViBaPermissionManager } from '../../services/ViBaPermissionManager';
import { AndroidCapability, DeviceDiagnostics } from '../../shared/types/capabilities';
import toast from 'react-hot-toast';

const ICON_MAP: Record<string, any> = {
  Camera, MapPin, Mic, Bell, Wifi, UserCheck, MessageSquare,
  Folder, Bluetooth, Fingerprint, Zap, Volume2, RefreshCw,
  Activity, Grid, ShieldCheck, Tag, Cpu, Lock, Smartphone
};

export default function AdminAppCapabilitiesView() {
  const [capabilities, setCapabilities] = useState<AndroidCapability[]>([]);
  const [diagnostics, setDiagnostics] = useState<DeviceDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', 'hardware', 'privacy', 'security', 'system', 'engagement', 'network'];

  const refreshCapabilities = async () => {
    setLoading(true);
    const list = await ViBaPermissionManager.getAllCapabilityStatuses();
    const diag = await ViBaPermissionManager.getDeviceDiagnostics();
    setCapabilities(list);
    setDiagnostics(diag);
    setLoading(false);
  };

  useEffect(() => {
    refreshCapabilities();
  }, []);

  const handleToggleCapability = (cap: AndroidCapability) => {
    const newStatus = !cap.featureEnabledByAdmin;
    ViBaPermissionManager.setAdminOverride(cap.id, newStatus);
    setCapabilities(prev => prev.map(c => c.id === cap.id ? { ...c, featureEnabledByAdmin: newStatus } : c));
    toast.success(`Feature "${cap.name}" ${newStatus ? 'Enabled' : 'Disabled'} in ViBa Mart settings.`);
  };

  const filteredCapabilities = capabilities.filter(cap => {
    const matchesSearch = cap.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          cap.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          cap.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || cap.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-4">
        <RefreshCw className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm font-bold text-gray-500">Scanning Android Device Capabilities & Hardware Sensors...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-6 lg:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-bold text-blue-300 backdrop-blur-md">
              <Smartphone className="w-3.5 h-3.5" />
              Android Hardware & Permission Controller
            </div>
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight">App Capabilities & Hardware Matrix</h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Monitor maximum legitimate Android capabilities. Admin can enable or disable corresponding ViBa Mart features without overriding Android OS security controls.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-md shrink-0">
            <div className="text-center px-3 border-r border-white/10">
              <div className="text-2xl font-black text-white">{capabilities.length}</div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Total Capabilities</div>
            </div>
            <div className="text-center px-3">
              <div className="text-2xl font-black text-emerald-400">{capabilities.filter(c => c.isHardwareAvailable).length}</div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Hardware Available</div>
            </div>
          </div>
        </div>
      </div>

      {/* Device Diagnostics Overview Cards */}
      {diagnostics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Platform</div>
            <div className="text-sm font-black text-gray-900 mt-1 truncate">{diagnostics.platform}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">App Version</div>
            <div className="text-sm font-black text-blue-600 mt-1">v{diagnostics.appVersion}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Screen</div>
            <div className="text-sm font-black text-gray-900 mt-1">{diagnostics.screenResolution}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Memory RAM</div>
            <div className="text-sm font-black text-gray-900 mt-1">{diagnostics.deviceMemory ? `${diagnostics.deviceMemory} GB` : '4+ GB'}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Network</div>
            <div className="text-sm font-black text-emerald-600 mt-1 uppercase">{diagnostics.networkType}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Biometrics</div>
            <div className="text-sm font-black text-purple-600 mt-1">{diagnostics.isBiometricSupported ? 'Supported' : 'Unavailable'}</div>
          </div>
        </div>
      )}

      {/* Search & Category Filter */}
      <div className="bg-white p-4 lg:p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="relative w-full lg:w-96">
          <input
            type="text"
            placeholder="Search capabilities by name, description, or permission..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Category:</div>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Capability Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {filteredCapabilities.map(cap => {
          const IconComponent = ICON_MAP[cap.iconName] || Smartphone;

          return (
            <motion.div
              key={cap.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white rounded-2xl border transition-all duration-200 p-6 flex flex-col justify-between relative overflow-hidden ${
                cap.featureEnabledByAdmin ? 'border-gray-200 shadow-sm hover:shadow-md' : 'border-gray-200 bg-gray-50/60 opacity-80'
              }`}
            >
              <div>
                {/* Header Row */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl ${cap.featureEnabledByAdmin ? 'bg-primary/10 text-primary' : 'bg-gray-200 text-gray-500'}`}>
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-gray-900 text-base leading-tight">{cap.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {cap.id}
                        </span>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded capitalize">
                          {cap.category}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Admin Feature Enable/Disable Switch */}
                  <button
                    onClick={() => handleToggleCapability(cap)}
                    title="Toggle ViBa Mart Feature Enablement"
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      cap.featureEnabledByAdmin ? 'bg-emerald-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        cap.featureEnabledByAdmin ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <p className="text-xs text-gray-600 mb-4 leading-relaxed font-medium">
                  {cap.description}
                </p>

                {/* Subfeatures list */}
                {cap.subFeatures && cap.subFeatures.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {cap.subFeatures.map((sub, idx) => (
                      <span key={idx} className="text-[10px] font-bold bg-gray-100 text-gray-700 px-2 py-1 rounded-md">
                        ✓ {sub}
                      </span>
                    ))}
                  </div>
                )}

                {/* Status Badges */}
                <div className="bg-gray-50 rounded-xl p-3 mb-3 space-y-2 border border-gray-100">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-gray-500 flex items-center gap-1.5">
                      Hardware Sensor:
                    </span>
                    <span className={`flex items-center gap-1 ${cap.isHardwareAvailable ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {cap.isHardwareAvailable ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Available
                        </>
                      ) : (
                        <>
                          <Info className="w-3.5 h-3.5" /> Software Fallback
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-gray-500 flex items-center gap-1.5">
                      OS Permission:
                    </span>
                    <span className={`capitalize ${cap.permissionState === 'granted' ? 'text-emerald-600' : 'text-blue-600'}`}>
                      {cap.permissionState === 'granted' ? 'Granted' : 'Permission Required'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-gray-500 flex items-center gap-1.5">
                      ViBa Feature Status:
                    </span>
                    <span className={cap.featureEnabledByAdmin ? 'text-emerald-600 font-black' : 'text-rose-500 font-black'}>
                      {cap.featureEnabledByAdmin ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Rationale Notice */}
              <div className="pt-3 border-t border-gray-100 text-[11px] text-gray-500 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <span><strong className="text-gray-700">User Rationale:</strong> {cap.rationale}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
