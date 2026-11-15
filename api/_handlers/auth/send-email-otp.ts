import dotenv from "dotenv";
dotenv.config();

import nodemailer from "nodemailer";
import { initializeFirebaseAdmin } from "../../_utils";
import { storeOtp } from "../../_otpStore";

initializeFirebaseAdmin();

/**
 * Creates configured Nodemailer transporters with multiple fallbacks for Gmail / SMTP delivery
 */
function createTransporters(smtpUser: string, smtpPass: string, smtpHost: string, smtpPort: number) {
  const isGmail = smtpHost === "smtp.gmail.com" || smtpUser.toLowerCase().endsWith("@gmail.com");

  // Primary: dedicated Gmail service or custom host
  const primaryTransporter = isGmail
    ? nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
      })
    : nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
      });

  // Secondary fallback: Direct SSL (Port 465)
  const sslTransporter = nodemailer.createTransport({
    host: isGmail ? "smtp.gmail.com" : smtpHost,
    port: 465,
    secure: true,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });

  // Tertiary fallback: STARTTLS (Port 587)
  const tlsTransporter = nodemailer.createTransport({
    host: isGmail ? "smtp.gmail.com" : smtpHost,
    port: smtpPort || 587,
    secure: false,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });

  return { primaryTransporter, sslTransporter, tlsTransporter };
}

export default async function handler(req: any, res: any) {
  // Ensure standard Express helper methods exist on res across all runtime environments
  if (typeof res.status !== 'function') {
    res.status = function(code: number) {
      res.statusCode = code;
      return res;
    };
  }
  if (typeof res.json !== 'function') {
    res.json = function(data: any) {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json');
      }
      res.end(JSON.stringify(data));
      return res;
    };
  }
  if (typeof res.send !== 'function') {
    res.send = function(data: any) {
      res.end(data);
      return res;
    };
  }

  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
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
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  let body = req.body;
  if (!body && typeof req.on === 'function') {
    body = await new Promise((resolve) => {
      let data = '';
      req.on('data', (chunk: any) => { data += chunk; });
      req.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (e) {
          resolve({});
        }
      });
      req.on('error', () => resolve({}));
    });
  } else if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {}
  }

  const { email } = body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, error: "A valid email address is required" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({ success: false, error: "Please provide a valid email format (e.g. name@gmail.com)" });
  }

  // Retrieve & normalize SMTP credentials (with default production Gmail credentials fallback)
  const smtpUser = (process.env.SMTP_USER || "vibamartz@gmail.com").replace(/^["']|["']$/g, "").trim();
  const rawPass = (process.env.SMTP_PASS || "cfca hvvx jsrq kzxk").replace(/^["']|["']$/g, "").trim();
  const smtpPass = rawPass.replace(/\s+/g, "");
  const smtpHost = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
  const smtpPort = Number(process.env.SMTP_PORT) || 587;

  const isPlaceholderSmtp =
    !smtpUser ||
    !smtpPass ||
    smtpUser === "your-email@gmail.com" ||
    smtpUser === "test" ||
    smtpUser.includes("example.com") ||
    smtpPass === "your_smtp_password" ||
    smtpPass === "test";

  if (isPlaceholderSmtp) {
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

    const { primaryTransporter, sslTransporter, tlsTransporter } = createTransporters(
      smtpUser,
      smtpPass,
      smtpHost,
      smtpPort
    );

    const emailSubject = "Your ViBa Mart Login Verification Code";
    const emailText = `Your ViBa Mart verification code is ${otp}. This code is valid for 10 minutes. Do not share this code with anyone.`;
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
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; color: #15803d; letter-spacing: 10px; display: inline-block;">${otp}</span>
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
      priority: 'high' as const,
      headers: {
        'X-Entity-Ref-ID': Date.now().toString(),
        'X-Priority': '1',
        'Importance': 'high',
      },
    };

    let sendSuccess = false;
    let lastError: any = null;

    // 1. Primary send attempt (dedicated service: "gmail")
    try {
      await primaryTransporter.sendMail(mailOptions);
      sendSuccess = true;
      console.log(`[ViBa Mart] OTP email successfully sent to ${normalizedEmail}`);
    } catch (primaryErr: any) {
      console.warn(`[ViBa Mart] Primary SMTP transport failed (${primaryErr?.message || primaryErr}), trying SSL transport...`);
      lastError = primaryErr;
      
      // 2. Secondary send attempt (direct SSL on port 465)
      try {
        await sslTransporter.sendMail(mailOptions);
        sendSuccess = true;
        console.log(`[ViBa Mart] OTP email successfully sent via SSL transport to ${normalizedEmail}`);
      } catch (sslErr: any) {
        lastError = sslErr;
        console.warn(`[ViBa Mart] SSL SMTP transport failed (${sslErr?.message || sslErr}), trying TLS transport...`);
        
        // 3. Tertiary send attempt (STARTTLS on port 587)
        try {
          await tlsTransporter.sendMail(mailOptions);
          sendSuccess = true;
          console.log(`[ViBa Mart] OTP email successfully sent via TLS transport to ${normalizedEmail}`);
        } catch (tlsErr: any) {
          lastError = tlsErr;
          console.error(`[ViBa Mart] All SMTP transports failed: ${tlsErr?.message || tlsErr}`);
        }
      }
    }

    if (!sendSuccess) {
      const errorDetail = lastError?.message || "Delivery service timeout or network error";
      console.error(`[ViBa Mart] OTP delivery failed for ${normalizedEmail}: ${errorDetail}`);
      return res.status(500).json({
        success: false,
        error: "Failed to deliver OTP to your Gmail address. Please check your email address and try again.",
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
