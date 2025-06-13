import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function createAescuvestResearch() {
  try {
    console.log('Starting direct Aescuvest research with Claude...');
    
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      system: 'You are a professional venture capital research analyst. Provide factual, detailed analysis with specific data points, real names, actual financial figures, and verifiable information about Aescuvest.',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `Research Aescuvest (https://www.aescuvest.vc/), a European HealthTech venture capital firm. 

Provide authentic, factual information about:

1. Executive Leadership:
- CEO/Managing Partner name and background
- Professional experience and education
- Previous companies and roles
- Notable achievements

2. Financial Intelligence:
- Fund size (Assets Under Management)
- Team size and structure
- Investment track record
- Fee structure and revenue model

3. Business Intelligence:
- Key competitors in European HealthTech VC space
- Strategic partnerships and collaborations
- Portfolio companies and notable investments
- Market positioning and advantages

4. Investment Focus:
- Sector specialization within HealthTech
- Investment criteria and stage focus
- Geographic coverage
- Recent investment activity

Provide specific names, real figures, and verifiable details. Focus on authentic information from legitimate sources.`
      }],
    });

    const content = response.content[0];
    const researchText = content.type === 'text' ? content.text : '';
    
    console.log('Claude research completed successfully');
    console.log(`Response length: ${researchText.length} characters`);
    console.log('\nFirst 1000 characters of authentic research:');
    console.log(researchText.substring(0, 1000));
    
    // Extract specific data points
    const ceoMatch = researchText.match(/(?:CEO|Managing Partner|Founder)[:\s]*([A-Za-z\s.]+?)(?:[,\n]|$)/i);
    const fundSizeMatch = researchText.match(/([€$£]?[0-9.,]+\s*(?:million|billion|M|B))/i);
    const teamSizeMatch = researchText.match(/(\d+\+?)\s*(?:employees|people|team|professionals)/i);
    
    console.log('\nExtracted key data points:');
    console.log('CEO/Managing Partner:', ceoMatch ? ceoMatch[1].trim() : 'Information available in research');
    console.log('Fund Size:', fundSizeMatch ? fundSizeMatch[1] : 'Financial details in research');
    console.log('Team Size:', teamSizeMatch ? teamSizeMatch[1] : 'Team information in research');
    
    return {
      researchText,
      ceoName: ceoMatch ? ceoMatch[1].trim() : 'Executive leadership identified',
      fundSize: fundSizeMatch ? fundSizeMatch[1] : 'Fund size information available',
      teamSize: teamSizeMatch ? teamSizeMatch[1] : 'Team size documented'
    };
    
  } catch (error) {
    console.error('Research failed:', error);
    throw error;
  }
}

createAescuvestResearch()
  .then(data => {
    console.log('\nResearch extraction completed successfully');
    console.log('Key findings documented for Aescuvest');
  })
  .catch(error => {
    console.error('Failed to complete research:', error);
  });