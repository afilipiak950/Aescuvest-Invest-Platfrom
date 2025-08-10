import { OptimizedDocumentProcessor } from './optimizedDocumentProcessor';
import { storage } from '../storage';
import pLimit from 'p-limit';

/**
 * Bulk Analysis Processor for handling 500+ documents efficiently
 * 
 * Key optimizations:
 * 1. Single document ingestion pass (no redundant parsing)
 * 2. Parallel agent processing using summaries
 * 3. Intelligent document filtering based on relevance
 * 4. Batched database operations
 * 5. Comprehensive error handling and recovery
 */
export class BulkAnalysisProcessor {
  private processor = new OptimizedDocumentProcessor();
  private batchLimit = pLimit(5); // Process 5 batches concurrently
  
  async processAllAgentsForDeal(dealId: number, forceRefresh = false): Promise<{
    success: boolean;
    results: Map<string, any>;
    metrics: {
      totalDocuments: number;
      totalProcessingTime: number;
      documentsPerMinute: number;
      successRate: number;
      agentResults: { [key: string]: { findings: number; recommendations: number; documentsAnalyzed: number } };
    };
  }> {
    console.log(`🚀 Starting bulk analysis for deal ${dealId} with optimized pipeline`);
    const startTime = Date.now();

    try {
      // Get all documents for the deal
      const documents = await storage.getDocumentsByDealId(dealId);
      console.log(`📄 Found ${documents.length} documents for deal ${dealId}`);

      if (documents.length === 0) {
        return {
          success: true,
          results: new Map(),
          metrics: {
            totalDocuments: 0,
            totalProcessingTime: 0,
            documentsPerMinute: 0,
            successRate: 100,
            agentResults: {}
          }
        };
      }

      // Stage 1: Generate summaries for ALL documents in parallel (single pass)
      console.log('📋 Stage 1: Generating document summaries in parallel...');
      const summaryStartTime = Date.now();
      const summaryMap = await this.processor.generateDocumentSummaries(documents);
      const summaryTime = Date.now() - summaryStartTime;
      console.log(`✅ Stage 1 complete: ${summaryMap.size}/${documents.length} summaries in ${summaryTime/1000}s`);

      // Stage 2: Run ALL agents in parallel using the same summaries
      console.log('🤖 Stage 2: Running all 7 agents in parallel...');
      const agentTypes = ['Clinical', 'Legal', 'Commercial', 'HR', 'Financial', 'IP', 'Research'];
      const agentStartTime = Date.now();
      
      const agentResults = await this.processor.runAllAgentsInParallel(
        documents, 
        summaryMap, 
        agentTypes
      );
      
      const agentTime = Date.now() - agentStartTime;
      console.log(`✅ Stage 2 complete: ${agentResults.size}/${agentTypes.length} agents in ${agentTime/1000}s`);

      // Stage 3: Save all results to database in batches
      console.log('💾 Stage 3: Saving results to database...');
      const saveStartTime = Date.now();
      await this.saveAllResults(dealId, agentResults);
      const saveTime = Date.now() - saveStartTime;
      console.log(`✅ Stage 3 complete: All results saved in ${saveTime/1000}s`);

      // Calculate final metrics
      const totalProcessingTime = Date.now() - startTime;
      const documentsPerMinute = (documents.length / totalProcessingTime) * 60 * 1000;
      const successfulAgents = Array.from(agentResults.values()).filter(r => !r.error).length;
      const successRate = (successfulAgents / agentTypes.length) * 100;

      // Build agent results metrics
      const agentResultsMetrics: { [key: string]: any } = {};
      for (const [agentType, result] of agentResults) {
        agentResultsMetrics[agentType] = {
          findings: result.findings?.length || 0,
          recommendations: result.recommendations?.length || 0,
          documentsAnalyzed: result.documentsAnalyzed || 0,
          error: result.error || null
        };
      }

      const finalMetrics = {
        totalDocuments: documents.length,
        totalProcessingTime: totalProcessingTime,
        documentsPerMinute: documentsPerMinute,
        successRate: successRate,
        agentResults: agentResultsMetrics,
        timing: {
          summaryGeneration: summaryTime,
          agentProcessing: agentTime,
          databaseSaving: saveTime,
          total: totalProcessingTime
        }
      };

      console.log('🎯 BULK ANALYSIS COMPLETE');
      console.log(`📊 ${documents.length} documents processed in ${(totalProcessingTime/1000).toFixed(1)}s`);
      console.log(`🚀 Throughput: ${documentsPerMinute.toFixed(1)} docs/minute`);
      console.log(`✅ Success rate: ${successRate.toFixed(1)}%`);

      return {
        success: true,
        results: agentResults,
        metrics: finalMetrics
      };

    } catch (error) {
      console.error(`❌ Bulk analysis failed for deal ${dealId}:`, error);
      
      const totalProcessingTime = Date.now() - startTime;
      return {
        success: false,
        results: new Map(),
        metrics: {
          totalDocuments: 0,
          totalProcessingTime: totalProcessingTime,
          documentsPerMinute: 0,
          successRate: 0,
          agentResults: {},
          error: error.message
        }
      };
    }
  }

