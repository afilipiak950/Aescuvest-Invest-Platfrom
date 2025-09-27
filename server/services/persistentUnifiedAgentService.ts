/**
 * Persistent Unified Agent Service
 * Provides a unified interface for all agent analyses with consistent architecture
 */

import { storage } from '../storage';
import { universalAgentEngine } from './universalAgentEngine';
import { AGENT_TYPES, type AgentType } from '../../shared/agents';

export class PersistentUnifiedAgentService {
  
  /**
   * Get status for all agents for a deal
   */
  async getAllAgentStatuses(dealId: number) {
    try {
      const statuses: Record<string, any> = {};
      
      for (const agentType of AGENT_TYPES) {
        try {
          // Get latest analysis for this agent type
          const analyses = await storage.getAnalysesByDealId(dealId);
          const agentAnalyses = analyses.filter(a => 
            a.agentType?.toLowerCase() === agentType.toLowerCase()
          );
          
          if (agentAnalyses.length > 0) {
            // Get the most recent analysis
            const latest = agentAnalyses.sort((a, b) => 
              new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
            )[0];
            
            statuses[agentType] = {
              status: latest.status || 'not_started',
              progress: latest.progress || 0,
              createdAt: latest.createdAt,
              hasFindings: (latest.findings && latest.findings.length > 0),
              hasRecommendations: (latest.recommendations && latest.recommendations.length > 0),
              questionCount: this.getQuestionCount(agentType)
            };
          } else {
            statuses[agentType] = {
              status: 'not_started',
              progress: 0,
              createdAt: null,
              hasFindings: false,
              hasRecommendations: false,
              questionCount: this.getQuestionCount(agentType)
            };
          }
        } catch (error) {
          console.error(`Error getting status for ${agentType}:`, error);
          statuses[agentType] = {
            status: 'error',
            progress: 0,
            createdAt: null,
            hasFindings: false,
            hasRecommendations: false,
            questionCount: this.getQuestionCount(agentType)
          };
        }
      }
      
      return statuses;
    } catch (error) {
      console.error('Error getting all agent statuses:', error);
      throw error;
    }
  }
  
  /**
   * Start analysis for all agents
   */
  async startAllAnalyses(dealId: number, forceRerun: boolean = false) {
    try {
      const results: Record<string, any> = {};
      
      for (const agentType of AGENT_TYPES) {
        try {
          const result = await this.startAgentAnalysis(dealId, agentType, forceRerun);
          results[agentType] = result;
        } catch (error) {
          console.error(`Error starting ${agentType} analysis:`, error);
          results[agentType] = {
            success: false,
            error: error.message || `Failed to start ${agentType} analysis`
          };
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error starting all analyses:', error);
      throw error;
    }
  }
  
  /**
   * Get analysis results for a specific agent
   */
  async getAgentAnalysis(dealId: number, agentType: string) {
    try {
      const analyses = await storage.getAnalysesByDealId(dealId);
      const agentAnalyses = analyses.filter(a => 
        a.agentType?.toLowerCase() === agentType.toLowerCase()
      );
      
      if (agentAnalyses.length === 0) {
        return null;
      }
      
      // Get the most recent analysis
      const latest = agentAnalyses.sort((a, b) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      )[0];
      
      return {
        id: latest.id,
        dealId: latest.dealId,
        agentType: latest.agentType,
        status: latest.status,
        progress: latest.progress,
        findings: latest.findings || [],
        recommendations: latest.recommendations || [],
        createdAt: latest.createdAt,
        updatedAt: latest.updatedAt,
        // Include agent-specific answer fields
        answers: this.extractAgentAnswers(latest, agentType)
      };
    } catch (error) {
      console.error(`Error getting ${agentType} analysis:`, error);
      throw error;
    }
  }
  
  /**
   * Start analysis for a specific agent using Universal Agent Engine
   */
  async startAgentAnalysis(dealId: number, agentType: string, forceRerun: boolean = false) {
    try {
      console.log(`🚀 Starting Universal Agent Engine ${agentType} analysis for deal ${dealId} (forceRerun: ${forceRerun})`);
      
      // Delegate to Universal Agent Engine
      const jobKey = await universalAgentEngine.startAgentAnalysis(dealId, agentType, forceRerun);
      
      return {
        success: true,
        message: `${agentType} analysis started for deal ${dealId}`,
        dealId,
        agentType,
        forceRerun,
        jobKey
      };
    } catch (error) {
      console.error(`Error starting ${agentType} analysis:`, error);
      throw error;
    }
  }
  
  /**
   * Get question count for each agent type
   */
  private getQuestionCount(agentType: string): number {
    const questionCounts = {
      'legal': 13,
      'clinical': 11, 
      'commercial': 11,
      'hr': 12,
      'financial': 12,
      'ip': 12,
      'research': 19
    };
    
    return questionCounts[agentType as keyof typeof questionCounts] || 10;
  }
  
  /**
   * Extract agent-specific answer fields from analysis
   */
  private extractAgentAnswers(analysis: any, agentType: string) {
    const agentLower = agentType.toLowerCase();
    
    switch (agentLower) {
      case 'legal':
        return analysis.legalAnswers;
      case 'clinical':
        return analysis.clinicalAnswers;
      case 'commercial':
        return analysis.commercialAnswers;
      case 'hr':
        return analysis.hrAnswers;
      case 'financial':
        return analysis.financialAnswers;
      case 'ip':
        return analysis.ipAnswers;
      case 'research':
        return analysis.researchAnswers;
      default:
        return null;
    }
  }
}

// Export singleton instance
export const persistentUnifiedAgentService = new PersistentUnifiedAgentService();