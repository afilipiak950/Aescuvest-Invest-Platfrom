#!/usr/bin/env tsx

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { documents } from './shared/schema';
import { eq } from 'drizzle-orm';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

async function testAutomaticAssignment() {
  console.log('🧪 Testing automatic agent assignment system...');
  
  try {
    // Create a test document for Deal 33 (which has existing documents)
    const testDocument = {
      dealId: 33,
      name: 'Test Clinical Trial Agreement.pdf',
      type: 'pdf',
      path: '/test/path.pdf',
      size: 50000,
      status: 'Active',
      ocrText: 'This is a clinical trial agreement for medical device testing. The document outlines FDA regulatory compliance requirements and patient safety protocols.',
      aiSummary: {
        executiveSummary: 'Clinical trial agreement for medical device testing with FDA compliance requirements',
        criticalFindings: ['FDA regulatory compliance required', 'Patient safety protocols outlined'],
        neutralFindings: ['Standard clinical trial procedures', 'Medical device testing protocols'],
        keyFinancialData: ['Budget allocation for clinical trials'],
        riskAssessment: ['Regulatory approval risk', 'Patient safety concerns'],
        strategicImplications: 'Critical for product approval and market entry',
        documentType: 'Clinical Trial Agreement',
        confidenceScore: 0.9
      },
      aiSummaryStatus: 'completed',
      aiSummaryGeneratedAt: new Date(),
      assignedAgents: null // No assignment yet to test automatic system
    };

    // Insert test document
    const [insertedDoc] = await db.insert(documents).values(testDocument).returning();
    console.log(`✅ Created test document: ${insertedDoc.id} - ${insertedDoc.name}`);

    // Simulate the automatic assignment process
    const { assignDocumentToAgentsAutomatically } = await import('./server/routes');
    
    // This should automatically assign to Clinical, Legal, and Commercial agents
    await assignDocumentToAgentsAutomatically(insertedDoc.id, insertedDoc, insertedDoc.aiSummary);

    // Verify the assignment
    const updatedDoc = await db.select().from(documents).where(eq(documents.id, insertedDoc.id));
    
    if (updatedDoc.length > 0) {
      const assignments = updatedDoc[0].assignedAgents;
      console.log(`✅ Automatic assignment result: ${assignments}`);
      
      if (assignments) {
        const assignedAgentsList = assignments.split(',');
        console.log(`📊 Assigned to ${assignedAgentsList.length} agents: ${assignedAgentsList.join(', ')}`);
        
        // Expected: Clinical (medical/trial content), Legal (agreement), Commercial (general business)
        const expectedAgents = ['Clinical', 'Legal', 'Commercial'];
        const hasExpectedAgents = expectedAgents.every(agent => assignedAgentsList.includes(agent));
        
        if (hasExpectedAgents) {
          console.log('🎉 SUCCESS: Automatic assignment working correctly!');
          console.log('✅ Clinical agent assigned (medical/FDA content detected)');
          console.log('✅ Legal agent assigned (agreement/compliance detected)');
          console.log('✅ Commercial agent assigned (business content detected)');
        } else {
          console.log(`⚠️ Partial success: Expected ${expectedAgents.join(', ')}, got ${assignedAgentsList.join(', ')}`);
        }
      } else {
        console.log('❌ FAILED: No automatic assignment occurred');
      }
    }

    // Clean up test document
    await db.delete(documents).where(eq(documents.id, insertedDoc.id));
    console.log(`🧹 Cleaned up test document ${insertedDoc.id}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await client.end();
  }
}

testAutomaticAssignment();