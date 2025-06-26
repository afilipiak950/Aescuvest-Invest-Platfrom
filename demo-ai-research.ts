/**
 * Demo: Real AI-Powered Company Research
 * Quick demonstration of actual OpenAI analysis capabilities
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function demoRealAIResearch(): Promise<void> {
  console.log('🚀 Demo: Real AI-Powered Company Research');
  
  const companyName = 'Tesla';
  const website = 'https://www.tesla.com';
  
  try {
    // Test 1: Real AI Executive Analysis
    console.log('\n🔍 Test 1: AI Executive Team Analysis');
    const executiveResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a venture capital analyst. Provide detailed executive team analysis with real data."
        },
        {
          role: "user",
          content: `Analyze Tesla's executive team and leadership. Include CEO Elon Musk's background, key executives, and their qualifications. Provide specific details about their experience and track record.`
        }
      ],
      max_tokens: 1000,
      temperature: 0.1
    });
    
    const executiveAnalysis = executiveResponse.choices[0]?.message?.content || '';
    console.log('✅ Executive Analysis Generated:', executiveAnalysis.length, 'characters');
    console.log('Sample:', executiveAnalysis.substring(0, 300) + '...');
    
    // Test 2: Real AI Financial Analysis
    console.log('\n🔍 Test 2: AI Financial Analysis');
    const financialResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a financial analyst. Provide comprehensive financial analysis with real market data."
        },
        {
          role: "user",
          content: `Analyze Tesla's financial performance including revenue, market cap, growth metrics, and recent financial developments. Include specific numbers and trends.`
        }
      ],
      max_tokens: 1000,
      temperature: 0.1
    });
    
    const financialAnalysis = financialResponse.choices[0]?.message?.content || '';
    console.log('✅ Financial Analysis Generated:', financialAnalysis.length, 'characters');
    console.log('Sample:', financialAnalysis.substring(0, 300) + '...');
    
    // Test 3: Real AI Market Analysis
    console.log('\n🔍 Test 3: AI Market Analysis');
    const marketResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a market research analyst. Provide detailed market analysis with competitive intelligence."
        },
        {
          role: "user",
          content: `Analyze Tesla's market position in the EV industry, key competitors, market share, and competitive advantages. Include recent market developments and future outlook.`
        }
      ],
      max_tokens: 1000,
      temperature: 0.1
    });
    
    const marketAnalysis = marketResponse.choices[0]?.message?.content || '';
    console.log('✅ Market Analysis Generated:', marketAnalysis.length, 'characters');
    console.log('Sample:', marketAnalysis.substring(0, 300) + '...');
    
    // Test 4: Structured Data Extraction
    console.log('\n🔍 Test 4: AI Data Structuring');
    const structureResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Extract key data points and structure as JSON. Focus on factual information only."
        },
        {
          role: "user",
          content: `Extract key metrics for Tesla from this analysis and format as JSON:
          
          Executive Analysis: ${executiveAnalysis.substring(0, 500)}
          Financial Analysis: ${financialAnalysis.substring(0, 500)}
          Market Analysis: ${marketAnalysis.substring(0, 500)}
          
          Structure as: {"ceo": "name", "revenue": "amount", "marketCap": "value", "keyStrengths": ["item1", "item2"], "competitors": ["comp1", "comp2"]}`
        }
      ],
      max_tokens: 800,
      temperature: 0.1,
      response_format: { type: "json_object" }
    });
    
    const structuredData = JSON.parse(structureResponse.choices[0].message.content || '{}');
    console.log('✅ Structured Data Generated:', JSON.stringify(structuredData, null, 2));
    
    // Summary
    console.log('\n📊 DEMO RESULTS SUMMARY');
    console.log('========================');
    console.log(`✅ Executive Analysis: ${executiveAnalysis.length} chars`);
    console.log(`✅ Financial Analysis: ${financialAnalysis.length} chars`);
    console.log(`✅ Market Analysis: ${marketAnalysis.length} chars`);
    console.log(`✅ Structured Data: ${Object.keys(structuredData).length} fields`);
    console.log('\n🎉 Real AI-Powered Research Demo Completed!');
    console.log('This demonstrates actual OpenAI analysis with real business intelligence');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    throw error;
  }
}

// Execute demo
demoRealAIResearch()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Demo error:', error);
    process.exit(1);
  });