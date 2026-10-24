import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe, JsonPipe, DecimalPipe, SlicePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import {
  ModerationApi,
  adminError,
  Photo,
  Report,
  Audit,
  UserReview,
  GameQuestion,
  AdminProfileSummary,
  AdminProfileDetail,
  TelegramStats,
  TelegramBroadcastRequest,
  TelegramBroadcastResult,
  AdminTransactionDto,
  AdminTransactionsStats,
  AdminTransactionsResponse,
  TelegramNotificationConfigDto,
  UpdateTelegramNotificationConfigRequest,
  AdminTelegramTestNotificationRequest,
} from './moderation-api';

@Component({
  selector: 'app-moderation',
  imports: [ReactiveFormsModule, DatePipe, JsonPipe, DecimalPipe, SlicePipe, MatButtonModule, MatFormFieldModule, MatInputModule, MatCardModule],
  templateUrl: './moderation.html',
  styles: [`
    nav, .actions { display:flex; flex-wrap:wrap; gap:12px; margin:20px 0; }
    mat-form-field { width:100%; }
    mat-card { padding:20px; margin:16px 0; border-radius: 12px; }
    img { max-width:100%; max-height:360px; object-fit:contain; }
    pre { white-space:pre-wrap; overflow-wrap:anywhere; }
    .error { color:#a01830; }
    .muted { overflow-wrap:anywhere; color: #666; font-size: 13px; }

    .search-bar { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; }
    .search-bar mat-form-field { flex: 1; min-width: 240px; }
    .search-bar .search-actions { display: flex; gap: 8px; padding-top: 4px; }

    .profiles-list { display: flex; flex-direction: column; gap: 12px; }
    .profile-card { padding: 16px; cursor: pointer; transition: box-shadow 0.2s; border-radius: 10px; }
    .profile-card:hover { box-shadow: 0 4px 14px rgba(0,0,0,0.08); }
    .profile-card-header { display: flex; align-items: center; gap: 16px; }
    .avatar-thumb { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; background: #e0e0e0; flex-shrink: 0; }
    .avatar-placeholder { width: 56px; height: 56px; border-radius: 50%; background: #e2d9d2; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #5d4037; flex-shrink: 0; }
    .profile-summary-info { flex: 1; }
    .profile-title { margin: 0 0 4px; font-size: 17px; font-weight: 600; color: #222; }
    .profile-meta { margin: 0 0 4px; font-size: 14px; color: #555; }
    .badges-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }

    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; }
    .badge-active { background: #e6f4ea; color: #137333; }
    .badge-suspended { background: #fce8e6; color: #c5221f; }
    .badge-verified { background: #e8f0fe; color: #1a73e8; }
    .badge-unverified { background: #fef7e0; color: #b06000; }
    .badge-photo-approved { background: #e6f4ea; color: #137333; }
    .badge-photo-pending { background: #fef7e0; color: #b06000; }
    .badge-photo-rejected { background: #fce8e6; color: #c5221f; }

    .chips-row { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
    .chip { background: #f1f3f4; color: #3c4043; padding: 4px 10px; border-radius: 16px; font-size: 13px; font-weight: 500; }
    .card-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-left: auto; }

    .profile-detail-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
    .profile-detail-hero { display: flex; gap: 20px; align-items: center; margin-bottom: 20px; flex-wrap: wrap; }
    .hero-avatar { width: 96px; height: 96px; border-radius: 50%; object-fit: cover; background: #e0e0e0; flex-shrink: 0; }
    .hero-placeholder { width: 96px; height: 96px; border-radius: 50%; background: #e2d9d2; display: flex; align-items: center; justify-content: center; font-size: 40px; color: #5d4037; flex-shrink: 0; }

    .detail-section { margin-top: 20px; padding: 20px; }
    .detail-section h3 { margin-top: 0; margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 8px; font-size: 16px; color: #333; }
    .detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
    .detail-field { margin-bottom: 8px; }
    .detail-label { font-size: 12px; color: #777; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
    .detail-value { font-size: 15px; font-weight: 500; color: #222; word-break: break-word; }

    .photos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; margin-top: 12px; }
    .photo-card { border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; background: #fff; display: flex; flex-direction: column; }
    .photo-card img { width: 100%; height: 200px; object-fit: cover; background: #f5f5f5; }
    .photo-info { padding: 10px; display: flex; flex-direction: column; gap: 6px; font-size: 12px; }

    .badge-crystals { background: linear-gradient(135deg, #e0f2fe, #bae6fd); color: #0284c7; border: 1px solid #7dd3fc; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
    .create-user-card { background: #fdfdfd; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
    .create-user-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
    .form-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 16px; }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 1000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(2px); }
    .modal-card { width: 92%; max-width: 480px; background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .quick-amounts { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 16px; }
    .quick-btn { padding: 6px 12px; border-radius: 20px; border: 1px solid #0284c7; background: #f0f9ff; color: #0284c7; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
    .quick-btn:hover { background: #0284c7; color: #fff; }
    .quick-btn-neg { border-color: #ef4444; background: #fef2f2; color: #ef4444; }
    .quick-btn-neg:hover { background: #ef4444; color: #fff; }
    .mode-toggle { display: flex; gap: 12px; margin-bottom: 16px; }
    .mode-btn { flex: 1; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; background: #f9fafb; font-weight: 500; cursor: pointer; }
    .mode-btn.active { border-color: #0284c7; background: #e0f2fe; color: #0284c7; font-weight: 600; }
    .field-group { display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px; }
    .field-label { font-size: 13px; font-weight: 500; color: #374151; }
    .custom-input { width: 100%; height: 46px; border: 1px solid #d1d5db; border-radius: 6px; padding: 0 12px; font-size: 15px; background: #fff; box-sizing: border-box; }
    .broadcast-container { margin: 16px 0; }
    .stat-boxes { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .stat-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; text-align: center; }
    .stat-box-active { background: #f0fdf4; border-color: #86efac; }
    .stat-box-gold { background: #fefce8; border-color: #fef08a; }
    .stat-box-emerald { background: #ecfdf5; border-color: #a7f3d0; }
    .stat-box-violet { background: #f5f3ff; border-color: #ddd6fe; }
    .stat-box-sky { background: #f0f9ff; border-color: #bae6fd; }
    .stat-num { font-size: 26px; font-weight: 700; color: #0f172a; }
    .stat-label { font-size: 13px; color: #64748b; margin-top: 4px; font-weight: 500; }
    .template-section { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
    .template-label { font-size: 13px; font-weight: 600; color: #475569; }
    .broadcast-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
    .custom-textarea { width: 100%; border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; font-size: 15px; font-family: inherit; line-height: 1.5; box-sizing: border-box; resize: vertical; }
    .char-counter { font-size: 12px; color: #94a3b8; text-align: right; margin-top: 4px; }
    .form-row { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 12px; }

    .filter-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
    .filter-chip { padding: 6px 14px; border-radius: 20px; border: 1px solid #cbd5e1; background: #fff; color: #334155; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; }
    .filter-chip:hover { border-color: #94a3b8; background: #f8fafc; }
    .filter-chip.active { border-color: #6366f1; background: #e0e7ff; color: #4338ca; font-weight: 600; }

    .tx-table-container { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
    .tx-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; }
    .tx-table th { background: #f8fafc; padding: 12px 16px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
    .tx-table td { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .tx-table tr:hover { background: #f8fafc; }
    .tx-user-cell { display: flex; align-items: center; gap: 12px; }
    .tx-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; background: #e2e8f0; flex-shrink: 0; }
    .tx-avatar-placeholder { width: 44px; height: 44px; border-radius: 50%; background: #e2d9d2; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #5d4037; flex-shrink: 0; }
    .tx-user-name { font-weight: 600; color: #1e293b; margin: 0 0 2px; }
    .tx-user-email { font-size: 12px; color: #64748b; margin: 0; }
    .badge-sub { background: linear-gradient(135deg, #f5f3ff, #ede9fe); color: #6d28d9; border: 1px solid #c4b5fd; font-weight: 600; }
    .badge-pack { background: linear-gradient(135deg, #f0fdf4, #dcfce7); color: #15803d; border: 1px solid #86efac; font-weight: 600; }
    .badge-spend { background: linear-gradient(135deg, #fff7ed, #ffedd5); color: #c2410c; border: 1px solid #fed7aa; font-weight: 600; }
    .badge-completed { background: #ecfdf5; color: #047857; font-weight: 600; }
    .badge-refunded { background: #fef2f2; color: #b91c1c; font-weight: 600; }
    .tx-price-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 8px; font-weight: 700; font-size: 13px; }
    .tx-price-gel { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
    .tx-price-stars { background: #fefce8; color: #a16207; border: 1px solid #fef08a; }
    .tx-price-crystals { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
    .tx-price-debit { background: #fff1f2; color: #be123c; border: 1px solid #fecdd3; }
    .pagination-bar { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; flex-wrap: wrap; gap: 12px; }
    .config-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); }
    .config-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px; }
    .config-card-title { font-size: 16px; font-weight: 600; color: #1e293b; display: flex; align-items: center; gap: 8px; margin: 0; }
    .config-master-banner { background: #f0fdf4; border: 1px solid #86efac; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
    .config-master-banner.disabled { background: #fef2f2; border-color: #fca5a5; }
    .tag-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; align-items: center; }
    .tag-chip { background: #f1f5f9; color: #475569; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-family: monospace; border: 1px solid #cbd5e1; cursor: pointer; }
    .tag-chip:hover { background: #e2e8f0; color: #0f172a; }
    .toggle-switch-btn { padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; }
    .toggle-on { background: #16a34a; color: #fff; }
    .toggle-off { background: #94a3b8; color: #fff; }
    .subnav-tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
    .subnav-tab { padding: 8px 18px; border-radius: 8px; border: 1px solid transparent; background: transparent; font-size: 14px; font-weight: 600; color: #64748b; cursor: pointer; transition: all 0.15s; }
    .subnav-tab:hover { background: #f1f5f9; color: #1e293b; }
    .subnav-tab.active { background: #0284c7; color: #fff; }
  `]
})
export class ModerationPage implements OnInit {
  readonly api = inject(ModerationApi);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly tab = signal<'profiles' | 'transactions' | 'photos' | 'reports' | 'users' | 'audit' | 'questions' | 'broadcast'>('profiles');

