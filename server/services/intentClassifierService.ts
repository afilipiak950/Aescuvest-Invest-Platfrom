import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Define intent categories that map to our agent types
export interface IntentCategory {
  name: string;
  agentTypes: string[];
  keywords: string[];
  description: string;
}

export const INTENT_CATEGORIES: IntentCategory[] = [
  {
    name: 'clinical',
    agentTypes: ['Clinical'],
    keywords: ['clinical', 'medical', 'trial', 'study', 'patient', 'efficacy', 'safety', 'fda', 'regulatory', 'adverse', 'endpoint', 'protocol', 'enrollment', 'biomarker', 'therapeutic'],
    description: 'Clinical trials, medical data, safety profiles, regulatory approvals, patient outcomes'
  },
  {
    name: 'legal',
    agentTypes: ['Legal'],
    keywords: ['legal', 'contract', 'agreement', 'compliance', 'liability', 'patent', 'license', 'regulation', 'lawsuit', 'dispute', 'terms', 'conditions', 'intellectual property', 'copyright'],
    description: 'Legal agreements, contracts, compliance, intellectual property, regulatory matters'
  },
  {
    name: 'financial',
    agentTypes: ['Financial'],
    keywords: ['financial', 'revenue', 'profit', 'cost', 'budget', 'funding', 'investment', 'valuation', 'cash flow', 'earnings', 'expenses', 'roi', 'margin', 'growth', 'burn rate'],
    description: 'Financial performance, revenue models, costs, funding, investment metrics'
  },
  {
    name: 'commercial',
    agentTypes: ['Commercial'],
    keywords: ['market', 'competition', 'customer', 'sales', 'pricing', 'strategy', 'business model', 'marketing', 'distribution', 'partnership', 'channel', 'go-to-market', 'product-market fit'],
    description: 'Market analysis, competitive landscape, business strategy, sales and marketing'
  },
  {
    name: 'ip',
    agentTypes: ['IP'],
    keywords: ['patent', 'intellectual property', 'trademark', 'copyright', 'trade secret', 'invention', 'prior art', 'claims', 'filing', 'prosecution', 'portfolio', 'freedom to operate'],
    description: 'Intellectual property portfolio, patents, trademarks, IP strategy'
  },
  {
    name: 'research',
    agentTypes: ['Research'],
    keywords: ['research', 'development', 'r&d', 'innovation', 'technology', 'science', 'methodology', 'data', 'results', 'findings', 'publication', 'peer review', 'validation'],
    description: 'Research and development activities, scientific methodology, innovation pipeline'
  },
  {
    name: 'hr',
    agentTypes: ['HR'],
    keywords: ['team', 'employee', 'founder', 'management', 'leadership', 'talent', 'hiring', 'compensation', 'culture', 'organization', 'executive', 'board', 'experience', 'background'],
    description: 'Team composition, leadership experience, organizational structure, talent assessment'
  }
];

// Fast keyword-based classification for common queries
export class KeywordClassifier {
  static classifyByKeywords(query: string): string[] {
    const queryLower = query.toLowerCase();
    const relevantCategories: string[] = [];
    
    for (const category of INTENT_CATEGORIES) {
      const matchCount = category.keywords.filter(keyword => 
        queryLower.includes(keyword.toLowerCase())
      ).length;
      
      // If 20% or more keywords match, consider it relevant
      if (matchCount / category.keywords.length >= 0.2 || matchCount >= 2) {
        relevantCategories.push(category.name);
      }
    }
    
    return relevantCategories;
  }
}

