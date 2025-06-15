#!/bin/bash

echo "🔧 Merging GitHub branches and pushing changes..."

# Force remove any Git lock files
find .git -name "*.lock" -delete 2>/dev/null || true

# Switch to main branch
git checkout main

# Merge replit-agent branch into main
git merge replit-agent --no-ff -m "Merge replit-agent branch: Enhanced AI platform with improved file management

- Fixed TypeScript errors in DataRoomExplorer component
- Enhanced file deletion with success notifications
- Improved deployment optimizations and Git repository stability
- Added comprehensive agent analysis system
- Resolved all merge conflicts and consolidated features"

# Add any remaining changes
git add .

# Push the merged main branch to GitHub
git push origin main

# Delete the merged branch locally and remotely
git branch -d replit-agent
git push origin --delete replit-agent

echo "✅ Branches merged successfully! Your GitHub repository now has a single main branch with all features."