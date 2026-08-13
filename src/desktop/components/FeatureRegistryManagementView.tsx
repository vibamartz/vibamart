import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Layers, Search, Check, X, Shield, Smartphone, Monitor,
  Sliders, RefreshCw, Power, Sparkles, Tag, Gift, Heart,
  Star, Bell, Ticket, History, Mic, Camera, MapPin
} from 'lucide-react';
import { useFeatureStore } from '../../backend/store';
import { FeatureConfig } from '../../shared/types';
import toast from 'react-hot-toast';

const ICON_MAP: Record<string, any> = {
  Gift, Heart, Star, Tag, Ticket, Bell, History, Sparkles, Mic, Camera, MapPin
};

export default function FeatureRegistryManagementView() {
  const { features, loading, toggleFeature, updateFeature } = useFeatureStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [editingFeature, setEditingFeature] = useState<FeatureConfig | null>(null);

  const categories = ['all', 'loyalty', 'shopping', 'marketing', 'search', 'customer'];

  const filteredFeatures = features.filter(feature => {
    const matchesSearch = feature.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          feature.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          feature.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || feature.category === selectedCategory;
    const matchesPlatform = selectedPlatform === 'all' || feature.availability === 'all' || feature.availability === selectedPlatform;
    return matchesSearch && matchesCategory && matchesPlatform;
  });

  const handleToggle = async (id: string, currentStatus: boolean) => {
    try {
      await toggleFeature(id, !currentStatus);
      toast.success(`Feature "${id}" ${!currentStatus ? 'enabled' : 'disabled'} for both Desktop & Mobile.`);
    } catch (e) {
      toast.error('Failed to update feature status');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFeature) return;

    try {
      await updateFeature(editingFeature.id, editingFeature);
      toast.success(`Feature configuration saved!`);
      setEditingFeature(null);
    } catch (e) {
      toast.error('Failed to update feature config');
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 lg:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-bold text-yellow-300 backdrop-blur-md">
              <Layers className="w-3.5 h-3.5" />
              Shared Feature Registry
            </div>
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight">Desktop & Mobile Feature Controls</h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Control customer-facing features across both platforms. Enabling or updating a feature here instantly updates Desktop and Mobile views via real-time synchronization.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-md shrink-0">
            <div className="text-center px-3 border-r border-white/10">
              <div className="text-2xl font-black text-white">{features.length}</div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Total Features</div>
            </div>
            <div className="text-center px-3">
              <div className="text-2xl font-black text-emerald-400">{features.filter(f => f.enabled).length}</div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Active Now</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-white p-4 lg:p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full lg:w-96">
          <input
            type="text"
            placeholder="Search features by name, ID, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Category:</div>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                selectedCategory === cat
                  ? 'bg-primary text-white shadow-sm shadow-primary/30'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Platform Selector */}
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setSelectedPlatform('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedPlatform === 'all' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
          >
            All Devices
          </button>
          <button
            onClick={() => setSelectedPlatform('desktop')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${selectedPlatform === 'desktop' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
          >
            <Monitor className="w-3.5 h-3.5" /> Desktop
          </button>
          <button
            onClick={() => setSelectedPlatform('mobile')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${selectedPlatform === 'mobile' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
          >
            <Smartphone className="w-3.5 h-3.5" /> Mobile
          </button>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {filteredFeatures.map(feature => {
          const IconComp = (feature.icon && ICON_MAP[feature.icon]) ? ICON_MAP[feature.icon] : Layers;

          return (
            <motion.div
              key={feature.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white rounded-2xl border transition-all duration-200 p-6 flex flex-col justify-between relative overflow-hidden ${
                feature.enabled ? 'border-gray-200 shadow-sm hover:shadow-md' : 'border-gray-200 bg-gray-50/50 opacity-75'
              }`}
            >
              <div>
                {/* Header row: Icon & Status Toggle */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl ${feature.enabled ? 'bg-primary/10 text-primary' : 'bg-gray-200 text-gray-500'}`}>
                      <IconComp className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-base leading-tight">{feature.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                          {feature.id}
                        </span>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded capitalize">
                          {feature.category}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    onClick={() => handleToggle(feature.id, feature.enabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      feature.enabled ? 'bg-emerald-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        feature.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                  {feature.description}
                </p>

                {/* Device sync indicators */}
                <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-2 border border-gray-100">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-500 font-medium flex items-center gap-1.5">
                      <Monitor className="w-3.5 h-3.5 text-blue-500" /> Desktop UI
                    </span>
                    <span className={`font-bold ${feature.enabled ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {feature.enabled ? 'Available (Desktop View)' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-500 font-medium flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-purple-500" /> Mobile UI
                    </span>
                    <span className={`font-bold ${feature.enabled ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {feature.enabled ? 'Available (Mobile View)' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                <button
                  onClick={() => setEditingFeature(feature)}
                  className="text-xs font-bold text-primary hover:text-yellow-600 flex items-center gap-1.5"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Configure Settings
                </button>
                <div className="text-[10px] text-gray-400 font-medium">
                  Shared Backend Sync
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Configuration Modal */}
      <AnimatePresence>
        {editingFeature && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 lg:p-8 max-w-lg w-full shadow-2xl border border-gray-100 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Configure Feature: {editingFeature.name}</h3>
                  <p className="text-xs text-gray-500">ID: {editingFeature.id}</p>
                </div>
                <button
                  onClick={() => setEditingFeature(null)}
                  className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Feature Name</label>
                  <input
                    type="text"
                    value={editingFeature.name}
                    onChange={(e) => setEditingFeature({ ...editingFeature, name: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Description</label>
                  <textarea
                    value={editingFeature.description}
                    onChange={(e) => setEditingFeature({ ...editingFeature, description: e.target.value })}
                    rows={3}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Category</label>
                    <select
                      value={editingFeature.category}
                      onChange={(e) => setEditingFeature({ ...editingFeature, category: e.target.value as any })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium"
                    >
                      {categories.filter(c => c !== 'all').map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Availability</label>
                    <select
                      value={editingFeature.availability}
                      onChange={(e) => setEditingFeature({ ...editingFeature, availability: e.target.value as any })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium"
                    >
                      <option value="all">Both Desktop & Mobile</option>
                      <option value="desktop">Desktop Only</option>
                      <option value="mobile">Mobile Only</option>
                    </select>
                  </div>
                </div>

                {/* Status Switch */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div>
                    <div className="text-xs font-bold text-gray-900">Enabled Status</div>
                    <div className="text-[11px] text-gray-500">Toggle whether this feature is active across platforms</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingFeature({ ...editingFeature, enabled: !editingFeature.enabled })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      editingFeature.enabled ? 'bg-emerald-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        editingFeature.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setEditingFeature(null)}
                    className="px-5 py-2.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 text-xs font-bold text-white bg-primary hover:bg-yellow-600 rounded-xl shadow-lg shadow-primary/30 transition-all"
                  >
                    Save Changes
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
