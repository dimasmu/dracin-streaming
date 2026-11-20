import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { startWith } from 'rxjs';
import type { Drama, DramaStatus } from '../../core/models/drama';
import { CatalogService } from '../../core/services/catalog.service';
import {
  CmsDramaRequest,
  CmsRole,
  CmsService,
  ROLE_META,
  SCENE_PRESETS,
  SCHEDULE_DAYS,
} from '../../core/services/cms.service';
import type { VideoLang } from '../../core/services/preferences.service';
import { monogram, videoLangLabel } from '../../core/utils/format';

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

@Component({
  selector: 'app-admin-cms',
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './admin-cms.component.html',
  host: {
    '(document:keydown.escape)': 'pendingDelete.set(null)',
  },
})
export class AdminCmsComponent {
  readonly tab = input<string>();
  readonly slug = input<string>();
  readonly routeMode = input<string>();

  protected readonly catalog = inject(CatalogService);
  protected readonly cms = inject(CmsService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  protected readonly monogram = monogram;
  protected readonly roleMeta = ROLE_META;
  protected readonly roleFilters: readonly ('' | CmsRole)[] = ['', 'admin', 'editor', 'user'];
  protected readonly scheduleDays = SCHEDULE_DAYS;
  protected readonly sceneEntries = Object.entries(SCENE_PRESETS).map(([id, val]) => ({ id, ...val }));

  protected readonly activeTab = computed<AdminTab>(() => {
    const mode = this.routeMode();
    if (mode === 'new' || mode === 'edit') return 'drama-editor';
    const raw = this.tab() ?? 'dashboard';
    return VALID_TABS.has(raw) ? (raw as AdminTab) : 'dashboard';
  });

  // ── Dramas Catalog Filters ──────────────────────────────────────────────
  protected readonly filterPlatform = signal('');
  protected readonly filterStatus = signal('');
  protected readonly filterLang = signal('');
  protected readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly pendingDelete = signal<Drama | null>(null);

  protected readonly filteredDramas = computed(() => {
    const q = this.cms.searchQuery().trim().toLowerCase();
    const plat = this.filterPlatform();
    const stat = this.filterStatus();
    const lang = this.filterLang();
    return this.catalog.dramas.filter((d) => {
      if (plat && d.platformId !== plat) return false;
      if (stat && d.status !== stat) return false;
      if (lang && this.primaryLangCode(d) !== lang) return false;
      if (q) {
        const hay = `${d.title} ${d.slug} ${d.platformId} ${d.genres.join(' ')} ${(d.tags ?? []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
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

  // ── Full-Page Drama Editor Form (/admin/dramas/new | /admin/dramas/:slug/edit) ─
  protected readonly editorForm = this.fb.group({
    title: ['', [Validators.required]],
    slug: ['', [Validators.required]],
    originalTitle: [''],
    synopsis: ['', [Validators.required]],
    director: [''],
    country: ['China'],
    castText: [''],
    genres: [['Drama'] as string[]],
    tagsText: [''],
    platformId: ['DramaBox', [Validators.required]],
    videoLang: ['id' as VideoLang, [Validators.required]],
    status: ['completed' as DramaStatus, [Validators.required]],
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

  protected readonly editingDrama = computed(() => {
    const s = this.slug();
    if (!s || this.routeMode() !== 'edit') return undefined;
    return this.catalog.getBySlug(s);
  });

  protected readonly editorPreview = computed(() => {
    const v = this.formValue();
    const title = v.title?.trim() || 'Judul Drama Baru';
    const slug = this.slugify(v.slug || title) || 'judul-drama-baru';
    const genres = v.genres?.length ? v.genres : ['Drama'];
    const tags = (v.tagsText ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const totalEp = Math.max(1, Number(v.totalEpisodes) || 80);
    const latestEp = Math.min(totalEp, Math.max(1, Number(v.latestEpisode) || totalEp));
    const rating = Math.min(10, Math.max(1, Number(v.rating) || 8.8));
    const status = v.status ?? 'completed';
    return {
      title,
      slug,
      monogram: monogram(title),
      originalTitle: v.originalTitle?.trim() || '',
      synopsis:
        v.synopsis?.trim() ||
        'Sinopsis lengkap alur cerita drama akan tampil di Website Utama (/) dan Katalog CMS.',
      platformId: v.platformId || 'DramaBox',
      langBadge: v.videoLang === 'en' ? 'SUB EN' : 'SUB ID',
      statusLabel: status === 'completed' ? 'Tamat' : status === 'ongoing' ? 'Ongoing' : 'Segera',
      status,
      releaseYear: v.releaseYear || 2026,
      totalEpisodes: totalEp,
      latestEpisode: latestEp,
      rating: rating.toFixed(1),
      tone: v.tone || SCENE_PRESETS[v.scene ?? 'ceo']?.tone || 'oklch(68% .16 155)',
      featured: Boolean(v.featured),
      genres,
      tags,
      checks: [
        { label: 'Judul Drama terisi', ok: Boolean(v.title?.trim()) },
        { label: 'Slug URL valid', ok: Boolean(v.slug?.trim()) },
        { label: 'Minimal 1 Genre dipilih', ok: (v.genres?.length ?? 0) > 0 },
        { label: 'Sinopsis tersedia', ok: Boolean(v.synopsis?.trim()) },
      ],
    };
  });

  // ── Episodes Tab State ──────────────────────────────────────────────────
  protected readonly selectedEpDramaId = signal('dituduh-membunuh-anakku-sendiri');
  protected readonly epSearch = signal('');
  protected readonly epNum = signal(1);
  protected readonly epTitle = signal('');
  protected readonly epUrl = signal('');
  protected readonly epGenFrom = signal(1);
  protected readonly epGenTo = signal(10);

  protected readonly selectedEpDrama = computed(
    () => this.catalog.dramas.find((d) => d.id === this.selectedEpDramaId()) ?? this.catalog.dramas[0],
  );

  protected readonly filteredEpisodes = computed(() => {
    const d = this.selectedEpDrama();
    if (!d) return [];
    const q = this.epSearch().trim().toLowerCase();
    return this.cms
      .getEpisodesForDrama(d)
      .filter((ep) => !q || `ep ${ep.number} ${ep.title} ${ep.streamUrl}`.toLowerCase().includes(q));
  });

  // ── Schedule & Taxonomy Forms ──────────────────────────────────────────
  protected readonly schDramaId = signal('');
  protected readonly schDay = signal<string>('Senin');
  protected readonly schTime = signal('19.30');
  protected readonly newPlatName = signal('');
  protected readonly newPlatTone = signal('oklch(68% .16 155)');
  protected readonly newGenreName = signal('');

  // ── Users Tab Filters & Form ───────────────────────────────────────────
  protected readonly userSearch = signal('');
  protected readonly userFilterRole = signal<'' | CmsRole>('');
  protected readonly newUserName = signal('');
  protected readonly newUserEmail = signal('');
  protected readonly newUserRole = signal<CmsRole>('editor');

  protected readonly filteredUsers = computed(() => {
    const q = this.userSearch().trim().toLowerCase();
    const role = this.userFilterRole();
    return this.cms.users().filter(
      (u) => (!role || u.role === role) && (!q || `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(q)),
    );
  });

  protected readonly sampleCatalogJson = computed(() =>
    JSON.stringify(this.catalog.dramas.slice(0, 2), null, 2),
  );

  constructor() {
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
    const defaultLang: VideoLang = existing
      ? existing.videoLanguages[0] === 'en' && existing.subtitleLanguages[0] !== 'ID'
        ? 'en'
        : 'id'
      : pf?.lang === 'EN'
        ? 'en'
        : 'id';
    const existingEp = existing ? this.cms.getEpisodesForDrama(existing)[0] : undefined;
    const titleVal = existing?.title ?? pf?.title ?? '';
    const slugVal = existing?.slug ?? (pf?.title ? this.slugify(pf.title) : '');

    this.editorForm.reset({
      title: titleVal,
      slug: slugVal,
      originalTitle: existing?.originalTitle ?? '',
      synopsis: existing?.synopsis ?? '',
      director: existing?.director ?? '',
      country: existing?.country ?? 'China',
      castText: existing?.cast?.join(', ') ?? '',
      genres: existing?.genres?.length ? [...existing.genres] : ['Drama'],
      tagsText: existing?.tags?.join(', ') ?? '',
      platformId: existing?.platformId ?? pf?.platform ?? this.catalog.platforms[0]?.name ?? 'DramaBox',
      videoLang: defaultLang,
      status: existing?.status ?? 'completed',
      releaseYear: existing?.releaseYear ?? 2026,
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
  }

  // ── Shared Helpers ──────────────────────────────────────────────────────
  protected slugify(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

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

  // ── Editor Actions ──────────────────────────────────────────────────────
  protected onEditorTitleInput(): void {
    if (!this.editingDrama()) {
      this.editorForm.controls.slug.setValue(this.slugify(this.editorForm.controls.title.value));
    }
  }

  protected regenerateSlug(): void {
    this.editorForm.controls.slug.setValue(this.slugify(this.editorForm.controls.title.value));
  }

  protected onSceneSelect(sceneKey: string): void {
    const preset = SCENE_PRESETS[sceneKey];
    this.editorForm.controls.scene.setValue(sceneKey);
    if (preset) {
      this.editorForm.controls.tone.setValue(preset.tone);
    }
  }

  protected toggleEditorGenre(genreName: string): void {
    const current = this.editorForm.controls.genres.value;
    const next = current.includes(genreName)
      ? current.filter((g) => g !== genreName)
      : [...current, genreName];
    this.editorForm.controls.genres.setValue(next);
  }

  protected resetEditorForm(): void {
    const s = this.slug();
    this.populateEditorForm(this.routeMode() === 'edit' ? s : undefined);
  }

  protected saveDramaEditor(): void {
    if (this.editorForm.invalid) {
      this.editorForm.markAllAsTouched();
      this.toast('warn', 'Periksa Isian', 'Judul, Slug URL, dan Sinopsis wajib diisi.');
      return;
    }
    const existing = this.editingDrama();
    const perm = existing ? 'editDrama' : 'createDrama';
    if (!this.cms.can(perm)) {
      this.toast('error', 'Akses Ditolak', 'Role saat ini tidak memiliki izin menyimpan metadata.');
      return;
    }

    const v = this.editorForm.getRawValue();
    const title = v.title.trim();
    const slug = this.slugify(v.slug) || this.slugify(title);
    const totalEpisodes = Math.max(1, Number(v.totalEpisodes) || 80);
    const latestEpisode = Math.max(1, Math.min(totalEpisodes, Number(v.latestEpisode) || totalEpisodes));
    const rating = Math.max(1, Math.min(10, Number(v.rating) || 8.5));
    const genres = v.genres.length ? [...v.genres] : ['Drama'];
    const tags = v.tagsText
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const cast = v.castText
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const langCode = v.videoLang === 'en' ? 'EN' : 'ID';
    const nowIso = new Date().toISOString();

    const dramaPayload: Drama = {
      ...(existing ?? {}),
      id: existing?.id ?? `${slug}-${Date.now().toString(36)}`,
      slug,
      title,
      originalTitle: v.originalTitle.trim() || undefined,
      synopsis: v.synopsis.trim(),
      genres,
      platformId: v.platformId,
      releaseYear: Number(v.releaseYear) || 2026,
      totalEpisodes,
      latestEpisode,
      status: v.status,
      subtitleLanguages: [langCode],
      videoLanguages: [v.videoLang],
      rating,
      ratingIsDemo: existing?.ratingIsDemo ?? true,
      durationMinutes: Math.max(1, Number(v.durationMinutes) || 2),
      country: v.country.trim() || 'China',
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

    this.catalog.upsertDrama(dramaPayload);

    const streamUrl = v.streamUrl.trim();
    if (streamUrl) {
      this.cms.addEpisode(dramaPayload.id, {
        number: latestEpisode,
        title: `Episode ${latestEpisode}`,
        durationMinutes: dramaPayload.durationMinutes ?? 2,
        airDate: `${dramaPayload.releaseYear ?? 2026}-11-18`,
        streamUrl,
        status: 'Tayang',
      });
    }

    if (v.scheduleDay) {
      this.cms.addScheduleSlot({
        day: v.scheduleDay,
        time: v.scheduleTime.trim() || '19.30',
        dramaId: dramaPayload.id,
        ep: Math.min(totalEpisodes, latestEpisode + 1),
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

  // ── Catalog Actions ─────────────────────────────────────────────────────
  protected resetCatalogFilters(): void {
    this.cms.searchQuery.set('');
    this.filterPlatform.set('');
    this.filterStatus.set('');
    this.filterLang.set('');
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
    if (kind === 'delete' && !this.cms.can('deleteDrama')) {
      this.toast('warn', 'Khusus Admin', 'Role Editor tidak diizinkan menghapus permanen.');
      return;
    }
    const ids = this.selectedIds();
    if (!ids.size) return;
    this.catalog.bulkUpdateDramas(ids, kind);
    this.cms.logActivity(`Aksi massal (${kind}) pada ${ids.size} drama`);
    this.selectedIds.set(new Set());
    this.toast('success', 'Aksi Massal', `${ids.size} drama diperbarui.`);
  }

  protected toggleFeatured(d: Drama): void {
    const updated = this.catalog.toggleFeatured(d.id);
    if (updated) {
      this.cms.logActivity(`Hero Spotlight "${d.title}": ${updated.featured ? 'ON' : 'OFF'}`);
      this.toast('info', 'Hero Spotlight', `"${d.title}" ${updated.featured ? 'aktif' : 'nonaktif'}.`);
    }
  }

  protected confirmDeleteDrama(): void {
    const d = this.pendingDelete();
    if (!d || !this.cms.can('deleteDrama')) return;
    this.catalog.deleteDrama(d.id);
    this.cms.logActivity(`Menghapus drama "${d.title}"`);
    this.pendingDelete.set(null);
    this.toast('success', 'Drama Dihapus', `"${d.title}" dihapus dari katalog.`);
  }

  // ── Episodes, Schedule, Taxonomy, Moderation, Users, Settings ──────────
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
      `https://cdn.tiraiplay.example/streams/${d.slug.slice(0, 12)}-ep${num}.m3u8`;
    this.cms.addEpisode(d.id, {
      number: num,
      title,
      durationMinutes: d.durationMinutes ?? 1,
      airDate: '2026-11-18',
      streamUrl: url,
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
    this.toast('success', 'Episode Ditambahkan', `Episode ${num} (${d.title})`);
  }

  protected generateBulkEpisodes(): void {
    const d = this.selectedEpDrama();
    const from = Math.max(1, Number(this.epGenFrom()) || 1);
    const to = Math.max(from, Number(this.epGenTo()) || from);
    if (to - from > 50) {
      this.toast('warn', 'Batas Generate', 'Maksimal 50 episode sekaligus.');
      return;
    }
    this.cms.bulkGenerateEpisodes(d, from, to);
    this.catalog.upsertDrama({
      ...d,
      latestEpisode: Math.max(d.latestEpisode ?? 0, to),
      totalEpisodes: Math.max(d.totalEpisodes ?? 0, to),
    });
    this.cms.logActivity(`Generate Ep ${from}–${to} "${d.title}"`);
    this.toast('success', 'Batch Episode Dibuat', `Episode ${from}–${to} berhasil dibuat.`);
  }

  protected submitScheduleSlot(): void {
    const targetId = this.schDramaId() || this.catalog.dramas[0]?.id;
    const d = this.catalog.dramas.find((x) => x.id === targetId) ?? this.catalog.dramas[0];
    if (!d) return;
    this.cms.addScheduleSlot({
      day: this.schDay(),
      time: this.schTime().trim() || '19.30',
      dramaId: d.id,
      ep: (d.latestEpisode ?? 1) + 1,
    });
    this.cms.logActivity(`Menambahkan jadwal ${d.title} (${this.schDay()} ${this.schTime()})`);
    this.toast('success', 'Jadwal Disimpan', `${d.title} dijadwalkan hari ${this.schDay()}.`);
  }

  protected submitPlatform(): void {
    if (!this.newPlatName().trim()) return;
    if (this.catalog.addPlatform(this.newPlatName(), this.newPlatTone())) {
      this.cms.logActivity(`Menambahkan platform "${this.newPlatName().trim()}"`);
      this.toast('success', 'Platform Ditambahkan', this.newPlatName().trim());
      this.newPlatName.set('');
    }
  }

  protected submitGenre(): void {
    if (!this.newGenreName().trim()) return;
    if (this.catalog.addGenre(this.newGenreName())) {
      this.cms.logActivity(`Menambahkan genre "${this.newGenreName().trim()}"`);
      this.toast('success', 'Genre Ditambahkan', this.newGenreName().trim());
      this.newGenreName.set('');
    }
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

  protected submitNewUser(): void {
    if (!this.cms.can('manageUsers')) return;
    const name = this.newUserName().trim();
    const email = this.newUserEmail().trim();
    if (!name || !email) return;
    this.cms.addUser(name, email, this.newUserRole());
    this.cms.logActivity(`Menambahkan akun "${name}" (${this.newUserRole()})`);
    this.newUserName.set('');
    this.newUserEmail.set('');
    this.toast('success', 'Akun Dibuat', `${name} berhasil ditambahkan.`);
  }

  protected async copyCatalogJson(): Promise<void> {
    try {
      await navigator.clipboard.writeText(JSON.stringify(this.catalog.dramas, null, 2));
      this.toast('success', 'JSON Disalin', `${this.catalog.dramas.length} judul berhasil disalin.`);
    } catch {
      this.toast('warn', 'Gagal Menyalin', 'Browser menolak akses clipboard.');
    }
  }

  protected saveAnnouncement(value: string): void {
    if (!this.cms.can('manageSettings')) return;
    this.cms.siteAnnouncement.set(value.trim());
    this.cms.logActivity('Memperbarui banner pengumuman beranda');
    this.toast('success', 'Pengaturan Disimpan', 'Banner pengumuman beranda diperbarui.');
  }

  protected inputVal(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected selectVal(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  protected onToggleAll(event: Event): void {
    this.toggleSelectAll((event.target as HTMLInputElement).checked);
  }

  protected onRequestStatusChange(id: number, event: Event): void {
    this.cms.updateRequestStatus(id, (event.target as HTMLSelectElement).value as CmsDramaRequest['status']);
  }

  protected onTicketStatusChange(id: string, event: Event): void {
    this.cms.updateTicketStatus(id, (event.target as HTMLSelectElement).value as 'Terbuka' | 'Diproses' | 'Selesai');
  }

  protected onNewUserRoleChange(event: Event): void {
    this.newUserRole.set((event.target as HTMLSelectElement).value as CmsRole);
  }

  protected onUserRoleChange(id: number, event: Event): void {
    this.cms.changeUserRole(id, (event.target as HTMLSelectElement).value as CmsRole);
  }

  protected roleFilterLabel(r: '' | CmsRole): string {
    return r ? ROLE_META[r].label : 'Semua';
  }

  protected videoLangText(d: Drama): string {
    return `SUB ${videoLangLabel(d.videoLanguages)}`;
  }

  private toast(severity: 'success' | 'info' | 'warn' | 'error', summary: string, detail: string): void {
    this.messages.add({ severity, summary, detail, life: 2600 });
  }
}
