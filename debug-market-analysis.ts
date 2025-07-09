import { storage } from './server/storage';

async function debugMarketAnalysis() {
  try {
    console.log('🔍 Testing market analysis retrieval...');
    
    const research = await storage.getCompanyResearchRawByDealId(20);
    
    if (research) {
      console.log('✅ Research data retrieved');
      console.log('📊 Object keys:', Object.keys(research));
      console.log('📊 Market analysis raw:', research.marketAnalysis);
      console.log('📊 Market analysis type:', typeof research.marketAnalysis);
      
      if (research.marketAnalysis) {
        console.log('📊 Market analysis sample:', JSON.stringify(research.marketAnalysis).substring(0, 200));
      }
    } else {
      console.log('❌ No research data found');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugMarketAnalysis();