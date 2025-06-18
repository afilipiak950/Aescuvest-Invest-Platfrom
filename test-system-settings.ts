#!/usr/bin/env tsx

/**
 * System Settings Testing Script
 * Tests the complete system settings functionality with real database operations
 */

const API_BASE = 'http://localhost:5000';

async function testSystemSettings(): Promise<void> {
  console.log('🔧 Testing System Settings Functionality');
  
  try {
    // Test GET system settings
    console.log('\n📊 Testing GET /api/settings/system');
    const getResponse = await fetch(`${API_BASE}/api/settings/system`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=s%3A8tN1qWQGvFCELW4BYKaJGNnJtVtPgr9z.%2F%2Fu5zS8UvzjAz%2BqYbKgm8KGNgpXrZFOqW9pBxV4U%2Bs'
      }
    });

    if (!getResponse.ok) {
      console.log(`❌ GET failed with status: ${getResponse.status}`);
      const errorText = await getResponse.text();
      console.log(`Error: ${errorText}`);
      return;
    }

    const currentSettings = await getResponse.json();
    console.log('✅ Current settings retrieved:', currentSettings);

    // Test PATCH system settings - AI Model
    console.log('\n🤖 Testing PATCH /api/settings/system - AI Model');
    const patchResponse1 = await fetch(`${API_BASE}/api/settings/system`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=s%3A8tN1qWQGvFCELW4BYKaJGNnJtVtPgr9z.%2F%2Fu5zS8UvzjAz%2BqYbKgm8KGNgpXrZFOqW9pBxV4U%2Bs'
      },
      body: JSON.stringify({
        defaultAiModel: 'claude-3-sonnet'
      })
    });

    if (!patchResponse1.ok) {
      console.log(`❌ PATCH AI Model failed with status: ${patchResponse1.status}`);
      const errorText = await patchResponse1.text();
      console.log(`Error: ${errorText}`);
    } else {
      const result1 = await patchResponse1.json();
      console.log('✅ AI Model updated:', result1);
    }

    // Test PATCH system settings - Email Processing
    console.log('\n📧 Testing PATCH /api/settings/system - Email Processing');
    const patchResponse2 = await fetch(`${API_BASE}/api/settings/system`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=s%3A8tN1qWQGvFCELW4BYKaJGNnJtVtPgr9z.%2F%2Fu5zS8UvzjAz%2BqYbKgm8KGNgpXrZFOqW9pBxV4U%2Bs'
      },
      body: JSON.stringify({
        autoProcessEmails: true
      })
    });

    if (!patchResponse2.ok) {
      console.log(`❌ PATCH Email Processing failed with status: ${patchResponse2.status}`);
      const errorText = await patchResponse2.text();
      console.log(`Error: ${errorText}`);
    } else {
      const result2 = await patchResponse2.json();
      console.log('✅ Email Processing updated:', result2);
    }

    // Test PATCH system settings - Theme and Language
    console.log('\n🎨 Testing PATCH /api/settings/system - Theme & Language');
    const patchResponse3 = await fetch(`${API_BASE}/api/settings/system`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=s%3A8tN1qWQGvFCELW4BYKaJGNnJtVtPgr9z.%2F%2Fu5zS8UvzjAz%2BqYbKgm8KGNgpXrZFOqW9pBxV4U%2Bs'
      },
      body: JSON.stringify({
        theme: 'light',
        language: 'de'
      })
    });

    if (!patchResponse3.ok) {
      console.log(`❌ PATCH Theme & Language failed with status: ${patchResponse3.status}`);
      const errorText = await patchResponse3.text();
      console.log(`Error: ${errorText}`);
    } else {
      const result3 = await patchResponse3.json();
      console.log('✅ Theme & Language updated:', result3);
    }

    // Verify final settings
    console.log('\n🔍 Verifying final settings state');
    const finalResponse = await fetch(`${API_BASE}/api/settings/system`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=s%3A8tN1qWQGvFCELW4BYKaJGNnJtVtPgr9z.%2F%2Fu5zS8UvzjAz%2BqYbKgm8KGNgpXrZFOqW9pBxV4U%2Bs'
      }
    });

    if (finalResponse.ok) {
      const finalSettings = await finalResponse.json();
      console.log('✅ Final settings state:', finalSettings);
      
      // Verify all changes were persisted
      console.log('\n📋 Verification Summary:');
      console.log(`AI Model: ${finalSettings.defaultAiModel} (should be claude-3-sonnet)`);
      console.log(`Email Processing: ${finalSettings.autoProcessEmails} (should be true)`);
      console.log(`Theme: ${finalSettings.theme} (should be light)`);
      console.log(`Language: ${finalSettings.language} (should be de)`);
    }

    console.log('\n🎯 System Settings Test Complete');

  } catch (error) {
    console.error('💥 Test failed with error:', error);
  }
}

// Run the test
testSystemSettings().catch(console.error);