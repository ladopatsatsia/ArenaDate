import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { FoundationPage } from './foundation';
describe('FoundationPage', () => {
  it('reports real API failure and permits retry', () => {
    TestBed.configureTestingModule({ imports: [FoundationPage], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(FoundationPage);
    const api = TestBed.inject(HttpTestingController);
    fixture.componentInstance.check();
    api.expectOne('/api/health/ready').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(fixture.componentInstance.status()).toContain('unavailable');
    expect(fixture.componentInstance.loading()).toBe(false);
    fixture.componentInstance.check();
    api.expectOne('/api/health/ready').flush({ status: 'ready' });
    expect(fixture.componentInstance.status()).toBe('API and database are ready.');
    api.verify();
  });
});
