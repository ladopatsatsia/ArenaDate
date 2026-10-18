import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { ModerationApi } from './moderation-api';
import { ModerationPage } from './moderation';

describe('moderator session', () => {
  it('renews CSRF after login before fetching identity and stores no password', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const api = TestBed.inject(ModerationApi);
    const http = TestBed.inject(HttpTestingController);
    const task = api.login({ email: 'staff@example.test', password: 'test password', code: '123456' });
    http.expectOne('/api/moderation/csrf').flush(null);
    await Promise.resolve();
    const login = http.expectOne('/api/moderation/login');
    expect(login.request.method).toBe('POST');
    login.flush(null);
    await Promise.resolve();
    await Promise.resolve();
    http.expectOne('/api/moderation/csrf').flush(null);
    await Promise.resolve();
    http.expectOne('/api/moderation/me').flush({ id: 'staff', role: 'Moderator' });
    await task;
    expect(api.identity()?.role).toBe('Moderator');
    http.verify();
  });

  it('clears identity on a revoked server session', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const api = TestBed.inject(ModerationApi);
    const http = TestBed.inject(HttpTestingController);
    api.identity.set({ id: 'staff', role: 'Admin' });
    const task = api.get('/reports');
    const assertion = expect(task).rejects.toBeInstanceOf(HttpErrorResponse);
    http.expectOne('/api/moderation/reports').flush({}, { status: 401, statusText: 'Unauthorized' });
    await assertion;
    expect(api.identity()).toBeNull();
    http.verify();
  });
});

