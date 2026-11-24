import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal, untracked, viewChildren } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePicker, DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { FileUploadModule, type FileUploadHandlerEvent } from 'primeng/fileupload';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelect, MultiSelectModule } from 'primeng/multiselect';
import { Select, SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { firstValueFrom, startWith } from 'rxjs';
import type { Drama, DramaStatus } from '../../core/models/drama';
import type { DramaGenre } from '../../core/models/genre';
import type { DramaPlatform } from '../../core/models/platform';
import { AuthService } from '../../core/services/auth.service';
import { CatalogService } from '../../core/services/catalog.service';
import {
  CMS_DEPARTMENTS,
  CMS_PERMISSION_META,
  CmsCommentItem,
  CmsDmcaTicket,
  CmsDramaRequest,
  CmsEpisodeItem,
  CmsPermission,
  CmsRole,
  CmsScheduleSlot,
  CmsService,
  CmsUserAccount,
  CmsUserStatus,
  ROLE_META,
  SCENE_PRESETS,
  SCHEDULE_DAYS,
} from '../../core/services/cms.service';
import type { VideoLang } from '../../core/services/preferences.service';
import {
  isPlaceholderImage,
  monogram,
  parseIsoDate,
  toIsoDate,
  videoLangLabel,
} from '../../core/utils/format';

export type AdminTab =
  | 'dashboard'
  | 'analytics'
  | 'dramas'
  | 'drama-editor'
  | 'episodes'
  | 'schedule'
  | 'taxonomy'
  | 'moderation'
  | 'users'
  | 'settings';

const VALID_TABS: ReadonlySet<string> = new Set<AdminTab>([
  'dashboard',
  'analytics',
  'dramas',
  'drama-editor',
  'episodes',
  'schedule',
  'taxonomy',
  'moderation',
  'users',
  'settings',
]);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAMPLE_POSTER_URL = 'https://acf.goodshort.com/videobook/202407/cover-CqfQ2Nt2cG.jpg';
const SAMPLE_BACKDROP_URL = 'https://img.youtube.com/vi/uIKWJWW2XoU/maxresdefault.jpg';

@Component({
  selector: 'app-admin-cms',
  imports: [
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    CheckboxModule,
    DatePickerModule,
    DialogModule,
    FileUploadModule,
    InputNumberModule,
    InputTextModule,
    MultiSelectModule,
    SelectModule,
    SelectButtonModule,
    TableModule,
    TabsModule,
    TagModule,
    TextareaModule,
    ToggleSwitchModule,
  ],
  templateUrl: './admin-cms.component.html',
  host: {
    '(document:keydown.escape)': 'pendingDelete.set(null)',
    '(window:scroll)': 'closeOpenOverlays()',
  },
})
export class AdminCmsComponent {
  readonly tab = input<string>();
  readonly slug = input<string>();
  readonly routeMode = input<string>();

  private readonly selectCtrls = viewChildren(Select);
  private readonly multiSelectCtrls = viewChildren(MultiSelect);
  private readonly datePickerCtrls = viewChildren(DatePicker);

  protected closeOpenOverlays(): void {
    for (const s of this.selectCtrls()) {
      if (s.overlayVisible()) s.hide(false);
    }
    for (const ms of this.multiSelectCtrls()) {
      if (ms.overlayVisible()) ms.hide(false);
    }
    for (const dp of this.datePickerCtrls()) {
      if (dp.overlayVisible()) dp.hideOverlay();
    }
  }

  private readonly http = inject(HttpClient);
  protected readonly auth = inject(AuthService);
  protected readonly catalog = inject(CatalogService);
  protected readonly cms = inject(CmsService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  protected readonly monogram = monogram;
  protected readonly roleMeta = ROLE_META;
  protected readonly rolesList: readonly CmsRole[] = ['admin', 'editor', 'user'];
  protected readonly roleFilters: readonly ('' | CmsRole)[] = ['', 'admin', 'editor', 'user'];
  protected readonly scheduleDays = SCHEDULE_DAYS;
  protected readonly permissionMeta: { key: CmsPermission; label: string; desc: string }[] = [...CMS_PERMISSION_META];
  protected readonly sceneEntries = Object.entries(SCENE_PRESETS).map(([id, val]) => ({ id, ...val }));

  // ── PrimeNG Dropdown & Switcher Options ─────────────────────────────────
  protected readonly imageModeOptions = [
    { label: 'URL Website Lain', value: 'url', icon: 'pi pi-link' },
    { label: 'Upload File', value: 'upload', icon: 'pi pi-upload' },
  ];
  protected readonly previewTabOptions = [
    { label: 'Kartu (2:3)', value: 'card', icon: 'pi pi-id-card' },
    { label: 'Carousel (16:9)', value: 'carousel', icon: 'pi pi-images' },
  ];
  protected readonly statusFilterOptions = [
    { label: 'Semua Status', value: '' },
    { label: 'Tamat', value: 'completed' },
    { label: 'Ongoing', value: 'ongoing' },
    { label: 'Akan Datang', value: 'upcoming' },
  ];
  protected readonly statusSelectOptions: { label: string; value: DramaStatus }[] = [
    { label: 'Tamat', value: 'completed' },
    { label: 'Ongoing', value: 'ongoing' },
    { label: 'Akan Datang', value: 'upcoming' },
  ];
  protected readonly heroFilterOptions = [
    { label: 'Semua Sorotan', value: '' },
    { label: 'Hanya Hero Spotlight', value: 'hero' },
    { label: 'Non-Hero', value: 'regular' },
  ];
  protected readonly catalogSortOptions = [
    { label: 'Terpopuler (Tren)', value: 'trending' },
    { label: 'Rilis Terbaru', value: 'newest' },
    { label: 'Rating Tertinggi', value: 'rating' },
    { label: 'Judul A–Z', value: 'az' },
  ];
  protected readonly ageRatingOptions = [
    { label: 'SU (Semua Umur)', value: 'SU' },
    { label: '13+', value: '13+' },
    { label: '17+', value: '17+' },
    { label: '21+', value: '21+' },
  ];
  protected readonly langFilterOptions = [
    { label: 'Semua Bahasa', value: '' },
    { label: 'Sub ID', value: 'ID' },
    { label: 'Sub EN', value: 'EN' },
  ];
  protected readonly videoLangOptions: { label: string; value: VideoLang }[] = [
    { label: 'Indonesia (ID)', value: 'id' },
    { label: 'English (EN)', value: 'en' },
  ];
  protected readonly subtitleLangOptions = [
    { label: 'Sub ID (Indonesia)', value: 'ID' },
    { label: 'Sub EN (English)', value: 'EN' },
    { label: 'Sub ZH (Mandarin)', value: 'ZH' },
    { label: 'Sub MS (Melayu)', value: 'MS' },
  ];
  protected readonly qualityOptions = [
    { label: 'Full HD 1080p', value: '1080p' as const },
    { label: 'HD 720p', value: '720p' as const },
  ];
  protected readonly epStatusFilterOptions = [
    { label: 'Semua Status', value: '' },
    { label: 'Tayang', value: 'Tayang' },
    { label: 'Draft', value: 'Draft' },
  ];
  protected readonly epStatusOptions: { label: string; value: CmsEpisodeItem['status'] }[] = [
    { label: 'Tayang', value: 'Tayang' },
    { label: 'Draft', value: 'Draft' },
  ];
  protected readonly scheduleDaySelectOptions = [
    { label: 'Tidak dijadwalkan', value: '' },
    ...SCHEDULE_DAYS.map((day) => ({ label: day, value: day })),
  ];
  protected readonly scheduleDayFilterOptions = [
    { label: 'Semua Hari', value: '' },
    ...SCHEDULE_DAYS.map((day) => ({ label: day, value: day })),
  ];
  protected readonly scheduleDayOptions = SCHEDULE_DAYS.map((day) => ({ label: day, value: day }));
  protected readonly slotStatusOptions: { label: string; value: NonNullable<CmsScheduleSlot['status']> }[] = [
    { label: 'Terjadwal', value: 'Terjadwal' },
    { label: 'Tayang', value: 'Tayang' },
    { label: 'Ditunda', value: 'Ditunda' },
  ];
  protected readonly priorityOptions: { label: string; value: 'Tinggi' | 'Normal' | 'Rendah' }[] = [
    { label: 'Tinggi', value: 'Tinggi' },
    { label: 'Normal', value: 'Normal' },
    { label: 'Rendah', value: 'Rendah' },
  ];
  protected readonly priorityFilterOptions = [
    { label: 'Semua Prioritas', value: '' },
    ...this.priorityOptions,
  ];
  protected readonly requestStatusOptions: { label: string; value: CmsDramaRequest['status'] }[] = [
    { label: 'Ditinjau', value: 'Ditinjau' },
    { label: 'Terjadwal', value: 'Terjadwal' },
    { label: 'Tersedia', value: 'Tersedia' },
    { label: 'Ditolak', value: 'Ditolak' },
  ];
  protected readonly requestStatusFilterOptions = [
    { label: 'Semua Status', value: '' },
    ...this.requestStatusOptions,
  ];
  protected readonly commentStatusOptions: { label: string; value: CmsCommentItem['status'] }[] = [
    { label: 'Tampil', value: 'Tampil' },
    { label: 'Ditinjau', value: 'Ditinjau' },
    { label: 'Disembunyikan', value: 'Disembunyikan' },
  ];
  protected readonly commentStatusFilterOptions = [
    { label: 'Semua Status', value: '' },
    ...this.commentStatusOptions,
  ];
  protected readonly commentReasonOptions: { label: string; value: CmsCommentItem['flagReason'] }[] = [
    { label: 'Normal', value: 'Normal' },
    { label: 'Spoiler', value: 'Spoiler' },
    { label: 'Spam/Promosi', value: 'Spam/Promosi' },
    { label: 'Kata Kasar', value: 'Kata Kasar' },
  ];
  protected readonly commentReasonFilterOptions = [
    { label: 'Semua Alasan', value: '' },
    ...this.commentReasonOptions,
  ];
  protected readonly ticketStatusOptions: { label: string; value: CmsDmcaTicket['status'] }[] = [
    { label: 'Terbuka', value: 'Terbuka' },
    { label: 'Diproses', value: 'Diproses' },
    { label: 'Selesai', value: 'Selesai' },
    { label: 'Ditolak', value: 'Ditolak' },
  ];
  protected readonly ticketStatusFilterOptions = [
    { label: 'Semua Status', value: '' },
    ...this.ticketStatusOptions,
  ];
  protected readonly userRoleOptions: { label: string; value: CmsRole }[] = [
    { label: 'Admin', value: 'admin' },
    { label: 'Editor', value: 'editor' },
    { label: 'User', value: 'user' },
  ];
  protected readonly userRoleFilterOptions = [
    { label: 'Semua Role', value: '' },
    ...this.userRoleOptions,
  ];
  protected readonly userStatusOptions: { label: string; value: CmsUserStatus }[] = [
    { label: 'Aktif', value: 'Aktif' },
    { label: 'Menunggu Verifikasi', value: 'Menunggu Verifikasi' },
    { label: 'Ditangguhkan', value: 'Ditangguhkan' },
  ];
  protected readonly userStatusFilterOptions = [
    { label: 'Semua Status', value: '' },
    ...this.userStatusOptions,
  ];
  protected readonly departmentOptions = CMS_DEPARTMENTS.map((d) => ({ label: d, value: d }));
  protected readonly departmentFilterOptions = [
    { label: 'Semua Divisi', value: '' },
    ...this.departmentOptions,
  ];
  protected readonly sceneSelectOptions = Object.entries(SCENE_PRESETS).map(([id, val]) => ({
    label: val.label,
    value: id,
  }));
  protected readonly toneSelectOptions = Object.values(SCENE_PRESETS).map((val) => ({
    label: val.label,
    value: val.tone,
  }));

  protected readonly platformFilterOptions = computed(() => [
    { label: 'Semua Platform', value: '' },
    ...this.catalog.platforms.map((p) => ({ label: p.name, value: p.name })),
  ]);
  protected readonly genreFilterOptions = computed(() => [
    { label: 'Semua Genre', value: '' },
    ...this.catalog.genres.map((g) => ({ label: g.name, value: g.name })),
  ]);
  protected readonly platformSelectOptions = computed(() =>
    this.catalog.platforms.map((p) => ({ label: p.name, value: p.name })),
  );
  protected readonly genreSelectOptions = computed(() =>
    this.catalog.genres.map((g) => ({ label: g.name, value: g.name })),
  );
  protected readonly dramaSelectOptions = computed(() =>
    this.catalog.dramas.map((d) => ({
      label: `${d.title} (${d.latestEpisode ?? 0}/${d.totalEpisodes ?? 0})`,
      value: d.id,
    })),
  );

  protected readonly activeTab = computed<AdminTab>(() => {
    const mode = this.routeMode();
    if (mode === 'new' || mode === 'edit') return 'drama-editor';
    const raw = this.tab() ?? 'dashboard';
    return VALID_TABS.has(raw) ? (raw as AdminTab) : 'dashboard';
  });

  // ── Dramas Catalog Filters ──────────────────────────────────────────────
  protected readonly filterPlatform = signal('');
  protected readonly filterGenre = signal('');
  protected readonly filterStatus = signal('');
  protected readonly filterLang = signal('');
  protected readonly filterFeatured = signal<'' | 'hero' | 'regular'>('');
  protected readonly sortCatalogBy = signal<'trending' | 'newest' | 'rating' | 'az'>('trending');
  protected readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly pendingDelete = signal<Drama | null>(null);

  protected readonly filteredDramas = computed(() => {
    const q = this.cms.searchQuery().trim().toLowerCase();
    const plat = this.filterPlatform();
    const genre = this.filterGenre();
    const stat = this.filterStatus();
    const lang = this.filterLang();
    const feat = this.filterFeatured();
    const list = this.catalog.dramas.filter((d) => {
      if (plat && d.platformId !== plat) return false;
      if (genre && !d.genres.includes(genre)) return false;
      if (stat && d.status !== stat) return false;
      if (lang && this.primaryLangCode(d) !== lang) return false;
      if (feat === 'hero' && !d.featured) return false;
      if (feat === 'regular' && d.featured) return false;
      if (q) {
        const hay = [
          d.title,
          d.originalTitle ?? '',
          (d.alternateTitles ?? []).join(' '),
          d.slug,
          d.platformId,
          d.genres.join(' '),
          (d.tags ?? []).join(' '),
          (d.cast ?? []).join(' '),
          d.director ?? '',
          d.productionStudio ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const sortKey = this.sortCatalogBy();
    return [...list].sort((a, b) => {
      if (sortKey === 'newest') {
        return (b.releaseDate ?? `${b.releaseYear ?? 0}`).localeCompare(a.releaseDate ?? `${a.releaseYear ?? 0}`);
      }
      if (sortKey === 'rating') return (b.rating ?? 0) - (a.rating ?? 0);
      if (sortKey === 'az') return a.title.localeCompare(b.title);
      return (b.trendingScore ?? 0) - (a.trendingScore ?? 0);
    });
  });

  // ── Dashboard Metrics ──────────────────────────────────────────────────
  protected readonly totalDramas = computed(() => this.catalog.dramas.length);
  protected readonly heroCount = computed(() => this.catalog.dramas.filter((d) => d.featured).length);
  protected readonly ongoingCount = computed(
    () => this.catalog.dramas.filter((d) => d.status === 'ongoing').length,
  );
  protected readonly totalEpisodesSum = computed(() =>
    this.catalog.dramas.reduce((acc, d) => acc + (d.totalEpisodes ?? 0), 0),
  );
  protected readonly avgEpisodes = computed(() =>
    Math.round(this.totalEpisodesSum() / Math.max(1, this.totalDramas())),
  );
  protected readonly idVideoCount = computed(
    () => this.catalog.dramas.filter((d) => this.primaryLangCode(d) === 'ID').length,
  );
  protected readonly enVideoCount = computed(() => this.totalDramas() - this.idVideoCount());
  protected readonly top5Dramas = computed(() =>
    [...this.catalog.dramas].sort((a, b) => (b.trendingScore ?? 0) - (a.trendingScore ?? 0)).slice(0, 5),
  );

  protected readonly weeklyBars = [
    { d: 'Sen', v: 62, e: 18 },
    { d: 'Sel', v: 74, e: 24 },
    { d: 'Rab', v: 68, e: 16 },
    { d: 'Kam', v: 88, e: 29 },
    { d: 'Jum', v: 94, e: 32 },
    { d: 'Sab', v: 100, e: 26 },
    { d: 'Min', v: 91, e: 22 },
  ];

  protected readonly genreStats = computed(() => {
    const items = this.catalog.genres
      .map((g) => ({ name: g.name, count: this.catalog.countByGenre(g.name) }))
      .sort((a, b) => b.count - a.count);
    const max = Math.max(1, items[0]?.count ?? 1);
    return items.map((item) => ({ ...item, pct: Math.round((item.count / max) * 100) }));
  });

  protected readonly retentionFunnel = [
    { step: 'Mulai Ep 1', pct: 100 },
    { step: 'Lanjut Ep 25', pct: 78 },
    { step: 'Pertengahan Ep 50', pct: 61 },
    { step: 'Klimaks Ep 75', pct: 49 },
    { step: 'Tamat Episode Akhir', pct: 41 },
  ];

  // ── Full-Page Drama Editor State & Form ────────────────────────────────
  protected readonly editingDrama = computed(() => {
    const s = this.slug();
    if (!s || this.routeMode() !== 'edit') return undefined;
    return this.catalog.getBySlug(s);
  });

  protected readonly posterInputMode = signal<'url' | 'upload'>('url');
  protected readonly backdropInputMode = signal<'url' | 'upload'>('url');
  protected readonly posterUploadName = signal('');
  protected readonly backdropUploadName = signal('');
  protected readonly previewTab = signal<'card' | 'carousel'>('card');
  protected readonly slugManuallyEdited = signal(false);
  protected readonly brokenImgUrls = signal<ReadonlySet<string>>(new Set());

  private uniqueSlugValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const raw = String(control.value ?? '').trim();
      if (!raw) return { required: true };
      if (raw.length < 3) return { minlength: { requiredLength: 3, actualLength: raw.length } };
      if (!SLUG_PATTERN.test(raw)) return { invalidSlugFormat: true };
      const currentId = this.editingDrama()?.id;
      const conflict = this.catalog.dramas.find(
        (d) => d.slug.toLowerCase() === raw.toLowerCase() && d.id !== currentId,
      );
      if (conflict) return { duplicateSlug: conflict.title };
      return null;
    };
  }

  private imageUrlValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const val = String(control.value ?? '').trim();
      if (!val) return null;
      if (/^(https?:\/\/|\/|data:image\/|blob:)/i.test(val)) return null;
      return { invalidImageUrl: true };
    };
  }

  protected readonly editorForm = this.fb.group({
    title: ['', [Validators.required]],
    slug: ['', [this.uniqueSlugValidator()]],
    originalTitle: [''],
    alternateTitlesText: [''],
    synopsis: ['', [Validators.required]],
    posterUrl: ['', [this.imageUrlValidator()]],
    backdropUrl: ['', [this.imageUrlValidator()]],
    director: [''],
    country: ['China'],
    productionStudio: [''],
    ageRating: ['13+'],
    trailerUrl: ['', [this.imageUrlValidator()]],
    castText: [''],
    genres: [['Drama'] as string[], [Validators.required]],
    tagsText: [''],
    platformId: ['DramaBox', [Validators.required]],
    videoLanguages: [['id'] as VideoLang[], [Validators.required]],
    subtitleLanguages: [['ID'] as string[], [Validators.required]],
    status: ['completed' as DramaStatus, [Validators.required]],
    releaseDate: [new Date(2026, 0, 1) as Date | null],
    releaseYear: [2026],
    durationMinutes: [2],
    totalEpisodes: [80],
    latestEpisode: [80],
    rating: [8.8],
    trendingScore: [950],
    scene: ['ceo'],
    tone: ['oklch(68% .16 155)'],
    featured: [false],
    streamUrl: [''],
    scheduleDay: [''],
    scheduleTime: ['19.30'],
  });

  private readonly formValue = toSignal(
    this.editorForm.valueChanges.pipe(startWith(this.editorForm.getRawValue())),
    { initialValue: this.editorForm.getRawValue() },
  );

  protected readonly slugStatus = computed(() => {
    this.formValue();
    const ctrl = this.editorForm.controls.slug;
    const raw = String(ctrl.value ?? '').trim();
    if (!raw) return { ok: false, severity: 'muted' as const, message: 'Otomatis dibuat saat mengisi Judul Drama.' };
    if (ctrl.hasError('minlength')) {
      return { ok: false, severity: 'error' as const, message: 'Slug minimal 3 karakter (contoh: abc).' };
    }
    if (ctrl.hasError('invalidSlugFormat')) {
      return {
        ok: false,
        severity: 'error' as const,
        message: 'Hanya huruf kecil (a-z), angka (0-9), dan tanda "-" di tengah kata.',
      };
    }
    const conflictTitle = ctrl.getError('duplicateSlug') as string | undefined;
    if (conflictTitle) {
      return {
        ok: false,
        severity: 'error' as const,
        message: `Slug sudah dipakai oleh "${conflictTitle}". Harus unik!`,
      };
    }
    return { ok: true, severity: 'ok' as const, message: '✓ Slug valid & unik' };
  });

  protected readonly editorPreview = computed(() => {
    const v = this.formValue();
    const broken = this.brokenImgUrls();
    const title = v.title?.trim() || 'Judul Drama Baru';
    const slug = this.slugify(v.slug || title) || 'judul-drama-baru';
    const genres = v.genres?.length ? v.genres : ['Drama'];
    const tags = (v.tagsText ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const alternateTitles = (v.alternateTitlesText ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const totalEp = Math.max(1, Number(v.totalEpisodes) || 80);
    const latestEp = Math.min(totalEp, Math.max(1, Number(v.latestEpisode) || totalEp));
    const rating = Math.min(10, Math.max(1, Number(v.rating) || 8.8));
    const status = v.status ?? 'completed';
    const rawPoster = v.posterUrl?.trim() || '';
    const rawBackdrop = v.backdropUrl?.trim() || '';
    const posterValid = Boolean(rawPoster && !broken.has(rawPoster) && !this.editorForm.controls.posterUrl.invalid);
    const backdropValid = Boolean(
      rawBackdrop && !broken.has(rawBackdrop) && !this.editorForm.controls.backdropUrl.invalid,
    );
    const releaseYear = v.releaseDate instanceof Date ? v.releaseDate.getFullYear() : v.releaseYear || 2026;
    const subLang = v.subtitleLanguages?.[0] ?? (v.videoLanguages?.includes('en') ? 'EN' : 'ID');

    return {
      title,
      slug,
      monogram: monogram(title),
      originalTitle: v.originalTitle?.trim() || '',
      alternateTitles,
      productionStudio: v.productionStudio?.trim() || '',
      ageRating: v.ageRating || '13+',
      synopsis:
        v.synopsis?.trim() ||
        'Sinopsis lengkap alur cerita drama akan tampil di Website Utama (/) dan Katalog CMS.',
      posterUrl: posterValid ? rawPoster : '',
      backdropUrl: backdropValid ? rawBackdrop : '',
      posterBroken: Boolean(rawPoster && broken.has(rawPoster)),
      backdropBroken: Boolean(rawBackdrop && broken.has(rawBackdrop)),
      platformId: v.platformId || 'DramaBox',
      langBadge: `SUB ${subLang}`,
      statusLabel: status === 'completed' ? 'Tamat' : status === 'ongoing' ? 'Ongoing' : 'Segera',
      status,
      releaseYear,
      releaseDateIso: toIsoDate(v.releaseDate) || `${releaseYear}-01-01`,
      totalEpisodes: totalEp,
      latestEpisode: latestEp,
      rating: rating.toFixed(1),
      tone: v.tone || SCENE_PRESETS[v.scene ?? 'ceo']?.tone || 'oklch(68% .16 155)',
      featured: Boolean(v.featured),
      genres,
      tags,
      checks: [
        { label: 'Judul & Slug Unik', ok: Boolean(v.title?.trim()) && !this.editorForm.controls.slug.invalid },
        { label: 'Gambar Kartu / Poster (2:3)', ok: posterValid },
        { label: 'Gambar Carousel (16:9)', ok: backdropValid },
        { label: 'Minimal 1 Genre dipilih', ok: (v.genres?.length ?? 0) > 0 },
        { label: 'Sinopsis tersedia', ok: Boolean(v.synopsis?.trim()) },
        {
          label: 'Kredit Produksi & Pemeran',
          ok: Boolean(v.director?.trim() || v.castText?.trim() || v.productionStudio?.trim()),
        },
      ],
    };
  });

  // ── Episodes Tab State & Edit Dialog ────────────────────────────────────
  protected readonly selectedEpDramaId = signal('dituduh-membunuh-anakku-sendiri');
  protected readonly epSearch = signal('');
  protected readonly epFilterStatus = signal<'' | 'Tayang' | 'Draft'>('');
  protected readonly epNum = signal(1);
  protected readonly epTitle = signal('');
  protected readonly epAirDate = signal<Date | null>(new Date());
  protected readonly epUrl = signal('');
  protected readonly epSubtitleUrl = signal('');
  protected readonly epVideoLang = signal<VideoLang>('id');

  protected readonly epEditDialogOpen = signal(false);
  protected readonly editingEpOriginalNum = signal<number | null>(null);
  protected readonly editEpNum = signal(1);
  protected readonly editEpTitle = signal('');
  protected readonly editEpDuration = signal(1);
  protected readonly editEpAirDate = signal<Date | null>(new Date());
  protected readonly editEpStreamUrl = signal('');
  protected readonly editEpSubtitleUrl = signal('');
  protected readonly editEpVideoLang = signal<VideoLang>('id');
  protected readonly editEpStatus = signal<CmsEpisodeItem['status']>('Tayang');

  protected readonly selectedEpDrama = computed(
    () => this.catalog.dramas.find((d) => d.id === this.selectedEpDramaId()) ?? this.catalog.dramas[0],
  );

  protected readonly filteredEpisodes = computed(() => {
    const d = this.selectedEpDrama();
    if (!d) return [];
    const q = this.epSearch().trim().toLowerCase();
    const st = this.epFilterStatus();
    return this.cms
      .getEpisodesForDrama(d)
      .filter(
        (ep) =>
          (!st || ep.status === st) &&
          (!q || `ep ${ep.number} ${ep.title} ${ep.streamUrl} ${ep.subtitleUrl ?? ''}`.toLowerCase().includes(q)),
      );
  });

  // ── Schedule & Taxonomy State & Dialogs ─────────────────────────────────
  protected readonly schDramaId = signal('');
  protected readonly schDay = signal<string>('Senin');
  protected readonly schTime = signal('19.30');
  protected readonly schNote = signal('');
  protected readonly scheduleFilterDay = signal('');

  protected readonly slotDialogOpen = signal(false);
  protected readonly editingSlotId = signal<string | number | null>(null);
  protected readonly editSlotDramaId = signal('');
  protected readonly editSlotDay = signal('Senin');
  protected readonly editSlotTime = signal('19.30');
  protected readonly editSlotEp = signal(1);
  protected readonly editSlotStatus = signal<NonNullable<CmsScheduleSlot['status']>>('Terjadwal');
  protected readonly editSlotNote = signal('');

  protected readonly filteredScheduleSlots = computed(() => {
    const dayFilter = this.scheduleFilterDay();
    return this.cms.scheduleSlots().filter((s) => !dayFilter || s.day === dayFilter);
  });

  protected readonly newPlatName = signal('');
  protected readonly newPlatDesc = signal('');
  protected readonly newPlatTone = signal('oklch(68% .16 155)');
  protected readonly newGenreName = signal('');
  protected readonly newGenreDesc = signal('');
  protected readonly newGenreTone = signal('oklch(68% .16 155)');

  protected readonly taxDialogOpen = signal(false);
  protected readonly taxEditKind = signal<'platform' | 'genre' | null>(null);
  protected readonly taxEditId = signal('');
  protected readonly taxEditName = signal('');
  protected readonly taxEditDesc = signal('');
  protected readonly taxEditTone = signal('oklch(68% .16 155)');

  // ── Moderation Tabbed State & Dialogs (Requests, Comments, DMCA) ────────
  protected readonly moderationSubTab = signal<'requests' | 'comments' | 'dmca'>('requests');
  protected readonly reqSearch = signal('');
  protected readonly reqFilterStatus = signal<'' | CmsDramaRequest['status']>('');
  protected readonly reqFilterPriority = signal<'' | 'Tinggi' | 'Normal' | 'Rendah'>('');
  protected readonly reqFilterLang = signal<'' | 'ID' | 'EN'>('');

  protected readonly commentSearch = signal('');
  protected readonly commentFilterStatus = signal<'' | CmsCommentItem['status']>('');
  protected readonly commentFilterReason = signal<'' | CmsCommentItem['flagReason']>('');

  protected readonly ticketSearch = signal('');
  protected readonly ticketFilterStatus = signal<'' | CmsDmcaTicket['status']>('');
  protected readonly ticketFilterPriority = signal<'' | 'Tinggi' | 'Normal' | 'Rendah'>('');

  protected readonly reqDialogOpen = signal(false);
  protected readonly editingReqId = signal<string | number | null>(null);
  protected readonly reqFormTitle = signal('');
  protected readonly reqFormPlatform = signal('DramaBox');
  protected readonly reqFormLang = signal<'ID' | 'EN'>('ID');
  protected readonly reqFormPriority = signal<'Tinggi' | 'Normal' | 'Rendah'>('Normal');
  protected readonly reqFormStatus = signal<CmsDramaRequest['status']>('Ditinjau');
  protected readonly reqFormEpisodes = signal(60);
  protected readonly reqFormRequester = signal('');
  protected readonly reqFormNote = signal('');

  protected readonly commentDialogOpen = signal(false);
  protected readonly editingCommentId = signal<string | number | null>(null);
  protected readonly commentFormAuthor = signal('');
  protected readonly commentFormDrama = signal('');
  protected readonly commentFormBody = signal('');
  protected readonly commentFormStatus = signal<CmsCommentItem['status']>('Tampil');
  protected readonly commentFormReason = signal<CmsCommentItem['flagReason']>('Normal');
  protected readonly commentFormReply = signal('');

  protected readonly ticketDialogOpen = signal(false);
  protected readonly editingTicketId = signal<string | null>(null);
  protected readonly ticketFormTarget = signal('');
  protected readonly ticketFormSender = signal('');
  protected readonly ticketFormType = signal('');
  protected readonly ticketFormPriority = signal<'Tinggi' | 'Normal' | 'Rendah'>('Normal');
  protected readonly ticketFormStatus = signal<CmsDmcaTicket['status']>('Terbuka');
  protected readonly ticketFormEvidence = signal('');
  protected readonly ticketFormResolution = signal('');

  protected readonly filteredRequests = computed(() => {
    const q = this.reqSearch().trim().toLowerCase();
    const st = this.reqFilterStatus();
    const pr = this.reqFilterPriority();
    const ln = this.reqFilterLang();
    return this.cms.requests().filter(
      (r) =>
        (!st || r.status === st) &&
        (!pr || r.priority === pr) &&
        (!ln || r.lang === ln) &&
        (!q || `${r.title} ${r.platform} ${r.requester} ${r.note}`.toLowerCase().includes(q)),
    );
  });

  protected readonly filteredComments = computed(() => {
    const q = this.commentSearch().trim().toLowerCase();
    const st = this.commentFilterStatus();
    const rs = this.commentFilterReason();
    return this.cms.comments().filter(
      (c) =>
        (!st || c.status === st) &&
        (!rs || c.flagReason === rs) &&
        (!q || `${c.author} ${c.drama} ${c.body} ${c.flagReason}`.toLowerCase().includes(q)),
    );
  });

  protected readonly filteredTickets = computed(() => {
    const q = this.ticketSearch().trim().toLowerCase();
    const st = this.ticketFilterStatus();
    const pr = this.ticketFilterPriority();
    return this.cms.dmcaTickets().filter(
      (t) =>
        (!st || t.status === st) &&
        (!pr || t.priority === pr) &&
        (!q || `${t.id} ${t.target} ${t.sender} ${t.type} ${t.resolutionNote ?? ''}`.toLowerCase().includes(q)),
    );
  });

  protected readonly moderationCounts = computed(() => ({
    pendingRequests: this.cms.requests().filter((r) => r.status === 'Ditinjau' || r.status === 'Terjadwal').length,
    flaggedComments: this.cms.comments().filter((c) => c.status === 'Ditinjau').length,
    openTickets: this.cms.dmcaTickets().filter((t) => t.status === 'Terbuka' || t.status === 'Diproses').length,
    resolvedTotal:
      this.cms.requests().filter((r) => r.status === 'Tersedia').length +
      this.cms.dmcaTickets().filter((t) => t.status === 'Selesai').length,
  }));

  // ── Users & Role Management Tab State & Dialogs ─────────────────────────
  protected readonly usersSubTab = signal<'accounts' | 'roles'>('accounts');
  protected readonly userSearch = signal('');
  protected readonly userFilterRole = signal<'' | CmsRole>('');
  protected readonly userFilterStatus = signal<'' | CmsUserStatus>('');
  protected readonly userFilterDepartment = signal('');

  protected readonly userDialogOpen = signal(false);
  protected readonly editingUserId = signal<string | number | null>(null);
  protected readonly pendingDeleteUser = signal<CmsUserAccount | null>(null);
  protected readonly userFormName = signal('');
  protected readonly userFormUsername = signal('');
  protected readonly userFormEmail = signal('');
  protected readonly userFormRole = signal<CmsRole>('editor');
  protected readonly userFormDepartment = signal<string>(CMS_DEPARTMENTS[1]);
  protected readonly userFormPhone = signal('');
  protected readonly userFormStatus = signal<CmsUserStatus>('Aktif');
  protected readonly userFormTwoFactor = signal(false);
  protected readonly userFormNotes = signal('');

  protected readonly filteredUsers = computed(() => {
    const q = this.userSearch().trim().toLowerCase();
    const role = this.userFilterRole();
    const status = this.userFilterStatus();
    const dept = this.userFilterDepartment();
    return this.cms.users().filter(
      (u) =>
        (!role || u.role === role) &&
        (!status || u.status === status) &&
        (!dept || u.department === dept) &&
        (!q || `${u.name} ${u.username} ${u.email} ${u.department} ${u.role}`.toLowerCase().includes(q)),
    );
  });

  protected readonly userStats = computed(() => {
    const all = this.cms.users();
    return {
      total: all.length,
      active: all.filter((u) => u.status === 'Aktif').length,
      flagged: all.filter((u) => u.status !== 'Aktif').length,
      staff: all.filter((u) => u.role === 'admin' || u.role === 'editor').length,
      twoFactor: all.filter((u) => u.twoFactorEnabled).length,
    };
  });

  protected readonly sampleCatalogJson = computed(() =>
    JSON.stringify(this.catalog.dramas.slice(0, 2), null, 2),
  );

  constructor() {
    if (this.auth.apiReachable() && this.auth.isAuthenticated()) {
      void this.cms.loadAdminData();
    }

    effect(() => {
      const epDrama = this.selectedEpDrama();
      untracked(() => {
        if (epDrama && this.auth.apiReachable() && this.auth.isAuthenticated()) {
          void this.cms.loadEpisodesFromApi(epDrama.id);
        }
      });
    });

    effect(() => {
      const active = this.activeTab();
      const s = this.slug();
      const mode = this.routeMode();

      untracked(() => {
        if (active === 'drama-editor') {
          this.cms.editingSlug.set(mode === 'edit' && s ? s : null);
          this.populateEditorForm(mode === 'edit' ? s : undefined);
        } else {
          this.cms.editingSlug.set(null);
        }
      });
    });
  }

  private populateEditorForm(slug?: string): void {
    const existing = slug ? this.catalog.getBySlug(slug) : undefined;
    const pf = existing ? null : this.cms.editorPrefill();
    const defaultVideoLangs: VideoLang[] = existing?.videoLanguages?.length
      ? ([...existing.videoLanguages] as VideoLang[])
      : pf?.lang === 'EN'
        ? ['en']
        : ['id'];
    const defaultSubLangs: string[] = existing?.subtitleLanguages?.length
      ? [...existing.subtitleLanguages]
      : pf?.lang === 'EN'
        ? ['EN']
        : ['ID'];
    const existingEp = existing ? this.cms.getEpisodesForDrama(existing)[0] : undefined;
    const titleVal = existing?.title ?? pf?.title ?? '';
    const slugVal = existing?.slug ?? (pf?.title ? this.generateUniqueSlug(pf.title) : '');
    const releaseDateVal =
      parseIsoDate(existing?.releaseDate) ?? new Date(existing?.releaseYear ?? 2026, 0, 1);

    this.slugManuallyEdited.set(Boolean(existing));
    this.posterInputMode.set('url');
    this.backdropInputMode.set('url');
    this.posterUploadName.set('');
    this.backdropUploadName.set('');
    this.brokenImgUrls.set(new Set());

    this.editorForm.reset({
      title: titleVal,
      slug: slugVal,
      originalTitle: existing?.originalTitle ?? '',
      alternateTitlesText: existing?.alternateTitles?.join(', ') ?? '',
      synopsis: existing?.synopsis ?? '',
      posterUrl: existing?.posterUrl ?? '',
      backdropUrl: existing?.backdropUrl ?? '',
      director: existing?.director ?? '',
      country: existing?.country ?? 'China',
      productionStudio: existing?.productionStudio ?? '',
      ageRating: existing?.ageRating ?? '13+',
      trailerUrl: existing?.trailerUrl ?? '',
      castText: existing?.cast?.join(', ') ?? '',
      genres: existing?.genres?.length ? [...existing.genres] : ['Drama'],
      tagsText: existing?.tags?.join(', ') ?? '',
      platformId: existing?.platformId ?? pf?.platform ?? this.catalog.platforms[0]?.name ?? 'DramaBox',
      videoLanguages: defaultVideoLangs,
      subtitleLanguages: defaultSubLangs,
      status: existing?.status ?? 'completed',
      releaseDate: releaseDateVal,
      releaseYear: existing?.releaseYear ?? releaseDateVal.getFullYear(),
      durationMinutes: existing?.durationMinutes ?? 2,
      totalEpisodes: existing?.totalEpisodes ?? 80,
      latestEpisode: existing?.latestEpisode ?? 80,
      rating: existing?.rating ?? 8.8,
      trendingScore: existing?.trendingScore ?? 950,
      scene: 'ceo',
      tone: existing?.tone ?? SCENE_PRESETS['ceo'].tone,
      featured: Boolean(existing?.featured),
      streamUrl: existingEp?.streamUrl ?? '',
      scheduleDay: '',
      scheduleTime: '19.30',
    });
    this.editorForm.controls.slug.updateValueAndValidity({ emitEvent: false });
  }

  // ── Slug Rules & Image Helpers ──────────────────────────────────────────
  protected slugify(str: string): string {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 72);
  }

  private generateUniqueSlug(rawTitle: string): string {
    const base = this.slugify(rawTitle) || 'drama-baru';
    const currentId = this.editingDrama()?.id;
    let candidate = base;
    let suffix = 2;
    while (
      this.catalog.dramas.some(
        (d) => d.slug.toLowerCase() === candidate.toLowerCase() && d.id !== currentId,
      )
    ) {
      candidate = `${base}-${suffix}`;
      suffix++;
    }
    return candidate;
  }

  protected onEditorTitleInput(): void {
    if (!this.slugManuallyEdited()) {
      const candidate = this.slugify(this.editorForm.controls.title.value);
      this.editorForm.controls.slug.setValue(candidate);
      this.editorForm.controls.slug.updateValueAndValidity();
    }
  }

  protected onEditorSlugInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const sanitized = raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .slice(0, 72);
    this.slugManuallyEdited.set(Boolean(sanitized));
    this.editorForm.controls.slug.setValue(sanitized, { emitEvent: false });
    this.editorForm.controls.slug.updateValueAndValidity();
  }

  protected onEditorSlugBlur(): void {
    const trimmed = this.slugify(this.editorForm.controls.slug.value);
    if (!trimmed && this.editorForm.controls.title.value.trim()) {
      this.slugManuallyEdited.set(false);
      this.editorForm.controls.slug.setValue(this.slugify(this.editorForm.controls.title.value));
    } else {
      this.editorForm.controls.slug.setValue(trimmed);
    }
    this.editorForm.controls.slug.updateValueAndValidity();
  }

  protected regenerateSlug(): void {
    const title = this.editorForm.controls.title.value.trim();
    if (!title) {
      this.toast('warn', 'Judul Kosong', 'Isi Judul Drama terlebih dahulu untuk membuat slug unik.');
      return;
    }
    this.slugManuallyEdited.set(false);
    const unique = this.generateUniqueSlug(title);
    this.editorForm.controls.slug.setValue(unique);
    this.editorForm.controls.slug.updateValueAndValidity();
  }

  protected onReleaseDateSelect(value: Date | null): void {
    if (value instanceof Date && !isNaN(value.getTime())) {
      this.editorForm.controls.releaseYear.setValue(value.getFullYear());
    }
  }

  protected onPosterUpload(event: FileUploadHandlerEvent): void {
    this.handleImageFileUpload(event, 'poster');
  }

  protected onBackdropUpload(event: FileUploadHandlerEvent): void {
    this.handleImageFileUpload(event, 'backdrop');
  }

  private async handleImageFileUpload(
    event: FileUploadHandlerEvent,
    kind: 'poster' | 'backdrop',
  ): Promise<void> {
    const file = event.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.toast('error', 'Format Salah', 'Pilih file gambar (.jpg, .png, .webp).');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      this.toast('warn', 'Ukuran Terlalu Besar', 'Maksimal ukuran file gambar 3 MB.');
      return;
    }

    if (this.auth.apiReachable() && this.auth.isAuthenticated()) {
      try {
        const presigned = await firstValueFrom(
          this.http.post<{ uploadUrl: string; publicUrl: string }>('/api/admin/uploads/presign', {
            kind,
            filename: file.name,
            contentType: file.type,
          }),
        );
        const putRes = await fetch(presigned.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        if (putRes.ok) {
          if (kind === 'poster') {
            this.editorForm.controls.posterUrl.setValue(presigned.publicUrl);
            this.posterUploadName.set(file.name);
          } else {
            this.editorForm.controls.backdropUrl.setValue(presigned.publicUrl);
            this.backdropUploadName.set(file.name);
          }
          this.toast(
            'success',
            kind === 'poster' ? 'Poster Diunggah ke R2' : 'Background Carousel Diunggah ke R2',
            file.name,
          );
          return;
        }
      } catch {
        /* fallback to DataURL preview if R2 is not configured yet */
      }
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      if (kind === 'poster') {
        this.editorForm.controls.posterUrl.setValue(dataUrl);
        this.posterUploadName.set(file.name);
      } else {
        this.editorForm.controls.backdropUrl.setValue(dataUrl);
        this.backdropUploadName.set(file.name);
      }
      this.toast(
        'success',
        kind === 'poster' ? 'Poster Diunggah' : 'Background Carousel Diunggah',
        file.name,
      );
    };
    reader.readAsDataURL(file);
  }

  protected fillSampleImage(kind: 'poster' | 'backdrop'): void {
    if (kind === 'poster') {
      this.posterInputMode.set('url');
      this.posterUploadName.set('');
      this.editorForm.controls.posterUrl.setValue(SAMPLE_POSTER_URL);
      this.clearBrokenUrl(SAMPLE_POSTER_URL);
    } else {
      this.backdropInputMode.set('url');
      this.backdropUploadName.set('');
      this.editorForm.controls.backdropUrl.setValue(SAMPLE_BACKDROP_URL);
      this.clearBrokenUrl(SAMPLE_BACKDROP_URL);
    }
  }

  protected clearImage(kind: 'poster' | 'backdrop'): void {
    if (kind === 'poster') {
      this.posterUploadName.set('');
      this.editorForm.controls.posterUrl.setValue('');
    } else {
      this.backdropUploadName.set('');
      this.editorForm.controls.backdropUrl.setValue('');
    }
  }

  protected markPreviewBroken(url: string): void {
    if (!url) return;
    this.brokenImgUrls.update((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }

  protected onPreviewImgLoad(url: string, event: Event): void {
    if (isPlaceholderImage(event)) {
      this.markPreviewBroken(url);
    }
  }

  private clearBrokenUrl(url: string): void {
    this.brokenImgUrls.update((prev) => {
      if (!prev.has(url)) return prev;
      const next = new Set(prev);
      next.delete(url);
      return next;
    });
  }

  // ── Shared Display Helpers ──────────────────────────────────────────────
  protected primaryLangCode(d: Drama): 'ID' | 'EN' {
    if (d.subtitleLanguages[0] === 'EN' && !d.subtitleLanguages.includes('ID')) return 'EN';
    if (d.subtitleLanguages[0] === 'ID') return 'ID';
    return d.videoLanguages[0] === 'en' ? 'EN' : 'ID';
  }

  protected platformColor(name: string): string {
    return this.catalog.getPlatform(name)?.tone ?? 'var(--d-accent)';
  }

  protected episodeProgress(d: Drama): number {
    const latest = d.latestEpisode ?? 0;
    const total = Math.max(1, d.totalEpisodes ?? 1);
    return Math.min(100, Math.round((latest / total) * 100));
  }

  protected dramaTitleById(id: string): string {
    return this.catalog.dramas.find((d) => d.id === id)?.title ?? this.catalog.dramas[0]?.title ?? id;
  }

  protected catalogThumbSrc(d: Drama): string | null {
    const url = d.posterUrl?.trim();
    return url && !this.brokenImgUrls().has(url) ? url : null;
  }

  // ── Editor Actions ──────────────────────────────────────────────────────
  protected onSceneSelect(sceneKey: string): void {
    const preset = SCENE_PRESETS[sceneKey];
    this.editorForm.controls.scene.setValue(sceneKey);
    if (preset) {
      this.editorForm.controls.tone.setValue(preset.tone);
    }
  }

  protected resetEditorForm(): void {
    const s = this.slug();
    this.populateEditorForm(this.routeMode() === 'edit' ? s : undefined);
  }

  protected saveDramaEditor(): void {
    this.editorForm.controls.slug.updateValueAndValidity();
    if (this.editorForm.invalid) {
      this.editorForm.markAllAsTouched();
      const slugErr = this.editorForm.controls.slug.getError('duplicateSlug');
      if (slugErr) {
        this.toast('error', 'Slug Duplikat', `Slug sudah digunakan oleh "${slugErr}".`);
      } else if (this.editorForm.controls.slug.invalid) {
        this.toast(
          'warn',
          'Slug Tidak Valid',
          'Pastikan slug hanya memakai huruf kecil, angka, dan tanda "-" tanpa spasi.',
        );
      } else {
        this.toast('warn', 'Periksa Isian', 'Judul, Slug unik, Genre, dan Sinopsis wajib diisi.');
      }
      return;
    }

    const existing = this.editingDrama();
    const v = this.editorForm.getRawValue();
    const title = v.title.trim();
    const slug = this.slugify(v.slug) || this.generateUniqueSlug(title);
    const totalEpisodes = Math.max(1, Number(v.totalEpisodes) || 80);
    const latestEpisode = Math.max(1, Math.min(totalEpisodes, Number(v.latestEpisode) || totalEpisodes));
    const rating = Math.max(1, Math.min(10, Number(v.rating) || 8.5));
    const genres = v.genres.length ? [...v.genres] : ['Drama'];
    const videoLanguages: VideoLang[] = v.videoLanguages.length ? [...v.videoLanguages] : ['id'];
    const subtitleLanguages = v.subtitleLanguages.length ? [...v.subtitleLanguages] : ['ID'];
    const releaseDateIso = toIsoDate(v.releaseDate) || `${Number(v.releaseYear) || 2026}-01-01`;
    const releaseYear = v.releaseDate ? v.releaseDate.getFullYear() : Number(v.releaseYear) || 2026;
    const tags = this.splitCommaList(v.tagsText);
    const cast = this.splitCommaList(v.castText);
    const alternateTitles = this.splitCommaList(v.alternateTitlesText);
    const nowIso = new Date().toISOString();
    const dramaId = existing?.id ?? `${slug}-${Date.now().toString(36)}`;
    const durationMinutes = Math.max(1, Number(v.durationMinutes) || 2);
    const streamUrl = v.streamUrl.trim();

    const basePayload: Drama = {
      ...(existing ?? {}),
      id: dramaId,
      slug,
      title,
      originalTitle: v.originalTitle.trim() || undefined,
      alternateTitles: alternateTitles.length ? alternateTitles : undefined,
      synopsis: v.synopsis.trim(),
      posterUrl: v.posterUrl.trim() || undefined,
      backdropUrl: v.backdropUrl.trim() || undefined,
      genres,
      platformId: v.platformId,
      releaseYear,
      releaseDate: releaseDateIso,
      totalEpisodes,
      latestEpisode,
      status: v.status,
      subtitleLanguages,
      videoLanguages,
      rating,
      ratingIsDemo: existing?.ratingIsDemo ?? true,
      durationMinutes,
      country: v.country.trim() || 'China',
      productionStudio: v.productionStudio.trim() || undefined,
      ageRating: v.ageRating || '13+',
      trailerUrl: v.trailerUrl.trim() || undefined,
      director: v.director.trim() || undefined,
      cast: cast.length ? cast : undefined,
      tags: tags.length ? tags : undefined,
      featured: Boolean(v.featured),
      trendingScore: Number(v.trendingScore) || 900,
      updatedAt: nowIso,
      addedAt: existing?.addedAt ?? nowIso,
      isDemoData: existing?.isDemoData ?? true,
      tone: v.tone || SCENE_PRESETS['ceo'].tone,
    };

    const syncedEpisodes = this.cms.syncEpisodesFromDrama(basePayload, streamUrl).map((ep) => ({
      number: ep.number,
      title: ep.title,
      airDate: ep.airDate,
      durationMinutes: ep.durationMinutes,
      streamUrl: ep.streamUrl,
      subtitleUrl: ep.subtitleUrl,
      status: ep.status,
    }));

    const dramaPayload: Drama = {
      ...basePayload,
      episodes: syncedEpisodes,
    };

    this.catalog.upsertDrama(dramaPayload, Boolean(existing));

    if (v.scheduleDay) {
      this.cms.addScheduleSlot({
        day: v.scheduleDay,
        time: v.scheduleTime.trim() || '19.30',
        dramaId: dramaPayload.id,
        dramaSlug: dramaPayload.slug,
        ep: Math.min(totalEpisodes, latestEpisode + 1),
        status: 'Terjadwal',
      });
    }

    const prefillReqId = this.cms.editorPrefill()?.reqId;
    if (!existing && prefillReqId) {
      this.cms.updateRequestStatus(prefillReqId, 'Tersedia');
    }

    this.cms.logActivity(
      existing
        ? `Memperbarui metadata "${title}"`
        : `Menerbitkan drama baru "${title}" (${dramaPayload.platformId})`,
    );
    this.cms.editorPrefill.set(null);
    this.toast(
      'success',
      existing ? 'Perubahan Disimpan' : 'Drama Diterbitkan',
      `"${title}" tersinkron ke Website Utama (/) dan Katalog CMS.`,
    );
    void this.router.navigate(['/admin/dramas']);
  }

  private splitCommaList(value: string): string[] {
    return (value || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  }

  // ── Catalog Actions ─────────────────────────────────────────────────────
  protected resetCatalogFilters(): void {
    this.cms.searchQuery.set('');
    this.filterPlatform.set('');
    this.filterGenre.set('');
    this.filterStatus.set('');
    this.filterLang.set('');
    this.filterFeatured.set('');
    this.sortCatalogBy.set('trending');
  }

  protected toggleSelect(id: string, checked: boolean): void {
    const next = new Set(this.selectedIds());
    if (checked) next.add(id);
    else next.delete(id);
    this.selectedIds.set(next);
  }

  protected toggleSelectAll(checked: boolean): void {
    this.selectedIds.set(
      checked ? new Set(this.filteredDramas().map((d) => d.id)) : new Set(),
    );
  }

  protected applyBulk(kind: 'featured' | 'completed' | 'delete'): void {
    const ids = this.selectedIds();
    if (!ids.size) return;
    this.catalog.bulkUpdateDramas(ids, kind);
    this.cms.logActivity(`Aksi massal (${kind}) pada ${ids.size} drama`);
    this.selectedIds.set(new Set());
    this.toast('success', 'Aksi Massal', `${ids.size} drama diperbarui.`);
  }

  protected setFeaturedState(d: Drama, nextValue: boolean): void {
    if (Boolean(d.featured) === nextValue) return;
    const updated = this.catalog.toggleFeatured(d.id);
    if (updated) {
      this.cms.logActivity(`Hero Spotlight "${d.title}": ${updated.featured ? 'ON' : 'OFF'}`);
      this.toast('info', 'Hero Spotlight', `"${d.title}" ${updated.featured ? 'aktif' : 'nonaktif'}.`);
    }
  }

  protected confirmDeleteDrama(): void {
    const d = this.pendingDelete();
    if (!d) return;
    this.catalog.deleteDrama(d.id);
    this.cms.logActivity(`Menghapus drama "${d.title}"`);
    this.pendingDelete.set(null);
    this.toast('success', 'Drama Dihapus', `"${d.title}" dihapus dari katalog.`);
  }

  // ── Episodes CRUD ───────────────────────────────────────────────────────
  protected openEpisodesForDrama(dramaId: string): void {
    this.selectedEpDramaId.set(dramaId);
    void this.router.navigate(['/admin/episodes']);
  }

  protected submitEpisode(): void {
    const d = this.selectedEpDrama();
    const num = Math.max(1, Number(this.epNum()) || 1);
    const title = this.epTitle().trim() || `Episode ${num}`;
    const url =
      this.epUrl().trim() ||
      `${this.cms.cdnBaseUrl()}/${d.slug.slice(0, 12)}-ep${num}.m3u8`;
    const subUrl = this.epSubtitleUrl().trim() || undefined;
    const airDate = toIsoDate(this.epAirDate()) || toIsoDate(new Date());
    this.cms.addEpisode(d, {
      number: num,
      title,
      durationMinutes: d.durationMinutes ?? 1,
      airDate,
      streamUrl: url,
      subtitleUrl: subUrl,
      videoLang: this.epVideoLang(),
      status: 'Tayang',
    });
    if (num > (d.latestEpisode ?? 0) || num > (d.totalEpisodes ?? 0)) {
      this.catalog.upsertDrama({
        ...d,
        latestEpisode: Math.max(d.latestEpisode ?? 0, num),
        totalEpisodes: Math.max(d.totalEpisodes ?? 0, num),
      });
    }
    this.cms.logActivity(`Menambahkan Ep ${num} untuk "${d.title}"`);
    this.epTitle.set('');
    this.epSubtitleUrl.set('');
    this.toast('success', 'Episode Ditambahkan', `Episode ${num} (${d.title})`);
  }

  protected openEditEpisode(ep: CmsEpisodeItem): void {
    this.editingEpOriginalNum.set(ep.number);
    this.editEpNum.set(ep.number);
    this.editEpTitle.set(ep.title);
    this.editEpDuration.set(ep.durationMinutes);
    this.editEpAirDate.set(parseIsoDate(ep.airDate) ?? new Date());
    this.editEpStreamUrl.set(ep.streamUrl);
    this.editEpSubtitleUrl.set(ep.subtitleUrl ?? '');
    this.editEpVideoLang.set(ep.videoLang ?? 'id');
    this.editEpStatus.set(ep.status);
    this.epEditDialogOpen.set(true);
  }

  protected saveEditedEpisode(): void {
    const d = this.selectedEpDrama();
    const oldNum = this.editingEpOriginalNum();
    if (!d || oldNum === null) return;
    const newNum = Math.max(1, Number(this.editEpNum()) || oldNum);
    this.cms.updateEpisode(d, oldNum, {
      number: newNum,
      title: this.editEpTitle().trim() || `Episode ${newNum}`,
      durationMinutes: Math.max(1, Number(this.editEpDuration()) || 1),
      airDate: toIsoDate(this.editEpAirDate()) || toIsoDate(new Date()),
      streamUrl: this.editEpStreamUrl().trim() || `${this.cms.cdnBaseUrl()}/${d.slug.slice(0, 12)}-ep${newNum}.m3u8`,
      subtitleUrl: this.editEpSubtitleUrl().trim() || undefined,
      videoLang: this.editEpVideoLang(),
      status: this.editEpStatus(),
    });
    this.cms.logActivity(`Memperbarui Episode ${newNum} "${d.title}"`);
    this.epEditDialogOpen.set(false);
    this.toast('success', 'Episode Diperbarui', `Episode ${newNum} (${d.title}) disimpan.`);
  }

  protected removeEpisode(ep: CmsEpisodeItem): void {
    const d = this.selectedEpDrama();
    if (!d) return;
    this.cms.deleteEpisode(d, ep.number);
    this.cms.logActivity(`Menghapus Ep ${ep.number} "${d.title}"`);
    this.toast('info', 'Episode Dihapus', `Episode ${ep.number} dihapus.`);
  }

  // ── Schedule & Taxonomy CRUD ────────────────────────────────────────────
  protected submitScheduleSlot(): void {
    const targetId = this.schDramaId() || this.catalog.dramas[0]?.id;
    const d = this.catalog.dramas.find((x) => x.id === targetId) ?? this.catalog.dramas[0];
    if (!d) return;
    this.cms.addScheduleSlot({
      day: this.schDay(),
      time: this.schTime().trim() || '19.30',
      dramaId: d.id,
      dramaSlug: d.slug,
      ep: (d.latestEpisode ?? 1) + 1,
      note: this.schNote().trim() || undefined,
      status: 'Terjadwal',
    });
    this.cms.logActivity(`Menambahkan jadwal ${d.title} (${this.schDay()} ${this.schTime()})`);
    this.schNote.set('');
    this.toast('success', 'Jadwal Disimpan', `${d.title} dijadwalkan hari ${this.schDay()}.`);
  }

  protected openEditSlot(slot: CmsScheduleSlot): void {
    this.editingSlotId.set(slot.id);
    this.editSlotDramaId.set(slot.dramaId);
    this.editSlotDay.set(slot.day);
    this.editSlotTime.set(slot.time);
    this.editSlotEp.set(slot.ep);
    this.editSlotStatus.set(slot.status ?? 'Terjadwal');
    this.editSlotNote.set(slot.note ?? '');
    this.slotDialogOpen.set(true);
  }

  protected saveEditedSlot(): void {
    const id = this.editingSlotId();
    if (id === null) return;
    const drama = this.catalog.dramas.find((d) => d.id === this.editSlotDramaId());
    this.cms.updateScheduleSlot(id, {
      dramaId: this.editSlotDramaId(),
      dramaSlug: drama?.slug,
      day: this.editSlotDay(),
      time: this.editSlotTime().trim() || '19.30',
      ep: Math.max(1, Number(this.editSlotEp()) || 1),
      status: this.editSlotStatus(),
      note: this.editSlotNote().trim() || undefined,
    });
    this.cms.logActivity(`Memperbarui jadwal "${drama?.title ?? this.editSlotDramaId()}" (${this.editSlotDay()})`);
    this.slotDialogOpen.set(false);
    this.toast('success', 'Jadwal Diperbarui', 'Slot jadwal tersinkron ke halaman Jadwal Rilis.');
  }

  protected submitPlatform(): void {
    const name = this.newPlatName().trim();
    if (!name) return;
    if (this.catalog.addPlatform(name, this.newPlatTone(), this.newPlatDesc())) {
      this.cms.logActivity(`Menambahkan platform "${name}"`);
      this.toast('success', 'Platform Ditambahkan', name);
      this.newPlatName.set('');
      this.newPlatDesc.set('');
    } else {
      this.toast('warn', 'Gagal', 'Platform sudah ada atau nama tidak valid.');
    }
  }

  protected submitGenre(): void {
    const name = this.newGenreName().trim();
    if (!name) return;
    if (this.catalog.addGenre(name, this.newGenreTone(), this.newGenreDesc())) {
      this.cms.logActivity(`Menambahkan genre "${name}"`);
      this.toast('success', 'Genre Ditambahkan', name);
      this.newGenreName.set('');
      this.newGenreDesc.set('');
    } else {
      this.toast('warn', 'Gagal', 'Genre sudah ada atau nama tidak valid.');
    }
  }

  protected openEditTaxonomy(kind: 'platform' | 'genre', item: DramaPlatform | DramaGenre): void {
    this.taxEditKind.set(kind);
    this.taxEditId.set(item.id);
    this.taxEditName.set(item.name);
    this.taxEditDesc.set(item.description);
    this.taxEditTone.set(item.tone);
    this.taxDialogOpen.set(true);
  }

  protected saveTaxonomyEdit(): void {
    const kind = this.taxEditKind();
    const id = this.taxEditId();
    const name = this.taxEditName().trim();
    if (!kind || !id || !name) return;
    const patch = { name, description: this.taxEditDesc().trim(), tone: this.taxEditTone() };
    const ok =
      kind === 'platform'
        ? this.catalog.updatePlatform(id, patch)
        : this.catalog.updateGenre(id, patch);
    if (!ok) {
      this.toast('warn', 'Gagal Menyimpan', 'Nama sudah dipakai atau tidak valid.');
      return;
    }
    this.cms.logActivity(`Memperbarui ${kind} "${name}"`);
    this.taxDialogOpen.set(false);
    this.toast('success', 'Taxonomy Diperbarui', `"${name}" tersinkron ke katalog.`);
  }

  protected deleteTaxonomyItem(kind: 'platform' | 'genre', item: DramaPlatform | DramaGenre): void {
    const ok =
      kind === 'platform' ? this.catalog.deletePlatform(item.id) : this.catalog.deleteGenre(item.id);
    if (ok) {
      this.cms.logActivity(`Menghapus ${kind} "${item.name}"`);
      this.toast('info', 'Taxonomy Dihapus', `"${item.name}" dihapus.`);
    }
  }

  // ── Moderation CRUD (Requests, Comments, DMCA) ──────────────────────────
  protected resetRequestFilters(): void {
    this.reqSearch.set('');
    this.reqFilterStatus.set('');
    this.reqFilterPriority.set('');
    this.reqFilterLang.set('');
  }

  protected openRequestDialog(req?: CmsDramaRequest): void {
    this.editingReqId.set(req?.id ?? null);
    this.reqFormTitle.set(req?.title ?? '');
    this.reqFormPlatform.set(req?.platform ?? this.catalog.platforms[0]?.name ?? 'DramaBox');
    this.reqFormLang.set(req?.lang ?? 'ID');
    this.reqFormPriority.set(req?.priority ?? 'Normal');
    this.reqFormStatus.set(req?.status ?? 'Ditinjau');
    this.reqFormEpisodes.set(req?.episodeCount ?? 60);
    this.reqFormRequester.set(req?.requester ?? 'viewer@tiraiplay.example');
    this.reqFormNote.set(req?.note ?? '');
    this.reqDialogOpen.set(true);
  }

  protected saveRequestDialog(): void {
    const title = this.reqFormTitle().trim();
    if (!title) {
      this.toast('warn', 'Judul Wajib Diisi', 'Masukkan judul drama request.');
      return;
    }
    const id = this.editingReqId();
    const payload = {
      title,
      platform: this.reqFormPlatform(),
      lang: this.reqFormLang(),
      priority: this.reqFormPriority(),
      status: this.reqFormStatus(),
      episodeCount: Math.max(1, Number(this.reqFormEpisodes()) || 60),
      requester: this.reqFormRequester().trim() || 'viewer@tiraiplay.example',
      note: this.reqFormNote().trim(),
    };
    if (id !== null) {
      this.cms.updateRequest(id, payload);
      this.cms.logActivity(`Memperbarui request "${title}"`);
      this.toast('success', 'Request Diperbarui', title);
    } else {
      this.cms.addRequest({ ...payload, votes: 1 });
      this.cms.logActivity(`Menambahkan request penonton "${title}"`);
      this.toast('success', 'Request Ditambahkan', title);
    }
    this.reqDialogOpen.set(false);
  }

  protected convertRequestToDrama(req: CmsDramaRequest): void {
    this.cms.editorPrefill.set({
      reqId: req.id,
      title: req.title,
      platform: req.platform,
      lang: req.lang,
    });
    void this.router.navigate(['/admin/dramas/new']);
  }

  protected resetCommentFilters(): void {
    this.commentSearch.set('');
    this.commentFilterStatus.set('');
    this.commentFilterReason.set('');
  }

  protected openCommentDialog(c: CmsCommentItem): void {
    this.editingCommentId.set(c.id);
    this.commentFormAuthor.set(c.author);
    this.commentFormDrama.set(`${c.drama} · Ep ${c.ep}`);
    this.commentFormBody.set(c.body);
    this.commentFormStatus.set(c.status);
    this.commentFormReason.set(c.flagReason);
    this.commentFormReply.set(c.adminReply ?? '');
    this.commentDialogOpen.set(true);
  }

  protected saveCommentDialog(): void {
    const id = this.editingCommentId();
    if (id === null) return;
    this.cms.updateComment(id, {
      body: this.commentFormBody().trim(),
      status: this.commentFormStatus(),
      flagReason: this.commentFormReason(),
      adminReply: this.commentFormReply().trim() || undefined,
    });
    this.cms.logActivity(`Memperbarui moderasi komentar #${id}`);
    this.commentDialogOpen.set(false);
    this.toast('success', 'Komentar Diperbarui', 'Status & balasan admin disimpan.');
  }

  protected resetTicketFilters(): void {
    this.ticketSearch.set('');
    this.ticketFilterStatus.set('');
    this.ticketFilterPriority.set('');
  }

  protected openTicketDialog(t?: CmsDmcaTicket): void {
    this.editingTicketId.set(t?.id ?? null);
    this.ticketFormTarget.set(t?.target ?? '');
    this.ticketFormSender.set(t?.sender ?? '');
    this.ticketFormType.set(t?.type ?? 'Koreksi Metadata / Sub');
    this.ticketFormPriority.set(t?.priority ?? 'Normal');
    this.ticketFormStatus.set(t?.status ?? 'Terbuka');
    this.ticketFormEvidence.set(t?.evidenceUrl ?? '');
    this.ticketFormResolution.set(t?.resolutionNote ?? '');
    this.ticketDialogOpen.set(true);
  }

  protected saveTicketDialog(): void {
    const target = this.ticketFormTarget().trim();
    const sender = this.ticketFormSender().trim();
    if (!target || !sender) {
      this.toast('warn', 'Lengkapi Tiket', 'Target drama dan email pengirim wajib diisi.');
      return;
    }
    const id = this.editingTicketId();
    const payload = {
      target,
      sender,
      type: this.ticketFormType().trim() || 'Koreksi Metadata',
      priority: this.ticketFormPriority(),
      status: this.ticketFormStatus(),
      evidenceUrl: this.ticketFormEvidence().trim() || undefined,
      resolutionNote: this.ticketFormResolution().trim() || undefined,
    };
    if (id) {
      this.cms.updateTicket(id, payload);
      this.cms.logActivity(`Memperbarui tiket ${id} (${payload.status})`);
      this.toast('success', 'Tiket Diperbarui', `${id} disimpan.`);
    } else {
      this.cms.addTicket(payload);
      this.cms.logActivity(`Membuat tiket baru untuk "${target}"`);
      this.toast('success', 'Tiket Dibuat', target);
    }
    this.ticketDialogOpen.set(false);
  }

  // ── Users & RBAC CRUD ───────────────────────────────────────────────────
  protected resetUserFilters(): void {
    this.userSearch.set('');
    this.userFilterRole.set('');
    this.userFilterStatus.set('');
    this.userFilterDepartment.set('');
  }

  protected openUserDialog(u?: CmsUserAccount): void {
    this.editingUserId.set(u?.id ?? null);
    this.userFormName.set(u?.name ?? '');
    this.userFormUsername.set(u?.username ?? '');
    this.userFormEmail.set(u?.email ?? '');
    this.userFormRole.set(u?.role ?? 'editor');
    this.userFormDepartment.set(u?.department ?? CMS_DEPARTMENTS[1]);
    this.userFormPhone.set(u?.phone ?? '');
    this.userFormStatus.set(u?.status ?? 'Aktif');
    this.userFormTwoFactor.set(Boolean(u?.twoFactorEnabled));
    this.userFormNotes.set(u?.notes ?? '');
    this.userDialogOpen.set(true);
  }

  protected saveUserDialog(): void {
    if (!this.cms.can('manageUsers')) {
      this.toast('error', 'Akses Ditolak', 'Role saat ini tidak memiliki izin Kelola Pengguna.');
      return;
    }
    const name = this.userFormName().trim();
    const email = this.userFormEmail().trim();
    if (!name || !email) {
      this.toast('warn', 'Data Belum Lengkap', 'Nama lengkap dan email wajib diisi.');
      return;
    }
    const id = this.editingUserId();
    const payload = {
      name,
      username: this.userFormUsername().trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '.'),
      email,
      role: this.userFormRole(),
      department: this.userFormDepartment(),
      phone: this.userFormPhone().trim() || undefined,
      status: this.userFormStatus(),
      twoFactorEnabled: this.userFormTwoFactor(),
      notes: this.userFormNotes().trim() || undefined,
    };
    if (id !== null) {
      this.cms.updateUser(id, payload);
      this.cms.logActivity(`Memperbarui profil & role "${name}" (${payload.role})`);
      this.toast('success', 'Pengguna Diperbarui', `${name} (${ROLE_META[payload.role].label})`);
    } else {
      this.cms.addUser(payload);
      this.cms.logActivity(`Menambahkan akun "${name}" (${payload.role})`);
      this.toast('success', 'Akun Dibuat', `${name} berhasil ditambahkan.`);
    }
    this.userDialogOpen.set(false);
  }

  protected confirmDeleteUser(): void {
    const u = this.pendingDeleteUser();
    if (!u) return;
    this.cms.deleteUser(u.id);
    this.cms.logActivity(`Menghapus akun "${u.name}"`);
    this.pendingDeleteUser.set(null);
    this.toast('info', 'Akun Dihapus', `${u.name} dihapus dari daftar pengguna.`);
  }

  protected hasRolePermission(role: CmsRole, perm: CmsPermission): boolean {
    return this.cms.rolePermissions()[role][perm];
  }

  protected togglePermissionCell(role: CmsRole, perm: CmsPermission, nextVal: boolean): void {
    if (!this.cms.can('manageUsers')) {
      this.toast('error', 'Akses Ditolak', 'Hanya role dengan izin Kelola Pengguna yang bisa mengubah matriks RBAC.');
      return;
    }
    this.cms.updateRolePermission(role, perm, nextVal);
    this.cms.logActivity(`Mengubah izin "${perm}" pada role ${ROLE_META[role].label}: ${nextVal ? 'ON' : 'OFF'}`);
  }

  protected resetRoleMatrix(): void {
    this.cms.resetRolePermissions();
    this.cms.logActivity('Mengembalikan matriks hak akses RBAC ke pengaturan default');
    this.toast('info', 'Matriks Direset', 'Semua hak akses role dikembalikan ke bawaan.');
  }

  protected countActivePerms(role: CmsRole): number {
    const map = this.cms.rolePermissions()[role];
    return Object.values(map).filter(Boolean).length;
  }

  protected countUsersByRole(role: CmsRole): number {
    return this.cms.users().filter((u) => u.role === role).length;
  }

  // ── Settings & Formatting Helpers ───────────────────────────────────────
  protected async copyCatalogJson(): Promise<void> {
    try {
      const remoteBundle = await this.cms.exportCatalogFromApi();
      const dataToCopy = remoteBundle ?? this.catalog.dramas;
      await navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2));
      this.toast(
        'success',
        'JSON Disalin',
        `${this.catalog.dramas.length} judul berhasil disalin.`,
      );
    } catch {
      this.toast('warn', 'Gagal Menyalin', 'Browser menolak akses clipboard.');
    }
  }

  protected async saveAnnouncement(value: string): Promise<void> {
    this.cms.siteAnnouncement.set(value.trim());
    await this.cms.saveSettingsToApi();
    this.cms.logActivity('Memperbarui banner pengumuman beranda');
    this.toast('success', 'Pengaturan Disimpan', 'Banner pengumuman beranda diperbarui.');
  }

  protected async savePlatformSettings(): Promise<void> {
    const ok = await this.cms.saveSettingsToApi();
    this.cms.logActivity('Menyimpan konfigurasi sistem & pemutar TiraiPlay');
    this.toast(
      ok ? 'success' : 'warn',
      ok ? 'Konfigurasi Disimpan' : 'Tersimpan Lokal',
      ok
        ? 'Pengaturan sistem, CDN & moderasi aktif.'
        : 'Gagal menyinkronkan ke server, perubahan aktif secara lokal.',
    );
  }

  protected inputVal(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected roleFilterLabel(r: '' | CmsRole): string {
    return r ? ROLE_META[r].label : 'Semua';
  }

  protected videoLangText(d: Drama): string {
    return `SUB ${videoLangLabel(d.videoLanguages)}`;
  }

  protected statusSeverity(
    status: DramaStatus | string,
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    if (
      status === 'completed' ||
      status === 'Tersedia' ||
      status === 'Tayang' ||
      status === 'Selesai' ||
      status === 'Aktif' ||
      status === 'Tampil'
    ) {
      return 'success';
    }
    if (status === 'ongoing' || status === 'Terjadwal' || status === 'Diproses' || status === 'Normal') {
      return 'info';
    }
    if (
      status === 'Ditangguhkan' ||
      status === 'Ditolak' ||
      status === 'Terbuka' ||
      status === 'Tinggi' ||
      status === 'Kata Kasar' ||
      status === 'Spam/Promosi'
    ) {
      return 'danger';
    }
    return 'warn';
  }

  private toast(severity: 'success' | 'info' | 'warn' | 'error', summary: string, detail: string): void {
    this.messages.add({ severity, summary, detail, life: 2600 });
  }
}
