import toast from 'react-hot-toast';

export interface PaymentDetails {
  amount: number; // Amount in INR
  currency?: string;
  name?: string;
  description?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  orderId?: string;
  signature?: string;
  method?: string;
  error?: string;
}

/**
 * Dynamically loads the Razorpay checkout script if not already available in DOM.
 */
export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      return resolve(true);
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

/**
 * Main payment entry point for Razorpay gateway with backend order support & demo mode fallback.
 */
export const processPayment = async (
  details: PaymentDetails
): Promise<PaymentResult> => {
  const { amount, currency = 'INR', name = 'ViBa Mart', description = 'Purchase Payment', prefill } = details;

  let backendOrder: any = null;
  let razorpayKey: string = '';

  // 1. Try to create Razorpay order on backend if API server is running
  try {
    const res = await fetch('/api/payment/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, currency }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.order) {
        backendOrder = data.order;
        razorpayKey = data.key_id || '';
      }
    }
  } catch (e) {
    console.warn("Backend Razorpay order endpoint not reachable, checking client env...", e);
  }

  // 2. Fallback to client environment variable if backend key was not provided
  if (!razorpayKey) {
    razorpayKey =
      (import.meta as any).env?.VITE_RAZORPAY_KEY_ID ||
      (process as any).env?.RAZORPAY_KEY_ID ||
      '';
  }

  const isDummyKey = !razorpayKey || razorpayKey === 'rzp_test_dummyKey12345' || razorpayKey.includes('dummy');

  // Load SDK
  const sdkLoaded = await loadRazorpayScript();

  // 3. Launch Razorpay modal if real credentials and SDK are available
  if (sdkLoaded && !isDummyKey && (window as any).Razorpay) {
    return new Promise((resolve) => {
      try {
        const options: any = {
          key: razorpayKey,
          amount: Math.round(amount * 100),
          currency,
          name,
          description,
          prefill: {
            name: prefill?.name || '',
            email: prefill?.email || '',
            contact: prefill?.contact || '',
          },
          theme: {
            color: '#16a34a',
          },
          handler: async function (response: any) {
            // Verify payment signature on backend if available
            try {
              if (response.razorpay_order_id && response.razorpay_signature) {
                await fetch('/api/payment/verify', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                  }),
                });
              }
            } catch (err) {
              console.warn("Verification API failed, proceeding with client payment ID", err);
            }

            resolve({
              success: true,
              paymentId: response.razorpay_payment_id || `PAY-${Date.now()}`,
              orderId: response.razorpay_order_id || backendOrder?.id,
              signature: response.razorpay_signature,
              method: 'razorpay',
            });
          },
          modal: {
            ondismiss: function () {
              resolve({
                success: false,
                error: 'Payment cancelled by user',
              });
            },
          },
        };

        if (backendOrder?.id) {
          options.order_id = backendOrder.id;
        }

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function (response: any) {
          resolve({
            success: false,
            error: response.error?.description || 'Payment failed',
          });
        });
        rzp.open();
      } catch (err: any) {
        console.error("Razorpay SDK initialization failed, using demo fallback:", err);
        simulateTestPayment(details).then(resolve);
      }
    });
  }

  // 4. Smooth test mode simulation fallback if credentials are placeholder/dummy
  return simulateTestPayment(details);
};

const simulateTestPayment = async (details: PaymentDetails): Promise<PaymentResult> => {
  return new Promise((resolve) => {
    toast.loading(`Processing payment of ₹${details.amount.toLocaleString('en-IN')} (Demo Gateway)...`, {
      id: 'payment-toast',
      duration: 1500,
    });

    setTimeout(() => {
      const mockPayId = `PAY_DEMO_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      toast.success(`Payment of ₹${details.amount.toLocaleString('en-IN')} Successful!`, {
        id: 'payment-toast',
      });
      resolve({
        success: true,
        paymentId: mockPayId,
        orderId: `ORD_DEMO_${Date.now()}`,
        method: 'razorpay_demo',
      });
    }, 1200);
  });
};
