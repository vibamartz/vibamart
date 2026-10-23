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

/**
 * Safely converts an image URL to a base64 Data URL to prevent CORS taint issues in html2canvas.
 * If CORS fails or times out, resolves to null safely.
 */
async function getSafeImageDataUrl(url: string | undefined): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return url;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => {
      resolve(null);
    }, 1200);

    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 48;
        canvas.height = img.naturalHeight || 48;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
          return;
        }
      } catch {
        // Tainted canvas or blocked by CORS
      }
      resolve(null);
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };

    img.src = url;
  });
}

/**
 * Generates an exact HTML document matching the View Invoice modal layout, fields, and styling.
 */
async function buildInvoiceDOM(order: Order): Promise<HTMLElement> {
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

  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxAmount = order.items.reduce((sum, item) => {
    const isEnabled = item.enableGst !== false && (item.gst || 0) > 0;
    if (!isEnabled) return sum;
    const rate = item.gst || 18;
    return sum + Math.round((item.price * item.quantity * rate) / 100);
  }, 0);
  const discountAmount = Math.max(0, subtotal - order.total);
  const grandTotal = order.total;

  const customerName = order.contactName || order.address?.fullName || 'Customer';
  const addressParts: string[] = [];
  if (order.address?.house) addressParts.push(order.address.house);
  if (order.address?.street) addressParts.push(order.address.street);
  const line1 = addressParts.join(', ');

  const line2Parts: string[] = [];
  if (order.address?.landmark) line2Parts.push(order.address.landmark);
  if (order.address?.city) line2Parts.push(order.address.city);
  const line2 = line2Parts.join(', ');

  const line3 = `${order.address?.state || ''}${order.address?.zip ? ' - ' + order.address.zip : ''}, ${order.address?.country || 'India'}`;

  // Pre-load images safely to avoid any canvas tainting
  const safeImages: (string | null)[] = await Promise.all(
    order.items.map((item) => getSafeImageDataUrl(item.image))
  );

  const container = document.createElement('div');
  container.style.width = '800px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#111827';
  container.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  container.style.padding = '32px';
  container.style.boxSizing = 'border-box';
  container.style.margin = '0';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.zIndex = '-9999';

  const itemRowsHtml = order.items
    .map((item, idx) => {
      const imgData = safeImages[idx];
      const imgElement = imgData
        ? `<img src="${imgData}" alt="" style="width:32px;height:32px;border-radius:8px;object-fit:cover;border:1px solid #e5e7eb;flex-shrink:0;" />`
        : `<div style="width:32px;height:32px;border-radius:8px;background:#f3f4f6;border:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#9ca3af;font-size:10px;font-weight:700;">VB</div>`;

      return `
      <tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:10px 14px;">
          <div style="display:flex;align-items:center;gap:10px;">
            ${imgElement}
            <div>
              <p style="font-weight:700;color:#111827;line-height:1.2;margin:0;font-size:11px;">${item.name}</p>
              ${item.selectedVariant ? `<p style="font-size:9px;color:#9ca3af;margin:2px 0 0 0;">${item.selectedVariant}</p>` : ''}
            </div>
          </div>
        </td>
        <td style="padding:10px 14px;text-align:center;font-weight:700;color:#374151;font-size:11px;">${item.quantity}</td>
        <td style="padding:10px 14px;text-align:right;font-weight:500;color:#374151;font-size:11px;">₹${item.price.toLocaleString('en-IN')}</td>
        <td style="padding:10px 14px;text-align:right;font-weight:900;color:#111827;font-size:11px;">₹${(item.price * item.quantity).toLocaleString('en-IN')}</td>
      </tr>
    `;
    })
    .join('');

  const discountHtml =
    discountAmount > 0
      ? `<div style="display:flex;justify-content:space-between;font-size:11px;color:#059669;">
          <span>Discount</span>
          <span style="font-weight:700;">-₹${discountAmount.toLocaleString('en-IN')}</span>
        </div>`
      : '';

  const phoneHtml = order.contactPhone || order.address?.phone
    ? `<p style="display:flex;align-items:center;gap:6px;font-size:11px;color:#6b7280;margin:6px 0 0 0;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        ${order.contactPhone || order.address?.phone}
      </p>`
    : '';

  const emailHtml = order.contactEmail
    ? `<p style="display:flex;align-items:center;gap:6px;font-size:11px;color:#6b7280;margin:4px 0 0 0;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
        ${order.contactEmail}
      </p>`
    : '';

  container.innerHTML = `
    <div style="background:#ffffff;color:#111827;">
      <!-- Invoice Top Header with Exact Website Logo -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #f3f4f6;padding-bottom:24px;">
        <div>
          <!-- Logo -->
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
            <div style="position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center;">
              <svg viewBox="0 0 100 100" width="48" height="48" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 25 L38 85 L48 85 L32 25 Z" fill="#15803d" />
                <path d="M45 25 L65 85 H70 L50 25 Z" fill="#15803d" opacity="0.9" />
                <path d="M55 25 L75 85 H80 L60 25 Z" fill="#eab308" opacity="0.9" />
                <path d="M65 25 L88 25 C95 25 100 30 100 38 C100 45 95 50 88 52 C95 54 100 59 100 68 C100 77 95 85 85 85 H70 L90 25 Z" fill="#eab308" />
                <path d="M82 42 H88 C90 42 92 40 92 38 C92 36 90 34 88 34 H84 L82 42 Z" fill="#ffffff" opacity="0.2" />
                <path d="M78 75 H85 C88 75 90 73 90 68 C90 63 88 61 85 61 H82 L78 75 Z" fill="#ffffff" opacity="0.2" />
              </svg>
            </div>
            <div style="display:flex;flex-direction:column;justify-content:center;line-height:1;">
              <div style="display:flex;align-items:baseline;">
                <span style="font-size:24px;font-weight:900;font-style:italic;color:#15803d;">Vi</span>
                <span style="font-size:24px;font-weight:900;font-style:italic;color:#eab308;">Ba</span>
                <span style="font-size:18px;font-weight:900;font-style:italic;color:#1f2937;margin-left:3px;">Mart</span>
              </div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
                <div style="height:1px;width:14px;background:#15803d;opacity:0.4;"></div>
                <span style="font-size:8px;font-weight:800;color:#9ca3af;text-transform:uppercase;letter-spacing:0.3em;">Premium Lifestyle</span>
              </div>
            </div>
          </div>
          <p style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.1em;margin:4px 0 0 0;">ViBa Mart Retail Pvt. Ltd.</p>
          <p style="font-size:11px;color:#6b7280;margin:2px 0 0 0;line-height:1.4;">Plot 45, Tech Park Phase 2, Madhapur, Hyderabad, Telangana - 500081, India</p>
          <p style="font-size:11px;font-family:monospace;font-weight:600;color:#374151;margin:4px 0 0 0;">GSTIN: 36AAACV1234F1Z9</p>
        </div>

        <div style="text-align:right;">
          <div style="display:inline-block;background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;padding:4px 12px;border-radius:9999px;margin-bottom:8px;">
            PAID INVOICE
          </div>
          <h3 style="font-size:20px;font-weight:900;color:#111827;letter-spacing:-0.025em;margin:0;">TAX INVOICE</h3>
          <p style="font-size:12px;font-family:monospace;font-weight:700;color:#16a34a;margin:2px 0 0 0;">${invoiceNumber}</p>
          <div style="margin-top:8px;font-size:11px;color:#4b5563;line-height:1.5;">
            <div><strong style="color:#1f2937;">Order ID:</strong> #${order.customOrderId || order.id}</div>
            <div><strong style="color:#1f2937;">Order Date:</strong> ${orderDate}</div>
            <div><strong style="color:#1f2937;">Delivery Date:</strong> ${deliveryDateFormatted}</div>
          </div>
        </div>
      </div>

      <!-- Customer Details & Payment Info -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:24px 0;padding-bottom:24px;border-bottom:1px solid #f3f4f6;">
        <div>
          <p style="font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;margin:0 0 6px 0;">Billed & Shipped To</p>
          <p style="font-size:14px;font-weight:900;color:#111827;margin:0;">${customerName}</p>
          <p style="font-size:11px;color:#4b5563;font-weight:500;line-height:1.5;margin:4px 0 0 0;">
            ${line1 ? `${line1},<br />` : ''}
            ${line2 ? `${line2},<br />` : ''}
            ${line3}
          </p>
          ${phoneHtml}
          ${emailHtml}
        </div>

        <div style="background:#f9fafb;padding:16px;border-radius:16px;border:1px solid #f3f4f6;display:flex;flex-direction:column;gap:10px;">
          <p style="font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;margin:0;">Payment Information</p>
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;">
            <span style="font-weight:700;color:#4b5563;">Payment Method:</span>
            <span style="font-weight:900;text-transform:uppercase;letter-spacing:0.05em;color:#111827;background:#ffffff;padding:2px 10px;border-radius:8px;border:1px solid #e5e7eb;">${order.paymentMethod}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;">
            <span style="font-weight:700;color:#4b5563;">Payment Status:</span>
            <span style="font-weight:900;text-transform:uppercase;letter-spacing:0.05em;color:#047857;background:#d1fae5;padding:2px 10px;border-radius:8px;display:inline-flex;align-items:center;gap:4px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#047857" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              PAID
            </span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;padding-top:8px;border-top:1px solid #e5e7eb;">
            <span style="font-weight:700;color:#4b5563;">Fulfillment Status:</span>
            <span style="font-weight:900;text-transform:uppercase;letter-spacing:0.05em;color:#059669;">DELIVERED</span>
          </div>
        </div>
      </div>

      <!-- Product Items Table -->
      <div style="margin-bottom:24px;">
        <p style="font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;margin:0 0 10px 0;">Itemized Breakdown</p>
        <div style="border-radius:16px;border:1px solid #f3f4f6;overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;text-align:left;font-size:12px;">
            <thead style="background:#f9fafb;border-bottom:1px solid #f3f4f6;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;font-size:10px;">
              <tr>
                <th style="padding:10px 14px;">Item Details</th>
                <th style="padding:10px 14px;text-align:center;">Qty</th>
                <th style="padding:10px 14px;text-align:right;">Unit Price</th>
                <th style="padding:10px 14px;text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody style="font-size:11px;">
              ${itemRowsHtml}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Summary & Totals -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding-top:12px;border-top:1px solid #f3f4f6;">
        <div style="max-width:320px;font-size:10px;color:#6b7280;display:flex;flex-direction:column;gap:6px;">
          <div style="display:flex;align-items:center;gap:6px;color:#059669;font-weight:700;font-size:11px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
            100% Authentic Product Guarantee
          </div>
          <p style="margin:0;line-height:1.5;">This is a computer-generated tax invoice and requires no physical signature. Covered under ViBa Mart return policy.</p>
        </div>

        <div style="width:288px;background:#f9fafb;padding:16px;border-radius:16px;border:1px solid #f3f4f6;display:flex;flex-direction:column;gap:8px;font-size:12px;">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:#4b5563;">
            <span>Subtotal</span>
            <span style="font-weight:700;color:#111827;">₹${subtotal.toLocaleString('en-IN')}</span>
          </div>
          ${discountHtml}
          <div style="display:flex;justify-content:space-between;font-size:11px;color:#4b5563;">
            <span>GST (Included 18%)</span>
            <span style="font-weight:700;color:#111827;">₹${taxAmount.toLocaleString('en-IN')}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:11px;color:#4b5563;">
            <span>Shipping Fee</span>
            <span style="font-weight:700;color:#059669;">FREE</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:900;color:#111827;padding-top:10px;border-top:1px solid #e5e7eb;">
            <span>Invoice Total</span>
            <span style="color:#16a34a;font-size:18px;">₹${grandTotal.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      <!-- Invoice Footer -->
      <div style="margin-top:32px;padding-top:24px;border-top:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <p style="font-size:11px;font-weight:900;color:#111827;text-transform:uppercase;letter-spacing:0.1em;margin:0;">Thank you for shopping with ViBa Mart!</p>
          <p style="font-size:10px;color:#9ca3af;margin:3px 0 0 0;">For support, contact viba.mart@hotmail.com</p>
        </div>
        <div style="text-align:right;">
          <div style="border-bottom:2px solid #111827;width:112px;margin-left:auto;padding-bottom:4px;margin-bottom:4px;text-align:center;">
            <span style="font-size:9px;font-weight:900;text-transform:uppercase;color:#111827;letter-spacing:0.05em;">ViBa Mart</span>
          </div>
          <p style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;margin:0;">Authorized Signatory</p>
        </div>
      </div>
    </div>
  `;

  return container;
}

