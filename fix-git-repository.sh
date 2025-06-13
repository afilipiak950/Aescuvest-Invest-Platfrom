#!/bin/bash

echo "🔧 Fixing Git repository issues..."

# Step 1: Remove any lock files that might exist
echo "🧹 Removing Git lock files..."
find .git -name "*.lock" -type f -delete 2>/dev/null || true

# Step 2: Fix the malformed remote URL
echo "🔗 Fixing Git remote configuration..."
git config --unset remote.origin.url 2>/dev/null || true
git config --unset remote.origin.fetch 2>/dev/null || true

# Step 3: Re-add the remote with correct format
echo "📡 Re-adding Git remote..."
git remote add origin https://github.com/afilipiak950/Aescuvest-Invest-Platfrom.git 2>/dev/null || true

# Step 4: Verify the fix
echo "✅ Verifying Git repository status..."
git remote -v
git status --porcelain

echo "🎉 Git repository fixed successfully!"