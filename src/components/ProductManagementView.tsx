import React, { useState, useEffect } from 'react';
import AddEditProductForm from './AddEditProductForm';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { logAdminAction, AdminAction } from '../services/adminLogService';
import { Product, ProductVariant } from '../types';
import toast from 'react-hot-toast';
import { Plus, ChevronRight, ChevronDown, Trash2, CheckCircle2, Edit2, Edit3, X, Check } from 'lucide-react';
import { motion } from 'motion/react';

function ProductListView({ onAddProduct, onEditProduct, onDeleteProduct }: {
  onAddProduct?: () => void,
  onEditProduct?: (p: Product) => void,
  onDeleteProduct?: (id: string, name: string) => Promise<boolean>
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProducts, setExpandedProducts] = useState<string[]>([]);
  const [editingVariant, setEditingVariant] = useState<{ productId: string, variantId: string, name: string, material: string, price: number, stock: number } | null>(null);
  const [addingVariantTo, setAddingVariantTo] = useState<string | null>(null);
  const [newVariant, setNewVariant] = useState({ name: '', material: '', price: 0, stock: 0 });

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });
    return () => unsubscribe();
  }, []);

  const toggleExpand = (productId: string) => {
    setExpandedProducts(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const handleAddVariant = async (productId: string) => {
    if (!newVariant.name) return;
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const toastId = toast.loading('Adding variant...');
    try {
      const v: ProductVariant = {
        id: window.crypto.randomUUID().replace(/-/g, '').slice(0, 9),
        name: newVariant.name,
        material: newVariant.material,
        price: newVariant.price,
        stock: newVariant.stock
      };

      const updatedVariants = [...(product.variants || []), v];
      await updateDoc(doc(db, 'products', productId), { variants: updatedVariants });

      await logAdminAction(
        AdminAction.PRODUCT_UPDATE,
        `Added new variant "${v.name}" to product: ${product.name}`,
        productId,
        'products'
      );

      toast.success('Variant added', { id: toastId });
      setNewVariant({ name: '', extraPrice: 0, stock: 0 });
      setAddingVariantTo(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to add variant', { id: toastId });
    }
  };

  const handleUpdateVariant = async (productId: string, variantId: string) => {
    if (!editingVariant) return;
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const toastId = toast.loading('Updating variant...');
    try {
      const updatedVariants = (product.variants || []).map(v =>
        v.id === variantId ? { ...v, name: editingVariant.name, material: editingVariant.material, price: editingVariant.price, stock: editingVariant.stock } : v
      );

      await updateDoc(doc(db, 'products', productId), { variants: updatedVariants });

      await logAdminAction(
        AdminAction.PRODUCT_UPDATE,
        `Updated variant "${editingVariant.name}" for product: ${product.name}`,
        productId,
        'products'
      );

      toast.success('Variant updated successfully', { id: toastId });
      setEditingVariant(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update variant', { id: toastId });
    }
  };

  const handleQuickStockUpdate = async (productId: string, variantId: string, newStock: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const variant = product.variants?.find(v => v.id === variantId);
    if (!variant || variant.stock === newStock) return;

    try {
      const updatedVariants = (product.variants || []).map(v =>
        v.id === variantId ? { ...v, stock: newStock } : v
      );

      await updateDoc(doc(db, 'products', productId), { variants: updatedVariants });

      await logAdminAction(
        AdminAction.PRODUCT_UPDATE,
        `Directly updated stock for variant "${variant.name}" (Product: ${product.name}) to ${newStock}`,
        productId,
        'products'
      );

      toast.success('Stock updated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update stock');
    }
  };

  const handleDeleteVariant = async (productId: string, variantId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const variant = product.variants?.find(v => v.id === variantId);
    if (!variant) return;

    if (!window.confirm(`Delete variant "${variant.name}"?`)) return;

    const toastId = toast.loading('Deleting variant...');
    try {
      const updatedVariants = (product.variants || []).filter(v => v.id !== variantId);
      await updateDoc(doc(db, 'products', productId), {
        variants: updatedVariants,
        updatedAt: new Date().toISOString()
      });

      try {
        await logAdminAction(
          AdminAction.PRODUCT_UPDATE,
          `Deleted variant "${variant.name}" from product: ${product.name}`,
          productId,
          'products'
        );
      } catch (logErr) {
        console.warn('Logging failed but variant deletion succeeded:', logErr);
      }

      toast.success('Variant deleted successfully', { id: toastId });
    } catch (err) {
      console.error('Variant deletion failed:', err);
      toast.error('Failed to delete variant: ' + (err instanceof Error ? err.message : 'Unknown error'), { id: toastId });
      handleFirestoreError(err, OperationType.UPDATE, `products/${productId}`);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-20">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Inventory & Variants</h2>
          <p className="text-sm text-gray-500">Manage product stock and variants in detail</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={onAddProduct}
            className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add New Product
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
              <tr>
                <th className="px-6 py-4 w-10"></th>
                <th className="px-6 py-4">Product Info</th>
                <th className="px-6 py-4">Total Stock</th>
                <th className="px-6 py-4">Variants Count</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">Loading products...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">No products found.</td></tr>
              ) : products.map(product => {
                const isExpanded = expandedProducts.includes(product.id);
                return (
                  <React.Fragment key={product.id}>
                    <tr className={`hover:bg-gray-50 transition-colors cursor-pointer ${isExpanded ? 'bg-gray-50/50' : ''}`} onClick={() => toggleExpand(product.id)}>
                      <td className="px-6 py-4">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={product.images[0]} className="w-10 h-10 rounded-lg object-cover" alt="" />
                          <div>
                            <p className="text-sm font-bold text-gray-900">{product.name}</p>
                            <p className="text-xs text-gray-500">ID: {product.id.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">
                        <span className={product.stock <= 5 ? "text-red-500 font-bold" : "text-gray-700"}>
                          {product.stock}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold">
                          {product.variants?.length || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${product.stock > 0 ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                            {product.stock > 0 ? 'In Stock' : 'Out of Stock'}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditProduct?.(product);
                            }}
                            className="p-1 text-gray-400 hover:text-primary transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (onDeleteProduct) {
                                await onDeleteProduct(product.id, product.name);
                              }
                            }}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-gray-50/30">
                        <td colSpan={5} className="px-8 py-6">
                          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                              <h4 className="text-xs font-black uppercase tracking-widest text-gray-500">Variants Table</h4>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAddingVariantTo(addingVariantTo === product.id ? null : product.id);
                                  setNewVariant({ name: '', material: '', price: product.price, stock: 0 });
                                }}
                                className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:underline transition-colors ${addingVariantTo === product.id ? 'text-red-500' : 'text-primary'}`}
                              >
                                {addingVariantTo === product.id ? <><X className="w-3 h-3" /> Cancel</> : <><Plus className="w-3 h-3" /> Quick Add</>}
                              </button>
                            </div>
                            <table className="w-full text-left bg-white">
                              <thead className="bg-gray-50/50 text-[9px] uppercase font-bold text-gray-400 tracking-wider">
                                <tr>
                                  <th className="px-6 py-3">Variant Name</th>
                                  <th className="px-6 py-3">Material</th>
                                  <th className="px-6 py-3">Price</th>
                                  <th className="px-6 py-3">Stock</th>
                                  <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {addingVariantTo === product.id && (
                                  <tr className="bg-primary/5">
                                    <td className="px-6 py-3">
                                      <input
                                        autoFocus
                                        placeholder="XL / Red"
                                        className="w-full bg-white border border-primary/20 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/10"
                                        value={newVariant.name}
                                        onChange={e => setNewVariant(p => ({ ...p, name: e.target.value }))}
                                      />
                                    </td>
                                    <td className="px-6 py-3">
                                      <input
                                        placeholder="Cotton"
                                        className="w-full bg-white border border-primary/20 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/10"
                                        value={newVariant.material}
                                        onChange={e => setNewVariant(p => ({ ...p, material: e.target.value }))}
                                      />
                                    </td>
                                    <td className="px-6 py-3">
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs text-gray-400">₹</span>
                                        <input
                                          type="number"
                                          className="w-20 bg-white border border-primary/20 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/10"
                                          value={newVariant.price}
                                          onChange={e => setNewVariant(p => ({ ...p, price: Number(e.target.value) }))}
                                        />
                                      </div>
                                    </td>
                                    <td className="px-6 py-3">
                                      <input
                                        type="number"
                                        className="w-20 bg-white border border-primary/20 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/10"
                                        value={newVariant.stock}
                                        onChange={e => setNewVariant(p => ({ ...p, stock: Number(e.target.value) }))}
                                      />
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                      <button
                                        onClick={() => handleAddVariant(product.id)}
                                        disabled={!newVariant.name}
                                        className="bg-primary text-white text-[10px] font-black px-4 py-1.5 rounded-lg shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all disabled:opacity-50"
                                      >
                                        Save
                                      </button>
                                    </td>
                                  </tr>
                                )}
                                {(!product.variants || product.variants.length === 0) && addingVariantTo !== product.id ? (
                                  <tr>
                                    <td colSpan={5} className="px-6 py-6 text-center text-xs text-gray-400 italic">
                                      No variants configured for this product.
                                    </td>
                                  </tr>
                                ) : (
                                  product.variants.map(variant => {
                                    const isEditing = editingVariant?.variantId === variant.id;
                                    return (
                                      <tr key={variant.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-3">
                                          {isEditing ? (
                                            <input
                                              className="w-full bg-gray-50 border-none rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/20"
                                              value={editingVariant.name || ''}
                                              onChange={e => setEditingVariant(p => p ? { ...p, name: e.target.value } : null)}
                                            />
                                          ) : (
                                            <span className="text-xs font-bold text-gray-700">{variant.name}</span>
                                          )}
                                        </td>
                                        <td className="px-6 py-3">
                                          {isEditing ? (
                                            <input
                                              className="w-full bg-gray-50 border-none rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/20"
                                              value={editingVariant.material || ''}
                                              onChange={e => setEditingVariant(p => p ? { ...p, material: e.target.value } : null)}
                                            />
                                          ) : (
                                            <span className="text-xs text-gray-500">{variant.material || '-'}</span>
                                          )}
                                        </td>
                                        <td className="px-6 py-3">
                                          {isEditing ? (
                                            <div className="flex items-center gap-1">
                                              <span className="text-xs text-gray-400">₹</span>
                                              <input
                                                type="number"
                                                className="w-20 bg-gray-50 border-none rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/20"
                                                value={editingVariant.price || 0}
                                                onChange={e => setEditingVariant(p => p ? { ...p, price: Number(e.target.value) } : null)}
                                              />
                                            </div>
                                          ) : (
                                            <span className="text-xs font-bold text-blue-600">₹{(variant.price || 0).toLocaleString()}</span>
                                          )}
                                        </td>
                                        <td className="px-6 py-3">
                                          {isEditing ? (
                                            <input
                                              type="number"
                                              className="w-20 bg-gray-50 border-none rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/20"
                                              value={editingVariant.stock || 0}
                                              onChange={e => setEditingVariant(p => p ? { ...p, stock: Number(e.target.value) } : null)}
                                            />
                                          ) : (
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="number"
                                                defaultValue={variant.stock}
                                                key={`${product.id}-${variant.id}-${variant.stock}`}
                                                onBlur={(e) => handleQuickStockUpdate(product.id, variant.id, Number(e.target.value))}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                    handleQuickStockUpdate(product.id, variant.id, Number((e.target as HTMLInputElement).value));
                                                    (e.target as HTMLInputElement).blur();
                                                  }
                                                }}
                                                className={`w-20 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-1 focus:ring-primary/20 outline-none transition-all ${variant.stock <= 5 ? 'text-red-500 border-red-100' : 'text-gray-700'}`}
                                              />
                                              {variant.stock <= 5 && <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />}
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                          <div className="flex items-center justify-end gap-2">
                                            {isEditing ? (
                                              <>
                                                <button onClick={() => setEditingVariant(null)} className="p-1.5 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => handleUpdateVariant(product.id, variant.id)} className="p-1.5 text-blue-500 hover:text-blue-600"><Check className="w-3.5 h-3.5" /></button>
                                              </>
                                            ) : (
                                              <>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingVariant({ productId: product.id, variantId: variant.id, name: variant.name || '', material: variant.material || '', price: variant.price || 0, stock: variant.stock });
                                                  }}
                                                  className="p-1.5 text-gray-400 hover:text-primary transition-colors"
                                                >
                                                  <Edit3 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteVariant(product.id, variant.id);
                                                  }}
                                                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
export default function ProductManagementView() {
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!window.confirm(`Are you sure you want to PERMANENTLY DELETE "${productName}"? This cannot be undone.`)) return false;
    const toastId = toast.loading('Deleting product...');
    try {
      await deleteDoc(doc(db, 'products', productId));
      toast.success('Product deleted successfully', { id: toastId });
      return true;
    } catch (err) {
      toast.error('Deletion failed', { id: toastId });
      return false;
    }
  };

  if (showAddProduct) {
    return <AddEditProductForm product={editingProduct} onDelete={handleDeleteProduct} onClose={() => { setShowAddProduct(false); setEditingProduct(null); }} />;
  }

  return <ProductListView onAddProduct={() => { setEditingProduct(null); setShowAddProduct(true); }} onEditProduct={(p) => { setEditingProduct(p); setShowAddProduct(true); }} onDeleteProduct={handleDeleteProduct} />;
}