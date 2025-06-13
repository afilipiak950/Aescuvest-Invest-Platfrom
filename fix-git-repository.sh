#!/bin/bash

echo "Repairing Git repository..."

# Remove all lock files
echo "Removing lock files..."
find .git -name "*.lock" -type f -delete 2>/dev/null || true

# Reset Git configuration if corrupted
echo "Resetting Git configuration..."
git config --global --unset-all core.autocrlf 2>/dev/null || true
git config core.autocrlf false

# Fix remote URL if needed
echo "Checking remote configuration..."
CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
if [[ "$CURRENT_REMOTE" == *"Aescuvest-v2"* ]]; then
    git remote set-url origin https://github.com/afilipiak950/Aescuvest-Invest-Platfrom.git
fi

# Clean Git index if corrupted
echo "Cleaning Git index..."
git reset --mixed HEAD 2>/dev/null || true

# Verify repair
echo "Testing Git operations..."
git status
git remote -v

echo "Git repository repair complete!"
echo "You can now commit and push changes normally."