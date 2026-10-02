import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { ModerationApi, adminError, Photo, Report, Audit, UserReview } from './moderation-api';
@Component({
 selector: 'app-moderation', imports: [ReactiveFormsModule, DatePipe, JsonPipe, MatButtonModule, MatFormFieldModule, MatInputModule, MatCardModule],
 templateUrl: './moderation.html', styles: [`nav, .actions { display:flex; flex-wrap:wrap; gap:12px; margin:20px 0 } mat-form-field { width:100% } mat-card { padding:20px; margin:16px 0 } img { max-width:100%; max-height:360px; object-fit:contain } pre { white-space:pre-wrap; overflow-wrap:anywhere } .error { color:#a01830 } .muted { overflow-wrap:anywhere }`]
})
export class ModerationPage implements OnInit {
 readonly api = inject(ModerationApi);
 readonly busy = signal(false); readonly error = signal(''); readonly notice = signal('');
 readonly tab = signal<'photos' | 'reports' | 'users' | 'audit'>('photos');
 readonly photos = signal<Photo[]>([]); readonly reports = signal<Report[]>([]); readonly audit = signal<Audit[]>([]);
 readonly selected = signal<Report | null>(null); readonly evidence = signal<unknown>(null); readonly user = signal<UserReview | null>(null);
 readonly closed = signal(false); readonly more = signal(false);
 readonly loginForm = new FormGroup({ email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }), password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(128)] }), code: new FormControl('', { nonNullable: true, validators: [Validators.pattern(/^\d{6}$/), Validators.required] }) });
 readonly reason = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3), Validators.maxLength(500)] });
 readonly userId = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/)] });
 async ngOnInit() { await this.run(async () => { await this.api.restore(); await this.load(); }); }
 async run(task: () => Promise<void>) {
  if (this.busy()) return; this.busy.set(true); this.error.set(''); this.notice.set('');
  try { await task(); } catch (e) { this.error.set(adminError(e)); if (!this.api.identity()) this.clear(); } finally { this.busy.set(false); }
 }
 private clear() { this.photos.set([]); this.reports.set([]); this.audit.set([]); this.selected.set(null); this.evidence.set(null); this.user.set(null); this.reason.reset(); }
 async login() { if (this.loginForm.invalid) return; await this.run(async () => { const value = this.loginForm.getRawValue(); this.loginForm.controls.password.reset(); this.loginForm.controls.code.reset(); await this.api.login(value); await this.load(); }); }
 async logout() { await this.run(async () => { await this.api.logout(); this.clear(); }); }
 async change(tab: 'photos' | 'reports' | 'users' | 'audit') { await this.run(async () => { this.tab.set(tab); this.clear(); await this.load(); }); }
 async refresh(next = false) { await this.run(() => this.load(next)); }
 private async load(next = false) {
  this.selected.set(null); this.evidence.set(null); this.reason.reset(); this.more.set(false);
  if (this.tab() === 'photos') { const after = next ? this.photos().at(-1)?.id : undefined; const rows = await this.api.get<Photo[]>('/photos' + (after ? '?after=' + after : '')); this.photos.set(rows); this.more.set(rows.length === 50); }
  if (this.tab() === 'reports') { const after = next ? this.reports().at(-1)?.id : undefined; const rows = await this.api.get<Report[]>('/reports?closed=' + this.closed() + (after ? '&after=' + after : '')); this.reports.set(rows); this.more.set(rows.length === 50); }
  if (this.tab() === 'audit') { const before = next ? this.audit().at(-1)?.id : undefined; const rows = await this.api.get<Audit[]>('/audit' + (before ? '?before=' + before : '')); this.audit.set(rows); this.more.set(rows.length === 50); }
 }
 photo(id: string, state: 'approved' | 'rejected') { if (this.reason.invalid) return; return this.run(async () => { await this.api.post('/photos/' + id, { state, reason: this.reason.value }); await this.load(); this.notice.set('Photo decision saved.'); }); }
 inspect(report: Report) { return this.run(async () => { this.selected.set(null); this.evidence.set(null); const value = await this.api.get<unknown>('/reports/' + report.id + '/evidence'); this.evidence.set(value); this.selected.set(report); }); }
 close() { const report = this.selected(); if (!report || this.reason.invalid) return; return this.run(async () => { await this.api.post('/reports/' + report.id, { state: 'closed', reason: this.reason.value }); await this.load(); this.notice.set('Report closed.'); }); }
 lookup(id = this.userId.value) { if (!/^[0-9a-fA-F-]{36}$/.test(id)) return; return this.run(async () => { this.user.set(null); this.tab.set('users'); this.userId.setValue(id); this.user.set(await this.api.get<UserReview>('/users/' + id)); }); }
 account(active: boolean) { const user = this.user(); if (!user || this.reason.invalid) return; return this.run(async () => { await this.api.post('/users/' + user.id, { active, reason: this.reason.value }); this.user.set(await this.api.get<UserReview>('/users/' + user.id)); this.reason.reset(); this.notice.set(active ? 'Account reactivated. A new mobile login is required.' : 'Account suspended. Sessions and push registrations revoked.'); }); }
 toggleClosed() { this.closed.set(!this.closed()); return this.refresh(); }
}
