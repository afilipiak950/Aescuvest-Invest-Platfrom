import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';
import { InsertUser, User, UserRole } from '@shared/schema';

// JWT secret key - in production, use env variable
const JWT_SECRET = process.env.JWT_SECRET || 'investment-platform-secret-key';
const JWT_EXPIRY = '30d'; // Token expires in 30 days

interface TokenPayload {
  userId: number;
  email: string;
  role: string;
}

// Registration result types for specific error handling
export type RegisterResult = 
  | { success: true; user: Omit<User, 'password'>; token: string }
  | { success: false; error: 'email_exists' | 'server_error'; message: string };

/**
 * Register a new user
 */
export async function registerUser(userData: Omit<InsertUser, 'password'> & { password: string }): Promise<RegisterResult> {
  try {
    // Check if user already exists
    const existingUser = await storage.getUserByEmail(userData.email);
    if (existingUser) {
      return { 
        success: false, 
        error: 'email_exists',
        message: 'This email address is already registered. Please use a different email or try logging in.' 
      };
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);

    // Create new user with hashed password
    const newUser = await storage.createUser({
      ...userData,
      password: hashedPassword,
    });

    // Generate JWT token
    const token = generateToken({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });

    // Remove password from the returned user object
    const { password, ...userWithoutPassword } = newUser;

    return {
      success: true,
      user: userWithoutPassword,
      token,
    };
  } catch (error) {
    console.error('Error in registerUser:', error);
    return { 
      success: false, 
      error: 'server_error',
      message: 'An error occurred while creating your account. Please try again.' 
    };
  }
}

/**
 * Login a user with email or username and password
 */
export async function loginUser(emailOrUsername: string, password: string): Promise<{
  user: Omit<User, 'password'>;
  token: string;
} | null> {
  try {
    // Try to find user by email/username (since we're storing username in the email field)
    const user = await storage.getUserByEmail(emailOrUsername);
    
    if (!user) {
      return null; // User not found
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return null; // Password is incorrect
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Remove password from the returned user object
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
    };
  } catch (error) {
    console.error('Error in loginUser:', error);
    return null;
  }
}

/**
 * Generate a JWT token
 */
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

/**
 * Verify a JWT token
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

/**
 * Check if a user has admin role
 */
export function isAdmin(user: User): boolean {
  return user.role === UserRole.ADMIN;
}