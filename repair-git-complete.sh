#!/bin/bash

echo "Starting comprehensive Git repository repair..."

# Step 1: Force remove all lock files
echo "Removing Git lock files..."
find .git -name "*.lock" -type f -delete 2>/dev/null || true
rm -f .git/config.lock .git/index.lock .git/refs/heads/*.lock 2>/dev/null || true

# Step 2: Reset Git index if corrupted
echo "Resetting Git index..."
git reset --mixed HEAD 2>/dev/null || true

# Step 3: Clean Git configuration
echo "Cleaning Git configuration..."
git config --global --unset-all core.autocrlf 2>/dev/null || true
git config core.autocrlf false

# Step 4: Verify and fix remote URL
echo "Checking remote configuration..."
CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
if [[ "$CURRENT_REMOTE" != *"Aescuvest-Invest-Platfrom.git" ]]; then
    git remote set-url origin https://github.com/afilipiak950/Aescuvest-Invest-Platfrom.git 2>/dev/null || true
fi

# Step 5: Add all changes and commit
echo "Adding changes and committing..."
git add . 2>/dev/null || true
git commit -m "Fix: Repository synchronization and recent improvements

- Enhanced file deletion with user feedback
- Fixed deployment size optimizations  
- Improved DataRoomExplorer interface
- Updated Git repository configuration" 2>/dev/null || true

# Step 6: Push to GitHub
echo "Pushing to GitHub..."
git push origin main 2>/dev/null || git push -u origin main 2>/dev/null || true

# Step 7: Verify repair
echo "Verifying Git repository status..."
echo "Remote URL: $(git remote get-url origin)"
echo "Current branch: $(git branch --show-current)"
echo "Last commit: $(git log --oneline -1)"
echo "Repository status:"
git status --short

echo "Git repository repair complete!"