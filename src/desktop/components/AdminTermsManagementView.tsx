import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ShieldCheck, Save, RotateCcw, Plus, Trash2, Edit3, 
  FileText, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { TermsConfig, DEFAULT_TERMS_CONFIG, saveTermsConfig, TermsSection } from '../../shared/utilities/termsUtils';

export default function AdminTermsManagementView() {
  const [config, setConfig] = useState<TermsConfig>(DEFAULT_TERMS_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'terms'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as TermsConfig;
        setConfig({
          ...DEFAULT_TERMS_CONFIG,
          ...data,
          sections: data.sections && data.sections.length > 0 ? data.sections : DEFAULT_TERMS_CONFIG.sections
        });
      } else {
        setConfig(DEFAULT_TERMS_CONFIG);
      }
      setLoading(false);
    }, (err) => {
      console.error('Error subscribing to terms settings:', err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const toastId = toast.loading('Saving Terms of Service configuration...');
    try {
      await saveTermsConfig(config);
      toast.success('Terms of Service updated successfully!', { id: toastId });
    } catch (err: any) {
      console.error('Error saving terms config:', err);
      toast.error(err.message || 'Failed to save Terms of Service', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    if (!window.confirm('Are you sure you want to reset the Terms of Service to the default official document? Any custom edits will be replaced.')) {
      return;
    }
    setSaving(true);
    const toastId = toast.loading('Resetting to default Terms of Service...');
    try {
      await saveTermsConfig(DEFAULT_TERMS_CONFIG);
      setConfig(DEFAULT_TERMS_CONFIG);
      toast.success('Reset to default Terms of Service successfully!', { id: toastId });
    } catch (err: any) {
      console.error('Error resetting terms:', err);
      toast.error('Failed to reset Terms of Service', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const updateSectionTitle = (id: string, title: string) => {
    setConfig(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === id ? { ...s, title } : s)
    }));
  };

  const updateSectionParagraphs = (id: string, text: string) => {
    const paragraphs = text.split('\n\n').map(p => p.trim()).filter(Boolean);
    setConfig(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === id ? { ...s, paragraphs } : s)
    }));
  };

  const updateSectionBullets = (id: string, text: string) => {
    const bulletPoints = text.split('\n').map(b => b.trim()).filter(Boolean);
    setConfig(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === id ? { ...s, bulletPoints } : s)
    }));
  };

  const handleAddSection = () => {
    const newNum = config.sections.length + 1;
    const newSection: TermsSection = {
      id: `section-${Date.now()}`,
      number: newNum,
      title: 'New Section',
      paragraphs: ['Section content description goes here.'],
      bulletPoints: []
    };
    setConfig(prev => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }));
    setExpandedSectionId(newSection.id);
    toast.success(`Section ${newNum} added`);
  };

  const handleDeleteSection = (id: string) => {
    if (config.sections.length <= 1) {
      toast.error('At least one section must remain');
      return;
    }
    setConfig(prev => {
      const remaining = prev.sections.filter(s => s.id !== id);
      const renumbered = remaining.map((s, idx) => ({ ...s, number: idx + 1 }));
      return { ...prev, sections: renumbered };
    });
    toast.success('Section deleted');
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500 font-medium">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        Loading Terms of Service Management...
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      
      {/* Header Controls */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-xl shadow-gray-100/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-3">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Terms Management View
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Manage Terms of Service</h1>
          <p className="text-gray-500 text-sm font-medium mt-1">
            Edit sections, legal text, dates, and bullet points. Changes update `/terms` live.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleResetToDefault}
            disabled={saving}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-gray-500" /> Reset to Default Document
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save & Publish'}
          </button>
        </div>
      </div>

      {/* Global Meta & Header Config */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-xl shadow-gray-100/50 space-y-6">
        <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-emerald-600" /> Page Header & Metadata
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-gray-500 block mb-2">Page Title</label>
            <input
              type="text"
              value={config.title}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-wider text-gray-500 block mb-2">Last Updated Date</label>
            <input
              type="text"
              value={config.lastUpdated}
              onChange={(e) => setConfig({ ...config, lastUpdated: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all"
              placeholder="e.g. September 28, 2026"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-black uppercase tracking-wider text-gray-500 block mb-2">Introduction Preamble</label>
          <textarea
            rows={3}
            value={config.introParagraphs.join('\n\n')}
            onChange={(e) => setConfig({ ...config, introParagraphs: e.target.value.split('\n\n').filter(Boolean) })}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all"
          />
        </div>

        <div>
          <label className="text-xs font-black uppercase tracking-wider text-gray-500 block mb-2">Highlighted Notice Banner</label>
          <textarea
            rows={2}
            value={config.highlightNotice || ''}
            onChange={(e) => setConfig({ ...config, highlightNotice: e.target.value })}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Sections List */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-xl shadow-gray-100/50 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600" /> Sections ({config.sections.length})
          </h2>
          <button
            onClick={handleAddSection}
            className="px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-2 cursor-pointer border border-emerald-200"
          >
            <Plus className="w-4 h-4" /> Add Section
          </button>
        </div>

        <div className="space-y-4">
          {config.sections.map((section, idx) => {
            const isExpanded = expandedSectionId === section.id;

            return (
              <div 
                key={section.id} 
                className="border border-gray-200/80 rounded-2xl overflow-hidden bg-white shadow-2xs transition-all"
              >
                {/* Section Header */}
                <div 
                  onClick={() => setExpandedSectionId(isExpanded ? null : section.id)}
                  className="p-4 bg-gray-50/80 hover:bg-gray-100/80 flex items-center justify-between gap-4 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 font-extrabold text-sm flex items-center justify-center shrink-0">
                      {section.number}
                    </span>
                    <span className="font-bold text-gray-900 text-base truncate">
                      {section.title || `Section ${section.number}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSection(section.id);
                      }}
                      className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      title="Delete Section"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </div>
                </div>

                {/* Section Editor Drawer */}
                {isExpanded && (
                  <div className="p-6 border-t border-gray-100 space-y-5 bg-white">
                    <div>
                      <label className="text-xs font-black uppercase tracking-wider text-gray-500 block mb-2">Section Title</label>
                      <input
                        type="text"
                        value={section.title}
                        onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-black uppercase tracking-wider text-gray-500 block mb-2">
                        Paragraphs (Separate multiple paragraphs with double line breaks)
                      </label>
                      <textarea
                        rows={3}
                        value={section.paragraphs.join('\n\n')}
                        onChange={(e) => updateSectionParagraphs(section.id, e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-black uppercase tracking-wider text-gray-500 block mb-2">
                        Bullet Points (One point per line)
                      </label>
                      <textarea
                        rows={4}
                        value={(section.bulletPoints || []).join('\n')}
                        onChange={(e) => updateSectionBullets(section.id, e.target.value)}
                        placeholder="Bullet point 1&#10;Bullet point 2"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
