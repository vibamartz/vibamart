"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onNewOrderAdminNotification = void 0;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
const twilio_1 = __importDefault(require("twilio"));
admin.initializeApp();
const db = admin.firestore();
exports.onNewOrderAdminNotification = functions.firestore.onDocumentCreated("orders/{orderId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        console.error("No data associated with the event");
        return;
    }
    const orderData = snapshot.data();
    const orderId = event.params.orderId;
    console.log(`New order detected: ${orderId}`);
    // Fetch admin settings
    let adminSettings = {};
    try {
        const settingsDoc = await db.collection("settings").doc("admin").get();
        if (settingsDoc.exists) {
            adminSettings = settingsDoc.data() || {};
        }
    }
    catch (error) {
        console.error("Failed to fetch admin settings", error);
    }
    const customerName = orderData.contactName || orderData.address?.fullName || "Guest";
    const customerPhone = orderData.contactPhone || orderData.address?.phone || "N/A";
    const orderTotal = orderData.total || 0;
    const paymentMethod = orderData.paymentMethod || "N/A";
    const displayOrderId = orderData.customOrderId || orderId.slice(-8).toUpperCase();
    const smsMessage = `New Order Received - ViBa Mart\n\nOrder ID: ${displayOrderId}\nCustomer: ${customerName}\nMobile: ${customerPhone}\nAmount: ₹${orderTotal}\nPayment: ${paymentMethod}\n\nPlease check the Admin Dashboard.`;
    let smsStatus = "not_configured";
    // Try to send SMS if Twilio is configured with retry logic (up to 3 times)
    if (adminSettings.twilioAccountSid && adminSettings.twilioAuthToken && adminSettings.twilioPhoneNumber && adminSettings.adminPhoneNumber) {
        const client = (0, twilio_1.default)(adminSettings.twilioAccountSid, adminSettings.twilioAuthToken);
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
            }
            catch (error) {
                console.error(`Failed to send SMS on attempt ${attempts}`, error);
                smsStatus = "failed";
                if (attempts < maxAttempts) {
                    // Wait 2 seconds before retrying
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
    }
    else {
        console.log("Twilio credentials or admin phone number not fully configured in settings/admin. SMS not sent.");
    }
});
//# sourceMappingURL=index.js.map