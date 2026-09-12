import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar as CalendarIcon,
  ChevronDown,
  Check,
  RotateCcw,
  X,
  Clock,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useAdminDateFilter } from './AdminDateFilterContext';
import { DATE_RANGE_PRESETS, DateRangePreset } from '../../shared/utilities/adminDateFilter';

interface AdminDateRangeFilterProps {
  className?: string;
  compact?: boolean;
}

export default function AdminDateRangeFilter({ className = '', compact = false }: AdminDateRangeFilterProps) {
  const {
    selectedPreset,
    dateRange,
    customStartDate,
    customEndDate,
    setPreset,
    resetFilter
  } = useAdminDateFilter();

  const [isOpen, setIsOpen] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);

  // Local state for custom modal inputs
  const [modalStart, setModalStart] = useState(customStartDate);
  const [modalEnd, setModalEnd] = useState(customEndDate);
  const [dateError, setDateError] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Sync modal inputs when customStartDate/customEndDate changes
  useEffect(() => {
    if (customStartDate) setModalStart(customStartDate);
    if (customEndDate) setModalEnd(customEndDate);
  }, [customStartDate, customEndDate]);

  const handleSelectPreset = (presetId: DateRangePreset) => {
    if (presetId === 'custom') {
      setIsOpen(false);
      setModalStart(customStartDate || new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0]);
      setModalEnd(customEndDate || new Date().toISOString().split('T')[0]);
      setDateError(null);
      setShowCustomModal(true);
    } else {
      setPreset(presetId);
      setIsOpen(false);
    }
  };

  const handleApplyCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!modalStart || !modalEnd) {
      setDateError('Please select both start and end dates.');
      return;
    }
    const dStart = new Date(modalStart);
    const dEnd = new Date(modalEnd);
    if (dStart > dEnd) {
      setDateError('Start date cannot be after end date.');
      return;
    }
    setDateError(null);
    setPreset('custom', modalStart, modalEnd);
    setShowCustomModal(false);
  };

  const isFiltered = selectedPreset !== 'all';

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          className={`group flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border text-xs font-bold transition-all duration-200 outline-none ${
            isFiltered
              ? 'bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary shadow-sm ring-1 ring-primary/10'
              : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700 shadow-sm'
          }`}
          title="Filter Admin Dashboard by Date Range"
        >
          <div className={`p-1 rounded-lg ${isFiltered ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 group-hover:text-gray-700'}`}>
            <CalendarIcon className="w-3.5 h-3.5" />
          </div>

          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-[11px] sm:text-xs tracking-tight">
                {dateRange.label}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            {!compact && (
              <span className="text-[10px] text-gray-500 font-medium hidden sm:inline-block leading-tight">
                {dateRange.formattedRange}
              </span>
            )}
          </div>
        </button>

        {/* Quick Reset Button if a filter is active */}
        {isFiltered && (
          <button
            type="button"
            onClick={resetFilter}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Reset Date Filter (Show All Time)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-72 sm:w-80 bg-white rounded-2xl border border-gray-100 shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-xs font-black text-gray-800 uppercase tracking-wider">Date Range Filter</span>
              </div>
              {selectedPreset !== 'all' && (
                <button
                  onClick={() => {
                    resetFilter();
                    setIsOpen(false);
                  }}
                  className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              )}
            </div>

            {/* Presets List */}
            <div className="p-2 space-y-1 max-h-80 overflow-y-auto">
              {DATE_RANGE_PRESETS.map((preset) => {
                const isSelected = selectedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all ${
                      isSelected
                        ? 'bg-primary text-white font-bold shadow-md shadow-primary/20'
                        : 'hover:bg-gray-50 text-gray-700 font-medium'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className={`text-xs ${isSelected ? 'font-black text-white' : 'font-bold text-gray-900'}`}>
                        {preset.label}
                      </span>
                      <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                        {preset.description}
                      </span>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-white shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}

              {/* All Time option */}
              <div className="pt-1 mt-1 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    resetFilter();
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all ${
                    selectedPreset === 'all'
                      ? 'bg-primary text-white font-bold shadow-md shadow-primary/20'
                      : 'hover:bg-gray-50 text-gray-600 font-medium'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className={`text-xs ${selectedPreset === 'all' ? 'font-black text-white' : 'font-bold text-gray-800'}`}>
                      All Time
                    </span>
                    <span className={`text-[10px] ${selectedPreset === 'all' ? 'text-white/80' : 'text-gray-400'}`}>
                      Show all historical data without filtering
                    </span>
                  </div>
                  {selectedPreset === 'all' && (
                    <Check className="w-4 h-4 text-white shrink-0 ml-2" />
                  )}
                </button>
              </div>
            </div>

            {/* Footer Summary */}
            <div className="px-4 py-2.5 bg-gray-50/80 border-t border-gray-100 text-center">
              <span className="text-[10px] font-bold text-gray-500 flex items-center justify-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                Active: <strong className="text-gray-900">{dateRange.formattedRange}</strong>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Date Range Modal */}
      <AnimatePresence>
        {showCustomModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCustomModal(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative bg-white rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl border border-gray-100 z-10"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 text-primary rounded-2xl">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900 tracking-tight">Select Custom Date Range</h3>
                    <p className="text-xs text-gray-500 font-medium">Specify custom start and end dates</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleApplyCustom} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Start Date */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-wider text-gray-500">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={modalStart}
                      onChange={(e) => {
                        setModalStart(e.target.value);
                        setDateError(null);
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-800 outline-none focus:border-primary focus:bg-white transition-all"
                      required
                    />
                  </div>

                  {/* End Date */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-wider text-gray-500">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={modalEnd}
                      onChange={(e) => {
                        setModalEnd(e.target.value);
                        setDateError(null);
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-800 outline-none focus:border-primary focus:bg-white transition-all"
                      required
                    />
                  </div>
                </div>

                {/* Error Banner */}
                {dateError && (
                  <p className="text-xs font-bold text-rose-500 bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                    {dateError}
                  </p>
                )}

                {/* Quick Selection Shortcuts */}
                <div className="pt-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-2">
                    Quick Shortcuts
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: 'Past 7 Days', days: 7 },
                      { label: 'Past 14 Days', days: 14 },
                      { label: 'Past 30 Days', days: 30 },
                      { label: 'Past 90 Days', days: 90 },
                    ].map((shortcut) => (
                      <button
                        key={shortcut.days}
                        type="button"
                        onClick={() => {
                          const today = new Date();
                          const past = new Date(today.getTime() - (shortcut.days - 1) * 86400000);
                          setModalStart(past.toISOString().split('T')[0]);
                          setModalEnd(today.toISOString().split('T')[0]);
                          setDateError(null);
                        }}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-gray-100 hover:bg-primary/10 hover:text-primary text-gray-600 transition-colors"
                      >
                        {shortcut.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowCustomModal(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-1.5"
                  >
                    Apply Filter
                    <ArrowRight className="w-3.5 h-3.5" />
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
