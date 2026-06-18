import admin from "firebase-admin";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

let adminInitError: string | null = null;

if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PRIVATE_KEY !== 'paste_firebase_private_key_here') {
      let formattedKey = process.env.FIREBASE_PRIVATE_KEY;
      // Strip surrounding quotes if Vercel added them
      formattedKey = formattedKey.replace(/^"|"$/g, '');
      // Handle escaped newlines
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
      console.error("CRITICAL: Firebase Admin credentials missing. Vercel will hang if we try to use default credentials.");
      adminInitError = "Missing FIREBASE_PRIVATE_KEY in environment variables.";
    }
  } catch (e: any) {
    console.error("Firebase Admin initialization failed:", e);
    adminInitError = e.message || String(e);
  }
}

export const verifyAuth = async (req: any) => {
  if (!admin.apps.length) {
    throw new Error(`Server Configuration Error: Firebase Admin initialization failed. Details: ${adminInitError || 'Unknown error'}. Please check your Vercel Environment Variables.`);
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
  const isPlaceholder = !process.env.SMTP_USER || process.env.SMTP_USER === "your-email@gmail.com" || process.env.SMTP_USER === "test";
  if (!process.env.SMTP_HOST || isPlaceholder) {
    console.log(`[DEVELOPMENT] Email to ${toEmail} (${contactName}):\nSubject: ${subject}\nMessage: ${messageText}`);
    return;
  }
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.ethereal.email",
      port: Number(process.env.SMTP_PORT) || 587,
      auth: {
        user: process.env.SMTP_USER || "test",
        pass: process.env.SMTP_PASS || "test",
      },
      connectionTimeout: 2000,
      greetingTimeout: 2000,
      socketTimeout: 2000,
    });
    const emailHtml = `
      <h2>Hello ${contactName || 'Customer'},</h2>
      <p>${messageText}</p>
      <br/>
      <p>Best Regards,<br/>The ViBa Mart Team</p>
    `;
    
    const emailPromise = transporter.sendMail({
      from: `"ViBa Mart" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject,
      html: emailHtml,
    }).catch(err => {
      if (err.message !== "SMTP Connection Timeout") {
        console.error("Delayed SMTP error:", err);
      }
    });

    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("SMTP Connection Timeout")), 4000);
    });

    try {
      await Promise.race([emailPromise, timeoutPromise]);
      clearTimeout(timeoutId!);
      console.log(`Email successfully sent to ${toEmail}`);
    } catch (err) {
      clearTimeout(timeoutId!);
      throw err;
    }
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
