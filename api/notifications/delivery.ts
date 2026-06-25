import admin from "firebase-admin";
import nodemailer from "nodemailer";
import { setCorsHeaders, initializeFirebaseAdmin } from "../utils";

initializeFirebaseAdmin();

export default async function handler(req: any, res: any) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { orderId, customerEmail, customerName, deliveryDate, items, total } = req.body;

  if (!orderId || !customerEmail) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  try {
    const itemsList = items?.map((item: any) => `<li>${item.name} - Qty: ${item.quantity}</li>`).join('') || '';
    
    const emailHtml = `
      <h2>Hello ${customerName || 'Customer'},</h2>
      <p>We are excited to inform you that your order <strong>#${orderId}</strong> has been successfully delivered on ${deliveryDate || new Date().toLocaleDateString()}.</p>
      <h3>Order Summary:</h3>
      <ul>
        ${itemsList}
      </ul>
      <p><strong>Total Amount:</strong> ₹${total}</p>
      <br/>
      <p>Thank you for shopping with ViBa Mart! We hope you enjoy your purchase.</p>
      <p>Best Regards,<br/>The ViBa Mart Team</p>
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
