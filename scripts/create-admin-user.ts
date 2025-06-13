import { db } from '../server/db';
import { users, UserRole } from '../shared/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

async function createAdminUser() {
  try {
    // Check if admin user already exists
    const existingAdmins = await db.select().from(users).where(eq(users.email, 'admin'));
    
    if (existingAdmins.length > 0) {
      console.log('Admin user already exists.');
      process.exit(0);
    }
    
    // Create password hash
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    
    // Insert admin user
    const adminUser = await db.insert(users).values({
      name: 'Admin',
      email: 'admin', // Using "admin" as the username/email
      password: hashedPassword,
      role: UserRole.ADMIN,
    }).returning();
    
    console.log('Admin user created successfully:', adminUser[0]);
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    process.exit(0);
  }
}

createAdminUser();