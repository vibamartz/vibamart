import { Order } from '../types';

export function formatDeliveredDate(order: Order): string {
  if (order.status !== 'delivered') {
    return order.status;
  }

  let dateStr = order.deliveryDate;
  if (!dateStr && order.statusHistory && Array.isArray(order.statusHistory)) {
    const deliveredHistory = order.statusHistory.find(s => s.status === 'delivered');
    if (deliveredHistory?.timestamp) {
      dateStr = deliveredHistory.timestamp;
    }
  }
  if (!dateStr) {
    dateStr = order.createdAt;
  }

  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) {
    return 'Delivered';
  }

  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `Delivered · ${mm}/${dd}`;
}

export function getShortDeliveryText(baseDate: Date = new Date()): string {
  const targetDate = new Date(baseDate);
  targetDate.setDate(targetDate.getDate() + 7);

  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const weekday = WEEKDAYS[targetDate.getDay()];
  const day = targetDate.getDate();
  const month = MONTHS[targetDate.getMonth()];

  return `Delivery by ${weekday}, ${day} ${month}`;
}

export function getDynamicExpectedDeliveryDate(baseDate: Date = new Date()): { deliveryRange: string; expectedBy: string; fullFormattedText: string; shortText: string } {
  const targetDate = new Date(baseDate);
  targetDate.setDate(targetDate.getDate() + 7);

  const weekday = targetDate.toLocaleDateString('en-US', { weekday: 'long' });
  const month = targetDate.toLocaleDateString('en-US', { month: 'long' });
  const day = targetDate.getDate();

  const expectedBy = `Expected by ${weekday}, ${month} ${day}`;
  const deliveryRange = `Delivery in 4–7 days`;
  const shortText = getShortDeliveryText(baseDate);
  
  return {
    deliveryRange,
    expectedBy,
    fullFormattedText: `${deliveryRange} • ${expectedBy}`,
    shortText
  };
}

export function getFormattedDeliveryDate(product?: any): string {
  return getShortDeliveryText();
}


