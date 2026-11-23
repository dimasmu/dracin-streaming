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
  subtitleUrl?: string;
  videoLang?: 'id' | 'en';
  status: 'Tayang' | 'Draft';
}

export interface CmsScheduleSlot {
  id: number;
  day: string;
  time: string;
  dramaId: string;
  dramaSlug?: string;
  ep: number;
  note?: string;
  status?: 'Terjadwal' | 'Tayang' | 'Ditunda';
}

export interface CmsDramaRequest {
  id: number;
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
  id: number;
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
  id: number;
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

  can(perm: CmsPermission): boolean {
    return this.rolePermissions()[this.role()][perm];
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
  }

  resetRolePermissions(): void {
    this.rolePermissions.set(structuredClone(ROLE_PERMISSIONS));
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
  }

  updateEpisode(drama: Drama, oldNumber: number, item: CmsEpisodeItem): void {
    const current = this.getEpisodesForDrama(drama).filter(
      (e) => e.number !== oldNumber && e.number !== item.number,
    );
    this.episodesByDrama.update((map) => ({
      ...map,
      [drama.id]: [item, ...current].sort((a, b) => b.number - a.number),
    }));
  }

  deleteEpisode(drama: Drama, epNumber: number): void {
    const next = this.getEpisodesForDrama(drama).filter((e) => e.number !== epNumber);
    this.episodesByDrama.update((map) => ({ ...map, [drama.id]: next }));
  }

  toggleEpisodeStatus(drama: Drama, epNumber: number): void {
    const list = this.getEpisodesForDrama(drama).map((e) =>
      e.number === epNumber ? { ...e, status: e.status === 'Tayang' ? ('Draft' as const) : ('Tayang' as const) } : e,
    );
    this.episodesByDrama.update((map) => ({ ...map, [drama.id]: list }));
  }

  addScheduleSlot(slot: Omit<CmsScheduleSlot, 'id'>): void {
    this.scheduleSlots.update((list) => [{ id: Date.now(), status: 'Terjadwal', ...slot }, ...list]);
  }

  updateScheduleSlot(id: number, patch: Partial<Omit<CmsScheduleSlot, 'id'>>): void {
    this.scheduleSlots.update((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  removeScheduleSlot(id: number): void {
    this.scheduleSlots.update((list) => list.filter((x) => x.id !== id));
  }

  addRequest(
    req: Omit<CmsDramaRequest, 'id' | 'date'> & { date?: string },
  ): void {
    this.requests.update((list) => [
      {
        id: Date.now(),
        date: req.date ?? new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
        ...req,
      },
      ...list,
    ]);
  }

  updateRequest(id: number, patch: Partial<Omit<CmsDramaRequest, 'id'>>): void {
    this.requests.update((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  updateRequestStatus(id: number, status: CmsDramaRequest['status']): void {
    this.updateRequest(id, { status });
  }

  deleteRequest(id: number): void {
    this.requests.update((list) => list.filter((r) => r.id !== id));
  }

  updateComment(id: number, patch: Partial<Omit<CmsCommentItem, 'id'>>): void {
    this.comments.update((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
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

  addTicket(ticket: Omit<CmsDmcaTicket, 'id' | 'date'> & { id?: string; date?: string }): void {
    const code = ticket.id?.trim() || `DMCA-${Math.floor(300 + Math.random() * 699)}`;
    const date =
      ticket.date ?? new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    this.dmcaTickets.update((list) => [{ ...ticket, id: code, date }, ...list]);
  }

  updateTicket(id: string, patch: Partial<Omit<CmsDmcaTicket, 'id'>>): void {
    this.dmcaTickets.update((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  updateTicketStatus(id: string, status: CmsDmcaTicket['status']): void {
    this.updateTicket(id, { status });
  }

  deleteTicket(id: string): void {
    this.dmcaTickets.update((list) => list.filter((t) => t.id !== id));
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
    this.users.update((list) => [
      {
        id: Date.now(),
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
  }

  updateUser(id: number, patch: Partial<Omit<CmsUserAccount, 'id'>>): void {
    if (!this.can('manageUsers')) return;
    this.users.update((list) => list.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }

  deleteUser(id: number): void {
    if (!this.can('manageUsers')) return;
    this.users.update((list) => list.filter((u) => u.id !== id));
  }

  changeUserRole(id: number, role: CmsRole): void {
    this.updateUser(id, { role });
  }

  toggleUserStatus(id: number): void {
    const target = this.users().find((u) => u.id === id);
    if (!target) return;
    this.updateUser(id, { status: target.status === 'Aktif' ? 'Ditangguhkan' : 'Aktif' });
  }
}
