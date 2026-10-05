import fs from 'fs';
import path from 'path';

const lucideIndex = fs.readFileSync('./node_modules/lucide-react/dist/esm/lucide-react.js', 'utf8');
const map = {};

// Match all export lines
const lines = lucideIndex.split('\n');
for (const line of lines) {
  if (line.startsWith('export {')) {
    // Extract the file path
    const fileMatch = line.match(/from\s+['"]\.\/icons\/([^'"]+)['"]/);
    if (fileMatch) {
      const iconFile = fileMatch[1];
      // Extract all aliases
      const asMatches = [...line.matchAll(/default\s+as\s+([A-Za-z0-9_]+)/g)];
      for (const m of asMatches) {
        map[m[1]] = iconFile;
      }
    }
  }
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
  
  // Find broken imports: import Loader2 from 'lucide-react/dist/esm/icons/loader2.js'
  // Or: import ArrowLeft from 'lucide-react/dist/esm/icons/arrowleft.js'
  const regex = /import\s+([A-Za-z0-9_]+)\s+from\s+['"]lucide-react\/dist\/esm\/icons\/[^'"]+\.js['"];?/g;
  content = content.replace(regex, (match, impName) => {
    const iconFile = map[impName];
    if (iconFile) {
      const correctImport = `import ${impName} from 'lucide-react/dist/esm/icons/${iconFile}';`;
      if (match !== correctImport) {
        hasChanges = true;
        return correctImport;
      }
    }
    return match;
  });

  if (hasChanges) {
    fs.writeFileSync(file, content);
    changedCount++;
  }
});

console.log('Fixed deep imports in', changedCount, 'files');
