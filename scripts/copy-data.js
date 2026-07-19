const fs = require('fs');
const path = require('path');

const mode = process.argv[2]; // 'demo' or 'real'
if (mode !== 'demo' && mode !== 'real') {
  console.error('Usage: node scripts/copy-data.js [demo|real]');
  process.exit(1);
}

const srcDir = mode === 'demo' ? 'demo-data' : 'data-real';
const destDir = 'data';

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

if (!fs.existsSync(srcDir)) {
  console.error(`Source directory "${srcDir}" does not exist.`);
  process.exit(1);
}

try {
  const files = fs.readdirSync(srcDir);
  let count = 0;
  for (const file of files) {
    const srcPath = path.join(srcDir, file);
    const stat = fs.statSync(srcPath);
    if (stat.isFile()) {
      if (mode === 'demo' && !file.endsWith('.json')) {
        // Only copy JSON files for demo-data
        continue;
      }
      const destPath = path.join(destDir, file);
      fs.copyFileSync(srcPath, destPath);
      count++;
    }
  }
  console.log(`Successfully copied ${count} files from ${srcDir} to ${destDir}.`);
} catch (err) {
  console.error('Error copying files:', err);
  process.exit(1);
}
