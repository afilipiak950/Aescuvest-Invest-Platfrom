import { db } from "../server/db";
import { evaluationCriteria } from "../shared/schema";

async function initializeEvaluationCriteria() {
  try {
    console.log("🔧 Initializing evaluation criteria...");

    const defaultCriteria = [
      {
        name: "Sector",
        description: "Must be in Healthcare",
        weight: 25,
        isActive: true
      },
      {
        name: "Biotech Exclusion", 
        description: "No wet-lab biotech",
        weight: 20,
        isActive: true
      },
      {
        name: "HQ Geography",
        description: "EU or Israel only", 
        weight: 15,
        isActive: true
      },
      {
        name: "Stage",
        description: "Series A-C preferred",
        weight: 20,
        isActive: true
      },
      {
        name: "Ownership Feasibility",
        description: "20-30% post-money stake possible",
        weight: 10,
        isActive: true
      },
      {
        name: "Business Model Fit",
        description: "Platform logic preferred (software, automation, reagents)",
        weight: 10,
        isActive: true
      }
    ];

    // Check if criteria already exist
    const existingCriteria = await db.select().from(evaluationCriteria);
    
    if (existingCriteria.length > 0) {
      console.log("✅ Evaluation criteria already exist. Skipping initialization.");
      return;
    }

    // Insert default criteria
    const inserted = await db.insert(evaluationCriteria).values(defaultCriteria).returning();
    
    console.log(`✅ Successfully initialized ${inserted.length} evaluation criteria:`);
    inserted.forEach(criteria => {
      console.log(`   - ${criteria.name} (${criteria.weight}%): ${criteria.description}`);
    });

  } catch (error) {
    console.error("❌ Error initializing evaluation criteria:", error);
    process.exit(1);
  }
}

// Run the script
initializeEvaluationCriteria()
  .then(() => {
    console.log("🎉 Evaluation criteria initialization complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Failed to initialize evaluation criteria:", error);
    process.exit(1);
  });