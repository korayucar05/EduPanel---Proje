CREATE TABLE IF NOT EXISTS mesaj_kanitlari (
  okul_id VARCHAR(20) NOT NULL,
  kayit_id VARCHAR(191) NOT NULL,
  token_ozeti VARCHAR(191) NULL,
  alici_ad_soyad VARCHAR(200) NULL,
  alici_telefon VARCHAR(40) NULL,
  alici_rolu VARCHAR(80) NULL,
  ogrenci_ad_soyad VARCHAR(200) NULL,
  ogrenci_no VARCHAR(80) NULL,
  sinif_adi VARCHAR(80) NULL,
  kaynak VARCHAR(100) NULL,
  mesaj_turu VARCHAR(100) NULL,
  mesaj LONGTEXT NULL,
  mesaj_ozeti VARCHAR(191) NULL,
  olusturulma_zamani VARCHAR(40) NULL,
  sona_erme_zamani VARCHAR(40) NULL,
  acilma_sayisi INT NULL,
  onay_sayisi INT NULL,
  saglayici_durumu VARCHAR(100) NULL,
  saglayici_hata_zamani VARCHAR(40) NULL,
  saglayici_mesaj_id VARCHAR(191) NULL,
  saglayici_kabul_zamani VARCHAR(40) NULL,
  ek_adi VARCHAR(255) NULL,
  guncellenme_zamani VARCHAR(40) NOT NULL,
  PRIMARY KEY (okul_id, kayit_id),
  KEY idx_mesaj_kaniti_token (okul_id, token_ozeti),
  KEY idx_mesaj_kaniti_ogrenci (okul_id, ogrenci_no),
  CONSTRAINT fk_mesaj_kaniti_okul FOREIGN KEY (okul_id)
    REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ogrenci_duyurulari (
  okul_id VARCHAR(20) NOT NULL,
  kayit_id VARCHAR(191) NOT NULL,
  baslik TEXT NULL,
  icerik LONGTEXT NULL,
  duyuru_tarihi VARCHAR(40) NULL,
  etiket VARCHAR(100) NULL,
  kaynak VARCHAR(100) NULL,
  duyuru_turu VARCHAR(100) NULL,
  alici_turu VARCHAR(100) NULL,
  alici_ogrenci_id VARCHAR(191) NULL,
  alici_ogrenci_no VARCHAR(80) NULL,
  alici_ogrenci_ad_soyad VARCHAR(200) NULL,
  sinif_adi VARCHAR(80) NULL,
  sinav_adi VARCHAR(255) NULL,
  ders_adi VARCHAR(200) NULL,
  sinav_tarihi VARCHAR(40) NULL,
  sinav_saati VARCHAR(40) NULL,
  dugme_basligi VARCHAR(255) NULL,
  dugme_alt_basligi VARCHAR(255) NULL,
  bina_adi VARCHAR(150) NULL,
  salon_adi VARCHAR(150) NULL,
  sira_no INT NULL,
  gozetmen_ad_soyad VARCHAR(200) NULL,
  oturum_sirasi INT NULL,
  kat_adi VARCHAR(100) NULL,
  plan_anahtari VARCHAR(191) NULL,
  kilitlenince_yayinlandi TINYINT(1) NULL,
  olusturulma_zamani VARCHAR(40) NULL,
  veri_guncellenme_zamani VARCHAR(40) NULL,
  sona_erme_zamani VARCHAR(40) NULL,
  guncellenme_zamani VARCHAR(40) NOT NULL,
  PRIMARY KEY (okul_id, kayit_id),
  KEY idx_ogrenci_duyurusu_ogrenci (okul_id, alici_ogrenci_id),
  KEY idx_ogrenci_duyurusu_sinif (okul_id, sinif_adi),
  CONSTRAINT fk_ogrenci_duyurusu_okul FOREIGN KEY (okul_id)
    REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ogrenci_duyuru_sinavlari (
  okul_id VARCHAR(20) NOT NULL,
  duyuru_id VARCHAR(191) NOT NULL,
  sinav_sirasi SMALLINT UNSIGNED NOT NULL,
  sinif_duzeyi VARCHAR(80) NULL,
  ders_adi VARCHAR(200) NULL,
  PRIMARY KEY (okul_id, duyuru_id, sinav_sirasi),
  CONSTRAINT fk_duyuru_sinavi_duyuru FOREIGN KEY (okul_id, duyuru_id)
    REFERENCES ogrenci_duyurulari (okul_id, kayit_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ogrenci_duyuru_siniflari (
  okul_id VARCHAR(20) NOT NULL,
  duyuru_id VARCHAR(191) NOT NULL,
  sinav_sirasi SMALLINT UNSIGNED NOT NULL,
  sinif_sirasi SMALLINT UNSIGNED NOT NULL,
  sinif_adi VARCHAR(80) NOT NULL,
  PRIMARY KEY (okul_id, duyuru_id, sinav_sirasi, sinif_sirasi),
  CONSTRAINT fk_duyuru_sinifi_sinav FOREIGN KEY (okul_id, duyuru_id, sinav_sirasi)
    REFERENCES ogrenci_duyuru_sinavlari (okul_id, duyuru_id, sinav_sirasi) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ogrenci_duyuru_salonlari (
  okul_id VARCHAR(20) NOT NULL,
  duyuru_id VARCHAR(191) NOT NULL,
  salon_sirasi SMALLINT UNSIGNED NOT NULL,
  salon_adi VARCHAR(150) NULL,
  bina_adi VARCHAR(150) NULL,
  kat_adi VARCHAR(100) NULL,
  ogretmen_ad_soyad VARCHAR(200) NULL,
  PRIMARY KEY (okul_id, duyuru_id, salon_sirasi),
  CONSTRAINT fk_duyuru_salonu_duyuru FOREIGN KEY (okul_id, duyuru_id)
    REFERENCES ogrenci_duyurulari (okul_id, kayit_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS anket_davetleri (
  okul_id VARCHAR(20) NOT NULL,
  kayit_id VARCHAR(191) NOT NULL,
  anket_anahtari VARCHAR(191) NULL,
  davet_anahtari VARCHAR(191) NULL,
  alici_id VARCHAR(191) NULL,
  alici_ad_soyad VARCHAR(200) NULL,
  alici_rolu VARCHAR(80) NULL,
  sinif_adi VARCHAR(80) NULL,
  telefon VARCHAR(40) NULL,
  baglanti TEXT NULL,
  olusturulma_zamani VARCHAR(40) NULL,
  guncellenme_zamani VARCHAR(40) NOT NULL,
  PRIMARY KEY (okul_id, kayit_id),
  KEY idx_anket_daveti_anket (okul_id, anket_anahtari),
  KEY idx_anket_daveti_alici (okul_id, alici_id),
  CONSTRAINT fk_anket_daveti_okul FOREIGN KEY (okul_id)
    REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ogretmen_mesajlari (
  okul_id VARCHAR(20) NOT NULL,
  kayit_id VARCHAR(191) NOT NULL,
  baglanti_anahtari VARCHAR(191) NULL,
  uygulama_okul_id VARCHAR(191) NULL,
  ogretmen_id VARCHAR(191) NULL,
  ogretmen_ad_soyad VARCHAR(200) NULL,
  baslik TEXT NULL,
  mesaj LONGTEXT NULL,
  alici_turu VARCHAR(100) NULL,
  alici_sayisi INT NULL,
  olusturulma_zamani VARCHAR(40) NULL,
  durum VARCHAR(100) NULL,
  kaynak VARCHAR(100) NULL,
  sinav_adi VARCHAR(255) NULL,
  sinav_tarihi VARCHAR(40) NULL,
  oturum_sirasi INT NULL,
  guncellenme_zamani VARCHAR(40) NOT NULL,
  PRIMARY KEY (okul_id, kayit_id),
  KEY idx_ogretmen_mesaji_ogretmen (okul_id, ogretmen_id),
  CONSTRAINT fk_ogretmen_mesaji_okul FOREIGN KEY (okul_id)
    REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ogretmen_mesaj_okumalari (
  okul_id VARCHAR(20) NOT NULL,
  kayit_id VARCHAR(191) NOT NULL,
  mesaj_id VARCHAR(191) NULL,
  ogrenci_id VARCHAR(191) NULL,
  ogrenci_ad_soyad VARCHAR(200) NULL,
  ogrenci_no VARCHAR(80) NULL,
  sinif_adi VARCHAR(80) NULL,
  alici_turu VARCHAR(100) NULL,
  ilk_acilma_zamani VARCHAR(40) NULL,
  son_acilma_zamani VARCHAR(40) NULL,
  acilma_sayisi INT NULL,
  baglanti_anahtari VARCHAR(191) NULL,
  uygulama_okul_id VARCHAR(191) NULL,
  ogretmen_id VARCHAR(191) NULL,
  ogretmen_ad_soyad VARCHAR(200) NULL,
  gonderilme_zamani VARCHAR(40) NULL,
  hatirlatma_sayisi INT NULL,
  kaynak VARCHAR(100) NULL,
  guncellenme_zamani VARCHAR(40) NOT NULL,
  PRIMARY KEY (okul_id, kayit_id),
  KEY idx_mesaj_okuma_mesaj (okul_id, mesaj_id),
  KEY idx_mesaj_okuma_ogrenci (okul_id, ogrenci_id),
  CONSTRAINT fk_mesaj_okuma_okul FOREIGN KEY (okul_id)
    REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS portal_baglantilari (
  okul_id VARCHAR(20) NOT NULL,
  kayit_id VARCHAR(191) NOT NULL,
  portal_turu VARCHAR(80) NULL,
  ogrenci_id VARCHAR(191) NULL,
  token_ozeti VARCHAR(191) NULL,
  kurtarma_anahtari TEXT NULL,
  ogrenci_ad_soyad VARCHAR(200) NULL,
  ogrenci_no VARCHAR(80) NULL,
  sinif_adi VARCHAR(80) NULL,
  telefon VARCHAR(40) NULL,
  olusturulma_zamani VARCHAR(40) NULL,
  veri_guncellenme_zamani VARCHAR(40) NULL,
  iptal_zamani VARCHAR(40) NULL,
  uygulama_okul_id VARCHAR(191) NULL,
  guncellenme_zamani VARCHAR(40) NOT NULL,
  PRIMARY KEY (okul_id, kayit_id),
  KEY idx_portal_baglantisi_ogrenci (okul_id, ogrenci_id),
  KEY idx_portal_baglantisi_token (okul_id, token_ozeti),
  CONSTRAINT fk_portal_baglantisi_okul FOREIGN KEY (okul_id)
    REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS egitim_haberleri (
  okul_id VARCHAR(20) NOT NULL,
  kayit_id VARCHAR(191) NOT NULL,
  dis_kaynak_id VARCHAR(191) NULL,
  uygulama_okul_id VARCHAR(191) NULL,
  kaynak VARCHAR(100) NULL,
  baslik TEXT NULL,
  baglanti TEXT NULL,
  icerik LONGTEXT NULL,
  yayinlanma_zamani VARCHAR(40) NULL,
  haber_tarihi VARCHAR(40) NULL,
  haber_saati VARCHAR(40) NULL,
  yayinlayan VARCHAR(200) NULL,
  secilme_zamani VARCHAR(40) NULL,
  aktif TINYINT(1) NULL,
  guncellenme_zamani VARCHAR(40) NOT NULL,
  PRIMARY KEY (okul_id, kayit_id),
  KEY idx_egitim_haberi_dis_kaynak (okul_id, dis_kaynak_id),
  KEY idx_egitim_haberi_aktif (okul_id, aktif),
  CONSTRAINT fk_egitim_haberi_okul FOREIGN KEY (okul_id)
    REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
