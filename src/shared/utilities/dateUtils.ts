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

export function getFormattedDeliveryDate(product?: any): string {
  let deliveryDate = new Date();
  if (product?.expectedDelivery || product?.estimatedDelivery) {
    const d = new Date(product.expectedDelivery || product.estimatedDelivery);
    if (!isNaN(d.getTime())) {
      deliveryDate = d;
    } else {
      deliveryDate.setDate(deliveryDate.getDate() + 3);
    }
  } else if (product?.deliveryDays && typeof product.deliveryDays === 'number') {
    deliveryDate.setDate(deliveryDate.getDate() + product.deliveryDays);
  } else {
    deliveryDate.setDate(deliveryDate.getDate() + 3);
  }

  const dayName = deliveryDate.toLocaleDateString('en-IN', { weekday: 'short' });
  const dayNum = deliveryDate.getDate();
  const monthName = deliveryDate.toLocaleDateString('en-IN', { month: 'short' });

  return `Delivery by ${dayName}, ${dayNum} ${monthName}`;
}

