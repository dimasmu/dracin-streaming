import { Service, signal } from '@angular/core';
import type { Drama } from '../models/drama';

export type CmsRole = 'admin' | 'editor' | 'user';

export interface CmsRolePermissions {
  viewAdmin: boolean;
  createDrama: boolean;
  editDrama: boolean;
  deleteDrama: boolean;
  editEpisodes: boolean;
  editTaxonomy: boolean;
  moderateRequests: boolean;
  manageUsers: boolean;
  manageSettings: boolean;
}

export type CmsPermission = keyof CmsRolePermissions;

export interface CmsNavItem {
  id: string;
  route: string;
  label: string;
  icon: string;
}

export interface CmsNavGroup {
  label: string;
  items: CmsNavItem[];
}

export interface CmsEpisodeItem {
  number: number;
  title: string;
  durationMinutes: number;
  airDate: string;
  streamUrl: string;
  status: 'Tayang' | 'Draft';
}

export interface CmsScheduleSlot {
  id: number;
  day: string;
  time: string;
  dramaId: string;
  ep: number;
}

export interface CmsDramaRequest {
  id: number;
  title: string;
  platform: string;
  lang: 'ID' | 'EN';
  note: string;
  status: 'Ditinjau' | 'Terjadwal' | 'Tersedia';
  votes: number;
  date: string;
}

export interface CmsCommentItem {
  id: number;
  drama: string;
  ep: number;
  author: string;
  body: string;
  status: 'Tampil' | 'Ditinjau' | 'Disembunyikan';
  time: string;
}

export interface CmsDmcaTicket {
  id: string;
  target: string;
  sender: string;
  type: string;
  status: 'Terbuka' | 'Diproses' | 'Selesai';
  date: string;
}

export interface CmsUserAccount {
  id: number;
  name: string;
  email: string;
  role: CmsRole;
  status: 'Aktif' | 'Ditangguhkan';
  lastActive: string;
}

export interface CmsActivityEntry {
  time: string;
  actor: string;
  action: string;
}

export interface CmsEditorPrefill {
  reqId?: number;
  title?: string;
  platform?: string;
  lang?: 'ID' | 'EN';
}

export interface ScenePalette {
  label: string;
  c1: string;
  c2: string;
  c3: string;
  tone: string;
}

export const SCENE_PRESETS: Record<string, ScenePalette> = {
  ceo: { label: 'CEO & Kota Modern', c1: '#14261d', c2: '#059669', c3: '#2dd4bf', tone: 'oklch(68% .16 155)' },
  royal: { label: 'Istana & Kerajaan', c1: '#1c1026', c2: '#be123c', c3: '#fbbf24', tone: 'oklch(65% .17 15)' },
  action: { label: 'Aksi & Bela Diri', c1: '#1e1326', c2: '#e11d48', c3: '#fbbf24', tone: 'oklch(68% .18 35)' },
  fantasy: { label: 'Fantasi & Kultivasi', c1: '#091926', c2: '#0d9488', c3: '#34d399', tone: 'oklch(70% .15 178)' },
  revenge: { label: 'Misteri & Balas Dendam', c1: '#0f1722', c2: '#10b981', c3: '#fb7185', tone: 'oklch(65% .16 205)' },
  family: { label: 'Keluarga & Hangat', c1: '#112219', c2: '#059669', c3: '#fbbf24', tone: 'oklch(72% .15 140)' },
};

export const ROLE_META: Record<
  CmsRole,
  { label: string; name: string; email: string; badgeBg: string; badgeColor: string }
> = {
  admin: {
    label: 'Admin',
    name: 'Rama Pratama',
    email: 'rama@tiraiplay.example',
    badgeBg: 'var(--d-accent-soft)',
    badgeColor: 'var(--d-accent)',
  },
  editor: {
    label: 'Editor',
    name: 'Sinta Wijaya',
    email: 'sinta.ed@tiraiplay.example',
    badgeBg: 'var(--d-cyan-soft)',
    badgeColor: 'var(--d-cyan)',
  },
  user: {
    label: 'User',
    name: 'Nadia C.',
    email: 'nadia@mail.example',
    badgeBg: 'var(--d-rose-soft)',
    badgeColor: 'var(--d-rose)',
  },
};