describe('moderation workspace', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [ModerationPage],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    return TestBed.createComponent(ModerationPage).componentInstance;
  }

  it('does not show stale evidence after failed authorization and blocks invalid decisions', async () => {
    const page = setup();
    const api = TestBed.inject(ModerationApi);
    const http = TestBed.inject(HttpTestingController);
    api.identity.set({ id: 'staff', role: 'Admin' });
    page.evidence.set({ private: 'old evidence' });
    const task = page.inspect({ id: 'report', subjectId: 'subject', category: 'spam', createdAt: '', closed: false });
    expect(page.evidence()).toBeNull();
    http.expectOne('/api/moderation/reports/report/evidence').flush({}, { status: 404, statusText: 'Missing' });
    await task;
    expect(page.selected()).toBeNull();
    expect(page.error()).toContain('no longer');
    await page.photo('photo', 'approved');
    http.expectNone('/api/moderation/photos/photo');
    http.verify();
  });

  it('uses the submitted reason, prevents duplicate clicks, and refreshes after approval', async () => {
    const page = setup();
    const api = TestBed.inject(ModerationApi);
    const http = TestBed.inject(HttpTestingController);
    api.identity.set({ id: 'staff', role: 'Admin' });
    page.tab.set('photos');
    page.reason.setValue('Suitable profile photo');
    const task = page.photo('photo', 'approved');
    await page.photo('photo', 'approved');
    const request = http.expectOne('/api/moderation/photos/photo');
    expect(request.request.body).toEqual({ state: 'approved', reason: 'Suitable profile photo' });
    request.flush(null);
    await Promise.resolve();
    await Promise.resolve();
    http.expectOne('/api/moderation/photos').flush([]);
    await task;
    expect(page.notice()).toContain('saved');
    expect(page.busy()).toBe(false);
    http.verify();
  });

  it('clears private evidence when the session expires', async () => {
    const page = setup();
    const api = TestBed.inject(ModerationApi);
    const http = TestBed.inject(HttpTestingController);
    api.identity.set({ id: 'staff', role: 'Admin' });
    page.tab.set('photos');
    page.evidence.set({ private: 'snapshot' });
    page.user.set({ id: 'user', displayName: 'private name', active: true });
    const task = page.refresh();
    http.expectOne('/api/moderation/photos').flush({}, { status: 401, statusText: 'Unauthorized' });
    await task;
    expect(page.evidence()).toBeNull();
    expect(page.user()).toBeNull();
    expect(api.identity()).toBeNull();
    http.verify();
  });

  it('loads profiles and allows inspecting a profile detail', async () => {
    const page = setup();
    const api = TestBed.inject(ModerationApi);
    const http = TestBed.inject(HttpTestingController);
    api.identity.set({ id: 'staff', role: 'Admin' });
    page.tab.set('profiles');
    const task = page.refresh();
    const req = http.expectOne('/api/moderation/profiles?page=1&pageSize=50');
    req.flush([
      {
        userId: 'u1',
        email: 'u1@test.com',
        displayName: 'Ana',
        gender: 'Female',
        city: 'Tbilisi',
        age: 24,
        active: true,
        emailConfirmed: true,
        visible: true,
        photoCount: 1,
        primaryPhotoId: 'p1',
        crystals: 50
      }
    ]);
    await task;
    expect(page.profiles().length).toBe(1);
    expect(page.profiles()[0].displayName).toBe('Ana');

    const detailTask = page.inspectProfile('u1');
    const detailReq = http.expectOne('/api/moderation/profiles/u1');
    detailReq.flush({
      userId: 'u1',
      email: 'u1@test.com',
      emailConfirmed: true,
      active: true,
      displayName: 'Ana',
      bio: 'Hello world',
      gender: 'Female',
      desiredGenders: ['Male'],
      city: 'Tbilisi',
      cityKey: 'tbilisi',
      dateOfBirth: '2000-01-01',
      age: 24,
      interests: ['Travel'],
      relationshipGoal: 'Long-term',
      languages: ['Georgian'],
      visible: true,
      minAge: 20,
      maxAge: 30,
      radiusKm: 50,
      locationMode: 'City',
      revision: 1,
      photos: [{ id: 'p1', state: 'approved', position: 0, createdAt: '2026-01-01T00:00:00Z' }],
      crystals: 50
    });
    await detailTask;
    expect(page.selectedProfile()?.displayName).toBe('Ana');
    expect(page.selectedProfile()?.interests).toEqual(['Travel']);
    http.verify();
  });

  it('allows suspending and deleting a profile from the profiles list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const page = setup();
    const api = TestBed.inject(ModerationApi);
    const http = TestBed.inject(HttpTestingController);
    api.identity.set({ id: 'staff', role: 'Admin' });
    page.profiles.set([
      {
        userId: 'u1',
        email: 'u1@test.com',
        displayName: 'Ana',
        gender: 'Female',
        city: 'Tbilisi',
        age: 24,
        active: true,
        emailConfirmed: true,
        visible: true,
        photoCount: 1,
        primaryPhotoId: 'p1',
        crystals: 50
      }
    ]);

    // Test suspend
    const toggleTask = page.toggleProfileAccount('u1', false);
    const suspendReq = http.expectOne('/api/moderation/users/u1');
    expect(suspendReq.request.method).toBe('POST');
    expect(suspendReq.request.body).toEqual({ active: false, reason: 'Admin suspended account' });
    suspendReq.flush(null);
    await toggleTask;
    expect(page.profiles()[0].active).toBe(false);

    // Test delete
    const deleteTask = page.deleteProfile('u1');
    const deleteReq = http.expectOne('/api/moderation/users/u1?reason=' + encodeURIComponent('Admin deleted account'));
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush(null);
    await deleteTask;
    expect(page.profiles().length).toBe(0);
    http.verify();
  });

  it('allows registering a new user and prepending them to the profile list', async () => {
    const page = setup();
    const api = TestBed.inject(ModerationApi);
    const http = TestBed.inject(HttpTestingController);
    api.identity.set({ id: 'staff', role: 'Admin' });
    page.tab.set('profiles');
    page.createUserForm.setValue({
      email: 'newuser@example.com',
      password: 'password123!',
      displayName: 'Giorgi',
      dateOfBirth: '1998-04-12',
      gender: 'man',
      city: 'Batumi',
      initialCrystals: 100
    });
    const task = page.submitCreateUser();
    const req = http.expectOne('/api/moderation/users');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      email: 'newuser@example.com',
      password: 'password123!',
      displayName: 'Giorgi',
      dateOfBirth: '1998-04-12',
      gender: 'man',
      city: 'Batumi',
      initialCrystals: 100
    });
    req.flush({
      userId: 'u-new',
      email: 'newuser@example.com',
      displayName: 'Giorgi',
      gender: 'man',
      city: 'Batumi',
      age: 28,
      active: true,
      emailConfirmed: true,
      visible: true,
      photoCount: 0,
      primaryPhotoId: null,
      crystals: 100
    });
    await task;
    expect(page.profiles().length).toBe(1);
    expect(page.profiles()[0].displayName).toBe('Giorgi');
    expect(page.profiles()[0].crystals).toBe(100);
    expect(page.showCreateUser()).toBe(false);
    http.verify();
  });

  it('allows adjusting user crystals and updating balance in state', async () => {
    const page = setup();
    const api = TestBed.inject(ModerationApi);
    const http = TestBed.inject(HttpTestingController);
    api.identity.set({ id: 'staff', role: 'Admin' });
    page.profiles.set([
      {
        userId: 'u1',
        email: 'u1@test.com',
        displayName: 'Ana',
        gender: 'Female',
        city: 'Tbilisi',
        age: 24,
        active: true,
        emailConfirmed: true,
        visible: true,
        photoCount: 1,
        primaryPhotoId: 'p1',
        crystals: 50
      }
    ]);

    page.openCrystalModal(page.profiles()[0]);
    expect(page.selectedCrystalUser()?.userId).toBe('u1');
    page.applyQuickDelta(100);
    expect(page.crystalForm.controls.amount.value).toBe(100);

    const task = page.submitCrystalAdjustment();
    const req = http.expectOne('/api/moderation/users/u1/crystals');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ amount: 100, mode: 'delta' });
    req.flush({
      userId: 'u1',
      oldBalance: 50,
      newBalance: 150,
      delta: 100
    });
    await task;
    expect(page.profiles()[0].crystals).toBe(150);
    expect(page.selectedCrystalUser()).toBeNull();
    http.verify();
  });

  it('loads telegram subscriber stats when changing to broadcast tab', async () => {
    const page = setup();
    const api = TestBed.inject(ModerationApi);
    const http = TestBed.inject(HttpTestingController);
    api.identity.set({ id: 'staff', role: 'Admin' });

    const task = page.change('broadcast');
    const req = http.expectOne('/api/moderation/telegram-stats');
    expect(req.request.method).toBe('GET');
    req.flush({
      totalSubscribers: 10,
      activeSubscribers: 8,
      linkedUsersCount: 5,
      latestActivityUtc: '2026-10-16T12:00:00Z'
    });
    await task;

    expect(page.tab()).toBe('broadcast');
    expect(page.tgStats()?.totalSubscribers).toBe(10);
    expect(page.tgStats()?.activeSubscribers).toBe(8);
    expect(page.tgStats()?.linkedUsersCount).toBe(5);
    http.verify();
  });

  it('applies quick template and broadcasts message to telegram subscribers', async () => {
    const page = setup();
    const api = TestBed.inject(ModerationApi);
    const http = TestBed.inject(HttpTestingController);
    api.identity.set({ id: 'staff', role: 'Admin' });

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    page.applyBroadcastTemplate('welcome');
    expect(page.broadcastForm.controls.buttonText.value).toBe('🚀 ARENA-ს გახსნა');
    expect(page.broadcastForm.controls.webAppPath.value).toBe('/arena');
    expect(page.broadcastForm.controls.message.value).toContain('მოგესალმებით ARENA-ში');

    const task = page.sendBroadcast();
    const req = http.expectOne('/api/moderation/broadcast-telegram');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.message).toContain('მოგესალმებით ARENA-ში');
    expect(req.request.body.buttonText).toBe('🚀 ARENA-ს გახსნა');
    expect(req.request.body.webAppRelativePath).toBe('/arena');

    req.flush({
      totalSubscribers: 12,
      targeted: 10,
      successCount: 9,
      failedCount: 0,
      blockedCount: 1,
      completedAtUtc: '2026-10-16T14:00:00Z'
    });
    await Promise.resolve();
    await Promise.resolve();

    const statsReq = http.expectOne('/api/moderation/telegram-stats');
    statsReq.flush({
      totalSubscribers: 12,
      activeSubscribers: 9,
      linkedUsersCount: 6,
      latestActivityUtc: '2026-10-16T14:00:00Z'
    });

    await task;
    expect(page.broadcastResult()?.successCount).toBe(9);
    expect(page.broadcastResult()?.blockedCount).toBe(1);
    expect(page.notice()).toContain('შეტყობინება წარმატებით გაეგზავნა 9 მომხმარებელს');
    http.verify();
  });
});
