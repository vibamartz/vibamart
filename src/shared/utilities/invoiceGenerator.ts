import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Order } from '../types';

export function getOrGenerateInvoiceNumber(order: Order): string {
  if (order.invoiceNumber) return order.invoiceNumber;
  const dateStr = new Date(order.invoiceDate || order.deliveryDate || order.createdAt)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');
  const cleanId = (order.customOrderId || order.id).replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
  return `INV-${dateStr}-${cleanId || 'VBM1'}`;
}

export function generateNativePDF(order: Order, invoiceNum: string): void {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = [34, 197, 94]; // Emerald green
  const darkColor = [17, 24, 39]; // Gray-900
  const lightGray = [243, 244, 246]; // Gray-100

  // Header Banner
  pdf.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
  pdf.rect(0, 0, 210, 26, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text('ViBa Mart Retail Pvt. Ltd.', 12, 12);

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text('TAX INVOICE', 198, 11, { align: 'right' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text(invoiceNum, 198, 17, { align: 'right' });

  let y = 33;

  // Company GST & Address
  pdf.setTextColor(100, 100, 100);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Plot 45, Tech Park Phase 2, Madhapur, Hyderabad, TS - 500081 | GSTIN: 36AAACV1234F1Z9', 12, y);

  y += 6;
  pdf.setDrawColor(220, 220, 220);
  pdf.line(12, y, 198, y);
  y += 6;

  // Order & Customer Details
  const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const deliveryDateFormatted = new Date(order.deliveryDate || order.invoiceDate || order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(17, 24, 39);
  pdf.text('BILLED TO:', 12, y);
  pdf.text('ORDER DETAILS:', 120, y);

  y += 5;
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(60, 60, 60);

  const customerName = order.contactName || order.address?.fullName || 'Customer';
  const addressLine1 = `${order.address?.house ? order.address.house + ', ' : ''}${order.address?.street || ''}`;
  const addressLine2 = `${order.address?.city || ''}, ${order.address?.state || ''} - ${order.address?.zip || ''}`;

  pdf.text(customerName, 12, y);
  pdf.text(`Order ID: #${order.customOrderId || order.id}`, 120, y);
  y += 4;
  pdf.text(addressLine1, 12, y);
  pdf.text(`Order Date: ${orderDate}`, 120, y);
  y += 4;
  pdf.text(addressLine2, 12, y);
  pdf.text(`Delivery Date: ${deliveryDateFormatted}`, 120, y);
  y += 4;
  pdf.text(`Phone: ${order.contactPhone || order.address?.phone || 'N/A'}`, 12, y);
  pdf.text(`Payment: ${(order.paymentMethod || 'COD').toUpperCase()} (PAID)`, 120, y);

  y += 7;
  pdf.line(12, y, 198, y);
  y += 6;

  // Table Header
  pdf.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
  pdf.rect(12, y, 186, 7, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(17, 24, 39);

  pdf.text('Item Description', 15, y + 5);
  pdf.text('Qty', 130, y + 5, { align: 'center' });
  pdf.text('Unit Price', 160, y + 5, { align: 'right' });
  pdf.text('Total', 194, y + 5, { align: 'right' });

  y += 9;

  // Items List
  pdf.setFont('helvetica', 'normal');
  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  order.items.forEach((item) => {
    if (y > 250) {
      pdf.addPage();
      y = 20;
    }
    const itemTitle = item.name.length > 55 ? item.name.substring(0, 52) + '...' : item.name;
    pdf.text(itemTitle, 15, y);
    pdf.text(item.quantity.toString(), 130, y, { align: 'center' });
    pdf.text(`Rs. ${item.price.toLocaleString('en-IN')}`, 160, y, { align: 'right' });
    pdf.text(`Rs. ${(item.price * item.quantity).toLocaleString('en-IN')}`, 194, y, { align: 'right' });
    y += 6;
  });

  y += 2;
  pdf.line(12, y, 198, y);
  y += 6;

  // Totals Breakdown
  const taxAmount = order.items.reduce((sum, item) => {
    const isEnabled = item.enableGst !== false && (item.gst || 0) > 0;
    if (!isEnabled) return sum;
    const rate = item.gst || 18;
    return sum + Math.round((item.price * item.quantity * rate) / 100);
  }, 0);
  const discountAmount = Math.max(0, subtotal - order.total);
  const grandTotal = order.total;

  pdf.setFont('helvetica', 'normal');
  pdf.text('Subtotal:', 140, y);
  pdf.text(`Rs. ${subtotal.toLocaleString('en-IN')}`, 194, y, { align: 'right' });
  y += 5;

  if (discountAmount > 0) {
    pdf.text('Discount:', 140, y);
    pdf.text(`-Rs. ${discountAmount.toLocaleString('en-IN')}`, 194, y, { align: 'right' });
    y += 5;
  }

  pdf.text(`GST Tax (${taxAmount > 0 ? 'Included' : 'Exempt'}):`, 140, y);
  pdf.text(`Rs. ${taxAmount.toLocaleString('en-IN')}`, 194, y, { align: 'right' });
  y += 5;

  pdf.text('Shipping Fee:', 140, y);
  pdf.text('FREE', 194, y, { align: 'right' });
  y += 6;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.text('Invoice Total:', 140, y);
  pdf.text(`Rs. ${grandTotal.toLocaleString('en-IN')}`, 194, y, { align: 'right' });

  y += 12;
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(120, 120, 120);
  pdf.text('Thank you for shopping with ViBa Mart! Covered under 100% Authentic Product Guarantee.', 105, y, { align: 'center' });

  pdf.save(`${invoiceNum}.pdf`);
}

export async function downloadInvoicePDF(order: Order, invoiceElement: HTMLElement): Promise<void> {
  const invoiceNum = getOrGenerateInvoiceNumber(order);

  try {
    let canvas: HTMLCanvasElement;
    
    try {
      canvas = await html2canvas(invoiceElement, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff'
      });
    } catch (corsErr) {
      console.warn('html2canvas CORS render failed, falling back to safe rendering:', corsErr);
      canvas = await html2canvas(invoiceElement, {
        scale: 1.5,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff'
      });
    }

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 210; // A4 Width in mm
    const pageHeight = 297; // A4 Height in mm
    const margin = 8; // Margin in mm

    const maxWidth = pageWidth - (margin * 2);
    const maxHeight = pageHeight - (margin * 2);

    let renderWidth = maxWidth;
    let renderHeight = (canvas.height * renderWidth) / canvas.width;

    if (renderHeight > maxHeight) {
      renderHeight = maxHeight;
      renderWidth = (canvas.width * renderHeight) / canvas.height;
    }

    const xPos = (pageWidth - renderWidth) / 2;
    const yPos = (pageHeight - renderHeight) / 2;

    pdf.addImage(imgData, 'JPEG', xPos, yPos, renderWidth, renderHeight);
    pdf.save(`${invoiceNum}.pdf`);
  } catch (error) {
    console.warn('DOM Canvas PDF export encountered an error, using native PDF generator fallback:', error);
    try {
      generateNativePDF(order, invoiceNum);
    } catch (fallbackError) {
      console.error('Native PDF generation error:', fallbackError);
      throw new Error('Failed to generate PDF invoice. Please try printing or viewing the invoice.');
    }
  }
}
