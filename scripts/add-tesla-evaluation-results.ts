import { db } from "../server/db";
import { evaluationResults } from "../shared/schema";

async function addTeslaEvaluationResults() {
  console.log("Adding Tesla evaluation results...");

  // Tesla deal ID is 21 based on your setup
  const teslaEvaluationResults = [
    {
      dealId: 21,
      criteriaId: 1, // Sector - Healthcare
      score: 15, // Low score as Tesla is automotive, not healthcare
      reasoning: "Tesla operates in automotive and energy sectors, not healthcare. This represents a fundamental sector mismatch with the fund's healthcare investment mandate."
    },
    {
      dealId: 21,
      criteriaId: 2, // Biotech Exclusion - No wet-lab biotech
      score: 100, // Perfect score as Tesla is not biotech
      reasoning: "Tesla is clearly not a wet-lab biotech company. It operates in automotive manufacturing, energy storage, and software - completely outside biotech scope."
    },
    {
      dealId: 21,
      criteriaId: 3, // HQ Geography - EU or Israel only
      score: 30, // Low score as Tesla HQ is in Austin, Texas
      reasoning: "Tesla's headquarters is in Austin, Texas, USA. While Tesla has significant European operations and manufacturing in Berlin, the primary HQ location does not meet the EU/Israel criteria."
    },
    {
      dealId: 21,
      criteriaId: 4, // Stage - Series A-C preferred
      score: 20, // Very low as Tesla is public company
      reasoning: "Tesla is a publicly traded company (NASDAQ: TSLA) far beyond Series A-C stage. The company completed its IPO in 2010 and has a market cap exceeding $800 billion."
    },
    {
      dealId: 21,
      criteriaId: 5, // Ownership Feasibility - 20-30% post-money stake possible
      score: 5, // Nearly impossible for public company of this size
      reasoning: "Acquiring a 20-30% stake in Tesla would require approximately $160-240 billion investment, which is not feasible for most investment funds. The company's scale makes significant ownership stakes practically impossible."
    },
    {
      dealId: 21,
      criteriaId: 6, // Business Model Fit (assuming this exists)
      score: 85, // High score for business model quality
      reasoning: "Tesla demonstrates excellent business model execution with multiple revenue streams: vehicle sales, energy storage, charging network, and software services. Strong recurring revenue potential and scalability."
    }
  ];

  try {
    // Insert evaluation results
    for (const result of teslaEvaluationResults) {
      await db.insert(evaluationResults).values({
        ...result,
        createdAt: new Date()
      });
      console.log(`✓ Added evaluation result for criteria ${result.criteriaId}: ${result.score}/100`);
    }

    console.log("✅ Tesla evaluation results added successfully!");
    
    // Calculate and log the weighted score
    const criteriaWeights = [25, 20, 15, 20, 10, 10]; // Based on your settings
    let totalWeightedScore = 0;
    let totalWeight = 0;
    
    teslaEvaluationResults.forEach((result, index) => {
      const weight = criteriaWeights[index] || 0;
      totalWeightedScore += (result.score * weight) / 100;
      totalWeight += weight;
    });
    
    const finalScore = Math.round(totalWeightedScore);
    console.log(`📊 Calculated weighted score: ${finalScore}/100`);
    console.log(`📋 Score breakdown:`);
    teslaEvaluationResults.forEach((result, index) => {
      const weight = criteriaWeights[index] || 0;
      const weightedContribution = (result.score * weight) / 100;
      console.log(`   - Criteria ${result.criteriaId}: ${result.score}/100 × ${weight}% = ${weightedContribution.toFixed(1)}`);
    });

  } catch (error) {
    console.error("❌ Error adding Tesla evaluation results:", error);
  }
}

addTeslaEvaluationResults().catch(console.error);