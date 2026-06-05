async function logNotificationAttempt(
  projectId: string,
  apiKey: string | undefined,
  orderId: string,
  status: string,
  errorMessage?: string,
  numbers: string[] = []
) {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/notificationLogs${apiKey ? `?key=${apiKey}` : ''}`;
    const body = {
      fields: {
        orderId: { stringValue: orderId },
        status: { stringValue: status },
        error: { stringValue: errorMessage || "" },
        timestamp: { stringValue: new Date().toISOString() },
        numbers: {
          arrayValue: {
            values: numbers.map(num => ({ stringValue: num }))
          }
        }
      }
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      console.error("Failed to write notification log:", await response.text());
    }
  } catch (err) {
    console.error("Error writing notification log:", err);
  }
}

export default async function handler(req: any, res: any) {
  // Add CORS headers for preflight requests if needed
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderId, orderData } = req.body;

    if (!orderId || !orderData) {
      return res.status(400).json({ success: false, error: 'Missing order details' });
    }

    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'viba-mart-f46a4';
    const apiKey = process.env.VITE_FIREBASE_API_KEY;

    // 1. Fetch settings/storeConfig from Firestore REST API
    const storeConfigUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/settings/storeConfig${apiKey ? `?key=${apiKey}` : ''}`;
    
    let storeConfig: any = {};
    try {
      const configRes = await fetch(storeConfigUrl);
      if (configRes.ok) {
        const configData = await configRes.json();
        // Parse Firestore document format
        if (configData && configData.fields) {
          const fields = configData.fields;
          storeConfig = {
            enableWhatsappNotifications: fields.enableWhatsappNotifications?.booleanValue || false,
            whatsappNumbers: fields.whatsappNumbers?.arrayValue?.values?.map((v: any) => v.stringValue) || [],
          };
        }
      } else {
        console.warn("Could not fetch storeConfig from Firestore REST API:", await configRes.text());
      }
    } catch (err) {
      console.error("Error fetching store config:", err);
    }

    if (!storeConfig.enableWhatsappNotifications) {
      return res.status(200).json({ success: true, message: 'WhatsApp notifications are disabled.' });
    }

    const numbers = storeConfig.whatsappNumbers || [];
    if (numbers.length === 0) {
      return res.status(200).json({ success: true, message: 'No WhatsApp numbers configured.' });
    }

    // 1.5 Check for duplicate notifications
    const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery${apiKey ? `?key=${apiKey}` : ''}`;
    const checkQuery = {
      structuredQuery: {
        from: [{ collectionId: "notificationLogs" }],
        where: {
          compositeFilter: {
            op: "AND",
            filters: [
              {
                fieldFilter: {
                  field: { fieldPath: "orderId" },
                  op: "EQUAL",
                  value: { stringValue: orderId }
                }
              },
              {
                fieldFilter: {
                  field: { fieldPath: "status" },
                  op: "EQUAL",
                  value: { stringValue: "success" }
                }
              }
            ]
          }
        }
      }
    };

    try {
      const checkRes = await fetch(queryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkQuery)
      });
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        const hasSuccessLog = checkData && checkData.length > 0 && checkData[0].document;
        if (hasSuccessLog) {
          console.log(`Notification already sent successfully for order ${orderId}. Skipping to prevent duplicate.`);
          return res.status(200).json({ success: true, message: 'Notification already sent. Duplicate prevented.' });
        }
      }
    } catch (err) {
      console.error("Error checking for duplicate notifications:", err);
    }

    // 2. Format the message
    const formattedProducts = orderData.items.map((item: any) => `• ${item.name} × ${item.quantity}`).join('\n');
    
    // Format date properly
    const dateOpts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    const formattedDate = new Date(orderData.createdAt).toLocaleDateString('en-US', dateOpts);

    const messageText = `🛒 *New Order Received - ViBa Mart*

*Order ID:* #${orderId.startsWith('VBM') ? orderId : orderId.slice(-8).toUpperCase()}

*Customer Details:*
👤 Name: ${orderData.contactName || orderData.address.fullName || 'Guest'}
📞 Mobile: ${orderData.contactPhone || orderData.address.phone || 'N/A'}
📧 Email: ${orderData.contactEmail || 'N/A'}

*Delivery Address:*
🏠 ${orderData.address.house}, ${orderData.address.street}, ${orderData.address.city}, ${orderData.address.state} - ${orderData.address.zip}

*Products Ordered:*
${formattedProducts}

*Payment Details:*
💳 Payment Method: ${orderData.paymentMethod.toUpperCase()}
✅ Payment Status: ${orderData.paymentStatus.toUpperCase()}

*Order Total:*
₹${orderData.total.toLocaleString()}

*Order Time:*
${formattedDate}

Please process this order.`;

    // 3. Send WhatsApp Message via Meta Cloud API
    const token = process.env.WHATSAPP_API_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneId || token === 'YOUR_TOKEN' || phoneId === 'YOUR_PHONE_ID' || token === 'YOUR_WHATSAPP_API_TOKEN') {
      const msg = "WhatsApp API token or Phone Number ID not configured in backend environment variables.";
      console.warn(msg);
      await logNotificationAttempt(projectId, apiKey, orderId, "failed", msg, numbers);
      return res.status(200).json({ success: true, message: 'WhatsApp configuration missing in env. Simulated success.' });
    }

    try {
      const sendPromises = numbers.map(async (numStr: string) => {
        // Clean number (remove +, spaces, etc for Meta API)
        const cleanNum = numStr.replace(/\D/g, '');
        
        const payload = {
          messaging_product: 'whatsapp',
          to: cleanNum,
          type: 'text',
          text: { body: messageText }
        };

        const res = await fetch(`https://graph.facebook.com/v17.0/${phoneId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`WhatsApp API error: ${errText}`);
        }
        return res.json();
      });

      await Promise.all(sendPromises);
      await logNotificationAttempt(projectId, apiKey, orderId, "success", "", numbers);
      return res.status(200).json({ success: true, message: 'WhatsApp notification sent successfully.' });

    } catch (error: any) {
      console.error("WhatsApp Notification Error:", error);
      await logNotificationAttempt(projectId, apiKey, orderId, "failed", error.message || "Failed to send WhatsApp notification", numbers);
      throw error;
    }

  } catch (error: any) {
    console.error("WhatsApp Notification Handler Error:", error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to send WhatsApp notification"
    });
  }
}
