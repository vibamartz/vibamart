import admin from "firebase-admin";
import { verifyAuth, getCorsHeaders, createNotification, sendEmailNotification, handleNodeRequest, parseRequestBody } from "../utils";

export async function POST(req: any) {
  try {
    console.log("Request received");
    
    // Parse request body dynamically
    const body = await parseRequestBody(req);
    
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: getCorsHeaders()
      });
    }
    if (req.method !== 'POST') {
      return Response.json(
        { success: false, error: 'Method not allowed' },
        { status: 405, headers: getCorsHeaders() }
      );
    }

    if (!body || typeof body !== 'object') {
      return Response.json(
        { success: false, message: "Invalid JSON body" },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    const { orderId, userId, reason } = body;

    // 1. Validate fields exist before database operations
    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      return Response.json(
        { success: false, message: "Order ID missing" },
        { status: 400, headers: getCorsHeaders() }
      );
    }
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      return Response.json(
        { success: false, message: "User ID missing" },
        { status: 400, headers: getCorsHeaders() }
      );
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return Response.json(
        { success: false, message: "Cancellation reason missing" },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // 2. Perform authentication and validate customer
    let user;
    try {
      user = await verifyAuth(req);
    } catch (authError: any) {
      console.error("Auth error:", authError);
      return Response.json(
        { success: false, message: authError.message || "Unauthorized" },
        { 
          status: 401, 
          headers: getCorsHeaders() 
        }
      );
    }

    const uid = user?.uid;
    if (!uid) {
      return Response.json(
        { success: false, message: "Unauthorized" },
        { status: 401, headers: getCorsHeaders() }
      );
    }

    if (uid !== userId && uid !== 'admin') {
      return Response.json(
        { success: false, message: "Unauthorized user mapping" },
        { status: 403, headers: getCorsHeaders() }
      );
    }

    // 6. Add detailed logging
    console.log("Order ID:", orderId);
    console.log("User ID:", userId);
    console.log("Reason:", reason);

    const db = admin.firestore();
    const orderRef = db.collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) {
      return Response.json(
        { success: false, message: "Order not found" },
        { status: 404, headers: getCorsHeaders() }
      );
    }

    const orderData = orderDoc.data();
    if (!orderData) {
      return Response.json(
        { success: false, message: "Order data is null" },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    if (orderData.customerId !== uid && uid !== 'admin') {
      return Response.json(
        { success: false, message: "Unauthorized to cancel this order" },
        { status: 403, headers: getCorsHeaders() }
      );
    }

    const allowedStatuses = ["pending", "confirmed", "packed"];
    if (!allowedStatuses.includes(orderData.status)) {
      return Response.json(
        { success: false, message: `Cannot cancel order in ${orderData.status} status` },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Check for duplicate cancellation requests in the cancellation_requests collection
    const existingCancellations = await db.collection("cancellation_requests")
      .where("orderId", "==", orderId)
      .get();

    if (!existingCancellations.empty) {
      return Response.json(
        { success: false, message: "A duplicate cancellation request already exists for this order." },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Check if manual cancellation is enabled
    const settingsDoc = await db.collection("settings").doc("store").get();
    const enableManualCancellation = settingsDoc.exists && settingsDoc.data()?.enableManualCancellation === true;

    // 3. Save request data in Firestore (cancellation_requests) with the required fields
    const docRef = await db.collection("cancellation_requests").add({
      orderId: orderId,
      userId: userId,
      reason: reason,
      status: "Pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const requestId = docRef.id;

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
      const batch = db.batch();
      const productDocs = [];
      if (orderData.items && Array.isArray(orderData.items)) {
        for (const item of orderData.items) {
          if (!item.productId) continue;
          const productRef = db.collection("products").doc(item.productId);
          const productDoc = await productRef.get();
          productDocs.push({ item, productRef, productDoc });
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
      batch.update(orderRef, {
        status: "cancelled",
        cancellationReason: reason,
        statusHistory: admin.firestore.FieldValue.arrayUnion({
          status: "cancelled",
          timestamp: new Date().toISOString(),
          message: "Cancelled by customer"
        })
      });
      batch.update(db.collection("cancellation_requests").doc(requestId), {
        status: "Approved"
      });
      await batch.commit();
    }

    // 5. Safely execute notifications & emails without crashing the function
    try {
      const customerEmail = orderData.contactEmail || user?.email;
      const customerName = orderData.contactName || "Customer";

      const notificationPromises = [];

      if (enableManualCancellation) {
        notificationPromises.push(createNotification(
          uid,
          "Cancellation Request Submitted",
          `Your cancellation request for order #${orderId} has been submitted successfully.`,
          orderId
        ).catch(e => console.error("createNotification error:", e)));
        
        if (customerEmail) {
          notificationPromises.push(sendEmailNotification(
            customerEmail,
            customerName,
            "Order Cancellation Request Received",
            `We have received your cancellation request for order #${orderId}. Reason: ${reason}. It is currently pending review.`
          ).catch(e => console.error("sendEmailNotification error:", e)));
        }
      } else {
        notificationPromises.push(createNotification(
          uid,
          "Order Cancelled",
          `Your order #${orderId} has been cancelled successfully.`,
          orderId
        ).catch(e => console.error("createNotification error:", e)));
        
        if (customerEmail) {
          notificationPromises.push(sendEmailNotification(
            customerEmail,
            customerName,
            "Order Cancelled Successfully",
            `Your order #${orderId} has been successfully cancelled. If you paid online, your refund will be processed within 5-7 business days.`
          ).catch(e => console.error("sendEmailNotification error:", e)));
        }
      }

      notificationPromises.push(createNotification(
        "admin",
        "New Cancellation Request",
        `A new cancellation request was submitted for order #${orderId}.`,
        orderId
      ).catch(e => console.error("admin createNotification error:", e)));

      await Promise.allSettled(notificationPromises);
    } catch (notifyErr) {
      console.error("Notification service warning:", notifyErr);
    }

    return Response.json(
      { success: true, message: "Request submitted successfully", requestId },
      { headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error("Cancellation Error:", error);
    console.error(error.stack);

    return Response.json(
      {
        success: false,
        message: error.message || "Internal server error"
      },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export default async function handler(req: any, res?: any) {
  if (res && typeof res.status === 'function') {
    return handleNodeRequest(POST, req, res);
  }
  return POST(req);
}
