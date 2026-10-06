import { create } from "zustand";
import { CashbackConfig, CashbackRecord, CustomerPayoutInfo, Order, UserProfile } from "../../shared/types";
import { DEFAULT_CASHBACK_CONFIG } from "../../shared/constants";
import { db, handleFirestoreError, OperationType } from "../firebase/firebase";
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, updateDoc, deleteDoc } from "firebase/firestore";
import { useAuthStore } from "../store";

interface CashbackState {
  config: CashbackConfig;
  records: CashbackRecord[];
  payoutInfo: CustomerPayoutInfo | null;
  loading: boolean;
  initCashback: (userId?: string, role?: string) => () => void;
  updateCashbackConfig: (updates: Partial<CashbackConfig>) => Promise<void>;
  savePayoutInfo: (userId: string, info: CustomerPayoutInfo) => Promise<{ success: boolean; message: string }>;
  syncCustomerOrdersWithCashback: (userId: string, orders: Order[], userProfile?: UserProfile | null) => Promise<void>;
  processPayout: (recordId: string, reference: string) => Promise<{ success: boolean; message: string }>;
  markRecordEligible: (recordId: string) => Promise<{ success: boolean; message: string }>;
  markRecordFailed: (recordId: string, reason: string) => Promise<{ success: boolean; message: string }>;
}

export function getMonthKey(dateStr?: string | Date): { key: string; name: string } {
  const d = dateStr ? new Date(dateStr) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const monthName = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  return {
    key: `${year}-${month}`,
    name: monthName,
  };
}

