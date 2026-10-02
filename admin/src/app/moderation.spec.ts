import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ModerationApi } from './moderation-api';
import { ModerationPage } from './moderation';
describe('moderator session', () => {
 it('renews CSRF after login before fetching identity and stores no password', async () => {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const api = TestBed.inject(ModerationApi); const http = TestBed.inject(HttpTestingController);
  const task = api.login({ email: 'staff@example.test', password: 'test password', code: '123456' });
  http.expectOne('/api/moderation/csrf').flush(null); await Promise.resolve();
  const login = http.expectOne('/api/moderation/login'); expect(login.request.method).toBe('POST'); login.flush(null); await Promise.resolve(); await Promise.resolve();
  http.expectOne('/api/moderation/csrf').flush(null); await Promise.resolve();
  http.expectOne('/api/moderation/me').flush({ id: 'staff', role: 'Moderator' }); await task;
  expect(api.identity()?.role).toBe('Moderator'); http.verify();
 });
 it('clears identity on a revoked server session', async () => {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const api = TestBed.inject(ModerationApi); const http = TestBed.inject(HttpTestingController); api.identity.set({ id: 'staff', role: 'Admin' });
  const task = api.get('/reports'); const assertion = expect(task).rejects.toBeInstanceOf(HttpErrorResponse);
  http.expectOne('/api/moderation/reports').flush({}, { status: 401, statusText: 'Unauthorized' }); await assertion;
  expect(api.identity()).toBeNull(); http.verify();
 });
});
describe('moderation workspace', () => {
 function setup() { TestBed.configureTestingModule({ imports: [ModerationPage], providers: [provideHttpClient(), provideHttpClientTesting()] }); return TestBed.createComponent(ModerationPage).componentInstance; }
 it('does not show stale evidence after failed authorization and blocks invalid decisions', async () => {
  const page = setup(); const api = TestBed.inject(ModerationApi); const http = TestBed.inject(HttpTestingController); api.identity.set({ id: 'staff', role: 'Admin' });
  page.evidence.set({ private: 'old evidence' });
  const task = page.inspect({ id: 'report', subjectId: 'subject', category: 'spam', createdAt: '', closed: false });
  expect(page.evidence()).toBeNull();
  http.expectOne('/api/moderation/reports/report/evidence').flush({}, { status: 404, statusText: 'Missing' }); await task;
  expect(page.selected()).toBeNull(); expect(page.error()).toContain('no longer');
  await page.photo('photo', 'approved'); http.expectNone('/api/moderation/photos/photo'); http.verify();
 });
 it('uses the submitted reason, prevents duplicate clicks, and refreshes after approval', async () => {
  const page = setup(); const api = TestBed.inject(ModerationApi); const http = TestBed.inject(HttpTestingController); api.identity.set({ id: 'staff', role: 'Admin' });
  page.reason.setValue('Suitable profile photo'); const task = page.photo('photo', 'approved'); await page.photo('photo', 'approved');
  const request = http.expectOne('/api/moderation/photos/photo'); expect(request.request.body).toEqual({ state: 'approved', reason: 'Suitable profile photo' }); request.flush(null);
  await Promise.resolve(); await Promise.resolve(); http.expectOne('/api/moderation/photos').flush([]); await task;
  expect(page.notice()).toContain('saved'); expect(page.busy()).toBe(false); http.verify();
 });
 it('clears private evidence when the session expires', async () => {
  const page = setup(); const api = TestBed.inject(ModerationApi); const http = TestBed.inject(HttpTestingController); api.identity.set({ id: 'staff', role: 'Admin' });
  page.evidence.set({ private: 'snapshot' }); page.user.set({ id: 'user', displayName: 'private name', active: true });
  const task = page.refresh(); http.expectOne('/api/moderation/photos').flush({}, { status: 401, statusText: 'Unauthorized' }); await task;
  expect(page.evidence()).toBeNull(); expect(page.user()).toBeNull(); expect(api.identity()).toBeNull(); http.verify();
 });
});
