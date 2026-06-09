import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";

admin.initializeApp();

export const onNewOrderAdminNotification = functions.firestore.onDocumentCreated("orders/{orderId}", async (event: any) => {
  const snapshot = event.data;
  if (!snapshot) {
    console.error("No data associated with the event");
    return;
  }

  const orderId = event.params.orderId;

  console.log(`New order detected: ${orderId}`);
});
