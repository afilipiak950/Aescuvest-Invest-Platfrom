/**
 * Update EnhancedAgentCard to use persistent job manager
 */

import fs from 'fs';
import path from 'path';

function updateEnhancedAgentCard() {
  console.log('🔄 Updating EnhancedAgentCard.tsx to use persistent job manager...');
  
  const filePath = path.join(process.cwd(), 'client/src/components/EnhancedAgentCard.tsx');
  
  if (!fs.existsSync(filePath)) {
    console.error('❌ EnhancedAgentCard.tsx not found');
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Check if file already has persistent job integration
  if (content.includes('persistent-jobs')) {
    console.log('✅ EnhancedAgentCard already has persistent job integration');
    return;
  }
  
  // Add persistent job API endpoints
  const persistentJobImports = `
// Persistent job management endpoints
const PERSISTENT_JOB_ENDPOINTS = {
  startAllAnalyses: (dealId: number) => \`/api/deals/\${dealId}/start-all-analyses\`,
  getJobStatus: (dealId: number) => \`/api/deals/\${dealId}/persistent-jobs-status\`,
  stopJob: (jobId: string) => \`/api/persistent-jobs/\${jobId}/stop\`,
  clearStuckJobs: (dealId: number) => \`/api/deals/\${dealId}/clear-stuck-jobs\`
};
`;
  
  // Find the imports section and add persistent job endpoints
  content = content.replace(
    /import.*from.*react.*;\n/,
    '$&' + persistentJobImports
  );
  
  // Add persistent job manager functionality to the "Reset & Run All Analyses" button
  const persistentJobFunction = `
  // Enhanced "Reset & Run All Analyses" with persistent job manager
  const handleResetAndRunAllAnalysesPersistent = async () => {
    try {
      console.log('🚀 Starting persistent analysis for all 7 agents');
      
      // Clear any stuck jobs first
      const clearResponse = await fetch(PERSISTENT_JOB_ENDPOINTS.clearStuckJobs(dealId), {
        method: 'POST'
      });
      
      if (clearResponse.ok) {
        const clearResult = await clearResponse.json();
        console.log(\`🧹 Cleared \${clearResult.clearedCount} stuck jobs\`);
      }
      
      // Start all analyses with persistent job manager
      const response = await fetch(PERSISTENT_JOB_ENDPOINTS.startAllAnalyses(dealId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ All analyses started with persistent job manager:', result);
        
        toast({
          title: "All Analyses Started",
          description: \`Started \${result.jobs?.filter(j => j.status === 'started').length || 7}/7 AI agents with persistent processing\`,
        });
        
        // Invalidate queries to refresh UI
        queryClient.invalidateQueries({ queryKey: ['/api/background-jobs', dealId] });
        
        // Start monitoring persistent job progress
        monitorPersistentJobProgress();
        
      } else {
        throw new Error('Failed to start persistent analyses');
      }
      
    } catch (error) {
      console.error('❌ Error starting persistent analyses:', error);
      toast({
        title: "Error",
        description: "Failed to start persistent analyses. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Monitor persistent job progress
  const monitorPersistentJobProgress = () => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(PERSISTENT_JOB_ENDPOINTS.getJobStatus(dealId));
        
        if (response.ok) {
          const status = await response.json();
          console.log('📊 Persistent job status:', status);
          
          // Check if all jobs are completed
          const activeJobs = status.activeJobs || [];
          if (activeJobs.length === 0) {
            console.log('✅ All persistent jobs completed');
            clearInterval(pollInterval);
            
            // Refresh all analysis data
            queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
            queryClient.invalidateQueries({ queryKey: ['/api/background-jobs'] });
          }
        }
      } catch (error) {
        console.log('Error monitoring persistent jobs:', error);
      }
    }, 3000); // Poll every 3 seconds
    
    // Clear interval after 30 minutes to avoid infinite polling
    setTimeout(() => clearInterval(pollInterval), 30 * 60 * 1000);
  };
`;
  
  // Find the existing handleResetAndRunAllAnalyses function and add the persistent version after it
  content = content.replace(
    /const handleResetAndRunAllAnalyses = async \(\) => \{[\s\S]*?\};/,
    '$&' + persistentJobFunction
  );
  
  // Update the "Reset & Run All Analyses" button to use persistent job manager
  const buttonReplacement = `
          <Button 
            onClick={handleResetAndRunAllAnalysesPersistent}
            variant="secondary" 
            size="sm"
            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset & Run All Analyses (Persistent)
          </Button>
`;
  
  // Replace the existing button
  content = content.replace(
    /<Button[^>]*onClick={handleResetAndRunAllAnalyses}[\s\S]*?Reset & Run All Analyses[\s\S]*?<\/Button>/,
    buttonReplacement.trim()
  );
  
  // Write the updated content back to the file
  fs.writeFileSync(filePath, content, 'utf-8');
  
  console.log('✅ EnhancedAgentCard.tsx updated with persistent job manager integration');
  console.log('🔄 The "Reset & Run All Analyses" button now uses persistent background processing');
}

// Run the update
updateEnhancedAgentCard();