/**
 * Native jsPDF fallback generator that mirrors the View Invoice format, layout, fields, and styling.
 */
export function generateNativePDF(order: Order, invoiceNum: string): void {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const emeraldColor: [number, number, number] = [22, 163, 74];
  const darkColor: [number, number, number] = [17, 24, 39];
  const grayText: [number, number, number] = [107, 114, 128];
  const lightGrayBg: [number, number, number] = [249, 250, 251];
  const borderGray: [number, number, number] = [243, 244, 246];

  let y = 14;

  // Header: Logo and Company Info
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
  pdf.text('ViBa', 14, y);
  pdf.setTextColor(234, 179, 8);
  pdf.text('Ba', 25, y);
  pdf.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  pdf.text('Mart', 33, y);

  // PAID INVOICE Badge at top right
  pdf.setFillColor(236, 253, 245);
  pdf.setDrawColor(167, 243, 208);
  pdf.roundedRect(160, y - 6, 36, 6, 3, 3, 'FD');
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(4, 120, 87);
  pdf.text('PAID INVOICE', 178, y - 2, { align: 'center' });

  y += 5;
  pdf.setFontSize(6.5);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(grayText[0], grayText[1], grayText[2]);
  pdf.text('PREMIUM LIFESTYLE', 14, y);

  // TAX INVOICE Header at top right
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  pdf.text('TAX INVOICE', 196, y + 2, { align: 'right' });

  y += 6;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  pdf.text('VIBA MART RETAIL PVT. LTD.', 14, y);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
  pdf.text(invoiceNum, 196, y, { align: 'right' });

  y += 4.5;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(grayText[0], grayText[1], grayText[2]);
  pdf.text('Plot 45, Tech Park Phase 2, Madhapur, Hyderabad, TS - 500081, India', 14, y);

  const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const deliveryDateFormatted = new Date(order.deliveryDate || order.invoiceDate || order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  pdf.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  pdf.text(`Order ID: #${order.customOrderId || order.id}`, 196, y, { align: 'right' });

  y += 4;
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  pdf.text('GSTIN: 36AAACV1234F1Z9', 14, y);

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(grayText[0], grayText[1], grayText[2]);
  pdf.text(`Order Date: ${orderDate}`, 196, y, { align: 'right' });

  y += 4;
  pdf.text(`Delivery Date: ${deliveryDateFormatted}`, 196, y, { align: 'right' });

  y += 5;
  pdf.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  pdf.line(14, y, 196, y);
  y += 6;

  // Billed To & Payment Information
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(grayText[0], grayText[1], grayText[2]);
  pdf.text('BILLED & SHIPPED TO', 14, y);

  // Payment Info card background
  pdf.setFillColor(lightGrayBg[0], lightGrayBg[1], lightGrayBg[2]);
  pdf.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  pdf.roundedRect(120, y - 2, 76, 26, 4, 4, 'FD');

  pdf.text('PAYMENT INFORMATION', 124, y + 3);

  y += 5;
  const customerName = order.contactName || order.address?.fullName || 'Customer';
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  pdf.text(customerName, 14, y);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(grayText[0], grayText[1], grayText[2]);
  pdf.text('Payment Method:', 124, y);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  pdf.text((order.paymentMethod || 'ONLINE').toUpperCase(), 192, y, { align: 'right' });

  y += 4.5;
  const addressLine1 = [order.address?.house, order.address?.street].filter(Boolean).join(', ');
  const addressLine2 = `${order.address?.city || ''}, ${order.address?.state || ''} - ${order.address?.zip || ''}`;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(grayText[0], grayText[1], grayText[2]);
  if (addressLine1) pdf.text(addressLine1, 14, y);

  pdf.text('Payment Status:', 124, y);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(4, 120, 87);
  pdf.text('PAID', 192, y, { align: 'right' });

  y += 4.5;
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(grayText[0], grayText[1], grayText[2]);
  if (addressLine2) pdf.text(addressLine2, 14, y);

  pdf.text('Fulfillment Status:', 124, y);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
  pdf.text('DELIVERED', 192, y, { align: 'right' });

  y += 4.5;
  if (order.contactPhone || order.address?.phone) {
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(grayText[0], grayText[1], grayText[2]);
    pdf.text(`Phone: ${order.contactPhone || order.address?.phone}`, 14, y);
  }

  y += 8;
  pdf.line(14, y, 196, y);
  y += 6;

  // Items Table Header
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(grayText[0], grayText[1], grayText[2]);
  pdf.text('ITEMIZED BREAKDOWN', 14, y);
  y += 3;

  pdf.setFillColor(lightGrayBg[0], lightGrayBg[1], lightGrayBg[2]);
  pdf.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  pdf.rect(14, y, 182, 6, 'FD');

  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(grayText[0], grayText[1], grayText[2]);
  pdf.text('Item Details', 17, y + 4.2);
  pdf.text('Qty', 125, y + 4.2, { align: 'center' });
  pdf.text('Unit Price', 158, y + 4.2, { align: 'right' });
  pdf.text('Total', 192, y + 4.2, { align: 'right' });

  y += 8;

  // Items List
  pdf.setFont('helvetica', 'normal');
  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  order.items.forEach((item) => {
    if (y > 250) {
      pdf.addPage();
      y = 15;
    }
    const itemTitle = item.name.length > 55 ? item.name.substring(0, 52) + '...' : item.name;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    pdf.text(itemTitle, 17, y);

    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(grayText[0], grayText[1], grayText[2]);
    pdf.text(item.quantity.toString(), 125, y, { align: 'center' });

    pdf.setFont('helvetica', 'normal');
    pdf.text(`Rs. ${item.price.toLocaleString('en-IN')}`, 158, y, { align: 'right' });

    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    pdf.text(`Rs. ${(item.price * item.quantity).toLocaleString('en-IN')}`, 192, y, { align: 'right' });

    y += 5.5;
  });

  y += 2;
  pdf.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  pdf.line(14, y, 196, y);
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

  // Guarantee Box on left
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
  pdf.text('100% Authentic Product Guarantee', 14, y);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.setTextColor(grayText[0], grayText[1], grayText[2]);
  pdf.text('This is a computer-generated tax invoice and requires no physical signature.', 14, y + 4);
  pdf.text('Covered under ViBa Mart return policy.', 14, y + 7.5);

  // Totals card on right
  pdf.setFillColor(lightGrayBg[0], lightGrayBg[1], lightGrayBg[2]);
  pdf.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  pdf.roundedRect(125, y - 2, 71, 30, 4, 4, 'FD');

  let totY = y + 3;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(grayText[0], grayText[1], grayText[2]);
  pdf.text('Subtotal', 129, totY);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  pdf.text(`Rs. ${subtotal.toLocaleString('en-IN')}`, 192, totY, { align: 'right' });

  if (discountAmount > 0) {
    totY += 4.5;
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
    pdf.text('Discount', 129, totY);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`-Rs. ${discountAmount.toLocaleString('en-IN')}`, 192, totY, { align: 'right' });
  }

  totY += 4.5;
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(grayText[0], grayText[1], grayText[2]);
  pdf.text('GST (Included 18%)', 129, totY);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  pdf.text(`Rs. ${taxAmount.toLocaleString('en-IN')}`, 192, totY, { align: 'right' });

  totY += 4.5;
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(grayText[0], grayText[1], grayText[2]);
  pdf.text('Shipping Fee', 129, totY);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
  pdf.text('FREE', 192, totY, { align: 'right' });

  totY += 5;
  pdf.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  pdf.line(129, totY - 1, 192, totY - 1);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  pdf.text('Invoice Total', 129, totY + 3);
  pdf.setFontSize(10);
  pdf.setTextColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
  pdf.text(`Rs. ${grandTotal.toLocaleString('en-IN')}`, 192, totY + 3, { align: 'right' });

  // Footer
  y = Math.max(y + 36, 260);
  pdf.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  pdf.line(14, y, 196, y);

  y += 5;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  pdf.text('THANK YOU FOR SHOPPING WITH VIBA MART!', 14, y);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.text('ViBa Mart', 196, y, { align: 'right' });

  y += 3.5;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.setTextColor(grayText[0], grayText[1], grayText[2]);
  pdf.text('For support, contact viba.mart@hotmail.com', 14, y);

  pdf.setFont('helvetica', 'bold');
  pdf.text('Authorized Signatory', 196, y, { align: 'right' });

  pdf.save(`${invoiceNum}.pdf`);
}

