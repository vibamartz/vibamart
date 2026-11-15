import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { ToastType } from '../components/toast/types';

export type ToastModuleId =
  | 'auth'
  | 'cart'
  | 'checkout_orders'
  | 'products_catalog'
  | 'wishlist'
  | 'coupons_rewards'
  | 'returns_refunds'
  | 'invoices'
  | 'reviews'
  | 'admin_management'
  | 'hardware_permissions'
  | 'general';

export interface ToastModuleMeta {
  id: ToastModuleId;
  label: string;
  description: string;
}

export const TOAST_MODULES: ToastModuleMeta[] = [
  { id: 'auth', label: 'Authentication & Account', description: 'User login, registration, OTP verification, password reset, and profile updates.' },
  { id: 'cart', label: 'Cart & Bag', description: 'Adding items, quantity changes, removing items, stock validations, and clearing cart.' },
  { id: 'checkout_orders', label: 'Checkout & Orders', description: 'Order placement, Razorpay payment processing, order status updates, and tracking.' },
  { id: 'products_catalog', label: 'Products & Catalog', description: 'Product creation, editing, category configuration, stock levels, and search keywords.' },
  { id: 'wishlist', label: 'Wishlist & Saved', description: 'Adding and removing items from wishlist and saved for later lists.' },
  { id: 'coupons_rewards', label: 'Coupons, Cashback & Rewards', description: 'Promo codes, discount vouchers, scratch cards, loyalty reward points, and cashback claims.' },
  { id: 'returns_refunds', label: 'Returns, Cancellations & Refunds', description: 'Customer cancellation requests, return submissions, and bank/wallet refund processing.' },
  { id: 'invoices', label: 'Invoices & Billing', description: 'Tax invoice generation, PDF downloads, printing, and billing records.' },
  { id: 'reviews', label: 'Reviews & Ratings', description: 'Product reviews, vendor feedback, helpful ratings, and comment approvals.' },
  { id: 'admin_management', label: 'Admin & Store Management', description: 'Administrative settings, role assignments, category locks, and store preferences.' },
  { id: 'hardware_permissions', label: 'Device & Hardware Permissions', description: 'Browser permissions for camera, GPS location, microphone, Bluetooth, and push notifications.' },
  { id: 'general', label: 'General & Connectivity', description: 'Network offline/online status, clipboard copy, file uploads, and generic operational alerts.' }
];