export const useCashbackStore = create<CashbackState>((set, get) => ({
  config: DEFAULT_CASHBACK_CONFIG,
  records: [],
  payoutInfo: null,
  loading: true,

  initCashback: (userId?: string, role?: string) => {
    // 1. Subscribe to Global Cashback Config (settings/cashbackConfig)
    const configRef = doc(db, 'settings', 'cashbackConfig');
    const unsubConfig = onSnapshot(configRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as CashbackConfig;
        set({ config: { ...DEFAULT_CASHBACK_CONFIG, ...data } });
      } else {
        const currentUser = useAuthStore.getState().user;
        if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin')) {
          try {
            await setDoc(configRef, DEFAULT_CASHBACK_CONFIG);
          } catch (e) {
            console.error("Failed to seed default cashback config:", e);
          }
        }
        set({ config: DEFAULT_CASHBACK_CONFIG });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/cashbackConfig', false);
    });

    // 2. Subscribe to Cashback Records Collection (cashback_records)
    const isAdmin = role === 'admin' || role === 'super_admin';
    const recordsColRef = collection(db, 'cashback_records');
    const recordsQuery = (!isAdmin && userId)
      ? query(recordsColRef, where('userId', '==', userId))
      : recordsColRef;

    const unsubRecords = onSnapshot(recordsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const fetchedRecords = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        } as CashbackRecord));

        // Sort chronologically descending (newest first)
        fetchedRecords.sort((a, b) => new Date(b.orderDate || b.createdAt).getTime() - new Date(a.orderDate || a.createdAt).getTime());
        set({ records: fetchedRecords, loading: false });
      } else {
        set({ records: [], loading: false });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cashback_records', false);
      set({ loading: false });
    });

    // 3. Subscribe to User Payout Info if user logged in
    let unsubPayout: (() => void) | null = null;
    if (userId) {
      const payoutDocRef = doc(db, 'customer_payouts', userId);
      unsubPayout = onSnapshot(payoutDocRef, (docSnap) => {
        if (docSnap.exists()) {
          set({ payoutInfo: docSnap.data() as CustomerPayoutInfo });
        } else {
          set({ payoutInfo: null });
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `customer_payouts/${userId}`, false);
      });
    } else {
      set({ payoutInfo: null });
    }

    return () => {
      unsubConfig();
      unsubRecords();
      if (unsubPayout) unsubPayout();
    };
  },

  updateCashbackConfig: async (updates: Partial<CashbackConfig>) => {
    try {
      // Validate amounts between 30 and 100
      const validatedUpdates = { ...updates };
      if (validatedUpdates.firstOrderAmount !== undefined) {
        validatedUpdates.firstOrderAmount = Math.max(30, Math.min(100, Number(validatedUpdates.firstOrderAmount) || 50));
      }
      if (validatedUpdates.secondOrderAmount !== undefined) {
        validatedUpdates.secondOrderAmount = Math.max(30, Math.min(100, Number(validatedUpdates.secondOrderAmount) || 75));
      }
      if (validatedUpdates.thirdOrderAmount !== undefined) {
        validatedUpdates.thirdOrderAmount = Math.max(30, Math.min(100, Number(validatedUpdates.thirdOrderAmount) || 100));
      }

      const configRef = doc(db, 'settings', 'cashbackConfig');
      const payload = {
        ...validatedUpdates,
        updatedAt: new Date().toISOString()
      };
      await setDoc(configRef, payload, { merge: true });
      set((state) => ({ config: { ...state.config, ...payload } }));
    } catch (e) {
      console.error("Failed to update cashback config:", e);
      throw e;
    }
  },

  savePayoutInfo: async (userId: string, info: CustomerPayoutInfo) => {
    if (!userId) {
      return { success: false, message: 'Please sign in to save payout details.' };
    }

    try {
      const payoutDocRef = doc(db, 'customer_payouts', userId);
      const payload: CustomerPayoutInfo = {
        ...info,
        updatedAt: new Date().toISOString()
      };
      await setDoc(payoutDocRef, payload, { merge: true });
      set({ payoutInfo: payload });
      return { success: true, message: 'Payout details saved securely.' };
    } catch (e) {
      console.error("Failed to save payout info:", e);
      return { success: false, message: 'Failed to save payout details. Please try again.' };
    }
  },

  syncCustomerOrdersWithCashback: async (userId: string, orders: Order[], userProfile?: UserProfile | null) => {
    if (!userId || !orders || orders.length === 0) return;
    const config = get().config;
    if (!config.enabled) return;

    try {
      // Group orders by calendar month (YYYY-MM)
      const ordersByMonth: Record<string, Order[]> = {};
      orders.forEach(order => {
        if (order.customerId !== userId && (order as any).userId !== userId) return;
        const { key } = getMonthKey(order.createdAt);
        if (!ordersByMonth[key]) {
          ordersByMonth[key] = [];
        }
        ordersByMonth[key].push(order);
      });

      const currentPayout = get().payoutInfo;
      const currentRecords = get().records;

      // Process each calendar month independently
      for (const [monthKey, monthOrders] of Object.entries(ordersByMonth)) {
        // Sort chronologically ascending
        monthOrders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        // Filter eligible orders (exclude cancelled or refunded)
        const eligibleOrders = monthOrders.filter(o =>
          o.status !== 'cancelled' &&
          o.status !== 'refunded' &&
          o.status !== 'cancel_requested'
        );

        // First 3 eligible orders receive cashback
        const first3 = eligibleOrders.slice(0, 3);

        for (let i = 0; i < first3.length; i++) {
          const order = first3[i];
          const position = (i + 1) as 1 | 2 | 3;
          const recordId = `cb_${userId}_${order.id}`;

          const existingRecord = currentRecords.find(r => r.id === recordId || (r.userId === userId && r.orderId === order.id));

          // Determine amount for this position
          const amount = position === 1
            ? config.firstOrderAmount
            : position === 2
            ? config.secondOrderAmount
            : config.thirdOrderAmount;

          const returnBufferDays = config.returnPeriodDays || 7;
          const orderTimestamp = new Date(order.createdAt).getTime();
          const returnPeriodEnd = new Date(orderTimestamp + returnBufferDays * 24 * 60 * 60 * 1000).toISOString();
          const isReturnWindowPassed = Date.now() >= new Date(returnPeriodEnd).getTime();

          let status: 'pending' | 'eligible' | 'paid' | 'failed' = existingRecord?.status || 'pending';

          // If currently pending and return window has passed on a valid order, auto-transition to eligible
          if (status === 'pending' && isReturnWindowPassed && (order.status === 'delivered' || order.status === 'confirmed' || order.status === 'shipped')) {
            status = 'eligible';
          }

          const { name: monthName } = getMonthKey(order.createdAt);

          const recordData: CashbackRecord = {
            id: recordId,
            userId,
            userName: userProfile?.displayName || order.contactName || 'Customer',
            userEmail: userProfile?.email || order.contactEmail || '',
            userPhone: userProfile?.phone || order.contactPhone || '',
            orderId: order.id,
            customOrderId: order.customOrderId || order.id,
            orderDate: order.createdAt,
            orderTotal: order.total || 0,
            monthKey,
            monthName,
            position,
            amount,
            status,
            orderStatus: order.status,
            returnPeriodEnd,
            payoutInfo: existingRecord?.payoutInfo || (currentPayout || undefined),
            payoutDate: existingRecord?.payoutDate,
            payoutReference: existingRecord?.payoutReference,
            failureReason: existingRecord?.failureReason,
            createdAt: existingRecord?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          const recordRef = doc(db, 'cashback_records', recordId);
          await setDoc(recordRef, recordData, { merge: true });
        }

        // Check for cancelled/refunded orders that previously had a record and mark them failed
        const cancelledOrRefunded = monthOrders.filter(o => o.status === 'cancelled' || o.status === 'refunded');
        for (const order of cancelledOrRefunded) {
          const recordId = `cb_${userId}_${order.id}`;
          const existingRecord = currentRecords.find(r => r.id === recordId);
          if (existingRecord && existingRecord.status !== 'paid' && existingRecord.status !== 'failed') {
            const recordRef = doc(db, 'cashback_records', recordId);
            await updateDoc(recordRef, {
              status: 'failed',
              failureReason: `Order was ${order.status}`,
              orderStatus: order.status,
              updatedAt: new Date().toISOString()
            });
          }
        }
      }
    } catch (e) {
      console.error("Error syncing customer cashback records:", e);
    }
  },

  processPayout: async (recordId: string, reference: string) => {
    try {
      const recordRef = doc(db, 'cashback_records', recordId);
      const updateData = {
        status: 'paid' as const,
        payoutDate: new Date().toISOString(),
        payoutReference: reference.trim() || `PAYOUT-${Date.now()}`,
        updatedAt: new Date().toISOString()
      };
      await updateDoc(recordRef, updateData);
      set((state) => ({
        records: state.records.map(r => r.id === recordId ? { ...r, ...updateData } : r)
      }));
      return { success: true, message: 'Cashback payout recorded successfully.' };
    } catch (e) {
      console.error("Failed to process cashback payout:", e);
      return { success: false, message: 'Failed to update payout status.' };
    }
  },

  markRecordEligible: async (recordId: string) => {
    try {
      const recordRef = doc(db, 'cashback_records', recordId);
      const updateData = {
        status: 'eligible' as const,
        updatedAt: new Date().toISOString()
      };
      await updateDoc(recordRef, updateData);
      set((state) => ({
        records: state.records.map(r => r.id === recordId ? { ...r, ...updateData } : r)
      }));
      return { success: true, message: 'Cashback marked as eligible for payout.' };
    } catch (e) {
      console.error("Failed to mark cashback eligible:", e);
      return { success: false, message: 'Failed to update status.' };
    }
  },

  markRecordFailed: async (recordId: string, reason: string) => {
    try {
      const recordRef = doc(db, 'cashback_records', recordId);
      const updateData = {
        status: 'failed' as const,
        failureReason: reason,
        updatedAt: new Date().toISOString()
      };
      await updateDoc(recordRef, updateData);
      set((state) => ({
        records: state.records.map(r => r.id === recordId ? { ...r, ...updateData } : r)
      }));
      return { success: true, message: 'Cashback marked as failed.' };
    } catch (e) {
      console.error("Failed to mark cashback failed:", e);
      return { success: false, message: 'Failed to update status.' };
    }
  }
}));
