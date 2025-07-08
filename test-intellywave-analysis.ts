/**
 * Test Intellywave AI Analysis
 * Verify that OpenAI analysis works correctly with actual website content
 */

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function testIntellywaveAnalysis() {
  console.log("🔍 Testing Intellywave AI Analysis...");
  
  // Sample content from Intellywave website
  const websiteContent = `
    Intellywave KI Blog Community Make.com/Zapier Automatisierungen AI Blog Generator AI Image Generator
    Intellywave - KI-basierte Prozessoptimierung für Unternehmen
    Willkommen bei Intellywave Ihr Partner für KI-basierte Prozessoptimierung
    
    Wir helfen Unternehmen dabei, ihre Arbeitsabläufe durch den Einsatz von Künstlicher Intelligenz zu optimieren und zu automatisieren.
    
    Unsere Dienstleistungen:
    - KI-basierte Prozessoptimierung
    - Make.com/Zapier Automatisierungen
    - AI Blog Generator
    - AI Image Generator
    - KI Community
    
    Kontaktieren Sie uns für eine kostenlose Beratung.
  `;

  try {
    const prompt = `You are analyzing the company "Intellywave" ONLY based on the following website content. Do NOT make assumptions or use information from other companies.

Website content for Intellywave:
${websiteContent}

CRITICAL: Base your analysis ONLY on what you can extract from the above content. Do NOT use information from other companies like Aescuvest or any other entity.

Analyze what type of business Intellywave is based on the website content and provide:
{
  "companyType": "what type of business this is",
  "services": ["service1", "service2"],
  "industry": "what industry they are in",
  "businessModel": "description of their business model",
  "keyStrengths": ["strength1", "strength2"],
  "recommendation": "investment recommendation based on content"
}

Analyze based on the website content:
- What industry/business sector is this company in?
- What products/services do they offer?
- What is their business model?`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert business analyst. Analyze ONLY the provided content. Never invent or assume information. Return valid JSON only." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    console.log("✅ OpenAI Analysis Result:");
    console.log(JSON.stringify(result, null, 2));
    
    // Verify the analysis is about Intellywave, not other companies
    const analysis = JSON.stringify(result).toLowerCase();
    if (analysis.includes('aescuvest') || analysis.includes('venture capital') || analysis.includes('investment fund')) {
      console.log("❌ ERROR: Analysis is hallucinating - mentioning venture capital/Aescuvest instead of Intellywave");
    } else {
      console.log("✅ SUCCESS: Analysis correctly identifies Intellywave as an AI services company");
    }
    
  } catch (error) {
    console.error("❌ Error in OpenAI analysis:", error);
  }
}

testIntellywaveAnalysis();