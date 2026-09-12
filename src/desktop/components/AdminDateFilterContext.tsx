import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import {
  DateRangePreset,
  DateRange,
  calculateDateRangeBounds,
  isDateInRange,
  filterItemsByDateRange,
  parseDateValue
} from '../../shared/utilities/adminDateFilter';

interface AdminDateFilterContextType {
  selectedPreset: DateRangePreset;
  dateRange: DateRange;
  customStartDate: string;
  customEndDate: string;
  setPreset: (preset: DateRangePreset, customStart?: string | Date | null, customEnd?: string | Date | null) => void;
  resetFilter: () => void;
  isDateInRange: (dateVal: any) => boolean;
  filterList: <T>(items: T[], getDateField: (item: T) => any) => T[];
}

const AdminDateFilterContext = createContext<AdminDateFilterContextType | undefined>(undefined);

export const DEFAULT_ADMIN_DATE_PRESET: DateRangePreset = 'last-30-days';

export const AdminDateFilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedPreset, setSelectedPreset] = useState<DateRangePreset>(DEFAULT_ADMIN_DATE_PRESET);
  
  // Stored as ISO YYYY-MM-DD for convenient input[type="date"] binding
  const todayIso = new Date().toISOString().split('T')[0];
  const thirtyDaysAgoIso = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const [customStartDate, setCustomStartDate] = useState<string>(thirtyDaysAgoIso);
  const [customEndDate, setCustomEndDate] = useState<string>(todayIso);

  const dateRange = useMemo<DateRange>(() => {
    return calculateDateRangeBounds(
      selectedPreset,
      selectedPreset === 'custom' ? customStartDate : null,
      selectedPreset === 'custom' ? customEndDate : null
    );
  }, [selectedPreset, customStartDate, customEndDate]);

  const setPreset = useCallback((preset: DateRangePreset, customStart?: string | Date | null, customEnd?: string | Date | null) => {
    if (preset === 'custom') {
      if (customStart) {
        const startStr = typeof customStart === 'string' ? customStart : customStart.toISOString().split('T')[0];
        setCustomStartDate(startStr);
      }
      if (customEnd) {
        const endStr = typeof customEnd === 'string' ? customEnd : customEnd.toISOString().split('T')[0];
        setCustomEndDate(endStr);
      }
    }
    setSelectedPreset(preset);
  }, []);

  const resetFilter = useCallback(() => {
    setSelectedPreset('all');
  }, []);

  const checkIsDateInRange = useCallback((dateVal: any): boolean => {
    return isDateInRange(dateVal, dateRange);
  }, [dateRange]);

  const filterList = useCallback(<T,>(items: T[], getDateField: (item: T) => any): T[] => {
    return filterItemsByDateRange(items, getDateField, dateRange);
  }, [dateRange]);

  const value = useMemo(() => ({
    selectedPreset,
    dateRange,
    customStartDate,
    customEndDate,
    setPreset,
    resetFilter,
    isDateInRange: checkIsDateInRange,
    filterList
  }), [selectedPreset, dateRange, customStartDate, customEndDate, setPreset, resetFilter, checkIsDateInRange, filterList]);

  return (
    <AdminDateFilterContext.Provider value={value}>
      {children}
    </AdminDateFilterContext.Provider>
  );
};

export function useAdminDateFilter(): AdminDateFilterContextType {
  const context = useContext(AdminDateFilterContext);
  if (!context) {
    // Return a safe fallback if accessed outside provider
    const bounds = calculateDateRangeBounds('all');
    return {
      selectedPreset: 'all',
      dateRange: bounds,
      customStartDate: '',
      customEndDate: '',
      setPreset: () => {},
      resetFilter: () => {},
      isDateInRange: () => true,
      filterList: <T,>(items: T[]) => items,
    };
  }
  return context;
}
