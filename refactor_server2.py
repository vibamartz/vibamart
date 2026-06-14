import sys

with open('c:/Users/vk311/Downloads/viba-mart/server.ts', 'r', encoding='utf-8') as f:
    content = f.read()

target_update = '''  // Returns: Admin Update Status
  app.post("/api/returns/update-status", verifyAuth, async (req, res) => {
    const { returnId, status, adminNotes } = req.body;
    
    const decodedToken = (req as any).user;
    let isAdmin = false;
    if (decodedToken.email === 'vk311779@gmail.com' && decodedToken.email_verified) {
      isAdmin = true;
    } else {
      const userDoc = await admin.firestore().collection("users").doc(decodedToken.uid).get();
      if (userDoc.exists && userDoc.data()?.role === 'admin') isAdmin = true;
    }
    
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }

    try {
      const db = admin.firestore();
      const returnRef = db.collection("returns").doc(returnId);
      const returnDoc = await returnRef.get();
      
      if (!returnDoc.exists) {
        return res.status(404).json({ success: false, error: "Return not found" });
      }
      
      const updateData: any = { 
        status,
        updatedAt: new Date().toISOString()
      };
      
      if (adminNotes !== undefined) {
        updateData.adminNotes = adminNotes;
      }
      
      await returnRef.update(updateData);
      
      const rData = returnDoc.data()!;
      const orderDoc = await db.collection("orders").doc(rData.orderId).get();
      const orderData = orderDoc.data();

      if (status === 'refund_processed' && orderData) {
        await db.collection("orders").doc(rData.orderId).update({
          status: 'refunded',
          statusHistory: admin.firestore.FieldValue.arrayUnion({
            status: "refunded",
            timestamp: new Date().toISOString(),
            message: "Refund processed successfully"
          })
        });
      }

      if (orderData && (orderData.contactEmail || decodedToken.email)) {
        const customerEmail = orderData.contactEmail || decodedToken.email;
        let subject = "";
        let msg = "";
        if (status === 'approved') {
          subject = "Return Request Approved";
          msg = "Your return request has been approved. Please pack the items, our delivery partner will pick them up soon.";
        } else if (status === 'rejected') {
          subject = "Return Request Rejected";
          msg = "Unfortunately, your return request has been rejected. Please check your account for details.";
        } else if (status === 'refund_processed') {
          subject = "Refund Processed";
          msg = `Your refund of ₹${rData.refundAmount} has been processed to your original payment method.`;
        }

        if (subject) {
          const isPlaceholder = !process.env.SMTP_USER || process.env.SMTP_USER === "your-email@gmail.com" || process.env.SMTP_USER === "test";
          const emailHtml = `<h2>Hello ${orderData.contactName || 'Customer'},</h2><p>${msg}</p>`;
          if (process.env.SMTP_HOST && !isPlaceholder) {
            await transporter.sendMail({
              from: `"ViBa Mart" <${process.env.SMTP_USER}>`,
              to: customerEmail,
              subject,
              html: emailHtml,
            });
          }
        }
      }

      res.json({ success: true, message: "Status updated" });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });'''

