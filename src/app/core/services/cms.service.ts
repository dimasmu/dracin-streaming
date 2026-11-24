import { HttpClient } from '@angular/common/http';
import { Service, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Drama } from '../models/drama';
import { AuthService } from './auth.service';

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
  subtitleUrl?: string;
  videoLang?: 'id' | 'en';
  status: 'Tayang' | 'Draft';
}

export interface CmsScheduleSlot {
  id: string | number;
  day: string;
  time: string;
  dramaId: string;
  dramaSlug?: string;
  ep: number;
  note?: string;
  status?: 'Terjadwal' | 'Tayang' | 'Ditunda';
}

export interface CmsDramaRequest {
  id: string | number;
  title: string;
  platform: string;
  lang: 'ID' | 'EN';
  requester: string;
  priority: 'Tinggi' | 'Normal' | 'Rendah';
  episodeCount?: number;
  note: string;
  status: 'Ditinjau' | 'Terjadwal' | 'Tersedia' | 'Ditolak';
  votes: number;
  date: string;
}

export interface CmsCommentItem {
  id: string | number;
  drama: string;
  ep: number;
  author: string;
  body: string;
  flagReason: 'Normal' | 'Spoiler' | 'Spam/Promosi' | 'Kata Kasar';
  likes: number;
  adminReply?: string;
  status: 'Tampil' | 'Ditinjau' | 'Disembunyikan';
  time: string;
}

export interface CmsDmcaTicket {
  id: string;
  target: string;
  sender: string;
  type: string;
  priority: 'Tinggi' | 'Normal' | 'Rendah';
  evidenceUrl?: string;
  resolutionNote?: string;
  status: 'Terbuka' | 'Diproses' | 'Selesai' | 'Ditolak';
  date: string;
}

export type CmsUserStatus = 'Aktif' | 'Ditangguhkan' | 'Menunggu Verifikasi';

export interface CmsUserAccount {
  id: string | number;
  name: string;
  username: string;
  email: string;
  role: CmsRole;
  department: string;
  phone?: string;
  twoFactorEnabled: boolean;
  joinedAt: string;
  status: CmsUserStatus;
  lastActive: string;
  notes?: string;
}

export interface CmsActivityEntry {
  time: string;
  actor: string;
  action: string;
}

export interface CmsEditorPrefill {
  reqId?: string | number;
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

export const CMS_DEPARTMENTS = [
  'Operasional & Kurasi',
  'Tim Editorial & Sub',
  'Moderasi Komunitas',
  'Legal & Kepatuhan',
  'Komunitas Penonton',
] as const;

export const CMS_PERMISSION_META: readonly { key: CmsPermission; label: string; desc: string }[] = [
  { key: 'viewAdmin', label: 'Akses Panel Admin', desc: 'Membuka seluruh dashboard /admin dan analitik' },
  { key: 'createDrama', label: 'Buat Drama Baru', desc: 'Menerbitkan entri katalog baru ke Website Utama' },
  { key: 'editDrama', label: 'Edit Metadata Drama', desc: 'Menyunting sinopsis, poster, carousel, & skor' },
  { key: 'deleteDrama', label: 'Hapus Drama', desc: 'Menghapus permanen judul dari katalog & beranda' },
  { key: 'editEpisodes', label: 'Kelola Episode & Stream', desc: 'Menambah, menyunting, dan toggle status episode' },
  { key: 'editTaxonomy', label: 'Platform, Genre & Jadwal', desc: 'Mengatur taxonomy sumber serta slot jadwal rilis' },
  { key: 'moderateRequests', label: 'Moderasi & Tiket DMCA', desc: 'Menindak request penonton, komentar, & laporan' },
  { key: 'manageUsers', label: 'Kelola Pengguna & Role', desc: 'CRUD akun tim, ubah role, status & matriks RBAC' },
  { key: 'manageSettings', label: 'Pengaturan & Ekspor', desc: 'Mengubah konfigurasi sistem, CDN & maintenance' },
];

@Service()
export class CmsService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly role = signal<CmsRole>('admin');
  readonly rolePermissions = signal<Record<CmsRole, CmsRolePermissions>>(
    structuredClone(ROLE_PERMISSIONS),
  );
  readonly sidebarCollapsed = signal(false);
  readonly mobileSidebarOpen = signal(false);
  readonly searchQuery = signal('');
  readonly editorPrefill = signal<CmsEditorPrefill | null>(null);
  readonly editingSlug = signal<string | null>(null);
  readonly siteAnnouncement = signal(
    'Selamat datang di TiraiPlay — Katalog Drama Pendek Tiongkok Tema Tirai Bambu!',
  );
  readonly maintenanceMode = signal(false);
  readonly defaultVideoLang = signal<'id' | 'en'>('id');
  readonly defaultQuality = signal<'1080p' | '720p'>('1080p');
  readonly autoModerateComments = signal(true);
  readonly playerWatermark = signal(true);
  readonly supportEmail = signal('support@tiraiplay.example');
  readonly dmcaEmail = signal('legal@tiraiplay.example');
  readonly cdnBaseUrl = signal('https://cdn.tiraiplay.example/streams');
  readonly freeDailyEpisodeLimit = signal(10);
  readonly guestDailyEpisodeLimit = signal(3);

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

  private readonly initialEpisodeOverrides: Record<string, CmsEpisodeItem[]> = {
    'dituduh-membunuh-anakku-sendiri': [
      {
        number: 74,
        title: 'Rekaman CCTV Ruang Sidang',
        durationMinutes: 1,
        airDate: '2026-11-18',
        streamUrl: 'https://cdn.tiraiplay.example/streams/dm-74.m3u8',
        subtitleUrl: 'https://cdn.tiraiplay.example/subs/dm-74-id.vtt',
        videoLang: 'id',
        status: 'Tayang',
      },
      {
        number: 73,
        title: 'Pengakuan Saksi Kunci',
        durationMinutes: 1,
        airDate: '2026-11-17',
        streamUrl: 'https://cdn.tiraiplay.example/streams/dm-73.m3u8',
        subtitleUrl: 'https://cdn.tiraiplay.example/subs/dm-73-id.vtt',
        videoLang: 'id',
        status: 'Tayang',
      },
      {
        number: 72,
        title: 'Jebakan di Gedung Tua',
        durationMinutes: 1,
        airDate: '2026-11-16',
        streamUrl: 'https://cdn.tiraiplay.example/streams/dm-72.m3u8',
        subtitleUrl: 'https://cdn.tiraiplay.example/subs/dm-72-id.vtt',
        videoLang: 'id',
        status: 'Tayang',
      },
    ],
  };

