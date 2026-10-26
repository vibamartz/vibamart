import React, { useState, useEffect, useMemo, useRef } from 'react';
import AddEditProductForm from './AddEditProductForm';
import CategoryAssignmentModal from './CategoryAssignmentModal';
import BrandSectionsBar from './BrandSectionsBar';
import BrandSectionAssignmentModal from './BrandSectionAssignmentModal';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../backend/firebase/firebase';
import { logAdminAction, AdminAction } from '../../backend/services/adminLogService';
import { Product, ProductVariant, FlatCategoryNode } from '../../shared/types';
import toast from 'react-hot-toast';
import { productNeedsKeywordUpgrade, upgradeExistingProductKeywords } from '../../shared/utilities/productKeywordGenerator';
import {
  Plus, ChevronRight, ChevronDown, Trash2, CheckCircle2, Edit2, Edit3,
  X, Check, Copy, Search, Hash, Eye, EyeOff, Sparkles, Layers, Filter,
  CheckSquare, Square, FolderTree, Tag
} from 'lucide-react';
import { motion } from 'motion/react';
import { formatProductCode, cleanProductCode, generateUniqueProductCode } from '../../shared/utilities/productCode';
import { normalizeProductDoc, fixDuplicateProductIds, repairDuplicateProductIdsInFirestore } from '../../shared/utilities/productId';
import { useCategoryStore, useVisualNestedSubcategoryStore, useInventoryBrandSectionStore } from '../../backend/store';
import { buildFlatCategoryHierarchy, getProductAssignmentNodes } from '../../shared/utilities/categoryHierarchyUtils';
import { removeProductFromCategoryNode } from '../../backend/services/productAssignmentService';

