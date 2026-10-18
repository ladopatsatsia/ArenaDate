const fs = require('fs');
const path = require('path');

// Read i18n.ts
const i18nContent = fs.readFileSync(path.join(__dirname, '../../mobile/src/i18n.ts'), 'utf8');
const qualityContent = fs.readFileSync(path.join(__dirname, '../../mobile/src/qualityStrings.ts'), 'utf8');

console.log('Read files successfully');
