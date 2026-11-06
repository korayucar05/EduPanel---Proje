CREATE TABLE IF NOT EXISTS anketler (
  okul_id VARCHAR(20) NOT NULL,
  kayit_turu VARCHAR(10) NOT NULL,
  anket_id VARCHAR(191) NOT NULL,
  baslik TEXT NULL,
  aciklama LONGTEXT NULL,
  sona_erme_zamani VARCHAR(40) NULL,
  coklu_cevaba_izin TINYINT(1) NOT NULL DEFAULT 0,
  son_yayin_anahtari TEXT NULL,
  veri_guncellenme_zamani VARCHAR(40) NULL,
  aktif_anket_id VARCHAR(191) NULL,
  yayin_anahtari TEXT NULL,
  yayinlanma_zamani VARCHAR(40) NULL,
  durum VARCHAR(40) NULL,
  guncellenme_zamani VARCHAR(40) NOT NULL,
  PRIMARY KEY (okul_id, kayit_turu, anket_id),
  KEY idx_anketler_durum (okul_id, kayit_turu, durum),
  CONSTRAINT fk_anketler_okul FOREIGN KEY (okul_id) REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS anket_hedef_kitleleri (
  okul_id VARCHAR(20) NOT NULL,
  kayit_turu VARCHAR(10) NOT NULL,
  anket_id VARCHAR(191) NOT NULL,
  sira_no SMALLINT UNSIGNED NOT NULL,
  hedef_kitle VARCHAR(100) NOT NULL,
  PRIMARY KEY (okul_id, kayit_turu, anket_id, sira_no),
  CONSTRAINT fk_anket_hedef_anket FOREIGN KEY (okul_id, kayit_turu, anket_id)
    REFERENCES anketler (okul_id, kayit_turu, anket_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS anket_secili_alicilari (
  okul_id VARCHAR(20) NOT NULL,
  kayit_turu VARCHAR(10) NOT NULL,
  anket_id VARCHAR(191) NOT NULL,
  sira_no SMALLINT UNSIGNED NOT NULL,
  alici_id VARCHAR(191) NOT NULL,
  PRIMARY KEY (okul_id, kayit_turu, anket_id, sira_no),
  KEY idx_anket_alici (okul_id, alici_id),
  CONSTRAINT fk_anket_alici_anket FOREIGN KEY (okul_id, kayit_turu, anket_id)
    REFERENCES anketler (okul_id, kayit_turu, anket_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS anket_secili_siniflari (
  okul_id VARCHAR(20) NOT NULL,
  kayit_turu VARCHAR(10) NOT NULL,
  anket_id VARCHAR(191) NOT NULL,
  sira_no SMALLINT UNSIGNED NOT NULL,
  sinif_adi VARCHAR(80) NOT NULL,
  PRIMARY KEY (okul_id, kayit_turu, anket_id, sira_no),
  CONSTRAINT fk_anket_sinif_anket FOREIGN KEY (okul_id, kayit_turu, anket_id)
    REFERENCES anketler (okul_id, kayit_turu, anket_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS anket_sorulari (
  okul_id VARCHAR(20) NOT NULL,
  kayit_turu VARCHAR(10) NOT NULL,
  anket_id VARCHAR(191) NOT NULL,
  soru_id VARCHAR(191) NOT NULL,
  sira_no SMALLINT UNSIGNED NOT NULL,
  soru_metni LONGTEXT NULL,
  cevap_turu VARCHAR(50) NULL,
  zorunlu TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (okul_id, kayit_turu, anket_id, soru_id),
  KEY idx_anket_soru_sira (okul_id, kayit_turu, anket_id, sira_no),
  CONSTRAINT fk_anket_soru_anket FOREIGN KEY (okul_id, kayit_turu, anket_id)
    REFERENCES anketler (okul_id, kayit_turu, anket_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS anket_soru_secenekleri (
  okul_id VARCHAR(20) NOT NULL,
  kayit_turu VARCHAR(10) NOT NULL,
  anket_id VARCHAR(191) NOT NULL,
  soru_id VARCHAR(191) NOT NULL,
  sira_no SMALLINT UNSIGNED NOT NULL,
  secenek_metni LONGTEXT NULL,
  PRIMARY KEY (okul_id, kayit_turu, anket_id, soru_id, sira_no),
  CONSTRAINT fk_anket_secenek_soru FOREIGN KEY (okul_id, kayit_turu, anket_id, soru_id)
    REFERENCES anket_sorulari (okul_id, kayit_turu, anket_id, soru_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS anket_soru_toplu_cevap_kayitlari (
  okul_id VARCHAR(20) NOT NULL,
  kayit_id VARCHAR(191) NOT NULL,
  soru_id VARCHAR(191) NOT NULL,
  guncellenme_zamani VARCHAR(40) NOT NULL,
  PRIMARY KEY (okul_id, kayit_id),
  KEY idx_anket_toplu_cevap_soru (okul_id, soru_id),
  CONSTRAINT fk_anket_toplu_cevap_okul FOREIGN KEY (okul_id) REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS anket_soru_toplu_cevaplari (
  okul_id VARCHAR(20) NOT NULL,
  kayit_id VARCHAR(191) NOT NULL,
  cevap_sirasi SMALLINT UNSIGNED NOT NULL,
  cevap_metni LONGTEXT NULL,
  PRIMARY KEY (okul_id, kayit_id, cevap_sirasi),
  CONSTRAINT fk_anket_toplu_cevap_kayit FOREIGN KEY (okul_id, kayit_id)
    REFERENCES anket_soru_toplu_cevap_kayitlari (okul_id, kayit_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS anket_gonderimleri (
  okul_id VARCHAR(20) NOT NULL,
  gonderim_id VARCHAR(191) NOT NULL,
  anket_anahtari TEXT NULL,
  cevaplayan_anahtari TEXT NULL,
  davet_anahtari TEXT NULL,
  alici_id VARCHAR(191) NULL,
  alici_ad_soyad VARCHAR(200) NULL,
  alici_rolu VARCHAR(80) NULL,
  sinif_adi VARCHAR(80) NULL,
  gonderilme_zamani VARCHAR(40) NULL,
  guncellenme_zamani VARCHAR(40) NOT NULL,
  PRIMARY KEY (okul_id, gonderim_id),
  KEY idx_anket_gonderim_alici (okul_id, alici_id),
  CONSTRAINT fk_anket_gonderim_okul FOREIGN KEY (okul_id) REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS anket_gonderim_cevaplari (
  okul_id VARCHAR(20) NOT NULL,
  gonderim_id VARCHAR(191) NOT NULL,
  soru_id VARCHAR(191) NOT NULL,
  cevap_sirasi SMALLINT UNSIGNED NOT NULL,
  cevap_metni LONGTEXT NULL,
  PRIMARY KEY (okul_id, gonderim_id, soru_id, cevap_sirasi),
  CONSTRAINT fk_anket_gonderim_cevap FOREIGN KEY (okul_id, gonderim_id)
    REFERENCES anket_gonderimleri (okul_id, gonderim_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS veli_onay_kampanyalari (
  okul_id VARCHAR(20) NOT NULL,
  kampanya_id VARCHAR(191) NOT NULL,
  baslik TEXT NULL,
  aciklama LONGTEXT NULL,
  mudur_ad_soyad VARCHAR(200) NULL,
  etkinlik_tarihi VARCHAR(40) NULL,
  sona_erme_zamani VARCHAR(40) NULL,
  olusturulma_zamani VARCHAR(40) NULL,
  olusturan VARCHAR(191) NULL,
  veri_guncellenme_zamani VARCHAR(40) NULL,
  durum VARCHAR(40) NULL,
  son_bildirim_zamani VARCHAR(40) NULL,
  bildirim_toplam INT NULL,
  bildirim_gonderilen INT NULL,
  bildirim_basarisiz INT NULL,
  guncellenme_zamani VARCHAR(40) NOT NULL,
  PRIMARY KEY (okul_id, kampanya_id),
  KEY idx_veli_onay_kampanya_durum (okul_id, durum),
  CONSTRAINT fk_veli_onay_kampanya_okul FOREIGN KEY (okul_id) REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS veli_onay_kampanya_hedefleri (
  okul_id VARCHAR(20) NOT NULL,
  kampanya_id VARCHAR(191) NOT NULL,
  hedef_id VARCHAR(191) NOT NULL,
  ogrenci_ad_soyad VARCHAR(200) NULL,
  ogrenci_no VARCHAR(50) NULL,
  sinif_adi VARCHAR(80) NULL,
  veli_ad_soyad VARCHAR(200) NULL,
  veli_telefon VARCHAR(50) NULL,
  durum VARCHAR(40) NULL,
  cevap_zamani VARCHAR(40) NULL,
  cevaplayan_adi VARCHAR(200) NULL,
  cevap_ip VARCHAR(80) NULL,
  cevap_tarayici TEXT NULL,
  sira_no SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (okul_id, kampanya_id, hedef_id),
  KEY idx_veli_onay_hedef_sira (okul_id, kampanya_id, sira_no),
  CONSTRAINT fk_veli_onay_hedef_kampanya FOREIGN KEY (okul_id, kampanya_id)
    REFERENCES veli_onay_kampanyalari (okul_id, kampanya_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS veli_onay_satirlari (
  okul_id VARCHAR(20) NOT NULL,
  kayit_id VARCHAR(191) NOT NULL,
  kampanya_id VARCHAR(191) NULL,
  ogrenci_id VARCHAR(191) NULL,
  ogrenci_ad_soyad VARCHAR(200) NULL,
  ogrenci_no VARCHAR(50) NULL,
  sinif_adi VARCHAR(80) NULL,
  veli_telefon VARCHAR(50) NULL,
  durum VARCHAR(40) NULL,
  olusturulma_zamani VARCHAR(40) NULL,
  cevap_zamani VARCHAR(40) NULL,
  cevap_ip VARCHAR(80) NULL,
  cevap_tarayici TEXT NULL,
  guncellenme_zamani VARCHAR(40) NOT NULL,
  PRIMARY KEY (okul_id, kayit_id),
  KEY idx_veli_onay_satir_kampanya (okul_id, kampanya_id),
  KEY idx_veli_onay_satir_ogrenci (okul_id, ogrenci_id),
  CONSTRAINT fk_veli_onay_satir_okul FOREIGN KEY (okul_id) REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS veli_onaylari (
  okul_id VARCHAR(20) NOT NULL,
  onay_id VARCHAR(191) NOT NULL,
  genel_anahtar_ozeti TEXT NULL,
  kurtarma_anahtari TEXT NULL,
  ogrenci_id VARCHAR(191) NULL,
  ogrenci_ad_soyad VARCHAR(200) NULL,
  ogrenci_no VARCHAR(50) NULL,
  sinif_adi VARCHAR(80) NULL,
  veli_telefon VARCHAR(50) NULL,
  baslik TEXT NULL,
  aciklama LONGTEXT NULL,
  etkinlik_tarihi VARCHAR(40) NULL,
  sona_erme_zamani VARCHAR(40) NULL,
  durum VARCHAR(40) NULL,
  olusturulma_zamani VARCHAR(40) NULL,
  portal_baglantisi TEXT NULL,
  tek_kullanimlik_sifre_ozeti TEXT NULL,
  sifre_sona_erme_zamani VARCHAR(40) NULL,
  sifre_deneme_sayisi INT NULL,
  son_bildirim_zamani VARCHAR(40) NULL,
  son_bildirim_basarili TINYINT(1) NULL,
  son_bildirim_hatasi LONGTEXT NULL,
  sifre_istenme_zamani VARCHAR(40) NULL,
  karar VARCHAR(40) NULL,
  cevap_zamani VARCHAR(40) NULL,
  makbuz_no VARCHAR(191) NULL,
  kanit_ozeti TEXT NULL,
  guncellenme_zamani VARCHAR(40) NOT NULL,
  PRIMARY KEY (okul_id, onay_id),
  KEY idx_veli_onayi_ogrenci (okul_id, ogrenci_id),
  KEY idx_veli_onayi_durum (okul_id, durum),
  CONSTRAINT fk_veli_onayi_okul FOREIGN KEY (okul_id) REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
