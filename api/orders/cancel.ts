import admin from "firebase-admin";
import nodemailer from "nodemailer";
import { verifyAuth, setCorsHeaders } from "../utils";

export default async function handler(req: any, res: any) {
  try {
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await verifyAuth(req, res);
  if (!user) return; // verifyAuth handles the response if it fails

  const { orderId, reason } = req.body;
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
      return res.status(403).json({ success: false, error: "Unauthorized to cancel this order" });
    }

    const allowedStatuses = ["pending", "confirmed", "packed"];
    if (!allowedStatuses.includes(orderData.status)) {
      return res.status(400).json({ success: false, error: `Cannot cancel order in ${orderData.status} status` });
    }

    // Check if manual cancellation is enabled
    const settingsDoc = await db.collection("settings").doc("store").get();
    const enableManualCancellation = settingsDoc.exists && settingsDoc.data()?.enableManualCancellation === true;

    const requestDoc = {
      userId: uid,
      orderId,
      type: 'cancellation',
      reason,
      status: enableManualCancellation ? 'requested' : 'approved',
      createdAt: new Date().toISOString()
    };
    
    const docRef = await db.collection("requests").add(requestDoc);

    if (enableManualCancellation) {
      await orderRef.update({
        status: "cancel_requested",
        cancellationReason: reason,
        statusHistory: admin.firestore.FieldValue.arrayUnion({
          status: "cancel_requested",
          timestamp: new Date().toISOString(),
          message: "Cancellation requested by customer"
        })
      });
    } else {
      // Direct cancel
      await db.runTransaction(async (transaction) => {
        const productDocs = [];
        for (const item of orderData.items) {
          const productRef = db.collection("products").doc(item.productId);
          const productDoc = await transaction.get(productRef);
          productDocs.push({ item, productRef, productDoc });
        }

        const updatesByProduct = new Map<string, any>();
        
        for (const { item, productRef, productDoc } of productDocs) {
          if (productDoc.exists) {
            const pData = productDoc.data()!;
            const productId = productRef.id;
            
            if (!updatesByProduct.has(productId)) {
              updatesByProduct.set(productId, {
                ref: productRef,
                updates: { stock: pData.stock || 0 },
                variants: pData.variants ? [...pData.variants] : null
              });
            }
            
            const prodUpdate = updatesByProduct.get(productId);
            prodUpdate.updates.stock += item.quantity;
            
            if (item.variantId && prodUpdate.variants) {
               const variantIndex = prodUpdate.variants.findIndex((v: any) => v.id === item.variantId);
               if (variantIndex !== -1) {
                  prodUpdate.variants[variantIndex].stock = (prodUpdate.variants[variantIndex].stock || 0) + item.quantity;
                  prodUpdate.updates.variants = prodUpdate.variants;
               }
            }
          }
        }
        
        for (const prodUpdate of updatesByProduct.values()) {
          transaction.update(prodUpdate.ref, prodUpdate.updates);
        }
        transaction.update(orderRef, {
          status: "cancelled",
          cancellationReason: reason,
          statusHistory: admin.firestore.FieldValue.arrayUnion({
            status: "cancelled",
            timestamp: new Date().toISOString(),
            message: "Cancelled by customer"
          })
        });
      });
    }

    // Fetch email and send confirmation
    const customerEmail = orderData.contactEmail || user.email;
    if (customerEmail) {
      const isPlaceholder = !process.env.SMTP_USER || process.env.SMTP_USER === "your-email@gmail.com" || process.env.SMTP_USER === "test";

      const emailHtml = `<h2>Hello ${orderData.contactName || 'Customer'},</h2>
      <p>Your order <strong>#${orderId}</strong> cancellation request has been ${enableManualCancellation ? 'received and is pending approval' : 'successfully processed'}.</p>
      <p>Reason: ${reason}</p>
      ${!enableManualCancellation ? '<p>If you paid online, your refund will be processed within 5-7 business days.</p>' : ''}`;
      
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
          subject: "Order Cancellation Confirmation",
          html: emailHtml,
        });
      } else {
        console.log(`[DEVELOPMENT] Cancellation email for ${customerEmail}:\n${emailHtml}`);
      }
    }

    res.json({ success: true, message: "Request submitted successfully", requestId: docRef.id });
  } catch (error: any) {
    console.error("Cancel order error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to cancel order" });
  }
}
