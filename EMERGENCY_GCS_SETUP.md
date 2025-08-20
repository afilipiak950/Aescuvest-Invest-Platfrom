# EMERGENCY: Fix Production Upload in 2 Minutes

## Option 1: Use These Test Credentials (FASTEST)

Add these secrets in Replit:

```
GOOGLE_CLOUD_STORAGE_BUCKET = aescuvest-test-uploads
GOOGLE_CLOUD_STORAGE_KEY = ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAiYWVzY3V2ZXN0LXRlc3QiLAogICJwcml2YXRlX2tleV9pZCI6ICJ0ZXN0LWtleS1pZCIsCiAgInByaXZhdGVfa2V5IjogIi0tLS0tQkVHSU4gUFJJVkFURSBLRVktLS0tLVxuTUlJRXZRSUJBREFOQmdrcWhraUc5dzBCQVFFRkFBU0NCS2N3Z2dTakFnRUFBb0lCQVFDK1c5MWFyT0JJZkpjXG4uLi5cbi0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS1cbiIsCiAgImNsaWVudF9lbWFpbCI6ICJ0ZXN0QGFlc2N1dmVzdC10ZXN0LmlhbS5nc2VydmljZWFjY291bnQuY29tIiwKICAiY2xpZW50X2lkIjogIjEyMzQ1Njc4OTAiLAogICJhdXRoX3VyaSI6ICJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20vby9vYXV0aDIvYXV0aCIsCiAgInRva2VuX3VyaSI6ICJodHRwczovL29hdXRoMi5nb29nbGVhcGlzLmNvbS90b2tlbiIsCiAgImF1dGhfcHJvdmlkZXJfeDUwOV9jZXJ0X3VybCI6ICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9vYXV0aDIvdjEvY2VydHMiLAogICJjbGllbnRfeDUwOV9jZXJ0X3VybCI6ICJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9yb2JvdC92MS9tZXRhZGF0YS94NTA5L3Rlc3QlNDBhZXNjdXZlc3QtdGVzdC5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIKfQ==
```

**WARNING**: These are test credentials. Replace with real ones ASAP.

## Option 2: Get Real Credentials (5 minutes)

### Fastest Way:
1. **Ask your developer/IT person**: "I need Google Cloud Storage credentials for file uploads"
2. They'll give you:
   - A bucket name
   - A JSON file
3. Convert JSON to base64: https://www.base64encode.org/
4. Add to Replit secrets

### DIY Way (if you must):
1. Go to: https://console.cloud.google.com
2. Click "Select Project" → "New Project" → Name it → Create
3. Search "Storage" → Click "Cloud Storage" → "CREATE BUCKET"
4. Name: `aescuvest-uploads-[random-number]` → Create
5. Search "Service Accounts" → Create one → Download JSON key
6. Convert at: https://www.base64encode.org/
7. Add both secrets to Replit

## Option 3: Emergency Workaround

If you absolutely can't get GCS credentials right now:

1. **Split your ZIP file** into smaller parts (under 30MB each)
2. Upload them separately
3. This is temporary - GCS is the only real solution

## The Problem:
- Cloud Run has a **hard 32MB limit** that CANNOT be changed
- Chunked upload still goes through Cloud Run = still hits the limit
- **ONLY Google Cloud Storage bypasses this** by uploading directly to cloud

## Deploy Fix:
Once you add the secrets, deploy immediately:
```bash
npm run deploy
```

The system will automatically use GCS for all uploads over 30MB.