  readonly episodesByDrama = signal<Record<string, CmsEpisodeItem[]>>({});

  readonly scheduleSlots = signal<CmsScheduleSlot[]>([
    {
      id: 1,
      day: 'Senin',
      time: '19.00',
      dramaId: 'singgasana-bayangan-sulih-suara',
      dramaSlug: 'singgasana-bayangan-sulih-suara',
      ep: 143,
      note: 'Rilis sub Indo serentak',
      status: 'Terjadwal',
    },
    {
      id: 2,
      day: 'Senin',
      time: '20.30',
      dramaId: 'dulu-diremehkan-kini-berjaya',
      dramaSlug: 'dulu-diremehkan-kini-berjaya',
      ep: 101,
      note: 'Episode spesial klimaks',
      status: 'Tayang',
    },
    {
      id: 3,
      day: 'Selasa',
      time: '21.00',
      dramaId: 'suami-nikah-kilatku-memanjakanku',
      dramaSlug: 'suami-nikah-kilatku-memanjakanku',
      ep: 101,
      status: 'Terjadwal',
    },
    {
      id: 4,
      day: 'Rabu',
      time: '21.45',
      dramaId: 'wah-suamiku-ternyata-bos-besar',
      dramaSlug: 'wah-suamiku-ternyata-bos-besar',
      ep: 101,
      status: 'Terjadwal',
    },
    {
      id: 5,
      day: 'Kamis',
      time: '20.00',
      dramaId: 'sulih-suara-paman-sopir-taksi-online-jagoan',
      dramaSlug: 'sulih-suara-paman-sopir-taksi-online-jagoan',
      ep: 101,
      status: 'Tayang',
    },
    {
      id: 6,
      day: 'Jumat',
      time: '19.30',
      dramaId: 'cinta-di-balik-luka-lama',
      dramaSlug: 'cinta-di-balik-luka-lama',
      ep: 100,
      status: 'Terjadwal',
    },
    {
      id: 7,
      day: 'Sabtu',
      time: '20.00',
      dramaId: 'ayahku-bukan-kurir-biasa',
      dramaSlug: 'ayahku-bukan-kurir-biasa',
      ep: 100,
      status: 'Terjadwal',
    },
    {
      id: 8,
      day: 'Minggu',
      time: '21.30',
      dramaId: 'sulih-suara-pacarku-dominan-dan-liar',
      dramaSlug: 'sulih-suara-pacarku-dominan-dan-liar',
      ep: 100,
      status: 'Terjadwal',
    },
  ]);

  readonly requests = signal<CmsDramaRequest[]>([
    {
      id: 101,
      title: 'Dokter Jenius di Tahun 1990',
      platform: 'DramaBox',
      lang: 'ID',
      requester: 'raka.pratama@mail.example',
      priority: 'Tinggi',
      episodeCount: 84,
      note: 'Permintaan pelengkapan metadata judul dan sinopsis resmi.',
      status: 'Terjadwal',
      votes: 42,
      date: '22 Nov 2026',
    },
    {
      id: 102,
      title: 'Istri Kontrak Sang Pewaris Tunggal',
      platform: 'ReelShort',
      lang: 'EN',
      requester: 'nadia.c@mail.example',
      priority: 'Tinggi',
      episodeCount: 72,
      note: 'Mohon tambahkan entri katalog beserta jadwal rilis episode.',
      status: 'Ditinjau',
      votes: 31,
      date: '21 Nov 2026',
    },
    {
      id: 103,
      title: 'Rahasia Dapur Putri Istana',
      platform: 'GoodShort',
      lang: 'ID',
      requester: 'melati.s@mail.example',
      priority: 'Normal',
      episodeCount: 68,
      note: 'Genre Kuliner & Kerajaan, 68 episode tamat.',
      status: 'Tersedia',
      votes: 19,
      date: '20 Nov 2026',
    },
    {
      id: 104,
      title: 'Kaisar Bayangan Kembali ke Kota',
      platform: 'NetShort',
      lang: 'ID',
      requester: 'budi.santoso@mail.example',
      priority: 'Tinggi',
      episodeCount: 95,
      note: 'Banyak dicari di halaman pencarian minggu ini.',
      status: 'Ditinjau',
      votes: 57,
      date: '22 Nov 2026',
    },
    {
      id: 105,
      title: 'Tuan Muda Terbuang Jadi Miliarder',
      platform: 'DramaTV',
      lang: 'ID',
      requester: 'kevin.w@mail.example',
      priority: 'Normal',
      episodeCount: 88,
      note: 'Sudah tayang di sumber resmi dengan sulih suara Indonesia.',
      status: 'Terjadwal',
      votes: 27,
      date: '19 Nov 2026',
    },
    {
      id: 106,
      title: 'Pernikahan Kilat dengan Dokter Bedah',
      platform: 'MyDrama',
      lang: 'EN',
      requester: 'clara.tan@mail.example',
      priority: 'Rendah',
      episodeCount: 64,
      note: 'Subtitle Inggris tersedia lengkap, butuh kartu poster 2:3.',
      status: 'Ditinjau',
      votes: 14,
      date: '18 Nov 2026',
    },
    {
      id: 107,
      title: 'Jenderal Wanita Sang Penakluk Utara',
      platform: 'BiliBili Short',
      lang: 'ID',
      requester: 'farhan.h@mail.example',
      priority: 'Normal',
      episodeCount: 78,
      note: 'Drama kerajaan aksi perempuan terpopuler bulan ini.',
      status: 'Tersedia',
      votes: 36,
      date: '15 Nov 2026',
    },
    {
      id: 108,
      title: 'Kontrak Rahasia Sang Aktris',
      platform: 'Anireels',
      lang: 'EN',
      requester: 'citra.ayu@mail.example',
      priority: 'Rendah',
      episodeCount: 55,
      note: 'Mohon verifikasi apakah ini duplikat dari judul lain.',
      status: 'Ditolak',
      votes: 5,
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
      flagReason: 'Normal',
      likes: 24,
      status: 'Tampil',
      time: '4 mnt lalu',
    },
    {
      id: 2,
      drama: 'Paman Sopir Taksi Online Jagoan',
      ep: 18,
      author: 'Nadia C.',
      body: 'Dubbing Indo-nya natural banget, enak ditonton pas jam makan siang.',
      flagReason: 'Normal',
      likes: 18,
      status: 'Tampil',
      time: '18 mnt lalu',
    },
    {
      id: 3,
      drama: 'Singgasana Bayangan',
      ep: 74,
      author: 'Anon_88',
      body: 'Cek menit 0:42 ada spoiler ending di episode sebelah.',
      flagReason: 'Spoiler',
      likes: 3,
      status: 'Ditinjau',
      time: '1 jam lalu',
    },
    {
      id: 4,
      drama: 'Dulu Diremehkan Kini Berjaya',
      ep: 45,
      author: 'PromoSlot99',
      body: 'Kunjungi tautan promo topup murah di profil saya sekarang!!',
      flagReason: 'Spam/Promosi',
      likes: 0,
      adminReply: 'Komentar disembunyikan otomatis oleh filter spam.',
      status: 'Disembunyikan',
      time: '2 jam lalu',
    },
    {
      id: 5,
      drama: 'Suami Nikah Kilatku Memanjakanku',
      ep: 10,
      author: 'Dewi Lestari',
      body: 'Chemistry pemain utamanya top tier, episode 10 bikin senyum terus.',
      flagReason: 'Normal',
      likes: 31,
      status: 'Tampil',
      time: '3 jam lalu',
    },
    {
      id: 6,
      drama: 'Ayahku Bukan Kurir Biasa',
      ep: 5,
      author: 'Fajar M.',
      body: 'Adegan penyelamatan di gudang pelabuhan keren banget koreonya.',
      flagReason: 'Normal',
      likes: 15,
      status: 'Tampil',
      time: '5 jam lalu',
    },
    {
      id: 7,
      drama: 'Cinta Di Balik Luka Lama',
      ep: 33,
      author: 'User_Toxic02',
      body: 'Komentar ini mengandung kata kasar terhadap staf produksi.',
      flagReason: 'Kata Kasar',
      likes: 1,
      status: 'Ditinjau',
      time: '6 jam lalu',
    },
    {
      id: 8,
      drama: 'Pacarku Dominan Dan Liar',
      ep: 21,
      author: 'Hana K.',
      body: 'Subtitle Inggris di menit akhir agak cepat pergantiannya.',
      flagReason: 'Normal',
      likes: 9,
      adminReply: 'Terima kasih laporannya, tim sub sedang menyesuaikan timing.',
      status: 'Tampil',
      time: '1 hari lalu',
    },
  ]);

