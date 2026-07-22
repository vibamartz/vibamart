import React, { useRef, useState } from 'react';
import { Order } from '../types';
import { getOrGenerateInvoiceNumber, downloadInvoicePDF } from '../utils/invoiceGenerator';
import { X, Download, Printer, CheckCircle2, Building2, Phone, Mail, FileText, ShoppingBag, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

interface InvoiceModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
}

export default function InvoiceModal({ order, isOpen, onClose }: InvoiceModalProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  if (!isOpen || !order) return null;

  const invoiceNumber = getOrGenerateInvoiceNumber(order);
  const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const deliveryDateFormatted = new Date(
    order.deliveryDate || order.invoiceDate || order.createdAt
  ).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  // Financial calculations
  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxAmount = Math.round(subtotal * 0.18); // 18% GST estimate
  const shippingCharge = 0; // Free shipping
  const discountAmount = Math.max(0, subtotal - order.total);
  const grandTotal = order.total;

  const handleDownload = async () => {
    if (!invoiceRef.current) return;
    setDownloading(true);
    const toastId = toast.loading('Generating PDF Invoice...');
    try {
      await downloadInvoicePDF(order, invoiceRef.current);
      toast.success('Invoice downloaded successfully!', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to download PDF invoice.', { id: toastId });
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden border border-gray-100 my-8 print:shadow-none print:border-none print:w-full print:max-w-none print:my-0">
        {/* Header Action Bar (Hidden during printing) */}
        <div className="bg-gray-900 text-white p-6 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Tax Invoice</h2>
              <p className="text-xs text-gray-400 font-mono">{invoiceNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="px-5 py-2 bg-[#22C55E] hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> {downloading ? 'Exporting...' : 'Download PDF'}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-xl transition-colors ml-2"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Invoice Printable Sheet */}
        <div className="p-8 md:p-12 overflow-y-auto max-h-[80vh] print:max-h-none print:overflow-visible print:p-6" ref={invoiceRef} id="invoice-printable-area">
          <div className="bg-white text-gray-900">
            {/* Invoice Top Header */}
            <div className="flex flex-col md:flex-row justify-between items-start border-b-2 border-gray-100 pb-8 gap-6">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/30">
                    V
                  </div>
                  <div>
                    <span className="text-2xl font-black tracking-tighter text-gray-900">ViBa</span>
                    <span className="text-2xl font-black tracking-tighter text-primary">Mart</span>
                  </div>
                </div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">ViBa Mart Retail Pvt. Ltd.</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Plot 45, Tech Park Phase 2, Madhapur,<br />
                  Hyderabad, Telangana - 500081, India
                </p>
                <p className="text-xs font-mono text-gray-700 font-semibold mt-2">GSTIN: 36AAACV1234F1Z9</p>
              </div>

              <div className="text-right md:text-right">
                <div className="inline-block bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-emerald-200 mb-3">
                  PAID INVOICE
                </div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">INVOICE</h3>
                <p className="text-sm font-mono font-bold text-primary mt-1">{invoiceNumber}</p>
                <div className="mt-3 text-xs space-y-1 text-gray-600">
                  <p><span className="font-bold text-gray-800">Order ID:</span> #{order.customOrderId || order.id}</p>
                  <p><span className="font-bold text-gray-800">Order Date:</span> {orderDate}</p>
                  <p><span className="font-bold text-gray-800">Delivery Date:</span> {deliveryDateFormatted}</p>
                </div>
              </div>
            </div>

            {/* Customer Details & Payment Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-8 pb-8 border-b border-gray-100">
              {/* Billed To / Shipped To */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Billed & Shipped To</p>
                <p className="text-base font-black text-gray-900">{order.contactName || order.address.fullName}</p>
                <p className="text-xs text-gray-600 font-medium mt-1 leading-relaxed">
                  {order.address.house ? `${order.address.house}, ` : ''}{order.address.street},<br />
                  {order.address.landmark ? `${order.address.landmark}, ` : ''}
                  {order.address.city}, {order.address.state} - {order.address.zip}<br />
                  {order.address.country || 'India'}
                </p>
                <div className="mt-3 space-y-1 text-xs text-gray-500">
                  {order.contactPhone && <p className="flex items-center gap-1.5 font-medium"><Phone className="w-3 h-3 text-gray-400" /> {order.contactPhone}</p>}
                  {order.contactEmail && <p className="flex items-center gap-1.5 font-medium"><Mail className="w-3 h-3 text-gray-400" /> {order.contactEmail}</p>}
                </div>
              </div>

              {/* Payment Details */}
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Payment Information</p>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-gray-600">Payment Method:</span>
                  <span className="font-black uppercase tracking-wider text-gray-900 bg-white px-3 py-1 rounded-lg border border-gray-200">{order.paymentMethod}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-gray-600">Payment Status:</span>
                  <span className="font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-3 py-1 rounded-lg flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> PAID
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs pt-2 border-t border-gray-200">
                  <span className="font-bold text-gray-600">Fulfillment Status:</span>
                  <span className="font-black uppercase tracking-wider text-emerald-600">DELIVERED</span>
                </div>
              </div>
            </div>

            {/* Product Items Table */}
            <div className="mb-8">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Itemized Breakdown</p>
              <div className="overflow-x-auto rounded-2xl border border-gray-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-4 px-4">Item Details</th>
                      <th className="py-4 px-4 text-center">Qty</th>
                      <th className="py-4 px-4 text-right">Unit Price</th>
                      <th className="py-4 px-4 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {order.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            {item.image && (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-10 h-10 rounded-xl object-cover border border-gray-200"
                              />
                            )}
                            <div>
                              <p className="font-bold text-gray-900">{item.name}</p>
                              {item.selectedVariant && (
                                <p className="text-[10px] text-gray-400 mt-0.5">Variant: {item.selectedVariant}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center font-bold text-gray-700">{item.quantity}</td>
                        <td className="py-4 px-4 text-right font-medium text-gray-700">₹{item.price.toLocaleString('en-IN')}</td>
                        <td className="py-4 px-4 text-right font-black text-gray-900">₹{(item.price * item.quantity).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary & Totals */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-8 pt-4 border-t border-gray-100">
              <div className="max-w-xs text-xs text-gray-500 space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 font-bold">
                  <ShieldCheck className="w-4 h-4" /> 100% Authentic Product Guarantee
                </div>
                <p className="leading-relaxed text-[11px]">
                  This is a computer-generated tax invoice and requires no physical signature. Goods once sold are covered under ViBa Mart return policy.
                </p>
              </div>

              <div className="w-full md:w-80 bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-3">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-bold text-gray-900">₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-xs text-emerald-600">
                    <span>Discount</span>
                    <span className="font-bold">-₹{discountAmount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-gray-600">
                  <span>GST (Included 18%)</span>
                  <span className="font-bold text-gray-900">₹{taxAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Shipping Fee</span>
                  <span className="font-bold text-emerald-600">FREE</span>
                </div>
                <div className="flex justify-between text-base font-black text-gray-900 pt-3 border-t border-gray-200">
                  <span>Invoice Total</span>
                  <span className="text-primary text-xl">₹{grandTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Invoice Footer */}
            <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center text-center md:text-left gap-4">
              <div>
                <p className="text-xs font-black text-gray-900 uppercase tracking-widest">Thank you for shopping with ViBa Mart!</p>
                <p className="text-[11px] text-gray-400 mt-0.5">For support or queries, email us at support@vibamart.com</p>
              </div>
              <div className="text-center md:text-right">
                <div className="border-b-2 border-gray-900 w-32 mx-auto md:ml-auto pb-1 mb-1">
                  <span className="text-[10px] font-black uppercase text-gray-900 tracking-wider">ViBa Mart</span>
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Authorized Signatory</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
