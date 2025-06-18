import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

// Extend Express Request interface to include apiUser
declare global {
  namespace Express {
    interface Request {
      apiUser?: {
        id: number;
        name: string;
        email: string;
        role: string;
      };
    }
  }
}

// API Key authentication middleware
export async function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      error: 'Missing authorization header',
      message: 'Please provide an API key in the Authorization header: Bearer <your-api-key>'
    });
  }

  const apiKey = authHeader.replace('Bearer ', '').replace('bearer ', '');
  
  if (!apiKey || !apiKey.startsWith('aesc_')) {
    return res.status(401).json({
      error: 'Invalid API key format',
      message: 'API key must start with "aesc_"'
    });
  }

  try {
    // Find user by API key
    const user = await storage.getUserByApiKey(apiKey);
    
    if (!user) {
      return res.status(401).json({
        error: 'Invalid API key',
        message: 'The provided API key is not valid or has been revoked'
      });
    }

    // Add user info to request object (excluding sensitive data)
    req.apiUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    console.log(`🔑 API authentication successful for user: ${user.name} (${user.email})`);
    next();
  } catch (error) {
    console.error('❌ API authentication error:', error);
    return res.status(500).json({
      error: 'Authentication error',
      message: 'Internal server error during authentication'
    });
  }
}

// Optional API authentication (allows both authenticated and public access)
export async function optionalApiAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (authHeader) {
    // If authorization header is provided, validate it
    return authenticateApiKey(req, res, next);
  } else {
    // If no authorization header, continue without authentication
    next();
  }
}