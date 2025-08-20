// Database File Storage - Store files directly in PostgreSQL
// Alternative to Google Cloud Storage for production

import { db } from '../db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

export class DatabaseFileStorage {
  private isProduction: boolean;
  
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production' || !!process.env.K_SERVICE;
  }
  
  /**
   * Store file in database or filesystem
   */
  async storeFile(filePath: string, dealId: number, fileName: string): Promise<string> {
    if (!this.isProduction) {
      // Development: Keep using local filesystem
      console.log(`📁 Development: File stored at ${filePath}`);
      return filePath;
    }
    
    try {
      // Production: Store file content in database
      const fileBuffer = await fs.promises.readFile(filePath);
      const base64Content = fileBuffer.toString('base64');
      
      // Store in a file_storage table
      const result = await db.execute(sql`
        INSERT INTO file_storage (deal_id, file_name, file_content, file_size, created_at)
        VALUES (${dealId}, ${fileName}, ${base64Content}, ${fileBuffer.length}, NOW())
        RETURNING id
      `);
      
      // Delete local file after storing in DB
      try {
        await fs.promises.unlink(filePath);
      } catch (err) {
        console.warn('Failed to delete local file:', err);
      }
      
      const fileId = result[0]?.id;
      const dbPath = `db://file_storage/${fileId}`;
      console.log(`💾 File stored in database: ${dbPath}`);
      
      return dbPath;
    } catch (error) {
      console.error('Failed to store file in database:', error);
      // Fallback to local storage
      return filePath;
    }
  }
  
  /**
   * Retrieve file from database or filesystem
   */
  async retrieveFile(storagePath: string): Promise<Buffer> {
    if (!storagePath.startsWith('db://')) {
      // Local file or development mode
      try {
        return await fs.promises.readFile(storagePath);
      } catch (error) {
        console.error('Failed to read local file:', error);
        throw error;
      }
    }
    
    try {
      // Extract file ID from path: db://file_storage/123
      const matches = storagePath.match(/^db:\/\/file_storage\/(\d+)$/);
      if (!matches) {
        throw new Error('Invalid database storage path');
      }
      
      const fileId = parseInt(matches[1]);
      
      // Retrieve from database
      const result = await db.execute(sql`
        SELECT file_content FROM file_storage WHERE id = ${fileId}
      `);
      
      if (!result[0]?.file_content) {
        throw new Error('File not found in database');
      }
      
      // Convert base64 back to buffer
      const buffer = Buffer.from(result[0].file_content, 'base64');
      console.log(`💾 Retrieved file from database: ${storagePath}`);
      
      return buffer;
    } catch (error) {
      console.error('Failed to retrieve file from database:', error);
      throw error;
    }
  }
  
  /**
   * Delete file from database or filesystem
   */
  async deleteFile(storagePath: string): Promise<void> {
    if (!storagePath.startsWith('db://')) {
      // Local file
      try {
        await fs.promises.unlink(storagePath);
        console.log(`🗑️ Deleted local file: ${storagePath}`);
      } catch (error) {
        console.warn('Failed to delete local file:', error);
      }
      return;
    }
    
    try {
      const matches = storagePath.match(/^db:\/\/file_storage\/(\d+)$/);
      if (!matches) {
        throw new Error('Invalid database storage path');
      }
      
      const fileId = parseInt(matches[1]);
      
      await db.execute(sql`
        DELETE FROM file_storage WHERE id = ${fileId}
      `);
      
      console.log(`🗑️ Deleted from database: ${storagePath}`);
    } catch (error) {
      console.error('Failed to delete from database:', error);
    }
  }
  
  /**
   * Check if file exists
   */
  async fileExists(storagePath: string): Promise<boolean> {
    if (!storagePath.startsWith('db://')) {
      // Local file
      try {
        await fs.promises.access(storagePath);
        return true;
      } catch {
        return false;
      }
    }
    
    try {
      const matches = storagePath.match(/^db:\/\/file_storage\/(\d+)$/);
      if (!matches) {
        return false;
      }
      
      const fileId = parseInt(matches[1]);
      
      const result = await db.execute(sql`
        SELECT id FROM file_storage WHERE id = ${fileId} LIMIT 1
      `);
      
      return result.length > 0;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const dbFileStorage = new DatabaseFileStorage();

/* 
SQL to create the file_storage table:

CREATE TABLE file_storage (
  id SERIAL PRIMARY KEY,
  deal_id INTEGER NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_content TEXT NOT NULL, -- Base64 encoded file content
  file_size INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
);

CREATE INDEX idx_file_storage_deal_id ON file_storage(deal_id);
*/