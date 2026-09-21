import admin from "firebase-admin";
import { setCorsHeaders, initializeFirebaseAdmin } from "../_utils";

initializeFirebaseAdmin();

export default async function handler(req: any, res: any) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = admin.firestore();
    const usersSnap = await db.collection('users').get();
    const ordersSnap = await db.collection('orders').get();

    const users = usersSnap.docs.map((d: any) => ({ uid: d.id, ...d.data() }));
    const orders = ordersSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

    const now = Date.now();

    // Segment calculators
    const frequentBuyers = users.filter((u: any) => {
      const uOrders = orders.filter((o: any) => o.customerId === u.uid || o.contactEmail === u.email);
      return uOrders.length >= 3;
    });

    const highValueCustomers = users.filter((u: any) => {
      const uOrders = orders.filter((o: any) => o.customerId === u.uid || o.contactEmail === u.email);
      const spend = uOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
      return spend >= 5000;
    });

    const cartAbandoners = users.filter((u: any) => Array.isArray(u.cart) && u.cart.length > 0);
    const wishlistUsers = users.filter((u: any) => Array.isArray(u.wishlist) && u.wishlist.length > 0);

    const churnRiskHigh = users.filter((u: any) => {
      const uOrders = orders.filter((o: any) => o.customerId === u.uid || o.contactEmail === u.email);
      if (uOrders.length === 0) return false;
      const latestOrderTime = Math.max(...uOrders.map((o: any) => new Date(o.createdAt).getTime() || 0));
      const daysSince = (now - latestOrderTime) / (1000 * 60 * 60 * 24);
      return daysSince > 60;
    });

    const segments = [
      {
        id: 'all',
        name: 'All Registered Customers',
        description: 'Target all registered ViBa Mart users.',
        type: 'system',
        estimatedCustomerCount: users.length,
      },
      {
        id: 'cart_abandoners',
        name: 'Cart Abandoners',
        description: 'Customers with items currently saved in their cart.',
        type: 'rule_based',
        estimatedCustomerCount: cartAbandoners.length,
        userUids: cartAbandoners.map((u: any) => u.uid),
      },
      {
        id: 'wishlist_users',
        name: 'Wishlist Users',
        description: 'Customers who have saved products to their wishlist.',
        type: 'rule_based',
        estimatedCustomerCount: wishlistUsers.length,
        userUids: wishlistUsers.map((u: any) => u.uid),
      },
      {
        id: 'frequent_buyers',
        name: 'Frequent Buyers (3+ Orders)',
        description: 'Loyal repeat shoppers with 3 or more completed purchases.',
        type: 'rule_based',
        estimatedCustomerCount: frequentBuyers.length,
        userUids: frequentBuyers.map((u: any) => u.uid),
      },
      {
        id: 'high_value_customers',
        name: 'High-Value VIPs (₹5,000+ Spend)',
        description: 'High lifetime value customers with total spend exceeding ₹5,000.',
        type: 'rule_based',
        estimatedCustomerCount: highValueCustomers.length,
        userUids: highValueCustomers.map((u: any) => u.uid),
      },
      {
        id: 'churn_risk_high',
        name: 'High Churn Risk (Inactive >60d)',
        description: 'ML-identified customers who have not placed an order in over 60 days.',
        type: 'ml_driven',
        estimatedCustomerCount: churnRiskHigh.length,
        userUids: churnRiskHigh.map((u: any) => u.uid),
      },
    ];

    return res.status(200).json({ success: true, segments });
  } catch (error: any) {
    console.error('Segments API error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Server error' });
  }
}
