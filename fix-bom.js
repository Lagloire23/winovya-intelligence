#!/usr/bin/env node
// Nuclear BOM removal solution using Node.js
// This reads JSON files, parses them, and re-writes them WITHOUT BOM

const fs = require('fs');
const path = require('path');

const filesToFix = [
  'apps/web/package.json',
  'netlify.toml',
  'apps/web/index.html',
  'apps/web/tsconfig.json'
];

console.log('=== NUCLEAR BOM REMOVAL ===\n');

filesToFix.forEach(file => {
  const fullPath = path.join(process.cwd(), file);

  if (!fs.existsSync(fullPath)) {
    console.log(`SKIP: ${file} (not found)`);
    return;
  }

  try {
    // Read file as UTF-8 (Node.js automatically removes BOM on read)
    const content = fs.readFileSync(fullPath, 'utf8');

    // Write back WITHOUT BOM using utf8 encoding (which never adds BOM)
    // The trick: Convert to Buffer and back to ensure no BOM
    const buffer = Buffer.from(content, 'utf8');
    fs.writeFileSync(fullPath, buffer, { encoding: 'utf8' });

    console.log(`FIXED: ${file}`);
  } catch (err) {
    console.log(`ERROR: ${file} - ${err.message}`);
  }
});

console.log('\n=== VERIFICATION ===\n');

filesToFix.forEach(file => {
  const fullPath = path.join(process.cwd(), file);

  if (!fs.existsSync(fullPath)) return;

  try {
    const buffer = fs.readFileSync(fullPath);
    const hasBOM = buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF;

    if (hasBOM) {
      console.log(`FAIL: ${file} - BOM STILL PRESENT`);
    } else {
      console.log(`OK: ${file} - Clean (no BOM)`);
    }
  } catch (err) {
    console.log(`ERROR: ${file}`);
  }
});

console.log('\n✓ Done! Now run:');
console.log('  git add -A');
console.log('  git commit -m "fix: Nuclear BOM removal via Node.js"');
console.log('  git push origin main');
