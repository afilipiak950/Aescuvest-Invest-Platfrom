#!/usr/bin/env tsx

import { db } from '../server/db';
import { deals } from '../shared/schema';

async function addDummyDeals() {
  console.log('Adding dummy deals...');

  const dummyDeals = [
    {
      companyName: 'TechFlow AI',
      founderName: 'Sarah Chen',
      founderEmail: 'sarah@techflow.ai',
      sector: 'Artificial Intelligence',
      stage: 'Series A',
      fundingAmount: 15000000,
      description: 'AI-powered workflow automation platform for enterprises. Reduces manual tasks by 80% through intelligent process optimization.',
      status: 'under_review',
      aiScore: 92,
      location: 'San Francisco, CA',
      website: 'https://techflow.ai'
    },
    {
      companyName: 'GreenEnergy Solutions',
      description: 'Revolutionary solar panel technology with 40% higher efficiency. Targeting residential and commercial markets across Europe.',
      sector: 'Clean Energy',
      stage: 'Seed',
      location: 'Berlin, Germany',
      website: 'https://greenenergy.com',
      fundingAmount: 5000000,
      aiScore: 88,
      status: 'approved'
    },
    {
      companyName: 'HealthTrack Pro',
      description: 'Digital health platform connecting patients with specialists. AI-driven diagnostics and personalized treatment plans.',
      sector: 'Healthcare Technology',
      stage: 'Series B',
      location: 'Boston, MA',
      website: 'https://healthtrack.pro',
      fundingAmount: 25000000,
      aiScore: 95,
      status: 'due_diligence'
    },
    {
      companyName: 'FinanceFlow',
      description: 'Modern banking platform for SMEs with integrated accounting and cash flow management. Serving 10,000+ businesses.',
      sector: 'FinTech',
      stage: 'Pre-Seed',
      location: 'London, UK',
      website: 'https://financeflow.io',
      fundingAmount: 2000000,
      aiScore: 72,
      status: 'rejected'
    },
    {
      companyName: 'SpaceLogistics',
      description: 'Satellite-based logistics tracking for global supply chains. Real-time monitoring and predictive analytics for cargo.',
      sector: 'Aerospace',
      stage: 'Series A',
      location: 'Austin, TX',
      website: 'https://spacelogistics.com',
      fundingAmount: 18000000,
      aiScore: 89,
      status: 'under_review'
    },
    {
      companyName: 'FoodTech Innovations',
      description: 'Plant-based protein manufacturing using precision fermentation. Targeting B2B food manufacturers and restaurants.',
      sector: 'Food Technology',
      stage: 'Seed',
      location: 'Amsterdam, Netherlands',
      website: 'https://foodtech.innovation',
      fundingAmount: 8000000,
      aiScore: 86,
      status: 'approved'
    },
    {
      companyName: 'CyberShield Security',
      description: 'AI-powered threat detection and response platform. Zero-day attack prevention for enterprise networks.',
      sector: 'Cybersecurity',
      stage: 'Series A',
      location: 'Tel Aviv, Israel',
      website: 'https://cybershield.security',
      fundingAmount: 12000000,
      aiScore: 91,
      status: 'due_diligence'
    },
    {
      companyName: 'EduTech Future',
      description: 'Personalized learning platform using AI tutors. Adapts to individual learning styles and tracks progress in real-time.',
      sector: 'Education Technology',
      stage: 'Seed',
      location: 'Barcelona, Spain',
      website: 'https://edutech.future',
      fundingAmount: 6000000,
      aiScore: 84,
      status: 'under_review'
    }
  ];

  try {
    await db.insert(deals).values(dummyDeals);
    console.log(`✓ Added all ${dummyDeals.length} deals successfully!`);
    
    console.log(`\n🎉 Successfully added ${dummyDeals.length} dummy deals!`);
    console.log('You can now view them in the "All Deals" section.');
    
  } catch (error) {
    console.error('Error adding dummy deals:', error);
  }
}

addDummyDeals()
  .then(() => {
    console.log('Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });