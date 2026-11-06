CREATE TABLE IF NOT EXISTS ders_programlari (
  program_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  okul_id VARCHAR(20) NOT NULL,
  uygulama_okul_id VARCHAR(191) NOT NULL,
  guncellenme_zamani DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (program_id),
  UNIQUE KEY uq_ders_programlari_okul (okul_id),
  UNIQUE KEY uq_ders_programlari_uygulama_okul (uygulama_okul_id),
  CONSTRAINT fk_ders_programlari_okul FOREIGN KEY (okul_id)
    REFERENCES okullar (okul_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ders_programi_atamalari (
  atama_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  program_id BIGINT UNSIGNED NOT NULL,
  gorunum_turu VARCHAR(10) NOT NULL,
  hedef_id VARCHAR(191) NOT NULL,
  gun VARCHAR(30) NOT NULL,
  ders_saati SMALLINT UNSIGNED NOT NULL,
  sira_no SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  kayit_id VARCHAR(191) NULL,
  ders_id VARCHAR(191) NULL,
  ders_adi VARCHAR(255) NULL,
  ad VARCHAR(255) NULL,
  konu VARCHAR(255) NULL,
  ogretmen_id VARCHAR(191) NULL,
  ikinci_ogretmen_id VARCHAR(191) NULL,
  ogretmen_adi VARCHAR(255) NULL,
  ikinci_ogretmen_adi VARCHAR(255) NULL,
  orijinal_ogretmen_id VARCHAR(191) NULL,
  orijinal_ikinci_ogretmen_id VARCHAR(191) NULL,
  orijinal_ogretmen_adi VARCHAR(255) NULL,
  orijinal_ikinci_ogretmen_adi VARCHAR(255) NULL,
  sinif_id VARCHAR(191) NULL,
  sinif_adi VARCHAR(191) NULL,
  kayit_turu VARCHAR(80) NULL,
  grup_adi VARCHAR(191) NULL,
  haftalik_saat SMALLINT NULL,
  bolunmus_grup_id VARCHAR(191) NULL,
  blok_id VARCHAR(191) NULL,
  blok_suresi SMALLINT NULL,
  blok_sirasi SMALLINT NULL,
  bolunemez_iki_saat TINYINT(1) NULL,
  program_motoru VARCHAR(80) NULL,
  taslak_program TINYINT(1) NULL,
  taslak_modu VARCHAR(80) NULL,
  ortak_ders_anahtari VARCHAR(191) NULL,
  ders_sirasi SMALLINT NULL,
  elle_eklendi TINYINT(1) NULL,
  kilitli TINYINT(1) NULL,
  ortak_ders TINYINT(1) NULL,
  ortak_secmeli TINYINT(1) NULL,
  PRIMARY KEY (atama_id),
  UNIQUE KEY uq_ders_programi_atama_yeri (program_id, gorunum_turu, hedef_id, gun, ders_saati, sira_no),
  KEY idx_ders_programi_atama_ders (program_id, ders_adi),
  KEY idx_ders_programi_atama_ogretmen (program_id, ogretmen_id, ogretmen_adi),
  CONSTRAINT fk_ders_programi_atama_program FOREIGN KEY (program_id)
    REFERENCES ders_programlari (program_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ders_programi_hedef_gruplari (
  atama_id BIGINT UNSIGNED NOT NULL,
  sira_no SMALLINT UNSIGNED NOT NULL,
  hedef_grup VARCHAR(80) NOT NULL,
  PRIMARY KEY (atama_id, sira_no),
  CONSTRAINT fk_ders_programi_hedef_grup_atama FOREIGN KEY (atama_id)
    REFERENCES ders_programi_atamalari (atama_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ders_programi_ogrencileri (
  atama_id BIGINT UNSIGNED NOT NULL,
  sira_no SMALLINT UNSIGNED NOT NULL,
  ogrenci_id VARCHAR(191) NOT NULL,
  PRIMARY KEY (atama_id, sira_no),
  KEY idx_ders_programi_ogrenci (ogrenci_id),
  CONSTRAINT fk_ders_programi_ogrenci_atama FOREIGN KEY (atama_id)
    REFERENCES ders_programi_atamalari (atama_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ders_programi_kapali_saatleri (
  program_id BIGINT UNSIGNED NOT NULL,
  hedef_turu VARCHAR(10) NOT NULL,
  hedef_id VARCHAR(191) NOT NULL,
  gun VARCHAR(30) NOT NULL,
  ders_saati SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (program_id, hedef_turu, hedef_id, gun, ders_saati),
  CONSTRAINT fk_ders_programi_kapali_program FOREIGN KEY (program_id)
    REFERENCES ders_programlari (program_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
