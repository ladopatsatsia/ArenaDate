import { developmentAuthEnv } from './auth-env.mjs';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { getReadiness } from '../mobile/src/api/client.ts';

// Real transport check in Node; this is not physical-device evidence.
globalThis.__DEV__ = true;
if (!process.env.ConnectionStrings__Database) throw new Error('Set ConnectionStrings__Database first.');
const reservation = createServer();
await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve); });
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const base = 'http://127.0.0.1:' + port;
const child = spawn(process.env.DOTNET_COMMAND || 'dotnet',
  [resolve('backend/Dating.Api/bin/Debug/net10.0/Dating.Api.dll')],
  { cwd: resolve('backend/Dating.Api'), env: { ...process.env, ...developmentAuthEnv(), ASPNETCORE_ENVIRONMENT: 'Development', ASPNETCORE_URLS: base }, stdio: 'ignore' });
let failed;
child.on('error', error => { failed = error; });
child.on('exit', code => { failed ||= new Error('API exited: ' + code); });
try {
  let started = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (failed) throw failed;
    try { if ((await fetch(base + '/api/health/live')).ok) { started = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!started) throw new Error('API startup timeout');
  // Liveness precedes database/model startup. Require actual readiness within a bounded startup window.
  // Each request still uses the real mobile timeout and the API's unchanged three-second readiness budget.
  let result;
  let lastError;
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (failed) throw failed;
    try { result = await getReadiness(base); break; }
    catch (error) { lastError = error; await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  if (!result) throw lastError || new Error('API readiness startup timeout');
  console.log('Real mobile fetch wrapper -> API -> PostgreSQL: ' + result.status);
} finally { child.kill(); }
