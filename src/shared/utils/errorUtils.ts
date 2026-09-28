/**
 * Utility functions to sanitize technical error messages into customer-friendly text.
 * Keeps detailed technical info for developer/admin console logs.
 */

export function sanitizeErrorMessage(error: unknown, fallbackMessage = "We couldn't complete this request right now. Please try again."): string {
  if (!error) return fallbackMessage;

  const rawMessage = typeof error === 'string' 
    ? error 
    : error instanceof Error 
      ? error.message 
      : String(error);

  // If it's already a clean user-friendly message, return it
  if (
    rawMessage.includes("We couldn't complete this request") ||
    rawMessage.includes("Access Required") ||
    rawMessage.includes("Please try again")
  ) {
    return rawMessage;
  }

  // Handle common Firebase / Network / Browser errors
  if (rawMessage.includes('auth/user-not-found') || rawMessage.includes('auth/wrong-password')) {
    return 'Invalid email or password. Please try again.';
  }
  if (rawMessage.includes('auth/email-already-in-use')) {
    return 'An account with this email address already exists.';
  }
  if (rawMessage.includes('auth/weak-password')) {
    return 'Please enter a stronger password (at least 6 characters).';
  }
  if (rawMessage.includes('auth/network-request-failed') || rawMessage.includes('Failed to fetch') || rawMessage.includes('NetworkError')) {
    return 'Network error. Please check your internet connection and try again.';
  }
  if (rawMessage.includes('permission-denied') || rawMessage.includes('Permission denied')) {
    return 'You do not have permission to perform this action.';
  }
  if (rawMessage.includes('quota-exceeded')) {
    return 'Service temporarily busy. Please try again in a few moments.';
  }
  if (rawMessage.startsWith('{') && rawMessage.endsWith('}')) {
    try {
      const parsed = JSON.parse(rawMessage);
      if (parsed.error) return sanitizeErrorMessage(parsed.error, fallbackMessage);
    } catch (e) {
      // Ignore JSON parse errors
    }
  }

  // Default fallback for raw stack traces or unknown technical strings
  return fallbackMessage;
}

export function getPermissionInfo(type: 'location' | 'camera' | 'microphone' | 'notifications' | 'bluetooth' | 'biometrics' | 'contacts' | 'sms' | 'storageMedia') {
  switch (type) {
    case 'location':
      return {
        title: 'Location Access Required',
        description: 'ViBa Mart needs location access to detect your delivery pincode, estimate accurate shipping times, and verify product availability.',
        actionText: 'Allow Location',
        instructions: 'If prompted by Android, tap "Allow While Using App" or check site settings in your browser address bar.',
      };
    case 'camera':
      return {
        title: 'Camera Access Required',
        description: 'ViBa Mart needs camera access for AI Visual Search, barcode scanning, defect return photo capture, and product reviews.',
        actionText: 'Allow Camera',
        instructions: 'If prompted by Android, tap "Allow" to enable camera & flashlight scanning.',
      };
    case 'microphone':
      return {
        title: 'Microphone Access Required',
        description: 'ViBa Mart needs microphone access for hands-free voice search and voice commands.',
        actionText: 'Allow Microphone',
        instructions: 'If prompted by Android, tap "Allow" to enable voice search.',
      };
    case 'notifications':
      return {
        title: 'Notifications Access Required',
        description: 'ViBa Mart needs notification access to send real-time order delivery updates, shipping tracking, and instant payment receipts.',
        actionText: 'Enable Notifications',
        instructions: 'If prompted by Android, tap "Allow" to receive live delivery alerts.',
      };
    case 'bluetooth':
      return {
        title: 'Bluetooth Connection Required',
        description: 'ViBa Mart needs Bluetooth access to discover and pair external thermal receipt printers or scanners.',
        actionText: 'Pair Bluetooth Device',
        instructions: 'Ensure Bluetooth is turned on in your device settings.',
      };
    case 'biometrics':
      return {
        title: 'Biometric Auth Required',
        description: 'Use Fingerprint or Face ID for secure zero-tap login and payment confirmation.',
        actionText: 'Authenticate with Biometrics',
        instructions: 'Touch your device fingerprint sensor or look at the front camera.',
      };
    case 'contacts':
      return {
        title: 'Contact Selector',
        description: 'Pick a recipient contact from your phone to automatically fill in gift delivery details.',
        actionText: 'Choose Contact',
        instructions: 'Select one contact from your address book. ViBa Mart never uploads your address book.',
      };
    case 'sms':
      return {
        title: 'SMS OTP Verification',
        description: 'Automatically fill verification OTP code received via SMS.',
        actionText: 'Autofill OTP',
        instructions: 'Your device will autofill the code automatically when received.',
      };
    case 'storageMedia':
      return {
        title: 'Media & Document Access',
        description: 'Select photos for product reviews, return evidence, or download tax invoice PDFs.',
        actionText: 'Select Media',
        instructions: 'Select files using official Android Photo Picker.',
      };
    default:
      return {
        title: 'Access Required',
        description: 'This feature needs permission to continue.',
        actionText: 'Allow Access',
        instructions: 'If prompted, tap "Allow" to proceed.',
      };
  }
}