/**
 * Downloads the invoice as a PDF with identical layout, formatting, fields, and styling as the View modal.
 */
export async function downloadInvoicePDF(order: Order, _invoiceElement?: HTMLElement | null): Promise<void> {
  const invoiceNum = getOrGenerateInvoiceNumber(order);

  let tempContainer: HTMLElement | null = null;
  try {
    // Build the exact standardized A4 DOM element matching the View modal
    tempContainer = await buildInvoiceDOM(order);
    document.body.appendChild(tempContainer);

    const canvas = await html2canvas(tempContainer, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 800
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidthMm = 210;
    const pageHeightMm = 297;
    const marginMm = 8;
    const contentWidthMm = pageWidthMm - marginMm * 2; // 194 mm
    const contentHeightMm = pageHeightMm - marginMm * 2; // 281 mm

    const canvasWidthPx = canvas.width;
    const canvasHeightPx = canvas.height;
    const totalHeightMm = (canvasHeightPx * contentWidthMm) / canvasWidthPx;

    if (totalHeightMm <= contentHeightMm) {
      // Single A4 page
      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      pdf.addImage(imgData, 'JPEG', marginMm, marginMm, contentWidthMm, totalHeightMm);
    } else {
      // Multi-page slicing for longer invoices
      const pageHeightPx = Math.floor((contentHeightMm * canvasWidthPx) / contentWidthMm);
      let renderedHeightPx = 0;
      let pageIndex = 0;

      while (renderedHeightPx < canvasHeightPx) {
        const sliceHeightPx = Math.min(pageHeightPx, canvasHeightPx - renderedHeightPx);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvasWidthPx;
        sliceCanvas.height = sliceHeightPx;
        const sliceCtx = sliceCanvas.getContext('2d');
        if (sliceCtx) {
          sliceCtx.fillStyle = '#ffffff';
          sliceCtx.fillRect(0, 0, canvasWidthPx, sliceHeightPx);
          sliceCtx.drawImage(
            canvas,
            0,
            renderedHeightPx,
            canvasWidthPx,
            sliceHeightPx,
            0,
            0,
            canvasWidthPx,
            sliceHeightPx
          );
          const sliceImgData = sliceCanvas.toDataURL('image/jpeg', 0.98);
          const sliceHeightMm = (sliceHeightPx * contentWidthMm) / canvasWidthPx;

          if (pageIndex > 0) {
            pdf.addPage();
          }
          pdf.addImage(sliceImgData, 'JPEG', marginMm, marginMm, contentWidthMm, sliceHeightMm);
        }
        renderedHeightPx += sliceHeightPx;
        pageIndex++;
      }
    }

    pdf.save(`${invoiceNum}.pdf`);
  } catch (error) {
    console.warn('HTML-to-Canvas PDF generation encountered an error, falling back to matched native PDF generator:', error);
    try {
      generateNativePDF(order, invoiceNum);
    } catch (fallbackError) {
      console.error('Native PDF generation error:', fallbackError);
      throw new Error('Failed to generate PDF invoice. Please try printing or viewing the invoice.');
    }
  } finally {
    if (tempContainer && tempContainer.parentNode) {
      tempContainer.parentNode.removeChild(tempContainer);
    }
  }
}
