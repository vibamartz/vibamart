import admin from "firebase-admin";
import nodemailer from "nodemailer";
import { verifyAuth, setCorsHeaders } from "../utils";

export default async function handler(req: any, res: any) {
  try {
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await verifyAuth(req, res);
  if (!user) return;

  const { orderId, reason, comments } = req.body;
  const uid = user.uid;

  if (!orderId || !reason) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

    const db = admin.firestore();
    const orderRef = db.collection("orders").doc(orderId);
    
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    const orderData = orderDoc.data()!;
    if (orderData.customerId !== uid) {
      return res.status(403).json({ success: false, error: "Unauthorized to request refund for this order" });
    }

    const existingRefunds = await db.collection("requests").where("orderId", "==", orderId).where("type", "==", "refund").get();

    if (!existingRefunds.empty) {
      const activeRefund = existingRefunds.docs.find(d => !['rejected', 'refunded', 'resolved'].includes(d.data().status));
      if (activeRefund) {
         return res.status(400).json({ success: false, error: "An active refund request already exists for this order." });
      }
    }

    const requestDoc = {
      userId: uid,
      orderId,
      type: 'refund',
      reason,
      comments: comments || "",
      status: 'requested',
      createdAt: new Date().toISOString(),
      refundAmount: orderData.total || 0
    };

    const docRef = await db.collection("requests").add(requestDoc);

    await orderRef.update({
      status: "refund_requested",
      hasRefundRequest: true,
      refundRequestId: docRef.id,
      statusHistory: admin.firestore.FieldValue.arrayUnion({
        status: "refund_requested",
        timestamp: new Date().toISOString(),
        message: "Refund requested by customer"
      })
    });

    // Fetch email and send confirmation
    const customerEmail = orderData.contactEmail || user.email;
    if (customerEmail) {
      const isPlaceholder = !process.env.SMTP_USER || process.env.SMTP_USER === "your-email@gmail.com" || process.env.SMTP_USER === "test";

      const emailHtml = `<h2>Hello ${orderData.contactName || 'Customer'},</h2>
      <p>We have received your refund request for order <strong>#${orderId}</strong>.</p>
      <p>Our team will review the request and get back to you within 48 hours.</p>`;

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
          subject: "Refund Request Received",
          html: emailHtml,
        });
      } else {
        console.log(`[DEVELOPMENT] Refund request email for ${customerEmail}:\n${emailHtml}`);
      }
    }

    res.json({ success: true, message: "Request submitted successfully", requestId: docRef.id });
  } catch (error: any) {
    console.error("Refund request error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to submit refund request" });
  }
}
