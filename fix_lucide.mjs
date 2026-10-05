import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./src');
let changedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let hasLucide = false;
  let importsToAdd = new Set();
  
  const lines = content.split('\n');
  const newLines = [];
  for (let line of lines) {
    const match = line.match(/import\s+([A-Za-z0-9_]+)\s+from\s+['"]lucide-react\/dist\/esm\/icons\/[^'"]+['"]/);
    if (match) {
      importsToAdd.add(match[1]);
      hasLucide = true;
    } else {
      newLines.push(line);
    }
  }
  
  if (hasLucide) {
    // Check if there's already an import from 'lucide-react'
    let existingLucideImportIndex = newLines.findIndex(l => l.match(/^import\s+{[^}]+}\s+from\s+['"]lucide-react['"]/));
    if (existingLucideImportIndex !== -1) {
      // Add to existing import - simple approach just prepend a new one, JS allows multiple imports from same module
    }
    const newImport = `import { ${Array.from(importsToAdd).join(', ')} } from 'lucide-react';`;
    newLines.unshift(newImport);
    fs.writeFileSync(file, newLines.join('\n'));
    changedCount++;
  }
});

console.log('Fixed', changedCount, 'files');