export interface ToastNotificationConfigItem {
  id: string; // Unique configuration ID
  operationKey: string; // Identifier for application operation / match pattern
  matchPatterns: string[]; // List of strings or phrases that map to this notification
  module: ToastModuleId;
  type: ToastType; // 'success' | 'warning' | 'error'
  title: string; // Notification title
  message: string; // Displayed notification message
  enabled: boolean; // true = display toast; false = suppress toast
  description?: string; // Context for what this notification does / when it triggers
  isCustom?: boolean; // true if added by Admin, false if system default
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ToastNotificationSettingsDoc {
  messages: ToastNotificationConfigItem[];
  updatedAt: string;
  updatedBy?: string;
}

export const DEFAULT_TOAST_NOTIFICATIONS: ToastNotificationConfigItem[] = [
  // =================== AUTHENTICATION & ACCOUNT ===================
  {
    id: 'auth_login_success',
    operationKey: 'AUTH_LOGIN_SUCCESS',
    matchPatterns: ['Logged in successfully', 'Login successful', 'Welcome back'],
    module: 'auth',
    type: 'success',
    title: 'Welcome Back!',
    message: 'You have logged in successfully to ViBa Mart.',
    enabled: true,
    description: 'Triggered when a customer or admin logs in with valid credentials.',
    isCustom: false
  },
  {
    id: 'auth_login_failed',
    operationKey: 'AUTH_LOGIN_FAILED',
    matchPatterns: ['Invalid email or password', 'User not found', 'Wrong password', 'auth/invalid-credential'],
    module: 'auth',
    type: 'error',
    title: 'Authentication Failed',
    message: 'Invalid email or password. Please verify your credentials and try again.',
    enabled: true,
    description: 'Triggered when login credentials do not match.',
    isCustom: false
  },
  {
    id: 'auth_signup_success',
    operationKey: 'AUTH_SIGNUP_SUCCESS',
    matchPatterns: ['Account created successfully', 'Registration successful', 'Signed up successfully'],
    module: 'auth',
    type: 'success',
    title: 'Account Created',
    message: 'Your ViBa Mart account has been created successfully! Welcome aboard.',
    enabled: true,
    description: 'Triggered after user successfully completes sign up.',
    isCustom: false
  },
  {
    id: 'auth_signup_failed',
    operationKey: 'AUTH_SIGNUP_FAILED',
    matchPatterns: ['Failed to create account', 'Email already in use', 'auth/email-already-in-use'],
    module: 'auth',
    type: 'error',
    title: 'Registration Error',
    message: 'An account with this email address already exists. Please log in instead.',
    enabled: true,
    description: 'Triggered when registration fails due to duplicate email or validation error.',
    isCustom: false
  },
  {
    id: 'auth_logout_success',
    operationKey: 'AUTH_LOGOUT_SUCCESS',
    matchPatterns: ['Logged out successfully', 'Admin initiated logout', 'You have been logged out'],
    module: 'auth',
    type: 'success',
    title: 'Logged Out',
    message: 'You have been logged out successfully.',
    enabled: true,
    description: 'Triggered when user logs out of their session.',
    isCustom: false
  },
  {
    id: 'auth_otp_sent',
    operationKey: 'AUTH_OTP_SENT',
    matchPatterns: ['OTP sent successfully', 'Verification code sent', 'OTP sent to'],
    module: 'auth',
    type: 'success',
    title: 'Verification Code Sent',
    message: 'A 6-digit verification code has been sent to your phone number.',
    enabled: true,
    description: 'Triggered when an OTP is dispatched for authentication.',
    isCustom: false
  },
  {
    id: 'auth_otp_invalid',
    operationKey: 'AUTH_OTP_INVALID',
    matchPatterns: ['Invalid OTP', 'Verification code invalid', 'Incorrect OTP', 'OTP expired'],
    module: 'auth',
    type: 'error',
    title: 'Invalid OTP',
    message: 'The verification code entered is incorrect or expired. Please request a new one.',
    enabled: true,
    description: 'Triggered when user enters an invalid or expired OTP.',
    isCustom: false
  },
  {
    id: 'auth_profile_updated',
    operationKey: 'AUTH_PROFILE_UPDATED',
    matchPatterns: ['Profile updated successfully', 'Profile updated', 'Your profile has been saved'],
    module: 'auth',
    type: 'success',
    title: 'Profile Saved',
    message: 'Your account profile information has been saved successfully.',
    enabled: true,
    description: 'Triggered when user updates personal or contact information.',
    isCustom: false
  },
  {
    id: 'auth_password_reset_sent',
    operationKey: 'AUTH_PASSWORD_RESET_SENT',
    matchPatterns: ['Password reset link sent', 'Password reset email sent', 'Reset link dispatched'],
    module: 'auth',
    type: 'success',
    title: 'Password Reset Sent',
    message: 'Password reset link sent! Check your inbox to choose a new password.',
    enabled: true,
    description: 'Triggered after user requests a password reset link.',
    isCustom: false
  },
  {
    id: 'auth_session_expired',
    operationKey: 'AUTH_SESSION_EXPIRED',
    matchPatterns: ['Session expired', 'Please log in again', 'Please login to continue', 'Session timed out'],
    module: 'auth',
    type: 'warning',
    title: 'Session Expired',
    message: 'Your session has expired. Please log in again to continue shopping safely.',
    enabled: true,
    description: 'Triggered when session token expires.',
    isCustom: false
  },

  // =================== CART & BAG ===================
  {
    id: 'cart_add_success',
    operationKey: 'CART_ADD_SUCCESS',
    matchPatterns: ['Added to Cart', 'Item added to your cart', 'Item added to cart', 'Item is in cart', 'Added to cart successfully'],
    module: 'cart',
    type: 'success',
    title: 'Added to Cart',
    message: 'Item added to your shopping cart successfully.',
    enabled: true,
    description: 'Triggered when a product or variant is added to the cart.',
    isCustom: false
  },
  {
    id: 'cart_add_failed',
    operationKey: 'CART_ADD_FAILED',
    matchPatterns: ['Could not add to cart', 'Failed to add to cart', 'Unable to add item'],
    module: 'cart',
    type: 'error',
    title: 'Cart Error',
    message: 'Could not add item to cart. Please check stock availability or try again.',
    enabled: true,
    description: 'Triggered when adding an item to the cart fails.',
    isCustom: false
  },
  {
    id: 'cart_remove_success',
    operationKey: 'CART_REMOVE_SUCCESS',
    matchPatterns: ['Item removed from cart', 'Removed from cart', 'Item removed', 'Item removed from your cart'],
    module: 'cart',
    type: 'success',
    title: 'Item Removed',
    message: 'Item has been removed from your cart.',
    enabled: true,
    description: 'Triggered when customer deletes an item from their cart.',
    isCustom: false
  },
  {
    id: 'cart_stock_limit_warning',
    operationKey: 'CART_STOCK_LIMIT_WARNING',
    matchPatterns: ['Requested quantity exceeds available stock', 'Maximum quantity reached', 'Out of stock', 'Stock limit exceeded', 'Only few left in stock'],
    module: 'cart',
    type: 'warning',
    title: 'Stock Limit Reached',
    message: 'The requested quantity exceeds available inventory stock.',
    enabled: true,
    description: 'Triggered when user attempts to exceed the available inventory count.',
    isCustom: false
  },
  {
    id: 'cart_empty_warning',
    operationKey: 'CART_EMPTY_WARNING',
    matchPatterns: ['Your cart is empty', 'No items in cart', 'Cart is currently empty'],
    module: 'cart',
    type: 'warning',
    title: 'Your Cart is Empty',
    message: 'Please add items to your cart before proceeding to checkout.',
    enabled: true,
    description: 'Triggered when user tries to checkout with zero items in cart.',
    isCustom: false
  },
  {
    id: 'cart_cleared_success',
    operationKey: 'CART_CLEARED_SUCCESS',
    matchPatterns: ['Cart cleared successfully', 'Cart emptied', 'All items removed'],
    module: 'cart',
    type: 'success',
    title: 'Cart Cleared',
    message: 'All items have been removed from your shopping cart.',
    enabled: true,
    description: 'Triggered when cart is completely cleared.',
    isCustom: false
  },

  // =================== CHECKOUT & ORDERS ===================
  {
    id: 'order_placed_success',
    operationKey: 'ORDER_PLACED_SUCCESS',
    matchPatterns: ['Order placed successfully', 'Order created successfully', 'Your order has been placed', 'Order confirmed'],
    module: 'checkout_orders',
    type: 'success',
    title: 'Order Placed!',
    message: 'Your order has been placed successfully. Thank you for shopping with ViBa Mart!',
    enabled: true,
    description: 'Triggered when an order is finalized and placed.',
    isCustom: false
  },
  {
    id: 'order_payment_success',
    operationKey: 'ORDER_PAYMENT_SUCCESS',
    matchPatterns: ['Payment successful', 'Payment received successfully', 'Payment confirmed'],
    module: 'checkout_orders',
    type: 'success',
    title: 'Payment Successful',
    message: 'Payment received successfully. Your order is now being processed.',
    enabled: true,
    description: 'Triggered when online payment gateway returns a success status.',
    isCustom: false
  },
  {
    id: 'order_payment_failed',
    operationKey: 'ORDER_PAYMENT_FAILED',
    matchPatterns: ['Payment failed', 'Payment could not be completed', 'Razorpay payment failed', 'Transaction failed'],
    module: 'checkout_orders',
    type: 'error',
    title: 'Payment Failed',
    message: 'Payment could not be completed. Any deducted amount will be refunded by your bank.',
    enabled: true,
    description: 'Triggered when Razorpay or UPI transaction fails or is cancelled.',
    isCustom: false
  },
  {
    id: 'order_address_required_warning',
    operationKey: 'ORDER_ADDRESS_REQUIRED_WARNING',
    matchPatterns: ['Please select a delivery address', 'Please enter your complete address', 'Address is required', 'Delivery address required'],
    module: 'checkout_orders',
    type: 'warning',
    title: 'Address Required',
    message: 'Please choose or add a valid delivery address before proceeding to payment.',
    enabled: true,
    description: 'Triggered when checkout is attempted without a selected delivery address.',
    isCustom: false
  },
  {
    id: 'order_status_updated',
    operationKey: 'ORDER_STATUS_UPDATED',
    matchPatterns: ['Order status updated', 'Order status changed', 'Status updated successfully'],
    module: 'checkout_orders',
    type: 'success',
    title: 'Order Status Updated',
    message: 'Order status has been updated successfully.',
    enabled: true,
    description: 'Triggered when admin or courier updates order shipping/delivery status.',
    isCustom: false
  },

  // =================== PRODUCTS & CATALOG ===================
  {
    id: 'product_create_success',
    operationKey: 'PRODUCT_CREATE_SUCCESS',
    matchPatterns: ['Product added successfully', 'Product created successfully', 'Product published'],
    module: 'products_catalog',
    type: 'success',
    title: 'Product Created',
    message: 'New product has been added to catalog successfully.',
    enabled: true,
    description: 'Triggered when admin or vendor creates a new product listing.',
    isCustom: false
  },
  {
    id: 'product_update_success',
    operationKey: 'PRODUCT_UPDATE_SUCCESS',
    matchPatterns: ['Product updated successfully', 'Product saved successfully', 'Changes saved to product'],
    module: 'products_catalog',
    type: 'success',
    title: 'Product Updated',
    message: 'Product details and inventory updated successfully.',
    enabled: true,
    description: 'Triggered when an existing product details are modified.',
    isCustom: false
  },
  {
    id: 'product_delete_success',
    operationKey: 'PRODUCT_DELETE_SUCCESS',
    matchPatterns: ['Product Deleted', 'Product deleted successfully', 'Product removed from catalog'],
    module: 'products_catalog',
    type: 'success',
    title: 'Product Deleted',
    message: 'Product has been deleted from the catalog.',
    enabled: true,
    description: 'Triggered when admin removes a product from inventory.',
    isCustom: false
  },
  {
    id: 'product_save_error',
    operationKey: 'PRODUCT_SAVE_ERROR',
    matchPatterns: ['Unable to save changes', 'Failed to save product', 'Failed to delete', 'Error saving product'],
    module: 'products_catalog',
    type: 'error',
    title: 'Product Save Error',
    message: 'Unable to save product changes. Please verify all mandatory fields.',
    enabled: true,
    description: 'Triggered when saving product data encounters an error.',
    isCustom: false
  },
  {
    id: 'product_code_duplicate_error',
    operationKey: 'PRODUCT_CODE_DUPLICATE_ERROR',
    matchPatterns: ['Product Code is already assigned', 'Duplicate product code', 'Product code format'],
    module: 'products_catalog',
    type: 'error',
    title: 'Duplicate Product Code',
    message: 'This Product Code is already assigned to another catalog item. Please use a unique code.',
    enabled: true,
    description: 'Triggered when product SKU or code conflicts with an existing one.',
    isCustom: false
  },
  {
    id: 'category_saved_success',
    operationKey: 'CATEGORY_SAVED_SUCCESS',
    matchPatterns: ['Category saved successfully', 'Category updated successfully', 'Category created successfully'],
    module: 'products_catalog',
    type: 'success',
    title: 'Category Saved',
    message: 'Category and subcategory hierarchy updated successfully.',
    enabled: true,
    description: 'Triggered when admin edits or creates store categories.',
    isCustom: false
  },

  // =================== WISHLIST & SAVED ===================
  {
    id: 'wishlist_add_success',
    operationKey: 'WISHLIST_ADD_SUCCESS',
    matchPatterns: ['Added to wishlist', 'Added to Wishlist', 'Saved to wishlist', 'Saved to your wishlist'],
    module: 'wishlist',
    type: 'success',
    title: 'Saved to Wishlist',
    message: 'Product has been added to your wishlist.',
    enabled: true,
    description: 'Triggered when customer taps the heart icon on a product.',
    isCustom: false
  },
  {
    id: 'wishlist_remove_success',
    operationKey: 'WISHLIST_REMOVE_SUCCESS',
    matchPatterns: ['Removed from wishlist', 'Removed from Wishlist', 'Item removed from wishlist'],
    module: 'wishlist',
    type: 'success',
    title: 'Removed from Wishlist',
    message: 'Product removed from your wishlist.',
    enabled: true,
    description: 'Triggered when user removes a product from their saved wishlist.',
    isCustom: false
  },

  // =================== COUPONS, CASHBACK & REWARDS ===================
  {
    id: 'coupon_applied_success',
    operationKey: 'COUPON_APPLIED_SUCCESS',
    matchPatterns: ['Coupon applied successfully', 'Coupon code applied', 'Promo code applied'],
    module: 'coupons_rewards',
    type: 'success',
    title: 'Coupon Applied!',
    message: 'Coupon code applied successfully! Discount has been deducted.',
    enabled: true,
    description: 'Triggered when a valid promo code is verified and applied to cart.',
    isCustom: false
  },
  {
    id: 'coupon_invalid_error',
    operationKey: 'COUPON_INVALID_ERROR',
    matchPatterns: ['This coupon is not valid for the selected products', 'Invalid coupon code', 'Coupon expired', 'Coupon is not applicable', 'Invalid coupon'],
    module: 'coupons_rewards',
    type: 'error',
    title: 'Invalid Coupon',
    message: 'This coupon code is not valid, expired, or does not meet the minimum cart value.',
    enabled: true,
    description: 'Triggered when an entered coupon does not apply to the current cart.',
    isCustom: false
  },
  {
    id: 'coupon_code_required_warning',
    operationKey: 'COUPON_CODE_REQUIRED_WARNING',
    matchPatterns: ['Please enter a coupon code', 'Please enter coupon code', 'Enter promo code'],
    module: 'coupons_rewards',
    type: 'warning',
    title: 'Coupon Code Required',
    message: 'Please enter a coupon code before clicking apply.',
    enabled: true,
    description: 'Triggered when apply coupon is clicked with an empty text box.',
    isCustom: false
  },
  {
    id: 'reward_claimed_success',
    operationKey: 'REWARD_CLAIMED_SUCCESS',
    matchPatterns: ['Reward claimed successfully', 'Points redeemed successfully', 'Reward added'],
    module: 'coupons_rewards',
    type: 'success',
    title: 'Reward Claimed!',
    message: 'Congratulations! Reward has been claimed and added to your wallet.',
    enabled: true,
    description: 'Triggered after user spins wheel or unlocks a loyalty reward.',
    isCustom: false
  },
  {
    id: 'cashback_settings_saved_success',
    operationKey: 'CASHBACK_SETTINGS_SAVED_SUCCESS',
    matchPatterns: ['Cashback program settings updated successfully', 'Cashback saved', 'Cashback updated'],
    module: 'coupons_rewards',
    type: 'success',
    title: 'Cashback Settings Saved',
    message: 'Monthly cashback program settings updated successfully.',
    enabled: true,
    description: 'Triggered when admin updates cashback percentages and rules.',
    isCustom: false
  },

  // =================== RETURNS, CANCELLATIONS & REFUNDS ===================
  {
    id: 'order_cancel_success',
    operationKey: 'ORDER_CANCEL_SUCCESS',
    matchPatterns: ['Order cancelled successfully', 'Cancellation request submitted', 'Request marked as cancelled'],
    module: 'returns_refunds',
    type: 'success',
    title: 'Order Cancelled',
    message: 'Your order cancellation has been submitted and confirmed.',
    enabled: true,
    description: 'Triggered when customer or admin cancels an order.',
    isCustom: false
  },
  {
    id: 'order_cancel_failed',
    operationKey: 'ORDER_CANCEL_FAILED',
    matchPatterns: ['Unable to cancel order', 'Failed to cancel order', 'Order cannot be cancelled', 'Cancellation failed'],
    module: 'returns_refunds',
    type: 'error',
    title: 'Cancellation Failed',
    message: 'Unable to cancel this order as it has already been dispatched for delivery.',
    enabled: true,
    description: 'Triggered when cancellation is attempted on a shipped/delivered order.',
    isCustom: false
  },
  {
    id: 'return_request_success',
    operationKey: 'RETURN_REQUEST_SUCCESS',
    matchPatterns: ['Return request submitted successfully', 'Return request placed', 'Return initiated'],
    module: 'returns_refunds',
    type: 'success',
    title: 'Return Requested',
    message: 'Your return request has been submitted. Our team will review it within 24 hours.',
    enabled: true,
    description: 'Triggered when a customer submits a product return request.',
    isCustom: false
  },
  {
    id: 'refund_processed_success',
    operationKey: 'REFUND_PROCESSED_SUCCESS',
    matchPatterns: ['Refund processed successfully', 'Refund approved', 'Refund initiated'],
    module: 'returns_refunds',
    type: 'success',
    title: 'Refund Processed',
    message: 'Refund has been successfully initiated to customer payment method.',
    enabled: true,
    description: 'Triggered when admin approves and executes a customer refund.',
    isCustom: false
  },
  {
    id: 'refund_failed_error',
    operationKey: 'REFUND_FAILED_ERROR',
    matchPatterns: ['Failed to process refund', 'Refund failed', 'Refund error'],
    module: 'returns_refunds',
    type: 'error',
    title: 'Refund Error',
    message: 'Failed to process refund. Please verify bank/gateway settlement status.',
    enabled: true,
    description: 'Triggered when payment gateway refund API fails.',
    isCustom: false
  },

  // =================== INVOICES & BILLING ===================
  {
    id: 'invoice_generated_success',
    operationKey: 'INVOICE_GENERATED_SUCCESS',
    matchPatterns: ['Invoice generated successfully', 'Invoice downloaded', 'Invoice ready'],
    module: 'invoices',
    type: 'success',
    title: 'Invoice Generated',
    message: 'Tax invoice generated and downloaded successfully.',
    enabled: true,
    description: 'Triggered when customer or admin downloads tax invoice PDF.',
    isCustom: false
  },
  {
    id: 'invoice_error',
    operationKey: 'INVOICE_ERROR',
    matchPatterns: ['Failed to generate invoice', 'Invoice could not be loaded', 'Invoice generation failed'],
    module: 'invoices',
    type: 'error',
    title: 'Invoice Error',
    message: 'Could not generate invoice. Please try again in a few moments.',
    enabled: true,
    description: 'Triggered when PDF invoice compilation fails.',
    isCustom: false
  },

  // =================== REVIEWS & RATINGS ===================
  {
    id: 'review_submitted_success',
    operationKey: 'REVIEW_SUBMITTED_SUCCESS',
    matchPatterns: ['Review submitted successfully', 'Review published', 'Review posted'],
    module: 'reviews',
    type: 'success',
    title: 'Review Submitted',
    message: 'Thank you! Your verified product review has been submitted successfully.',
    enabled: true,
    description: 'Triggered after user submits product feedback or star rating.',
    isCustom: false
  },
  {
    id: 'review_failed_error',
    operationKey: 'REVIEW_FAILED_ERROR',
    matchPatterns: ['Failed to submit review', 'Review could not be posted', 'Error submitting review'],
    module: 'reviews',
    type: 'error',
    title: 'Submission Failed',
    message: 'Unable to submit your review. Please try again shortly.',
    enabled: true,
    description: 'Triggered when review posting API rejects the submission.',
    isCustom: false
  },
  {
    id: 'review_rating_required_warning',
    operationKey: 'REVIEW_RATING_REQUIRED_WARNING',
    matchPatterns: ['Please select a rating', 'Rating is required', 'Please provide a star rating'],
    module: 'reviews',
    type: 'warning',
    title: 'Rating Required',
    message: 'Please select a star rating (1 to 5 stars) before submitting your review.',
    enabled: true,
    description: 'Triggered when user clicks submit review without choosing stars.',
    isCustom: false
  },

  // =================== ADMIN & STORE MANAGEMENT ===================
  {
    id: 'admin_settings_saved_success',
    operationKey: 'ADMIN_SETTINGS_SAVED_SUCCESS',
    matchPatterns: ['Settings updated successfully', 'Changes saved successfully', 'Configuration saved', 'Updated successfully'],
    module: 'admin_management',
    type: 'success',
    title: 'Settings Saved',
    message: 'System settings and configurations updated successfully.',
    enabled: true,
    description: 'Triggered when any Admin dashboard settings view saves changes.',
    isCustom: false
  },
  {
    id: 'admin_permission_denied_error',
    operationKey: 'ADMIN_PERMISSION_DENIED_ERROR',
    matchPatterns: ['Only a Super Admin can assign the Super Admin role', 'Permission denied', 'Unauthorized access', 'Only Super Admin'],
    module: 'admin_management',
    type: 'error',
    title: 'Permission Denied',
    message: 'Only a Super Admin has authorization to perform this restricted operation.',
    enabled: true,
    description: 'Triggered when an admin user attempts a Super Admin only action.',
    isCustom: false
  },

  // =================== HARDWARE & DEVICE PERMISSIONS ===================
  {
    id: 'perm_camera_disabled_error',
    operationKey: 'PERM_CAMERA_DISABLED_ERROR',
    matchPatterns: ['Camera feature is currently disabled by Admin', 'Camera permission denied', 'Camera not allowed'],
    module: 'hardware_permissions',
    type: 'error',
    title: 'Camera Disabled',
    message: 'Camera feature is currently disabled by Admin or permission was denied.',
    enabled: true,
    description: 'Triggered when barcode/QR scanning is initiated without camera permission.',
    isCustom: false
  },
  {
    id: 'perm_location_disabled_error',
    operationKey: 'PERM_LOCATION_DISABLED_ERROR',
    matchPatterns: ['Location service is currently disabled by Admin', 'Location permission denied'],
    module: 'hardware_permissions',
    type: 'error',
    title: 'Location Disabled',
    message: 'Location service is currently disabled by Admin. Please enter address manually.',
    enabled: true,
    description: 'Triggered when auto-detect location is blocked.',
    isCustom: false
  },
  {
    id: 'perm_push_disabled_error',
    operationKey: 'PERM_PUSH_DISABLED_ERROR',
    matchPatterns: ['Push notifications are disabled by Admin', 'Push notifications blocked'],
    module: 'hardware_permissions',
    type: 'error',
    title: 'Push Notifications Disabled',
    message: 'Push notifications are currently disabled by Admin in system settings.',
    enabled: true,
    description: 'Triggered when customer attempts to subscribe to push alerts.',
    isCustom: false
  },
  {
    id: 'perm_bluetooth_disabled_error',
    operationKey: 'PERM_BLUETOOTH_DISABLED_ERROR',
    matchPatterns: ['Bluetooth feature is disabled by Admin', 'Bluetooth pairing failed'],
    module: 'hardware_permissions',
    type: 'error',
    title: 'Bluetooth Unavailable',
    message: 'Bluetooth printing feature is disabled by Admin or not supported in this browser.',
    enabled: true,
    description: 'Triggered when thermal receipt printer connection fails.',
    isCustom: false
  },

  // =================== GENERAL & CONNECTIVITY ===================
  {
    id: 'general_network_error',
    operationKey: 'GENERAL_NETWORK_ERROR',
    matchPatterns: ['Network error', 'Unable to connect', 'Failed to fetch', 'Please check your internet connection'],
    module: 'general',
    type: 'error',
    title: 'Connection Error',
    message: 'Network connection issue detected. Please check your internet connection.',
    enabled: true,
    description: 'Triggered when offline or when network requests fail.',
    isCustom: false
  },
  {
    id: 'general_copied_success',
    operationKey: 'GENERAL_COPIED_SUCCESS',
    matchPatterns: ['copied to clipboard', 'Copied to clipboard', 'Code copied'],
    module: 'general',
    type: 'success',
    title: 'Copied to Clipboard',
    message: 'Text copied to clipboard successfully.',
    enabled: true,
    description: 'Triggered when user or admin copies SKU, promo code, or tracking number.',
    isCustom: false
  },
  {
    id: 'general_file_size_error',
    operationKey: 'GENERAL_FILE_SIZE_ERROR',
    matchPatterns: ['File size exceeds 10 MB limit', 'exceeds 10 MB limit', 'File too large'],
    module: 'general',
    type: 'error',
    title: 'File Too Large',
    message: 'Selected image/file size exceeds the maximum allowed 10 MB limit.',
    enabled: true,
    description: 'Triggered when image upload exceeds file size limits.',
    isCustom: false
  }
];

export const SETTINGS_DOC_PATH = 'settings/toast_notifications';

/**
 * Fetches the current toast notifications configuration from Firestore.
 * Merges with DEFAULT_TOAST_NOTIFICATIONS if any items are missing.
 */
export async function fetchToastNotificationSettings(): Promise<ToastNotificationConfigItem[]> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'toast_notifications'));
    if (snap.exists()) {
      const data = snap.data() as ToastNotificationSettingsDoc;
      if (Array.isArray(data.messages) && data.messages.length > 0) {
        // Merge with defaults to ensure any newly added default items also exist
        const remoteMap = new Map<string, ToastNotificationConfigItem>();
        data.messages.forEach(m => remoteMap.set(m.id, m));

        const merged: ToastNotificationConfigItem[] = [];
        // First add remote messages
        data.messages.forEach(m => merged.push(m));
        // Add defaults that don't exist remotely
        DEFAULT_TOAST_NOTIFICATIONS.forEach(def => {
          if (!remoteMap.has(def.id)) {
            merged.push(def);
          }
        });
        return merged;
      }
    }
  } catch (error) {
    console.warn('Could not fetch toast notification settings from Firestore, using defaults:', error);
  }
  return [...DEFAULT_TOAST_NOTIFICATIONS];
}

