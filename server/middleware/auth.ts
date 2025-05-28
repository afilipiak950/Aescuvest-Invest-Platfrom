import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth';
import { storage } from '../storage';
import { UserRole } from '@shared/schema';

// Custom interface extending Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
      userId?: number;
      userRole?: string;
    }
  }
}

/**
 * Authentication middleware to verify JWT token
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let user = null;
    let userId = null;
    
    // First, check if user is authenticated via session (persistent login)
    if ((req.session as any)?.userId) {
      userId = (req.session as any).userId;
      user = await storage.getUser(userId);
    }
    
    // If no session, try JWT token
    if (!user) {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No authentication provided' });
      }
      
      const token = authHeader.split(' ')[1];
      
      // Verify token
      const decoded = verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ message: 'Token is invalid or expired' });
      }
      
      // Get user from database
      user = await storage.getUser(decoded.userId);
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
      
      // Store in session for future requests
      (req.session as any).userId = user.id;
      (req.session as any).userEmail = user.email;
      (req.session as any).userRole = user.role;
    }
    
    if (!user) {
      return res.status(401).json({ message: 'Authentication failed' });
    }
    
    // Add user data to request
    req.user = user;
    req.userId = user.id;
    req.userRole = user.role;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Authorization middleware to restrict access to admin users only
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  // Check if user is authenticated
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  // Check if user has admin role
  if (req.userRole !== UserRole.ADMIN) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  
  next();
};