export const ROLE_PERMISSIONS: Record<CmsRole, CmsRolePermissions> = {
  admin: {
    viewAdmin: true,
    createDrama: true,
    editDrama: true,
    deleteDrama: true,
    editEpisodes: true,
    editTaxonomy: true,
    moderateRequests: true,
    manageUsers: true,
    manageSettings: true,
  },
  editor: {
    viewAdmin: true,
    createDrama: true,
    editDrama: true,
    deleteDrama: false,
    editEpisodes: true,
    editTaxonomy: true,
    moderateRequests: true,
    manageUsers: false,
    manageSettings: false,
  },
  user: {
    viewAdmin: false,
    createDrama: false,
    editDrama: false,
    deleteDrama: false,
    editEpisodes: false,
    editTaxonomy: false,
    moderateRequests: false,
    manageUsers: false,
    manageSettings: false,
  },
};

export const SCHEDULE_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as const;

@Service()
export class CmsService {
  readonly role = signal<CmsRole>('admin');
  readonly sidebarCollapsed = signal(false);
  readonly mobileSidebarOpen = signal(false);
  readonly searchQuery = signal('');
  readonly editorPrefill = signal<CmsEditorPrefill | null>(null);
  readonly editingSlug = signal<string | null>(null);
  readonly siteAnnouncement = signal(
    'Selamat datang di TiraiPlay — Katalog Drama Pendek Tiongkok Tema Tirai Bambu!',
  );
  readonly maintenanceMode = signal(false);

  readonly navGroups: readonly CmsNavGroup[] = [
    {
      label: 'Utama & Analitik',
      items: [
        { id: 'dashboard', route: '/admin/dashboard', label: 'Dashboard', icon: 'pi pi-th-large' },
        { id: 'analytics', route: '/admin/analytics', label: 'Analitik', icon: 'pi pi-chart-line' },
      ],
    },
    {
      label: 'Manajemen Konten',
      items: [
        { id: 'dramas', route: '/admin/dramas', label: 'Katalog Drama', icon: 'pi pi-video' },
        { id: 'drama-editor', route: '/admin/dramas/new', label: 'Buat / Edit Drama', icon: 'pi pi-plus-circle' },
        { id: 'episodes', route: '/admin/episodes', label: 'Episode & Stream', icon: 'pi pi-list' },
        { id: 'schedule', route: '/admin/schedule', label: 'Jadwal Rilis', icon: 'pi pi-calendar' },
        { id: 'taxonomy', route: '/admin/taxonomy', label: 'Platform & Genre', icon: 'pi pi-tags' },
      ],
    },
    {
      label: 'Komunitas & Sistem',
      items: [
        { id: 'moderation', route: '/admin/moderation', label: 'Request & Moderasi', icon: 'pi pi-comments' },
        { id: 'users', route: '/admin/users', label: 'Pengguna & Role', icon: 'pi pi-users' },
        { id: 'settings', route: '/admin/settings', label: 'Pengaturan & JSON', icon: 'pi pi-cog' },
      ],
    },
  ];

  readonly episodesByDrama = signal<Record<string, CmsEpisodeItem[]>>({
    'dituduh-membunuh-anakku-sendiri': [
      {
        number: 74,
        title: 'Rekaman CCTV Ruang Sidang',
        durationMinutes: 1,
        airDate: '2026-11-18',
        streamUrl: 'https://cdn.tiraiplay.example/streams/dm-74.m3u8',
        status: 'Tayang',
      },
      {
        number: 73,
        title: 'Pengakuan Saksi Kunci',
        durationMinutes: 1,
        airDate: '2026-11-17',
        streamUrl: 'https://cdn.tiraiplay.example/streams/dm-73.m3u8',
        status: 'Tayang',
      },
      {
        number: 72,
        title: 'Jebakan di Gedung Tua',
        durationMinutes: 1,
        airDate: '2026-11-16',
        streamUrl: 'https://cdn.tiraiplay.example/streams/dm-72.m3u8',
        status: 'Tayang',
      },
    ],
  });

  readonly scheduleSlots = signal<CmsScheduleSlot[]>([
    { id: 1, day: 'Senin', time: '19.00', dramaId: 'dituduh-membunuh-anakku-sendiri', ep: 75 },
    { id: 2, day: 'Selasa', time: '19.30', dramaId: 'sulih-suara-paman-sopir-taksi-online-jagoan', ep: 89 },
    { id: 3, day: 'Rabu', time: '20.00', dramaId: 'singgasana-bayangan-sulih-suara', ep: 66 },
    { id: 4, day: 'Jumat', time: '21.00', dramaId: 'dulu-diremehkan-kini-berjaya', ep: 73 },
  ]);

