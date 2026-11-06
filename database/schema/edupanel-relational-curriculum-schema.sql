CREATE TABLE IF NOT EXISTS ozel_ders_tanimlari (
  okul_id VARCHAR(20) NOT NULL, ders_tanim_id VARCHAR(191) NOT NULL, sinif_seviyesi VARCHAR(20) NULL,
  ders_adi VARCHAR(150) NULL, ders_kodu VARCHAR(80) NULL, kisa_kod VARCHAR(80) NULL,
  haftalik_ders_saati INT NULL, ders_turu VARCHAR(80) NULL, teknik_tur VARCHAR(40) NULL,
  brans VARCHAR(150) NULL, ders_bransi VARCHAR(150) NULL, eski_birlesik_ders VARCHAR(150) NULL,
  ortak_secmeli TINYINT(1) NULL, ogretmen_id VARCHAR(80) NULL, ogretmen_ad_soyad VARCHAR(150) NULL,
  ogretmen_atamasi_temizlendi TINYINT(1) NULL, ders_grubu VARCHAR(100) NULL,
  olusturulma_zamani VARCHAR(40) NULL, veri_guncellenme_zamani VARCHAR(40) NULL,
  guncellenme_zamani VARCHAR(40) NOT NULL,
  PRIMARY KEY (okul_id, ders_tanim_id), KEY idx_ozel_ders_seviye (okul_id, sinif_seviyesi),
  KEY idx_ozel_ders_ad (okul_id, ders_adi),
  CONSTRAINT fk_ozel_ders_okul FOREIGN KEY (okul_id) REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ozel_ders_hedef_gruplari (
  okul_id VARCHAR(20) NOT NULL, ders_tanim_id VARCHAR(191) NOT NULL, sira_no SMALLINT UNSIGNED NOT NULL,
  grup_adi VARCHAR(100) NOT NULL,
  PRIMARY KEY (okul_id, ders_tanim_id, sira_no),
  CONSTRAINT fk_ozel_ders_hedef FOREIGN KEY (okul_id, ders_tanim_id)
    REFERENCES ozel_ders_tanimlari (okul_id, ders_tanim_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ozel_ders_secili_siniflari (
  okul_id VARCHAR(20) NOT NULL, ders_tanim_id VARCHAR(191) NOT NULL, sira_no SMALLINT UNSIGNED NOT NULL,
  sinif_id VARCHAR(80) NOT NULL,
  PRIMARY KEY (okul_id, ders_tanim_id, sira_no), KEY idx_ozel_ders_sinif (okul_id, sinif_id),
  CONSTRAINT fk_ozel_ders_sinif FOREIGN KEY (okul_id, ders_tanim_id)
    REFERENCES ozel_ders_tanimlari (okul_id, ders_tanim_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ozel_ders_sinif_gruplari (
  okul_id VARCHAR(20) NOT NULL, ders_tanim_id VARCHAR(191) NOT NULL,
  sinif_id VARCHAR(80) NOT NULL, sira_no SMALLINT UNSIGNED NOT NULL, grup_adi VARCHAR(100) NOT NULL,
  PRIMARY KEY (okul_id, ders_tanim_id, sinif_id, sira_no),
  CONSTRAINT fk_ozel_ders_sinif_grup FOREIGN KEY (okul_id, ders_tanim_id)
    REFERENCES ozel_ders_tanimlari (okul_id, ders_tanim_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ders_mufredatlari (
  okul_id VARCHAR(20) NOT NULL, mufredat_id VARCHAR(191) NOT NULL, mufredat_anahtari VARCHAR(191) NULL,
  ders_id VARCHAR(80) NULL, sinif_seviyesi VARCHAR(20) NULL, ders_adi VARCHAR(150) NULL,
  kaynak_sinif_seviyesi INT NULL, kaynak_ders_id INT NULL, kaynak_ders_kodu INT NULL,
  kaynak_ders_adi VARCHAR(150) NULL, parmak_izi LONGTEXT NULL, surum INT NULL,
  veri_guncellenme_zamani VARCHAR(40) NULL, guncellenme_zamani VARCHAR(40) NOT NULL,
  PRIMARY KEY (okul_id, mufredat_id), KEY idx_mufredat_ders (okul_id, ders_id, sinif_seviyesi),
  CONSTRAINT fk_mufredat_okul FOREIGN KEY (okul_id) REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mufredat_uniteleri (
  okul_id VARCHAR(20) NOT NULL, mufredat_id VARCHAR(191) NOT NULL, sira_no SMALLINT UNSIGNED NOT NULL,
  unite_id VARCHAR(191) NULL, unite_no INT NULL, unite_adi VARCHAR(255) NULL,
  PRIMARY KEY (okul_id, mufredat_id, sira_no), KEY idx_mufredat_unite_id (okul_id, unite_id),
  CONSTRAINT fk_mufredat_unite FOREIGN KEY (okul_id, mufredat_id)
    REFERENCES ders_mufredatlari (okul_id, mufredat_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mufredat_konulari (
  okul_id VARCHAR(20) NOT NULL, mufredat_id VARCHAR(191) NOT NULL,
  unite_sira_no SMALLINT UNSIGNED NOT NULL, konu_sira_no SMALLINT UNSIGNED NOT NULL,
  konu_id VARCHAR(191) NULL, konu_no INT NULL, konu_adi VARCHAR(255) NULL,
  PRIMARY KEY (okul_id, mufredat_id, unite_sira_no, konu_sira_no),
  KEY idx_mufredat_konu_id (okul_id, konu_id),
  CONSTRAINT fk_mufredat_konu FOREIGN KEY (okul_id, mufredat_id, unite_sira_no)
    REFERENCES mufredat_uniteleri (okul_id, mufredat_id, sira_no) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mufredat_kazanimlari (
  okul_id VARCHAR(20) NOT NULL, mufredat_id VARCHAR(191) NOT NULL,
  unite_sira_no SMALLINT UNSIGNED NOT NULL, konu_sira_no SMALLINT UNSIGNED NOT NULL,
  kazanim_sira_no SMALLINT UNSIGNED NOT NULL, kazanim_id VARCHAR(191) NULL,
  kazanim_kodu VARCHAR(100) NULL, kazanim_no INT NULL, kazanim_adi TEXT NULL,
  PRIMARY KEY (okul_id, mufredat_id, unite_sira_no, konu_sira_no, kazanim_sira_no),
  KEY idx_mufredat_kazanim_id (okul_id, kazanim_id),
  CONSTRAINT fk_mufredat_kazanim FOREIGN KEY (okul_id, mufredat_id, unite_sira_no, konu_sira_no)
    REFERENCES mufredat_konulari (okul_id, mufredat_id, unite_sira_no, konu_sira_no) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS soru_bankasi_sinav_arsivi (
  okul_id VARCHAR(20) NOT NULL, arsiv_id VARCHAR(191) NOT NULL, sinav_id VARCHAR(191) NULL,
  sinav_adi TEXT NULL, soru_id VARCHAR(191) NULL, soru_kodu VARCHAR(100) NULL,
  kaynak_depolama_yolu TEXT NULL, depolama_yolu TEXT NULL, kaynak VARCHAR(80) NULL,
  olusturulma_zamani VARCHAR(40) NULL, veri_guncellenme_zamani VARCHAR(40) NULL,
  guncellenme_zamani VARCHAR(40) NOT NULL,
  PRIMARY KEY (okul_id, arsiv_id), KEY idx_soru_arsiv_sinav (okul_id, sinav_id),
  KEY idx_soru_arsiv_soru (okul_id, soru_id),
  CONSTRAINT fk_soru_arsiv_okul FOREIGN KEY (okul_id) REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
