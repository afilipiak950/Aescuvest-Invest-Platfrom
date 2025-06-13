import { db } from '../server/db';
import { users, UserRole } from '../shared/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

async function createEmailAdminUser() {
  try {
    // Check if email admin user already exists
    const existingAdmins = await db.select().from(users).where(eq(users.email, 'admin@admin.com'));
    
    if (existingAdmins.length > 0) {
      console.log('Email admin user already exists.');
      process.exit(0);
    }
    
    // Create password hash
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    
    // Insert admin user with email
    const adminUser = await db.insert(users).values({
      name: 'Admin',
      email: 'admin@admin.com', // Admin with proper email format
      password: hashedPassword,
      role: UserRole.ADMIN,
    }).returning();
    
    console.log('Email admin user created successfully:', adminUser[0]);
  } catch (error) {
    console.error('Error creating email admin user:', error);
  } finally {
    process.exit(0);
  }
}

createEmailAdminUser();