  readonly requests = signal<CmsDramaRequest[]>([
    {
      id: 101,
      title: 'Dokter Jenius di Tahun 1990',
      platform: 'DramaBox',
      lang: 'ID',
      note: 'Permintaan pelengkapan metadata judul dan sinopsis resmi.',
      status: 'Terjadwal',
      votes: 42,
      date: '15 Nov 2026',
    },
    {
      id: 102,
      title: 'Istri Kontrak Sang Pewaris Tunggal',
      platform: 'ReelShort',
      lang: 'EN',
      note: 'Mohon tambahkan entri katalog beserta jadwal rilis episode.',
      status: 'Ditinjau',
      votes: 31,
      date: '16 Nov 2026',
    },
    {
      id: 103,
      title: 'Rahasia Dapur Putri Istana',
      platform: 'GoodShort',
      lang: 'ID',
      note: 'Genre Kuliner & Kerajaan, 68 episode tamat.',
      status: 'Tersedia',
      votes: 19,
      date: '12 Nov 2026',
    },
  ]);

  readonly comments = signal<CmsCommentItem[]>([
    {
      id: 1,
      drama: 'Wah Suamiku Ternyata Bos Besar',
      ep: 12,
      author: 'Raka Pratama',
      body: 'Plot twist pas kartu hitamnya keluar bikin merinding parah!',
      status: 'Tampil',
      time: '4 mnt lalu',
    },
    {
      id: 2,
      drama: 'Paman Sopir Taksi Online Jagoan',
      ep: 18,
      author: 'Nadia C.',
      body: 'Dubbing Indo-nya natural banget, enak ditonton pas jam makan siang.',
      status: 'Tampil',
      time: '18 mnt lalu',
    },
    {
      id: 3,
      drama: 'Singgasana Bayangan',
      ep: 74,
      author: 'Anon_88',
      body: 'Cek menit 0:42 ada spoiler ending di episode sebelah.',
      status: 'Ditinjau',
      time: '1 jam lalu',
    },
  ]);

  readonly dmcaTickets = signal<CmsDmcaTicket[]>([
    {
      id: 'DMCA-204',
      target: 'Singgasana Bayangan',
      sender: 'legal@dramabox.example',
      type: 'Koreksi Hak Cipta / Tautan',
      status: 'Diproses',
      date: '17 Nov 2026',
    },
    {
      id: 'META-118',
      target: 'Dulu Diremehkan Kini Berjaya',
      sender: 'raka.p@mail.example',
      type: 'Salah Total Episode',
      status: 'Selesai',
      date: '14 Nov 2026',
    },
  ]);

  readonly users = signal<CmsUserAccount[]>([
    { id: 1, name: 'Rama Pratama', email: 'rama@tiraiplay.example', role: 'admin', status: 'Aktif', lastActive: 'Online sekarang' },
    { id: 2, name: 'Sinta Wijaya', email: 'sinta.ed@tiraiplay.example', role: 'editor', status: 'Aktif', lastActive: '12 mnt lalu' },
    { id: 3, name: 'Bima Kusuma', email: 'bima.ed@tiraiplay.example', role: 'editor', status: 'Aktif', lastActive: '2 jam lalu' },
    { id: 4, name: 'Nadia C.', email: 'nadia@mail.example', role: 'user', status: 'Aktif', lastActive: '5 mnt lalu' },
    { id: 5, name: 'Kevin W.', email: 'kevin@mail.example', role: 'user', status: 'Aktif', lastActive: '1 hari lalu' },
  ]);

  readonly activityLog = signal<CmsActivityEntry[]>([
    { time: '07:20', actor: 'Sinta (Editor)', action: 'Memperbarui Ep 74 pada Dituduh Membunuh Anakku Sendiri' },
    { time: '06:55', actor: 'Rama (Admin)', action: 'Mengaktifkan Hero Spotlight untuk Singgasana Bayangan' },
    { time: 'Kemarin', actor: 'Sinta (Editor)', action: 'Mengubah status request Dokter Jenius di Tahun 1990 menjadi Terjadwal' },
  ]);

  can(perm: CmsPermission): boolean {
    return ROLE_PERMISSIONS[this.role()][perm];
  }

  roleMeta(r: CmsRole = this.role()) {
    return ROLE_META[r];
  }

  setRole(role: CmsRole): void {
    this.role.set(role);
  }

