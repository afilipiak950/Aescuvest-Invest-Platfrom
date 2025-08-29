import { db } from "./server/db";
import { agentAnalyses } from "./shared/schema";
import { eq, and, desc } from "drizzle-orm";

async function checkLegalAnalyses() {
  const analyses = await db.select().from(agentAnalyses).where(
    and(
      eq(agentAnalyses.dealId, 22),
      eq(agentAnalyses.agentType, 'legal')
    )
  ).orderBy(desc(agentAnalyses.createdAt));
  
  console.log('Found', analyses.length, 'legal analyses');
  analyses.forEach((analysis, i) => {
    console.log(`Analysis ${i+1}: ID=${analysis.id}, created=${analysis.createdAt}`);
    console.log('Raw analysis field:', typeof analysis.analysis, analysis.analysis);
    console.log('Has legalAnswers?', analysis.analysis?.legalAnswers ? 'YES' : 'NO');
    console.log('Has findings?', analysis.analysis?.findings ? 'YES' : 'NO');
    console.log('Full structure:', Object.keys(analysis.analysis || {}));
    console.log('---');
  });
}

checkLegalAnalyses().then(() => process.exit(0));