import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { loginUserSchema, insertUserSchema, UserRole } from '@shared/schema';
import { loginUser, registerUser } from '../services/auth';
import { authenticate, requireAdmin } from '../middleware/auth';
import { storage } from '../storage';
import { sendPasswordResetEmail } from '../services/emailService';

const router = Router();

// Setup multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024, // 5GB limit for dataroom uploads
  }
});

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
    
    // Handle registration failure with specific error messages
    if (!result.success) {
      // Return 409 Conflict for duplicate email, 500 for server errors
      const statusCode = result.error === 'email_exists' ? 409 : 500;
      return res.status(statusCode).json({ message: result.message });
    }

    res.status(201).json({
      message: 'User registered successfully',
      user: result.user,
      token: result.token
    });
  } catch (error) {
    console.error('Error in /register:', error);
    res.status(500).json({ message: 'An error occurred while creating your account. Please try again.' });
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

    // Login user (email field may contain username or email)
    const { email, password, stayLoggedIn } = validationResult.data;
    const result = await loginUser(email, password);
    
    if (!result) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Store user info in session for persistence across server restarts
    (req.session as any).userId = result.user.id;
    (req.session as any).userEmail = result.user.email;
    (req.session as any).userRole = result.user.role;
    (req.session as any).stayLoggedIn = stayLoggedIn;
    
    // Set extended session duration - always use long-lived sessions for persistence
    req.session.cookie.maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days for permanent login
    console.log('Extended session set for 90 days for user:', result.user.email);
    
    // Force session save before sending response
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ message: 'Session save failed' });
      } else {
        console.log('Session saved successfully for user:', result.user.email);
        res.json({
          message: 'Login successful',
          user: result.user,
          token: result.token,
          stayLoggedIn: stayLoggedIn
        });
      }
    });
  } catch (error) {
    console.error('Error in /login:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route POST /api/auth/forgot-password
 * @desc Request password reset email
 * @access Public
 */
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    console.log(`🔐 Password reset requested for: ${email}`);

    // Find user by email
    const user = await storage.getUserByEmail(email);
    
    // Always return success to prevent email enumeration attacks
    // Even if user doesn't exist, we don't reveal that
    if (!user) {
      console.log(`⚠️ Password reset requested for non-existent email: ${email}`);
      return res.status(200).json({ 
        message: 'If an account with that email exists, we sent a password reset link.' 
      });
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save token to database
    await storage.createPasswordResetToken({
      userId: user.id,
      token: tokenHash,
      expiresAt,
      used: false
    });

    // Build reset URL
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPLIT_DOMAINS?.split(',')[0] 
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : 'http://localhost:5000';
    
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    // Send email
    const emailResult = await sendPasswordResetEmail({
      email: user.email,
      name: user.name,
      resetToken,
      resetUrl
    });

    if (!emailResult.success) {
      console.error(`❌ Failed to send password reset email to ${email}:`, emailResult.error);
      return res.status(500).json({ 
        message: 'Failed to send password reset email. Please try again later.' 
      });
    }

    console.log(`✅ Password reset email sent to ${email}`);
    
    res.status(200).json({ 
      message: 'If an account with that email exists, we sent a password reset link.' 
    });
  } catch (error) {
    console.error('Error in /forgot-password:', error);
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

/**
 * @route POST /api/auth/reset-password
 * @desc Reset password with token
 * @access Public
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    console.log(`🔐 Password reset attempt with token`);

    // Hash the token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find the reset token
    const resetToken = await storage.getPasswordResetToken(tokenHash);

    if (!resetToken) {
      console.log(`❌ Invalid password reset token`);
      return res.status(400).json({ message: 'Invalid or expired reset link. Please request a new one.' });
    }

    // Check if token is expired
    if (new Date() > resetToken.expiresAt) {
      console.log(`❌ Expired password reset token`);
      await storage.markPasswordResetTokenAsUsed(tokenHash);
      return res.status(400).json({ message: 'Reset link has expired. Please request a new one.' });
    }

    // Check if token was already used
    if (resetToken.used) {
      console.log(`❌ Already used password reset token`);
      return res.status(400).json({ message: 'This reset link has already been used. Please request a new one.' });
    }

    // Get the user
    const user = await storage.getUser(resetToken.userId);
    if (!user) {
      console.log(`❌ User not found for password reset token`);
      return res.status(400).json({ message: 'Invalid reset link. Please request a new one.' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update user's password
    await storage.updateUser(user.id, { password: hashedPassword });

    // Mark token as used
    await storage.markPasswordResetTokenAsUsed(tokenHash);

    console.log(`✅ Password reset successful for user ${user.email}`);

    res.status(200).json({ message: 'Password has been reset successfully. You can now log in with your new password.' });
  } catch (error) {
    console.error('Error in /reset-password:', error);
    res.status(500).json({ message: 'An error occurred. Please try again.' });
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
 * @route GET /api/auth/session
 * @desc Check session status and get user if authenticated
 * @access Public
 */
router.get('/session', async (req: Request, res: Response) => {
  try {
    // Check if user is authenticated via session
    if ((req.session as any)?.userId) {
      const userId = (req.session as any).userId;
      const user = await storage.getUser(userId);
      
      if (user) {
        const { password, ...userWithoutPassword } = user;
        return res.json({ 
          authenticated: true, 
          user: userWithoutPassword 
        });
      }
    }
    
    res.json({ authenticated: false });
  } catch (error) {
    console.error('Error in /session:', error);
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
    // Destroy the session for persistent logout
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
        return res.status(500).json({ message: 'Logout failed' });
      }
      
      // Clear the session cookie
      res.clearCookie('aescuvest-session');
      res.status(200).json({ message: 'Logout successful' });
    });
  } catch (error) {
    console.error('Error in /logout:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route POST /api/auth/upload-files
 * @desc Upload files for analysis
 * @access Public
 */
router.post('/upload-files', upload.array('files', 10), async (req: Request, res: Response) => {
  console.log('🎯 AUTH UPLOAD ROUTE HIT!');
  console.log('Method:', req.method, 'URL:', req.url);
  console.log('Files received:', req.files?.length || 0);
  console.log('Deal ID:', req.body?.dealId);
  
  try {
    res.setHeader('Content-Type', 'application/json');
    
    const files = req.files as Express.Multer.File[];
    const dealId = req.body.dealId;
    
    if (!files || files.length === 0) {
      console.log('❌ No files found');
      return res.status(400).json({ 
        success: false,
        message: 'No files uploaded' 
      });
    }

    const uploadedFiles = files.map((file, index) => ({
      id: `file_${Date.now()}_${index}`,
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
      status: 'uploaded'
    }));

    console.log('✅ SUCCESS! Responding with JSON for', uploadedFiles.length, 'files');
    
    return res.status(200).json({
      success: true,
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
      files: uploadedFiles,
      dealId: dealId || null
    });

  } catch (error) {
    console.error('💥 UPLOAD ERROR IN AUTH ROUTE:', error);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ 
      success: false,
      message: 'Upload failed', 
      error: String(error) 
    });
  }
});

export default router;