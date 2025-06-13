#!/bin/bash

echo "Forcing Git repository repair..."

# Kill any potential Git processes
pkill -f git 2>/dev/null || true

# Force remove lock files with different approaches
sudo rm -f .git/*.lock 2>/dev/null || true
rm -f .git/*.lock 2>/dev/null || true
find .git -name "*.lock" -exec rm -f {} \; 2>/dev/null || true

# Create proper Git config
cat > .git/config << 'EOF'
[core]
	repositoryformatversion = 0
	filemode = true
	bare = false
	logallrefupdates = true
[remote "origin"]
	url = https://github.com/afilipiak950/Aescuvest-Invest-Platfrom.git
	fetch = +refs/heads/*:refs/remotes/origin/*
[branch "main"]
	remote = origin
	merge = refs/heads/main
EOF

# Test Git operations
echo "Testing Git functionality..."
git status
git remote -v

echo "Git repair complete!"