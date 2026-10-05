const fs = require('fs');
const path = require('path');
const toKebab = (str) => str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

function walk(dir) {
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      walk(filePath);
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      let content = fs.readFileSync(filePath, 'utf-8');
      const regex = /import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"]/g;
      let changed = false;
      content = content.replace(regex, (match, p1) => {
        changed = true;
        const icons = p1.split(',').map(i => i.trim()).filter(Boolean);
        return icons.map(icon => {
          if (icon.includes(' as ')) {
             const [orig, alias] = icon.split(' as ').map(i => i.trim());
             return `import ${alias} from 'lucide-react/dist/esm/icons/${toKebab(orig)}'`;
          }
          return `import ${icon} from 'lucide-react/dist/esm/icons/${toKebab(icon)}'`;
        }).join('\n');
      });
      if (changed) fs.writeFileSync(filePath, content);
    }
  });
}
walk('./src');
