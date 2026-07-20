#!/bin/bash

# Bash script to force-push the cleaned repo to GitHub
# Run this from the repo directory

echo "Starting force-push to GitHub..."
echo ""

# Verify we're in the right directory
if [ ! -d ".git" ]; then
    echo "ERROR: Not in a git repository. Please run this from the repo root."
    exit 1
fi

# Verify we're on main branch
branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" != "main" ]; then
    echo "WARNING: Currently on branch '$branch', not 'main'"
fi

# Show what we're about to push
echo ""
echo "Latest commit to push:"
git log --oneline -1
echo ""

# Ask for confirmation
read -p "Do you want to force-push this commit to origin/main? (yes/no): " confirmation
if [ "$confirmation" != "yes" ]; then
    echo "Push cancelled."
    exit 0
fi

# Execute the force-push
echo "Executing: git push --force-with-lease origin main"
git push --force-with-lease origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "SUCCESS! Repository has been pushed to GitHub."
    echo "Netlify will automatically rebuild within seconds."
    echo ""
    echo "Check deployment progress at: https://app.netlify.com"
else
    echo ""
    echo "FAILED: Push to GitHub did not succeed."
    exit 1
fi
