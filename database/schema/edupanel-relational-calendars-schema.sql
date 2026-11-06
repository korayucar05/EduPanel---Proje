CREATE TABLE IF NOT EXISTS egitim_kocu_sinav_takvimleri (
  okul_id VARCHAR(20) NOT NULL, takvim_id VARCHAR(191) NOT NULL, sinif_seviyesi VARCHAR(20) NULL,
  sinav_adi TEXT NULL, sinav_sirasi INT NULL, sinav_tarihi VARCHAR(20) NULL,
  uygulama_okul_id VARCHAR(80) NULL, aktif TINYINT(1) NULL,
  olusturulma_zamani VARCHAR(40) NULL, veri_guncellenme_zamani VARCHAR(40) NULL,
  guncellenme_zamani VARCHAR(40) NOT NULL,
  PRIMARY KEY (okul_id, takvim_id), KEY idx_koc_takvim_tarih (okul_id, sinav_tarihi),
  KEY idx_koc_takvim_seviye (okul_id, sinif_seviyesi),
  CONSTRAINT fk_koc_takvim_okul FOREIGN KEY (okul_id) REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS egitim_kocu_sinav_takvim_icerikleri (
  okul_id VARCHAR(20) NOT NULL, takvim_id VARCHAR(191) NOT NULL, sira_no SMALLINT UNSIGNED NOT NULL,
  icerik_id VARCHAR(191) NULL, ders_adi VARCHAR(150) NULL, konu_aciklamasi TEXT NULL,
  PRIMARY KEY (okul_id, takvim_id, sira_no),
  CONSTRAINT fk_koc_takvim_icerik FOREIGN KEY (okul_id, takvim_id)
    REFERENCES egitim_kocu_sinav_takvimleri (okul_id, takvim_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kelebek_sinav_takvimleri (
  okul_id VARCHAR(20) NOT NULL, takvim_id VARCHAR(191) NOT NULL, donem VARCHAR(80) NULL,
  sinav_no VARCHAR(80) NULL, baslangic_tarihi VARCHAR(20) NULL, gun_sayisi INT NULL,
  gunluk_oturum_sayisi INT NULL, veri_guncellenme_zamani VARCHAR(40) NULL,
  guncellenme_zamani VARCHAR(40) NOT NULL,
  PRIMARY KEY (okul_id, takvim_id), KEY idx_kelebek_takvim_donem (okul_id, donem, sinav_no),
  CONSTRAINT fk_kelebek_takvim_okul FOREIGN KEY (okul_id) REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kelebek_sinav_oturumlari (
  okul_id VARCHAR(20) NOT NULL, takvim_id VARCHAR(191) NOT NULL, sira_no SMALLINT UNSIGNED NOT NULL,
  oturum_id VARCHAR(191) NULL, sinav_tarihi VARCHAR(20) NULL, gun_adi VARCHAR(30) NULL,
  ders_saati INT NULL, oturum_sirasi INT NULL, saat VARCHAR(20) NULL,
  telafi_tarihi VARCHAR(20) NULL, telafi_gun_adi VARCHAR(30) NULL, telafi_saati VARCHAR(20) NULL,
  PRIMARY KEY (okul_id, takvim_id, sira_no), KEY idx_kelebek_oturum_tarih (okul_id, sinav_tarihi),
  CONSTRAINT fk_kelebek_oturum FOREIGN KEY (okul_id, takvim_id)
    REFERENCES kelebek_sinav_takvimleri (okul_id, takvim_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kelebek_sinav_oturum_devamsizlari (
  okul_id VARCHAR(20) NOT NULL, takvim_id VARCHAR(191) NOT NULL,
  oturum_sira_no SMALLINT UNSIGNED NOT NULL, sira_no SMALLINT UNSIGNED NOT NULL,
  ogrenci_id VARCHAR(80) NULL, ogrenci_adi VARCHAR(100) NULL, ogrenci_soyadi VARCHAR(100) NULL,
  ogrenci_no VARCHAR(30) NULL, sinif_adi VARCHAR(30) NULL, katilmadigi_sinav VARCHAR(150) NULL,
  katilmadigi_sinav_duzeltmesi VARCHAR(150) NULL, telafiye_girebilir TINYINT(1) NULL,
  PRIMARY KEY (okul_id, takvim_id, oturum_sira_no, sira_no), KEY idx_kelebek_devamsiz_ogrenci (okul_id, ogrenci_id),
  CONSTRAINT fk_kelebek_devamsiz FOREIGN KEY (okul_id, takvim_id, oturum_sira_no)
    REFERENCES kelebek_sinav_oturumlari (okul_id, takvim_id, sira_no) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
