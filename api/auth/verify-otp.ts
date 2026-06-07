import axios from "axios";
import admin from "firebase-admin";

if (!admin.apps.length) {
  try {
    admin.initializeApp();
  } catch (e) {
    console.warn("Firebase Admin missing credentials, custom token generation will fail unless set.", e);
  }
}

export default async function handler(req: any, res: any) {
  // CORS
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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let { phone, code } = req.body;
  if (!phone || !code) {
    return res.status(400).json({ success: false, error: "Phone and code are required" });
  }

  phone = phone.replace('+', '');

  if (!process.env.MSG91_AUTH_KEY) {
    return res.status(500).json({ success: false, error: "MSG91 auth key is not configured" });
  }

  try {
    const response = await axios.get(
      `https://control.msg91.com/api/v5/otp/verify?otp=${code}&mobile=${phone}`,
      {
        headers: {
          authkey: process.env.MSG91_AUTH_KEY
        }
      }
    );

    // MSG91 returns { "message": "OTP verified success", "type": "success" } or "error"
    if (response.data.type === "success" || response.data.message === "OTP verified success" || response.data.message === "OTP verified successfully") {
      // Find or create user in Firebase Auth
      let uid = "";
      try {
        const userRecord = await admin.auth().getUserByPhoneNumber(phone);
        uid = userRecord.uid;
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          const newUser = await admin.auth().createUser({
            phoneNumber: phone,
          });
          uid = newUser.uid;
        } else {
          throw error;
        }
      }

      // Generate Custom Token for frontend to sign in
      const customToken = await admin.auth().createCustomToken(uid);
      
      return res.json({ success: true, customToken });
    } else {
      return res.status(400).json({ success: false, error: "Invalid OTP code" });
    }
  } catch (error: any) {
    console.error("MSG91 verify-otp error:", error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.response?.data?.message || error.message || "Failed to verify OTP" });
  }
}
