import React from 'react';
import { motion } from 'motion/react';
import { X, Truck, ArrowLeft, MessageSquare } from 'lucide-react';
import { Order } from '../types';

export default function AdminOrderDetailsView({ order, onBack }: { order: Order, onBack: () => void }) {
  const handleSendWhatsApp = (order: Order) => {
    const customerName = order.contactName || order.address?.fullName || 'Customer';
    const customerPhone = order.contactPhone || order.address?.phone || '';
    
    if (!customerPhone) {
      alert('Customer phone number not available');
      return;
    }
    
    const cleanPhone = customerPhone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    
    const itemsText = order.items.map(item => `${item.name} (Qty: ${item.quantity})`).join(', ');
    
    const text = `Hello ${customerName},\n\nThis is ViBa Mart. We have received your order *#${order.id.slice(-8).toUpperCase()}*!\n\n*Order Details:*\n- Items: ${itemsText}\n- Total Amount: ₹${order.total.toLocaleString()}\n- Payment Status: ${order.paymentStatus.toUpperCase()}\n- Delivery Address: ${order.address.house}, ${order.address.street}, ${order.address.city}, ${order.address.state} - ${order.address.zip}\n\nWe will update you as soon as the order is processed. Thank you for shopping with us!`;
    
    const encodedText = encodeURIComponent(text);
    const url = `https://wa.me/${formattedPhone}?text=${encodedText}`;
    window.open(url, '_blank');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 max-w-4xl mx-auto space-y-8">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-black font-bold">
            <ArrowLeft className="w-4 h-4" /> Back to Orders
        </button>
        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100">
           <div className="flex items-center justify-between mb-8">
              <div>
                 <h3 className="text-xl font-black text-gray-900">Order Details</h3>
                 <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">#{order.id.toUpperCase()}</p>
              </div>
           </div>
           
           <div className="grid grid-cols-2 gap-10">
              <div>
                 <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-4">Contact Information</h4>
                 <p className="text-sm font-black text-gray-900">{order.contactName}</p>
                 <p className="text-xs text-gray-500 font-medium">{order.contactEmail}</p>
                 <p className="text-xs text-gray-500 font-medium">{order.contactPhone}</p>
                 {order.contactPhone && (
                    <button
                       onClick={() => handleSendWhatsApp(order)}
                       className="mt-3 flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 border border-green-100 rounded-xl hover:bg-green-100 hover:text-green-755 transition-all font-bold text-xs shadow-sm animate-none"
                    >
                       <MessageSquare className="w-4 h-4" />
                       Send WhatsApp
                    </button>
                 )}
              </div>
              <div>
                 <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-4">Delivery Address</h4>
                 <p className="text-xs text-gray-500 font-bold leading-relaxed">
                    {order.address.street},<br />
                    {order.address.city}, {order.address.state} - {order.address.zip}<br />
                    {order.address.country}
                 </p>
              </div>
           </div>

           {order.trackingId && (
             <div className="p-6 bg-purple-50 rounded-[2rem] border border-purple-100 flex items-center justify-between mt-8">
                <div className="flex items-center gap-4">
                   <div className="bg-white p-3 rounded-2xl shadow-sm text-purple-600">
                      <Truck className="w-5 h-5" />
                   </div>
                   <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-purple-400">Tracking Information</p>
                      <p className="text-sm font-black text-purple-700 mt-1">{order.carrier}: {order.trackingId}</p>
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-black uppercase tracking-widest text-purple-400">Est. Delivery</p>
                   <p className="text-sm font-black text-purple-700 mt-1">
                     {order.estimatedDelivery ? new Date(order.estimatedDelivery).toLocaleDateString() : 'N/A'}
                   </p>
                </div>
             </div>
           )}

           <div className="mt-10">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-4">Order Items</h4>
              <div className="space-y-3">
                 {order.items.map((item, idx) => (
                   <div key={idx} className="flex gap-5 p-4 bg-gray-50 rounded-[2rem] border border-gray-100 group">
                      <img src={item.image} className="w-16 h-16 rounded-2xl object-cover border-4 border-white shadow-sm" alt="" />
                      <div className="flex-1 min-w-0 self-center">
                         <p className="text-sm font-black text-gray-900 truncate tracking-tight">{item.name}</p>
                         <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Quantity: {item.quantity} × ₹{item.price.toLocaleString()}</p>
                      </div>
                      <div className="text-sm font-black text-gray-900 self-center bg-white px-4 py-2 rounded-xl shadow-sm">₹{(item.price * item.quantity).toLocaleString()}</div>
                   </div>
                 ))}
              </div>
           </div>

           <div className="bg-gray-900 rounded-[2.5rem] p-10 text-white mt-10">
              <div className="flex justify-between items-center">
                 <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">Payment Method</p>
                    <p className="text-lg font-black uppercase tracking-tight">{order.paymentMethod}</p>
                    <p className="text-[10px] font-black uppercase mt-1 px-2 py-0.5 bg-white/10 rounded inline-block">{order.paymentStatus}</p>
                 </div>
                 <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">Total Paid</p>
                    <p className="text-4xl font-black tracking-tighter">₹{order.total.toLocaleString()}</p>
                 </div>
              </div>
           </div>
        </div>
    </motion.div>
  );
}