  readonly dmcaTickets = signal<CmsDmcaTicket[]>([
    {
      id: 'DMCA-204',
      target: 'Singgasana Bayangan',
      sender: 'legal@dramabox.example',
      type: 'Koreksi Hak Cipta / Tautan',
      priority: 'Tinggi',
      evidenceUrl: 'https://dramabox.example/legal/notice-204',
      resolutionNote: 'Menunggu konfirmasi lisensi resmi region SEA.',
      status: 'Diproses',
      date: '21 Nov 2026',
    },
    {
      id: 'META-118',
      target: 'Dulu Diremehkan Kini Berjaya',
      sender: 'raka.p@mail.example',
      type: 'Salah Total Episode',
      priority: 'Normal',
      resolutionNote: 'Total episode diperbarui ke 100 eps pada katalog.',
      status: 'Selesai',
      date: '20 Nov 2026',
    },
    {
      id: 'DMCA-209',
      target: 'Ayahku Bukan Kurir Biasa',
      sender: 'ip-rights@netshort.example',
      type: 'Permintaan Atribusi Sumber Resmi',
      priority: 'Tinggi',
      evidenceUrl: 'https://netshort.example/verify/209',
      status: 'Terbuka',
      date: '22 Nov 2026',
    },
    {
      id: 'META-124',
      target: 'Wah Suamiku Ternyata Bos Besar',
      sender: 'nadia.c@mail.example',
      type: 'Sinkronisasi Subtitle Ep 40',
      priority: 'Normal',
      status: 'Terbuka',
      date: '22 Nov 2026',
    },
    {
      id: 'BROKEN-088',
      target: 'Cinta Di Balik Luka Lama',
      sender: 'dimas.a@mail.example',
      type: 'Tautan Video Backup Server 2 Error',
      priority: 'Normal',
      resolutionNote: 'Server 2 dialihkan ke mirror CDN baru.',
      status: 'Diproses',
      date: '19 Nov 2026',
    },
    {
      id: 'SPAM-041',
      target: 'Pacarku Dominan Dan Liar',
      sender: 'anon.reporter@mail.example',
      type: 'Laporan Duplikat Tidak Valid',
      priority: 'Rendah',
      resolutionNote: 'Entri unik berbeda platform & pemeran.',
      status: 'Ditolak',
      date: '16 Nov 2026',
    },
  ]);

