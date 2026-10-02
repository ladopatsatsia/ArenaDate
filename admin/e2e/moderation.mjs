// Test-only TLS origin, real Angular build, real Kestrel API and isolated PostgreSQL fixture.
import { chromium, expect } from '@playwright/test';
import { createServer, request } from 'node:https';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createHmac } from 'node:crypto';
let input='';for await(const chunk of process.stdin)input+=chunk;
const fixture=JSON.parse(input);input='';
const root=resolve('admin/dist/admin/browser');
const server=createServer({key:fixture.privateKey,cert:fixture.certificate},async(req,res)=>{
 if(req.url.startsWith('/api/')){
  const target=new URL(req.url,fixture.api);
  const upstream=request(target,{method:req.method,headers:req.headers,rejectUnauthorized:false},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});
  upstream.on('error',()=>{res.writeHead(502);res.end();});req.pipe(upstream);return;
 }
 try{const pathname=new URL(req.url,'https://localhost').pathname.replace(/^\/admin\/?/,'');let file=resolve(root,pathname||'index.html');if(!file.startsWith(root))throw Error('Invalid path');
  let bytes;try{bytes=await readFile(file);}catch{file=resolve(root,'index.html');bytes=await readFile(file);}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(bytes);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`https://127.0.0.1:${server.address().port}`;
let browser;
function code(key){let bits=0,value=0;const bytes=[];for(const c of key){value=(value<<5)|'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c.toUpperCase());bits+=5;if(bits>=8){bits-=8;bytes.push((value>>bits)&255);}}const counter=Buffer.alloc(8);counter.writeBigInt64BE(BigInt(Math.floor(Date.now()/30000)));const hash=createHmac('sha1',Buffer.from(bytes)).update(counter).digest();const offset=hash[19]&15;return ((hash.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0');}
try{
 browser=await chromium.launch({channel:process.env.ADMIN_BROWSER_CHANNEL||'msedge',headless:true});
 const context=await browser.newContext({ignoreHTTPSErrors:true});const page=await context.newPage();
 await page.goto(base+'/admin/');await page.getByLabel('Email',{exact:true}).fill(fixture.email);await page.getByLabel('Password',{exact:true}).fill(fixture.password);await page.getByLabel('Authenticator code').fill(code(fixture.key));await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByText('Signed in as Admin.')).toBeVisible();
 await expect(page.getByRole('img',{name:'Pending profile photo for moderation'})).toHaveCount(2);
 const cookies=await context.cookies();const cookie=cookies.find(c=>c.name==='__Host-DatingAdmin');expect(cookie.httpOnly&&cookie.secure&&cookie.sameSite==='Strict').toBe(true);
 expect((await context.request.post(base+'/api/moderation/logout',{data:{}})).status()).toBe(400);
 await page.getByLabel('Decision reason (required)').fill('Browser approval rationale');await page.getByRole('button',{name:'Approve',exact:true}).first().click();await expect(page.getByText('Photo decision saved.')).toBeVisible();
 await page.getByLabel('Decision reason (required)').fill('Browser rejection rationale');await page.getByRole('button',{name:'Reject',exact:true}).click();await expect(page.getByText('No pending photos on this page.')).toBeVisible();
 await page.getByRole('button',{name:'Reports',exact:true}).click();await page.getByRole('button',{name:'Review evidence'}).click();await expect(page.locator('pre')).toContainText('Browser fixture reported message');
 await page.getByRole('button',{name:'Reported account'}).click();await page.getByLabel('Decision reason (required)').fill('Browser confirmed report');await page.getByRole('button',{name:'Suspend account',exact:true}).click();await expect(page.getByText('Account suspended. Sessions and push registrations revoked.')).toBeVisible();
 await page.getByLabel('Decision reason (required)').fill('Browser appeal reviewed');await page.getByRole('button',{name:'Reactivate account',exact:true}).click();await expect(page.getByText('Account reactivated. A new mobile login is required.')).toBeVisible();
 await page.getByRole('button',{name:'Reports',exact:true}).click();await page.getByRole('button',{name:'Review evidence'}).click();await page.getByLabel('Decision reason (required)').fill('Browser completed review');await page.getByRole('button',{name:'Close report with reason'}).click();await expect(page.getByText('No reports on this page.')).toBeVisible();
 await page.getByRole('button',{name:'Audit',exact:true}).click();await expect(page.getByText(/report_closed/)).toBeVisible();
 await mkdir('artifacts/admin-browser',{recursive:true});await page.screenshot({path:'artifacts/admin-browser/audit.png',fullPage:true});
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();expect((await context.request.get(base+'/api/moderation/me')).status()).toBe(401);
 console.log('PASS real Angular/Edge: MFA, Secure cookie, CSRF denial, photo approve/reject, report evidence/close, suspension/reactivation, audit, logout.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
