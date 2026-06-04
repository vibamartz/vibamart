import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Banner } from '../types';
import { GripVertical, Edit2, Trash2, Eye, EyeOff, Plus, Image as ImageIcon, X, Monitor, Smartphone, Save, Calendar, Link as LinkIcon, UploadCloud } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

export default function BannersManagementView() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlatformTab, setActivePlatformTab] = useState<'desktop' | 'mobile'>('desktop');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<Banner>>({
    title: '',
    subtitle: '',
    image: '',
    link: '',
    active: true,
    platform: 'desktop',
    startDate: '',
    endDate: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  // Drag and Drop refs
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'banners'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bannerData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Banner));
      setBanners(bannerData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching banners:", error);
      toast.error("Failed to load banners.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredBanners = banners.filter(b => (b.platform || 'desktop') === activePlatformTab);

  // --- Drag and Drop Logic ---
  const handleDragStart = (e: React.DragEvent, position: number) => {
    dragItem.current = position;
    e.currentTarget.classList.add('opacity-50', 'bg-indigo-50/50');
  };

  const handleDragEnter = (e: React.DragEvent, position: number) => {
    dragOverItem.current = position;
  };

  const handleDragEnd = async (e: React.DragEvent) => {
    e.currentTarget.classList.remove('opacity-50', 'bg-indigo-50/50');
    
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const newFilteredList = [...filteredBanners];
      const draggedItemContent = newFilteredList[dragItem.current];
      
      // Remove dragged item
      newFilteredList.splice(dragItem.current, 1);
      // Insert it into new position
      newFilteredList.splice(dragOverItem.current, 0, draggedItemContent);
      
      // Update local state temporarily for immediate feedback
      // We only update the order for the active tab's banners
      const batch = writeBatch(db);
      newFilteredList.forEach((banner, index) => {
        const bannerRef = doc(db, 'banners', banner.id);
        batch.update(bannerRef, { order: index });
      });

      try {
        await batch.commit();
        toast.success("Banners reordered successfully");
      } catch (error) {
        console.error("Error updating order:", error);
        toast.error("Failed to save new order");
      }
    }
    
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // --- Form Handlers ---
  const handleOpenModal = (banner?: Banner) => {
    if (banner) {
      setEditingBanner(banner);
      setFormData({
        title: banner.title || '',
        subtitle: banner.subtitle || '',
        image: banner.image || '',
        link: banner.link || '',
        active: banner.active ?? true,
        platform: banner.platform || activePlatformTab,
        startDate: banner.startDate || '',
        endDate: banner.endDate || ''
      });
    } else {
      setEditingBanner(null);
      setFormData({
        title: '',
        subtitle: '',
        image: '',
        link: '',
        active: true,
        platform: activePlatformTab,
        startDate: '',
        endDate: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) { // 3MB max for banners
        toast.error('Image size must be less than 3MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.image) {
      toast.error('Banner Image is required.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingBanner) {
        // Update existing
        const bannerRef = doc(db, 'banners', editingBanner.id);
        await updateDoc(bannerRef, {
          ...formData,
        });
        toast.success('Banner updated successfully');
      } else {
        // Create new
        const newDocRef = doc(collection(db, 'banners'));
        await setDoc(newDocRef, {
          id: newDocRef.id,
          ...formData,
          order: filteredBanners.length, // Put at the end of the current platform list
        });
        toast.success('Banner created successfully');
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving banner:', error);
      toast.error('Failed to save banner');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this banner?')) {
      try {
        await deleteDoc(doc(db, 'banners', id));
        toast.success('Banner deleted');
      } catch (error) {
        console.error('Error deleting banner:', error);
        toast.error('Failed to delete banner');
      }
    }
  };

  const handleToggleVisibility = async (banner: Banner) => {
    try {
      const newVisibility = !banner.active;
      const bannerRef = doc(db, 'banners', banner.id);
      await updateDoc(bannerRef, { active: newVisibility });
      toast.success(`Banner is now ${newVisibility ? 'visible' : 'hidden'}`);
    } catch (error) {
      console.error('Error toggling visibility:', error);
      toast.error('Failed to update visibility');
    }
  };

  const isBannerCurrentlyActive = (banner: Banner) => {
    if (!banner.active) return false;
    const now = new Date().getTime();
    const start = banner.startDate ? new Date(banner.startDate).getTime() : 0;
    const end = banner.endDate ? new Date(banner.endDate).getTime() : Infinity;
    return now >= start && now <= end;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Banner Management</h2>
          <p className="text-sm text-gray-500">Control promotional banners across devices.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Add Banner
        </button>
      </div>

      {/* Platform Tabs */}
      <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm w-fit">
        <button
          onClick={() => setActivePlatformTab('desktop')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activePlatformTab === 'desktop' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <Monitor className="w-4 h-4" />
          Desktop Banners
        </button>
        <button
          onClick={() => setActivePlatformTab('mobile')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activePlatformTab === 'mobile' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <Smartphone className="w-4 h-4" />
          Mobile Banners
        </button>
      </div>

      {/* Banner List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-500 font-medium">Loading banners...</div>
        ) : filteredBanners.length === 0 ? (
          <div className="p-10 text-center text-gray-400 font-medium">No {activePlatformTab} banners found. Click "Add Banner" to create one.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredBanners.map((banner, index) => {
              const currentlyActive = isBannerCurrentlyActive(banner);
              return (
                <div
                  key={banner.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnter={(e) => handleDragEnter(e, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  className="flex flex-col md:flex-row gap-6 p-6 items-center hover:bg-gray-50/80 transition-colors bg-white cursor-move group"
                >
                  <div className="flex justify-center text-gray-300 group-hover:text-indigo-400 transition-colors shrink-0">
                    <GripVertical className="w-6 h-6" />
                  </div>
                  
                  {/* Banner Preview */}
                  <div className={`shrink-0 border-2 border-gray-100 rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center ${activePlatformTab === 'desktop' ? 'w-64 h-32' : 'w-32 h-48'}`}>
                    {banner.image ? (
                      <img src={banner.image} alt={banner.title || 'Banner'} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-gray-300" />
                    )}
                  </div>
                  
                  {/* Banner Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="text-lg font-bold text-gray-900 truncate">{banner.title || 'Untitled Banner'}</h4>
                      {!currentlyActive && banner.active && (
                         <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-wider">Scheduled (Inactive Now)</span>
                      )}
                      {!banner.active && (
                         <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full uppercase tracking-wider">Disabled</span>
                      )}
                    </div>
                    {banner.subtitle && <p className="text-sm text-gray-500 mb-2 truncate">{banner.subtitle}</p>}
                    
                    <div className="flex flex-wrap items-center gap-4 mt-2">
                      {banner.link && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg w-fit">
                          <LinkIcon className="w-3 h-3" />
                          <span className="truncate max-w-[200px]">{banner.link}</span>
                        </div>
                      )}
                      {(banner.startDate || banner.endDate) && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg w-fit">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          {banner.startDate ? new Date(banner.startDate).toLocaleDateString() : 'Now'} - {banner.endDate ? new Date(banner.endDate).toLocaleDateString() : 'Forever'}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleVisibility(banner)}
                      className={`p-2.5 rounded-xl transition-colors ${banner.active ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'}`}
                      title={banner.active ? 'Active' : 'Hidden'}
                    >
                      {banner.active ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => handleOpenModal(banner)}
                      className="p-2.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
                      title="Edit Banner"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(banner.id)}
                      className="p-2.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"
                      title="Delete Banner"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => !isSaving && setIsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingBanner ? 'Edit Banner' : `Create New ${formData.platform === 'desktop' ? 'Desktop' : 'Mobile'} Banner`}
                </h3>
                <button
                  onClick={() => !isSaving && setIsModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                <form id="banner-form" onSubmit={handleSave} className="space-y-8">
                  
                  {/* Image Upload Area */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 flex justify-between">
                      Banner Image <span className="text-rose-500">*</span>
                      <span className="text-xs text-gray-400 font-normal">Max size: 3MB</span>
                    </label>
                    <div className="flex justify-center">
                      {formData.image ? (
                        <div className={`relative group w-full ${formData.platform === 'desktop' ? 'aspect-[21/9] md:aspect-[3/1]' : 'aspect-[4/5] max-w-sm mx-auto'} rounded-2xl overflow-hidden border-2 border-indigo-100 shadow-sm bg-gray-50 flex items-center justify-center`}>
                          <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <label className="cursor-pointer bg-white text-gray-900 px-4 py-2 rounded-xl font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-2">
                              <UploadCloud className="w-4 h-4" /> Change Image
                              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                            </label>
                          </div>
                        </div>
                      ) : (
                        <label className={`w-full ${formData.platform === 'desktop' ? 'aspect-[21/9] md:aspect-[3/1]' : 'aspect-[4/5] max-w-sm mx-auto'} rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 transition-colors group`}>
                          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
                            <ImageIcon className="w-8 h-8 text-gray-400 group-hover:text-indigo-500" />
                          </div>
                          <p className="text-sm font-bold text-gray-700">Click to upload image</p>
                          <p className="text-xs text-gray-500 mt-1">Recommended ratio: {formData.platform === 'desktop' ? '3:1 (Desktop)' : '4:5 (Mobile)'}</p>
                          <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Settings Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-sm font-bold text-gray-700">Banner Title</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                        placeholder="e.g. Mega Summer Sale"
                      />
                    </div>
                    
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-sm font-bold text-gray-700">Subtitle / Description</label>
                      <input
                        type="text"
                        value={formData.subtitle}
                        onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                        placeholder="e.g. Get up to 50% off on all electronics"
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-sm font-bold text-gray-700">Destination URL</label>
                      <div className="relative">
                        <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={formData.link}
                          onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none font-mono text-sm"
                          placeholder="/products?category=electronics"
                        />
                      </div>
                      <p className="text-[11px] text-gray-400">The entire banner will be clickable and link to this URL.</p>
                    </div>

                    {/* Scheduling */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700">Schedule Start</label>
                      <input
                        type="datetime-local"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700">Schedule End</label>
                      <input
                        type="datetime-local"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-sm"
                      />
                    </div>

                    <div className="md:col-span-2 bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center justify-between mt-2">
                      <div>
                        <h4 className="font-bold text-gray-900">Banner Status</h4>
                        <p className="text-xs text-gray-500 mt-0.5">Toggle to instantly hide or show this banner</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.active}
                          onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
                      </label>
                    </div>

                  </div>
                </form>
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3 rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="banner-form"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-8 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSaving ? 'Saving...' : 'Save Banner'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
