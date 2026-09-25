import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../backend/firebase/firebase';
import { logAdminAction, AdminAction } from '../../backend/services/adminLogService';
import { Product, Deal259PageConfig, Deal259SubDeal } from '../../shared/types';
import { DEFAULT_DEAL259_CONFIG, DEFAULT_DEAL259_SUBDEALS } from '../../shared/utilities/deal259Utils';
import AddEditProductForm from './AddEditProductForm';
import toast from 'react-hot-toast';
import {
  Tag, Plus, Trash2, Edit2, Check, X, Search, Layers, RefreshCw, Eye, EyeOff, Save,
  ArrowUp, ArrowDown, ChevronRight, Image as ImageIcon, Sliders, AlertCircle, ShoppingBag, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Deal259AdminManagementView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [config, setConfig] = useState<Deal259PageConfig>(DEFAULT_DEAL259_CONFIG);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'assigned' | 'subdeals' | 'config' | 'inventory'>('assigned');
  
  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubDeal, setSelectedSubDeal] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Product Creation & Editing
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Sub-deal Editing Modal / State
  const [newSubDeal, setNewSubDeal] = useState<Partial<Deal259SubDeal>>({
    title: '',
    subtitle: '',
    badgeText: 'DEAL',
    icon: '⚡',
    active: true
  });
  const [editingSubDeal, setEditingSubDeal] = useState<Deal259SubDeal | null>(null);
  
  // Inventory Assigning Bulk
  const [selectedInventoryIds, setSelectedInventoryIds] = useState<string[]>([]);

  // Config Form State
  const [configForm, setConfigForm] = useState<Deal259PageConfig>(DEFAULT_DEAL259_CONFIG);
  const [savingConfig, setSavingConfig] = useState(false);

  // Load products and Deal settings from Firestore
  useEffect(() => {
    const qProds = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubProds = onSnapshot(qProds, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      setProducts(data);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'products');
      setLoading(false);
    });

    const unsubConfig = onSnapshot(doc(db, 'settings', 'deal259'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Deal259PageConfig;
        const merged = {
          ...DEFAULT_DEAL259_CONFIG,
          ...data,
          subDeals: data.subDeals && data.subDeals.length > 0 ? data.subDeals : DEFAULT_DEAL259_SUBDEALS
        };
        setConfig(merged);
        setConfigForm(merged);
      } else {
        setConfig(DEFAULT_DEAL259_CONFIG);
        setConfigForm(DEFAULT_DEAL259_CONFIG);
      }
    });

    return () => {
      unsubProds();
      unsubConfig();
    };
  }, []);

  // Filtered lists
  const assignedProducts = products.filter(p => p.isDeal259 === true);
  const nonAssignedProducts = products.filter(p => !p.isDeal259);

  const filteredAssignedProducts = assignedProducts.filter(p => {
    const matchesSearch = !searchQuery || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.productCode?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSubDeal = selectedSubDeal === 'all' || p.deal259SubDealId === selectedSubDeal;
    const matchesCat = selectedCategory === 'all' || p.categoryId === selectedCategory;

    return matchesSearch && matchesSubDeal && matchesCat;
  });

  const filteredInventoryProducts = nonAssignedProducts.filter(p => {
    return !searchQuery || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.productCode?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Assign product to Deal Store
  const handleAssignToDeal259 = async (productId: string) => {
    const toastId = toast.loading('Assigning to Deal Store...');
    try {
      await updateDoc(doc(db, 'products', productId), {
        isDeal259: true,
        deal259Status: 'active',
        deal259Order: assignedProducts.length + 1,
        showInGeneralStore: false // Explicitly isolated to Deal Store unless changed by Admin
      });
      await logAdminAction(AdminAction.PRODUCT_UPDATE, `Assigned product to Deal Store`, productId, 'products');
      toast.success('Assigned to Deal Store successfully', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to assign product', { id: toastId });
    }
  };

  // Remove product from Deal Store
  const handleRemoveFromDeal259 = async (productId: string) => {
    if (!window.confirm('Remove this product from Deal Store?')) return;
    const toastId = toast.loading('Removing from Deal Store...');
    try {
      await updateDoc(doc(db, 'products', productId), {
        isDeal259: false,
        deal259Status: 'disabled'
      });
      await logAdminAction(AdminAction.PRODUCT_UPDATE, `Removed product from Deal Store`, productId, 'products');
      toast.success('Removed from Deal Store', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to remove product', { id: toastId });
    }
  };

  // Update quick field on assigned product
  const handleUpdateProductField = async (productId: string, fields: Partial<Product>) => {
    try {
      await updateDoc(doc(db, 'products', productId), fields);
      toast.success('Product updated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update product');
    }
  };

  // Bulk assign selected inventory products
  const handleBulkAssign = async () => {
    if (selectedInventoryIds.length === 0) return;
    const toastId = toast.loading(`Assigning ${selectedInventoryIds.length} products to Deal Store...`);
    try {
      const promises = selectedInventoryIds.map(id => 
        updateDoc(doc(db, 'products', id), {
          isDeal259: true,
          deal259Status: 'active',
          showInGeneralStore: false
        })
      );
      await Promise.all(promises);
      toast.success(`Assigned ${selectedInventoryIds.length} products to Deal Store!`, { id: toastId });
      setSelectedInventoryIds([]);
    } catch (err) {
      console.error(err);
      toast.error('Bulk assign failed', { id: toastId });
    }
  };

  // Save Page Config
  const handleSaveConfig = async () => {
    setSavingConfig(true);
    const toastId = toast.loading('Saving Deal settings...');
    try {
      const updatedConfig = {
        ...configForm,
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'settings', 'deal259'), updatedConfig, { merge: true });
      await logAdminAction(AdminAction.SETTINGS_UPDATE, 'Updated Deal settings', 'deal259', 'settings');
      toast.success('Deal settings saved!', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to save settings', { id: toastId });
    } finally {
      setSavingConfig(false);
    }
  };

  // Sub-Deal CRUD
  const handleAddSubDeal = async () => {
    if (!newSubDeal.title) {
      toast.error('Sub-deal title is required');
      return;
    }
    const subDeals = configForm.subDeals || DEFAULT_DEAL259_SUBDEALS;
    const item: Deal259SubDeal = {
      id: `sd_${Date.now()}`,
      title: newSubDeal.title,
      subtitle: newSubDeal.subtitle || '',
      badgeText: newSubDeal.badgeText || 'DEAL',
      icon: newSubDeal.icon || '⚡',
      active: newSubDeal.active !== false,
      order: subDeals.length + 1
    };

    const updatedSubDeals = [...subDeals, item];
    const newConf = { ...configForm, subDeals: updatedSubDeals };
    setConfigForm(newConf);
    setNewSubDeal({ title: '', subtitle: '', badgeText: 'DEAL', icon: '⚡', active: true });

    try {
      await setDoc(doc(db, 'settings', 'deal259'), newConf, { merge: true });
      toast.success('Sub-deal created');
    } catch (err) {
      console.error(err);
      toast.error('Failed to create sub-deal');
    }
  };

  const handleUpdateSubDeal = async (subDeal: Deal259SubDeal) => {
    const subDeals = (configForm.subDeals || []).map(sd => sd.id === subDeal.id ? subDeal : sd);
    const newConf = { ...configForm, subDeals };
    setConfigForm(newConf);
    setEditingSubDeal(null);

    try {
      await setDoc(doc(db, 'settings', 'deal259'), newConf, { merge: true });
      toast.success('Sub-deal updated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update sub-deal');
    }
  };

  const handleDeleteSubDeal = async (id: string) => {
    if (!window.confirm('Delete this sub-deal? Products assigned to it will remain in Deal 259.')) return;
    const subDeals = (configForm.subDeals || []).filter(sd => sd.id !== id);
    const newConf = { ...configForm, subDeals };
    setConfigForm(newConf);

    try {
      await setDoc(doc(db, 'settings', 'deal259'), newConf, { merge: true });
      toast.success('Sub-deal deleted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete sub-deal');
    }
  };

  return (
    <div className="space-y-6 select-none font-sans pb-16">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                Deal Center
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${config.enabled ? 'bg-emerald-400 text-emerald-950' : 'bg-red-400 text-red-950'}`}>
                {config.enabled ? 'PAGE ACTIVE' : 'PAGE DISABLED'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{config.title || 'Deal Super Store'}</h2>
            <p className="text-white/80 text-xs sm:text-sm font-medium mt-1 max-w-xl">{config.subtitle}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditingProduct(null);
                setShowAddModal(true);
              }}
              className="bg-white text-rose-700 hover:bg-rose-50 font-black px-4 py-2.5 rounded-2xl text-xs uppercase tracking-wider shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create New Deal Product
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('assigned')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'assigned'
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Assigned Products ({assignedProducts.length})
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'inventory'
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <Plus className="w-4 h-4" />
            Assign Store Inventory ({nonAssignedProducts.length})
          </button>
          <button
            onClick={() => setActiveTab('subdeals')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'subdeals'
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            Sub-Deals ({configForm.subDeals?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'config'
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Page Settings
          </button>
        </div>

        {/* Search */}
        {(activeTab === 'assigned' || activeTab === 'inventory') && (
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-xs font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          </div>
        )}
      </div>

      {/* TAB 1: ASSIGNED PRODUCTS */}
      {activeTab === 'assigned' && (
        <div className="space-y-4">
          {/* Sub-deal Filter Bar */}
          <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-2">Filter Sub-Deal:</span>
            <button
              onClick={() => setSelectedSubDeal('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedSubDeal === 'all' ? 'bg-rose-100 text-rose-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All ({assignedProducts.length})
            </button>
            {(config.subDeals || DEFAULT_DEAL259_SUBDEALS).map(sd => {
              const count = assignedProducts.filter(p => p.deal259SubDealId === sd.id).length;
              return (
                <button
                  key={sd.id}
                  onClick={() => setSelectedSubDeal(sd.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedSubDeal === sd.id ? 'bg-rose-100 text-rose-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {sd.icon} {sd.title} ({count})
                </button>
              );
            })}
          </div>

          {filteredAssignedProducts.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm space-y-3">
              <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto" />
              <h3 className="text-base font-bold text-gray-800">No Deal products found</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                No products are assigned to Deal Store matching your filters. Click "Assign Store Inventory" to add existing products or create a new Deal product.
              </p>
              <button
                onClick={() => setActiveTab('inventory')}
                className="bg-rose-600 text-white font-bold text-xs uppercase px-4 py-2.5 rounded-xl hover:bg-rose-700 transition-all inline-flex items-center gap-2 cursor-pointer mt-2"
              >
                <Plus className="w-4 h-4" />
                Assign Store Inventory
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-black text-gray-500 uppercase tracking-wider">
                      <th className="p-4">Product</th>
                      <th className="p-4">Custom Deal Price (₹)</th>
                      <th className="p-4">Admin Price (₹)</th>
                      <th className="p-4">Original MRP (₹)</th>
                      <th className="p-4">Sub-Deal</th>
                      <th className="p-4">Order Pos</th>
                      <th className="p-4">Visibility in Store</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-xs">
                    {filteredAssignedProducts.map((p) => {
                      const discountPct = p.price > 0 && p.discountPrice
                        ? Math.round(((p.price - p.discountPrice) / p.price) * 100)
                        : (p.discountPercentage || 0);

                      const adminSellingPrice = p.discountPrice || p.price;

                      return (
                        <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={p.images?.[0] || 'https://via.placeholder.com/100'}
                                alt={p.name}
                                className="w-12 h-12 object-cover rounded-xl border border-gray-100 bg-gray-50 shrink-0"
                              />
                              <div>
                                <h4 className="font-bold text-gray-900 line-clamp-1">{p.name}</h4>
                                <span className="text-[10px] text-gray-400 font-mono">Code: {p.productCode || p.id}</span>
                                {discountPct > 0 && (
                                  <span className="ml-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                    {discountPct}% OFF
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <input
                              type="number"
                              placeholder={String(adminSellingPrice)}
                              defaultValue={p.deal259Price && p.deal259Price !== 259 ? p.deal259Price : ''}
                              onBlur={(e) => handleUpdateProductField(p.id, { deal259Price: e.target.value ? Number(e.target.value) : (null as any) })}
                              className="w-24 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-bold text-gray-900 focus:bg-white focus:border-rose-500 outline-none"
                            />
                          </td>
                          <td className="p-4 font-bold text-rose-600">
                            ₹{adminSellingPrice.toLocaleString()}
                          </td>
                          <td className="p-4 text-gray-600 font-medium">
                            ₹{p.price.toLocaleString()}
                          </td>
                          <td className="p-4">
                            <select
                              value={p.deal259SubDealId || ''}
                              onChange={(e) => handleUpdateProductField(p.id, { deal259SubDealId: e.target.value })}
                              className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-medium text-gray-800 focus:bg-white outline-none cursor-pointer"
                            >
                              <option value="">General Deal</option>
                              {(config.subDeals || DEFAULT_DEAL259_SUBDEALS).map(sd => (
                                <option key={sd.id} value={sd.id}>{sd.title}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-4">
                            <input
                              type="number"
                              defaultValue={p.deal259Order || 1}
                              onBlur={(e) => handleUpdateProductField(p.id, { deal259Order: Number(e.target.value) || 1 })}
                              className="w-16 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-center text-gray-900 focus:bg-white outline-none"
                            />
                          </td>
                          <td className="p-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={p.showInGeneralStore === true}
                                onChange={(e) => handleUpdateProductField(p.id, { showInGeneralStore: e.target.checked })}
                                className="w-4 h-4 text-rose-600 rounded border-gray-300 focus:ring-rose-500"
                              />
                              <span className="text-[11px] font-medium text-gray-600">
                                {p.showInGeneralStore ? 'Shown Everywhere' : 'Deal Exclusive'}
                              </span>
                            </label>
                          </td>
                          <td className="p-4">
                            <button
                              onClick={() => handleUpdateProductField(p.id, { deal259Status: p.deal259Status === 'disabled' ? 'active' : 'disabled' })}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider cursor-pointer ${
                                p.deal259Status !== 'disabled' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {p.deal259Status !== 'disabled' ? 'Active' : 'Disabled'}
                            </button>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setEditingProduct(p);
                                  setShowAddModal(true);
                                }}
                                title="Edit Product Details"
                                className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRemoveFromDeal259(p.id)}
                                title="Unassign from Deal Store"
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ASSIGN STORE INVENTORY */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Select Existing Inventory Products</h3>
              <p className="text-xs text-gray-500">Pick any product from your store inventory to assign it to Deal Store.</p>
            </div>
            {selectedInventoryIds.length > 0 && (
              <button
                onClick={handleBulkAssign}
                className="bg-rose-600 text-white font-black text-xs uppercase px-4 py-2 rounded-xl hover:bg-rose-700 transition-all flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" />
                Assign Selected ({selectedInventoryIds.length}) to Deal Store
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredInventoryProducts.map((p) => {
              const isSelected = selectedInventoryIds.includes(p.id);
              return (
                <div
                  key={p.id}
                  className={`bg-white rounded-2xl p-3 border transition-all flex flex-col justify-between ${
                    isSelected ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/20' : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="flex gap-3 items-start">
                    <img
                      src={p.images?.[0] || 'https://via.placeholder.com/100'}
                      alt={p.name}
                      className="w-16 h-16 object-cover rounded-xl bg-gray-50 border border-gray-100 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-xs text-gray-900 line-clamp-2 leading-tight">{p.name}</h4>
                      <p className="text-[10px] text-gray-400 mt-0.5">{p.brand || 'No Brand'}</p>
                      <p className="text-xs font-black text-gray-900 mt-1">₹{(p.discountPrice || p.price).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setSelectedInventoryIds(prev => 
                          isSelected ? prev.filter(id => id !== p.id) : [...prev, p.id]
                        );
                      }}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        isSelected ? 'bg-rose-600 text-white border-rose-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {isSelected ? 'Selected' : 'Select'}
                    </button>
                    <button
                      onClick={() => handleAssignToDeal259(p.id)}
                      className="bg-emerald-600 text-white hover:bg-emerald-700 text-[10px] font-black uppercase px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                    >
                      <Check className="w-3 h-3" />
                      1-Click Assign
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: SUB-DEALS MANAGEMENT */}
      {activeTab === 'subdeals' && (
        <div className="space-y-6">
          {/* Create Sub-deal Form */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-rose-600" />
              Add New Sub-Deal Category
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Sub-Deal Title</label>
                <input
                  type="text"
                  placeholder="e.g. Flat Store Deals"
                  value={newSubDeal.title}
                  onChange={(e) => setNewSubDeal({ ...newSubDeal, title: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:bg-white focus:border-rose-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Subtitle</label>
                <input
                  type="text"
                  placeholder="e.g. Products at special offer"
                  value={newSubDeal.subtitle}
                  onChange={(e) => setNewSubDeal({ ...newSubDeal, subtitle: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:bg-white focus:border-rose-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Badge Text</label>
                <input
                  type="text"
                  placeholder="FLAT DEAL"
                  value={newSubDeal.badgeText}
                  onChange={(e) => setNewSubDeal({ ...newSubDeal, badgeText: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:bg-white focus:border-rose-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleAddSubDeal}
                  className="w-full bg-rose-600 text-white font-black text-xs uppercase px-4 py-2.5 rounded-xl hover:bg-rose-700 transition-all cursor-pointer shadow-md"
                >
                  Create Sub-Deal
                </button>
              </div>
            </div>
          </div>

          {/* Sub-Deals List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(configForm.subDeals || DEFAULT_DEAL259_SUBDEALS).map((sd) => (
              <div key={sd.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-xl">{sd.icon || '⚡'}</span>
                    <span className="bg-rose-100 text-rose-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                      {sd.badgeText || 'DEAL'}
                    </span>
                  </div>
                  <h4 className="font-black text-sm text-gray-900 mt-2">{sd.title}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{sd.subtitle}</p>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Order: #{sd.order}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeleteSubDeal(sd.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: PAGE CONFIGURATION */}
      {activeTab === 'config' && (
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6 max-w-3xl">
          <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3">Deal Page Display Settings</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
              <div>
                <h4 className="text-xs font-bold text-gray-900">Enable Deal Page</h4>
                <p className="text-[11px] text-gray-500">Toggle whether visitors can access /deal259 on website & app.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={configForm.enabled !== false}
                  onChange={(e) => setConfigForm({ ...configForm, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
              </label>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700">Page Header Title</label>
              <input
                type="text"
                value={configForm.title}
                onChange={(e) => setConfigForm({ ...configForm, title: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold mt-1 outline-none focus:bg-white focus:border-rose-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700">Page Subtitle / Announcement</label>
              <textarea
                rows={2}
                value={configForm.subtitle}
                onChange={(e) => setConfigForm({ ...configForm, subtitle: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-medium mt-1 outline-none focus:bg-white focus:border-rose-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700">Hero Banner Image URL</label>
              <input
                type="text"
                value={configForm.bannerImage || ''}
                onChange={(e) => setConfigForm({ ...configForm, bannerImage: e.target.value })}
                placeholder="https://..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-mono mt-1 outline-none focus:bg-white focus:border-rose-500"
              />
            </div>

            <div className="pt-4">
              <button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="bg-rose-600 text-white font-black text-xs uppercase px-6 py-3 rounded-xl hover:bg-rose-700 transition-all flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {savingConfig ? 'Saving Settings...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {showAddModal && (
        <AddEditProductForm
          product={editingProduct}
          onClose={() => {
            setShowAddModal(false);
            setEditingProduct(null);
          }}
        />
      )}
    </div>
  );
}
