-- Manual migration to fix ai_score column type in production
-- Run this SQL directly on your production database before deploying

-- Step 1: Check current data type
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'deals' AND column_name = 'ai_score';

-- Step 2: Handle the type conversion safely
-- If ai_score contains text values, this will convert them properly
ALTER TABLE "deals" 
ALTER COLUMN "ai_score" 
TYPE integer 
USING CASE 
  WHEN "ai_score" IS NULL THEN NULL
  WHEN "ai_score" ~ '^[0-9]+$' THEN "ai_score"::integer
  ELSE NULL
END;

-- Step 3: Verify the change
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'deals' AND column_name = 'ai_score';
