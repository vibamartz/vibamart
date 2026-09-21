import express from "express";
import rateLimit from "express-rate-limit";
import cancelHandler from "./orders/cancel.js";
import returnRequestHandler from "./returns/request.js";
import refundRequestHandler from "./refunds/request.js";
import updateStatusHandler from "./requests/update-status.js";
import sendEmailOtpHandler from "./auth/send-email-otp.js";
import verifyEmailOtpHandler from "./auth/verify-email-otp.js";
import deliveryNotificationHandler from "./notifications/delivery.js";
import registerTokenHandler from "./push/register-token.js";
import sendNotificationHandler from "./notifications/send.js";
import campaignsHandler from "./campaigns/manage.js";
import trackNotificationHandler from "./notifications/track.js";
import segmentsHandler from "./segments/index.js";
import createPaymentOrderHandler from "./payment/create-order.js";
import verifyPaymentHandler from "./payment/verify.js";
import { initializeFirebaseAdmin } from "./utils.js";

initializeFirebaseAdmin();

const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this IP, please try again later." }
});
app.use(limiter);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Health Check
app.get(["/api/health", "/health"], (req, res) => {
  res.json({ status: "ok", name: "ViBa Mart API" });
});

// Email OTP
app.post(["/api/auth/send-email-otp", "/auth/send-email-otp"], sendEmailOtpHandler);
app.post(["/api/auth/verify-email-otp", "/auth/verify-email-otp"], verifyEmailOtpHandler);

// Payments
app.post(["/api/payment/create-order", "/payment/create-order"], createPaymentOrderHandler);
app.post(["/api/payment/verify", "/payment/verify"], verifyPaymentHandler);

// Orders, Returns, Refunds, Requests & Notifications
app.post(["/api/orders/cancel", "/orders/cancel"], cancelHandler);
app.post(["/api/returns/request", "/returns/request"], returnRequestHandler);
app.post(["/api/refunds/request", "/refunds/request"], refundRequestHandler);
app.post(["/api/requests/update-status", "/requests/update-status"], updateStatusHandler);
app.post(["/api/notifications/delivery", "/notifications/delivery"], deliveryNotificationHandler);

// Push Notifications & AI Engagement Engine APIs
app.post(["/api/push/register", "/api/push/register-token", "/push/register-token"], registerTokenHandler);
app.post(["/api/notifications/send", "/notifications/send"], sendNotificationHandler);
app.all(["/api/campaigns/manage", "/campaigns/manage", "/api/campaigns/create"], campaignsHandler);
app.post(["/api/notifications/track", "/notifications/track"], trackNotificationHandler);
app.get(["/api/segments", "/segments"], segmentsHandler);

export default app;