  private async saveAllResults(dealId: number, agentResults: Map<string, any>): Promise<void> {
    const savePromises = Array.from(agentResults.entries()).map(([agentType, result]) =>
      this.batchLimit(() => this.saveAgentResult(dealId, agentType, result))
    );

    const saveResults = await Promise.allSettled(savePromises);
    
    let successfulSaves = 0;
    saveResults.forEach((result, index) => {
      const agentType = Array.from(agentResults.keys())[index];
      if (result.status === 'fulfilled') {
        successfulSaves++;
        console.log(`✅ Saved ${agentType} results`);
      } else {
        console.error(`❌ Failed to save ${agentType} results:`, result.reason);
      }
    });

    console.log(`💾 Saved ${successfulSaves}/${agentResults.size} agent results`);
  }

  private async saveAgentResult(dealId: number, agentType: string, result: any): Promise<void> {
    if (result.error) {
      console.log(`⚠️ Skipping save for ${agentType} due to processing error: ${result.error}`);
      return;
    }

    try {
      // Clear existing analysis for this agent type
      await storage.clearAgentAnalysis(dealId, agentType);
      
      // Save new analysis
      const analysisData = {
        dealId,
        agentType: agentType,
        status: 'Completed',
        progress: 100,
        findings: result.findings || [],
        recommendations: result.recommendations || [],
        processedAt: new Date(),
        processingStats: {
          documentsAnalyzed: result.documentsAnalyzed || 0,
          totalFindings: result.findings?.length || 0,
          totalRecommendations: result.recommendations?.length || 0
        }
      };

      await storage.createAgentAnalysis(analysisData);
      console.log(`💾 Saved ${agentType} analysis: ${analysisData.processingStats.totalFindings} findings, ${analysisData.processingStats.totalRecommendations} recommendations`);

    } catch (error) {
      console.error(`❌ Failed to save ${agentType} analysis:`, error);
      throw error;
    }
  }

  // Performance testing method for different document counts
  async performanceTest(dealId: number, documentCounts: number[] = [5, 50, 100]): Promise<any[]> {
    console.log('🧪 Starting performance tests...');
    
    const results = [];
    
    for (const count of documentCounts) {
      console.log(`📊 Testing with ${count} documents...`);
      
      try {
        // Get limited document set
        const allDocuments = await storage.getDocumentsByDealId(dealId);
        const testDocuments = allDocuments.slice(0, count);
        
        const startTime = Date.now();
        const summaryMap = await this.processor.generateDocumentSummaries(testDocuments);
        const agentResults = await this.processor.runAllAgentsInParallel(
          testDocuments, 
          summaryMap, 
          ['Clinical', 'Legal', 'Commercial', 'HR', 'Financial', 'IP', 'Research']
        );
        const totalTime = Date.now() - startTime;
        
        const result = {
          documentCount: count,
          processingTimeMs: totalTime,
          processingTimeMinutes: totalTime / 1000 / 60,
          documentsPerMinute: (count / totalTime) * 60 * 1000,
          successfulAgents: agentResults.size,
          totalFindings: Array.from(agentResults.values()).reduce((sum, r) => sum + (r.findings?.length || 0), 0),
          totalRecommendations: Array.from(agentResults.values()).reduce((sum, r) => sum + (r.recommendations?.length || 0), 0)
        };
        
        results.push(result);
        console.log(`✅ ${count} docs: ${(totalTime/1000).toFixed(1)}s, ${result.documentsPerMinute.toFixed(1)} docs/min`);
        
      } catch (error) {
        console.error(`❌ Performance test failed for ${count} documents:`, error);
        results.push({
          documentCount: count,
          error: error.message,
          failed: true
        });
      }
    }
    
    console.log('🎯 Performance test complete');
    return results;
  }
}

export default BulkAnalysisProcessor;