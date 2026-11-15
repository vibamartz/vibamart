import dotenv from "dotenv";
dotenv.config();

import nodemailer from "nodemailer";
import { initializeFirebaseAdmin } from "../../_utils";
import { storeOtp } from "../../_otpStore";

initializeFirebaseAdmin();

// Transporter cache to avoid TLS negotiation latency on every single request
let cachedTransporters: {
  primary: nodemailer.Transporter;
  fallback587: nodemailer.Transporter;
  fallback465: nodemailer.Transporter;
  user: string;
  pass: string;
} | null = null;

function getTransporters(smtpUser: string, smtpPass: string, smtpHost: string) {
  if (
    cachedTransporters &&
    cachedTransporters.user === smtpUser &&
    cachedTransporters.pass === smtpPass
  ) {
    return cachedTransporters;
  }

  const cleanPass = smtpPass.replace(/\s+/g, "");

  // 1. Primary: Dedicated Gmail service
  const primary = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: smtpUser,
      pass: cleanPass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  // 2. Fallback STARTTLS (Port 587)
  const fallback587 = nodemailer.createTransport({
    host: smtpHost || "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: smtpUser,
      pass: cleanPass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  // 3. Fallback SSL (Port 465)
  const fallback465 = nodemailer.createTransport({
    host: smtpHost || "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: smtpUser,
      pass: cleanPass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  cachedTransporters = {
    primary,
    fallback587,
    fallback465,
    user: smtpUser,
    pass: smtpPass,
  };

  return cachedTransporters;
}

export default async function handler(req: any, res: any) {
  // Ensure standard Express response helper methods exist across all runtimes
  if (typeof res.status !== "function") {
    res.status = function (code: number) {
      res.statusCode = code;
      return res;
    };
  }
  if (typeof res.json !== "function") {
    res.json = function (data: any) {
      if (!res.headersSent) {
        res.setHeader("Content-Type", "application/json");
      }
      res.end(JSON.stringify(data));
      return res;
    };
  }

  // CORS configuration
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  // Parse request body across Express, Vite, and serverless streams
  let body = req.body;
  if (!body && typeof req.on === "function") {
    body = await new Promise((resolve) => {
      let data = "";
      req.on("data", (chunk: any) => {
        data += chunk;
      });
      req.on("end", () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (e) {
          resolve({});
        }
      });
      req.on("error", () => resolve({}));
    });
  } else if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ success: false, error: "Invalid JSON request body" });
    }
  }

  const { email } = body || {};
  if (!email || typeof email !== "string") {
    return res.status(400).json({ success: false, error: "A valid email address is required" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      error: "Please enter a valid Gmail address (e.g. name@gmail.com)",
    });
  }

  // Retrieve & normalize SMTP credentials
  const smtpUser = (process.env.SMTP_USER || "").trim();
  const rawPass = (process.env.SMTP_PASS || "").replace(/^["']|["']$/g, "").trim();
  const smtpPass = rawPass.replace(/\s+/g, "");
  const smtpHost = (process.env.SMTP_HOST || "smtp.gmail.com").trim();

  const isConfigured =
    smtpUser &&
    smtpPass &&
    smtpUser !== "your-email@gmail.com" &&
    smtpUser !== "test" &&
    !smtpUser.includes("example.com") &&
    smtpPass !== "your_smtp_password" &&
    smtpPass !== "test";

  if (!isConfigured) {
    console.error("[ViBa Mart Auth] Gmail SMTP credentials are not configured or are placeholder.");
    return res.status(500).json({
      success: false,
      error: "Email delivery service is currently not configured on the server. Please contact support.",
    });
  }

  try {
    // Generate secure 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in backend OTP store with 10 minutes expiry (TTL = 10 * 60 * 1000)
    storeOtp(normalizedEmail, otp, 10 * 60 * 1000);

    const transporters = getTransporters(smtpUser, smtpPass, smtpHost);

    const emailSubject = "Your ViBa Mart Login Verification Code";
    const emailText = `Your ViBa Mart verification code is: ${otp}\n\nThis verification code is valid for 10 minutes.\nNever share this code with anyone. ViBa Mart representatives will never ask for your verification code.\n\nIf you did not request this code, you can safely ignore this email.`;
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ViBa Mart Verification Code</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px;">
        <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 32px 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">ViBa Mart</h1>
            <p style="color: #dcfce7; margin: 6px 0 0 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px;">Account Verification</p>
          </div>
          
          <!-- Body -->
          <div style="padding: 32px 28px;">
            <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">Hello,</p>
            <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
              Use the single-use verification code below to securely log in to your ViBa Mart account:
            </p>
            
            <!-- OTP Box -->
            <div style="background-color: #f0fdf4; border: 2px dashed #86efac; border-radius: 14px; padding: 20px; text-align: center; margin: 0 0 24px 0;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; color: #15803d; letter-spacing: 12px; display: inline-block;">${otp}</span>
            </div>
            
            <!-- Expiry & Security Notice -->
            <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0;">
              ⏱️ This verification code is valid for <strong>10 minutes</strong>.
            </p>
            <p style="color: #dc2626; font-size: 12px; line-height: 1.5; margin: 0 0 24px 0; background-color: #fef2f2; padding: 10px 14px; border-radius: 8px;">
              🔒 <strong>Security Notice:</strong> Never share this code with anyone. ViBa Mart representatives will never ask for your verification code.
            </p>
            <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0;">
              If you did not request this login code, you can safely ignore this email.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center;">
            <p style="color: #94a3b8; font-size: 11px; margin: 0;">
              © ${new Date().getFullYear()} ViBa Mart. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"ViBa Mart" <${smtpUser}>`,
      to: normalizedEmail,
      replyTo: smtpUser,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
      headers: {
        "X-Entity-Ref-ID": Date.now().toString(),
      },
    };

    let sendSuccess = false;
    let lastError: any = null;

    // 1. Primary Attempt (Gmail Service)
    try {
      await transporters.primary.sendMail(mailOptions);
      sendSuccess = true;
      console.log(`[ViBa Mart] OTP email successfully sent to ${normalizedEmail}`);
    } catch (err: any) {
      console.warn(`[ViBa Mart] Primary transport error: ${err?.message || err}. Trying Port 587 fallback...`);
      lastError = err;

      // 2. Fallback Attempt (Port 587 STARTTLS)
      try {
        await transporters.fallback587.sendMail(mailOptions);
        sendSuccess = true;
        console.log(`[ViBa Mart] OTP email sent via 587 fallback to ${normalizedEmail}`);
      } catch (err2: any) {
        console.warn(`[ViBa Mart] 587 fallback error: ${err2?.message || err2}. Trying Port 465 fallback...`);
        lastError = err2;

        // 3. Fallback Attempt (Port 465 SSL)
        try {
          await transporters.fallback465.sendMail(mailOptions);
          sendSuccess = true;
          console.log(`[ViBa Mart] OTP email sent via 465 fallback to ${normalizedEmail}`);
        } catch (err3: any) {
          lastError = err3;
          console.error(`[ViBa Mart] All SMTP transports failed for ${normalizedEmail}: ${err3?.message || err3}`);
        }
      }
    }

    if (!sendSuccess) {
      const errorDetail = lastError?.message || "Delivery service timeout or network error";
      console.error(`[ViBa Mart] OTP delivery failed for ${normalizedEmail}: ${errorDetail}`);
      return res.status(500).json({
        success: false,
        error: "Failed to deliver OTP to your Gmail address. Please verify your email address and try again.",
      });
    }

    return res.json({
      success: true,
      message: "OTP has been sent to your Gmail address.",
    });
  } catch (error: any) {
    console.error("[ViBa Mart] Send Email OTP handler error:", error?.message || error);
    const errMsg = error?.message || "Failed to process OTP request";
    return res.status(500).json({
      success: false,
      error: errMsg,
    });
  }
}
