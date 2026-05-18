# ViBa Mart - Enterprise eCommerce Platform

ViBa Mart is a modern, full-stack eCommerce application built with a focus on speed, security, and a premium user experience.

## Tech Stack
- **Frontend**: React 18, Vite, Tailwind CSS, Framer Motion, Zustand
- **Backend**: Node.js (Express), Firebase (Firestore, Auth)
- **State Management**: Zustand
- **Styling**: Tailwind CSS with Premium Red Theme
- **Database**: Google Cloud Firestore (Enterprise Edition)

## Features
- **Authentication**: Firebase Google Login & Role-based Access Control.
- **Product Management**: Multi-vendor support with variants and stock control.
- **Ordering**: Full checkout flow with GST calculation and COD/UPI support.
- **Admin Dashboard**: Real-time analytics, inventory monitoring, and order management.
- **Performance**: Image optimization, lazy loading, and reactive UI updates.

## Installation & Setup
1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Configure your Firebase credentials in `firebase-applet-config.json`.
4. Run `npm run dev` to start the development server.
5. Use `npm run build` for production builds.

## API Endpoints
- `GET /api/health`: Health check for the backend.
- `POST /api/payment/verify`: Mock payment verification endpoint.

## Security
- **Firestore Rules**: Strict RBAC rules preventing unauthorized access.
- **Verification**: All write operations require verified email status.
- **Validation**: Strict schema validation for products and orders.
