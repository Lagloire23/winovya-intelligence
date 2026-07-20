$files = @(
  "netlify.toml",
  "apps/web/package.json",
  "apps/web/index.html",
  "apps/web/tsconfig.json",
  "apps/web/vite.config.ts",
  "apps/web/postcss.config.js",
  "apps/web/tailwind.config.js",
  ".gitattributes"
)

foreach ($file in $files) {
  if (Test-Path $file) {
    try {
      $bytes = [System.IO.File]::ReadAllBytes($file)
      if ($bytes.Length -gt 2 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $bytesWithoutBOM = $bytes[3..($bytes.Length-1)]
        [System.IO.File]::WriteAllBytes($file, $bytesWithoutBOM)
        Write-Host "BOM removed: $file"
      } else {
        Write-Host "OK: $file"
      }
    } catch {
      Write-Host "ERROR: $file - $_"
    }
  }
}

Write-Host ""
git add -A
git commit -m "fix: Remove all BOMs using byte-level processing"
git push origin main
Write-Host "Done!"