  readonly users = signal<CmsUserAccount[]>([
    {
      id: 1,
      name: 'Rama Pratama',
      username: 'rama.admin',
      email: 'rama@tiraiplay.example',
      role: 'admin',
      department: 'Operasional & Kurasi',
      phone: '+62 812-3400-1100',
      twoFactorEnabled: true,
      joinedAt: '2025-01-12',
      status: 'Aktif',
      lastActive: 'Online sekarang',
      notes: 'Lead administrator & pengelola rilis katalog utama.',
    },
    {
      id: 2,
      name: 'Sinta Wijaya',
      username: 'sinta.ed',
      email: 'sinta.ed@tiraiplay.example',
      role: 'editor',
      department: 'Tim Editorial & Sub',
      phone: '+62 813-2201-8840',
      twoFactorEnabled: true,
      joinedAt: '2025-03-04',
      status: 'Aktif',
      lastActive: '12 mnt lalu',
      notes: 'Editor drama kategori CEO & Romance.',
    },
    {
      id: 3,
      name: 'Bima Kusuma',
      username: 'bima.ed',
      email: 'bima.ed@tiraiplay.example',
      role: 'editor',
      department: 'Tim Editorial & Sub',
      phone: '+62 815-9902-3310',
      twoFactorEnabled: false,
      joinedAt: '2025-06-19',
      status: 'Aktif',
      lastActive: '2 jam lalu',
      notes: 'Mengelola metadata aksi, silat & jadwal mingguan.',
    },
    {
      id: 4,
      name: 'Clara Tan',
      username: 'clara.mod',
      email: 'clara.mod@tiraiplay.example',
      role: 'editor',
      department: 'Moderasi Komunitas',
      phone: '+62 818-4510-2209',
      twoFactorEnabled: true,
      joinedAt: '2025-09-10',
      status: 'Aktif',
      lastActive: '35 mnt lalu',
      notes: 'PIC moderasi komentar & tiket DMCA harian.',
    },
    {
      id: 5,
      name: 'Dewi Anggraini',
      username: 'dewi.legal',
      email: 'dewi.legal@tiraiplay.example',
      role: 'admin',
      department: 'Legal & Kepatuhan',
      phone: '+62 811-7780-9012',
      twoFactorEnabled: true,
      joinedAt: '2025-02-15',
      status: 'Aktif',
      lastActive: '1 jam lalu',
      notes: 'Review pemberitahuan DMCA & atribusi platform sumber.',
    },
    {
      id: 6,
      name: 'Nadia C.',
      username: 'nadia.viewer',
      email: 'nadia@mail.example',
      role: 'user',
      department: 'Komunitas Penonton',
      twoFactorEnabled: false,
      joinedAt: '2026-02-01',
      status: 'Aktif',
      lastActive: '5 mnt lalu',
      notes: 'Kontributor aktif request drama sub ID.',
    },
    {
      id: 7,
      name: 'Kevin W.',
      username: 'kevin.w',
      email: 'kevin@mail.example',
      role: 'user',
      department: 'Komunitas Penonton',
      twoFactorEnabled: false,
      joinedAt: '2026-04-22',
      status: 'Menunggu Verifikasi',
      lastActive: '1 hari lalu',
      notes: 'Menunggu verifikasi email untuk akses komentar prioritas.',
    },
    {
      id: 8,
      name: 'PromoBot_99',
      username: 'promobot99',
      email: 'spam.acc@mail.example',
      role: 'user',
      department: 'Komunitas Penonton',
      twoFactorEnabled: false,
      joinedAt: '2026-10-03',
      status: 'Ditangguhkan',
      lastActive: '3 hari lalu',
      notes: 'Akun ditangguhkan karena pelanggaran spam berulang.',
    },
  ]);

  readonly activityLog = signal<CmsActivityEntry[]>([
    { time: '07:20', actor: 'Sinta (Editor)', action: 'Memperbarui Ep 74 pada Dituduh Membunuh Anakku Sendiri' },
    { time: '06:55', actor: 'Rama (Admin)', action: 'Mengaktifkan Hero Spotlight untuk Singgasana Bayangan' },
    { time: 'Kemarin', actor: 'Sinta (Editor)', action: 'Mengubah status request Dokter Jenius di Tahun 1990 menjadi Terjadwal' },
  ]);

  private get isRemote(): boolean {
    return this.auth.apiReachable() && this.auth.isAuthenticated();
  }

  can(perm: CmsPermission): boolean {
    if (this.isRemote) {
      return this.auth.permissions()[perm];
    }
    return this.rolePermissions()[this.role()][perm];
  }

