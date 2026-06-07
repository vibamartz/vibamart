import axios from "axios";

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

  let { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ success: false, error: "Phone number is required" });
  }

  phone = phone.replace('+', '');

  if (!process.env.MSG91_AUTH_KEY || !process.env.MSG91_TEMPLATE_ID) {
    return res.status(500).json({ success: false, error: "MSG91 credentials are not configured on the server" });
  }

  try {
    const response = await axios.post(
      `https://control.msg91.com/api/v5/otp?template_id=${process.env.MSG91_TEMPLATE_ID}&mobile=${phone}`,
      {},
      {
        headers: {
          authkey: process.env.MSG91_AUTH_KEY,
          "Content-Type": "application/json"
        }
      }
    );
    
    if (response.data.type === "success") {
      res.json({ success: true, status: "pending" });
    } else {
      throw new Error(response.data.message || "Failed to send OTP via MSG91");
    }
  } catch (error: any) {
    console.error("MSG91 send-otp error:", error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.response?.data?.message || error.message || "Failed to send OTP" });
  }
}
