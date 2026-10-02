import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Development/CI only. Production never generates signing keys automatically.
export function developmentAuthEnv() {
  const directory = resolve('.tools/auth');
  mkdirSync(directory, { recursive: true });
  const keyPath = resolve(directory, 'signing.pem');
  if (!existsSync(keyPath)) writeFileSync(keyPath, generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  return {
    Auth__SigningKeyPem: process.env.Auth__SigningKeyPem || readFileSync(keyPath, 'utf8'),
    Auth__KeyRingPath: process.env.Auth__KeyRingPath || resolve(directory, 'keyring'),
    Media__Mode: 'Local', Media__LocalPath: resolve('.tools/media'), Media__AutoApprove: 'false',
    Email__Mode: 'Capture', Email__Host: '127.0.0.1', Email__Port: '1025', Email__Sender: 'no-reply@dating.local'
  };
}
if (process.argv.includes('--write')) {
  const config = { Auth: { SigningKeyPem: developmentAuthEnv().Auth__SigningKeyPem, KeyRingPath: developmentAuthEnv().Auth__KeyRingPath },
    Media: { Mode: 'Local', LocalPath: resolve('.tools/media'), AutoApprove: false },
    Email: { Mode: 'Capture', Host: '127.0.0.1', Port: 1025, Sender: 'no-reply@dating.local' } };
  writeFileSync(resolve('.tools/auth/config.json'), JSON.stringify(config), { mode: 0o600 });
  console.log('Local auth configuration prepared in ignored .tools/auth/config.json. No key material printed.');
}
