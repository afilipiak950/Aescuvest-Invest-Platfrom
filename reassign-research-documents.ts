/**
 * Script to reassign documents to Research agent based on enhanced criteria
 */
import { db } from './server/db';
import { documents } from './shared/schema';
import { eq } from 'drizzle-orm';

async function reassignResearchDocuments() {
  console.log('🔬 Starting Research agent document reassignment...');
  
  try {
    // Get all documents for deal 33 with AI summaries
    const allDocs = await db
      .select()
      .from(documents)
      .where(eq(documents.dealId, 33));
    
    console.log(`📄 Found ${allDocs.length} documents to analyze`);
    
    let reassignedCount = 0;
    let newResearchCount = 0;
    
    for (const doc of allDocs) {
      if (!doc.aiSummary) continue;
      
      const summaryText = JSON.stringify(doc.aiSummary).toLowerCase();
      const docName = doc.name.toLowerCase();
      
      // Enhanced Research agent criteria (same as in routes.ts)
      const isResearchRelevant = (
        summaryText.includes('research') || summaryText.includes('development') || summaryText.includes('r&d') ||
        summaryText.includes('innovation') || summaryText.includes('technology') || summaryText.includes('study') ||
        summaryText.includes('technical') || summaryText.includes('whitepaper') || summaryText.includes('academic') ||
        summaryText.includes('scientific') || summaryText.includes('methodology') || summaryText.includes('analysis') ||
        summaryText.includes('findings') || summaryText.includes('data') || summaryText.includes('algorithm') ||
        summaryText.includes('experiment') || summaryText.includes('validation') || summaryText.includes('testing') ||
        summaryText.includes('performance') || summaryText.includes('benchmark') || summaryText.includes('evaluation') ||
        summaryText.includes('publication') || summaryText.includes('journal') || summaryText.includes('paper') ||
        summaryText.includes('citation') || summaryText.includes('peer review') || summaryText.includes('conference') ||
        summaryText.includes('collaboration') || summaryText.includes('university') || summaryText.includes('institute') ||
        summaryText.includes('lab') || summaryText.includes('laboratory') || summaryText.includes('protocol') ||
        summaryText.includes('dataset') || summaryText.includes('model') || summaryText.includes('simulation') ||
        summaryText.includes('classification') || summaryText.includes('detection') || summaryText.includes('accuracy') ||
        summaryText.includes('precision') || summaryText.includes('sensitivity') || summaryText.includes('specificity') ||
        docName.includes('research') || docName.includes('whitepaper') || docName.includes('technical') ||
        docName.includes('study') || docName.includes('analysis') || docName.includes('report') ||
        docName.includes('data') || docName.includes('test') || docName.includes('evaluation') ||
        docName.includes('performance') || docName.includes('algorithm') || docName.includes('model') ||
        docName.includes('validation') || docName.includes('benchmark') || docName.includes('experiment') ||
        docName.includes('case') || docName.includes('publication') || docName.includes('paper') ||
        docName.includes('journal') || docName.includes('academic') || docName.includes('scientific')
      );
      
      if (isResearchRelevant) {
        const currentAgents = Array.isArray(doc.assignedAgents) ? doc.assignedAgents : [];
        const hasResearch = currentAgents.includes('Research');
        
        if (!hasResearch) {
          // Add Research agent to existing assignments
          const newAgents = [...currentAgents, 'Research'];
          
          await db
            .update(documents)
            .set({ assignedAgents: newAgents })
            .where(eq(documents.id, doc.id));
          
          newResearchCount++;
          console.log(`✅ Added Research agent to: ${doc.name}`);
        }
        
        reassignedCount++;
      }
    }
    
    console.log(`🎉 Reassignment completed!`);
    console.log(`📊 Total research-relevant documents: ${reassignedCount}`);
    console.log(`🔬 New Research agent assignments: ${newResearchCount}`);
    console.log(`📈 Research agent coverage increased from 3 to ${reassignedCount} documents`);
    
  } catch (error) {
    console.error('❌ Error during reassignment:', error);
  } finally {
    process.exit(0);
  }
}

reassignResearchDocuments();