/**
 * Persists the toast notification configurations to Firestore.
 */
export async function saveToastNotificationSettings(
  messages: ToastNotificationConfigItem[],
  adminEmail?: string
): Promise<void> {
  const payload: ToastNotificationSettingsDoc = {
    messages,
    updatedAt: new Date().toISOString(),
    updatedBy: adminEmail || 'Admin'
  };
  await setDoc(doc(db, 'settings', 'toast_notifications'), payload, { merge: true });
}

/**
 * Sets up a live Firestore snapshot listener for toast notification settings.
 */
export function subscribeToastNotificationSettings(
  callback: (messages: ToastNotificationConfigItem[]) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'settings', 'toast_notifications'),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as ToastNotificationSettingsDoc;
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          const remoteMap = new Map<string, ToastNotificationConfigItem>();
          data.messages.forEach(m => remoteMap.set(m.id, m));

          const merged: ToastNotificationConfigItem[] = [...data.messages];
          DEFAULT_TOAST_NOTIFICATIONS.forEach(def => {
            if (!remoteMap.has(def.id)) {
              merged.push(def);
            }
          });
          callback(merged);
          return;
        }
      }
      callback([...DEFAULT_TOAST_NOTIFICATIONS]);
    },
    (err) => {
      console.warn('Toast notification snapshot subscription notice:', err.message);
      callback([...DEFAULT_TOAST_NOTIFICATIONS]);
    }
  );
}

