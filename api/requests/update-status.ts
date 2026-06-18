import admin from "firebase-admin";
import { verifyAuth, getCorsHeaders, createNotification, sendEmailNotification, handleNodeRequest } from "../utils";

export async function POST(req: Request) {
  try {
    console.log("Request received");

    // 1. Parse request body safely
    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      console.log("Request body: (empty or invalid JSON)");
      console.log("Order ID: undefined");
      console.log("User ID: undefined");
      return Response.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    console.log("Request body:", body);
    console.log("Order ID:", body.orderId || "N/A");
    console.log("User ID:", body.userId || "N/A");

    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: getCorsHeaders()
      });
    }
    if (req.method !== 'POST') {
      return Response.json(
        { error: 'Method not allowed' },
        { status: 405, headers: getCorsHeaders() }
      );
    }

    // 2. Perform token authentication
    let decodedToken;
    try {
      decodedToken = await verifyAuth(req);
    } catch (authError: any) {
      console.error("Auth error:", authError);
      return Response.json(
        { success: false, error: authError.message || "Unauthorized" },
        { 
          status: authError.message?.includes("Configuration") ? 500 : 401, 
          headers: getCorsHeaders() 
        }
      );
    }

    const { requestId, status, adminNotes, refundAmount, refundMethod, refundTransactionId, estimatedCompletionDate } = body;
    
    if (!requestId || typeof requestId !== 'string' || !requestId.trim()) {
      return Response.json(
        { success: false, error: "Request ID is required." },
        { status: 400, headers: getCorsHeaders() }
      );
    }
    if (!status || typeof status !== 'string' || !status.trim()) {
      return Response.json(
        { success: false, error: "Status is required." },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    let isAdmin = false;
    if (decodedToken.email === 'vk311779@gmail.com' && decodedToken.email_verified) {
      isAdmin = true;
    } else {
      try {
        const userDoc = await admin.firestore().collection("users").doc(decodedToken.uid).get();
        if (userDoc.exists && userDoc.data()?.role === 'admin') isAdmin = true;
      } catch (e) {
        console.error("Error fetching user role", e);
      }
    }
    
    if (!isAdmin) {
      return Response.json(
        { success: false, error: "Unauthorized: Admins only" },
        { status: 403, headers: getCorsHeaders() }
      );
    }

    const db = admin.firestore();
    const reqRef = db.collection("requests").doc(requestId);
    const reqDoc = await reqRef.get();

    if (!reqDoc.exists) {
      return Response.json(
        { success: false, error: "Request not found" },
        { status: 404, headers: getCorsHeaders() }
      );
    }

    const rData = reqDoc.data()!;
    const oldStatus = rData.status;
    const orderId = rData.orderId;
    const type = rData.type || rData.requestType;
    const customerId = rData.customerId || rData.userId;

    const orderRef = db.collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();
    
    if (!orderDoc.exists) {
      return Response.json(
        { success: false, error: "Order not found" },
        { status: 404, headers: getCorsHeaders() }
      );
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

    // Execute database updates
    const isCancellationStockRestore = type === 'cancellation' && 
                                        (status === 'approved' || status === 'cancelled') && 
                                        !(oldStatus === 'approved' || oldStatus === 'cancelled');

    if (isCancellationStockRestore) {
      await db.runTransaction(async (transaction) => {
        const oDoc = await transaction.get(orderRef);
        if (oDoc.exists) {
          const oData = oDoc.data()!;
          const productDocs = [];
          for (const item of oData.items) {
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
            statusHistory: admin.firestore.FieldValue.arrayUnion({
              status: "cancelled",
              timestamp: new Date().toISOString(),
              message: "Cancellation approved by admin"
            })
          });
        }
      });
    } else {
      // Sync Order updates based on status transitions
      let orderUpdates: any = {};
      let statusHistoryMessage = "";

      if (type === 'cancellation') {
        if (status === 'rejected') {
          orderUpdates.status = 'confirmed';
          statusHistoryMessage = "Cancellation request rejected by admin";
        } else if (status === 'refund_initiated') {
          orderUpdates.paymentStatus = 'refund_initiated';
          statusHistoryMessage = "Refund initiated for cancellation";
        } else if (status === 'refund_completed') {
          orderUpdates.status = 'cancelled';
          orderUpdates.paymentStatus = 'refunded';
          statusHistoryMessage = "Refund completed successfully";
        }
      } 
      else if (type === 'return') {
        if (status === 'approved') {
          orderUpdates.status = 'return_approved';
          statusHistoryMessage = "Return approved by admin";
        } else if (status === 'pickup_scheduled') {
          orderUpdates.status = 'return_pickup_scheduled';
          statusHistoryMessage = "Return pickup scheduled";
        } else if (status === 'product_received') {
          orderUpdates.status = 'return_received';
          statusHistoryMessage = "Return product received at warehouse";
        } else if (status === 'quality_check') {
          orderUpdates.status = 'return_quality_checked';
          statusHistoryMessage = "Quality check completed successfully";
        } else if (status === 'refund_initiated') {
          orderUpdates.paymentStatus = 'refund_initiated';
          statusHistoryMessage = "Refund initiated for return";
        } else if (status === 'refund_completed' || status === 'refund_processed') {
          orderUpdates.status = 'returned';
          orderUpdates.paymentStatus = 'refunded';
          statusHistoryMessage = "Refund completed successfully";
        } else if (status === 'rejected') {
          orderUpdates.status = 'delivered';
          statusHistoryMessage = "Return request rejected by admin";
        }
      } 
      else if (type === 'refund') {
        if (status === 'under_review') {
          statusHistoryMessage = "Refund request under review";
        } else if (status === 'approved') {
          orderUpdates.status = 'refund_approved';
          statusHistoryMessage = "Refund approved by admin";
        } else if (status === 'processing') {
          statusHistoryMessage = "Refund processing initiated";
        } else if (status === 'refund_sent') {
          orderUpdates.paymentStatus = 'refund_initiated';
          statusHistoryMessage = "Refund sent/initiated";
        } else if (status === 'refunded' || status === 'refund_completed') {
          orderUpdates.status = 'refunded';
          orderUpdates.paymentStatus = 'refunded';
          statusHistoryMessage = "Refund completed successfully";
        } else if (status === 'rejected') {
          statusHistoryMessage = "Refund request rejected by admin";
        }
      }

      if (statusHistoryMessage) {
        orderUpdates.statusHistory = admin.firestore.FieldValue.arrayUnion({
          status: `req_${status}`,
          timestamp: new Date().toISOString(),
          message: statusHistoryMessage
        });
      }

      if (Object.keys(orderUpdates).length > 0) {
        await orderRef.update(orderUpdates);
      }
    }

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

    return Response.json(
      { success: true, message: `Request ${status} successfully` },
      { headers: getCorsHeaders() }
    );
  } catch (error: any) {
    console.error("FULL ERROR:", error);
    console.error("STACK:", error.stack);

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
