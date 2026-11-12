import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '../../shared/types';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { logAdminAction, AdminAction } from '../../backend/services/adminLogService';
import toast from 'react-hot-toast';
import { X, TrendingUp, TrendingDown, Percent, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BulkPriceAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProducts: Product[];
  onAdjustmentSuccess?: () => void;
}

const PRESET_PERCENTAGES = [5, 10, 15, 20, 25, 50];

function calculateAdjustedAmount(
  amount: number,
  type: 'increase' | 'decrease',
  percentage: number
): number {
  if (!Number.isFinite(amount) || amount <= 0) return amount;
  const factor = type === 'increase' ? 1 + percentage / 100 : 1 - percentage / 100;
  return Math.max(1, Math.round(amount * factor));
}

function getEffectiveSellingPrice(product: Product): number {
  if (typeof product.discountPrice === 'number' && product.discountPrice > 0) {
    return product.discountPrice;
  }
  return product.price || 0;
}

export default function BulkPriceAdjustmentModal({
  isOpen,
  onClose,
  selectedProducts,
  onAdjustmentSuccess,
}: BulkPriceAdjustmentModalProps) {
  const [adjustmentType, setAdjustmentType] = useState<'increase' | 'decrease'>('increase');
  const [percentageInput, setPercentageInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAdjustmentType('increase');
      setPercentageInput('');
    }
  }, [isOpen]);

  const parsedPercentage = useMemo(() => {
    const val = parseFloat(percentageInput);
    return Number.isFinite(val) ? val : NaN;
  }, [percentageInput]);

  const validationError = useMemo(() => {
    if (percentageInput.trim() === '') return 'Enter a percentage value';
    if (!Number.isFinite(parsedPercentage) || parsedPercentage <= 0) {
      return 'Percentage must be greater than 0';
    }
    if (adjustmentType === 'decrease' && parsedPercentage >= 100) {
      return 'Decrease percentage must be less than 100%';
    }
    if (adjustmentType === 'increase' && parsedPercentage > 1000) {
      return 'Increase percentage cannot exceed 1000%';
    }
    return null;
  }, [percentageInput, parsedPercentage, adjustmentType]);

  const isValid = validationError === null && selectedProducts.length > 0;

  if (!isOpen) return null;

  const handleApply = async () => {
    if (!isValid) {
      if (validationError) toast.error(validationError);
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading(
      `Applying ${adjustmentType === 'increase' ? '+' : '-'}${parsedPercentage}% to ${selectedProducts.length} product(s)...`
    );

    try {
      const now = new Date().toISOString();
      const CHUNK_SIZE = 450;

      for (let i = 0; i < selectedProducts.length; i += CHUNK_SIZE) {
        const chunk = selectedProducts.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);

        for (const product of chunk) {
          const newPrice = calculateAdjustedAmount(product.price, adjustmentType, parsedPercentage);
          const updatePayload: Record<string, any> = {
            price: newPrice,
            updatedAt: now,
          };

          let newMrp = product.mrp;
          if (typeof product.mrp === 'number' && product.mrp > 0) {
            newMrp = calculateAdjustedAmount(product.mrp, adjustmentType, parsedPercentage);
            updatePayload.mrp = newMrp;
          }

          if (typeof product.discountPrice === 'number' && product.discountPrice > 0) {
            const newDiscountPrice = calculateAdjustedAmount(
              product.discountPrice,
              adjustmentType,
              parsedPercentage
            );
            updatePayload.discountPrice = newDiscountPrice;

            const effectiveMrp = newMrp && newMrp > 0 ? newMrp : newPrice;
            if (effectiveMrp > newDiscountPrice) {
              updatePayload.discountPercentage = Math.round(
                ((effectiveMrp - newDiscountPrice) / effectiveMrp) * 100
              );
            } else {
              updatePayload.discountPercentage = 0;
            }
          }

          if (Array.isArray(product.variants) && product.variants.length > 0) {
            updatePayload.variants = product.variants.map((variant) => {
              const updatedVariant = { ...variant };
              if (typeof variant.price === 'number' && variant.price > 0) {
                updatedVariant.price = calculateAdjustedAmount(
                  variant.price,
                  adjustmentType,
                  parsedPercentage
                );
              }
              if (typeof variant.discountPrice === 'number' && variant.discountPrice > 0) {
                updatedVariant.discountPrice = calculateAdjustedAmount(
                  variant.discountPrice,
                  adjustmentType,
                  parsedPercentage
                );
              }
              if (typeof variant.mrp === 'number' && variant.mrp > 0) {
                updatedVariant.mrp = calculateAdjustedAmount(
                  variant.mrp,
                  adjustmentType,
                  parsedPercentage
                );
              }
              if (
                typeof updatedVariant.mrp === 'number' &&
                updatedVariant.mrp > 0 &&
                typeof updatedVariant.price === 'number' &&
                updatedVariant.price > 0
              ) {
                updatedVariant.discountPercentage =
                  updatedVariant.mrp > updatedVariant.price
                    ? Math.round(
                        ((updatedVariant.mrp - updatedVariant.price) / updatedVariant.mrp) * 100
                      )
                    : 0;
              }
              return updatedVariant;
            });
          }

          batch.update(doc(db, 'products', product.id), updatePayload);
        }

        await batch.commit();
      }

      await logAdminAction(
        AdminAction.PRODUCT_UPDATE,
        `Bulk ${adjustmentType === 'increase' ? 'increased' : 'decreased'} prices by ${parsedPercentage}% for ${selectedProducts.length} selected product(s)`,
        selectedProducts.map((p) => p.id).slice(0, 5).join(','),
        'products'
      );

      toast.success(
        `Prices ${adjustmentType === 'increase' ? 'increased' : 'decreased'} by ${parsedPercentage}% for ${selectedProducts.length} product(s)!`,
        { id: toastId }
      );
      onAdjustmentSuccess?.();
      onClose();
    } catch (error) {
      console.error('Bulk price adjustment failed:', error);
      toast.error('Failed to update product prices. Please try again.', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Percent className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">
                  Bulk Price Adjustment
                </h3>
                <p className="text-xs text-gray-500 font-medium">
                  Adjusting prices for{' '}
                  <span className="font-bold text-gray-800">{selectedProducts.length}</span>{' '}
                  selected product(s) only
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5 overflow-y-auto">
            {/* Direction Toggle */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-2">
                Adjustment Direction
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAdjustmentType('increase')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    adjustmentType === 'increase'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-xs'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  Increase (+%)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentType('decrease')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    adjustmentType === 'decrease'
                      ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-xs'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <TrendingDown className="w-4 h-4" />
                  Decrease (-%)
                </button>
              </div>
            </div>

            {/* Percentage Input */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-2">
                Percentage (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0.01"
                  max={adjustmentType === 'decrease' ? '99.99' : '1000'}
                  step="any"
                  value={percentageInput}
                  onChange={(e) => setPercentageInput(e.target.value)}
                  placeholder="Enter percentage (e.g. 10)"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-4 pr-10 py-2.5 text-sm font-bold text-gray-900 outline-none focus:border-primary focus:bg-white transition-all"
                  autoFocus
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-black text-sm">
                  %
                </span>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                {PRESET_PERCENTAGES.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setPercentageInput(String(pct))}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      parsedPercentage === pct
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {adjustmentType === 'increase' ? '+' : '-'}
                    {pct}%
                  </button>
                ))}
              </div>

              {percentageInput.trim() !== '' && validationError && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {validationError}
                </p>
              )}
            </div>

            {/* Live Preview */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-black uppercase tracking-wider text-gray-500">
                  Price Preview ({selectedProducts.length} selected)
                </label>
                <span className="text-[10px] font-semibold text-gray-400">
                  Includes variants &amp; MRP if set
                </span>
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto divide-y divide-gray-100 bg-gray-50/40">
                {selectedProducts.map((product) => {
                  const currentSelling = getEffectiveSellingPrice(product);
                  const newSelling = isValid
                    ? calculateAdjustedAmount(currentSelling, adjustmentType, parsedPercentage)
                    : currentSelling;

                  return (
                    <div
                      key={product.id}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-3 bg-white text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-800 truncate">{product.name}</p>
                        {product.variants && product.variants.length > 0 && (
                          <p className="text-[10px] text-gray-400 font-medium">
                            {product.variants.length} variant(s) will also be updated
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 font-mono">
                        <span className="text-gray-500 font-semibold">
                          ₹{currentSelling.toLocaleString('en-IN')}
                        </span>
                        <span className="text-gray-300">→</span>
                        <span
                          className={`font-black ${
                            !isValid
                              ? 'text-gray-400'
                              : adjustmentType === 'increase'
                              ? 'text-emerald-600'
                              : 'text-rose-600'
                          }`}
                        >
                          ₹{newSelling.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/70 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-200/70 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!isValid || isSaving}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-600 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-600/20 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              {isSaving ? 'Updating...' : 'Apply Price Adjustment'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

