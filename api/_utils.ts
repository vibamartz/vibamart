import admin from "firebase-admin";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

let adminInitError: string | null = null;

export function isValidServiceAccount(): boolean {
  const pId = process.env.FIREBASE_PROJECT_ID;
  const email = process.env.FIREBASE_CLIENT_EMAIL;
  const key = process.env.FIREBASE_PRIVATE_KEY;
  if (!pId || !email || !key) return false;
  if (email.includes('your_firebase_client_email') || email.includes('your_project') || email === 'test') return false;
  if (key.includes('your_private_key') || key.includes('paste_firebase_private_key') || key.length < 50) return false;
  return true;
}

export function initializeFirebaseAdmin() {
  if (!admin.apps.length) {
    try {
      if (isValidServiceAccount()) {
        let formattedKey = process.env.FIREBASE_PRIVATE_KEY!;
        formattedKey = formattedKey.replace(/^"|"$/g, '');
        formattedKey = formattedKey.replace(/\\n/g, '\n');
        
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: formattedKey,
          }),
        });
        try {
          admin.firestore().settings({ preferRest: true, ignoreUndefinedProperties: true });
        } catch (e) {
          console.warn("Firestore settings already initialized or failed:", e);
        }
      } else {
        admin.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID || 'viba-mart'
        });
        try {
          admin.firestore().settings({ preferRest: true, ignoreUndefinedProperties: true });
        } catch (e) {}
      }
    } catch (e: any) {
      console.warn("Firebase Admin initialization notice:", e?.message || e);
      adminInitError = e?.message || String(e);
    }
  }
  return admin;
}

// Auto-run on import to preserve backward compatibility for modules that import utils
initializeFirebaseAdmin();

export interface StoredOtp {
  otp: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  used: boolean;
}

// Global in-memory fallback cache for OTPs across server requests
export const memoryOtpCache = new Map<string, StoredOtp>();

export function storeOtpInMemory(email: string, otp: string, durationMs: number = 5 * 60 * 1000) {
  const normalizedEmail = email.trim().toLowerCase();
  memoryOtpCache.set(normalizedEmail, {
    otp,
    createdAt: Date.now(),
    expiresAt: Date.now() + durationMs,
    attempts: 0,
    used: false,
  });
}

export function getOtpFromMemory(email: string): StoredOtp | null {
  const normalizedEmail = email.trim().toLowerCase();
  return memoryOtpCache.get(normalizedEmail) || null;
}

export function markOtpUsedInMemory(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const entry = memoryOtpCache.get(normalizedEmail);
  if (entry) {
    entry.used = true;
  }
}

export function deleteOtpFromMemory(email: string) {
  memoryOtpCache.delete(email.trim().toLowerCase());
}

export function isSmtpConfigured(): boolean {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return false;
  if (user === 'test' || user.includes('your-email') || user.includes('example.com')) return false;
  if (pass === 'test' || pass.includes('your_app_password')) return false;
  return true;
}

export function createMailTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER || '';
  const rawPass = process.env.SMTP_PASS || '';
  const cleanPass = rawPass.replace(/\s+/g, '');
  const isGmail = host.toLowerCase().includes('gmail') || user.toLowerCase().endsWith('@gmail.com');

  if (isGmail) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass: cleanPass,
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass: cleanPass,
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

export const verifyAuth = async (req: any) => {
  if (!admin.apps.length) {
    throw new Error(`Server Configuration Error: Firebase Admin initialization failed. Details: ${adminInitError || 'Unknown error'}. Please check your Environment Variables.`);
  }
  
  let authHeader = "";
  if (req && typeof req.headers?.get === 'function') {
    authHeader = req.headers.get("authorization") || "";
  } else if (req && req.headers && typeof req.headers === 'object') {
    authHeader = req.headers.authorization || "";
  }
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized: No token provided");
  }
  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    throw new Error("Unauthorized: Invalid token");
  }
};

