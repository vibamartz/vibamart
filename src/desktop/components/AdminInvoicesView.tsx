import React, { useState } from 'react';
import { Order } from '../../shared/types';
import { getOrGenerateInvoiceNumber, downloadInvoicePDF } from '../../shared/utilities/invoiceGenerator';
import InvoiceModal from './InvoiceModal';
import { FileText, Download, Eye, RefreshCw, Search, CheckCircle2, DollarSign, Calendar, User } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import toast from 'react-hot-toast';

interface AdminInvoicesViewProps {
  orders: Order[];
  loading: boolean;
}

export default function AdminInvoicesView({ orders, loading }: AdminInvoicesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  // Filter delivered orders or orders with invoiceNumber
  const deliveredOrders = orders.filter(
    (o) => o.status === 'delivered' || !!o.invoiceNumber
  );

  const filteredInvoices = deliveredOrders.filter((order) => {
    const invNum = getOrGenerateInvoiceNumber(order).toLowerCase();
    const orderId = (order.customOrderId || order.id).toLowerCase();
    const custName = (order.contactName || order.address?.fullName || '').toLowerCase();
    const custEmail = (order.contactEmail || '').toLowerCase();
    const q = searchQuery.toLowerCase().trim();

    if (!q) return true;
    return (
      invNum.includes(q) ||
      orderId.includes(q) ||
      custName.includes(q) ||
      custEmail.includes(q)
    );
  });

  const handleRegenerateInvoice = async (order: Order) => {
    setRegeneratingId(order.id);
    const toastId = toast.loading('Re-generating invoice metadata...');
    try {
      const newInvoiceNum = getOrGenerateInvoiceNumber(order);
      const newInvoiceDate = new Date().toISOString();
      const orderRef = doc(db, 'orders', order.id);

      await updateDoc(orderRef, {
        invoiceNumber: newInvoiceNum,
        invoiceDate: newInvoiceDate
      });

      toast.success(`Invoice ${newInvoiceNum} re-generated successfully!`, { id: toastId });
    } catch (error) {
      console.error('Error re-generating invoice:', error);
      toast.error('Failed to re-generate invoice.', { id: toastId });
    } finally {
      setRegeneratingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">Tax Invoices Management</h2>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                View, download, and manage tax invoices for all delivered orders.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Invoice #, Order ID, Customer..."
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-11 pr-4 py-3 text-xs font-bold focus:outline-none focus:border-primary transition-all"
            />
          </div>
        </div>
      </div>

      {/* Invoices List Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs font-bold text-gray-400">Loading invoices...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-16 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-900">No Invoices Found</p>
            <p className="text-xs text-gray-400 mt-1">
              {searchQuery ? 'Try matching another search term.' : 'Delivered orders will appear here automatically with generated invoices.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase font-black tracking-wider">
                <tr>
                  <th className="py-4 px-6">Invoice Number</th>
                  <th className="py-4 px-6">Order ID</th>
                  <th className="py-4 px-6">Customer</th>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Amount</th>
                  <th className="py-4 px-6">Payment</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredInvoices.map((order) => {
                  const invoiceNum = getOrGenerateInvoiceNumber(order);
                  const invoiceDateFormatted = new Date(
                    order.invoiceDate || order.deliveryDate || order.createdAt
                  ).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  });

                  return (
                    <tr key={order.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-primary">
                        {invoiceNum}
                      </td>
                      <td className="py-4 px-6 font-bold text-gray-900">
                        #{order.customOrderId || order.id}
                      </td>
                      <td className="py-4 px-6">
                        <p className="font-bold text-gray-900">{order.contactName || order.address?.fullName || 'Customer'}</p>
                        <p className="text-[10px] text-gray-400">{order.contactEmail || 'N/A'}</p>
                      </td>
                      <td className="py-4 px-6 text-gray-600 font-medium">
                        {invoiceDateFormatted}
                      </td>
                      <td className="py-4 px-6 font-black text-gray-900">
                        ₹{order.total.toLocaleString('en-IN')}
                      </td>
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> {order.paymentMethod}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowInvoiceModal(true);
                          }}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-[10px] uppercase tracking-wider inline-flex items-center gap-1.5 transition-all"
                        >
                          <Eye className="w-3 h-3" /> View
                        </button>
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowInvoiceModal(true);
                          }}
                          className="px-3 py-1.5 bg-[#22C55E] hover:bg-emerald-600 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider inline-flex items-center gap-1.5 transition-all shadow-sm"
                        >
                          <Download className="w-3 h-3" /> PDF
                        </button>
                        <button
                          onClick={() => handleRegenerateInvoice(order)}
                          disabled={regeneratingId === order.id}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold rounded-xl text-[10px] uppercase tracking-wider inline-flex items-center gap-1.5 transition-all"
                          title="Re-generate invoice metadata"
                        >
                          <RefreshCw className={`w-3 h-3 ${regeneratingId === order.id ? 'animate-spin' : ''}`} /> Re-generate
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice Viewer Modal */}
      {selectedOrder && (
        <InvoiceModal
          order={selectedOrder}
          isOpen={showInvoiceModal}
          onClose={() => {
            setShowInvoiceModal(false);
            setSelectedOrder(null);
          }}
        />
      )}
    </div>
  );
}
