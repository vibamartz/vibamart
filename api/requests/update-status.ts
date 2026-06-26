import admin from "firebase-admin";
import { initializeFirebaseAdmin, verifyAuth, setCorsHeaders, createNotification, sendEmailNotification, getErrorLocation } from "../utils";

initializeFirebaseAdmin();

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
    const body = req.body || {};
    console.log("Request body:", body);
    console.log("Order ID:", body.orderId || "N/A");
    console.log("User ID:", body.userId || "N/A");

    // 2. Perform token authentication
    let decodedToken;
    try {
      decodedToken = await verifyAuth(req);
    } catch (authError: any) {
      console.error("Auth error:", authError);
      return res.status(authError.message?.includes("Configuration") ? 500 : 401).json({
        success: false,
        error: authError.message || "Unauthorized"
      });
    }

    const { requestId, status, adminNotes, refundAmount, refundMethod, refundTransactionId, estimatedCompletionDate } = body;
    
    if (!requestId || typeof requestId !== 'string' || !requestId.trim()) {
      return res.status(400).json({ success: false, error: "Request ID is required." });
    }
    if (!status || typeof status !== 'string' || !status.trim()) {
      return res.status(400).json({ success: false, error: "Status is required." });
    }

    let isAdmin = false;
    if (decodedToken.email === 'vk311779@gmail.com' && decodedToken.email_verified) {
      isAdmin = true;
    } else {
      try {
        console.log(`[FIRESTORE READ] Fetching user document from 'users' collection. Document ID: ${decodedToken.uid}`);
        const userDoc = await admin.firestore().collection("users").doc(decodedToken.uid).get();
        if (userDoc.exists && userDoc.data()?.role === 'admin') isAdmin = true;
      } catch (e) {
        console.error("Error fetching user role", e);
      }
    }
    
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: "Unauthorized: Admins only" });
    }

    const db = admin.firestore();
    
    console.log(`[FIRESTORE READ] Fetching cancellation request from 'cancellation_requests' collection. Document ID: ${requestId}`);
    let reqDoc;
    let type = "cancellation";
    let collectionName = "cancellation_requests";
    try {
      reqDoc = await db.collection("cancellation_requests").doc(requestId).get();
    } catch (error: any) {
      console.error("FULL ERROR:", error);
      console.error(error.stack);
      return res.status(500).json({ success: false, error: "FUNCTION_INVOCATION_FAILED", message: error.message });
    }
    
    if (!reqDoc.exists) {
      console.log(`[FIRESTORE READ] Fetching return request from 'return_requests' collection. Document ID: ${requestId}`);
      type = "return";
      collectionName = "return_requests";
      try {
        reqDoc = await db.collection("return_requests").doc(requestId).get();
      } catch (error: any) {
        console.error("FULL ERROR:", error);
        console.error(error.stack);
        return res.status(500).json({ success: false, error: "FUNCTION_INVOCATION_FAILED", message: error.message });
      }
    }
    
    if (!reqDoc.exists) {
      console.log(`[FIRESTORE READ] Fetching refund request from 'refund_requests' collection. Document ID: ${requestId}`);
      type = "refund";
      collectionName = "refund_requests";
      try {
        reqDoc = await db.collection("refund_requests").doc(requestId).get();
      } catch (error: any) {
        console.error("FULL ERROR:", error);
        console.error(error.stack);
        return res.status(500).json({ success: false, error: "FUNCTION_INVOCATION_FAILED", message: error.message });
      }
    }
    
    if (!reqDoc.exists) {
      return res.status(404).json({ success: false, error: "Request not found" });
    }

    const rData = reqDoc.data()!;
    const oldStatus = rData.status;
    const orderId = rData.customOrderId || rData.orderId;
    
    let customerId = "";
    if (rData.contactEmail) {
      try {
        const userRecord = await admin.auth().getUserByEmail(rData.contactEmail);
        customerId = userRecord.uid;
      } catch (authErr) {
        console.warn("Could not find user by email for notification:", authErr);
      }
    }
    if (!customerId) {
      customerId = rData.userId || rData.customerId || "";
    }

    const reqRef = db.collection(collectionName).doc(requestId);

    console.log(`[FIRESTORE READ] Fetching order document from 'orders' collection. Document ID: ${orderId}`);
    const orderRef = db.collection("orders").doc(orderId);
    let orderDoc;
    try {
      orderDoc = await orderRef.get();
    } catch (error: any) {
      console.error("FULL ERROR:", error);
      console.error(error.stack);
      return res.status(500).json({ success: false, error: "FUNCTION_INVOCATION_FAILED", message: error.message });
    }
    
    if (!orderDoc.exists) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }
    const orderData = orderDoc.data()!;

    const updateData: any = { 
      status,
      updatedAt: new Date().toISOString(),
      updatedDate: new Date().toISOString()
    };
    
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
    if (refundAmount !== undefined) updateData.refundAmount = Number(refundAmount);
    if (refundMethod !== undefined) updateData.refundMethod = refundMethod;
    if (refundTransactionId !== undefined) updateData.refundTransactionId = refundTransactionId;
    if (estimatedCompletionDate !== undefined) updateData.estimatedCompletionDate = estimatedCompletionDate;

    const normalizedStatus = status.toLowerCase();
    const normalizedOldStatus = oldStatus?.toLowerCase() || "";

    // Execute database updates
    const isCancellationStockRestore = type === 'cancellation' && 
                                        (normalizedStatus === 'approved' || normalizedStatus === 'cancelled' || normalizedStatus === 'processed') && 
                                        !(normalizedOldStatus === 'approved' || normalizedOldStatus === 'cancelled' || normalizedOldStatus === 'processed');

    if (isCancellationStockRestore) {
      console.log(`[FIRESTORE WRITE] Executing transaction for stock restoration on order cancellation approval. Order ID: ${orderId}`);
      await db.runTransaction(async (transaction) => {
        console.log(`[FIRESTORE READ] (Transaction) Fetching order document from 'orders' collection. Document ID: ${orderId}`);
        const oDoc = await transaction.get(orderRef);
        if (oDoc.exists) {
          const oData = oDoc.data()!;
          const productDocs = [];
          for (const item of oData.items) {
            const productRef = db.collection("products").doc(item.productId);
            console.log(`[FIRESTORE READ] (Transaction) Fetching product document from 'products' collection. Product ID: ${item.productId}`);
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
            console.log(`[FIRESTORE WRITE] (Transaction) Updating product stock in 'products' collection. Product ID: ${prodUpdate.ref.id}`);
            transaction.update(prodUpdate.ref, prodUpdate.updates);
          }
          
          const orderTransactionUpdates = {
            status: "cancelled",
            statusHistory: admin.firestore.FieldValue.arrayUnion({
              status: "cancelled",
              timestamp: new Date().toISOString(),
              message: "Cancellation approved by admin"
            })
          };
          console.log(`[FIRESTORE WRITE] (Transaction) Updating order document in 'orders' collection. Document ID: ${orderId}`);
          transaction.update(orderRef, orderTransactionUpdates);
        }
      });
    } else {
      // Sync Order updates based on status transitions
      let orderUpdates: any = {};
      let statusHistoryMessage = "";

      if (type === 'cancellation') {
        if (normalizedStatus === 'rejected') {
          orderUpdates.status = 'confirmed';
          statusHistoryMessage = "Cancellation request rejected by admin";
        } else if (normalizedStatus === 'refund_initiated') {
          orderUpdates.paymentStatus = 'refund_initiated';
          statusHistoryMessage = "Refund initiated for cancellation";
        } else if (normalizedStatus === 'refund_completed' || normalizedStatus === 'processed') {
          orderUpdates.status = 'cancelled';
          orderUpdates.paymentStatus = 'refunded';
          statusHistoryMessage = "Refund completed / request processed successfully";
        }
      } 
      else if (type === 'return') {
        if (normalizedStatus === 'approved') {
          orderUpdates.status = 'return_approved';
          statusHistoryMessage = "Return approved by admin";
        } else if (normalizedStatus === 'pickup_scheduled') {
          orderUpdates.status = 'return_pickup_scheduled';
          statusHistoryMessage = "Return pickup scheduled";
        } else if (normalizedStatus === 'product_received') {
          orderUpdates.status = 'return_received';
          statusHistoryMessage = "Return product received at warehouse";
        } else if (normalizedStatus === 'quality_check') {
          orderUpdates.status = 'return_quality_checked';
          statusHistoryMessage = "Quality check completed successfully";
        } else if (normalizedStatus === 'refund_initiated') {
          orderUpdates.paymentStatus = 'refund_initiated';
          statusHistoryMessage = "Refund initiated for return";
        } else if (normalizedStatus === 'refund_completed' || normalizedStatus === 'refund_processed' || normalizedStatus === 'processed') {
          orderUpdates.status = 'returned';
          orderUpdates.paymentStatus = 'refunded';
          statusHistoryMessage = "Refund completed / request processed successfully";
        } else if (normalizedStatus === 'rejected') {
          orderUpdates.status = 'delivered';
          statusHistoryMessage = "Return request rejected by admin";
        }
      } 
      else if (type === 'refund') {
        if (normalizedStatus === 'under_review') {
          statusHistoryMessage = "Refund request under review";
        } else if (normalizedStatus === 'approved') {
          orderUpdates.status = 'refund_approved';
          statusHistoryMessage = "Refund approved by admin";
        } else if (normalizedStatus === 'processing') {
          statusHistoryMessage = "Refund processing initiated";
        } else if (normalizedStatus === 'refund_sent') {
          orderUpdates.paymentStatus = 'refund_initiated';
          statusHistoryMessage = "Refund sent/initiated";
        } else if (normalizedStatus === 'refunded' || normalizedStatus === 'refund_completed' || normalizedStatus === 'processed') {
          orderUpdates.status = 'refunded';
          orderUpdates.paymentStatus = 'refunded';
          statusHistoryMessage = "Refund completed / request processed successfully";
        } else if (normalizedStatus === 'rejected') {
          statusHistoryMessage = "Refund request rejected by admin";
        }
      }

      if (statusHistoryMessage) {
        orderUpdates.statusHistory = admin.firestore.FieldValue.arrayUnion({
          status: `req_${normalizedStatus}`,
          timestamp: new Date().toISOString(),
          message: statusHistoryMessage
        });
      }

      if (Object.keys(orderUpdates).length > 0) {
        console.log(`[FIRESTORE WRITE] Updating order document in 'orders' collection. Document ID: ${orderId}. Updates:`, JSON.stringify(orderUpdates));
        await orderRef.update(orderUpdates);
      }
    }

    console.log(`[FIRESTORE WRITE] Updating request document in '${collectionName}' collection. Document ID: ${requestId}. Updates:`, JSON.stringify(updateData));
    await reqRef.update(updateData);

    // Trigger Notifications and Email
    const customerEmail = orderData.contactEmail || decodedToken.email;
    const customerName = orderData.contactName || "Customer";
    const finalRefundAmount = refundAmount || rData.refundAmount || orderData.total || 0;

    let notifTitle = "";
    let notifMessage = "";
    let emailSubject = "";
    let emailBody = "";

    if (status === 'approved' || status === 'cancelled') {
      notifTitle = "Request Approved";
      notifMessage = `Your ${type} request for order #${orderId} has been approved.`;
      emailSubject = `${type.charAt(0).toUpperCase() + type.slice(1)} Request Approved`;
      emailBody = `Your ${type} request for order #${orderId} has been approved. ` + 
                  (type === 'return' ? "Please pack the items, our delivery partner will pick them up soon." : "We are processing your refund.");
    } else if (status === 'rejected') {
      notifTitle = "Request Rejected";
      notifMessage = `Your ${type} request for order #${orderId} has been rejected.`;
      emailSubject = `${type.charAt(0).toUpperCase() + type.slice(1)} Request Rejected`;
      emailBody = `Your ${type} request for order #${orderId} has been rejected. Admin Notes: ${adminNotes || 'None'}`;
    } else if (status === 'refund_initiated' || status === 'refund_sent' || status === 'processing') {
      notifTitle = "Refund Initiated";
      notifMessage = `Refund of ₹${finalRefundAmount} for order #${orderId} has been initiated.`;
      emailSubject = "Refund Initiated";
      emailBody = `Your refund of ₹${finalRefundAmount} for order #${orderId} has been initiated. Method: ${refundMethod || 'Original Payment Method'}. Estimated completion date: ${estimatedCompletionDate || 'N/A'}.`;
    } else if (status === 'refund_completed' || status === 'refunded' || status === 'refund_processed') {
      notifTitle = "Refund Completed";
      notifMessage = `Refund of ₹${finalRefundAmount} for order #${orderId} has been completed successfully.`;
      emailSubject = "Refund Processed Successfully";
      emailBody = `Your refund of ₹${finalRefundAmount} for order #${orderId} has been successfully completed. Transaction ID: ${refundTransactionId || 'N/A'}. Thank you for shopping with us!`;
    } else if (status === 'pickup_scheduled') {
      notifTitle = "Return Pickup Scheduled";
      notifMessage = `Pickup has been scheduled for return request on order #${orderId}.`;
    } else if (status === 'product_received') {
      notifTitle = "Return Product Received";
      notifMessage = `We have received your return product for order #${orderId}.`;
    } else if (status === 'quality_check') {
      notifTitle = "Quality Check In Progress";
      notifMessage = `Quality check is being performed on your returned items for order #${orderId}.`;
    }

    if (notifTitle) {
      await createNotification(customerId, notifTitle, notifMessage, orderId);
    }

    if (emailSubject && customerEmail) {
      await sendEmailNotification(customerEmail, customerName, emailSubject, emailBody);
    }

    return res.status(200).json({ success: true, message: `Request ${status} successfully` });
  } catch (error: any) {
    console.error("Update Status Error:", error);
    const errorMessage = error?.message || String(error) || "Internal Server Error";
    if (res && typeof res.status === 'function') {
      return res.status(500).json({
        success: false,
        error: errorMessage,
        message: errorMessage,
      });
    }
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        message: errorMessage,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