  readonly transactions = signal<AdminTransactionDto[]>([]);
  readonly txStats = signal<AdminTransactionsStats | null>(null);
  readonly txCategory = signal<string>('all');
  readonly txSearch = new FormControl('', { nonNullable: true });
  readonly txPage = signal(1);
  readonly txPageSize = signal(25);
  readonly txTotalCount = signal(0);
  readonly txLoading = signal(false);

  readonly tgStats = signal<TelegramStats | null>(null);
  readonly broadcastBusy = signal(false);
  readonly broadcastResult = signal<TelegramBroadcastResult | null>(null);
  readonly telegramSubTab = signal<'config' | 'broadcast'>('config');
  readonly tgConfig = signal<TelegramNotificationConfigDto | null>(null);
  readonly tgConfigBusy = signal(false);
  readonly tgTestBusy = signal<string | null>(null);

  readonly tgConfigForm = new FormGroup({
    masterEnabled: new FormControl(true, { nonNullable: true }),
    chatMessageEnabled: new FormControl(true, { nonNullable: true }),
    chatMessageTemplate: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(2000)] }),
    chatMessageButtonText: new FormControl('💬 ჩატში გადასვლა', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    matchRequestEnabled: new FormControl(true, { nonNullable: true }),
    matchRequestTemplate: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(2000)] }),
    matchRequestButtonText: new FormControl('👀 მოწონების ნახვა', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    matchEnabled: new FormControl(true, { nonNullable: true }),
    matchTemplate: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(2000)] }),
    matchButtonText: new FormControl('💬 ჩატის გახსნა', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    superLikeEnabled: new FormControl(true, { nonNullable: true }),
    superLikeTemplate: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(2000)] }),
    superLikeButtonText: new FormControl('👀 ნახვა', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    welcomeTemplate: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(2000)] }),
    welcomeButtonText: new FormControl('🚀 ARENA-ს გახსნა', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] })
  });

  readonly broadcastForm = new FormGroup({
    message: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(4000)] }),
    buttonText: new FormControl('🚀 ARENA-ს გახსნა', { nonNullable: true }),
    webAppPath: new FormControl('', { nonNullable: true })
  });

  readonly profiles = signal<AdminProfileSummary[]>([]);
  readonly selectedProfile = signal<AdminProfileDetail | null>(null);
  readonly profileSearch = new FormControl('', { nonNullable: true });
  readonly profilePage = signal(1);

  readonly showCreateUser = signal(false);
  readonly createUserForm = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    displayName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2), Validators.maxLength(50)] }),
    dateOfBirth: new FormControl('2000-01-01', { nonNullable: true, validators: [Validators.required] }),
    gender: new FormControl('woman', { nonNullable: true, validators: [Validators.required] }),
    city: new FormControl('Tbilisi', { nonNullable: true, validators: [Validators.required] }),
    initialCrystals: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] })
  });

  readonly selectedCrystalUser = signal<AdminProfileSummary | AdminProfileDetail | null>(null);
  readonly crystalMode = signal<'delta' | 'set'>('delta');
  readonly crystalForm = new FormGroup({
    amount: new FormControl(50, { nonNullable: true, validators: [Validators.required] }),
    reason: new FormControl('', { nonNullable: true })
  });

  readonly photos = signal<Photo[]>([]);
  readonly reports = signal<Report[]>([]);
  readonly audit = signal<Audit[]>([]);
  readonly questions = signal<GameQuestion[]>([]);

  readonly selected = signal<Report | null>(null);
  readonly evidence = signal<unknown>(null);
  readonly user = signal<UserReview | null>(null);
  readonly closed = signal(false);
  readonly more = signal(false);

  readonly loginForm = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(128)] })
  });
  readonly reason = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3), Validators.maxLength(500)] });
  readonly userId = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/)] });

  readonly questionForm = new FormGroup({
    text: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(300)] }),
    category: new FormControl('dating', { nonNullable: true, validators: [Validators.required] }),
    opt1: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    opt2: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    opt3: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    opt4: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  });

  async ngOnInit() {
    await this.run(async () => {
      await this.api.restore();
      await this.load();
    });
  }

  async run(task: () => Promise<void>) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      await task();
    } catch (e) {
      this.error.set(adminError(e));
      if (!this.api.identity()) this.clear();
    } finally {
      this.busy.set(false);
    }
  }

  private clear() {
    this.profiles.set([]);
    this.selectedProfile.set(null);
    this.selectedCrystalUser.set(null);
    this.showCreateUser.set(false);
    this.photos.set([]);
    this.reports.set([]);
    this.audit.set([]);
    this.questions.set([]);
    this.selected.set(null);
    this.evidence.set(null);
    this.user.set(null);
    this.reason.reset();
    this.transactions.set([]);
  }

  async login() {
    if (this.loginForm.invalid) return;
    await this.run(async () => {
      const value = this.loginForm.getRawValue();
      this.loginForm.controls.password.reset();
      await this.api.login(value);
      await this.load();
    });
  }

  async logout() {
    await this.run(async () => {
      await this.api.logout();
      this.clear();
    });
  }

  async change(tab: 'profiles' | 'transactions' | 'photos' | 'reports' | 'users' | 'audit' | 'questions' | 'broadcast') {
    await this.run(async () => {
      this.tab.set(tab);
      this.clear();
      this.profilePage.set(1);
      if (tab === 'transactions') {
        this.txPage.set(1);
        await this.loadTransactions(1);
      } else {
        await this.load();
      }
    });
  }

  async refresh(next = false) {
    await this.run(() => this.load(next));
  }

  private async load(next = false) {
    this.selected.set(null);
    this.evidence.set(null);
    this.reason.reset();
    this.more.set(false);

    if (this.tab() === 'profiles') {
      if (next) {
        this.profilePage.update(p => p + 1);
      } else {
        this.profilePage.set(1);
      }
      const query = this.profileSearch.value.trim() || undefined;
      const rows = await this.api.listProfiles(query, this.profilePage(), 50);
      this.profiles.set(rows);
      this.more.set(rows.length === 50);
    }
    if (this.tab() === 'photos') {
      const after = next ? this.photos().at(-1)?.id : undefined;
      const rows = await this.api.get<Photo[]>('/photos' + (after ? '?after=' + after : ''));
      this.photos.set(rows);
      this.more.set(rows.length === 50);
    }
    if (this.tab() === 'reports') {
      const after = next ? this.reports().at(-1)?.id : undefined;
      const rows = await this.api.get<Report[]>('/reports?closed=' + this.closed() + (after ? '&after=' + after : ''));
      this.reports.set(rows);
      this.more.set(rows.length === 50);
    }
    if (this.tab() === 'audit') {
      const before = next ? this.audit().at(-1)?.id : undefined;
      const rows = await this.api.get<Audit[]>('/audit' + (before ? '?before=' + before : ''));
      this.audit.set(rows);
      this.more.set(rows.length === 50);
    }
    if (this.tab() === 'questions') {
      const rows = await this.api.get<GameQuestion[]>('/game-questions');
      this.questions.set(rows);
    }
    if (this.tab() === 'broadcast') {
      await Promise.all([this.loadTelegramStats(), this.loadTelegramConfig()]);
    }
    if (this.tab() === 'transactions') {
      await this.loadTransactions();
    }
  }

  async loadTransactions(page = this.txPage()) {
    this.txLoading.set(true);
    try {
      const res = await this.api.listTransactions(
        this.txCategory(),
        this.txSearch.value.trim() || undefined,
        page,
        this.txPageSize()
      );
      this.transactions.set(res.items);
      this.txStats.set(res.stats);
      this.txTotalCount.set(res.totalCount);
      this.txPage.set(res.page);
    } finally {
      this.txLoading.set(false);
    }
  }

  async setTxCategory(cat: string) {
    if (this.txCategory() === cat) return;
    this.txCategory.set(cat);
    this.txPage.set(1);
    await this.run(async () => {
      await this.loadTransactions(1);
    });
  }

  async onTxSearch() {
    this.txPage.set(1);
    await this.run(async () => {
      await this.loadTransactions(1);
    });
  }

  async onTxClearSearch() {
    this.txSearch.setValue('');
    this.txPage.set(1);
    await this.run(async () => {
      await this.loadTransactions(1);
    });
  }

  async txNextPage() {
    if (this.txPage() * this.txPageSize() >= this.txTotalCount()) return;
    const next = this.txPage() + 1;
    await this.run(async () => {
      await this.loadTransactions(next);
    });
  }

  async txPrevPage() {
    if (this.txPage() <= 1) return;
    const prev = this.txPage() - 1;
    await this.run(async () => {
      await this.loadTransactions(prev);
    });
  }


  async searchProfiles() {
    await this.run(async () => {
      this.selectedProfile.set(null);
      this.profilePage.set(1);
      await this.load();
    });
  }

  async clearProfileSearch() {
    this.profileSearch.setValue('');
    await this.searchProfiles();
  }

  async inspectProfile(userId: string) {
    await this.run(async () => {
      const detail = await this.api.getProfile(userId);
      this.selectedProfile.set(detail);
    });
  }

  closeProfileDetail() {
    this.selectedProfile.set(null);
  }

  async toggleProfileAccount(userId: string, active: boolean, event?: Event) {
    if (event) event.stopPropagation();
    const actionLabel = active ? 'განბლოკვა' : 'დაბლოკვა';
    if (!window.confirm(`ნამდვილად გსურთ მომხმარებლის ${actionLabel}?`)) return;
    const r = this.reason.value.trim() || (active ? 'Admin reactivated account' : 'Admin suspended account');
    await this.run(async () => {
      await this.api.post('/users/' + userId, { active, reason: r });
      this.reason.reset();
      this.notice.set(active ? 'მომხმარებელი წარმატებით განიბლოკა.' : 'მომხმარებელი წარმატებით დაიბლოკა.');
      if (this.selectedProfile()?.userId === userId) {
        const updated = await this.api.getProfile(userId);
        this.selectedProfile.set(updated);
      }
      // Also update in profiles list
      this.profiles.update(list => list.map(p => p.userId === userId ? { ...p, active } : p));
    });
  }

  async deleteProfile(userId: string, event?: Event) {
    if (event) event.stopPropagation();
    if (!window.confirm('ყურადღება! ნამდვილად გსურთ ამ მომხმარებლის სრული წაშლა? ანგარიში, მატჩები და ფოტოები გაუქმდება.')) return;
    const r = this.reason.value.trim() || 'Admin deleted account';
    await this.run(async () => {
      await this.api.deleteUser(userId, r);
      this.reason.reset();
      this.notice.set('მომხმარებელი წარმატებით წაიშალა.');
      if (this.selectedProfile()?.userId === userId) {
        this.selectedProfile.set(null);
      }
      this.profiles.update(list => list.filter(p => p.userId !== userId));
    });
  }

  toggleCreateUser(force?: boolean) {
    this.showCreateUser.set(force !== undefined ? force : !this.showCreateUser());
  }

  async submitCreateUser() {
    if (this.createUserForm.invalid) return;
    await this.run(async () => {
      const v = this.createUserForm.getRawValue();
      const created = await this.api.createUser({
        email: v.email.trim(),
        password: v.password,
        displayName: v.displayName.trim(),
        dateOfBirth: v.dateOfBirth,
        gender: v.gender,
        city: v.city.trim() || 'Tbilisi',
        initialCrystals: v.initialCrystals
      });
      this.createUserForm.reset({
        email: '',
        password: '',
        displayName: '',
        dateOfBirth: '2000-01-01',
        gender: 'woman',
        city: 'Tbilisi',
        initialCrystals: 0
      });
      this.showCreateUser.set(false);
      this.notice.set(`მომხმარებელი ${created.displayName} (${created.email}) წარმატებით დარეგისტრირდა!`);
      this.profiles.update(list => [created, ...list]);
    });
  }

  openCrystalModal(user: AdminProfileSummary | AdminProfileDetail, event?: Event) {
    if (event) event.stopPropagation();
    this.selectedCrystalUser.set(user);
    this.crystalMode.set('delta');
    this.crystalForm.setValue({
      amount: 50,
      reason: ''
    });
  }

  closeCrystalModal() {
    this.selectedCrystalUser.set(null);
  }

  setCrystalMode(mode: 'delta' | 'set') {
    this.crystalMode.set(mode);
    if (mode === 'set') {
      const current = this.selectedCrystalUser()?.crystals ?? 0;
      this.crystalForm.controls.amount.setValue(current);
    } else {
      this.crystalForm.controls.amount.setValue(50);
    }
  }

  applyQuickDelta(delta: number) {
    this.crystalMode.set('delta');
    this.crystalForm.controls.amount.setValue(delta);
  }

  async submitCrystalAdjustment() {
    const user = this.selectedCrystalUser();
    if (!user || this.crystalForm.invalid) return;
    const v = this.crystalForm.getRawValue();
    const mode = this.crystalMode();
    await this.run(async () => {
      const result = await this.api.adjustCrystals(user.userId, {
        amount: v.amount,
        mode,
        reason: v.reason.trim() || undefined
      });
      this.selectedCrystalUser.set(null);
      this.notice.set(`კრისტალების ბალანსი განახლდა: ${result.oldBalance} ➔ ${result.newBalance} (ცვლილება: ${result.delta >= 0 ? '+' : ''}${result.delta})`);
      
      this.profiles.update(list => list.map(p => p.userId === user.userId ? { ...p, crystals: result.newBalance } : p));
      
      if (this.selectedProfile()?.userId === user.userId) {
        this.selectedProfile.update(p => p ? { ...p, crystals: result.newBalance } : null);
      }
    });
  }

  photo(id: string, state: 'approved' | 'rejected') {
    if (this.reason.invalid) return;
    return this.run(async () => {
      await this.api.post('/photos/' + id, { state, reason: this.reason.value });
      await this.load();
      if (this.selectedProfile()) {
        const updated = await this.api.getProfile(this.selectedProfile()!.userId);
        this.selectedProfile.set(updated);
      }
      this.notice.set('Photo decision saved.');
    });
  }

  inspect(report: Report) {
    return this.run(async () => {
      this.selected.set(null);
      this.evidence.set(null);
      const value = await this.api.get<unknown>('/reports/' + report.id + '/evidence');
      this.evidence.set(value);
      this.selected.set(report);
    });
  }

  close() {
    const report = this.selected();
    if (!report || this.reason.invalid) return;
    return this.run(async () => {
      await this.api.post('/reports/' + report.id, { state: 'closed', reason: this.reason.value });
      await this.load();
      this.notice.set('Report closed.');
    });
  }

  lookup(id = this.userId.value) {
    if (!/^[0-9a-fA-F-]{36}$/.test(id)) return;
    return this.run(async () => {
      this.user.set(null);
      this.tab.set('users');
      this.userId.setValue(id);
      this.user.set(await this.api.get<UserReview>('/users/' + id));
    });
  }

  account(active: boolean) {
    const user = this.user();
    if (!user || this.reason.invalid) return;
    return this.run(async () => {
      await this.api.post('/users/' + user.id, { active, reason: this.reason.value });
      this.user.set(await this.api.get<UserReview>('/users/' + user.id));
      this.reason.reset();
      this.notice.set(active ? 'Account reactivated. A new mobile login is required.' : 'Account suspended. Sessions and push registrations revoked.');
    });
  }

  toggleClosed() {
    this.closed.set(!this.closed());
    return this.refresh();
  }

  createQuestion() {
    if (this.questionForm.invalid) return;
    return this.run(async () => {
      const v = this.questionForm.getRawValue();
      await this.api.post('/game-questions', {
        questionText: v.text,
        category: v.category,
        options: [v.opt1, v.opt2, v.opt3, v.opt4]
      });
      this.questionForm.reset({ category: 'dating' });
      await this.load();
      this.notice.set('Question created.');
    });
  }

  deactivateQuestion(id: string) {
    return this.run(async () => {
      await this.api.delete('/game-questions/' + id);
      await this.load();
      this.notice.set('Question deactivated.');
    });
  }

  async loadTelegramStats() {
    try {
      const stats = await this.api.getTelegramStats();
      this.tgStats.set(stats);
    } catch (e) {
      this.error.set(adminError(e));
    }
  }

  applyBroadcastTemplate(templateKey: string) {
    if (templateKey === 'welcome') {
      this.broadcastForm.patchValue({
        message: '🔥 მოგესალმებით ARENA-ში!\n\nახალი ფუნქციები უკვე ხელმისაწვდომია: სცადეთ ბოთლის თამაში, დაატრიალეთ და იპოვეთ თქვენი სიმპათია ✨',
        buttonText: '🚀 ARENA-ს გახსნა',
        webAppPath: '/arena'
      });
    } else if (templateKey === 'tournament') {
      this.broadcastForm.patchValue({
        message: '🏆 დღეს საღამოს 21:00 საათზე ARENA-ში იწყება დიდი ტურნირი!\n\nშემოგვიერთდით მაგიდასთან, გააგზავნეთ საჩუქრები და მოიგეთ პრიზები 🍾✨',
        buttonText: '🍾 მაგიდასთან გადასვლა',
        webAppPath: '/arena'
      });
    } else if (templateKey === 'bonus') {
      this.broadcastForm.patchValue({
        message: '💎 საჩუქარი ყველას: დღეს აპლიკაციაში შესვლისთვის გელოდებათ ბონუს კრისტალები!\n\nგახსენით ARENA ახლავე და შეამოწმეთ საფულე 🎁',
        buttonText: '💎 ბონუსის მიღება',
        webAppPath: '/arena'
      });
    } else if (templateKey === 'dating') {
      this.broadcastForm.patchValue({
        message: '💫 ახალი ხალხი გელოდებათ ARENA-ში!\n\nშედით Discovery-ში, დაათვალიერეთ პროფილები და იპოვეთ თქვენი იდეალური მეწყვილე 🔥',
        buttonText: '👀 პროფილების დათვალიერება',
        webAppPath: '/discover'
      });
    }
  }

  async sendBroadcast() {
    if (this.broadcastForm.invalid) return;
    const msg = this.broadcastForm.controls.message.value.trim();
    if (!msg) return;

    const stats = this.tgStats();
    const countText = stats ? `${stats.activeSubscribers} აქტიურ` : 'ყველა';
    if (!confirm(`ნამდვილად გსურთ შეტყობინების გაგზავნა ${countText} მომხმარებლისთვის?`)) {
      return;
    }

    this.broadcastBusy.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      const result = await this.api.broadcastTelegram({
        message: msg,
        buttonText: this.broadcastForm.controls.buttonText.value.trim() || undefined,
        webAppRelativePath: this.broadcastForm.controls.webAppPath.value.trim() || undefined
      });
      this.broadcastResult.set(result);
      this.notice.set(`✅ შეტყობინება წარმატებით გაეგზავნა ${result.successCount} მომხმარებელს (დაბლოკილი: ${result.blockedCount}, შეცდომა: ${result.failedCount}).`);
      this.broadcastForm.controls.message.reset();
      await this.loadTelegramStats();
    } catch (e) {
      this.error.set(adminError(e));
    } finally {
      this.broadcastBusy.set(false);
    }
  }

  setTelegramSubTab(tab: 'config' | 'broadcast') {
    this.telegramSubTab.set(tab);
  }

  async loadTelegramConfig() {
    this.tgConfigBusy.set(true);
    try {
      const cfg = await this.api.getTelegramConfig();
      this.tgConfig.set(cfg);
      this.tgConfigForm.patchValue({
        masterEnabled: cfg.masterEnabled,
        chatMessageEnabled: cfg.chatMessageEnabled,
        chatMessageTemplate: cfg.chatMessageTemplate,
        chatMessageButtonText: cfg.chatMessageButtonText,
        matchRequestEnabled: cfg.matchRequestEnabled,
        matchRequestTemplate: cfg.matchRequestTemplate,
        matchRequestButtonText: cfg.matchRequestButtonText,
        matchEnabled: cfg.matchEnabled,
        matchTemplate: cfg.matchTemplate,
        matchButtonText: cfg.matchButtonText,
        superLikeEnabled: cfg.superLikeEnabled,
        superLikeTemplate: cfg.superLikeTemplate,
        superLikeButtonText: cfg.superLikeButtonText,
        welcomeTemplate: cfg.welcomeTemplate,
        welcomeButtonText: cfg.welcomeButtonText
      });
    } catch (e) {
      this.error.set(adminError(e));
    } finally {
      this.tgConfigBusy.set(false);
    }
  }

  async saveTelegramConfig() {
    if (this.tgConfigForm.invalid) return;
    this.tgConfigBusy.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      const formVal = this.tgConfigForm.getRawValue();
      const updated = await this.api.updateTelegramConfig(formVal);
      this.tgConfig.set(updated);
      this.notice.set('✅ Telegram შეტყობინებების პარამეტრები წარმატებით შეინახა.');
    } catch (e) {
      this.error.set(adminError(e));
    } finally {
      this.tgConfigBusy.set(false);
    }
  }

  async resetTelegramConfigToDefaults() {
    if (!confirm('ნამდვილად გსურთ შეტყობინებების შაბლონების ნაგულისხმევ მნიშვნელობებზე დაბრუნება?')) {
      return;
    }
    this.tgConfigBusy.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      const reset = await this.api.resetTelegramConfig();
      this.tgConfig.set(reset);
      this.tgConfigForm.patchValue({
        masterEnabled: reset.masterEnabled,
        chatMessageEnabled: reset.chatMessageEnabled,
        chatMessageTemplate: reset.chatMessageTemplate,
        chatMessageButtonText: reset.chatMessageButtonText,
        matchRequestEnabled: reset.matchRequestEnabled,
        matchRequestTemplate: reset.matchRequestTemplate,
        matchRequestButtonText: reset.matchRequestButtonText,
        matchEnabled: reset.matchEnabled,
        matchTemplate: reset.matchTemplate,
        matchButtonText: reset.matchButtonText,
        superLikeEnabled: reset.superLikeEnabled,
        superLikeTemplate: reset.superLikeTemplate,
        superLikeButtonText: reset.superLikeButtonText,
        welcomeTemplate: reset.welcomeTemplate,
        welcomeButtonText: reset.welcomeButtonText
      });
      this.notice.set('🔄 შეტყობინებების შაბლონები დაბრუნდა ნაგულისხმევ მნიშვნელობებზე.');
    } catch (e) {
      this.error.set(adminError(e));
    } finally {
      this.tgConfigBusy.set(false);
    }
  }

  async testTelegramNotification(type: string) {
    this.tgTestBusy.set(type);
    this.error.set('');
    this.notice.set('');
    try {
      const res = await this.api.testTelegramConfig({ notificationType: type });
      if (res.success) {
        this.notice.set(`🧪 სატესტო შეტყობინება (${type}) წარმატებით გაიგზავნა Telegram-ში!`);
      } else {
        this.error.set('ტესტი ვერ გაიგზავნა: დარწმუნდით, რომ ბოტს ჰყავს აქტიური გამომწერი ან დაუკავშირეთ თქვენი პროფილი ბოტს.');
      }
    } catch (e) {
      this.error.set(adminError(e));
    } finally {
      this.tgTestBusy.set(null);
    }
  }

  toggleConfigMaster() {
    const cur = this.tgConfigForm.controls.masterEnabled.value;
    this.tgConfigForm.controls.masterEnabled.setValue(!cur);
  }

  toggleConfigChannel(channel: 'chatMessage' | 'matchRequest' | 'match' | 'superLike') {
    if (channel === 'chatMessage') {
      const cur = this.tgConfigForm.controls.chatMessageEnabled.value;
      this.tgConfigForm.controls.chatMessageEnabled.setValue(!cur);
    } else if (channel === 'matchRequest') {
      const cur = this.tgConfigForm.controls.matchRequestEnabled.value;
      this.tgConfigForm.controls.matchRequestEnabled.setValue(!cur);
    } else if (channel === 'match') {
      const cur = this.tgConfigForm.controls.matchEnabled.value;
      this.tgConfigForm.controls.matchEnabled.setValue(!cur);
    } else if (channel === 'superLike') {
      const cur = this.tgConfigForm.controls.superLikeEnabled.value;
      this.tgConfigForm.controls.superLikeEnabled.setValue(!cur);
    }
  }

  insertTag(controlName: 'chatMessageTemplate' | 'matchRequestTemplate' | 'matchTemplate' | 'superLikeTemplate' | 'welcomeTemplate', tag: string) {
    const control = this.tgConfigForm.get(controlName);
    if (!control) return;
    const curVal = control.value || '';
    control.setValue(curVal + ' ' + tag);
  }
}
