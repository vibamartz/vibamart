import admin from "firebase-admin";
import { verifyAuth, setCorsHeaders } from "../utils";

export default async function handler(req: any, res: any) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const decodedToken = await verifyAuth(req, res);
  if (!decodedToken) return;

  const { requestId, status, adminNotes } = req.body;
  
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
    return res.status(403).json({ success: false, error: "Unauthorized: Admins only" });
  }

  if (!requestId || !status) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  try {
    const db = admin.firestore();
    const requestRef = db.collection("requests").doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      return res.status(404).json({ success: false, error: "Request not found" });
    }

    const data = requestDoc.data()!;
    const orderId = data.orderId;

    await db.runTransaction(async (transaction) => {
      const orderRef = db.collection("orders").doc(orderId);
      const orderDoc = await transaction.get(orderRef);
      
      let productDocs: any[] = [];
      if (orderDoc.exists && data.type === 'cancellation' && status === 'approved') {
        // Pre-fetch all products for stock restoration
        for (const item of orderDoc.data()!.items) {
          const productRef = db.collection("products").doc(item.productId);
          const productDoc = await transaction.get(productRef);
          productDocs.push({ item, productRef, productDoc });
        }
      }

      // Now do all writes
      transaction.update(requestRef, {
        status,
        adminNotes: adminNotes || null,
        updatedAt: new Date().toISOString()
      });

      if (orderDoc.exists) {
        let orderUpdates: any = {};
        
        if (data.type === 'cancellation') {
          if (status === 'approved') {
            orderUpdates.status = 'cancelled';
            orderUpdates.statusHistory = admin.firestore.FieldValue.arrayUnion({
              status: "cancelled",
              timestamp: new Date().toISOString(),
              message: "Cancellation approved by admin"
            });
            
            // Restore stock
            for (const { item, productRef, productDoc } of productDocs) {
              if (productDoc.exists) {
                const pData = productDoc.data()!;
                let newStock = (pData.stock || 0) + item.quantity;
                let productUpdates: any = { stock: newStock };
                
                if (item.variantId && pData.variants) {
                   const variantIndex = pData.variants.findIndex((v: any) => v.id === item.variantId);
                   if (variantIndex !== -1) {
                      let variants = [...pData.variants];
                      variants[variantIndex].stock = (variants[variantIndex].stock || 0) + item.quantity;
                      productUpdates.variants = variants;
                   }
                }
                transaction.update(productRef, productUpdates);
              }
            }
          } else if (status === 'rejected') {
            orderUpdates.status = 'confirmed'; // Revert to confirmed or previous status
            orderUpdates.statusHistory = admin.firestore.FieldValue.arrayUnion({
              status: "cancellation_rejected",
              timestamp: new Date().toISOString(),
              message: `Cancellation rejected: ${adminNotes || 'No reason provided'}`
            });
          }
        } 
        else if (data.type === 'return') {
          if (status === 'approved') {
            orderUpdates.status = 'return_approved';
            orderUpdates.statusHistory = admin.firestore.FieldValue.arrayUnion({
              status: "return_approved",
              timestamp: new Date().toISOString(),
              message: "Return approved by admin"
            });
          } else if (status === 'rejected') {
            orderUpdates.status = 'delivered'; // Revert to delivered
            orderUpdates.statusHistory = admin.firestore.FieldValue.arrayUnion({
              status: "return_rejected",
              timestamp: new Date().toISOString(),
              message: `Return rejected: ${adminNotes || 'No reason provided'}`
            });
          }
        }
        else if (data.type === 'refund') {
           if (status === 'approved') {
            orderUpdates.status = 'refund_approved';
            orderUpdates.statusHistory = admin.firestore.FieldValue.arrayUnion({
              status: "refund_approved",
              timestamp: new Date().toISOString(),
              message: "Refund approved by admin"
            });
          } else if (status === 'rejected') {
            orderUpdates.statusHistory = admin.firestore.FieldValue.arrayUnion({
              status: "refund_rejected",
              timestamp: new Date().toISOString(),
              message: `Refund rejected: ${adminNotes || 'No reason provided'}`
            });
          }
        }

        if (Object.keys(orderUpdates).length > 0) {
          transaction.update(orderRef, orderUpdates);
        }
      }
    });

    res.json({ success: true, message: `Request ${status} successfully` });
  } catch (error: any) {
    console.error("Update request status error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to update request status" });
  }
}
