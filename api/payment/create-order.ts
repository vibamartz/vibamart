import Razorpay from "razorpay";

export default async function handler(req, res) {
  // Add CORS headers for preflight requests if needed
  res.setHeader('Access-Control-Allow-Credentials', true);
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

  const { amount, currency } = req.body;
  try {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret || key_id === 'YOUR_RAZORPAY_KEY_ID' || key_secret === 'YOUR_RAZORPAY_KEY_SECRET') {
      throw new Error("Razorpay credentials are not configured in environment variables.");
    }

    const razorpay = new Razorpay({
      key_id,
      key_secret,
    });

    const options = {
      amount: Math.round(Number(amount) * 100), // amount in the smallest currency unit
      currency: currency || "INR",
      receipt: `receipt_${Date.now()}`,
    };
    
    console.log("Creating Razorpay order with options:", JSON.stringify(options));
    const order = await razorpay.orders.create(options);
    
    res.json({ success: true, order, key_id });
  } catch (error) {
    console.error("Razorpay Order Creation Error:", error);
    const isConfigError = error.message && error.message.includes("configured");
    res.status(isConfigError ? 401 : 500).json({ 
      success: false, 
      error: error.description || error.message || "Failed to create Razorpay order",
      code: error.code || "UNKNOWN_ERROR"
    });
  }
}
