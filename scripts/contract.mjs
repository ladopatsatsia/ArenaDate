import { developmentAuthEnv } from './auth-env.mjs';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import openapiTS, { astToString } from 'openapi-typescript';

const check = process.argv.includes('--check');
const reservation = createServer();
await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve); });
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const base = 'http://127.0.0.1:' + port;
const dotnet = process.env.DOTNET_COMMAND || (existsSync(resolve('.tools/dotnet/dotnet.exe')) ? resolve('.tools/dotnet/dotnet.exe') : 'dotnet');
const candidatePaths = [
  'backend/Dating.Api/bin/Debug/net10.0/build4/net10.0/Dating.Api.dll',
  'backend/Dating.Api/bin/Debug/net10.0/build3/net10.0/Dating.Api.dll',
  'backend/Dating.Api/bin/Debug/net10.0/build2/net10.0/Dating.Api.dll',
  'backend/Dating.Api/bin/Debug/net10.0/Dating.Api.dll'
];
let dbConn = process.env.ConnectionStrings__Database;
if (!dbConn && existsSync(resolve('infra/.env'))) {
  const envContent = await readFile(resolve('infra/.env'), 'utf8');
  const match = envContent.match(/POSTGRES_PASSWORD=(.+)/);
  if (match) {
    dbConn = `Host=127.0.0.1;Port=54432;Database=dating;Username=dating;Password=${match[1].trim()}`;
  }
}
const dotnetRoot = existsSync(resolve('.tools/dotnet')) ? resolve('.tools/dotnet') : undefined;
const dllPath = resolve(candidatePaths.find(p => existsSync(resolve(p))) || candidatePaths[0]);
const child = spawn(dotnet, [
  dllPath
], { cwd: resolve('backend/Dating.Api'), env: {
  ...process.env,
  ...(dotnetRoot ? {
    DOTNET_ROOT: dotnetRoot,
    PATH: `${dotnetRoot};${process.env.PATH || ''}`,
    DOTNET_CLI_HOME: resolve('.tools/dotnet-home'),
    NUGET_PACKAGES: resolve('.tools/nuget'),
  } : {}),
  ...developmentAuthEnv(),
  ASPNETCORE_ENVIRONMENT: 'Development',
  ASPNETCORE_URLS: base,
  ConnectionStrings__Database: dbConn || 'Host=localhost;Database=contract;Username=unused;Password=unused' },
  stdio: ['ignore', 'pipe', 'pipe'] });
let failed;
let childLogs = '';
child.stdout.on('data', d => { childLogs += d.toString(); });
child.stderr.on('data', d => { childLogs += d.toString(); });
child.on('error', error => { failed = error; });
child.on('exit', code => { failed ||= new Error(`API exited (${code}): ${childLogs}`); });
try {
  let document;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (failed) throw failed;
    if (attempt > 0 && attempt % 10 === 0) console.log(`[contract.mjs] attempt ${attempt}:`, childLogs.slice(-300));
    try {
      const response = await fetch(base + '/openapi/v1.json');
      if (response.ok) { document = await response.json(); break; }
    } catch { /* Startup retry is bounded; failure below is explicit. */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!document) throw new Error('API OpenAPI startup timed out');
  delete document.servers;
  const stable = value => Array.isArray(value) ? value.map(stable) :
    value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
  const json = JSON.stringify(stable(document), null, 2) + '\n';
  const types = astToString(await openapiTS(JSON.parse(json)));
  await mkdir('packages/api-contract/src', { recursive: true });
  for (const [path, value] of [['packages/api-contract/openapi.json', json], ['packages/api-contract/src/schema.d.ts', types]]) {
    if (check) {
      if (await readFile(path, 'utf8') !== value) throw new Error('Contract drift: ' + path + '. Run npm run contract:generate.');
    } else await writeFile(path, value);
  }
  console.log(check ? 'API contract and generated types match the running backend.' : 'API contract and shared types generated.');
} finally { child.kill(); }