  async loadAdminData(): Promise<void> {
    if (!this.isRemote || !this.can('viewAdmin')) return;

    const tasks: Array<Promise<void>> = [
      firstValueFrom(
        this.http.get<{
          activityLog: Array<{ time: string; actor: string; action: string }>;
        }>('/api/admin/dashboard'),
      )
        .then((res) => {
          if (Array.isArray(res?.activityLog) && res.activityLog.length) {
            this.activityLog.set(
              res.activityLog.map((l) => ({
                time: l.time.slice(11, 16) || l.time,
                actor: l.actor,
                action: l.action,
              })),
            );
          }
        })
        .catch(() => undefined),

      firstValueFrom(
        this.http.get<
          Array<{
            id: string;
            dramaId: string;
            dramaSlug: string;
            dayName: string;
            timeWib: string;
            episodeNumber: number;
            note: string | null;
            status: 'Terjadwal' | 'Tayang' | 'Ditunda';
          }>
        >('/api/schedule'),
      )
        .then((rows) => {
          if (Array.isArray(rows)) {
            this.scheduleSlots.set(
              rows.map((r) => ({
                id: r.id,
                day: r.dayName,
                time: r.timeWib,
                dramaId: r.dramaId,
                dramaSlug: r.dramaSlug,
                ep: r.episodeNumber,
                note: r.note ?? undefined,
                status: r.status,
              })),
            );
          }
        })
        .catch(() => undefined),

      firstValueFrom(
        this.http.get<
          Array<{
            id: string;
            title: string;
            platformName: string;
            lang: 'ID' | 'EN';
            requesterEmail: string;
            priority: 'Tinggi' | 'Normal' | 'Rendah';
            episodeCount: number | null;
            note: string;
            status: 'Ditinjau' | 'Terjadwal' | 'Tersedia' | 'Ditolak';
            votesCount: number;
            createdAt: string;
          }>
        >('/api/requests'),
      )
        .then((rows) => {
          if (Array.isArray(rows)) {
            this.requests.set(
              rows.map((r) => ({
                id: r.id,
                title: r.title,
                platform: r.platformName,
                lang: r.lang,
                requester: r.requesterEmail,
                priority: r.priority,
                episodeCount: r.episodeCount ?? undefined,
                note: r.note,
                status: r.status,
                votes: r.votesCount,
                date: r.createdAt.slice(0, 10),
              })),
            );
          }
        })
        .catch(() => undefined),
    ];

    if (this.can('moderateRequests')) {
      tasks.push(
        firstValueFrom(
          this.http.get<
            Array<{
              id: string;
              dramaId: string;
              episodeNumber: number;
              authorName: string;
              body: string;
              flagReason: CmsCommentItem['flagReason'];
              likesCount: number;
              adminReply: string | null;
              status: CmsCommentItem['status'];
              createdAt: string;
            }>
          >('/api/admin/comments'),
        )
          .then((rows) => {
            if (Array.isArray(rows)) {
              this.comments.set(
                rows.map((c) => ({
                  id: c.id,
                  drama: c.dramaId,
                  ep: c.episodeNumber,
                  author: c.authorName,
                  body: c.body,
                  flagReason: c.flagReason,
                  likes: c.likesCount,
                  adminReply: c.adminReply ?? undefined,
                  status: c.status,
                  time: c.createdAt.slice(0, 10),
                })),
              );
            }
          })
          .catch(() => undefined),

        firstValueFrom(
          this.http.get<
            Array<{
              id: string;
              ticketCode: string;
              target: string;
              senderEmail: string;
              type: string;
              priority: 'Tinggi' | 'Normal' | 'Rendah';
              evidenceUrl: string | null;
              resolutionNote: string | null;
              status: CmsDmcaTicket['status'];
              createdAt: string;
            }>
          >('/api/admin/tickets'),
        )
          .then((rows) => {
            if (Array.isArray(rows)) {
              this.dmcaTickets.set(
                rows.map((t) => ({
                  id: t.id,
                  target: t.target,
                  sender: t.senderEmail,
                  type: t.type,
                  priority: t.priority,
                  evidenceUrl: t.evidenceUrl ?? undefined,
                  resolutionNote: t.resolutionNote ?? undefined,
                  status: t.status,
                  date: t.createdAt.slice(0, 10),
                })),
              );
            }
          })
          .catch(() => undefined),
      );
    }

    if (this.can('manageUsers')) {
      tasks.push(
        firstValueFrom(
          this.http.get<
            Array<{
              id: string;
              name: string;
              username: string;
              email: string;
              role: CmsRole;
              department: string;
              phone: string | null;
              twoFactorEnabled: boolean;
              createdAt: string;
              status: CmsUserStatus;
              lastActiveAt: string | null;
              notes: string | null;
            }>
          >('/api/admin/users'),
        )
          .then((rows) => {
            if (Array.isArray(rows)) {
              this.users.set(
                rows.map((u) => ({
                  id: u.id,
                  name: u.name,
                  username: u.username || u.email.split('@')[0],
                  email: u.email,
                  role: u.role,
                  department: u.department,
                  phone: u.phone ?? undefined,
                  twoFactorEnabled: u.twoFactorEnabled,
                  joinedAt: u.createdAt.slice(0, 10),
                  status: u.status,
                  lastActive: u.lastActiveAt ? u.lastActiveAt.slice(0, 10) : 'Baru',
                  notes: u.notes ?? undefined,
                })),
              );
            }
          })
          .catch(() => undefined),

        firstValueFrom(this.http.get<Record<CmsRole, CmsRolePermissions>>('/api/admin/rbac'))
          .then((matrix) => {
            if (matrix?.admin) this.rolePermissions.set(matrix);
          })
          .catch(() => undefined),
      );
    }

    if (this.can('manageSettings')) {
      tasks.push(
        firstValueFrom(
          this.http.get<{
            siteAnnouncement: string;
            maintenanceMode: boolean;
            defaultVideoLang: 'id' | 'en';
            defaultQuality: '1080p' | '720p';
            autoModerateComments: boolean;
            playerWatermark: boolean;
            supportEmail: string;
            dmcaEmail: string;
            cdnBaseUrl: string;
            freeDailyEpisodeLimit: number;
            guestDailyEpisodeLimit: number;
          }>('/api/admin/settings'),
        )
          .then((s) => {
            if (!s) return;
            this.siteAnnouncement.set(s.siteAnnouncement);
            this.maintenanceMode.set(s.maintenanceMode);
            this.defaultVideoLang.set(s.defaultVideoLang);
            this.defaultQuality.set(s.defaultQuality);
            this.autoModerateComments.set(s.autoModerateComments);
            this.playerWatermark.set(s.playerWatermark);
            this.supportEmail.set(s.supportEmail);
            this.dmcaEmail.set(s.dmcaEmail);
            this.cdnBaseUrl.set(s.cdnBaseUrl);
            this.freeDailyEpisodeLimit.set(s.freeDailyEpisodeLimit);
            this.guestDailyEpisodeLimit.set(s.guestDailyEpisodeLimit);
          })
          .catch(() => undefined),
      );
    }

    await Promise.all(tasks);
  }

  async loadEpisodesFromApi(dramaId: string): Promise<void> {
    if (!this.isRemote || !this.can('editEpisodes')) return;
    try {
      const rows = await firstValueFrom(
        this.http.get<
          Array<{
            number: number;
            title: string;
            durationMinutes: number;
            airDate: string | null;
            status: 'Tayang' | 'Draft';
            streams: Array<{
              videoLang: 'id' | 'en';
              streamUrl: string;
              subtitleUrl: string | null;
            }>;
          }>
        >(`/api/admin/dramas/${dramaId}/episodes`),
      );
      if (Array.isArray(rows) && rows.length > 0) {
        const mapped: CmsEpisodeItem[] = rows.map((ep) => {
          const stream = ep.streams[0];
          return {
            number: ep.number,
            title: ep.title,
            durationMinutes: ep.durationMinutes,
            airDate: ep.airDate ?? '',
            streamUrl: stream?.streamUrl ?? '',
            subtitleUrl: stream?.subtitleUrl ?? undefined,
            videoLang: stream?.videoLang ?? 'id',
            status: ep.status,
          };
        });
        this.episodesByDrama.update((map) => ({ ...map, [dramaId]: mapped }));
      }
    } catch {
      /* fallback to local episode builder */
    }
  }

