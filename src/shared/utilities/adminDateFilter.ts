export type DateRangePreset =
  | 'today'
  | 'last-7-days'
  | 'last-30-days'
  | 'last-6-months'
  | 'this-year'
  | 'custom'
  | 'all';

export interface DateRange {
  preset: DateRangePreset;
  startDate: Date;
  endDate: Date;
  label: string;
  formattedRange: string;
}

export interface PresetOption {
  id: DateRangePreset;
  label: string;
  shortLabel: string;
  description: string;
}

export const DATE_RANGE_PRESETS: PresetOption[] = [
  { id: 'today', label: 'Today', shortLabel: 'Today', description: 'Current calendar day' },
  { id: 'last-7-days', label: 'Last 7 Days', shortLabel: '7D', description: 'Past 7 days including today' },
  { id: 'last-30-days', label: 'Last 30 Days', shortLabel: '30D', description: 'Past 30 days including today' },
  { id: 'last-6-months', label: 'Last 6 Months', shortLabel: '6M', description: 'Past 6 calendar months' },
  { id: 'this-year', label: 'This Year', shortLabel: 'YTD', description: 'From Jan 1 through today' },
  { id: 'custom', label: 'Custom Date Range', shortLabel: 'Custom', description: 'Choose specific start & end dates' },
];

/**
 * Parses any incoming timestamp (Firestore Timestamp, ISO string, epoch number, Date) safely
 */
export function parseDateValue(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  if (typeof val.toDate === 'function') {
    try {
      const d = val.toDate();
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }
  if (typeof val === 'object' && typeof val.seconds === 'number') {
    const d = new Date(val.seconds * 1000 + (val.nanoseconds ? Math.floor(val.nanoseconds / 1000000) : 0));
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'number') {
    // If it looks like epoch seconds (e.g. 10 digits), convert to ms
    const ms = val < 10000000000 ? val * 1000 : val;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    if (!isNaN(parsed)) {
      return new Date(parsed);
    }
  }
  return null;
}

/**
 * Formats a date nicely: e.g. "12 Sep 2026"
 */
export function formatSingleDate(d: Date, includeYear = true): string {
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    ...(includeYear ? { year: 'numeric' } : {})
  });
}

/**
 * Returns a human-friendly range string e.g. "06 Sep 2026 - 12 Sep 2026" or "12 Sep 2026"
 */
export function formatDisplayRange(start: Date, end: Date, preset?: DateRangePreset): string {
  if (preset === 'all') {
    return 'All Time';
  }
  const isSameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  if (isSameDay) {
    return formatSingleDate(start, true);
  }

  const isSameYear = start.getFullYear() === end.getFullYear();
  if (isSameYear) {
    return `${formatSingleDate(start, false)} – ${formatSingleDate(end, true)}`;
  }
  return `${formatSingleDate(start, true)} – ${formatSingleDate(end, true)}`;
}

/**
 * Calculates start and end bounds based on preset options
 */
export function calculateDateRangeBounds(
  preset: DateRangePreset,
  customStart?: Date | string | null,
  customEnd?: Date | string | null,
  referenceDate: Date = new Date()
): DateRange {
  const now = new Date(referenceDate);

  // Start of today: 00:00:00.000
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  // End of today: 23:59:59.999
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  let startDate: Date;
  let endDate: Date;
  let label = 'Last 30 Days';

  switch (preset) {
    case 'today': {
      startDate = new Date(startOfToday);
      endDate = new Date(endOfToday);
      label = 'Today';
      break;
    }

    case 'last-7-days': {
      // Current day + previous 6 days = 7 days total
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      endDate = new Date(endOfToday);
      label = 'Last 7 Days';
      break;
    }

    case 'last-30-days': {
      // Current day + previous 29 days = 30 days total
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
      endDate = new Date(endOfToday);
      label = 'Last 30 Days';
      break;
    }

    case 'last-6-months': {
      // Previous 6 calendar months through today
      startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate(), 0, 0, 0, 0);
      endDate = new Date(endOfToday);
      label = 'Last 6 Months';
      break;
    }

    case 'this-year': {
      // January 1 of the current year through today
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      endDate = new Date(endOfToday);
      label = 'This Year';
      break;
    }

    case 'custom': {
      const parsedStart = customStart ? parseDateValue(customStart) : null;
      const parsedEnd = customEnd ? parseDateValue(customEnd) : null;

      if (parsedStart) {
        startDate = new Date(parsedStart.getFullYear(), parsedStart.getMonth(), parsedStart.getDate(), 0, 0, 0, 0);
      } else {
        startDate = new Date(startOfToday);
      }

      if (parsedEnd) {
        endDate = new Date(parsedEnd.getFullYear(), parsedEnd.getMonth(), parsedEnd.getDate(), 23, 59, 59, 999);
      } else {
        endDate = new Date(endOfToday);
      }

      // If user selected start > end, swap them
      if (startDate.getTime() > endDate.getTime()) {
        const temp = startDate;
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 0, 0, 0, 0);
        endDate = new Date(temp.getFullYear(), temp.getMonth(), temp.getDate(), 23, 59, 59, 999);
      }

      label = 'Custom Range';
      break;
    }

    case 'all':
    default: {
      startDate = new Date(2000, 0, 1, 0, 0, 0, 0);
      endDate = new Date(2099, 11, 31, 23, 59, 59, 999);
      label = 'All Time';
      break;
    }
  }

  const formattedRange = formatDisplayRange(startDate, endDate, preset);

  return {
    preset,
    startDate,
    endDate,
    label,
    formattedRange
  };
}

/**
 * Checks whether a given timestamp falls within the date range
 */
export function isDateInRange(
  dateVal: any,
  range: { startDate: Date; endDate: Date } | null | undefined
): boolean {
  if (!range) return true;
  const date = parseDateValue(dateVal);
  if (!date) return false;
  const time = date.getTime();
  return time >= range.startDate.getTime() && time <= range.endDate.getTime();
}

/**
 * Helper to filter an array of items by checking a date field on each item
 */
export function filterItemsByDateRange<T>(
  items: T[],
  getDateField: (item: T) => any,
  range: { startDate: Date; endDate: Date } | null | undefined
): T[] {
  if (!range) return items;
  return items.filter(item => {
    const val = getDateField(item);
    return isDateInRange(val, range);
  });
}
