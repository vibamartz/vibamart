import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Package, ArrowRight, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

export default function MobileOrderSuccessScreen() {
  const location = useLocation();
  const navigate = useNavigate();

  const stateData = location.state || {};
  const orderId = stateData.orderId || 'VBM-ORDER';
  const customId = stateData.customId || `VBM-${Date.now().toString().slice(-6)}`;

  return (
    <div className="min-h-screen bg-[#FFF3EB] pb-24 font-sans select-none flex flex-col items-center justify-center p-6 text-center space-y-4">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center border-4 border-white shadow-xl"
      >
        <CheckCircle2 className="w-12 h-12 stroke-[2.2]" />
      </motion.div>

      <div className="space-y-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
          Order Confirmed
        </span>
        <h2 className="text-xl font-black text-gray-900 pt-2">Thank You For Your Order!</h2>
        <p className="text-xs text-gray-500 font-medium">Order Reference: <strong>{customId}</strong></p>
      </div>

      <div className="bg-white rounded-3xl p-4 shadow-sm border border-orange-100 w-full max-w-sm text-xs space-y-2 text-left">
        <div className="flex justify-between text-gray-600">
          <span>Status</span>
          <span className="font-extrabold text-emerald-700 uppercase">Confirmed</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Estimated Delivery</span>
          <span className="font-extrabold text-gray-900">2 - 4 Business Days</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Payment</span>
          <span className="font-extrabold text-gray-900">Success</span>
        </div>
      </div>

      <div className="flex flex-col w-full max-w-sm gap-2.5 pt-2">
        <button
          onClick={() => navigate(`/track-order/${orderId}`)}
          className="w-full py-3.5 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-md flex items-center justify-center gap-2"
        >
          Track Shipment Progress <Package className="w-4 h-4" />
        </button>

        <button
          onClick={() => navigate('/products')}
          className="w-full py-3.5 bg-white text-gray-800 rounded-2xl text-xs font-black uppercase tracking-wider border border-gray-200 shadow-xs flex items-center justify-center gap-2"
        >
          Continue Shopping <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
