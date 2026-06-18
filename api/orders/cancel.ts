import admin from "firebase-admin";
import { verifyAuth, setCorsHeaders, createNotification, sendEmailNotification } from "../utils";

export default async function handler(req: any, res: any) {
  try {
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const user = await verifyAuth(req, res);
    if (!user) return; // verifyAuth handles the response if it fails

    const { orderId, reason } = req.body;
    const uid = user.uid;

    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      return res.status(400).json({ success: false, error: "Order ID is required and must be a valid string." });
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ success: false, error: "Reason is required and must be a valid string." });
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

    // Check for duplicate cancellation requests
    const existingCancellations = await db.collection("requests")
      .where("orderId", "==", orderId)
      .where("type", "==", "cancellation")
      .get();

    if (!existingCancellations.empty) {
      return res.status(400).json({ success: false, error: "A duplicate cancellation request already exists for this order." });
    }

    // Check if manual cancellation is enabled
    const settingsDoc = await db.collection("settings").doc("store").get();
    const enableManualCancellation = settingsDoc.exists && settingsDoc.data()?.enableManualCancellation === true;

    // Generate unique doc ID
    const docRef = db.collection("requests").doc();
    const requestId = docRef.id;

    const requestDoc = {
      id: requestId,
      requestId,
      orderId,
      customerId: uid,
      userId: uid,
      requestType: 'cancellation',
      type: 'cancellation',
      requestReason: reason,
      reason,
      status: enableManualCancellation ? 'requested' : 'approved',
      createdDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await docRef.set(requestDoc);

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

    // Notifications & Emails
    const customerEmail = orderData.contactEmail || user.email;
    const customerName = orderData.contactName || "Customer";

    if (enableManualCancellation) {
      createNotification(
        uid,
        "Cancellation Request Submitted",
        `Your cancellation request for order #${orderId} has been submitted successfully.`,
        orderId
      ).catch(console.error);
      
      if (customerEmail) {
        sendEmailNotification(
          customerEmail,
          customerName,
          "Order Cancellation Request Received",
          `We have received your cancellation request for order #${orderId}. Reason: ${reason}. It is currently pending review.`
        ).catch(console.error);
      }
    } else {
      createNotification(
        uid,
        "Order Cancelled",
        `Your order #${orderId} has been cancelled successfully.`,
        orderId
      ).catch(console.error);
      
      if (customerEmail) {
        sendEmailNotification(
          customerEmail,
          customerName,
          "Order Cancelled Successfully",
          `Your order #${orderId} has been successfully cancelled. If you paid online, your refund will be processed within 5-7 business days.`
        ).catch(console.error);
      }
    }

    // Admin Notification
    createNotification(
      "admin",
      "New Cancellation Request",
      `A new cancellation request was submitted for order #${orderId}.`,
      orderId
    ).catch(console.error);

    res.json({ success: true, message: "Request submitted successfully", requestId });
  } catch (error: any) {
    console.error("Cancel order error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to cancel order" });
  }
}
