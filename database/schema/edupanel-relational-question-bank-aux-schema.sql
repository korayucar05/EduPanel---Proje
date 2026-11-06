CREATE TABLE IF NOT EXISTS soru_bankasi_kullanimlari (
  kullanim_id VARCHAR(191) NOT NULL PRIMARY KEY,
  soru_id VARCHAR(191) NOT NULL,
  soru_kodu VARCHAR(191) NOT NULL DEFAULT '',
  sinav_id VARCHAR(191) NOT NULL,
  sinav_adi VARCHAR(240) NOT NULL DEFAULT '',
  sinav_tarihi VARCHAR(40) NULL,
  kitapcik_turu VARCHAR(40) NULL,
  soru_numarasi INT NULL,
  kaynak VARCHAR(120) NOT NULL DEFAULT '',
  kullanilma_zamani DATETIME(3) NOT NULL,
  KEY idx_soru_kullanim_soru (soru_id, kullanilma_zamani),
  KEY idx_soru_kullanim_sinav (sinav_id, soru_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS soru_bankasi_gruplari (
  grup_belge_id VARCHAR(191) NOT NULL PRIMARY KEY,
  grup_id VARCHAR(191) NOT NULL,
  grup_modu VARCHAR(20) NOT NULL DEFAULT 'required',
  yerlesim VARCHAR(40) NOT NULL DEFAULT 'normal',
  baslik VARCHAR(240) NULL,
  yonerge_metni LONGTEXT NULL,
  yonerge_gorsel_adresi LONGTEXT NULL,
  yonerge_soru_id VARCHAR(191) NULL,
  olusturma_zamani DATETIME(3) NOT NULL,
  guncellenme_zamani DATETIME(3) NOT NULL,
  UNIQUE KEY uq_soru_grubu_id (grup_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS soru_bankasi_grup_sorulari (
  grup_belge_id VARCHAR(191) NOT NULL,
  soru_id VARCHAR(191) NOT NULL,
  sira_no INT NOT NULL,
  PRIMARY KEY (grup_belge_id, soru_id),
  UNIQUE KEY uq_soru_grubu_sira (grup_belge_id, sira_no),
  CONSTRAINT fk_soru_grup_sorulari_grup FOREIGN KEY (grup_belge_id)
    REFERENCES soru_bankasi_gruplari (grup_belge_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS soru_bankasi_islem_kayitlari (
  islem_id VARCHAR(191) NOT NULL PRIMARY KEY,
  soru_id VARCHAR(191) NOT NULL,
  islem_turu VARCHAR(80) NOT NULL,
  yedekten_geri_yukleme_id VARCHAR(191) NULL,
  olusturma_zamani DATETIME(3) NOT NULL,
  KEY idx_soru_islem_soru (soru_id, olusturma_zamani),
  KEY idx_soru_islem_tur (islem_turu, olusturma_zamani)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS soru_bankasi_islem_ayrintilari (
  islem_id VARCHAR(191) NOT NULL,
  alan_yolu VARCHAR(500) NOT NULL,
  deger_turu VARCHAR(20) NOT NULL,
  metin_degeri LONGTEXT NULL,
  sayi_degeri DOUBLE NULL,
  mantiksal_deger TINYINT(1) NULL,
  PRIMARY KEY (islem_id, alan_yolu),
  CONSTRAINT fk_soru_islem_ayrinti FOREIGN KEY (islem_id)
    REFERENCES soru_bankasi_islem_kayitlari (islem_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS soru_bankasi_ice_aktarma_oturumlari (
  oturum_id VARCHAR(191) NOT NULL PRIMARY KEY,
  etiket VARCHAR(240) NOT NULL,
  kaynak VARCHAR(120) NOT NULL,
  sinif_seviyesi INT NULL,
  ders_sayisi INT NOT NULL DEFAULT 0,
  beklenen_dosya_sayisi INT NOT NULL DEFAULT 0,
  beklenen_kazanim_sayisi INT NOT NULL DEFAULT 0,
  aktarilan_dosya_sayisi INT NOT NULL DEFAULT 0,
  tamamlanan_kazanim_sayisi INT NOT NULL DEFAULT 0,
  basarisiz_grup_sayisi INT NOT NULL DEFAULT 0,
  geri_alinan_soru_sayisi INT NOT NULL DEFAULT 0,
  geri_alinamayan_soru_sayisi INT NOT NULL DEFAULT 0,
  durum VARCHAR(40) NOT NULL DEFAULT 'running',
  geri_alma_zamani DATETIME(3) NULL,
  olusturma_zamani DATETIME(3) NOT NULL,
  guncellenme_zamani DATETIME(3) NOT NULL,
  KEY idx_soru_aktarma_durum (durum, olusturma_zamani)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
