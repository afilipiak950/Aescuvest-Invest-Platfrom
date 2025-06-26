import { storage } from './server/storage';
import { persistentJobManager } from './server/services/persistentJobManager';

async function restartAllAgents() {
  const dealId = 22;
  console.log(`🔄 Restarting all agent analyses for deal ${dealId}`);
  
  try {
    // Get documents for the deal
    const documents = await storage.getDocumentsByDealId(dealId);
    console.log(`📄 Found ${documents.length} documents for deal ${dealId}`);
    
    // Get existing analyses to see which agents are missing
    const existingAnalyses = await storage.getAnalysesByDealId(dealId);
    const completedAgents = existingAnalyses.map(a => a.agentType.toLowerCase());
    console.log(`✅ Existing completed agents: ${completedAgents.join(', ')}`);
    
    // All agent types
    const allAgents = ['clinical', 'legal', 'commercial', 'hr', 'financial', 'ip', 'research'];
    const missingAgents = allAgents.filter(agent => !completedAgents.includes(agent));
    console.log(`⏳ Missing agents to restart: ${missingAgents.join(', ')}`);
    
    // First reset any existing jobs for this deal
    await persistentJobManager.resetAllJobsForDeal(dealId);
    
    // Start persistent background jobs for each missing agent
    for (const agentType of missingAgents) {
      try {
        console.log(`🚀 Starting ${agentType} agent analysis...`);
        const jobId = await persistentJobManager.startAgentAnalysisJob(dealId, agentType, documents.length);
        console.log(`✅ Started background job ${jobId} for ${agentType} agent`);
      } catch (error) {
        console.error(`❌ Failed to start ${agentType} agent:`, error);
      }
    }
    
    console.log(`🎉 Successfully restarted ${missingAgents.length} missing agents`);
    
  } catch (error) {
    console.error('❌ Failed to restart agents:', error);
  }
}

// Run the restart
restartAllAgents().then(() => {
  console.log('✅ Agent restart process completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Agent restart failed:', error);
  process.exit(1);
});