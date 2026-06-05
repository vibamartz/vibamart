import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import twilio from "twilio";

admin.initializeApp();
const db = admin.firestore();

export const onNewOrderAdminNotification = functions.firestore.onDocumentCreated("orders/{orderId}", async (event: any) => {
  const snapshot = event.data;
  if (!snapshot) {
    console.error("No data associated with the event");
    return;
  }

  const orderData = snapshot.data();
  const orderId = event.params.orderId;

  console.log(`New order detected: ${orderId}`);

  // Fetch admin settings
  let adminSettings: any = {};
  try {
    const settingsDoc = await db.collection("settings").doc("admin").get();
    if (settingsDoc.exists) {
      adminSettings = settingsDoc.data() || {};
    }
  } catch (error) {
    console.error("Failed to fetch admin settings", error);
  }

  const customerName = orderData.contactName || orderData.address?.fullName || "Guest";
  const customerPhone = orderData.contactPhone || orderData.address?.phone || "N/A";
  const orderTotal = orderData.total || 0;
  const paymentMethod = orderData.paymentMethod || "N/A";
  const displayOrderId = orderData.customOrderId || orderId.slice(-8).toUpperCase();

  const smsMessage = `New Order Received - ViBa Mart\n\nOrder ID: ${displayOrderId}\nCustomer: ${customerName}\nMobile: ${customerPhone}\nAmount: ₹${orderTotal}\nPayment: ${paymentMethod}\n\nPlease check the Admin Dashboard.`;

  let smsStatus: "sent" | "failed" | "not_configured" = "not_configured";

  // Try to send SMS if Twilio is configured with retry logic (up to 3 times)
  if (adminSettings.twilioAccountSid && adminSettings.twilioAuthToken && adminSettings.twilioPhoneNumber && adminSettings.adminPhoneNumber) {
    const client = twilio(adminSettings.twilioAccountSid, adminSettings.twilioAuthToken);
    
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts && smsStatus !== "sent") {
      attempts++;
      try {
        const message = await client.messages.create({
          body: smsMessage,
          from: adminSettings.twilioPhoneNumber,
          to: adminSettings.adminPhoneNumber
        });
        console.log(`SMS sent successfully on attempt ${attempts}. SID: ${message.sid}`);
        smsStatus = "sent";
      } catch (error: any) {
        console.error(`Failed to send SMS on attempt ${attempts}`, error);
        smsStatus = "failed";
        if (attempts < maxAttempts) {
          // Wait 2 seconds before retrying
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
  } else {
    console.log("Twilio credentials or admin phone number not fully configured in settings/admin. SMS not sent.");
  }
});
