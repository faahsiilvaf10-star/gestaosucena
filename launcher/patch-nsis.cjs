const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'node_modules', 'app-builder-lib', 'templates', 'nsis', 'installer.nsi');

if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, 'utf8');
  
  if (!content.includes('MUI_PAGE_CUSTOMFUNCTION_SHOW myInstFilesShow')) {
    content = content.replace('!ifdef ONE_CLICK', '!ifdef ONE_CLICK\n  !define MUI_PAGE_CUSTOMFUNCTION_SHOW myInstFilesShow');
    fs.writeFileSync(file, content);
    console.log('Patched installer.nsi to include MUI_PAGE_CUSTOMFUNCTION_SHOW');
  } else {
    console.log('installer.nsi is already patched.');
  }
} else {
  console.error('installer.nsi not found at ' + file);
}
