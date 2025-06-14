#!/bin/bash

echo "Fixing Git repository for GitHub push..."

# Force remove lock files
rm -f .git/config.lock .git/index.lock .git/refs/heads/*.lock 2>/dev/null

# Reset Git state
git reset --mixed HEAD 2>/dev/null

# Add all changes
git add .

# Commit changes
git commit -m "Sync repository: Enhanced file deletion, deployment optimizations, and UI improvements

- Added success notifications for file deletion operations
- Fixed deployment size issues with comprehensive optimization
- Enhanced DataRoomExplorer interface with better error handling
- Improved Git repository configuration and stability
- Updated TypeScript types for better code quality"

# Push to GitHub
git push origin main

echo "Repository sync complete!"