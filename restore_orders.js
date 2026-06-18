import admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

async function run() {
  console.log("=== RESTORING DB SEED DATA ===");

  // 1. Fetch some actual products to link in the orders
  const productsSnap = await db.collection("products").limit(3).get();
  const activeProducts = [];
  productsSnap.forEach(doc => {
    activeProducts.push({ id: doc.id, ...doc.data() });
  });

  const dummyProduct = {
    id: "prod_dummy_default",
    name: "Standard ViBa Mart Product",
    price: 499,
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400"
  };

  const p1 = activeProducts[0] || dummyProduct;
  const p2 = activeProducts[1] || dummyProduct;
  const p3 = activeProducts[2] || dummyProduct;

  console.log("Using products for orders:", [p1.name, p2.name, p3.name]);

  const customerUid = "soVbJRAFkQfRxLQPO4i5QOWQEWr2";
  const customerEmail = "vishalart333@gmail.com";
  const adminUid = "DRGbTDsvrxQXUeMKCeG4MI2dUgP2";
  const adminEmail = "vk311779@gmail.com";

  // Address
  const customerAddress = {
    fullName: "Vishal Customer",
    phone: "9876543210",
    house: "A-12, Sector 4",
    street: "Main Ring Road",
    city: "New Delhi",
    state: "Delhi",
    country: "India",
    zip: "110001"
  };

  const ordersToRestore = [
    {
      id: "VBM202606050195",
      data: {
        customerId: customerUid,
        status: "return_requested",
        paymentStatus: "paid",
        paymentMethod: "razorpay",
        total: p1.price + p2.price,
        items: [
          { productId: p1.id, name: p1.name, price: p1.price, quantity: 1, image: p1.images?.[0] || p1.image || "" },
          { productId: p2.id, name: p2.name, price: p2.price, quantity: 1, image: p2.images?.[0] || p2.image || "" }
        ],
        address: customerAddress,
        contactEmail: customerEmail,
        contactName: "Vishal Customer",
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        hasReturnRequest: true,
        returnRequestId: "return_pending_VBM202606050195",
        statusHistory: [
          { status: "pending", timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), message: "Order placed" },
          { status: "delivered", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), message: "Delivered to customer" },
          { status: "return_requested", timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), message: "Return requested by customer" }
        ]
      }
    },
    {
      id: "VBM202606052897",
      data: {
        customerId: customerUid,
        status: "cancelled",
        paymentStatus: "failed",
        paymentMethod: "razorpay",
        total: p2.price * 2,
        items: [
          { productId: p2.id, name: p2.name, price: p2.price, quantity: 2, image: p2.images?.[0] || p2.image || "" }
        ],
        address: customerAddress,
        contactEmail: customerEmail,
        contactName: "Vishal Customer",
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        cancellationReason: "Incorrect delivery address",
        statusHistory: [
          { status: "pending", timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), message: "Order placed" },
          { status: "cancelled", timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), message: "Cancelled by customer" }
        ]
      }
    },
    {
      id: "QMZVqX8c01G1fG9hQOCi",
      data: {
        customerId: customerUid,
        status: "pending",
        paymentStatus: "pending",
        paymentMethod: "cod",
        total: p3.price,
        items: [
          { productId: p3.id, name: p3.name, price: p3.price, quantity: 1, image: p3.images?.[0] || p3.image || "" }
        ],
        address: customerAddress,
        contactEmail: customerEmail,
        contactName: "Vishal Customer",
        createdAt: new Date().toISOString(),
        statusHistory: [
          { status: "pending", timestamp: new Date().toISOString(), message: "Order placed (Cash on Delivery)" }
        ]
      }
    },

    {
      id: "4NQ9VFLfWugTmn1023nv",
      data: {
        customerId: adminUid,
        status: "returned",
        paymentStatus: "refunded",
        paymentMethod: "razorpay",
        total: p3.price * 2,
        items: [
          { productId: p3.id, name: p3.name, price: p3.price, quantity: 2, image: p3.images?.[0] || p3.image || "" }
        ],
        address: {
          fullName: "Store Admin",
          phone: "9999999999",
          house: "Admin Office",
          street: "ViBa Tower",
          city: "Mumbai",
          state: "Maharashtra",
          country: "India",
          zip: "400001"
        },
        contactEmail: adminEmail,
        contactName: "Store Admin",
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        hasReturnRequest: true,
        returnRequestId: "return_completed_4NQ9VFLfWugTmn1023nv",
        statusHistory: [
          { status: "pending", timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), message: "Order placed" },
          { status: "delivered", timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), message: "Delivered to admin" },
          { status: "return_requested", timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), message: "Return requested" },
          { status: "returned", timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), message: "Return processed and refunded" }
        ]
      }
    },
    {
      id: "VBM202606058888",
      data: {
        customerId: customerUid,
        status: "refund_requested",
        paymentStatus: "paid",
        paymentMethod: "razorpay",
        total: p1.price,
        items: [
          { productId: p1.id, name: p1.name, price: p1.price, quantity: 1, image: p1.images?.[0] || p1.image || "" }
        ],
        address: customerAddress,
        contactEmail: customerEmail,
        contactName: "Vishal Customer",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        hasRefundRequest: true,
        refundRequestId: "refund_pending_VBM202606058888",
        statusHistory: [
          { status: "pending", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), message: "Order placed" },
          { status: "cancelled", timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), message: "Order cancelled" },
          { status: "refund_requested", timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), message: "Refund requested by customer" }
        ]
      }
    },
    {
      id: "VBM202606057777",
      data: {
        customerId: customerUid,
        status: "refunded",
        paymentStatus: "refunded",
        paymentMethod: "razorpay",
        total: p2.price,
        items: [
          { productId: p2.id, name: p2.name, price: p2.price, quantity: 1, image: p2.images?.[0] || p2.image || "" }
        ],
        address: customerAddress,
        contactEmail: customerEmail,
        contactName: "Vishal Customer",
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        hasRefundRequest: true,
        refundRequestId: "refund_processed_VBM202606057777",
        statusHistory: [
          { status: "pending", timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), message: "Order placed" },
          { status: "cancelled", timestamp: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(), message: "Order cancelled" },
          { status: "refund_requested", timestamp: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(), message: "Refund requested" },
          { status: "refunded", timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), message: "Refund completed successfully" }
        ]
      }
    }
  ];

  const cancellationsToRestore = [
    {
      id: "cancel_approved_VBM202606052897",
      data: {
        orderId: "VBM202606052897",
        userId: customerUid,
        reason: "Incorrect delivery address",
        status: "Approved",
        createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 4 * 24 * 60 * 60 * 1000))
      }
    },

  ];

  const returnsToRestore = [
    {
      id: "return_pending_VBM202606050195",
      data: {
        orderId: "VBM202606050195",
        userId: customerUid,
        reason: "Item is damaged",
        status: "Pending",
        createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)),
        productIds: [p1.id],
        comments: "The shirt is torn at the seam.",
        images: ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400"],
        refundAmount: p1.price
      }
    },
    {
      id: "return_completed_4NQ9VFLfWugTmn1023nv",
      data: {
        orderId: "4NQ9VFLfWugTmn1023nv",
        userId: adminUid,
        reason: "Defective item",
        status: "Processed",
        createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
        productIds: [p3.id],
        comments: "One of the items stopped working after 1 day.",
        images: ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400"],
        refundAmount: p3.price * 2,
        refundMethod: "razorpay",
        refundTransactionId: "txn_ret_492042",
        adminNotes: "Return accepted. Refund processed successfully."
      }
    }
  ];

  const refundsToRestore = [
    {
      id: "refund_pending_VBM202606058888",
      data: {
        orderId: "VBM202606058888",
        userId: customerUid,
        reason: "Order cancelled before shipment",
        status: "Pending",
        createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)),
        comments: "Please refund my payment back to source account.",
        refundAmount: p1.price
      }
    },
    {
      id: "refund_processed_VBM202606057777",
      data: {
        orderId: "VBM202606057777",
        userId: customerUid,
        reason: "Order cancelled",
        status: "Processed",
        createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 9 * 24 * 60 * 60 * 1000)),
        comments: "Standard cancellation refund",
        refundAmount: p2.price,
        refundMethod: "razorpay",
        refundTransactionId: "pay_refund_123456",
        adminNotes: "Refund processed via Razorpay API automatically."
      }
    }
  ];

  // Restoring Orders
  for (const order of ordersToRestore) {
    console.log(`Writing order ${order.id}...`);
    await db.collection("orders").doc(order.id).set(order.data);
  }

  // Restoring Cancellation Requests
  for (const req of cancellationsToRestore) {
    console.log(`Writing cancellation request ${req.id}...`);
    await db.collection("cancellation_requests").doc(req.id).set(req.data);
  }

  // Restoring Return Requests
  for (const req of returnsToRestore) {
    console.log(`Writing return request ${req.id}...`);
    await db.collection("return_requests").doc(req.id).set(req.data);
  }

  // Restoring Refund Requests
  for (const req of refundsToRestore) {
    console.log(`Writing refund request ${req.id}...`);
    await db.collection("refund_requests").doc(req.id).set(req.data);
  }

  console.log("\nSuccess! Database restored with realistic order and request history data.");
}

run().catch(console.error);
