const fs = require('fs');
const path = require('path');

const resources = {
  en: {},
  ka: {}
};

// Evaluate qualityStrings
const qualityFile = fs.readFileSync(path.join(__dirname, '../mobile/src/qualityStrings.ts'), 'utf8');
const qualityMatches = qualityFile.replace('export const qualityStrings=', 'module.exports =');
// write temporary file to require
fs.writeFileSync(path.join(__dirname, 'temp_quality.js'), qualityMatches);
const quality = require('./temp_quality.js');
Object.assign(resources.en, quality.en);
Object.assign(resources.ka, quality.ka);

// Now parse i18n.ts
const i18nFile = fs.readFileSync(path.join(__dirname, '../mobile/src/i18n.ts'), 'utf8');

// We can extract initial resources:
// en initial
const enInitialMatch = i18nFile.match(/en:\s*\{\s*translation:\s*\{([^}]+)\}\s*\}/);
if (enInitialMatch) {
  const code = '({' + enInitialMatch[1] + '})';
  try {
    const obj = eval(code);
    Object.assign(resources.en, obj);
  } catch (e) {
    console.error('eval enInitialMatch failed', e);
  }
}

// ka initial
const kaInitialMatch = i18nFile.match(/ka:\s*\{\s*translation:\s*\{([^}]+)\}\s*\}/);
if (kaInitialMatch) {
  const code = '({' + kaInitialMatch[1] + '})';
  try {
    const obj = eval(code);
    Object.assign(resources.ka, obj);
  } catch (e) {
    console.error('eval kaInitialMatch failed', e);
  }
}

// Extract Object.assign(resources.en.translation, ...)
const enAssignRegex = /Object\.assign\(resources\.en\.translation,\s*(\{[\s\S]*?\})\);/g;
let match;
while ((match = enAssignRegex.exec(i18nFile)) !== null) {
  try {
    const obj = eval('(' + match[1] + ')');
    Object.assign(resources.en, obj);
  } catch (e) {
    console.error('eval enAssign failed', e);
  }
}

// Extract Object.assign(resources.ka.translation, ...)
const kaAssignRegex = /Object\.assign\(resources\.ka\.translation,\s*(\{[\s\S]*?\})\);/g;
while ((match = kaAssignRegex.exec(i18nFile)) !== null) {
  try {
    const obj = eval('(' + match[1] + ')');
    Object.assign(resources.ka, obj);
  } catch (e) {
    console.error('eval kaAssign failed', e);
  }
}

console.log('Total EN keys:', Object.keys(resources.en).length);
console.log('Total KA keys:', Object.keys(resources.ka).length);

// Check if any key is in EN but missing in KA or vice versa
const allKeys = Array.from(new Set([...Object.keys(resources.en), ...Object.keys(resources.ka)]));
console.log('Total unique keys:', allKeys.length);

const missingInKa = allKeys.filter(k => !resources.ka[k]);
const missingInEn = allKeys.filter(k => !resources.en[k]);
console.log('Missing in KA:', missingInKa);
console.log('Missing in EN:', missingInEn);

fs.writeFileSync(path.join(__dirname, 'extracted_en.json'), JSON.stringify(resources.en, null, 2));
fs.writeFileSync(path.join(__dirname, 'extracted_ka.json'), JSON.stringify(resources.ka, null, 2));
console.log('Wrote extracted files.');
