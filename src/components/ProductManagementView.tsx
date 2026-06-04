import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, Edit2, Trash2, Filter, Image as ImageIcon, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import AddEditProductForm from './AddEditProductForm';
import { useAuthStore } from '../store';

export default function ProductManagementView() {
  const { user } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    // In a real app, you might filter by vendorId if the user is a vendor.
    // const q = user?.role === 'vendor' ? query(collection(db, 'products'), where('vendorId', '==', user.uid), orderBy('createdAt', 'desc')) : query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prodData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Product));
      setProducts(prodData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching products:", error);
      toast.error("Failed to load products.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to permanently delete "${name}"?`)) {
      try {
        await deleteDoc(doc(db, 'products', id));
        toast.success('Product deleted successfully');
      } catch (error) {
        console.error('Error deleting product:', error);
        toast.error('Failed to delete product');
      }
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Product Management</h2>
          <p className="text-sm text-gray-500">Add, edit, and manage your inventory.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:w-64">
            <input 
              type="text" 
              placeholder="Search products..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
          <button className="hidden sm:flex items-center gap-2 bg-gray-50 border border-gray-200 px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors">
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button
            onClick={() => {
              setEditingProduct(null);
              setShowForm(true);
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Add Product
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
              <tr>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">SKU / Brand</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4 text-center">Stock</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500 font-medium">Loading products...</td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-400 font-medium">No products found. Add a new product to get started.</td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl border border-gray-200 overflow-hidden bg-white shrink-0 flex items-center justify-center">
                          {product.images?.[0] || product.primaryImage ? (
                            <img src={product.images?.[0] || product.primaryImage} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-gray-300" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 line-clamp-2 max-w-[250px]">{product.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{product.variants?.length ? `${product.variants.length} Variants` : 'Single Product'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-mono text-gray-600 mb-0.5">{product.sku || 'N/A'}</div>
                      <div className="text-xs font-medium text-gray-500">{product.brand || 'No Brand'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-indigo-900">₹{product.discountPrice?.toLocaleString() || product.price?.toLocaleString()}</div>
                      {product.mrp && product.mrp > (product.discountPrice || product.price) && (
                        <div className="text-xs text-gray-400 line-through">₹{product.mrp.toLocaleString()}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {product.variants?.length ? (
                         <span className="text-sm font-bold text-gray-700">{product.variants.reduce((acc, v) => acc + (v.stock || 0), 0)}</span>
                      ) : (
                        <span className={`text-sm font-bold ${product.stock > 10 ? 'text-emerald-600' : product.stock > 0 ? 'text-amber-500' : 'text-rose-500'}`}>
                          {product.stock}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        product.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 
                        product.status === 'inactive' ? 'bg-gray-100 text-gray-600' :
                        product.status === 'out_of_stock' ? 'bg-rose-50 text-rose-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>
                        {product.status === 'active' ? <CheckCircle2 className="w-3 h-3" /> : 
                         product.status === 'inactive' ? <XCircle className="w-3 h-3" /> : null}
                        {product.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingProduct(product);
                            setShowForm(true);
                          }}
                          className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
                          title="Edit Product"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id, product.name)}
                          className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"
                          title="Delete Product"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal Form */}
      <AnimatePresence>
        {showForm && (
          <AddEditProductForm 
            product={editingProduct} 
            onClose={() => setShowForm(false)} 
            onSuccess={() => setShowForm(false)} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
