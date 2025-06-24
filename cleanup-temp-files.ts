import * as fs from 'fs';

// Clean up temporary processing files
const filesToRemove = [
  'complete-missing-analysis.ts',
  'fix-remaining-ai-summaries.ts',
  'trigger-missing-processing.ts',
  'force-ocr-processing.ts',
  'simple-completion-fix.ts',
  'cleanup-temp-files.ts'
];

console.log('Cleaning up temporary processing files...');

filesToRemove.forEach(file => {
  try {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`Removed: ${file}`);
    }
  } catch (error) {
    console.log(`Could not remove ${file}:`, error);
  }
});

console.log('Cleanup complete');