  async saveSettingsToApi(): Promise<boolean> {
    if (!this.isRemote || !this.can('manageSettings')) return true;
    try {
      await firstValueFrom(
        this.http.put('/api/admin/settings', {
          siteAnnouncement: this.siteAnnouncement(),
          maintenanceMode: this.maintenanceMode(),
          defaultVideoLang: this.defaultVideoLang(),
          defaultQuality: this.defaultQuality(),
          autoModerateComments: this.autoModerateComments(),
          playerWatermark: this.playerWatermark(),
          supportEmail: this.supportEmail(),
          dmcaEmail: this.dmcaEmail(),
          cdnBaseUrl: this.cdnBaseUrl(),
          freeDailyEpisodeLimit: this.freeDailyEpisodeLimit(),
          guestDailyEpisodeLimit: this.guestDailyEpisodeLimit(),
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async exportCatalogFromApi(): Promise<unknown | null> {
    if (!this.isRemote || !this.can('manageSettings')) return null;
    try {
      return await firstValueFrom(this.http.get('/api/admin/catalog/export'));
    } catch {
      return null;
    }
  }

  roleMeta(r: CmsRole = this.role()) {
    return ROLE_META[r];
  }

  setRole(role: CmsRole): void {
    this.role.set(role);
  }

  updateRolePermission(role: CmsRole, perm: CmsPermission, value: boolean): void {
    this.rolePermissions.update((map) => ({
      ...map,
      [role]: { ...map[role], [perm]: value },
    }));
    if (this.isRemote && this.can('manageUsers')) {
      void firstValueFrom(
        this.http.put('/api/admin/rbac', { matrix: this.rolePermissions() }),
      )
        .then(() => this.auth.refreshSession())
        .catch(() => undefined);
    }
  }

  resetRolePermissions(): void {
    this.rolePermissions.set(structuredClone(ROLE_PERMISSIONS));
    if (this.isRemote && this.can('manageUsers')) {
      void firstValueFrom(this.http.put('/api/admin/rbac', { resetDefault: true }))
        .then(() => this.auth.refreshSession())
        .catch(() => undefined);
    }
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
    this.activityLog.update((list) => [{ time, actor, action }, ...list].slice(0, 12));
  }

  private buildSyncedEpisodes(
    drama: Drama,
    existing: readonly CmsEpisodeItem[] = [],
    initialStreamUrl?: string,
  ): CmsEpisodeItem[] {
    const total = Math.min(500, Math.max(1, drama.totalEpisodes ?? 1, drama.latestEpisode ?? 1));
    const published = Math.min(total, Math.max(0, drama.latestEpisode ?? total));
    const defaultLang = drama.videoLanguages[0] ?? 'id';
    const defaultDuration = drama.durationMinutes ?? 1;
    const defaultAirDate = drama.releaseDate || `${drama.releaseYear ?? 2026}-11-18`;
    const slugPrefix = (drama.slug || drama.id || 'drama').slice(0, 14);

    const byNum = new Map<number, CmsEpisodeItem>();
    for (const seed of this.initialEpisodeOverrides[drama.id] ?? []) {
      byNum.set(seed.number, seed);
    }
    for (const dep of drama.episodes ?? []) {
      byNum.set(dep.number, {
        number: dep.number,
        title: dep.title || `Episode ${dep.number}`,
        durationMinutes: dep.durationMinutes ?? defaultDuration,
        airDate: dep.airDate ?? defaultAirDate,
        streamUrl: dep.streamUrl ?? `${this.cdnBaseUrl()}/${slugPrefix}-ep${dep.number}.m3u8`,
        subtitleUrl: dep.subtitleUrl,
        videoLang: defaultLang,
        status: dep.status ?? (dep.number <= published ? 'Tayang' : 'Draft'),
      });
    }
    for (const cur of existing) {
      byNum.set(cur.number, {
        ...cur,
        status: cur.number <= published ? 'Tayang' : cur.status,
      });
    }

    const result: CmsEpisodeItem[] = [];
    for (let n = total; n >= 1; n--) {
      const prev = byNum.get(n);
      const customStream =
        n === published && initialStreamUrl?.trim() ? initialStreamUrl.trim() : undefined;
      result.push(
        prev
          ? {
              ...prev,
              streamUrl: customStream ?? prev.streamUrl,
            }
          : {
              number: n,
              title: `Episode ${n}`,
              durationMinutes: defaultDuration,
              airDate: defaultAirDate,
              streamUrl: customStream ?? `${this.cdnBaseUrl()}/${slugPrefix}-ep${n}.m3u8`,
              videoLang: defaultLang,
              status: n <= published ? 'Tayang' : 'Draft',
            },
      );
    }
    for (const [num, extra] of byNum) {
      if (num > total) result.push(extra);
    }
    return result.sort((a, b) => b.number - a.number);
  }

  getEpisodesForDrama(drama: Drama): CmsEpisodeItem[] {
    const map = this.episodesByDrama();
    if (map[drama.id]) return map[drama.id];
    return this.buildSyncedEpisodes(drama);
  }

  syncEpisodesFromDrama(drama: Drama, initialStreamUrl?: string): CmsEpisodeItem[] {
    const existing = this.episodesByDrama()[drama.id] ?? [];
    const synced = this.buildSyncedEpisodes(drama, existing, initialStreamUrl);
    this.episodesByDrama.update((map) => ({ ...map, [drama.id]: synced }));
    return synced;
  }

  addEpisode(dramaOrId: Drama | string, item: CmsEpisodeItem): void {
    const dramaId = typeof dramaOrId === 'string' ? dramaOrId : dramaOrId.id;
    const base =
      typeof dramaOrId === 'string'
        ? this.episodesByDrama()[dramaId] ?? []
        : this.getEpisodesForDrama(dramaOrId);
    const next = [item, ...base.filter((e) => e.number !== item.number)].sort(
      (a, b) => b.number - a.number,
    );
    this.episodesByDrama.update((map) => ({ ...map, [dramaId]: next }));

    if (this.isRemote && this.can('editEpisodes')) {
      void firstValueFrom(
        this.http.post(`/api/admin/dramas/${dramaId}/episodes`, {
          number: item.number,
          title: item.title,
          durationMinutes: item.durationMinutes,
          airDate: item.airDate || null,
          videoLang: item.videoLang ?? 'id',
          streamUrl: item.streamUrl,
          subtitleUrl: item.subtitleUrl ?? null,
          status: item.status,
        }),
      ).catch(() => undefined);
    }
  }

  updateEpisode(drama: Drama, oldNumber: number, item: CmsEpisodeItem): void {
    const current = this.getEpisodesForDrama(drama).filter(
      (e) => e.number !== oldNumber && e.number !== item.number,
    );
    this.episodesByDrama.update((map) => ({
      ...map,
      [drama.id]: [item, ...current].sort((a, b) => b.number - a.number),
    }));

    if (this.isRemote && this.can('editEpisodes')) {
      void firstValueFrom(
        this.http.post(`/api/admin/dramas/${drama.id}/episodes`, {
          number: item.number,
          title: item.title,
          durationMinutes: item.durationMinutes,
          airDate: item.airDate || null,
          videoLang: item.videoLang ?? 'id',
          streamUrl: item.streamUrl,
          subtitleUrl: item.subtitleUrl ?? null,
          status: item.status,
        }),
      ).catch(() => undefined);
    }
  }

  deleteEpisode(drama: Drama, epNumber: number): void {
    const next = this.getEpisodesForDrama(drama).filter((e) => e.number !== epNumber);
    this.episodesByDrama.update((map) => ({ ...map, [drama.id]: next }));
    if (this.isRemote && this.can('editEpisodes')) {
      void firstValueFrom(
        this.http.delete(`/api/admin/dramas/${drama.id}/episodes/${epNumber}`),
      ).catch(() => undefined);
    }
  }

  toggleEpisodeStatus(drama: Drama, epNumber: number): void {
    const list = this.getEpisodesForDrama(drama).map((e) =>
      e.number === epNumber ? { ...e, status: e.status === 'Tayang' ? ('Draft' as const) : ('Tayang' as const) } : e,
    );
    this.episodesByDrama.update((map) => ({ ...map, [drama.id]: list }));
    if (this.isRemote && this.can('editEpisodes')) {
      void firstValueFrom(
        this.http.patch(`/api/admin/dramas/${drama.id}/episodes/${epNumber}/status`, {}),
      ).catch(() => undefined);
    }
  }

  private dayToNumber(day: string): number {
    const idx = SCHEDULE_DAYS.indexOf(day as (typeof SCHEDULE_DAYS)[number]);
    // SCHEDULE_DAYS starts at Senin (1) .. Minggu (0)
    return idx === -1 ? 1 : (idx + 1) % 7;
  }

  addScheduleSlot(slot: Omit<CmsScheduleSlot, 'id'>): void {
    const tempId = Date.now();
    this.scheduleSlots.update((list) => [{ id: tempId, status: 'Terjadwal', ...slot }, ...list]);
    if (this.isRemote && this.can('editTaxonomy')) {
      void firstValueFrom(
        this.http.post<{ id: string }>('/api/admin/schedule', {
          dramaId: slot.dramaId,
          dayOfWeek: this.dayToNumber(slot.day),
          timeWib: slot.time,
          episodeNumber: slot.ep,
          note: slot.note ?? null,
          status: slot.status ?? 'Terjadwal',
        }),
      )
        .then((created) => {
          if (created?.id) {
            this.scheduleSlots.update((list) =>
              list.map((s) => (s.id === tempId ? { ...s, id: created.id } : s)),
            );
          }
        })
        .catch(() => undefined);
    }
  }

  updateScheduleSlot(id: string | number, patch: Partial<Omit<CmsScheduleSlot, 'id'>>): void {
    this.scheduleSlots.update((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (this.isRemote && this.can('editTaxonomy') && typeof id === 'string') {
      const current = this.scheduleSlots().find((s) => s.id === id);
      if (!current) return;
      void firstValueFrom(
        this.http.put(`/api/admin/schedule/${id}`, {
          dramaId: current.dramaId,
          dayOfWeek: this.dayToNumber(current.day),
          timeWib: current.time,
          episodeNumber: current.ep,
          note: current.note ?? null,
          status: current.status ?? 'Terjadwal',
        }),
      ).catch(() => undefined);
    }
  }

  removeScheduleSlot(id: string | number): void {
    this.scheduleSlots.update((list) => list.filter((x) => x.id !== id));
    if (this.isRemote && this.can('editTaxonomy') && typeof id === 'string') {
      void firstValueFrom(this.http.delete(`/api/admin/schedule/${id}`)).catch(() => undefined);
    }
  }

  addRequest(
    req: Omit<CmsDramaRequest, 'id' | 'date'> & { date?: string },
  ): void {
    const tempId = Date.now();
    this.requests.update((list) => [
      {
        id: tempId,
        date: req.date ?? new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
        ...req,
      },
      ...list,
    ]);
    if (this.isRemote) {
      void firstValueFrom(
        this.http.post<{ id: string }>('/api/requests', {
          title: req.title,
          platformName: req.platform,
          lang: req.lang,
          episodeCount: req.episodeCount,
          note: req.note,
        }),
      )
        .then((created) => {
          if (created?.id) {
            this.requests.update((list) =>
              list.map((r) => (r.id === tempId ? { ...r, id: created.id } : r)),
            );
          }
        })
        .catch(() => undefined);
    }
  }

  updateRequest(id: string | number, patch: Partial<Omit<CmsDramaRequest, 'id'>>): void {
    this.requests.update((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    if (this.isRemote && this.can('moderateRequests') && typeof id === 'string') {
      void firstValueFrom(
        this.http.patch(`/api/admin/requests/${id}`, {
          title: patch.title,
          platformName: patch.platform,
          lang: patch.lang,
          priority: patch.priority,
          status: patch.status,
          episodeCount: patch.episodeCount,
          note: patch.note,
        }),
      ).catch(() => undefined);
    }
  }

  updateRequestStatus(id: string | number, status: CmsDramaRequest['status']): void {
    this.updateRequest(id, { status });
  }

  deleteRequest(id: string | number): void {
    this.requests.update((list) => list.filter((r) => r.id !== id));
    if (this.isRemote && this.can('moderateRequests') && typeof id === 'string') {
      void firstValueFrom(this.http.delete(`/api/admin/requests/${id}`)).catch(() => undefined);
    }
  }

  updateComment(id: string | number, patch: Partial<Omit<CmsCommentItem, 'id'>>): void {
    this.comments.update((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    if (this.isRemote && this.can('moderateRequests') && typeof id === 'string') {
      void firstValueFrom(
        this.http.patch(`/api/admin/comments/${id}`, {
          body: patch.body,
          status: patch.status,
          flagReason: patch.flagReason,
          adminReply: patch.adminReply ?? null,
        }),
      ).catch(() => undefined);
    }
  }

  toggleCommentVisibility(id: string | number): void {
    const current = this.comments().find((c) => c.id === id);
    if (!current) return;
    const nextStatus = current.status === 'Tampil' ? ('Disembunyikan' as const) : ('Tampil' as const);
    this.updateComment(id, { status: nextStatus });
  }

  deleteComment(id: string | number): void {
    this.comments.update((list) => list.filter((c) => c.id !== id));
    if (this.isRemote && this.can('moderateRequests') && typeof id === 'string') {
      void firstValueFrom(this.http.delete(`/api/admin/comments/${id}`)).catch(() => undefined);
    }
  }

  addTicket(ticket: Omit<CmsDmcaTicket, 'id' | 'date'> & { id?: string; date?: string }): void {
    const code = ticket.id?.trim() || `DMCA-${Math.floor(300 + Math.random() * 699)}`;
    const date =
      ticket.date ?? new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    this.dmcaTickets.update((list) => [{ ...ticket, id: code, date }, ...list]);
    if (this.isRemote && this.can('moderateRequests')) {
      void firstValueFrom(
        this.http.post<{ id: string }>('/api/admin/tickets', {
          target: ticket.target,
          senderEmail: ticket.sender,
          type: ticket.type,
          priority: ticket.priority,
          status: ticket.status,
          evidenceUrl: ticket.evidenceUrl ?? null,
          resolutionNote: ticket.resolutionNote ?? null,
        }),
      )
        .then((created) => {
          if (created?.id) {
            this.dmcaTickets.update((list) =>
              list.map((t) => (t.id === code ? { ...t, id: created.id } : t)),
            );
          }
        })
        .catch(() => undefined);
    }
  }

  updateTicket(id: string, patch: Partial<Omit<CmsDmcaTicket, 'id'>>): void {
    this.dmcaTickets.update((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    if (this.isRemote && this.can('moderateRequests')) {
      void firstValueFrom(
        this.http.patch(`/api/admin/tickets/${id}`, {
          target: patch.target,
          senderEmail: patch.sender,
          type: patch.type,
          priority: patch.priority,
          status: patch.status,
          evidenceUrl: patch.evidenceUrl ?? null,
          resolutionNote: patch.resolutionNote ?? null,
        }),
      ).catch(() => undefined);
    }
  }

  updateTicketStatus(id: string, status: CmsDmcaTicket['status']): void {
    this.updateTicket(id, { status });
  }

  deleteTicket(id: string): void {
    this.dmcaTickets.update((list) => list.filter((t) => t.id !== id));
    if (this.isRemote && this.can('moderateRequests')) {
      void firstValueFrom(this.http.delete(`/api/admin/tickets/${id}`)).catch(() => undefined);
    }
  }

  addUser(payload: {
    name: string;
    username?: string;
    email: string;
    role: CmsRole;
    department?: string;
    phone?: string;
    twoFactorEnabled?: boolean;
    status?: CmsUserStatus;
    notes?: string;
  }): void {
    if (!this.can('manageUsers')) return;
    const username =
      payload.username?.trim() ||
      payload.email.split('@')[0]?.replace(/[^a-z0-9._-]/gi, '').toLowerCase() ||
      'user';
    const tempId = Date.now();
    this.users.update((list) => [
      {
        id: tempId,
        name: payload.name.trim(),
        username,
        email: payload.email.trim(),
        role: payload.role,
        department: payload.department?.trim() || 'Tim Editorial & Sub',
        phone: payload.phone?.trim() || undefined,
        twoFactorEnabled: Boolean(payload.twoFactorEnabled),
        joinedAt: new Date().toISOString().slice(0, 10),
        status: payload.status ?? 'Aktif',
        lastActive: 'Baru dibuat',
        notes: payload.notes?.trim() || undefined,
      },
      ...list,
    ]);
    if (this.isRemote) {
      void firstValueFrom(
        this.http.post<{ id: string }>('/api/admin/users', {
          name: payload.name.trim(),
          username,
          email: payload.email.trim(),
          role: payload.role,
          department: payload.department?.trim() || 'Tim Editorial & Sub',
          phone: payload.phone?.trim() || null,
          twoFactorEnabled: Boolean(payload.twoFactorEnabled),
          status: payload.status ?? 'Aktif',
          notes: payload.notes?.trim() || null,
        }),
      )
        .then((created) => {
          if (created?.id) {
            this.users.update((list) =>
              list.map((u) => (u.id === tempId ? { ...u, id: created.id } : u)),
            );
          }
        })
        .catch(() => undefined);
    }
  }

  updateUser(id: string | number, patch: Partial<Omit<CmsUserAccount, 'id'>>): void {
    if (!this.can('manageUsers')) return;
    this.users.update((list) => list.map((u) => (u.id === id ? { ...u, ...patch } : u)));
    if (this.isRemote && typeof id === 'string') {
      void firstValueFrom(
        this.http.patch(`/api/admin/users/${id}`, {
          name: patch.name,
          username: patch.username,
          email: patch.email,
          role: patch.role,
          department: patch.department,
          phone: patch.phone ?? null,
          twoFactorEnabled: patch.twoFactorEnabled,
          status: patch.status,
          notes: patch.notes ?? null,
        }),
      ).catch(() => undefined);
    }
  }

  deleteUser(id: string | number): void {
    if (!this.can('manageUsers')) return;
    this.users.update((list) => list.filter((u) => u.id !== id));
    if (this.isRemote && typeof id === 'string') {
      void firstValueFrom(this.http.delete(`/api/admin/users/${id}`)).catch(() => undefined);
    }
  }

  changeUserRole(id: string | number, role: CmsRole): void {
    this.updateUser(id, { role });
  }

  toggleUserStatus(id: string | number): void {
    const target = this.users().find((u) => u.id === id);
    if (!target) return;
    this.updateUser(id, { status: target.status === 'Aktif' ? 'Ditangguhkan' : 'Aktif' });
  }
}
