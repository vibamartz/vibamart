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

export async function downloadInvoicePDF(order: Order, invoiceElement: HTMLElement): Promise<void> {
  try {
    const canvas = await html2canvas(invoiceElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    let heightLeft = pdfHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
    heightLeft -= pdf.internal.pageSize.getHeight();

    while (heightLeft > 0) {
      position = heightLeft - pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();
    }

    const invoiceNum = getOrGenerateInvoiceNumber(order);
    pdf.save(`${invoiceNum}.pdf`);
  } catch (error) {
    console.error('Error generating PDF invoice:', error);
    throw error;
  }
}
