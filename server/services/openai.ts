import OpenAI from "openai";
import { bulletproofRateLimiter } from './bulletproofRateLimiter';

// Initialize the OpenAI client with the API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// This is the newest OpenAI model (May 2024) which provides the best performance
const DEFAULT_MODEL = "gpt-4o";

/**
 * Generate a response from the AI based on a system prompt and user message
 * @param systemPrompt The system instructions for the AI
 * @param userMessage The user message or data to process
 * @param options Additional options for the API call
 * @returns The AI-generated response text
 */
export async function generateResponse(
  systemPrompt: string,
  userMessage: string,
  options: {
    model?: string;
    temperature?: number;
    jsonResponse?: boolean;
  } = {}
): Promise<string> {
  try {
    const { model = DEFAULT_MODEL, temperature = 0.7, jsonResponse = false } = options;
    
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ];
    
    const apiOptions: any = {
      model,
      messages,
      temperature
    };
    
    // If JSON response is requested, specify the response format
    if (jsonResponse) {
      apiOptions.response_format = { type: "json_object" };
    }
    
    // Enhanced rate limiting with token bucket algorithm
    await bulletproofRateLimiter.waitForRateLimit('openai');
    
    const response = await openai.chat.completions.create(apiOptions);
    
    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error(`Failed to generate AI response: ${error.message}`);
  }
}

/**
 * Analyze a document using the OpenAI API
 * @param documentContent The text content of the document
 * @param analysisPrompt Instructions for how to analyze the document
 * @param options Additional options for the API call
 * @returns Analysis results as specified by the prompt
 */
export async function analyzeDocument(
  documentContent: string,
  analysisPrompt: string,
  options: {
    model?: string;
    temperature?: number;
    jsonResponse?: boolean;
  } = {}
): Promise<string> {
  const systemPrompt = `You are an expert document analyzer with deep expertise in venture capital, startup assessment, and due diligence. ${analysisPrompt}`;
  return generateResponse(systemPrompt, documentContent, options);
}

/**
 * Generate a summary or analysis of a deal
 * @param dealData The deal data to analyze
 * @param purpose The purpose of the analysis (e.g., "teaser", "risk-assessment", etc.)
 * @param options Additional options for the API call
 * @returns Generated text based on the purpose and deal data
 */
export async function analyzeDeal(
  dealData: any,
  purpose: string,
  options: {
    model?: string;
    temperature?: number;
    jsonResponse?: boolean;
  } = {}
): Promise<string> {
  const purposeMap: Record<string, string> = {
    "teaser": "Create a concise, compelling investment teaser that highlights the key value proposition, market opportunity, and investment thesis without revealing confidential information. The teaser should be professional, engaging, and designed to attract investor interest.",
    "risk-assessment": "Conduct a thorough risk assessment of this investment opportunity. Identify and evaluate key risks across clinical, commercial, financial, legal, and competitive dimensions. Prioritize risks by potential impact and likelihood.",
    "investor-match": "Evaluate what type of investors would be most suitable for this opportunity. Consider stage preferences, sector focus, check size, strategic alignment, and potential value-add capabilities."
  };
  
  const instruction = purposeMap[purpose] || 
    "Analyze this investment opportunity and provide valuable insights for the investment team.";
  
  const systemPrompt = `You are an expert venture capital analyst specializing in healthcare investments. ${instruction}`;
  return generateResponse(systemPrompt, JSON.stringify(dealData), {
    ...options,
    temperature: options.temperature || 0.4 // Lower temperature for more consistent analytical output
  });
}

/**
 * Draft a professional communication based on the specified template and data
 * @param templateType The type of communication template to use
 * @param data The data to incorporate into the communication
 * @param options Additional options for the API call
 * @returns The drafted communication text
 */
export async function draftCommunication(
  templateType: string,
  data: any,
  options: {
    model?: string;
    temperature?: number;
  } = {}
): Promise<string> {
  const templateMap: Record<string, string> = {
    "rejection": "Draft a polite and professional rejection email that maintains the relationship for future opportunities. Be specific enough to show we reviewed their materials but vague enough not to provide actionable feedback.",
    "more-info": "Draft a professional email requesting additional information or materials. Be specific about what we need and why it matters for our evaluation process.",
    "follow-up": "Draft a follow-up email checking on the status of our previous request. Be polite but direct about what we're still waiting for.",
    "meeting-request": "Draft an email to schedule a meeting. Include brief context on what we'd like to discuss and suggest a timeframe.",
    "investor-intro": "Draft an email introducing this investment opportunity to a potential investor. Be compelling while maintaining professionalism."
  };
  
  const instruction = templateMap[templateType] || 
    "Draft a professional communication that achieves the necessary objective while maintaining a courteous and professional tone.";
  
  const systemPrompt = `You are an expert communication specialist at a prestigious venture capital firm. ${instruction}
  
Your writing should be:
- Clear and concise
- Professional but warm
- Free of jargon unless industry-appropriate
- Actionable with clear next steps if needed
- Reflective of the Aescuvest brand voice which is sophisticated, precise, and forward-thinking`;

  return generateResponse(systemPrompt, JSON.stringify(data), {
    ...options,
    temperature: options.temperature || 0.7 // Moderate temperature for creative but professional communication
  });
}

/**
 * Extract structured information from unstructured text like emails or documents
 * @param text The text to extract information from
 * @param extractionGoal Description of what information to extract
 * @param options Additional options for the API call
 * @returns Structured information in JSON format
 */
export async function extractInformation(
  text: string,
  extractionGoal: string,
  options: {
    model?: string;
    temperature?: number;
  } = {}
): Promise<any> {
  const systemPrompt = `You are an expert data extraction specialist. Extract the following information from the provided text: ${extractionGoal}
  
Respond ONLY with a JSON object containing the extracted information. If certain information is not available, use null for those fields.`;

  const response = await generateResponse(systemPrompt, text, {
    ...options,
    jsonResponse: true,
    temperature: options.temperature || 0.1 // Low temperature for consistent extraction
  });
  
  try {
    return JSON.parse(response);
  } catch (error) {
    console.error("Failed to parse extracted information as JSON:", error);
    return { error: "Failed to extract structured information", rawResponse: response };
  }
}

export default {
  generateResponse,
  analyzeDocument,
  analyzeDeal,
  draftCommunication,
  extractInformation
};