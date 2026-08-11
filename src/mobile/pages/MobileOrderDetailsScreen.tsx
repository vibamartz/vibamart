import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, Clock, Truck, ShieldCheck, FileText, Download, 
  ArrowLeft, MapPin, AlertCircle, RefreshCcw, XCircle 
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Order, OrderStatus } from '../../shared/types';
import InvoiceModal from '../../desktop/components/InvoiceModal';
import toast from 'react-hot-toast';
import { motion } from 'motion/react';

export default function MobileOrderDetailsScreen() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    const fetchOrder = async () => {
      try {
        const docRef = doc(db, 'orders', orderId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setOrder({ id: snap.id, ...snap.data() } as Order);
        } else {
          toast.error("Order not found");
          navigate('/orders');
        }
      } catch (err) {
        console.error("Error fetching order:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, navigate]);

  if (loading || !order) {
    return (
      <div className="min-h-screen bg-[#FFF3EB] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-gray-500">Loading Order Details...</span>
        </div>
      </div>
    );
  }

  const STAGES: { key: OrderStatus; label: string }[] = [
    { key: 'pending', label: 'Order Placed' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'packed', label: 'Packed' },
    { key: 'shipped', label: 'Shipped' },
    { key: 'out_for_delivery', label: 'Out for Delivery' },
    { key: 'delivered', label: 'Delivered' },
  ];

  const getStageIndex = (status: OrderStatus) => {
    const idx = STAGES.findIndex(s => s.key === status);
    return idx >= 0 ? idx : (status === 'delivered' ? 5 : 0);
  };

  const currentStageIndex = getStageIndex(order.status);
  const isCancelled = ['cancelled', 'cancel_requested', 'returned', 'refunded'].includes(order.status);
  const displayId = order.customOrderId || `VBM-${order.id.slice(-6).toUpperCase()}`;

  // Check 7-day return policy eligibility
  const deliveryDate = order.deliveryDate ? new Date(order.deliveryDate) : new Date(order.createdAt);
  const daysDiff = Math.floor((new Date().getTime() - deliveryDate.getTime()) / (1000 * 3600 * 24));
  const isReturnEligible = order.status === 'delivered' && daysDiff <= 7;

  return (
    <div className="min-h-screen bg-[#FFF3EB] pb-28 font-sans select-none p-3 space-y-3">
      {/* Header Info */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-gray-400">Order Reference</span>
            <h2 className="text-base font-black text-gray-900">{displayId}</h2>
          </div>
          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
            {new Date(order.createdAt).toLocaleDateString()}
          </span>
        </div>

        {/* Invoice View / Download — AVAILABLE ONLY IF DELIVERED */}
        {order.status === 'delivered' ? (
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
              <FileText className="w-4 h-4 text-emerald-600" /> Official Tax Invoice Available
            </span>
            <button
              onClick={() => setShowInvoiceModal(true)}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> View Invoice
            </button>
          </div>
        ) : (
          <p className="text-[10px] font-medium text-gray-400 pt-1">
            Tax invoice will be generated and downloadable upon successful delivery.
          </p>
        )}
      </div>

      {/* Live Order Status Pipeline Tracker */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100 space-y-3">
        <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">
          Shipment Tracking Pipeline
        </h3>

        {!isCancelled ? (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
            {STAGES.map((stage, idx) => {
              const isCompleted = idx <= currentStageIndex;
              const isCurrent = idx === currentStageIndex;

              return (
                <div key={stage.key} className="relative flex items-center justify-between text-xs">
                  <div
                    className={`absolute -left-6 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition-all ${
                      isCompleted
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                        : isCurrent
                        ? 'bg-amber-500 border-amber-500 text-white animate-pulse'
                        : 'bg-white border-gray-300 text-gray-400'
                    }`}
                  >
                    {isCompleted ? '✓' : idx + 1}
                  </div>

                  <span className={`font-bold ${isCompleted ? 'text-emerald-900' : isCurrent ? 'text-amber-900 font-extrabold' : 'text-gray-400'}`}>
                    {stage.label}
                  </span>

                  {isCurrent && (
                    <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                      Live State
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>This order has been {order.status.replace('_', ' ')}.</span>
          </div>
        )}
      </div>

      {/* Ordered Items Breakdown */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100 space-y-3">
        <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">
          Items Ordered ({order.items.length})
        </h3>
        <div className="divide-y divide-gray-100">
          {order.items.map((item, idx) => (
            <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
              <img
                src={item.image || 'https://via.placeholder.com/50'}
                alt=""
                className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate">{item.name}</p>
                <span className="text-[10px] text-gray-500 font-semibold">Qty: {item.quantity}</span>
              </div>
              <span className="text-xs font-black text-gray-900">
                ₹{(item.price * item.quantity).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Shipping Address & Customer Contact */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100 space-y-2 text-xs">
        <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-emerald-600" /> Delivery Address
        </h3>
        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200/80 space-y-1">
          <p className="font-extrabold text-gray-900">{order.contactName || order.address.fullName}</p>
          <p className="text-gray-700 font-medium">{order.address.house}, {order.address.street}</p>
          <p className="text-gray-600 font-medium">{order.address.city}, {order.address.state} - {order.address.zip}</p>
          <p className="text-emerald-700 font-bold">Phone: {order.contactPhone || order.address.phone}</p>
        </div>
      </div>

      {/* Action Triggers: Cancel / Return Requests */}
      <div className="space-y-2">
        {['pending', 'confirmed'].includes(order.status) && (
          <button
            onClick={() => navigate(`/requests?type=cancellation&orderId=${order.id}`)}
            className="w-full py-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl text-xs font-black uppercase tracking-wider"
          >
            Cancel Order Request
          </button>
        )}

        {isReturnEligible && (
          <button
            onClick={() => navigate(`/requests?type=return&orderId=${order.id}`)}
            className="w-full py-3 bg-amber-50 text-amber-800 border border-amber-200 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5"
          >
            <RefreshCcw className="w-4 h-4 text-amber-600" /> Request 7-Day Return / Replacement
          </button>
        )}
      </div>

      {/* Invoice Modal */}
      {showInvoiceModal && (
        <InvoiceModal
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          order={order}
        />
      )}
    </div>
  );
}
