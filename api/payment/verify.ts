import { setCorsHeaders } from "../utils";

export default async function handler(req: any, res: any) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Mock Razorpay verification
  res.json({ success: true, message: "Payment verified" });
}
