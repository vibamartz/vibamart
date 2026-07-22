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
  const invoiceNum = getOrGenerateInvoiceNumber(order);

  try {
    let canvas: HTMLCanvasElement;
    
    // Attempt rendering with html2canvas (with CORS fallback protection)
    try {
      canvas = await html2canvas(invoiceElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
    } catch (corsErr) {
      console.warn('html2canvas CORS render failed, falling back to basic rendering:', corsErr);
      canvas = await html2canvas(invoiceElement, {
        scale: 1.5,
        useCORS: false,
        allowTaint: true,
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

    // Force scale down so the invoice fits on EXACTLY 1 SINGLE PAGE
    if (renderHeight > maxHeight) {
      renderHeight = maxHeight;
      renderWidth = (canvas.width * renderHeight) / canvas.height;
    }

    const xPos = (pageWidth - renderWidth) / 2;
    const yPos = (pageHeight - renderHeight) / 2;

    pdf.addImage(imgData, 'JPEG', xPos, yPos, renderWidth, renderHeight);
    pdf.save(`${invoiceNum}.pdf`);
  } catch (error) {
    console.error('Error generating PDF invoice:', error);
    throw new Error('Failed to generate PDF invoice. Please try printing or viewing the invoice.');
  }
}
