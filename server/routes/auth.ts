import { Router, Request, Response } from 'express';
import { loginUserSchema, insertUserSchema, UserRole } from '@shared/schema';
import { loginUser, registerUser } from '../services/auth';
import { authenticate, requireAdmin } from '../middleware/auth';
import { storage } from '../storage';

const router = Router();

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = insertUserSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: validationResult.error.errors 
      });
    }

    // Set role to user by default unless specifically admin (can be restricted further)
    const userData = {
      ...validationResult.data,
      role: req.body.role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.USER
    };

    // Register user
    const result = await registerUser(userData);
    if (!result) {
      return res.status(400).json({ message: 'User registration failed, email may already be in use' });
    }

    res.status(201).json({
      message: 'User registered successfully',
      user: result.user,
      token: result.token
    });
  } catch (error) {
    console.error('Error in /register:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route POST /api/auth/login
 * @desc Login user and get token
 * @access Public
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = loginUserSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: validationResult.error.errors 
      });
    }

    // Login user
    const { email, password } = validationResult.data;
    const result = await loginUser(email, password);
    
    if (!result) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.json({
      message: 'Login successful',
      user: result.user,
      token: result.token
    });
  } catch (error) {
    console.error('Error in /login:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/auth/me
 * @desc Get current user
 * @access Private
 */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.user;
    
    // Remove sensitive information
    const { password, ...userWithoutPassword } = user;
    
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Error in /me:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/auth/users
 * @desc Get all users (admin only)
 * @access Private (Admin only)
 */
router.get('/users', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    // This route is for demonstration of role-based access
    // In a real application, you would implement proper pagination, filtering, etc.
    const users = await storage.getAllUsers();
    
    // Remove passwords from response
    const safeUsers = users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
    
    res.json(safeUsers);
  } catch (error) {
    console.error('Error in /users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route POST /api/auth/logout
 * @desc Logout user
 * @access Public
 */
router.post('/logout', (req: Request, res: Response) => {
  try {
    // In a token-based auth system, the client is responsible for removing the token
    // This endpoint is provided as a convenience for clients to call when logging out
    res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Error in /logout:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;