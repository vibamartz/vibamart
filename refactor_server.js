const fs = require('fs');

async function runRefactor() {
  let content = fs.readFileSync('c:/Users/vk311/Downloads/viba-mart/server.ts', 'utf-8');

  const target_cancel = `  // Orders: Cancel Order
  app.post("/api/orders/cancel", verifyAuth, async (req, res) => {
    const { orderId, reason } = req.body;
    const uid = (req as any).user.uid;

    if (!orderId || !reason) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    try {
      const db = admin.firestore();
      const orderRef = db.collection("orders").doc(orderId);
      
      await db.runTransaction(async (transaction) => {
        const orderDoc = await transaction.get(orderRef);
        if (!orderDoc.exists) {
          throw new Error("Order not found");
        }

        const orderData = orderDoc.data()!;
        if (orderData.customerId !== uid) {
          throw new Error("Unauthorized to cancel this order");
        }

        const allowedStatuses = ["pending", "confirmed", "packed"];
        if (!allowedStatuses.includes(orderData.status)) {
          throw new Error(\`Cannot cancel order in \${orderData.status} status\`);
        }

        // Check if manual cancellation is enabled
        const settingsDoc = await transaction.get(db.collection("settings").doc("store"));
        const enableManualCancellation = settingsDoc.exists && settingsDoc.data()?.enableManualCancellation === true;

        if (enableManualCancellation) {
          transaction.update(orderRef, {
            status: "cancel_requested",
            cancellationReason: reason,
            statusHistory: admin.firestore.FieldValue.arrayUnion({
              status: "cancel_requested",
              timestamp: new Date().toISOString(),
              message: "Cancellation requested by customer"
            })
          });
        } else {
          // Restore stock
          for (const item of orderData.items) {
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
            cancellationReason: reason,
            statusHistory: admin.firestore.FieldValue.arrayUnion({
              status: "cancelled",
              timestamp: new Date().toISOString(),
              message: "Cancelled by customer"
            })
          });
        }
      });

      // Fetch email and send confirmation
      const orderDoc = await orderRef.get();
      const orderData = orderDoc.data()!;
      const customerEmail = orderData.contactEmail || (req as any).user.email;
      
      if (customerEmail) {
        const isPlaceholder = !process.env.SMTP_USER || process.env.SMTP_USER === "your-email@gmail.com" || process.env.SMTP_USER === "test";
        const settingsDoc = await db.collection("settings").doc("store").get();
        const enableManualCancellation = settingsDoc.exists && settingsDoc.data()?.enableManualCancellation === true;

        const emailHtml = \`<h2>Hello \${orderData.contactName || 'Customer'},</h2>
        <p>Your order <strong>#\${orderId}</strong> cancellation request has been \${enableManualCancellation ? 'received and is pending approval' : 'successfully processed'}.</p>
        <p>Reason: \${reason}</p>
        \${!enableManualCancellation ? '<p>If you paid online, your refund will be processed within 5-7 business days.</p>' : ''}\`;
        
        if (process.env.SMTP_HOST && !isPlaceholder) {
          await transporter.sendMail({
            from: \`"ViBa Mart" <\${process.env.SMTP_USER}>\`,
            to: customerEmail,
            subject: "Order Cancellation Confirmation",
            html: emailHtml,
          });
        } else {
          console.log(\`[DEVELOPMENT] Cancellation email for \${customerEmail}:\\n\${emailHtml}\`);
        }
      }

      res.json({ success: true, message: "Order cancelled successfully" });
    } catch (error: any) {
      console.error("Cancel order error:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to cancel order" });
    }
  });`;

  const replacement_cancel = `  // Orders: Cancel Order
  app.post("/api/orders/cancel", verifyAuth, async (req, res) => {
    const { orderId, reason } = req.body;
    const uid = (req as any).user.uid;

    if (!orderId || !reason) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    try {
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
        return res.status(400).json({ success: false, error: \`Cannot cancel order in \${orderData.status} status\` });
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
          for (const item of orderData.items) {
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
      const customerEmail = orderData.contactEmail || (req as any).user.email;
      if (customerEmail) {
        const isPlaceholder = !process.env.SMTP_USER || process.env.SMTP_USER === "your-email@gmail.com" || process.env.SMTP_USER === "test";

        const emailHtml = \`<h2>Hello \${orderData.contactName || 'Customer'},</h2>
        <p>Your order <strong>#\${orderId}</strong> cancellation request has been \${enableManualCancellation ? 'received and is pending approval' : 'successfully processed'}.</p>
        <p>Reason: \${reason}</p>
        \${!enableManualCancellation ? '<p>If you paid online, your refund will be processed within 5-7 business days.</p>' : ''}\`;
        
        if (process.env.SMTP_HOST && !isPlaceholder) {
          await transporter.sendMail({
            from: \`"ViBa Mart" <\${process.env.SMTP_USER}>\`,
            to: customerEmail,
            subject: "Order Cancellation Confirmation",
            html: emailHtml,
          });
        } else {
          console.log(\`[DEVELOPMENT] Cancellation email for \${customerEmail}:\\n\${emailHtml}\`);
        }
      }

      res.json({ success: true, message: "Order cancelled successfully", requestId: docRef.id });
    } catch (error: any) {
      console.error("Cancel order error:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to cancel order" });
    }
  });`;

  const target_returns = `  // Returns: Request Return
  app.post("/api/returns/request", verifyAuth, async (req, res) => {
    const { orderId, reason, comments, images, productIds } = req.body;
    const uid = (req as any).user.uid;

    if (!orderId || !reason || !images || images.length === 0) {
      return res.status(400).json({ success: false, error: "Missing required fields (orderId, reason, images)" });
    }

    try {
      const db = admin.firestore();
      const orderRef = db.collection("orders").doc(orderId);
      const orderDoc = await orderRef.get();
      
      if (!orderDoc.exists) {
        return res.status(404).json({ success: false, error: "Order not found" });
      }
      
      const orderData = orderDoc.data()!;
      if (orderData.customerId !== uid) {
        return res.status(403).json({ success: false, error: "Unauthorized" });
      }
      
      if (orderData.status !== "delivered") {
        return res.status(400).json({ success: false, error: "Only delivered orders can be returned" });
      }

      const settingsDoc = await db.collection("settings").doc("store").get();
      const returnWindowDays = settingsDoc.exists && settingsDoc.data()?.returnWindowDays ? settingsDoc.data()?.returnWindowDays : 7;
      
      const deliveredStatus = orderData.statusHistory?.find((s: any) => s.status === "delivered");
      const deliveryDate = deliveredStatus ? new Date(deliveredStatus.timestamp) : new Date(orderData.createdAt); 
      
      const windowMs = returnWindowDays * 24 * 60 * 60 * 1000;
      if (Date.now() - deliveryDate.getTime() > windowMs) {
        return res.status(400).json({ success: false, error: "Return window has expired" });
      }

      const existingReturns = await db.collection("returns").where("orderId", "==", orderId).get();
      const newProducts = productIds || orderData.items.map((i: any) => i.productId);
      let overlap = false;
      existingReturns.forEach(doc => {
        const existingProducts = doc.data().productIds || [];
        if (existingProducts.some((id: string) => newProducts.includes(id))) {
          overlap = true;
        }
      });
      if (overlap) {
        return res.status(400).json({ success: false, error: "A return request already exists for one or more selected items" });
      }

      let calculatedRefund = 0;
      orderData.items.forEach((item: any) => {
        if (newProducts.includes(item.productId)) {
          calculatedRefund += (item.price * item.quantity);
        }
      });

      const returnDoc = {
        orderId,
        userId: uid,
        reason,
        comments: comments || "",
        images,
        productIds: newProducts,
        status: "requested",
        createdAt: new Date().toISOString(),
        refundAmount: calculatedRefund
      };

      const docRef = await db.collection("returns").add(returnDoc);
      
      const customerEmail = orderData.contactEmail || (req as any).user.email;
      if (customerEmail) {
        const isPlaceholder = !process.env.SMTP_USER || process.env.SMTP_USER === "your-email@gmail.com" || process.env.SMTP_USER === "test";
        const emailHtml = \`<h2>Hello \${orderData.contactName || 'Customer'},</h2>
        <p>We have received your return request for order <strong>#\${orderId}</strong>.</p>
        <p>Our team will review the details and images provided within 48 hours.</p>\`;
        
        if (process.env.SMTP_HOST && !isPlaceholder) {
          await transporter.sendMail({
            from: \`"ViBa Mart" <\${process.env.SMTP_USER}>\`,
            to: customerEmail,
            subject: "Return Request Received",
            html: emailHtml,
          });
        }
      }

      res.json({ success: true, returnId: docRef.id });
    } catch (error: any) {
      console.error("Return request error:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to submit return request" });
    }
  });`;

  const replacement_returns = `  // Returns: Request Return
  app.post("/api/returns/request", verifyAuth, async (req, res) => {
    const { orderId, reason, comments, images, productIds } = req.body;
    const uid = (req as any).user.uid;

    if (!orderId || !reason || !images || images.length === 0) {
      return res.status(400).json({ success: false, error: "Missing required fields (orderId, reason, images)" });
    }

    try {
      const db = admin.firestore();
      const orderRef = db.collection("orders").doc(orderId);
      const orderDoc = await orderRef.get();
      
      if (!orderDoc.exists) {
        return res.status(404).json({ success: false, error: "Order not found" });
      }
      
      const orderData = orderDoc.data()!;
      if (orderData.customerId !== uid) {
        return res.status(403).json({ success: false, error: "Unauthorized" });
      }
      
      if (orderData.status !== "delivered") {
        return res.status(400).json({ success: false, error: "Only delivered orders can be returned" });
      }

      const settingsDoc = await db.collection("settings").doc("store").get();
      const returnWindowDays = settingsDoc.exists && settingsDoc.data()?.returnWindowDays ? settingsDoc.data()?.returnWindowDays : 7;
      
      const deliveredStatus = orderData.statusHistory?.find((s: any) => s.status === "delivered");
      const deliveryDate = deliveredStatus ? new Date(deliveredStatus.timestamp) : new Date(orderData.createdAt); 
      
      const windowMs = returnWindowDays * 24 * 60 * 60 * 1000;
      if (Date.now() - deliveryDate.getTime() > windowMs) {
        return res.status(400).json({ success: false, error: "Return window has expired" });
      }

      const existingReturns = await db.collection("requests").where("orderId", "==", orderId).where("type", "==", "return").get();
      const newProducts = productIds || orderData.items.map((i: any) => i.productId);
      let overlap = false;
      existingReturns.forEach(doc => {
        const existingProducts = doc.data().productIds || [];
        if (existingProducts.some((id: string) => newProducts.includes(id))) {
          overlap = true;
        }
      });
      if (overlap) {
        return res.status(400).json({ success: false, error: "A return request already exists for one or more selected items" });
      }

      let calculatedRefund = 0;
      orderData.items.forEach((item: any) => {
        if (newProducts.includes(item.productId)) {
          calculatedRefund += (item.price * item.quantity);
        }
      });

      const returnDoc = {
        orderId,
        userId: uid,
        type: 'return',
        reason,
        comments: comments || "",
        images,
        productIds: newProducts,
        status: "requested",
        createdAt: new Date().toISOString(),
        refundAmount: calculatedRefund
      };

      const docRef = await db.collection("requests").add(returnDoc);
      
      const customerEmail = orderData.contactEmail || (req as any).user.email;
      if (customerEmail) {
        const isPlaceholder = !process.env.SMTP_USER || process.env.SMTP_USER === "your-email@gmail.com" || process.env.SMTP_USER === "test";
        const emailHtml = \`<h2>Hello \${orderData.contactName || 'Customer'},</h2>
        <p>We have received your return request for order <strong>#\${orderId}</strong>.</p>
        <p>Our team will review the details and images provided within 48 hours.</p>\`;
        
        if (process.env.SMTP_HOST && !isPlaceholder) {
          await transporter.sendMail({
            from: \`"ViBa Mart" <\${process.env.SMTP_USER}>\`,
            to: customerEmail,
            subject: "Return Request Received",
            html: emailHtml,
          });
        }
      }

      res.json({ success: true, returnId: docRef.id });
    } catch (error: any) {
      console.error("Return request error:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to submit return request" });
    }
  });

  // Refunds: Request Refund
  app.post("/api/refunds/request", verifyAuth, async (req, res) => {
    const { orderId, reason, comments } = req.body;
    const uid = (req as any).user.uid;

    if (!orderId || !reason) {
      return res.status(400).json({ success: false, error: "Missing required fields (orderId, reason)" });
    }

    try {
      const db = admin.firestore();
      const orderRef = db.collection("orders").doc(orderId);
      const orderDoc = await orderRef.get();
      
      if (!orderDoc.exists) {
        return res.status(404).json({ success: false, error: "Order not found" });
      }
      
      const orderData = orderDoc.data()!;
      if (orderData.customerId !== uid) {
        return res.status(403).json({ success: false, error: "Unauthorized" });
      }
      
      // Allow refund if cancelled or returned but not yet refunded
      if (orderData.status !== "cancelled" && orderData.status !== "returned") {
        return res.status(400).json({ success: false, error: "Only cancelled or returned orders are eligible for refund" });
      }

      if (orderData.paymentStatus === "refunded") {
        return res.status(400).json({ success: false, error: "Order is already refunded" });
      }

      const existingRefunds = await db.collection("requests").where("orderId", "==", orderId).where("type", "==", "refund").get();
      if (!existingRefunds.empty) {
        return res.status(400).json({ success: false, error: "A refund request already exists for this order" });
      }

      const refundDoc = {
        userId: uid,
        orderId,
        type: 'refund',
        reason,
        comments: comments || "",
        status: "requested",
        createdAt: new Date().toISOString(),
        refundAmount: orderData.total
      };

      const docRef = await db.collection("requests").add(refundDoc);
      res.json({ success: true, requestId: docRef.id });
    } catch (error: any) {
      console.error("Refund request error:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to submit refund request" });
    }
  });`;

  if (content.includes(target_cancel)) {
    content = content.replace(target_cancel, replacement_cancel);
  } else {
    console.log('Could not find ' + 'target_cancel');
  }

  if (content.includes(target_returns)) {
    content = content.replace(target_returns, replacement_returns);
  } else {
    console.log('Could not find ' + 'target_returns');
  }

  fs.writeFileSync('c:/Users/vk311/Downloads/viba-mart/server.ts', content);

}

runRefactor();
