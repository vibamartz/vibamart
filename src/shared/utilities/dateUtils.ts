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

export function getDynamicExpectedDeliveryDate(baseDate: Date = new Date()): { deliveryRange: string; expectedBy: string; fullFormattedText: string } {
  const targetDate = new Date(baseDate);
  targetDate.setDate(targetDate.getDate() + 7);

  const weekday = targetDate.toLocaleDateString('en-US', { weekday: 'long' });
  const month = targetDate.toLocaleDateString('en-US', { month: 'long' });
  const day = targetDate.getDate();

  const expectedBy = `Expected by ${weekday}, ${month} ${day}`;
  const deliveryRange = `Delivery in 4–7 days`;
  
  return {
    deliveryRange,
    expectedBy,
    fullFormattedText: `${deliveryRange} • ${expectedBy}`
  };
}

export function getFormattedDeliveryDate(product?: any): string {
  const { deliveryRange, expectedBy } = getDynamicExpectedDeliveryDate();
  return `${deliveryRange} | ${expectedBy}`;
}