replacement_update = '''  // Requests: Admin Update Status
  app.post("/api/requests/update-status", verifyAuth, async (req, res) => {
    const { requestId, status, adminNotes } = req.body;
    
    const decodedToken = (req as any).user;
    let isAdmin = false;
    if (decodedToken.email === 'vk311779@gmail.com' && decodedToken.email_verified) {
      isAdmin = true;
    } else {
      const userDoc = await admin.firestore().collection("users").doc(decodedToken.uid).get();
      if (userDoc.exists && userDoc.data()?.role === 'admin') isAdmin = true;
    }
    
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }

    try {
      const db = admin.firestore();
      const reqRef = db.collection("requests").doc(requestId);
      const reqDoc = await reqRef.get();
      
      if (!reqDoc.exists) {
        return res.status(404).json({ success: false, error: "Request not found" });
      }
      
      const updateData: any = { 
        status,
        updatedAt: new Date().toISOString()
      };
      
      if (adminNotes !== undefined) {
        updateData.adminNotes = adminNotes;
      }
      
      await reqRef.update(updateData);
      
      const rData = reqDoc.data()!;
      const orderDoc = await db.collection("orders").doc(rData.orderId).get();
      const orderData = orderDoc.data();

      // Process order changes based on request type
      if (rData.type === 'cancellation') {
          if (status === 'approved') {
              // restore stock
              await db.runTransaction(async (transaction) => {
                  const orderRef = db.collection("orders").doc(rData.orderId);
                  const oDoc = await transaction.get(orderRef);
                  if (oDoc.exists) {
                      const oData = oDoc.data()!;
                      for (const item of oData.items) {
                          const productRef = db.collection("products").doc(item.productId);
                          const productDoc = await transaction.get(productRef);
                          if (productDoc.exists) {
                              const pData = productDoc.data()!;
                              let newStock = (pData.stock || 0) + item.quantity;
                              let updates: any = { stock: newStock };
                              if (item.variantId && pData.variants) {
                                 const variantIndex = pData.variants.findIndex((v: any) => v.id === item.variantId);
                                 if (variantIndex !== -1) {
                                    let variants = [...pData.variants];
                                    variants[variantIndex].stock = (variants[variantIndex].stock || 0) + item.quantity;
                                    updates.variants = variants;
                                 }
                              }
                              transaction.update(productRef, updates);
                          }
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
          } else if (status === 'rejected') {
              await db.collection("orders").doc(rData.orderId).update({
                  status: "cancel_rejected",
                  statusHistory: admin.firestore.FieldValue.arrayUnion({
                      status: "cancel_rejected",
                      timestamp: new Date().toISOString(),
                      message: "Cancellation rejected by admin"
                  })
              });
          }
      } else if (rData.type === 'return') {
          if (status === 'refund_processed' && orderData) {
            await db.collection("orders").doc(rData.orderId).update({
              status: 'refunded',
              statusHistory: admin.firestore.FieldValue.arrayUnion({
                status: "refunded",
                timestamp: new Date().toISOString(),
                message: "Refund processed successfully"
              })
            });
          }
      } else if (rData.type === 'refund') {
          if (status === 'refunded' && orderData) {
            await db.collection("orders").doc(rData.orderId).update({
              status: 'refunded',
              paymentStatus: 'refunded',
              statusHistory: admin.firestore.FieldValue.arrayUnion({
                status: "refunded",
                timestamp: new Date().toISOString(),
                message: "Refund processed successfully"
              })
            });
          }
      }

      if (orderData && (orderData.contactEmail || decodedToken.email)) {
        const customerEmail = orderData.contactEmail || decodedToken.email;
        let subject = "";
        let msg = "";
        
        if (rData.type === 'cancellation') {
             if (status === 'approved') {
                 subject = "Order Cancellation Approved";
                 msg = "Your cancellation request has been approved. If you paid online, your refund will be processed shortly.";
             } else if (status === 'rejected') {
                 subject = "Order Cancellation Rejected";
                 msg = "Your cancellation request has been rejected.";
             }
        } else if (rData.type === 'return') {
            if (status === 'approved') {
              subject = "Return Request Approved";
              msg = "Your return request has been approved. Please pack the items, our delivery partner will pick them up soon.";
            } else if (status === 'rejected') {
              subject = "Return Request Rejected";
              msg = "Unfortunately, your return request has been rejected. Please check your account for details.";
            } else if (status === 'refund_processed') {
              subject = "Refund Processed";
              msg = `Your refund of ₹${rData.refundAmount} has been processed to your original payment method.`;
            }
        } else if (rData.type === 'refund') {
            if (status === 'refunded') {
              subject = "Refund Processed";
              msg = `Your refund of ₹${rData.refundAmount} has been processed to your original payment method.`;
            } else if (status === 'rejected') {
              subject = "Refund Request Rejected";
              msg = "Unfortunately, your refund request has been rejected.";
            }
        }

        if (subject) {
          const isPlaceholder = !process.env.SMTP_USER || process.env.SMTP_USER === "your-email@gmail.com" || process.env.SMTP_USER === "test";
          const emailHtml = `<h2>Hello ${orderData.contactName || 'Customer'},</h2><p>${msg}</p>`;
          if (process.env.SMTP_HOST && !isPlaceholder) {
            await transporter.sendMail({
              from: `"ViBa Mart" <${process.env.SMTP_USER}>`,
              to: customerEmail,
              subject,
              html: emailHtml,
            });
          }
        }
      }

      res.json({ success: true, message: "Status updated" });
    } catch (error: any) {
      console.error("Update request status error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });'''

if target_update in content:
    content = content.replace(target_update, replacement_update)
else:
    print("Could not find target_update")
    sys.exit(1)


with open('c:/Users/vk311/Downloads/viba-mart/server.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS")
