#!/usr/bin/env tsx

import { db } from './server/db';
import { documents } from './shared/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log('🎯 Enhancing intelligent document assignments...');

async function enhanceIntelligentAssignments() {
  try {
    // Get all documents for Deal 33
    const allDocs = await db
      .select()
      .from(documents)
      .where(eq(documents.dealId, 33));

    console.log(`\n📊 Processing ${allDocs.length} documents for intelligent assignment...`);

    for (const doc of allDocs) {
      console.log(`\n🤖 Enhancing assignment for: ${doc.name}`);
      
      try {
        // Get document content for analysis
        const content = doc.ocrText || doc.name;
        const aiSummaryText = doc.aiSummary ? 
          (typeof doc.aiSummary === 'string' ? doc.aiSummary : JSON.stringify(doc.aiSummary)) : '';

        // Create intelligent assignment prompt
        const assignmentPrompt = `Analyze this document and determine which specific investment analysis agents should review it.

Document: ${doc.name}
Type: ${doc.type}
Content preview: ${content.substring(0, 800)}
AI Summary: ${aiSummaryText.substring(0, 400)}

Available agents:
- legal: Contracts, agreements, legal compliance, governance, regulatory, litigation, corporate structure
- clinical: Medical devices, healthcare, clinical trials, FDA approvals, medical regulations, safety data
- commercial: Sales, marketing, partnerships, market analysis, business strategy, customer agreements, distribution
- hr: Employment contracts, compensation, organizational charts, hiring policies, employee agreements
- financial: Revenue data, budgets, financial statements, funding rounds, valuations, cost analysis, projections
- ip: Patents, trademarks, intellectual property, R&D agreements, technology licenses, invention disclosures
- research: Technical papers, academic studies, research data, scientific publications, technology assessments

Instructions:
1. Analyze the document name, type, and content carefully
2. Assign to 2-4 most relevant agents based on content
3. Consider specific keywords and document purpose
4. Legal documents should include "legal" agent
5. Financial data should include "financial" agent  
6. Medical/healthcare content should include "clinical" agent
7. Technology/IP content should include "ip" agent

Return ONLY a JSON array like: ["legal", "commercial", "financial"]`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: assignmentPrompt }],
          temperature: 0.1,
          max_tokens: 100,
        });

        const response = completion.choices[0].message.content;
        let assignedAgents;

        try {
          assignedAgents = JSON.parse(response || '[]');
          if (!Array.isArray(assignedAgents)) {
            assignedAgents = [];
          }
          
          // Validate agents are from allowed list
          const validAgents = ['legal', 'clinical', 'commercial', 'hr', 'financial', 'ip', 'research'];
          assignedAgents = assignedAgents.filter(agent => validAgents.includes(agent));
          
        } catch (parseError) {
          console.log(`⚠️  Parse error for ${doc.name}, using smart fallback`);
          
          // Smart fallback based on document name and content
          assignedAgents = [];
          const docName = doc.name.toLowerCase();
          const docContent = content.toLowerCase();
          
          // Legal documents
          if (docName.includes('agreement') || docName.includes('contract') || docName.includes('executed') || 
              docName.includes('legal') || docName.includes('consulting') || docName.includes('advisory')) {
            assignedAgents.push('legal');
          }
          
          // Financial documents
          if (docName.includes('financial') || docName.includes('budget') || docName.includes('revenue') ||
              docName.includes('funding') || docName.includes('investment') || docName.includes('valuation')) {
            assignedAgents.push('financial');
          }
          
          // Clinical/Medical documents
          if (docName.includes('clinical') || docName.includes('medical') || docName.includes('fda') ||
              docName.includes('trial') || docName.includes('patient') || docName.includes('device')) {
            assignedAgents.push('clinical');
          }
          
          // Commercial documents
          if (docName.includes('sales') || docName.includes('marketing') || docName.includes('distribution') ||
              docName.includes('partner') || docName.includes('customer') || docName.includes('proposal')) {
            assignedAgents.push('commercial');
          }
          
          // HR documents
          if (docName.includes('employment') || docName.includes('hr') || docName.includes('employee') ||
              docName.includes('compensation') || docName.includes('org') || docName.includes('hiring')) {
            assignedAgents.push('hr');
          }
          
          // IP documents
          if (docName.includes('patent') || docName.includes('trademark') || docName.includes('ip') ||
              docName.includes('intellectual') || docName.includes('technology') || docName.includes('license')) {
            assignedAgents.push('ip');
          }
          
          // Research documents
          if (docName.includes('research') || docName.includes('study') || docName.includes('technical') ||
              docName.includes('whitepaper') || docName.includes('analysis') || docName.includes('report')) {
            assignedAgents.push('research');
          }
          
          // Default assignments if none found
          if (assignedAgents.length === 0) {
            if (docName.includes('agreement') || docName.includes('contract')) {
              assignedAgents = ['legal', 'commercial'];
            } else {
              assignedAgents = ['commercial', 'research'];
            }
          }
        }

        // Ensure minimum of 2 agents and maximum of 4
        if (assignedAgents.length === 1) {
          if (assignedAgents[0] === 'legal') {
            assignedAgents.push('commercial');
          } else {
            assignedAgents.push('legal');
          }
        }
        
        if (assignedAgents.length > 4) {
          assignedAgents = assignedAgents.slice(0, 4);
        }

        // Remove duplicates
        assignedAgents = [...new Set(assignedAgents)];

        // Update document with enhanced assignments
        await db
          .update(documents)
          .set({
            assignedAgents: assignedAgents,
            assignmentReason: `Enhanced intelligent assignment based on document analysis`,
            assignmentConfidence: 0.85
          })
          .where(eq(documents.id, doc.id));

        console.log(`✅ Enhanced assignment for ${doc.name}: ${assignedAgents.join(', ')}`);

      } catch (error) {
        console.error(`❌ Failed to enhance assignment for ${doc.name}:`, error);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Verify enhanced results
    console.log('\n📊 Verifying enhanced assignments...');
    
    const enhancedResults = await db
      .select()
      .from(documents)
      .where(eq(documents.dealId, 33));

    const agentCounts = {};
    enhancedResults.forEach(doc => {
      if (doc.assignedAgents && Array.isArray(doc.assignedAgents)) {
        doc.assignedAgents.forEach(agent => {
          agentCounts[agent] = (agentCounts[agent] || 0) + 1;
        });
      }
    });

    console.log('\n🎯 Enhanced assignment distribution:');
    Object.entries(agentCounts)
      .sort(([,a], [,b]) => b - a)
      .forEach(([agent, count]) => {
        console.log(`- ${agent}: ${count} documents`);
      });

    const totalAssigned = enhancedResults.filter(doc => 
      doc.assignedAgents && Array.isArray(doc.assignedAgents) && doc.assignedAgents.length > 0
    ).length;

    console.log(`\n✅ Enhanced assignments completed: ${totalAssigned}/${enhancedResults.length} documents assigned`);

  } catch (error) {
    console.error('❌ Error during enhancement:', error);
    process.exit(1);
  }
}

// Run the enhancement
enhanceIntelligentAssignments().then(() => {
  console.log('🏁 Intelligent assignment enhancement completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});