/**
 * 🚨 CRITICAL ZIP UPLOAD FRONTEND DEBUGGING SCRIPT
 * 
 * Run this in browser console to trace why ZIP uploads are failing
 */

window.debugZipUpload = () => {
  console.log('🚨 CRITICAL ZIP UPLOAD DEBUG - Starting comprehensive frontend analysis...');
  console.log('📅 Date: August 19, 2025');
  console.log('🎯 Goal: Identify exact failure point in ZIP upload pipeline');
  console.log('');

  // Test 1: Check if upload components are present
  console.log('📊 STEP 1: UPLOAD COMPONENT PRESENCE CHECK');
  console.log('═'.repeat(60));
  
  const uploadButton = document.querySelector('input[type="file"][accept=".zip"]');
  const uploadArea = document.querySelector('[data-testid="zip-upload-area"]') || 
                     document.querySelector('.upload-area') ||
                     document.querySelector('[class*="upload"]');
  
  console.log('🔍 Upload file input found:', !!uploadButton);
  console.log('🔍 Upload area found:', !!uploadArea);
  
  if (uploadButton) {
    console.log('  ✅ File input details:', {
      id: uploadButton.id,
      name: uploadButton.name,
      accept: uploadButton.accept,
      multiple: uploadButton.multiple,
      disabled: uploadButton.disabled
    });
  } else {
    console.log('  ❌ No file input found - upload interface missing!');
  }

  // Test 2: Check upload event handlers
  console.log('');
  console.log('📊 STEP 2: EVENT HANDLER VERIFICATION');
  console.log('═'.repeat(60));
  
  if (uploadButton) {
    const events = getEventListeners(uploadButton) || {};
    console.log('🔍 File input event listeners:', Object.keys(events));
    
    if (events.change) {
      console.log('  ✅ Change event handler found');
    } else {
      console.log('  ❌ No change event handler - upload won\'t trigger!');
    }
  }

  // Test 3: API endpoint accessibility
  console.log('');
  console.log('📊 STEP 3: API ENDPOINT ACCESSIBILITY TEST');
  console.log('═'.repeat(60));
  
  fetch('/api/upload/test')
    .then(response => {
      console.log('🔍 API test response status:', response.status);
      return response.json();
    })
    .then(data => {
      console.log('✅ API test response:', data);
    })
    .catch(error => {
      console.log('❌ API test failed:', error);
    });

  // Test 4: Check for authentication
  console.log('');
  console.log('📊 STEP 4: AUTHENTICATION STATUS');
  console.log('═'.repeat(60));
  
  fetch('/api/auth/session')
    .then(response => response.json())
    .then(data => {
      console.log('🔍 Auth status:', data);
      if (!data.authenticated) {
        console.log('⚠️  User not authenticated - uploads may fail');
      }
    })
    .catch(error => {
      console.log('❌ Auth check failed:', error);
    });

  // Test 5: React DevTools check
  console.log('');
  console.log('📊 STEP 5: REACT COMPONENT STATE');
  console.log('═'.repeat(60));
  
  if (window.React) {
    console.log('✅ React found on window');
  } else {
    console.log('⚠️  React not found on window');
  }

  // Test 6: Console error monitoring
  console.log('');
  console.log('📊 STEP 6: ERROR MONITORING SETUP');
  console.log('═'.repeat(60));
  
  // Override console.error to catch upload errors
  const originalError = console.error;
  window.uploadErrorMonitor = (msg, ...args) => {
    console.log('🚨 UPLOAD ERROR DETECTED:', msg, args);
    originalError(msg, ...args);
  };
  console.error = window.uploadErrorMonitor;
  
  console.log('✅ Error monitoring activated');
  console.log('Now try uploading a ZIP file and watch for detailed error logs');

  // Test 7: Network monitoring
  console.log('');
  console.log('📊 STEP 7: NETWORK MONITORING INSTRUCTIONS');
  console.log('═'.repeat(60));
  console.log('1. Open Network tab in DevTools');
  console.log('2. Try uploading a ZIP file');
  console.log('3. Look for failed requests (red entries)');
  console.log('4. Check request headers and response details');
  console.log('5. Look for these specific endpoints:');
  console.log('   • POST /api/deals/[dealId]/data-room/upload-zip');
  console.log('   • GET /api/upload/test');
  console.log('   • Any chunked upload requests');

  return {
    uploadButtonFound: !!uploadButton,
    uploadAreaFound: !!uploadArea,
    instructions: 'Upload debugging setup complete. Try uploading a ZIP file now.'
  };
};

// Auto-run the debugging script
console.log('🚀 ZIP Upload Frontend Debugger loaded');
console.log('Run window.debugZipUpload() to start debugging');
console.log('Or run debugZipUpload() directly');