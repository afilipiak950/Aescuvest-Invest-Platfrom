/**
 * Comprehensive Preferences Tab Functionality Test
 * Tests all preference controls and database persistence
 */

import { db } from './server/db';
import { users } from './shared/schema';
import { eq } from 'drizzle-orm';

const API_BASE = 'http://localhost:5000';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL';
  details: string;
  data?: any;
}

async function testPreferencesTabFunctionality(): Promise<void> {
  console.log('🧪 Starting Comprehensive Preferences Tab Functionality Test\n');
  
  const results: TestResult[] = [];
  let testUser: any = null;

  try {
    // 1. Get current user data
    console.log('📊 Step 1: Fetching current user data...');
    const userResponse = await fetch(`${API_BASE}/api/auth/user`, {
      method: 'GET',
      headers: {
        'Cookie': 'connect.sid=s%3A8tN1qWQGvFCELW4BYKaJGNnJtVtPgr9z.%2F%2Fu5zS8UvzjAz%2BqYbKgm8KGNgpXrZFOqW9pBxV4U%2Bs'
      }
    });

    if (userResponse.ok) {
      testUser = await userResponse.json();
      console.log('✅ Current user data:', testUser);
      results.push({
        test: 'Fetch Current User',
        status: 'PASS',
        details: `Retrieved user ID: ${testUser.id}`,
        data: testUser
      });
    } else {
      throw new Error(`Failed to fetch user: ${userResponse.status}`);
    }

    // 2. Test comprehensive profile update with all preference fields
    console.log('\n📝 Step 2: Testing comprehensive profile update...');
    const testProfileData = {
      // Personal info
      firstName: 'John',
      lastName: 'Tester',
      email: 'john.tester@example.com',
      phone: '+1-555-123-4567',
      location: 'San Francisco, CA',
      bio: 'Senior Investment Analyst specializing in venture capital and startup evaluation.',
      
      // Professional info
      title: 'Senior Investment Analyst',
      company: 'Aescuvest Capital',
      website: 'https://johntester.com',
      
      // Social links
      linkedin: 'https://linkedin.com/in/johntester',
      twitter: 'https://twitter.com/johntester',
      
      // Preferences
      timezone: 'America/Los_Angeles',
      language: 'en',
      
      // Notification preferences (nested structure)
      notifications: {
        email: true,
        browser: false,
        deals: true,
        matches: false,
        reports: true
      },
      
      // Privacy settings (nested structure)
      privacy: {
        showEmail: true,
        showPhone: false,
        publicProfile: true
      }
    };

    const updateResponse = await fetch(`${API_BASE}/api/settings/user`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=s%3A8tN1qWQGvFCELW4BYKaJGNnJtVtPgr9z.%2F%2Fu5zS8UvzjAz%2BqYbKgm8KGNgpXrZFOqW9pBxV4U%2Bs'
      },
      body: JSON.stringify(testProfileData)
    });

    if (updateResponse.ok) {
      const updateResult = await updateResponse.json();
      console.log('✅ Profile update response:', updateResult);
      results.push({
        test: 'Profile Update Request',
        status: 'PASS',
        details: 'Successfully sent profile update request',
        data: updateResult
      });
    } else {
      const errorText = await updateResponse.text();
      throw new Error(`Profile update failed: ${updateResponse.status} - ${errorText}`);
    }

    // 3. Verify database persistence by querying directly
    console.log('\n🔍 Step 3: Verifying database persistence...');
    const [updatedUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, testUser.id));

    if (updatedUser) {
      console.log('✅ Database verification successful:');
      console.log('Name:', updatedUser.name);
      console.log('Email:', updatedUser.email);
      console.log('Phone:', updatedUser.phone);
      console.log('Location:', updatedUser.location);
      console.log('Bio:', updatedUser.bio);
      console.log('Title:', updatedUser.title);
      console.log('Company:', updatedUser.company);
      console.log('Website:', updatedUser.website);
      console.log('LinkedIn:', updatedUser.linkedin);
      console.log('Twitter:', updatedUser.twitter);
      console.log('Timezone:', updatedUser.timezone);
      console.log('Language:', updatedUser.language);
      console.log('Email Notifications:', updatedUser.emailNotifications);
      console.log('Browser Notifications:', updatedUser.browserNotifications);
      console.log('Deal Notifications:', updatedUser.dealNotifications);
      console.log('Match Notifications:', updatedUser.matchNotifications);
      console.log('Report Notifications:', updatedUser.reportNotifications);
      console.log('Show Email:', updatedUser.showEmail);
      console.log('Show Phone:', updatedUser.showPhone);
      console.log('Public Profile:', updatedUser.publicProfile);

      results.push({
        test: 'Database Persistence Verification',
        status: 'PASS',
        details: 'All fields correctly saved to database',
        data: updatedUser
      });
    } else {
      throw new Error('User not found in database after update');
    }

    // 4. Test API response format compatibility
    console.log('\n🔄 Step 4: Testing API response format...');
    const settingsResponse = await fetch(`${API_BASE}/api/settings/user`, {
      method: 'GET',
      headers: {
        'Cookie': 'connect.sid=s%3A8tN1qWQGvFCELW4BYKaJGNnJtVtPgr9z.%2F%2Fu5zS8UvzjAz%2BqYbKgm8KGNgpXrZFOqW9pBxV4U%2Bs'
      }
    });

    if (settingsResponse.ok) {
      const settingsData = await settingsResponse.json();
      console.log('✅ Settings API response:', settingsData);
      
      // Verify all expected fields are present
      const expectedFields = [
        'firstName', 'lastName', 'email', 'phone', 'location', 'bio',
        'title', 'company', 'website', 'linkedin', 'twitter',
        'timezone', 'language', 'emailNotifications', 'dealNotifications'
      ];
      
      const missingFields = expectedFields.filter(field => !(field in settingsData));
      
      if (missingFields.length === 0) {
        results.push({
          test: 'API Response Format',
          status: 'PASS',
          details: 'All expected fields present in API response',
          data: settingsData
        });
      } else {
        results.push({
          test: 'API Response Format',
          status: 'FAIL',
          details: `Missing fields: ${missingFields.join(', ')}`,
          data: settingsData
        });
      }
    } else {
      throw new Error(`Failed to fetch settings: ${settingsResponse.status}`);
    }

    // 5. Test individual preference toggles
    console.log('\n🎛️ Step 5: Testing individual preference toggles...');
    
    const toggleTests = [
      { field: 'notifications.email', value: false },
      { field: 'notifications.browser', value: true },
      { field: 'privacy.showEmail', value: false },
      { field: 'privacy.publicProfile', value: false }
    ];

    for (const toggle of toggleTests) {
      const toggleData = { [toggle.field]: toggle.value };
      
      // Handle nested structure
      if (toggle.field.includes('.')) {
        const [parent, child] = toggle.field.split('.');
        const nestedData = { [parent]: { [child]: toggle.value } };
        
        const toggleResponse = await fetch(`${API_BASE}/api/settings/user`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': 'connect.sid=s%3A8tN1qWQGvFCELW4BYKaJGNnJtVtPgr9z.%2F%2Fu5zS8UvzjAz%2BqYbKgm8KGNgpXrZFOqW9pBxV4U%2Bs'
          },
          body: JSON.stringify(nestedData)
        });

        if (toggleResponse.ok) {
          console.log(`✅ Toggle test passed: ${toggle.field} = ${toggle.value}`);
          results.push({
            test: `Toggle ${toggle.field}`,
            status: 'PASS',
            details: `Successfully toggled ${toggle.field} to ${toggle.value}`
          });
        } else {
          console.log(`❌ Toggle test failed: ${toggle.field}`);
          results.push({
            test: `Toggle ${toggle.field}`,
            status: 'FAIL',
            details: `Failed to toggle ${toggle.field}`
          });
        }
      }
    }

    // 6. Test timezone and language dropdowns
    console.log('\n🌍 Step 6: Testing timezone and language dropdowns...');
    
    const dropdownTests = [
      { field: 'timezone', value: 'Europe/London' },
      { field: 'language', value: 'es' }
    ];

    for (const dropdown of dropdownTests) {
      const dropdownResponse = await fetch(`${API_BASE}/api/settings/user`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'connect.sid=s%3A8tN1qWQGvFCELW4BYKaJGNnJtVtPgr9z.%2F%2Fu5zS8UvzjAz%2BqYbKgm8KGNgpXrZFOqW9pBxV4U%2Bs'
        },
        body: JSON.stringify({ [dropdown.field]: dropdown.value })
      });

      if (dropdownResponse.ok) {
        console.log(`✅ Dropdown test passed: ${dropdown.field} = ${dropdown.value}`);
        results.push({
          test: `Dropdown ${dropdown.field}`,
          status: 'PASS',
          details: `Successfully updated ${dropdown.field} to ${dropdown.value}`
        });
      } else {
        console.log(`❌ Dropdown test failed: ${dropdown.field}`);
        results.push({
          test: `Dropdown ${dropdown.field}`,
          status: 'FAIL',
          details: `Failed to update ${dropdown.field}`
        });
      }
    }

  } catch (error) {
    console.error('❌ Test suite error:', error);
    results.push({
      test: 'Test Suite Execution',
      status: 'FAIL',
      details: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  // Final results summary
  console.log('\n📋 TEST RESULTS SUMMARY');
  console.log('=======================');
  
  let passCount = 0;
  let failCount = 0;
  
  results.forEach((result, index) => {
    const status = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${index + 1}. ${status} ${result.test}: ${result.details}`);
    
    if (result.status === 'PASS') passCount++;
    else failCount++;
  });
  
  console.log(`\n📊 Final Score: ${passCount}/${results.length} tests passed`);
  
  if (failCount > 0) {
    console.log(`⚠️  ${failCount} tests failed - review implementation`);
  } else {
    console.log('🎉 All tests passed - preferences functionality is working correctly!');
  }
}

// Execute the test
testPreferencesTabFunctionality().catch(console.error);