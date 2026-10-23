import fs from 'fs';

const content = fs.readFileSync('scratch/local_db_dump.sql', 'utf8');
const lines = content.split('\n');
const processed = [];

processed.push("SET session_replication_role = 'replica';");
processed.push("");

for (let line of lines) {
  // If line starts with INSERT INTO public."TableName" VALUES (...);
  if (line.startsWith('INSERT INTO public."') && line.endsWith(');')) {
    // Append ON CONFLICT DO NOTHING before semicolon
    line = line.slice(0, -1) + ' ON CONFLICT DO NOTHING;';
  }
  processed.push(line);
}

processed.push("");
processed.push("SET session_replication_role = 'origin';");

fs.writeFileSync('scripts/seed-production.sql', processed.join('\n'), 'utf8');
console.log('Generated scripts/seed-production.sql with session_replication_role = replica successfully!');