// AI-powered intent classification for complex queries
export class AIIntentClassifier {
  static async classifyIntent(query: string): Promise<{
    categories: string[];
    confidence: number;
    reasoning: string;
  }> {
    try {
      const prompt = `Analyze this investment due diligence query and determine which categories are most relevant:

QUERY: "${query}"

AVAILABLE CATEGORIES:
${INTENT_CATEGORIES.map(cat => `- ${cat.name.toUpperCase()}: ${cat.description}`).join('\n')}

Instructions:
1. Identify the 1-3 most relevant categories for this query
2. Rate your confidence (0.0-1.0)
3. Provide brief reasoning

Respond in JSON format:
{
  "categories": ["category1", "category2"],
  "confidence": 0.95,
  "reasoning": "Brief explanation of why these categories were selected"
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Use non-deprecated model
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 200
      }, {
        timeout: 10000 // Fast 10s timeout for classification
      });

      const content = response.choices[0].message.content?.trim();
      if (!content) {
        throw new Error('Empty response from AI classifier');
      }

      try {
        // 🔧 CRITICAL FIX: Strip markdown code fences before parsing JSON
        const cleanContent = content.replace(/```json\s*|\s*```/g, '').trim();
        const result = JSON.parse(cleanContent);
        
        // Validate the result
        if (!Array.isArray(result.categories) || typeof result.confidence !== 'number') {
          throw new Error('Invalid response format');
        }
        
        // Filter to valid categories only
        const validCategories = result.categories.filter(cat => 
          INTENT_CATEGORIES.some(ic => ic.name === cat)
        );
        
        return {
          categories: validCategories,
          confidence: Math.max(0, Math.min(1, result.confidence)),
          reasoning: result.reasoning || 'AI classification completed'
        };
      } catch (parseError) {
        console.warn('Failed to parse AI classifier response:', parseError);
        throw parseError;
      }
    } catch (error) {
      console.error('AI intent classification failed:', error);
      throw error;
    }
  }
}

// Hybrid classifier that combines keyword and AI approaches
export class IntentClassifierService {
  /**
   * Classify query intent using hybrid approach:
   * 1. Fast keyword matching for obvious cases
   * 2. AI classification for complex queries
   * 3. Fallback to all categories if unclear
   */
  static async classifyQuery(query: string): Promise<{
    categories: string[];
    method: 'keyword' | 'ai' | 'fallback';
    confidence: number;
    agentTypes: string[];
    reasoning?: string;
  }> {
    console.log(`🎯 Classifying intent for query: "${query.substring(0, 100)}..."`);
    
    // Step 1: Try fast keyword classification
    const keywordCategories = KeywordClassifier.classifyByKeywords(query);
    
    if (keywordCategories.length > 0 && keywordCategories.length <= 3) {
      console.log(`⚡ Fast keyword classification: ${keywordCategories.join(', ')}`);
      
      const agentTypes = this.categoriesToAgentTypes(keywordCategories);
      return {
        categories: keywordCategories,
        method: 'keyword',
        confidence: 0.8,
        agentTypes,
        reasoning: `Keyword-based classification identified relevant categories`
      };
    }
    
    // Step 2: Use AI for complex or ambiguous queries
    try {
      console.log(`🤖 Using AI classification for complex query...`);
      const aiResult = await AIIntentClassifier.classifyIntent(query);
      
      if (aiResult.categories.length > 0) {
        const agentTypes = this.categoriesToAgentTypes(aiResult.categories);
        console.log(`✅ AI classification: ${aiResult.categories.join(', ')} (confidence: ${aiResult.confidence})`);
        
        return {
          categories: aiResult.categories,
          method: 'ai',
          confidence: aiResult.confidence,
          agentTypes,
          reasoning: aiResult.reasoning
        };
      }
    } catch (error) {
      console.warn('AI classification failed, falling back to all categories');
    }
    
    // Step 3: Fallback to all categories if classification fails
    console.log(`🔄 Fallback: Using all categories for broad search`);
    const allAgentTypes = INTENT_CATEGORIES.flatMap(cat => cat.agentTypes);
    
    return {
      categories: INTENT_CATEGORIES.map(cat => cat.name),
      method: 'fallback',
      confidence: 0.3,
      agentTypes: allAgentTypes,
      reasoning: 'Classification was unclear, searching all categories'
    };
  }

  /**
   * Convert category names to agent types for database filtering
   */
  private static categoriesToAgentTypes(categories: string[]): string[] {
    const agentTypes = new Set<string>();
    
    for (const categoryName of categories) {
      const category = INTENT_CATEGORIES.find(cat => cat.name === categoryName);
      if (category) {
        category.agentTypes.forEach(type => agentTypes.add(type));
      }
    }
    
    return Array.from(agentTypes);
  }

  /**
   * Get human-readable description of classified intent
   */
  static getIntentDescription(categories: string[]): string {
    if (categories.length === 0) return 'General investment analysis';
    
    const descriptions = categories.map(cat => {
      const category = INTENT_CATEGORIES.find(c => c.name === cat);
      return category ? category.description : cat;
    });
    
    if (descriptions.length === 1) {
      return descriptions[0];
    } else if (descriptions.length === 2) {
      return `${descriptions[0]} and ${descriptions[1]}`;
    } else {
      return `${descriptions.slice(0, -1).join(', ')}, and ${descriptions[descriptions.length - 1]}`;
    }
  }

  /**
   * Calculate performance metrics for intent classification
   */
  static calculateSpaceReduction(totalDocuments: number, filteredDocuments: number): {
    reductionPercentage: number;
    documentsFiltered: number;
    documentsSearched: number;
  } {
    const documentsFiltered = Math.max(0, totalDocuments - filteredDocuments);
    const reductionPercentage = totalDocuments > 0 ? (documentsFiltered / totalDocuments) * 100 : 0;
    
    return {
      reductionPercentage: Math.round(reductionPercentage * 10) / 10, // Round to 1 decimal
      documentsFiltered,
      documentsSearched: filteredDocuments
    };
  }
}