import { Component, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import type { paths } from '@dating/api-contract';
type Ready = paths['/api/health/ready']['get']['responses'][200]['content']['application/json'];
@Component({
  selector: 'app-foundation', imports: [MatButtonModule, MatCardModule],
  template: `<main><h1>DatingMVP ? Moderator</h1><mat-card><mat-card-content>
  <h2>Project foundation</h2><p>Moderator sign-in and actions are planned for stage 9. No administrator session is active.</p>
  <p role="status">{{ status() }}</p>
  <button matButton="filled" [disabled]="loading()" (click)="check()">Check API connection</button>
  </mat-card-content></mat-card></main>`,
})
export class FoundationPage {
  private readonly http = inject(HttpClient);
  readonly status = signal('Connection not checked.');
  readonly loading = signal(false);
  check() {
    this.loading.set(true); this.status.set('Checking?');
    this.http.get<Ready>('/api/health/ready', { timeout: 5000 }).subscribe({
      next: response => { this.status.set(response.status === 'ready' ? 'API and database are ready.' : 'Unexpected API response.'); this.loading.set(false); },
      error: (_error: HttpErrorResponse) => { this.status.set('API unavailable. Check the server and retry.'); this.loading.set(false); },
    });
  }
}
