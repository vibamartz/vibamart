import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';

/**
 * Middleware protecting administrative search endpoints (curation, reindexing, analytics).
 * Requires a valid Firebase Bearer ID token with admin claims in production.
 */
export async function requireSearchAdmin(req: Request, res: Response, next: NextFunction) {
  // Graceful local dev and test environment allowance when Firebase Admin is unconfigured
  if (!admin.apps.length) {
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
      return next();
    }
    return res.status(503).json({
      success: false,
      error: 'Authentication service unavailable'
    });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Admin authentication token required'
    });
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    (req as any).user = decodedToken;

    // Check admin authorization
    const role = decodedToken.role || (decodedToken as any).admin;
    const isAuthorized = role === 'admin' || role === true || decodedToken.email?.endsWith('@vibamart.com');

    if (process.env.NODE_ENV === 'production' && !isAuthorized) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Administrator privileges required'
      });
    }

    next();
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or expired authentication token'
    });
  }
}
