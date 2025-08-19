import fs from 'fs';
import AdmZip from 'adm-zip';

// Create a proper ZIP file for testing
const zip = new AdmZip();

// Add test content
zip.addFile("document1.txt", Buffer.from("Test document 1 content for background upload testing"));
zip.addFile("document2.txt", Buffer.from("Test document 2 content for ZIP processing validation"));
zip.addFile("legal-agreement.txt", Buffer.from("Legal agreement content with contract terms and conditions"));

// Write the ZIP file
zip.writeZip("test-proper.zip");

console.log('✅ Created test-proper.zip with 3 documents');
console.log('📦 File size:', fs.statSync('test-proper.zip').size, 'bytes');