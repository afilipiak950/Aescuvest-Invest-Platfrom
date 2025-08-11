/**
 * Complete Research Answers Generator
 * Ensures ALL research questions get proper answers, even when no data is available
 */

export async function generateCompleteResearchAnswers(dealId: number, storage: any): Promise<void> {
  console.log(`🔬 Generating complete research answers for deal ${dealId}`);
  
  // Get existing research analysis
  const existingAnalysis = await storage.getAgentAnalysisByDealAndType(dealId, 'research');
  if (!existingAnalysis) {
    console.log('❌ No existing research analysis found');
    return;
  }
  
  // Parse existing research answers
  let existingAnswers = {};
  try {
    if (existingAnalysis.research_answers) {
      existingAnswers = typeof existingAnalysis.research_answers === 'string' 
        ? JSON.parse(existingAnalysis.research_answers)
        : existingAnalysis.research_answers;
    }
  } catch (error) {
    console.log('⚠️ Error parsing existing research answers:', error);
  }
  
  // Complete set of all 13 research questions
  const ALL_RESEARCH_QUESTIONS = [
    { id: 'res_1', question: 'What research methodology and scientific approach is used?', category: 'Technical Methodology' },
    { id: 'res_2', question: 'What peer-reviewed publications and citations exist?', category: 'Academic Publications' },
    { id: 'res_3', question: 'What research partnerships and collaborations are present?', category: 'Academic Publications' },
    { id: 'res_4', question: 'What data quality and validation has been performed?', category: 'Technical Methodology' },
    { id: 'res_5', question: 'What research competitive advantages exist?', category: 'Technical Innovation' },
    { id: 'res_6', question: 'Are there citations in high-impact journals (Nature, Science, Cell)?', category: 'Academic Publications' },
    { id: 'res_7', question: 'What is the h-index and citation count of key publications?', category: 'Academic Publications' },
    { id: 'res_8', question: 'Are there collaborations with leading academic institutions?', category: 'Academic Publications' },
    { id: 'res_9', question: 'What is the total addressable market (TAM) size?', category: 'Market Research' },
    { id: 'res_10', question: 'Who are the main competitors and what is their market share?', category: 'Market Research' },
    { id: 'res_11', question: 'What are the market growth projections and key drivers?', category: 'Market Research' },
    { id: 'res_12', question: 'What is the freedom-to-operate (FTO) analysis result?', category: 'Patent Landscape' },
    { id: 'res_13', question: 'Are there any patent disputes or prior art challenges?', category: 'Patent Landscape' }
  ];
  
  // Build complete answers object
  const completeAnswers = { ...existingAnswers };
  
  // Fill in missing questions with proper "no information" responses
  for (const questionConfig of ALL_RESEARCH_QUESTIONS) {
    if (!completeAnswers[questionConfig.id]) {
      completeAnswers[questionConfig.id] = {
        question: questionConfig.question,
        category: questionConfig.category,
        answer: `No specific information found in the analyzed documents regarding ${questionConfig.question.toLowerCase()}. This analysis was conducted on the available document set, but additional research documentation may be needed to provide comprehensive insights for this question.`,
        evidence: [],
        keyFindings: [`No evidence available for: ${questionConfig.question}`],
        recommendations: [`Request additional documentation related to ${questionConfig.category.toLowerCase()}`, `Conduct targeted research to address this question`],
        confidence: 0,
        sources: [],
        gaps: [`Missing information: ${questionConfig.question}`],
        crossReferences: []
      };
    }
  }
  
  // Update the database with complete answers
  const updateData = {
    research_answers: JSON.stringify(completeAnswers),
    status: 'Completed',
    updatedAt: new Date()
  };
  
  await storage.updateAgentAnalysis(existingAnalysis.id, updateData);
  
  console.log(`✅ Updated research analysis with complete answers for all ${ALL_RESEARCH_QUESTIONS.length} questions`);
  console.log(`📊 Questions with data: ${Object.keys(existingAnswers).length}, Missing filled: ${ALL_RESEARCH_QUESTIONS.length - Object.keys(existingAnswers).length}`);
}