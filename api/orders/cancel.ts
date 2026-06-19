import admin from "firebase-admin";
import { verifyAuth, setCorsHeaders, createNotification, sendEmailNotification, getErrorLocation } from "../utils.js";

// Make sure firebase is initialized
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PRIVATE_KEY !== 'paste_firebase_private_key_here') {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      admin.initializeApp();
    }
  } catch (e) {
    console.warn("Firebase Admin missing credentials", e);
  }
}

export default async function handler(req: any, res: any) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    console.log("Request received");
    const { orderId, customOrderId, reason } = req.body || {};
    const targetOrderId = customOrderId || orderId;

    // 1. Validate fields exist before database operations
    if (!targetOrderId || typeof targetOrderId !== 'string' || !targetOrderId.trim()) {
      return res.status(400).json({ success: false, message: "Order ID/Custom Order ID missing" });
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ success: false, message: "Cancellation reason missing" });
    }

    // 2. Perform authentication and validate customer
    let user;
    try {
      user = await verifyAuth(req);
    } catch (authError: any) {
      console.error("Auth error:", authError);
      return res.status(401).json({ success: false, message: authError.message || "Unauthorized" });
    }

    const uid = user?.uid;
    const userEmail = user?.email;
    if (!uid) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const db = admin.firestore();

    // Fetch order document
    let orderDoc;
    try {
      console.log(`[FIRESTORE READ] Fetching order document from 'orders' collection. Document ID: ${targetOrderId}`);
      orderDoc = await db.collection("orders").doc(targetOrderId).get();
    } catch (error: any) {
      console.error("FULL ERROR:", error);
      console.error(error.stack);
      return res.status(500).json({ success: false, message: error.message });
    }

    if (!orderDoc.exists) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const orderData = orderDoc.data();
    if (!orderData) {
      return res.status(400).json({ success: false, message: "Order data is null" });
    }

    // Check if user is admin
    let isAdmin = false;
    if (userEmail === 'vk311779@gmail.com') {
      isAdmin = true;
    } else {
      try {
        const userDoc = await db.collection("users").doc(uid).get();
        if (userDoc.exists && userDoc.data()?.role === 'admin') {
          isAdmin = true;
        }
      } catch (adminErr) {
        console.error("Admin check warning:", adminErr);
      }
    }

    // Check if owner using contactEmail
    const isOwner = userEmail && orderData.contactEmail && userEmail.toLowerCase() === orderData.contactEmail.toLowerCase();

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: "Unauthorized to cancel this order" });
    }

    const allowedStatuses = ["pending", "confirmed", "packed"];
    if (!allowedStatuses.includes(orderData.status)) {
      return res.status(400).json({ success: false, message: `Cannot cancel order in ${orderData.status} status` });
    }

    // Check for duplicate cancellation requests in the cancel-order collection
    console.log(`[FIRESTORE READ] Checking duplicate cancellations. Querying 'cancel-order' where 'customOrderId' == ${targetOrderId}`);
    let existingCancellations;
    try {
      existingCancellations = await db.collection("cancel-order")
        .where("customOrderId", "==", targetOrderId)
        .get();
    } catch (error: any) {
      console.error("FULL ERROR:", error);
      console.error(error.stack);
      return res.status(500).json({ success: false, message: error.message });
    }

    if (!existingCancellations.empty) {
      return res.status(400).json({ success: false, message: "A duplicate cancellation request already exists for this order." });
    }

    // Check if manual cancellation is enabled
    let enableManualCancellation = false;
    try {
      console.log("[FIRESTORE READ] Fetching settings document from 'settings' collection with ID 'store'");
      const settingsDoc = await db.collection("settings").doc("store").get();
      enableManualCancellation = settingsDoc.exists && settingsDoc.data()?.enableManualCancellation === true;
    } catch (error: any) {
      console.error("FULL ERROR:", error);
      console.error(error.stack);
      return res.status(500).json({ success: false, message: error.message });
    }

    // Add detailed logging
    console.log("Order:", orderData);
    console.log("customOrderId:", orderData.customOrderId || targetOrderId);
    console.log("contactEmail:", orderData.contactEmail);
    console.log("Reason:", reason);

    // 3. Save request data in Firestore (cancel-order) with the required fields
    const cancellationReqData = {
      customOrderId: orderData.customOrderId || targetOrderId,
      contactEmail: orderData.contactEmail || userEmail || "",
      reason: reason,
      status: "Pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    let docRef;
    try {
      console.log("[FIRESTORE WRITE] Creating cancellation request document in 'cancel-order' collection. Data:", JSON.stringify(cancellationReqData));
      docRef = await db.collection("cancel-order").add(cancellationReqData);
    } catch (error: any) {
      console.error("FULL ERROR:", error);
      console.error(error.stack);
      return res.status(500).json({ success: false, message: error.message });
    }

    const requestId = docRef.id;

    if (enableManualCancellation) {
      const orderUpdates = {
        status: "cancel_requested",
        cancellationReason: reason,
        statusHistory: admin.firestore.FieldValue.arrayUnion({
          status: "cancel_requested",
          timestamp: new Date().toISOString(),
          message: "Cancellation requested by customer"
        })
      };
      try {
        console.log(`[FIRESTORE WRITE] Updating order document in 'orders' collection. Document ID: ${targetOrderId}. Updates:`, JSON.stringify(orderUpdates));
        await db.collection("orders").doc(targetOrderId).update(orderUpdates);
      } catch (error: any) {
        console.error("FULL ERROR:", error);
        console.error(error.stack);
        return res.status(500).json({ success: false, message: error.message });
      }
    } else {
      // Direct cancel
      const batch = db.batch();
      const productDocs = [];
      if (orderData.items && Array.isArray(orderData.items)) {
        for (const item of orderData.items) {
          if (!item.productId) continue;
          console.log(`[FIRESTORE READ] Fetching product document from 'products' collection. Product ID: ${item.productId}`);
          try {
            const productRef = db.collection("products").doc(item.productId);
            const productDoc = await productRef.get();
            productDocs.push({ item, productRef, productDoc });
          } catch (error: any) {
            console.error("FULL ERROR:", error);
            console.error(error.stack);
            return res.status(500).json({ success: false, message: error.message });
          }
        }
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
        batch.update(prodUpdate.ref, prodUpdate.updates);
      }
      batch.update(db.collection("orders").doc(targetOrderId), {
        status: "cancelled",
        cancellationReason: reason,
        statusHistory: admin.firestore.FieldValue.arrayUnion({
          status: "cancelled",
          timestamp: new Date().toISOString(),
          message: "Cancelled by customer"
        })
      });
      batch.update(db.collection("cancel-order").doc(requestId), {
        status: "Approved"
      });
      
      try {
        console.log(`[FIRESTORE WRITE] Executing batch commit for direct order cancellation updates. Order ID: ${targetOrderId}`);
        await batch.commit();
      } catch (error: any) {
        console.error("FULL ERROR:", error);
        console.error(error.stack);
        return res.status(500).json({ success: false, message: error.message });
      }
    }

    // 5. Safely execute notifications & emails without crashing the function
    try {
      const customerEmail = orderData.contactEmail || userEmail;
      const customerName = orderData.contactName || "Customer";

      const notificationPromises = [];

      if (enableManualCancellation) {
        notificationPromises.push(createNotification(
          uid,
          "Cancellation Request Submitted",
          `Your cancellation request for order #${targetOrderId} has been submitted successfully.`,
          targetOrderId
        ).catch(e => console.error("createNotification error:", e)));
        
        if (customerEmail) {
          notificationPromises.push(sendEmailNotification(
            customerEmail,
            customerName,
            "Order Cancellation Request Received",
            `We have received your cancellation request for order #${targetOrderId}. Reason: ${reason}. It is currently pending review.`
          ).catch(e => console.error("sendEmailNotification error:", e)));
        }
      } else {
        notificationPromises.push(createNotification(
          uid,
          "Order Cancelled",
          `Your order #${targetOrderId} has been cancelled successfully.`,
          targetOrderId
        ).catch(e => console.error("createNotification error:", e)));
        
        if (customerEmail) {
          notificationPromises.push(sendEmailNotification(
            customerEmail,
            customerName,
            "Order Cancelled Successfully",
            `Your order #${targetOrderId} has been successfully cancelled. If you paid online, your refund will be processed within 5-7 business days.`
          ).catch(e => console.error("sendEmailNotification error:", e)));
        }
      }

      notificationPromises.push(createNotification(
        "admin",
        "New Cancellation Request",
        `A new cancellation request was submitted for order #${targetOrderId}.`,
        targetOrderId
      ).catch(e => console.error("admin createNotification error:", e)));

      await Promise.allSettled(notificationPromises);
    } catch (notifyErr) {
      console.error("Notification service warning:", notifyErr);
    }

    return res.status(200).json({ success: true, message: "Request submitted successfully", requestId });
  } catch (error: any) {
    console.error("Cancel Order Error:", error);
    if (res && typeof res.status === 'function') {
      return res.status(500).json({
        success: false,
        message: error?.message || "Internal Server Error",
      });
    }
    return Response.json(
      {
        success: false,
        message: error?.message || "Internal Server Error",
      },
      { status: 500 }
    );
  }
}

