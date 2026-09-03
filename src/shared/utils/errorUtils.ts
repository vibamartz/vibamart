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

export function getPermissionInfo(type: 'location' | 'camera' | 'microphone' | 'notifications') {
  switch (type) {
    case 'location':
      return {
        title: 'Access Required',
        description: 'This feature needs location permission to continue.',
        actionText: 'Allow Access',
        instructions: 'If prompted, tap "Allow" or check site settings in your browser address bar to enable location access.',
      };
    case 'camera':
      return {
        title: 'Access Required',
        description: 'This feature needs camera permission to continue.',
        actionText: 'Allow Access',
        instructions: 'If prompted, allow camera access or adjust site settings in your browser address bar.',
      };
    case 'microphone':
      return {
        title: 'Access Required',
        description: 'This feature needs microphone permission for voice search.',
        actionText: 'Allow Access',
        instructions: 'If prompted, allow microphone access or adjust site settings in your browser address bar.',
      };
    case 'notifications':
      return {
        title: 'Access Required',
        description: 'This feature needs permission to send order updates and notifications.',
        actionText: 'Allow Access',
        instructions: 'If prompted, allow notification permissions in your browser or device settings.',
      };
  }
}
