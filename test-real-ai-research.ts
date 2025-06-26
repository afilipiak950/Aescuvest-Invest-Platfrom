/**
 * Test Real AI-Powered Company Research
 * This script demonstrates actual web scraping and OpenAI analysis capabilities
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface RealResearchResult {
  companyName: string;
  websiteData: string;
  executiveAnalysis: any;
  financialAnalysis: any;
  marketAnalysis: any;
  businessIntelligence: any;
  riskAssessment: any;
  investmentAnalysis: any;
}

// Real web scraping function
async function scrapeCompanyWebsite(url: string): Promise<string> {
  try {
    console.log(`🌐 Scraping website: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    
    // Extract meaningful content
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
    
    const cleanContent = textContent.substring(0, 15000);
    console.log(`✅ Scraped ${url} - ${cleanContent.length} characters extracted`);
    return cleanContent;
  } catch (error) {
    console.error(`❌ Failed to scrape ${url}:`, error);
    return '';
  }
}

// Real AI research function
async function conductAIResearch(companyName: string, researchQuery: string, websiteContent?: string): Promise<string> {
  try {
    console.log(`🔍 AI Research: ${researchQuery.substring(0, 80)}...`);
    
    const systemPrompt = `You are a professional business intelligence researcher and venture capital analyst.
    Provide detailed, factual information about companies based on your knowledge and any provided website content.
    Include specific data points, dates, financial figures, and market insights when available.
    Focus on recent developments, concrete facts, and actionable business intelligence.
    Be thorough and provide comprehensive analysis suitable for investment decision-making.`;

    const userPrompt = websiteContent 
      ? `Research Query: ${researchQuery}
         
         Company: ${companyName}
         
         Website Content Analysis:
         ${websiteContent}
         
         Based on this website content and your knowledge of ${companyName}, provide comprehensive research findings.`
      : `Research Query: ${researchQuery}
         
         Company: ${companyName}
         
         Provide comprehensive research findings about ${companyName} based on your knowledge.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 2500,
      temperature: 0.1, // Low temperature for factual accuracy
    });

    const result = response.choices[0]?.message?.content || '';
    console.log(`✅ AI Research completed - ${result.length} characters generated`);
    return result;
  } catch (error) {
    console.error('❌ OpenAI research request failed:', error);
    throw error;
  }
}

// Structure AI research into JSON format
async function structureResearchData(companyName: string, researchData: string, category: string): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert data analyst. Extract and structure business intelligence data into valid JSON format.
          Only include information that can be verified from the research data provided.
          If specific details are not available, indicate this clearly rather than making assumptions.`
        },
        {
          role: "user",
          content: `Structure this research data about ${companyName} for category "${category}":

          Research Data:
          ${researchData}

          Extract relevant information and format as valid JSON. Focus on factual, verifiable data points.`
        }
      ],
      max_tokens: 1500,
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  } catch (error) {
    console.error(`Failed to structure ${category} data:`, error);
    return { category, rawData: researchData.substring(0, 1000) };
  }
}

async function testRealAIResearch(): Promise<void> {
  console.log('🚀 Starting Real AI-Powered Company Research Test');
  
  const companyName = 'Tesla';
  const website = 'https://www.tesla.com';
  
  try {
    console.log(`\n📊 Testing comprehensive AI research for: ${companyName}`);
    
    // Step 1: Real website scraping
    console.log('\n🌐 Step 1: Web Scraping');
    const websiteContent = await scrapeCompanyWebsite(website);
    
    // Step 2: Multiple AI research queries
    console.log('\n🔍 Step 2: AI Research Analysis');
    
    const researchQueries = [
      `Find detailed information about the executive team and leadership of ${companyName}. Include CEO profile, background, experience, education, previous companies, and key team members.`,
      `Research ${companyName} financial information including revenue, funding history, valuation, employee count, and growth metrics.`,
      `Analyze ${companyName} market position, competitors, market size, and competitive advantages in the automotive and clean energy sectors.`,
      `Gather business intelligence about ${companyName} including recent news, partnerships, technology innovations, and strategic initiatives.`,
      `Assess risks and opportunities for ${companyName} including regulatory factors, competitive threats, and market opportunities.`,
      `Generate investment analysis for ${companyName} including investment thesis, growth potential, and strategic recommendations.`
    ];
    
    const categories = ['Executive Team', 'Financial Analysis', 'Market Analysis', 'Business Intelligence', 'Risk Assessment', 'Investment Analysis'];
    
    const researchResults: any[] = [];
    
    for (let i = 0; i < researchQueries.length; i++) {
      const query = researchQueries[i];
      const category = categories[i];
      
      console.log(`\n🔍 Researching: ${category}`);
      
      // Conduct AI research
      const researchData = await conductAIResearch(companyName, query, websiteContent);
      
      // Structure the data
      const structuredData = await structureResearchData(companyName, researchData, category);
      
      researchResults.push({
        category,
        rawResearch: researchData,
        structuredData
      });
      
      // Rate limiting - wait between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Step 3: Compile comprehensive results
    console.log('\n📋 Step 3: Compiling Comprehensive Results');
    
    const comprehensiveResults: RealResearchResult = {
      companyName,
      websiteData: websiteContent,
      executiveAnalysis: researchResults[0],
      financialAnalysis: researchResults[1],
      marketAnalysis: researchResults[2],
      businessIntelligence: researchResults[3],
      riskAssessment: researchResults[4],
      investmentAnalysis: researchResults[5]
    };
    
    // Display results summary
    console.log('\n✅ COMPREHENSIVE AI RESEARCH RESULTS');
    console.log('=====================================');
    console.log(`Company: ${companyName}`);
    console.log(`Website Data: ${websiteContent.length} characters scraped`);
    console.log(`Research Categories: ${categories.length} completed`);
    
    for (const result of researchResults) {
      console.log(`\n${result.category}:`);
      console.log(`- Raw Research: ${result.rawResearch.length} characters`);
      console.log(`- Structured Data: ${JSON.stringify(result.structuredData).length} characters`);
      console.log(`- Sample: ${result.rawResearch.substring(0, 200)}...`);
    }
    
    // Save results to file for inspection
    const fs = await import('fs');
    const resultsFile = 'real-ai-research-results.json';
    fs.writeFileSync(resultsFile, JSON.stringify(comprehensiveResults, null, 2));
    console.log(`\n💾 Full results saved to: ${resultsFile}`);
    
    console.log('\n🎉 Real AI-Powered Research Test Completed Successfully!');
    console.log('This demonstrates actual web scraping + OpenAI analysis capabilities');
    
  } catch (error) {
    console.error('❌ Real AI research test failed:', error);
    throw error;
  }
}

// Execute the test
testRealAIResearch()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

export { testRealAIResearch, scrapeCompanyWebsite, conductAIResearch, structureResearchData };