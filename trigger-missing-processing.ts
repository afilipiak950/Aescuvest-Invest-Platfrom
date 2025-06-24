import { db } from './server/db';
import { documents } from './shared/schema';
import { eq, and, isNull } from 'drizzle-orm';

async function triggerMissingProcessing() {
  console.log('Triggering OCR and AI processing for remaining documents...');
  
  // Get documents without OCR text or AI summaries
  const pendingDocs = await db.select()
    .from(documents)
    .where(
      and(
        eq(documents.dealId, 22),
        isNull(documents.aiSummary)
      )
    );
  
  console.log(`Found ${pendingDocs.length} documents needing processing`);
  
  let processedCount = 0;
  
  for (const doc of pendingDocs) {
    try {
      console.log(`Processing ${++processedCount}/${pendingDocs.length}: ${doc.name}`);
      
      // Reset document to pending status to trigger background processing
      await db.update(documents)
        .set({ 
          status: 'Pending',
          aiSummaryStatus: 'pending'
        })
        .where(eq(documents.id, doc.id));
      
      console.log(`Set ${doc.name} to pending for processing`);
      
    } catch (error) {
      console.error(`Failed to reset document ${doc.id}:`, error);
    }
  }
  
  console.log(`Reset ${processedCount} documents to pending status`);
  console.log('Documents will now be processed by the background system');
  
  // Trigger the manual processing endpoint
  try {
    const response = await fetch('http://localhost:5000/api/deals/22/process-ai-summaries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Manual processing trigger result:', result);
  } catch (error) {
    console.log('Manual processing trigger failed:', error);
  }
}

triggerMissingProcessing().catch(console.error);