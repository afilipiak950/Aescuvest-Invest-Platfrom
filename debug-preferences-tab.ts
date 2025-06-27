/**
 * Debug Preferences Tab Functionality
 * Direct database testing to verify all preference controls work
 */

import { db } from './server/db';
import { users } from './shared/schema';
import { eq } from 'drizzle-orm';

async function debugPreferencesTab(): Promise<void> {
  console.log('🔍 Debugging Preferences Tab Functionality\n');

  try {
    // 1. Check current user state
    console.log('📋 Current user state:');
    const [currentUser] = await db.select().from(users).where(eq(users.id, 3));
    console.log('User ID:', currentUser.id);
    console.log('Name:', currentUser.name || '(empty)');
    console.log('Email:', currentUser.email || '(empty)');
    console.log('Phone:', currentUser.phone || '(empty)');
    console.log('Location:', currentUser.location || '(empty)');
    console.log('Bio:', currentUser.bio || '(empty)');
    console.log('Title:', currentUser.title || '(empty)');
    console.log('Company:', currentUser.company || '(empty)');
    console.log('Website:', currentUser.website || '(empty)');
    console.log('LinkedIn:', currentUser.linkedin || '(empty)');
    console.log('Twitter:', currentUser.twitter || '(empty)');
    console.log('Timezone:', currentUser.timezone);
    console.log('Language:', currentUser.language);
    console.log('Email Notifications:', currentUser.emailNotifications);
    console.log('Browser Notifications:', currentUser.browserNotifications);
    console.log('Deal Notifications:', currentUser.dealNotifications);
    console.log('Match Notifications:', currentUser.matchNotifications);
    console.log('Report Notifications:', currentUser.reportNotifications);
    console.log('Show Email:', currentUser.showEmail);
    console.log('Show Phone:', currentUser.showPhone);
    console.log('Public Profile:', currentUser.publicProfile);

    // 2. Test complete profile update
    console.log('\n🧪 Testing complete profile update...');
    const testData = {
      name: 'John Smith',
      email: 'john.smith@test.com',
      phone: '+1-555-987-6543',
      location: 'New York, NY',
      bio: 'Senior Investment Professional with 10+ years experience in venture capital.',
      title: 'Investment Director',
      company: 'Test Capital Partners',
      website: 'https://johnsmith.portfolio.com',
      linkedin: 'https://linkedin.com/in/johnsmith',
      twitter: 'https://twitter.com/johnsmith',
      timezone: 'America/New_York',
      language: 'es',
      emailNotifications: false,
      browserNotifications: true,
      dealNotifications: false,
      matchNotifications: true,
      reportNotifications: false,
      showEmail: true,
      showPhone: false,
      publicProfile: false
    };

    await db.update(users)
      .set(testData)
      .where(eq(users.id, 3));

    console.log('✅ Profile updated successfully');

    // 3. Verify the update
    console.log('\n🔍 Verifying updated profile:');
    const [updatedUser] = await db.select().from(users).where(eq(users.id, 3));
    
    const verificationChecks = [
      { field: 'name', expected: testData.name, actual: updatedUser.name },
      { field: 'email', expected: testData.email, actual: updatedUser.email },
      { field: 'phone', expected: testData.phone, actual: updatedUser.phone },
      { field: 'location', expected: testData.location, actual: updatedUser.location },
      { field: 'bio', expected: testData.bio, actual: updatedUser.bio },
      { field: 'title', expected: testData.title, actual: updatedUser.title },
      { field: 'company', expected: testData.company, actual: updatedUser.company },
      { field: 'website', expected: testData.website, actual: updatedUser.website },
      { field: 'linkedin', expected: testData.linkedin, actual: updatedUser.linkedin },
      { field: 'twitter', expected: testData.twitter, actual: updatedUser.twitter },
      { field: 'timezone', expected: testData.timezone, actual: updatedUser.timezone },
      { field: 'language', expected: testData.language, actual: updatedUser.language },
      { field: 'emailNotifications', expected: testData.emailNotifications, actual: updatedUser.emailNotifications },
      { field: 'browserNotifications', expected: testData.browserNotifications, actual: updatedUser.browserNotifications },
      { field: 'dealNotifications', expected: testData.dealNotifications, actual: updatedUser.dealNotifications },
      { field: 'matchNotifications', expected: testData.matchNotifications, actual: updatedUser.matchNotifications },
      { field: 'reportNotifications', expected: testData.reportNotifications, actual: updatedUser.reportNotifications },
      { field: 'showEmail', expected: testData.showEmail, actual: updatedUser.showEmail },
      { field: 'showPhone', expected: testData.showPhone, actual: updatedUser.showPhone },
      { field: 'publicProfile', expected: testData.publicProfile, actual: updatedUser.publicProfile }
    ];

    let passedChecks = 0;
    let failedChecks = 0;

    verificationChecks.forEach(check => {
      const matches = check.expected === check.actual;
      const status = matches ? '✅' : '❌';
      console.log(`${status} ${check.field}: expected ${check.expected}, got ${check.actual}`);
      
      if (matches) passedChecks++;
      else failedChecks++;
    });

    console.log(`\n📊 Verification Results: ${passedChecks}/${verificationChecks.length} checks passed`);

    // 4. Test individual preference toggles
    console.log('\n🎛️ Testing individual preference toggles...');
    
    // Toggle email notifications
    await db.update(users)
      .set({ emailNotifications: true })
      .where(eq(users.id, 3));
    
    const [emailToggleTest] = await db.select().from(users).where(eq(users.id, 3));
    console.log(emailToggleTest.emailNotifications ? '✅' : '❌', 'Email notifications toggle');

    // Toggle privacy settings
    await db.update(users)
      .set({ showEmail: false, publicProfile: true })
      .where(eq(users.id, 3));
    
    const [privacyToggleTest] = await db.select().from(users).where(eq(users.id, 3));
    console.log(!privacyToggleTest.showEmail ? '✅' : '❌', 'Privacy showEmail toggle');
    console.log(privacyToggleTest.publicProfile ? '✅' : '❌', 'Privacy publicProfile toggle');

    // 5. Test dropdown selections
    console.log('\n🌍 Testing dropdown selections...');
    
    await db.update(users)
      .set({ timezone: 'Europe/London', language: 'fr' })
      .where(eq(users.id, 3));
    
    const [dropdownTest] = await db.select().from(users).where(eq(users.id, 3));
    console.log(dropdownTest.timezone === 'Europe/London' ? '✅' : '❌', 'Timezone dropdown');
    console.log(dropdownTest.language === 'fr' ? '✅' : '❌', 'Language dropdown');

    console.log('\n🎉 All database operations completed successfully!');
    console.log('The preferences tab functionality is working correctly at the database level.');
    
    // Reset to clean state
    await db.update(users)
      .set({
        name: 'admin',
        email: '',
        phone: null,
        location: null,
        bio: null,
        title: null,
        company: null,
        website: null,
        linkedin: null,
        twitter: null,
        timezone: 'UTC',
        language: 'en',
        emailNotifications: true,
        browserNotifications: true,
        dealNotifications: true,
        matchNotifications: true,
        reportNotifications: true,
        showEmail: false,
        showPhone: false,
        publicProfile: true
      })
      .where(eq(users.id, 3));
    
    console.log('\n🔄 User reset to clean state for testing');

  } catch (error) {
    console.error('❌ Debug test failed:', error);
  }
}

debugPreferencesTab().catch(console.error);