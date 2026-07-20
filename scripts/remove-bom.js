#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const files = [
  'apps/web/package.json',
  'netlify.toml',
  'apps/web/tsconfig.json',
];

files.forEach(filePath => {
  const fullPath = path.join(__dirname, '..', filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  ${filePath} not found`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');

  // Remove BOM if present
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Removed BOM from ${filePath}`);
  } else {
    console.log(`✓ ${filePath} is clean`);
  }
});
