import admin from "firebase-admin";
import nodemailer from "nodemailer";
import { verifyAuth, setCorsHeaders } from "../utils";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  try {
    setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await verifyAuth(req, res);
  if (!user) return;

  const { orderId, reason, comments, images, productIds } = req.body;
  const uid = user.uid;

  if (!orderId || !reason || !images || images.length === 0) {
    return res.status(400).json({ success: false, error: "Missing required fields or images" });
  }

    const db = admin.firestore();
    const orderRef = db.collection("orders").doc(orderId);
    
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    const orderData = orderDoc.data()!;
    if (orderData.customerId !== uid) {
      return res.status(403).json({ success: false, error: "Unauthorized to request return for this order" });
    }

    // Only allow returns for delivered orders
    if (orderData.status !== "delivered") {
      return res.status(400).json({ success: false, error: "Can only return delivered orders" });
    }

    // Check for existing return request
    const existingReturns = await db.collection("requests").where("orderId", "==", orderId).where("type", "==", "return").get();
    const newProducts = productIds || orderData.items.map((i: any) => i.productId);

    if (!existingReturns.empty) {
      // Simplistic check: If there's an active return request, prevent a new one. 
      // A more robust check would see if ALL products are already being returned.
      const activeReturn = existingReturns.docs.find(d => !['rejected', 'refunded', 'resolved'].includes(d.data().status));
      if (activeReturn) {
         return res.status(400).json({ success: false, error: "An active return request already exists for this order." });
      }
    }

    let calculatedRefund = 0;
    orderData.items.forEach((item: any) => {
      if (newProducts.includes(item.productId)) {
        calculatedRefund += (item.price * item.quantity);
      }
    });

    const requestDoc = {
      userId: uid,
      orderId,
      type: 'return',
      productIds: newProducts,
      reason,
      comments: comments || "",
      images,
      status: 'requested',
      createdAt: new Date().toISOString(),
      refundAmount: calculatedRefund
    };

    const docRef = await db.collection("requests").add(requestDoc);

    await orderRef.update({
      status: "return_requested",
      hasReturnRequest: true,
      returnRequestId: docRef.id,
      statusHistory: admin.firestore.FieldValue.arrayUnion({
        status: "return_requested",
        timestamp: new Date().toISOString(),
        message: "Return requested by customer"
      })
    });

    // Fetch email and send confirmation
    const customerEmail = orderData.contactEmail || user.email;
    if (customerEmail) {
      const isPlaceholder = !process.env.SMTP_USER || process.env.SMTP_USER === "your-email@gmail.com" || process.env.SMTP_USER === "test";

      const emailHtml = `<h2>Hello ${orderData.contactName || 'Customer'},</h2>
      <p>We have received your return request for order <strong>#${orderId}</strong>.</p>
      <p>Our team will review the details and images provided within 48 hours.</p>`;

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
          subject: "Return Request Received",
          html: emailHtml,
        });
      } else {
        console.log(`[DEVELOPMENT] Return request email for ${customerEmail}:\n${emailHtml}`);
      }
    }

    res.json({ success: true, message: "Request submitted successfully", requestId: docRef.id });
  } catch (error: any) {
    console.error("Return request error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to submit return request" });
  }
}
