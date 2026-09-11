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