export const getCorsHeaders = () => {
  return {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  };
};

export const setCorsHeaders = (req: any, res: any) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
};

export async function createNotification(userId: string, title: string, message: string, orderId?: string) {
  try {
    const db = admin.firestore();
    await db.collection("notifications").add({
      userId,
      title,
      message,
      read: false,
      createdAt: new Date().toISOString(),
      orderId: orderId || null
    });
  } catch (err) {
    console.error("Error creating database notification:", err);
  }
}

export async function sendEmailNotification(toEmail: string, contactName: string, subject: string, messageText: string) {
  if (!isSmtpConfigured()) {
    console.log(`[DEVELOPMENT] Email to ${toEmail} (${contactName}):\nSubject: ${subject}\nMessage: ${messageText}`);
    return;
  }
  try {
    const transporter = createMailTransporter();
    const emailHtml = `
      <h2>Hello ${contactName || 'Customer'},</h2>
      <p>${messageText}</p>
      <br/>
      <p>Best Regards,<br/>The ViBa Mart Team</p>
    `;
    
    await transporter.sendMail({
      from: `"ViBa Mart" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject,
      html: emailHtml,
    });
    console.log(`Email successfully sent to ${toEmail}`);
  } catch (err) {
    console.error("Error sending email notification:", err);
  }
}

export async function handleNodeRequest(
  webHandler: (req: Request) => Promise<Response>,
  req: any,
  res: any
) {
  try {
    setCorsHeaders(req, res);
    
    // Parse URL
    const protocol = req.protocol || 'http';
    const host = req.headers?.host || 'localhost';
    const url = `${protocol}://${host}${req.originalUrl || req.url || ''}`;

    // Read headers
    const headers = new Headers();
    if (req.headers && typeof req.headers === 'object') {
      for (const [key, value] of Object.entries(req.headers)) {
        if (value) {
          if (Array.isArray(value)) {
            value.forEach(v => headers.append(key, v));
          } else {
            headers.set(key, String(value));
          }
        }
      }
    }

    // Prepare body
    let requestBody: any = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (typeof req.body === 'object' && req.body !== null) {
        requestBody = JSON.stringify(req.body);
      } else if (req.body) {
        requestBody = req.body;
      }
    }

    const webReq = new Request(url, {
      method: req.method,
      headers: headers,
      body: requestBody,
    });

    const webRes = await webHandler(webReq);

    // Set CORS headers back on the response to make sure they're not overwritten
    const responseHeaders = getCorsHeaders();
    for (const [k, v] of Object.entries(responseHeaders)) {
      res.setHeader(k, v);
    }

    webRes.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    res.status(webRes.status);
    const text = await webRes.text();
    
    const contentType = webRes.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        res.json(JSON.parse(text));
        return;
      } catch (e) {
        // Fallback
      }
    }
    res.send(text);
  } catch (err: any) {
    console.error("Node request adapter error:", err);
    res.status(500).json({ success: false, error: err.message || "Internal Server Error" });
  }
}

export async function parseRequestBody(req: any): Promise<any> {
  if (!req) return {};
  if (typeof req.json === 'function') {
    try {
      return await req.json();
    } catch (e) {
      // Fallback
    }
  }
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (req.body && typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      // Fallback
    }
  }
  return {};
}

export function getErrorLocation(error: any) {
  const stack = error?.stack || "";
  const lines = stack.split("\n");
  for (const line of lines) {
    if (line.includes("node_modules") || line.includes("internal/") || line.includes("api/utils.ts")) continue;
    const match = line.match(/(?:at\s+)?(?:.*\s+\()?([^()]+):(\d+):(\d+)\)?/);
    if (match) {
      const filePath = match[1].trim();
      const lineNumber = match[2];
      const fileName = filePath.split(/[/\\]/).pop() || "unknown";
      return { file: fileName, line: Number(lineNumber), fullPath: filePath };
    }
  }
  return { file: "unknown", line: 0, fullPath: "unknown" };
}
