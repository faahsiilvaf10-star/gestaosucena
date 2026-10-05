import fs from 'fs';
import path from 'path';

const lucideIndex = fs.readFileSync('./node_modules/lucide-react/dist/esm/lucide-react.js', 'utf8');
const map = {};
const exportRegex = /export\s+\{\s*default\s+as\s+([A-Za-z0-9_]+)\s*\}\s+from\s+['"]\.\/icons\/([^'"]+)['"]/g;
let m;
while ((m = exportRegex.exec(lucideIndex)) !== null) {
  map[m[1]] = m[2]; // ArrowLeft -> arrow-left.js
}

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
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
  let hasChanges = false;
  
  // Find lines like: import { X, Y } from 'lucide-react';
  const regex = /import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"];?/g;
  content = content.replace(regex, (match, importsStr) => {
    hasChanges = true;
    const imports = importsStr.split(',').map(s => s.trim()).filter(s => s);
    return imports.map(imp => {
      let iconFile = map[imp];
      if (!iconFile) {
        // fallback to kebab if not found
        iconFile = imp.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase() + '.js';
      }
      return `import ${imp} from 'lucide-react/dist/esm/icons/${iconFile}';`;
    }).join('\n');
  });

  if (hasChanges) {
    fs.writeFileSync(file, content);
    changedCount++;
  }
});

console.log('Restored', changedCount, 'files');
