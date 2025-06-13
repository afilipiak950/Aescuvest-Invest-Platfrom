import OpenAI from "openai";
import { InsertDeal } from "@shared/schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ParsedEmailData {
  from: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
}

interface ExtractedDealInfo {
  companyName: string;
  description: string;
  sector: string;
  stage: string;
  location?: string;
  website?: string;
  fundingAmount?: number;
  founderInfo?: {
    name: string;
    email: string;
    background?: string;
  };
}

/**
 * Parse email content using AI to extract deal information
 */
export async function parseEmailForDealInfo(emailData: ParsedEmailData): Promise<ExtractedDealInfo | null> {
  try {
    const emailContent = `
Subject: ${emailData.subject}
From: ${emailData.from}
Content: ${emailData.text}
${emailData.html ? `HTML Content: ${emailData.html}` : ''}
    `.trim();

    const prompt = `
You are an AI assistant that extracts startup pitch information from emails. 
Analyze the following email and extract deal/startup information in JSON format.

Email to analyze:
${emailContent}

Extract the following information if available:
- companyName: The name of the startup/company
- description: Brief description of what the company does
- sector: Industry sector (e.g., "FinTech", "HealthTech", "AI/ML", "E-commerce", etc.)
- stage: Funding stage (e.g., "Pre-Seed", "Seed", "Series A", "Series B", etc.)
- location: Company location/headquarters
- website: Company website URL
- fundingAmount: Amount of funding being raised (in EUR/USD, convert to number)
- founderInfo: Object with founder details (name, email, background)

Respond ONLY with valid JSON in this exact format:
{
  "companyName": "string",
  "description": "string", 
  "sector": "string",
  "stage": "string",
  "location": "string or null",
  "website": "string or null",
  "fundingAmount": number or null,
  "founderInfo": {
    "name": "string",
    "email": "string", 
    "background": "string or null"
  }
}

If the email doesn't contain startup/pitch information, return null.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are an expert at extracting startup pitch information from emails. Always respond with valid JSON or null."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = response.choices[0].message.content;
    if (!result) return null;

    const parsedData = JSON.parse(result);
    
    // Validate that we have at least company name and description
    if (!parsedData.companyName || !parsedData.description) {
      return null;
    }

    return parsedData as ExtractedDealInfo;

  } catch (error) {
    console.error('Error parsing email for deal info:', error);
    return null;
  }
}

/**
 * Convert extracted deal info to InsertDeal format
 */
export function convertToInsertDeal(dealInfo: ExtractedDealInfo): InsertDeal {
  return {
    companyName: dealInfo.companyName,
    description: dealInfo.description,
    sector: dealInfo.sector,
    stage: dealInfo.stage,
    location: dealInfo.location || null,
    website: dealInfo.website || null,
    fundingAmount: dealInfo.fundingAmount || null,
    status: 'new' // Default status for email-created deals
  };
}

/**
 * Generate a summary email response for the founder
 */
export async function generateFounderResponse(dealInfo: ExtractedDealInfo): Promise<string> {
  try {
    const prompt = `
Generate a professional email response to a startup founder who just submitted their pitch to ideas@aescuvest.vc.

Company Details:
- Name: ${dealInfo.companyName}
- Description: ${dealInfo.description}
- Sector: ${dealInfo.sector}
- Stage: ${dealInfo.stage}
- Founder: ${dealInfo.founderInfo?.name || 'Founder'}

Write a warm, professional response that:
1. Thanks them for their submission
2. Confirms we received their pitch for ${dealInfo.companyName}
3. Explains our review process (our investment team will review within 5-7 business days)
4. Mentions we may request additional information if interested
5. Provides contact information for questions
6. Maintains a professional yet encouraging tone

Keep it concise but personal. Sign it from "The Aescuvest Investment Team".
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a professional investment team member writing responses to startup founders."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
    });

    return response.choices[0].message.content || '';

  } catch (error) {
    console.error('Error generating founder response:', error);
    return '';
  }
}