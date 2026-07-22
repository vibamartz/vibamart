import admin from "firebase-admin";
import nodemailer from "nodemailer";
import { setCorsHeaders, initializeFirebaseAdmin } from "../utils.js";

initializeFirebaseAdmin();

export default async function handler(req: any, res: any) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { orderId, customOrderId, invoiceNumber, customerEmail, customerName, deliveryDate, items, total } = req.body;

  if (!orderId || !customerEmail) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  try {
    const displayOrderId = customOrderId || orderId;
    const itemsList = items?.map((item: any) => `<li>${item.name} - Qty: ${item.quantity} (₹${item.price})</li>`).join('') || '';
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden;">
        <div style="background-color: #111827; padding: 24px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 24px;">ViBa Mart</h1>
          <p style="margin: 4px 0 0 0; color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Order Delivered Successfully</p>
        </div>
        <div style="padding: 24px;">
          <h2 style="color: #111827; margin-top: 0;">Hello ${customerName || 'Valued Customer'},</h2>
          <p>We are delighted to inform you that your order <strong>#${displayOrderId}</strong> has been successfully delivered on <strong>${deliveryDate || new Date().toLocaleDateString()}</strong>.</p>
          
          ${invoiceNumber ? `
          <div style="background-color: #f9fafb; border: 1px solid #f3f4f6; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; font-weight: bold; color: #6b7280;">Tax Invoice Generated</p>
            <p style="margin: 0; font-family: monospace; font-weight: bold; color: #2563eb; font-size: 16px;">Invoice #: ${invoiceNumber}</p>
          </div>
          ` : ''}

          <h3 style="border-bottom: 2px solid #f3f4f6; padding-bottom: 8px;">Order Summary</h3>
          <ul style="padding-left: 20px; line-height: 1.6;">
            ${itemsList}
          </ul>
          
          <p style="font-size: 18px; font-weight: bold; margin-top: 20px;">Total Paid: ₹${total}</p>

          <div style="margin-top: 30px; text-align: center;">
            <a href="https://vibamart.com/track-order/${displayOrderId}" style="background-color: #22C55E; color: white; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: bold; display: inline-block; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">
              View & Download Invoice PDF
            </a>
          </div>

          <p style="margin-top: 30px; font-size: 14px; color: #6b7280; text-align: center;">
            Thank you for shopping with ViBa Mart! We hope to see you again soon.
          </p>
        </div>
      </div>
    `;

    const db = admin.firestore();
    
    // Prevent duplicate emails
    const notificationRef = db.collection("notifications").doc(`${orderId}_delivery`);
    const doc = await notificationRef.get();
    
    if (doc.exists) {
      return res.json({ success: true, message: "Delivery email already sent previously" });
    }

    const isPlaceholder = !process.env.SMTP_USER || process.env.SMTP_USER === "your-email@gmail.com" || process.env.SMTP_USER === "test";

    if (process.env.SMTP_HOST && !isPlaceholder) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.ethereal.email",
        port: Number(process.env.SMTP_PORT) || 587,
        auth: {
          user: process.env.SMTP_USER || "test",
          pass: process.env.SMTP_PASS || "test",
        },
      });
      await transporter.sendMail({
        from: `"ViBa Mart" <${process.env.SMTP_USER}>`,
        to: customerEmail,
        subject: "Your ViBa Mart Order has been Delivered!",
        html: emailHtml,
      });
      
      await notificationRef.set({
        sentAt: new Date().toISOString(),
        orderId,
        type: "delivery"
      });
      
      console.log(`Delivery email sent to ${customerEmail}`);
    } else {
      console.log(`[DEVELOPMENT] Delivery email for ${customerEmail}:\n${emailHtml}`);
    }

    res.json({ success: true, message: "Delivery notification sent" });
  } catch (error: any) {
    console.error("Delivery notification error:", error);
    const errMsg = error?.message || String(error) || "Failed to send delivery notification";
    res.status(500).json({ 
      success: false, 
      error: errMsg, 
      message: errMsg 
    });
  }
}