function ProductListView({ onAddProduct, onEditProduct, onDeleteProduct }: {
  onAddProduct?: (sectionId?: string) => void,
  onEditProduct?: (p: Product) => void,
  onDeleteProduct?: (id: string, name: string) => Promise<boolean>
}) {
  const { categories } = useCategoryStore();
  const { items: visualNestedItems } = useVisualNestedSubcategoryStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProducts, setExpandedProducts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingVariant, setEditingVariant] = useState<{ productId: string, variantId: string, name: string, material: string, price: number, stock: number } | null>(null);
  const [addingVariantTo, setAddingVariantTo] = useState<string | null>(null);
  const [newVariant, setNewVariant] = useState({ name: '', material: '', price: 0, stock: 0 });

  // Category Assignment & Bulk Selection state
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSubCategory, setFilterSubCategory] = useState('all');
  const [filterNestedSubCategory, setFilterNestedSubCategory] = useState('all');
  const [filterVisual, setFilterVisual] = useState('all');
  const [filterBrand, setFilterBrand] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlacement, setFilterPlacement] = useState<'all' | 'main_only'>('all');

  // Internal Brand Section state (Admin Dashboard Inventory only)
  const { sections: brandSections, initSections } = useInventoryBrandSectionStore();
  const [activeBrandSectionId, setActiveBrandSectionId] = useState<string>('all');
  const [isBrandAssignmentModalOpen, setIsBrandAssignmentModalOpen] = useState(false);
  const [productsForBrandModal, setProductsForBrandModal] = useState<Product[]>([]);

  useEffect(() => {
    const unsubscribe = initSections();
    return () => unsubscribe();
  }, [initSections]);

  const hasRepairedDuplicatesRef = useRef(false);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const normalized = snapshot.docs.map(doc => normalizeProductDoc(doc));
      const { fixedProducts, duplicatesFound } = fixDuplicateProductIds(normalized);
      setProducts(fixedProducts);
      setLoading(false);

      if (duplicatesFound > 0 && !hasRepairedDuplicatesRef.current) {
        hasRepairedDuplicatesRef.current = true;
        repairDuplicateProductIdsInFirestore(db).then((res) => {
          if (res.fixed > 0) {
            toast.success(`Identified and fixed ${res.fixed} duplicate product ID(s) without affecting product data.`);
          }
        }).catch((err) => {
          console.error('[ProductManagementView] Duplicate product ID repair error:', err);
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });
    return () => unsubscribe();
  }, []);

  const [isUpgradingKeywords, setIsUpgradingKeywords] = useState(false);
  const processedKeywordIdsRef = useRef<Set<string>>(new Set());

  // Automatically check and upgrade keywords for any existing products missing them or having fewer than 6 keywords
  useEffect(() => {
    if (products.length === 0) return;
    const candidates = products.filter(p => productNeedsKeywordUpgrade(p, 6) && !processedKeywordIdsRef.current.has(p.id));
    if (candidates.length === 0) return;

    let isMounted = true;
    const runAutoUpgrade = async () => {
      for (const prod of candidates) {
        if (!isMounted) break;
        processedKeywordIdsRef.current.add(prod.id);
        try {
          const { needsUpdate, updatedTags } = await upgradeExistingProductKeywords(prod, {
            categoryName: categories.find(c => c.id === prod.categoryId)?.name,
            minCount: 6
          });
          if (needsUpdate && updatedTags.length >= 6) {
            await updateDoc(doc(db, 'products', prod.id), {
              tags: updatedTags,
              updatedAt: new Date().toISOString()
            });
          }
        } catch (err) {
          console.warn(`[ProductManagementView] Keyword auto-upgrade failed for ${prod.id}:`, err);
        }
      }
    };

    const timer = setTimeout(runAutoUpgrade, 1200);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [products, categories]);

  const handleUpgradeAllKeywords = async () => {
    setIsUpgradingKeywords(true);
    const toastId = toast.loading('Auditing catalog products and upgrading keywords...');
    try {
      const candidates = products.filter(p => productNeedsKeywordUpgrade(p, 6));
      if (candidates.length === 0) {
        toast.success('All catalog products already have at least 6 relevant search keywords!', { id: toastId });
        setIsUpgradingKeywords(false);
        return;
      }

      let upgraded = 0;
      for (const prod of candidates) {
        const { needsUpdate, updatedTags } = await upgradeExistingProductKeywords(prod, {
          categoryName: categories.find(c => c.id === prod.categoryId)?.name,
          minCount: 6
        });
        if (needsUpdate && updatedTags.length >= 6) {
          await updateDoc(doc(db, 'products', prod.id), {
            tags: updatedTags,
            updatedAt: new Date().toISOString()
          });
          upgraded++;
        }
      }

      toast.success(`Keyword upgrade complete! Successfully upgraded ${upgraded} product(s) with at least 6 keywords.`, { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to complete keyword upgrade', { id: toastId });
    } finally {
      setIsUpgradingKeywords(false);
    }
  };

  const [isFixingProductIds, setIsFixingProductIds] = useState(false);

  const handleAuditAndFixProductIds = async () => {
    setIsFixingProductIds(true);
    const toastId = toast.loading('Auditing product IDs across catalog...');
    try {
      const res = await repairDuplicateProductIdsInFirestore(db);
      if (res.fixed > 0) {
        toast.success(`Identified and fixed ${res.fixed} duplicate product ID(s) without affecting product data.`, { id: toastId });
      } else {
        toast.success(`All ${res.scanned} product IDs are strictly unique. No duplicates found.`, { id: toastId });
      }
    } catch (err) {
      console.error('Failed to audit/fix product IDs:', err);
      toast.error('Failed to audit product IDs', { id: toastId });
    } finally {
      setIsFixingProductIds(false);
    }
  };

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
        stock: newVariant.stock,
        inStock: newVariant.stock > 0,
        status: newVariant.stock > 0 ? 'active' : 'out_of_stock'
      };

      const updatedVariants = [...(product.variants || []), v];
      const activeVars = updatedVariants.filter((item: any) => !item.disabled && item.status !== 'disabled');
      const totalStock = activeVars.reduce((sum, item) => sum + (Number(item.stock) || 0), 0);

      await updateDoc(doc(db, 'products', productId), {
        variants: updatedVariants,
        stock: totalStock,
        updatedAt: new Date().toISOString()
      });

      await logAdminAction(
        AdminAction.PRODUCT_UPDATE,
        `Added new variant "${v.name}" to product: ${product.name} (Total stock: ${totalStock})`,
        productId,
        'products'
      );

      toast.success('Variant added & product stock updated', { id: toastId });
      setNewVariant({ name: '', material: '', price: 0, stock: 0 });
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
        v.id === variantId
          ? {
            ...v,
            name: editingVariant.name,
            material: editingVariant.material,
            price: editingVariant.price,
            stock: editingVariant.stock,
            inStock: editingVariant.stock > 0,
            status: v.disabled ? 'disabled' : (editingVariant.stock > 0 ? 'active' : 'out_of_stock')
          }
          : v
      );

      const activeVars = updatedVariants.filter((item: any) => !item.disabled && item.status !== 'disabled');
      const totalStock = activeVars.reduce((sum, item) => sum + (Number(item.stock) || 0), 0);

      await updateDoc(doc(db, 'products', productId), {
        variants: updatedVariants,
        stock: totalStock,
        updatedAt: new Date().toISOString()
      });

      await logAdminAction(
        AdminAction.PRODUCT_UPDATE,
        `Updated variant "${editingVariant.name}" for product: ${product.name} (Total stock: ${totalStock})`,
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
        v.id === variantId
          ? {
            ...v,
            stock: newStock,
            inStock: newStock > 0,
            status: v.disabled ? 'disabled' : (newStock > 0 ? 'active' : 'out_of_stock')
          }
          : v
      );

      const activeVars = updatedVariants.filter((item: any) => !item.disabled && item.status !== 'disabled');
      const totalStock = activeVars.reduce((sum, item) => sum + (Number(item.stock) || 0), 0);

      await updateDoc(doc(db, 'products', productId), {
        variants: updatedVariants,
        stock: totalStock,
        updatedAt: new Date().toISOString()
      });

      await logAdminAction(
        AdminAction.PRODUCT_UPDATE,
        `Directly updated stock for variant "${variant.name}" (Product: ${product.name}) to ${newStock} (Total product stock: ${totalStock})`,
        productId,
        'products'
      );

      toast.success(`Variant & product total stock updated (${totalStock} units)`);
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
      const activeVars = updatedVariants.filter((item: any) => !item.disabled && item.status !== 'disabled');
      const totalStock = updatedVariants.length > 0
        ? activeVars.reduce((sum, item) => sum + (Number(item.stock) || 0), 0)
        : (product.stock || 0);

      await updateDoc(doc(db, 'products', productId), {
        variants: updatedVariants,
        stock: totalStock,
        updatedAt: new Date().toISOString()
      });

      try {
        await logAdminAction(
          AdminAction.PRODUCT_UPDATE,
          `Deleted variant "${variant.name}" from product: ${product.name} (Total stock: ${totalStock})`,
          productId,
          'products'
        );
      } catch (logErr) {
        console.warn('Logging failed but variant deletion succeeded:', logErr);
      }

      toast.success('Variant deleted & stock updated', { id: toastId });
    } catch (err) {
      console.error('Variant deletion failed:', err);
      toast.error('Failed to delete variant: ' + (err instanceof Error ? err.message : 'Unknown error'), { id: toastId });
      handleFirestoreError(err, OperationType.UPDATE, `products/${productId}`);
    }
  };

  const handleToggleGst = async (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    const currentEnabled = product.enableGst !== false && (product.gst || 0) > 0;
    const nextEnabled = !currentEnabled;
    const nextGst = nextEnabled ? (product.gst && product.gst > 0 ? product.gst : 18) : 0;

    const toastId = toast.loading(`${nextEnabled ? 'Enabling' : 'Disabling'} GST for ${product.name}...`);
    try {
      await updateDoc(doc(db, 'products', product.id), {
        enableGst: nextEnabled,
        gst: nextGst
      });
      await logAdminAction(
        AdminAction.PRODUCT_UPDATE,
        `${nextEnabled ? 'Enabled' : 'Disabled'} GST (${nextGst}%) for product: ${product.name}`,
        product.id,
        'products'
      );
      toast.success(`GST ${nextEnabled ? `enabled (${nextGst}%)` : 'disabled'} for ${product.name}`, { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to update GST setting', { id: toastId });
    }
  };

  const handleToggleFreeDelivery = async (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    const currentEnabled = product.isFreeDelivery !== false;
    const nextEnabled = !currentEnabled;

    const toastId = toast.loading(`${nextEnabled ? 'Enabling' : 'Disabling'} Free Delivery for ${product.name}...`);
    try {
      await updateDoc(doc(db, 'products', product.id), {
        isFreeDelivery: nextEnabled,
      });
      await logAdminAction(
        AdminAction.PRODUCT_UPDATE,
        `${nextEnabled ? 'Enabled' : 'Disabled'} Free Delivery for product: ${product.name}`,
        product.id,
        'products'
      );
      toast.success(`Free Delivery ${nextEnabled ? 'enabled' : 'disabled'} for ${product.name}`, { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to update Free Delivery setting', { id: toastId });
    }
  };

  const handleToggleVisibility = async (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    const currentVisible = product.isVisible !== false;
    const nextVisible = !currentVisible;

    const toastId = toast.loading(`${nextVisible ? 'Enabling' : 'Disabling'} visibility for ${product.name}...`);
    try {
      await updateDoc(doc(db, 'products', product.id), {
        isVisible: nextVisible
      });
      await logAdminAction(
        AdminAction.PRODUCT_UPDATE,
        `${nextVisible ? 'Enabled' : 'Disabled'} storefront visibility for product: ${product.name}`,
        product.id,
        'products'
      );
      toast.success(`Product ${nextVisible ? 'is now visible to customers' : 'is now hidden from customers'}`, { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to update product visibility', { id: toastId });
    }
  };

  // Build unified flat category nodes for assignment checking
  const allCategoryNodes = useMemo(() => {
    return buildFlatCategoryHierarchy(categories, visualNestedItems, products);
  }, [categories, visualNestedItems, products]);

  // Extract unique brands for filter dropdown
  const uniqueBrands = useMemo(() => {
    const bSet = new Set<string>();
    products.forEach(p => {
      if (p.brand && p.brand.trim()) bSet.add(p.brand.trim());
    });
    return Array.from(bSet).sort();
  }, [products]);

  // Subcategories available based on selected category filter
  const availableSubCategories = useMemo(() => {
    if (filterCategory === 'all') {
      return categories.flatMap(c => c.subcategories || []);
    }
    const cat = categories.find(c => c.id === filterCategory);
    return cat?.subcategories || [];
  }, [categories, filterCategory]);

  // Nested subcategories available based on selected subcategory filter
  const availableNestedSubCategories = useMemo(() => {
    if (filterSubCategory === 'all') {
      return availableSubCategories.flatMap(s => s.subcategories || []);
    }
    const sub = availableSubCategories.find(s => s.id === filterSubCategory);
    return sub?.subcategories || [];
  }, [availableSubCategories, filterSubCategory]);

  // Check if a product exists ONLY in a Main Category and not in any Subcategory, Nested Subcategory, or other category placement
  const isProductMainCategoryOnly = (p: Product) => {
    // 1. Must exist in a Main Category
    const hasMainCategory = Boolean(
      p.categoryId || (Array.isArray(p.categories) && p.categories.length > 0)
    );
    if (!hasMainCategory) return false;

    // 2. Must NOT be assigned to any Subcategory
    const hasSubCategory = Boolean(
      p.subCategoryId || (Array.isArray(p.subCategoryIds) && p.subCategoryIds.length > 0)
    );
    if (hasSubCategory) return false;

    // 3. Must NOT be assigned to any Nested Subcategory or Deep Subcategory
    const hasNestedSubCategory = Boolean(
      p.nestedSubCategoryId || (Array.isArray(p.nestedSubCategoryIds) && p.nestedSubCategoryIds.length > 0)
    );
    if (hasNestedSubCategory) return false;

    // 4. Must NOT be assigned to any Visual Showcase or other category placement
    const hasVisual = Boolean(
      p.visualNestedSubcategoryId ||
      (Array.isArray(p.visualNestedSubcategoryIds) && p.visualNestedSubcategoryIds.length > 0) ||
      visualNestedItems.some(v => Array.isArray(v.productIds) && v.productIds.includes(p.id))
    );
    if (hasVisual) return false;

    // 5. Cross-check against dynamic category assignment nodes
    const assignedNodes = getProductAssignmentNodes(p, allCategoryNodes, visualNestedItems);
    const hasNonMainPlacement = assignedNodes.some(n => n.level !== 'category');
    if (hasNonMainPlacement) return false;

    return true;
  };

  const mainCategoryOnlyCount = useMemo(() => {
    return products.filter(isProductMainCategoryOnly).length;
  }, [products, visualNestedItems, allCategoryNodes]);

  // Filter products by search query and category/brand/status/placement filters
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // 1. Text Search (name, id, productCode, SKU, brand, tags)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const cleanQ = cleanProductCode(q);
        const nameMatch = p.name.toLowerCase().includes(q);
        const idMatch = p.id.toLowerCase().includes(q);
        const codeMatch = p.productCode && (
          p.productCode.toLowerCase().includes(q) ||
          (cleanQ.length > 0 && cleanProductCode(p.productCode).includes(cleanQ))
        );
        const brandMatch = p.brand?.toLowerCase().includes(q);
        const skuMatch = p.sku?.toLowerCase().includes(q);
        const tagsMatch = p.tags?.some(t => t.toLowerCase().includes(q));
        if (!nameMatch && !idMatch && !codeMatch && !brandMatch && !skuMatch && !tagsMatch) {
          return false;
        }
      }

      // 2. Category Filter
      if (filterCategory !== 'all') {
        const matchesCat = p.categoryId === filterCategory || Boolean(p.categories?.includes(filterCategory));
        if (!matchesCat) return false;
      }

      // 3. SubCategory Filter
      if (filterSubCategory !== 'all') {
        const matchesSub = p.subCategoryId === filterSubCategory || Boolean(p.subCategoryIds?.includes(filterSubCategory));
        if (!matchesSub) return false;
      }

      // 4. Nested SubCategory Filter
      if (filterNestedSubCategory !== 'all') {
        const matchesNested = p.nestedSubCategoryId === filterNestedSubCategory || Boolean(p.nestedSubCategoryIds?.includes(filterNestedSubCategory));
        if (!matchesNested) return false;
      }

      // 5. Visual Nested Subcategory Filter
      if (filterVisual !== 'all') {
        const visualItem = visualNestedItems.find(v => v.id === filterVisual);
        const isAssigned = p.visualNestedSubcategoryId === filterVisual ||
          Boolean(p.visualNestedSubcategoryIds?.includes(filterVisual)) ||
          Boolean(visualItem?.productIds?.includes(p.id));
        if (!isAssigned) return false;
      }

      // 6. Brand Filter
      if (filterBrand !== 'all') {
        if (!p.brand || p.brand.trim().toLowerCase() !== filterBrand.toLowerCase()) {
          return false;
        }
      }

      // 7. Status Filter
      if (filterStatus === 'in_stock' && p.stock <= 0) return false;
      if (filterStatus === 'out_of_stock' && p.stock > 0) return false;
      if (filterStatus === 'visible' && p.isVisible === false) return false;
      if (filterStatus === 'hidden' && p.isVisible !== false) return false;

      // 8. Placement Filter: Main Category Only (no subcategory, nested subcategory, or showcase placement)
      if (filterPlacement === 'main_only') {
        if (!isProductMainCategoryOnly(p)) return false;
      }

      // 9. Internal Brand Section Filter (Exclusively for internal inventory organization)
      if (activeBrandSectionId !== 'all') {
        if (activeBrandSectionId === 'unassigned') {
          const validSectionIds = new Set(brandSections.map(s => s.id));
          if (p.inventorySectionId && validSectionIds.has(p.inventorySectionId)) {
            return false;
          }
        } else {
          if (p.inventorySectionId !== activeBrandSectionId) {
            return false;
          }
        }
      }

      return true;
    });
  }, [
    products,
    searchQuery,
    filterCategory,
    filterSubCategory,
    filterNestedSubCategory,
    filterVisual,
    filterBrand,
    filterStatus,
    filterPlacement,
    visualNestedItems,
    allCategoryNodes,
    activeBrandSectionId,
    brandSections
  ]);

  const hasActiveFilters = filterCategory !== 'all' || filterSubCategory !== 'all' ||
    filterNestedSubCategory !== 'all' || filterVisual !== 'all' ||
    filterBrand !== 'all' || filterStatus !== 'all' || filterPlacement !== 'all' || Boolean(searchQuery.trim());

  const resetAllFilters = () => {
    setSearchQuery('');
    setFilterCategory('all');
    setFilterSubCategory('all');
    setFilterNestedSubCategory('all');
    setFilterVisual('all');
    setFilterBrand('all');
    setFilterStatus('all');
    setFilterPlacement('all');
    setActiveBrandSectionId('all');
  };

  // Selection handlers
  const handleToggleSelectProduct = (productId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedProductIds(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map(p => p.id));
    }
  };

  // Products currently selected for assignment
  const selectedProductsForModal = useMemo(() => {
    return products.filter(p => selectedProductIds.includes(p.id));
  }, [products, selectedProductIds]);

  // Remove individual category assignment from product
  const handleRemoveCategoryAssignment = async (e: React.MouseEvent, product: Product, node: FlatCategoryNode) => {
    e.stopPropagation();
    if (!window.confirm(`Remove "${product.name}" from ${node.breadcrumb}?`)) return;

    const toastId = toast.loading(`Removing from ${node.name}...`);
    try {
      await removeProductFromCategoryNode(product, node);
      toast.success(`Removed from ${node.name}`, { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to remove assignment', { id: toastId });
    }
  };

  // Quick single product assignment
  const handleOpenAssignForProduct = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    setSelectedProductIds([product.id]);
    setIsAssignmentModalOpen(true);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 pb-12">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Inventory & Variants</h2>
          <p className="text-xs text-gray-500">Manage product stock, 12-digit Product Codes, variants, and category assignments</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Admin Search Bar: Name, ID, SKU, or Product Code */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Name, SKU, Code..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-7 py-1.5 text-xs font-semibold outline-none focus:border-primary focus:bg-white transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Bulk Assign to Categories Button (Shown when items are selected) */}
          {selectedProductIds.length > 0 && (
            <button
              onClick={() => setIsAssignmentModalOpen(true)}
              className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 hover:scale-[1.02] active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              Assign to Categories ({selectedProductIds.length})
            </button>
          )}

          {/* Bulk Assign to Brand Section Button (Shown when items are selected) */}
          {selectedProductIds.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const selectedProds = products.filter(p => selectedProductIds.includes(p.id));
                setProductsForBrandModal(selectedProds);
                setIsBrandAssignmentModalOpen(true);
              }}
              className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              <Tag className="w-3.5 h-3.5" />
              Assign to Brand ({selectedProductIds.length})
            </button>
          )}

          <button
            onClick={handleUpgradeAllKeywords}
            disabled={isUpgradingKeywords}
            className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 px-3.5 py-2 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-indigo-100 hover:scale-[1.02] active:scale-95 transition-all shrink-0 disabled:opacity-50 cursor-pointer shadow-xs"
            title="Automatically audit catalog products and upgrade AI keywords"
          >
            <Sparkles className={`w-3.5 h-3.5 text-indigo-600 ${isUpgradingKeywords ? 'animate-spin' : ''}`} />
            <span>{isUpgradingKeywords ? 'Upgrading...' : 'AI Keywords'}</span>
          </button>

          <button
            onClick={handleAuditAndFixProductIds}
            disabled={isFixingProductIds}
            className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3.5 py-2 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-emerald-100 hover:scale-[1.02] active:scale-95 transition-all shrink-0 disabled:opacity-50 cursor-pointer shadow-xs"
            title="Scan catalog to ensure every product has a unique ID and fix any duplicate IDs"
          >
            <CheckCircle2 className={`w-3.5 h-3.5 text-emerald-600 ${isFixingProductIds ? 'animate-spin' : ''}`} />
            <span>{isFixingProductIds ? 'Verifying...' : 'Verify Product IDs'}</span>
          </button>

          <button
            onClick={() => onAddProduct?.()}
            className="flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Product
          </button>
        </div>
      </div>

      {/* 2. Brand Sections (Positioned exactly between Inventory & Variants and Filter Inventory) */}
      <BrandSectionsBar
        products={products}
        activeSectionId={activeBrandSectionId}
        onSelectSection={setActiveBrandSectionId}
        onCreateNewProductForSection={(secId) => {
          onAddProduct?.(secId);
        }}
        onOpenAssignModal={(pids) => {
          const prodsToAssign = products.filter(p => pids.includes(p.id));
          setProductsForBrandModal(prodsToAssign);
          setIsBrandAssignmentModalOpen(true);
        }}
      />

      {/* Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
            <Filter className="w-3.5 h-3.5 text-primary" />
            <span>Filter Inventory:</span>
            {/* Quick Toggle Pill for Main Category Only */}
            <button
              type="button"
              onClick={() => setFilterPlacement(prev => prev === 'main_only' ? 'all' : 'main_only')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ml-1 ${filterPlacement === 'main_only'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                }`}
              title="Show only products that exist in a Main Category and have NOT been assigned to any Subcategory or Nested Subcategory"
            >
              <FolderTree className="w-3 h-3" />
              <span>Main Category Only ({mainCategoryOnlyCount})</span>
            </button>
          </div>
          {hasActiveFilters && (
            <button
              onClick={resetAllFilters}
              className="text-xs font-bold text-rose-500 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3 h-3" /> Clear All Filters
            </button>
          )}
        </div>

        {filterPlacement === 'main_only' && (
          <div className="flex items-center justify-between bg-amber-50/80 text-amber-900 border border-amber-200/80 px-3 py-1.5 rounded-xl text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              📁 <strong>Filtered by Placement:</strong> Showing {filteredProducts.length} product(s) assigned ONLY to a Main Category with no Subcategories or Showcases.
            </span>
            <button
              onClick={() => setFilterPlacement('all')}
              className="text-[11px] font-bold text-amber-700 hover:text-amber-900 underline ml-2 cursor-pointer"
            >
              Reset
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
          {/* Placement Filter */}
          <div>
            <label className="text-[10px] font-black uppercase text-amber-700 tracking-wider block mb-0.5">Placement</label>
            <select
              value={filterPlacement}
              onChange={e => setFilterPlacement(e.target.value as any)}
              className={`w-full rounded-xl px-2 py-1.5 text-xs font-semibold outline-none transition-all ${filterPlacement === 'main_only'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                  : 'bg-gray-50 border border-gray-200 focus:border-primary focus:bg-white'
                }`}
            >
              <option value="all">All Placements</option>
              <option value="main_only">Main Category Only ({mainCategoryOnlyCount})</option>
            </select>
          </div>
          {/* Category Filter */}
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Category</label>
            <select
              value={filterCategory}
              onChange={e => {
                setFilterCategory(e.target.value);
                setFilterSubCategory('all');
                setFilterNestedSubCategory('all');
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-primary focus:bg-white transition-all"
            >
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Subcategory Filter */}
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Subcategory</label>
            <select
              value={filterSubCategory}
              onChange={e => {
                setFilterSubCategory(e.target.value);
                setFilterNestedSubCategory('all');
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-primary focus:bg-white transition-all"
            >
              <option value="all">All Subcategories</option>
              {availableSubCategories.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Nested Subcategory Filter */}
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Nested Sub</label>
            <select
              value={filterNestedSubCategory}
              onChange={e => setFilterNestedSubCategory(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-primary focus:bg-white transition-all"
            >
              <option value="all">All Nested</option>
              {availableNestedSubCategories.map(n => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
          </div>

          {/* Visual Showcase Filter */}
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Visual Showcase</label>
            <select
              value={filterVisual}
              onChange={e => setFilterVisual(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-primary focus:bg-white transition-all"
            >
              <option value="all">All Showcases</option>
              {visualNestedItems.map(v => (
                <option key={v.id} value={v.id}>{v.name || v.offerText || `Showcase ${v.id.slice(-4)}`}</option>
              ))}
            </select>
          </div>

          {/* Brand Filter */}
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Brand</label>
            <select
              value={filterBrand}
              onChange={e => setFilterBrand(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-primary focus:bg-white transition-all"
            >
              <option value="all">All Brands</option>
              {uniqueBrands.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-primary focus:bg-white transition-all"
            >
              <option value="all">All Status</option>
              <option value="in_stock">In Stock (&gt; 0)</option>
              <option value="out_of_stock">Out of Stock (0)</option>
              <option value="visible">Visible</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>
        </div>
      </div>

      {/* Floating Sticky Bulk Actions Bar */}
      {selectedProductIds.length > 0 && (
        <div className="sticky top-4 z-40 bg-gray-900 text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center justify-between gap-4 border border-gray-800 animate-in fade-in slide-in-from-top duration-200">
          <div className="flex items-center gap-3">
            <span className="bg-emerald-500 text-gray-950 text-xs font-black px-2.5 py-0.5 rounded-full">
              {selectedProductIds.length}
            </span>
            <span className="text-xs font-bold text-gray-200">
              product(s) selected from inventory
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedProductIds([])}
              className="text-xs font-bold text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              Deselect All
            </button>
            <button
              onClick={() => setIsAssignmentModalOpen(true)}
              className="flex items-center gap-1.5 bg-emerald-500 text-gray-950 font-black text-xs uppercase tracking-wider px-5 py-2 rounded-xl hover:bg-emerald-400 transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              <Layers className="w-4 h-4" />
              Assign to Categories
            </button>
          </div>
        </div>
      )}

      {/* Inventory Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
              <tr>
                <th className="px-3 py-3 w-10 text-center" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={handleToggleSelectAll}
                    title={selectedProductIds.length === filteredProducts.length ? 'Deselect All' : 'Select All Filtered'}
                    className="p-1 rounded text-gray-400 hover:text-primary transition-colors cursor-pointer"
                  >
                    {filteredProducts.length > 0 && selectedProductIds.length === filteredProducts.length ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : selectedProductIds.length > 0 ? (
                      <div className="w-4 h-4 rounded border-2 border-primary bg-primary/20 flex items-center justify-center">
                        <div className="w-2 h-0.5 bg-primary rounded-full" />
                      </div>
                    ) : (
                      <Square className="w-4 h-4 text-gray-300" />
                    )}
                  </button>
                </th>
                <th className="px-2 py-3 w-8"></th>
                <th className="px-3 py-3 text-center">Product Info & Category Assignments</th>
                <th className="px-3 py-3 text-center whitespace-nowrap">Product Code</th>
                <th className="px-3 py-3 text-center whitespace-nowrap">Total Stock</th>
                <th className="px-3 py-3 text-center whitespace-nowrap">Variants</th>
                <th className="px-3 py-3 text-center whitespace-nowrap">GST Tax</th>
                <th className="px-3 py-3 text-center whitespace-nowrap">Delivery</th>
                <th className="px-3 py-3 text-center whitespace-nowrap">Status & Visibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">Loading products...</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">No products found matching your search and filter criteria.</td></tr>
              ) : filteredProducts.map(product => {
                const isExpanded = expandedProducts.includes(product.id);
                const isSelected = selectedProductIds.includes(product.id);
                const assignedCategoryNodes = getProductAssignmentNodes(product, allCategoryNodes, visualNestedItems);

                return (
                  <React.Fragment key={product.id}>
                    <tr
                      className={`hover:bg-gray-50 transition-colors cursor-pointer ${isSelected ? 'bg-primary/5 hover:bg-primary/10' : (isExpanded ? 'bg-gray-50/50' : '')
                        }`}
                      onClick={() => toggleExpand(product.id)}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-2.5 text-center" onClick={(e) => handleToggleSelectProduct(product.id, e)}>
                        <button
                          type="button"
                          className="p-1 rounded text-gray-400 hover:text-primary transition-colors cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-300" />
                          )}
                        </button>
                      </td>

                      {/* Expand Chevron */}
                      <td className="px-2 py-2.5">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </td>

                      {/* Product Info & Category Assignments: Strictly single-line horizontal with ellipsis */}
                      <td className="px-3 py-2.5 whitespace-nowrap min-w-0 max-w-sm">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={product.images[0] || 'https://via.placeholder.com/80'}
                            className="w-10 h-10 rounded-lg object-contain bg-white border border-gray-100 shrink-0"
                            alt=""
                          />
                          <div className="min-w-0 flex-1">
                            {/* Product Name: Single horizontal line with ellipsis truncation */}
                            <div className="flex items-center gap-1.5 min-w-0">
                              <p
                                className="text-xs font-bold text-gray-900 truncate max-w-[200px] sm:max-w-[280px]"
                                title={product.name}
                              >
                                {product.name}
                              </p>
                              {product.brand && (
                                <span className="text-[9px] font-bold text-gray-400 uppercase bg-gray-50 px-1 py-0.2 rounded border border-gray-100 shrink-0">
                                  {product.brand}
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-gray-500 font-mono truncate mt-0.5" title={`Product ID: ${product.id}`}>
                              <span className="font-bold text-gray-400 font-sans">ID:</span> <span className="select-all font-semibold text-gray-700">{product.id}</span> {product.sku ? <span className="font-sans text-gray-400">• SKU: {product.sku}</span> : ''}
                            </p>

                            {/* Live Category Assignment Badges: Compact horizontal single line */}
                            <div className="flex items-center gap-1 flex-nowrap overflow-hidden mt-1">
                              {assignedCategoryNodes.length === 0 ? (
                                <span className="text-[9px] text-gray-400 italic shrink-0">No categories assigned</span>
                              ) : (
                                <>
                                  {assignedCategoryNodes.slice(0, 2).map(node => {
                                    const isVisual = node.level === 'visual_nested_subcategory';
                                    const isNested = node.level === 'nested_subcategory' || node.level === 'deep_subcategory';
                                    const isSub = node.level === 'subcategory';
                                    const badgeClass = isVisual
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : isNested
                                        ? 'bg-purple-50 text-purple-800 border-purple-200'
                                        : isSub
                                          ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                          : 'bg-blue-50 text-blue-800 border-blue-200';

                                    return (
                                      <span
                                        key={node.key}
                                        title={node.breadcrumb}
                                        className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded border ${badgeClass} shrink-0 max-w-[110px] truncate`}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {isVisual && <Sparkles className="w-2 h-2 text-emerald-600 shrink-0" />}
                                        <span className="truncate">{node.name}</span>
                                        <button
                                          onClick={(e) => handleRemoveCategoryAssignment(e, product, node)}
                                          title={`Remove from ${node.breadcrumb}`}
                                          className="text-gray-400 hover:text-red-600 transition-colors ml-0.5 shrink-0"
                                        >
                                          <X className="w-2.5 h-2.5" />
                                        </button>
                                      </span>
                                    );
                                  })}
                                  {assignedCategoryNodes.length > 2 && (
                                    <span
                                      className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded shrink-0"
                                      title={assignedCategoryNodes.slice(2).map(n => n.name).join(', ')}
                                    >
                                      +{assignedCategoryNodes.length - 2} more
                                    </span>
                                  )}
                                </>
                              )}
                              <button
                                onClick={(e) => handleOpenAssignForProduct(e, product)}
                                className="inline-flex items-center gap-0.5 text-[9px] font-bold text-primary hover:underline bg-primary/5 hover:bg-primary/10 px-1.5 py-0.5 rounded transition-colors shrink-0"
                              >
                                <Plus className="w-2 h-2" /> Assign
                              </button>
                            </div>

                            {/* Internal Brand Section Indicator */}
                            <div className="flex items-center gap-1.5 mt-1">
                              {(() => {
                                const sec = brandSections.find(s => s.id === product.inventorySectionId);
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setProductsForBrandModal([product]);
                                      setIsBrandAssignmentModalOpen(true);
                                    }}
                                    title={`Internal Section: ${sec ? sec.name : 'Unassigned'} (Click to change)`}
                                    className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border transition-all cursor-pointer ${sec
                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                        : 'bg-amber-50 text-amber-800 border-amber-200/80 hover:bg-amber-100'
                                      }`}
                                  >
                                    <Tag className="w-2.5 h-2.5" />
                                    <span>{sec ? sec.name : 'Unassigned'}</span>
                                  </button>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Product Code */}
                      <td className="px-3 py-2.5 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                        {product.productCode ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="font-mono font-bold text-xs bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded-lg border border-emerald-200/80">
                              {formatProductCode(product.productCode)}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const codeStr = formatProductCode(product.productCode);
                                navigator.clipboard.writeText(codeStr);
                                toast.success(`Product Code "${codeStr}" copied!`);
                              }}
                              title="Copy Product Code"
                              className="p-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-center">
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const newCode = generateUniqueProductCode(products);
                                try {
                                  await updateDoc(doc(db, 'products', product.id), { productCode: newCode });
                                  toast.success(`Product Code "${newCode}" assigned!`);
                                } catch (err) {
                                  toast.error('Failed to assign code');
                                }
                              }}
                              className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 hover:bg-emerald-100 transition-all cursor-pointer"
                            >
                              + Generate Code
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Total Stock */}
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs font-semibold text-center">
                        <span className={product.stock <= 5 ? "text-red-500 font-bold" : "text-gray-700"}>
                          {product.stock}
                        </span>
                      </td>

                      {/* Variants Count */}
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-center">
                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold">
                          {product.variants?.length || 0}
                        </span>
                      </td>

                      {/* GST Tax */}
                      <td className="px-3 py-2.5 whitespace-nowrap text-center">
                        <div className="flex justify-center">
                          <button
                            onClick={(e) => handleToggleGst(e, product)}
                            title={`Click to ${product.enableGst !== false && (product.gst || 0) > 0 ? 'Disable' : 'Enable'} GST`}
                            className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 transition-all shadow-xs cursor-pointer ${product.enableGst !== false && (product.gst || 0) > 0
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200'
                              }`}
                          >
                            {product.enableGst !== false && (product.gst || 0) > 0 ? (
                              <><span>✅</span> GST {product.gst}%</>
                            ) : (
                              <><span>🚫</span> GST Off</>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Delivery */}
                      <td className="px-3 py-2.5 whitespace-nowrap text-center">
                        <div className="flex justify-center">
                          <button
                            onClick={(e) => handleToggleFreeDelivery(e, product)}
                            title={`Click to ${product.isFreeDelivery !== false ? 'Disable' : 'Enable'} Free Delivery`}
                            className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 transition-all shadow-xs cursor-pointer ${product.isFreeDelivery !== false
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200'
                              }`}
                          >
                            {product.isFreeDelivery !== false ? (
                              <><span>🚚</span> Free</>
                            ) : (
                              <><span>📦</span> Paid</>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Status & Visibility */}
                      <td className="px-3 py-2.5 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={(e) => handleToggleVisibility(e, product)}
                            title={product.isVisible !== false ? 'Customer Visibility: Visible (Click to Hide)' : 'Customer Visibility: Hidden (Click to Show)'}
                            className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 transition-all shadow-xs cursor-pointer ${product.isVisible !== false
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                              }`}
                          >
                            {product.isVisible !== false ? (
                              <>
                                <Eye className="w-3 h-3 shrink-0" />
                                <span>Visible</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3 h-3 shrink-0" />
                                <span>Hidden</span>
                              </>
                            )}
                          </button>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${product.stock > 0 ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                            {product.stock > 0 ? 'In Stock' : 'Out of Stock'}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProductsForBrandModal([product]);
                              setIsBrandAssignmentModalOpen(true);
                            }}
                            className="p-1 text-gray-400 hover:text-indigo-600 transition-colors cursor-pointer"
                            title="Assign to Brand Section"
                          >
                            <Tag className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleOpenAssignForProduct(e, product)}
                            className="p-1 text-gray-400 hover:text-emerald-600 transition-colors cursor-pointer"
                            title="Assign to Categories"
                          >
                            <Layers className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditProduct?.(product);
                            }}
                            className="p-1 text-gray-400 hover:text-primary transition-colors cursor-pointer"
                            title="Edit Product"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (onDeleteProduct) {
                                await onDeleteProduct(product.id, product.name);
                              }
                            }}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                            title="Delete Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-gray-50/30">
                        <td colSpan={9} className="px-8 py-6">
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
                                            <span className="text-xs font-bold text-gray-700">
                                              {variant.name || Object.values(variant.attributes || variant.attributeValues || {}).filter(Boolean).join(' / ') || [variant.color || variant.colorName, variant.size || variant.shoeSize, variant.storage, variant.ram, variant.shade, variant.volume, variant.material, variant.model].filter(Boolean).join(' / ') || `Variant ${variant.id}`}
                                            </span>
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

      {/* Category Assignment Modal */}
      <CategoryAssignmentModal
        isOpen={isAssignmentModalOpen}
        onClose={() => setIsAssignmentModalOpen(false)}
        selectedProducts={selectedProductsForModal}
        allProducts={products}
        onAssignmentSuccess={() => {
          setSelectedProductIds([]);
        }}
        onAddProductToSelection={(newProd) => {
          setSelectedProductIds(prev => Array.from(new Set([...prev, newProd.id])));
        }}
        onRemoveProductFromSelection={(pid) => {
          setSelectedProductIds(prev => prev.filter(id => id !== pid));
        }}
      />

      {/* Internal Brand Section Assignment Modal */}
      <BrandSectionAssignmentModal
        isOpen={isBrandAssignmentModalOpen}
        onClose={() => {
          setIsBrandAssignmentModalOpen(false);
          setProductsForBrandModal([]);
        }}
        selectedProducts={productsForBrandModal}
        onAssignmentSuccess={() => {
          setSelectedProductIds([]);
        }}
      />
    </motion.div>
  );
}

export default function ProductManagementView() {
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [initialSectionId, setInitialSectionId] = useState<string | null>(null);

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
    return (
      <AddEditProductForm
        product={editingProduct}
        initialInventorySectionId={initialSectionId}
        onDelete={handleDeleteProduct}
        onClose={() => {
          setShowAddProduct(false);
          setEditingProduct(null);
          setInitialSectionId(null);
        }}
      />
    );
  }

  return (
    <ProductListView
      onAddProduct={(secId?: string) => {
        setEditingProduct(null);
        setInitialSectionId(secId || null);
        setShowAddProduct(true);
      }}
      onEditProduct={(p) => {
        setEditingProduct(p);
        setInitialSectionId(null);
        setShowAddProduct(true);
      }}
      onDeleteProduct={handleDeleteProduct}
    />
  );
}
