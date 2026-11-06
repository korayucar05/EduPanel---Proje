CREATE TABLE IF NOT EXISTS okullar (
  okul_id VARCHAR(20) NOT NULL,
  uygulama_okul_id VARCHAR(191) NOT NULL,
  okul_adi VARCHAR(255) NOT NULL,
  aktif TINYINT(1) NOT NULL DEFAULT 1,
  olusturulma_zamani DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  guncellenme_zamani DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (okul_id),
  UNIQUE KEY uq_okullar_uygulama (uygulama_okul_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ogretmenler (
  okul_id VARCHAR(20) NOT NULL,
  ogretmen_id VARCHAR(80) NOT NULL,
  ad_soyad VARCHAR(200) NOT NULL,
  brans VARCHAR(150) NULL,
  e_posta VARCHAR(255) NULL,
  telefon VARCHAR(50) NULL,
  haftalik_ders_saati DECIMAL(8,2) NOT NULL DEFAULT 0,
  durum VARCHAR(40) NOT NULL DEFAULT 'Aktif',
  yonetim_rolu VARCHAR(100) NULL,
  avatar TEXT NULL,
  izin_nedeni TEXT NULL,
  guncellenme_zamani DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (okul_id, ogretmen_id),
  KEY idx_ogretmenler_ad (okul_id, ad_soyad),
  CONSTRAINT fk_ogretmenler_okul FOREIGN KEY (okul_id) REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ogretmen_komisyonlari (
  okul_id VARCHAR(20) NOT NULL,
  ogretmen_id VARCHAR(80) NOT NULL,
  komisyon_adi VARCHAR(191) NOT NULL,
  PRIMARY KEY (okul_id, ogretmen_id, komisyon_adi),
  CONSTRAINT fk_ogretmen_komisyon FOREIGN KEY (okul_id, ogretmen_id)
    REFERENCES ogretmenler (okul_id, ogretmen_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ogretmen_izin_tarihleri (
  okul_id VARCHAR(20) NOT NULL,
  ogretmen_id VARCHAR(80) NOT NULL,
  izin_tarihi DATE NOT NULL,
  PRIMARY KEY (okul_id, ogretmen_id, izin_tarihi),
  CONSTRAINT fk_ogretmen_izin FOREIGN KEY (okul_id, ogretmen_id)
    REFERENCES ogretmenler (okul_id, ogretmen_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS siniflar (
  okul_id VARCHAR(20) NOT NULL,
  sinif_id INT NOT NULL,
  sinif_adi VARCHAR(80) NOT NULL,
  sinif_duzeyi VARCHAR(30) NULL,
  rehber_ogretmen_id VARCHAR(80) NULL,
  psikolojik_danisman_id VARCHAR(80) NULL,
  sorumlu_mudur_yardimcisi VARCHAR(200) NULL,
  aktif TINYINT(1) NOT NULL DEFAULT 1,
  guncellenme_zamani DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (okul_id, sinif_id),
  UNIQUE KEY uq_siniflar_ad (okul_id, sinif_adi),
  KEY idx_sinif_rehber (okul_id, rehber_ogretmen_id),
  KEY idx_sinif_danisman (okul_id, psikolojik_danisman_id),
  CONSTRAINT fk_siniflar_okul FOREIGN KEY (okul_id) REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sinif_gruplari (
  okul_id VARCHAR(20) NOT NULL,
  sinif_id INT NOT NULL,
  grup_adi VARCHAR(150) NOT NULL,
  PRIMARY KEY (okul_id, sinif_id, grup_adi),
  CONSTRAINT fk_sinif_grup FOREIGN KEY (okul_id, sinif_id)
    REFERENCES siniflar (okul_id, sinif_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ogretmen_siniflari (
  okul_id VARCHAR(20) NOT NULL,
  ogretmen_id VARCHAR(80) NOT NULL,
  sinif_id INT NOT NULL,
  PRIMARY KEY (okul_id, ogretmen_id, sinif_id),
  CONSTRAINT fk_ogretmen_sinif_ogretmen FOREIGN KEY (okul_id, ogretmen_id)
    REFERENCES ogretmenler (okul_id, ogretmen_id) ON DELETE CASCADE,
  CONSTRAINT fk_ogretmen_sinif_sinif FOREIGN KEY (okul_id, sinif_id)
    REFERENCES siniflar (okul_id, sinif_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ogrenciler (
  okul_id VARCHAR(20) NOT NULL,
  ogrenci_id VARCHAR(80) NOT NULL,
  okul_numarasi VARCHAR(50) NOT NULL,
  ad_soyad VARCHAR(200) NOT NULL,
  sinif_id INT NULL,
  alan_grubu VARCHAR(100) NULL,
  telefon VARCHAR(50) NULL,
  veli_ad_soyad VARCHAR(200) NULL,
  veli_telefon VARCHAR(50) NULL,
  dogum_tarihi VARCHAR(40) NULL,
  dogum_yeri VARCHAR(150) NULL,
  adres TEXT NULL,
  okul_disinda TINYINT(1) NOT NULL DEFAULT 0,
  durum VARCHAR(40) NOT NULL DEFAULT 'Aktif',
  kayit_tarihi VARCHAR(40) NULL,
  avatar TEXT NULL,
  not_ortalamasi DECIMAL(8,2) NULL,
  devamsizlik DECIMAL(8,2) NULL,
  e_posta VARCHAR(255) NULL,
  guncellenme_zamani DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (okul_id, ogrenci_id),
  UNIQUE KEY uq_ogrenci_numara (okul_id, okul_numarasi),
  KEY idx_ogrenciler_sinif (okul_id, sinif_id),
  KEY idx_ogrenciler_ad (okul_id, ad_soyad),
  CONSTRAINT fk_ogrenciler_okul FOREIGN KEY (okul_id) REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dersler (
  okul_id VARCHAR(20) NOT NULL,
  ders_id VARCHAR(191) NOT NULL,
  ders_adi VARCHAR(255) NOT NULL,
  ders_kodu VARCHAR(80) NULL,
  sinif_id INT NULL,
  birinci_ogretmen_id VARCHAR(80) NULL,
  ikinci_ogretmen_id VARCHAR(80) NULL,
  ogretmen_atamasi_temizlendi TINYINT(1) NOT NULL DEFAULT 0,
  program_aciklamasi TEXT NULL,
  ogrenci_sayisi INT NOT NULL DEFAULT 0,
  haftalik_ders_saati DECIMAL(8,2) NOT NULL DEFAULT 0,
  ders_turu VARCHAR(100) NULL,
  brans VARCHAR(150) NULL,
  eski_birlesik_ders TEXT NULL,
  paralel_grup_id VARCHAR(191) NULL,
  ortak_secmeli TINYINT(1) NOT NULL DEFAULT 0,
  guncellenme_zamani DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (okul_id, ders_id),
  KEY idx_dersler_sinif (okul_id, sinif_id),
  KEY idx_dersler_ogretmen1 (okul_id, birinci_ogretmen_id),
  KEY idx_dersler_ogretmen2 (okul_id, ikinci_ogretmen_id),
  CONSTRAINT fk_dersler_okul FOREIGN KEY (okul_id) REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ders_hedef_gruplari (
  okul_id VARCHAR(20) NOT NULL,
  ders_id VARCHAR(191) NOT NULL,
  grup_adi VARCHAR(150) NOT NULL,
  PRIMARY KEY (okul_id, ders_id, grup_adi),
  CONSTRAINT fk_ders_hedef FOREIGN KEY (okul_id, ders_id)
    REFERENCES dersler (okul_id, ders_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS deneme_kulubu_uyeleri (
  okul_id VARCHAR(20) NOT NULL,
  uyelik_id VARCHAR(191) NOT NULL,
  ogrenci_id VARCHAR(80) NOT NULL,
  aktif TINYINT(1) NOT NULL DEFAULT 1,
  kayit_zamani DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  guncellenme_zamani DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (okul_id, uyelik_id),
  UNIQUE KEY uq_deneme_uye_ogrenci (okul_id, ogrenci_id),
  CONSTRAINT fk_deneme_uye_okul FOREIGN KEY (okul_id) REFERENCES okullar (okul_id) ON DELETE CASCADE,
  CONSTRAINT fk_deneme_uye_ogrenci FOREIGN KEY (okul_id, ogrenci_id)
    REFERENCES ogrenciler (okul_id, ogrenci_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS deneme_kulubu_uye_ogretmenleri (
  okul_id VARCHAR(20) NOT NULL,
  uyelik_id VARCHAR(191) NOT NULL,
  ogretmen_id VARCHAR(80) NOT NULL,
  PRIMARY KEY (okul_id, uyelik_id, ogretmen_id),
  CONSTRAINT fk_deneme_uye_ogretmen_uye FOREIGN KEY (okul_id, uyelik_id)
    REFERENCES deneme_kulubu_uyeleri (okul_id, uyelik_id) ON DELETE CASCADE,
  CONSTRAINT fk_deneme_uye_ogretmen FOREIGN KEY (okul_id, ogretmen_id)
    REFERENCES ogretmenler (okul_id, ogretmen_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS deneme_kulubu_gruplari (
  okul_id VARCHAR(20) NOT NULL,
  grup_id VARCHAR(191) NOT NULL,
  grup_adi VARCHAR(200) NOT NULL,
  sinif_duzeyi VARCHAR(30) NULL,
  aktif TINYINT(1) NOT NULL DEFAULT 1,
  olusturulma_zamani DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  guncellenme_zamani DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (okul_id, grup_id),
  CONSTRAINT fk_deneme_grup_okul FOREIGN KEY (okul_id) REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS deneme_kulubu_grup_uyeleri (
  okul_id VARCHAR(20) NOT NULL,
  grup_id VARCHAR(191) NOT NULL,
  ogrenci_id VARCHAR(80) NOT NULL,
  PRIMARY KEY (okul_id, grup_id, ogrenci_id),
  CONSTRAINT fk_deneme_grup_uye_grup FOREIGN KEY (okul_id, grup_id)
    REFERENCES deneme_kulubu_gruplari (okul_id, grup_id) ON DELETE CASCADE,
  CONSTRAINT fk_deneme_grup_uye_ogrenci FOREIGN KEY (okul_id, ogrenci_id)
    REFERENCES ogrenciler (okul_id, ogrenci_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS deneme_kulubu_grup_ogretmenleri (
  okul_id VARCHAR(20) NOT NULL,
  grup_id VARCHAR(191) NOT NULL,
  ogretmen_id VARCHAR(80) NOT NULL,
  PRIMARY KEY (okul_id, grup_id, ogretmen_id),
  CONSTRAINT fk_deneme_grup_ogretmen_grup FOREIGN KEY (okul_id, grup_id)
    REFERENCES deneme_kulubu_gruplari (okul_id, grup_id) ON DELETE CASCADE,
  CONSTRAINT fk_deneme_grup_ogretmen FOREIGN KEY (okul_id, ogretmen_id)
    REFERENCES ogretmenler (okul_id, ogretmen_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
