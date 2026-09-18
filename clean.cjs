const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

const dirs = ['src/components', 'src/routes'];

dirs.forEach(d => walk(d, (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    content = content.replace(/\bfont-display\b/g, '');
    content = content.replace(/\bfont-serif\b/g, '');
    content = content.replace(/\bfont-tarmiles\b/g, '');
    content = content.replace(/\bitalic\b/g, '');
    
    content = content.replace(/className="([^"]*)"/g, (match, p1) => {
      let cleaned = p1.replace(/\s+/g, ' ').trim();
      return `className="${cleaned}"`;
    });
    
    content = content.replace(/className=\{`([^`]*)`\}/g, (match, p1) => {
      let cleaned = p1.replace(/\s+/g, ' ').trim();
      return `className={\`${cleaned}\`}`;
    });
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated ' + filePath);
    }
  }
}));
