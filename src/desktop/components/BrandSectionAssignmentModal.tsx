import React, { useState, useEffect } from 'react';
import { InventoryBrandSection, Product } from '../../shared/types';
import { useInventoryBrandSectionStore } from '../../backend/store';
import toast from 'react-hot-toast';
import { Tag, X, Check, FolderTree } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BrandSectionAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProducts: Product[];
  onAssignmentSuccess?: () => void;
}

export default function BrandSectionAssignmentModal({
  isOpen,
  onClose,
  selectedProducts,
  onAssignmentSuccess
}: BrandSectionAssignmentModalProps) {
  const { sections, bulkAssignProducts } = useInventoryBrandSectionStore();
  const [targetSectionId, setTargetSectionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize target section when modal opens
  useEffect(() => {
    if (isOpen && selectedProducts.length > 0) {
      if (selectedProducts.length === 1) {
        setTargetSectionId(selectedProducts[0].inventorySectionId || null);
      } else {
        // If all selected products have the same section, pre-select it
        const firstSec = selectedProducts[0].inventorySectionId || null;
        const allSame = selectedProducts.every(p => (p.inventorySectionId || null) === firstSec);
        setTargetSectionId(allSame ? firstSec : null);
      }
    }
  }, [isOpen, selectedProducts]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (selectedProducts.length === 0) return;
    setIsSaving(true);
    const toastId = toast.loading('Updating brand section assignment...');
    try {
      const pids = selectedProducts.map(p => p.id);
      await bulkAssignProducts(pids, targetSectionId);

      const targetName = targetSectionId
        ? sections.find(s => s.id === targetSectionId)?.name || 'Brand Section'
        : 'Unassigned';

      toast.success(
        `Updated assignment for ${pids.length} product(s) → ${targetName}`,
        { id: toastId }
      );
      onAssignmentSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update brand section assignment', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-gray-100 space-y-4"
      >
        {/* Header */}
        <div className="flex justify-between items-center pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-indigo-50 text-indigo-600">
              <Tag className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-base font-bold text-gray-900">Assign to Brand Section</h3>
              <p className="text-[11px] text-gray-500">
                {selectedProducts.length === 1
                  ? selectedProducts[0].name
                  : `${selectedProducts.length} products selected`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Radio List of Sections */}
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {/* Option: Unassigned / None */}
          <label
            onClick={() => setTargetSectionId(null)}
            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
              targetSectionId === null
                ? 'bg-amber-50/70 border-amber-300 text-amber-950 font-bold'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FolderTree className="w-4 h-4 text-amber-600" />
              <div className="text-xs">
                <span className="font-bold">None (Unassigned)</span>
                <p className="text-[10px] text-gray-400">Remove from internal brand sections</p>
              </div>
            </div>
            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
              targetSectionId === null ? 'border-amber-600 bg-amber-600 text-white' : 'border-gray-300'
            }`}>
              {targetSectionId === null && <Check className="w-2.5 h-2.5" />}
            </div>
          </label>

          {/* List of Sections */}
          {sections.map(section => {
            const isSelected = targetSectionId === section.id;
            return (
              <label
                key={section.id}
                onClick={() => setTargetSectionId(section.id)}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-indigo-50/80 border-indigo-400 text-indigo-950 font-bold'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Tag className="w-4 h-4 text-indigo-600" />
                  <div className="text-xs">
                    <span className="font-bold">{section.name}</span>
                    <span className="text-[10px] text-gray-400 block font-mono">ID: {section.id}</span>
                  </div>
                </div>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300'
                }`}>
                  {isSelected && <Check className="w-2.5 h-2.5" />}
                </div>
              </label>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-600/20"
          >
            {isSaving ? 'Saving...' : 'Save Assignment'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