  toggleSidebarCollapsed(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  setMobileSidebarOpen(open: boolean): void {
    this.mobileSidebarOpen.set(open);
  }

  logActivity(action: string): void {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const actor = `Kamu (${ROLE_META[this.role()].label})`;
    this.activityLog.update((list) => [{ time, actor, action }, ...list].slice(0, 8));
  }

  getEpisodesForDrama(drama: Drama): CmsEpisodeItem[] {
    const map = this.episodesByDrama();
    if (map[drama.id]?.length) return map[drama.id];
    const latest = drama.latestEpisode ?? drama.totalEpisodes ?? 1;
    const start = Math.max(1, latest - 5);
    const arr: CmsEpisodeItem[] = [];
    for (let n = latest; n >= start; n--) {
      arr.push({
        number: n,
        title: `Episode ${n}`,
        durationMinutes: drama.durationMinutes ?? 1,
        airDate: `${drama.releaseYear ?? 2026}-11-18`,
        streamUrl: `https://cdn.tiraiplay.example/streams/${drama.slug.slice(0, 12)}-ep${n}.m3u8`,
        status: 'Tayang',
      });
    }
    return arr;
  }

  addEpisode(dramaId: string, item: CmsEpisodeItem): void {
    this.episodesByDrama.update((map) => {
      const current = map[dramaId] ?? [];
      return { ...map, [dramaId]: [item, ...current.filter((e) => e.number !== item.number)] };
    });
  }

  bulkGenerateEpisodes(drama: Drama, fromEp: number, toEp: number): void {
    const existing = this.getEpisodesForDrama(drama);
    const additions: CmsEpisodeItem[] = [];
    for (let n = toEp; n >= fromEp; n--) {
      if (!existing.some((e) => e.number === n)) {
        additions.push({
          number: n,
          title: `Episode ${n}`,
          durationMinutes: drama.durationMinutes ?? 1,
          airDate: `${drama.releaseYear ?? 2026}-11-18`,
          streamUrl: `https://cdn.tiraiplay.example/streams/${drama.slug.slice(0, 12)}-ep${n}.m3u8`,
          status: 'Tayang',
        });
      }
    }
    this.episodesByDrama.update((map) => ({
      ...map,
      [drama.id]: [...additions, ...existing].sort((a, b) => b.number - a.number),
    }));
  }

  toggleEpisodeStatus(drama: Drama, epNumber: number): void {
    const list = this.getEpisodesForDrama(drama).map((e) =>
      e.number === epNumber ? { ...e, status: e.status === 'Tayang' ? ('Draft' as const) : ('Tayang' as const) } : e,
    );
    this.episodesByDrama.update((map) => ({ ...map, [drama.id]: list }));
  }

  addScheduleSlot(slot: Omit<CmsScheduleSlot, 'id'>): void {
    this.scheduleSlots.update((list) => [...list, { id: Date.now(), ...slot }]);
  }

  removeScheduleSlot(id: number): void {
    this.scheduleSlots.update((list) => list.filter((x) => x.id !== id));
  }

  updateRequestStatus(id: number, status: CmsDramaRequest['status']): void {
    this.requests.update((list) => list.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  toggleCommentVisibility(id: number): void {
    this.comments.update((list) =>
      list.map((c) =>
        c.id === id ? { ...c, status: c.status === 'Tampil' ? 'Disembunyikan' : 'Tampil' } : c,
      ),
    );
  }

  deleteComment(id: number): void {
    this.comments.update((list) => list.filter((c) => c.id !== id));
  }

  updateTicketStatus(id: string, status: CmsDmcaTicket['status']): void {
    this.dmcaTickets.update((list) => list.map((t) => (t.id === id ? { ...t, status } : t)));
  }

  addUser(name: string, email: string, role: CmsRole): void {
    if (!this.can('manageUsers')) return;
    this.users.update((list) => [
      { id: Date.now(), name, email, role, status: 'Aktif', lastActive: 'Baru dibuat' },
      ...list,
    ]);
  }

  changeUserRole(id: number, role: CmsRole): void {
    if (!this.can('manageUsers')) return;
    this.users.update((list) => list.map((u) => (u.id === id ? { ...u, role } : u)));
  }

  toggleUserStatus(id: number): void {
    if (!this.can('manageUsers')) return;
    this.users.update((list) =>
      list.map((u) =>
        u.id === id ? { ...u, status: u.status === 'Aktif' ? 'Ditangguhkan' : 'Aktif' } : u,
      ),
    );
  }
}
