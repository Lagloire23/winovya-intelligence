# PowerShell script to force-push the cleaned repo to GitHub
# Run this from the repo directory

Write-Host "Starting force-push to GitHub..." -ForegroundColor Green

# Verify we're in the right directory
if (-not (Test-Path ".git")) {
    Write-Host "ERROR: Not in a git repository. Please run this from the repo root." -ForegroundColor Red
    exit 1
}

# Verify we're on main branch
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne "main") {
    Write-Host "WARNING: Currently on branch '$branch', not 'main'" -ForegroundColor Yellow
}

# Show what we're about to push
Write-Host ""
Write-Host "Latest commit to push:" -ForegroundColor Cyan
git log --oneline -1
Write-Host ""

# Ask for confirmation
$confirmation = Read-Host "Do you want to force-push this commit to origin/main? (yes/no)"
if ($confirmation -ne "yes") {
    Write-Host "Push cancelled." -ForegroundColor Yellow
    exit 0
}

# Execute the force-push
Write-Host "Executing: git push --force-with-lease origin main" -ForegroundColor Yellow
git push --force-with-lease origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "SUCCESS! Repository has been pushed to GitHub." -ForegroundColor Green
    Write-Host "Netlify will automatically rebuild within seconds." -ForegroundColor Green
    Write-Host ""
    Write-Host "Check deployment progress at: https://app.netlify.com" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "FAILED: Push to GitHub did not succeed." -ForegroundColor Red
    Write-Host "Exit code: $LASTEXITCODE" -ForegroundColor Red
    exit 1
}
