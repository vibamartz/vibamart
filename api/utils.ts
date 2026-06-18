import admin from "firebase-admin";
import nodemailer from "nodemailer";

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
    } else {
      console.error("CRITICAL: Firebase Admin credentials missing. Vercel will hang if we try to use default credentials.");
      adminInitError = "Missing FIREBASE_PRIVATE_KEY in environment variables.";
    }
  } catch (e: any) {
    console.error("Firebase Admin initialization failed:", e);
    adminInitError = e.message || String(e);
  }
}

export const verifyAuth = async (req: any, res: any) => {
  if (!admin.apps.length) {
    res.status(500).json({ 
      success: false, 
      error: `Server Configuration Error: Firebase Admin initialization failed. Details: ${adminInitError || 'Unknown error'}. Please check your Vercel Environment Variables.` 
    });
    return null;
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "Unauthorized: No token provided" });
    return null;
  }
  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    res.status(401).json({ success: false, error: "Unauthorized: Invalid token" });
    return null;
  }
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

