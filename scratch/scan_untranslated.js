const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file === 'node_modules' || file === '.expo' || file === 'locales' || file === 'dist') continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = walk('mobile');
const geoRegex = /[\u10A0-\u10FF]/;

const findings = [];
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  const unlocalized = [];
  lines.forEach((line, idx) => {
    if (!geoRegex.test(line)) return;
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('{/*')) return;
    if (!line.includes('t(')) {
      unlocalized.push({ lineNum: idx + 1, text: trimmed });
    }
  });
  if (unlocalized.length > 0) {
    findings.push({ file: f, lines: unlocalized });
  }
}

console.log('Files with Georgian text NOT on lines with t():', findings.length);
findings.forEach(res => {
  console.log('\n--- ' + res.file + ' (' + res.lines.length + ' lines) ---');
  res.lines.slice(0, 20).forEach(l => console.log('L' + l.lineNum + ': ' + l.text));
  if (res.lines.length > 20) console.log('... and ' + (res.lines.length - 20) + ' more');
});
