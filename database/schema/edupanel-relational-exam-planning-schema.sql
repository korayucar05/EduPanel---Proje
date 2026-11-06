CREATE TABLE IF NOT EXISTS egitim_kocu_sinav_icerik_planlari (
  okul_id VARCHAR(20) NOT NULL, plan_id VARCHAR(191) NOT NULL, takvim_id VARCHAR(191) NULL,
  sinif_seviyesi VARCHAR(20) NULL, sinav_adi TEXT NULL, sinav_sirasi INT NULL,
  sinav_tarihi VARCHAR(20) NULL, olusturulan_sinav_id VARCHAR(191) NULL,
  olusturulan_sinav_zamani VARCHAR(40) NULL, olusturulma_zamani VARCHAR(40) NULL,
  veri_guncellenme_zamani VARCHAR(40) NULL, guncellenme_zamani VARCHAR(40) NOT NULL,
  PRIMARY KEY (okul_id, plan_id), KEY idx_koc_icerik_takvim (okul_id, takvim_id),
  KEY idx_koc_icerik_sinav (okul_id, olusturulan_sinav_id),
  CONSTRAINT fk_koc_icerik_plan_okul FOREIGN KEY (okul_id) REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS egitim_kocu_sinav_icerik_kapsamlari (
  okul_id VARCHAR(20) NOT NULL, plan_id VARCHAR(191) NOT NULL, sira_no SMALLINT UNSIGNED NOT NULL,
  kapsam_id VARCHAR(191) NULL, ders_id VARCHAR(191) NULL, ders_adi VARCHAR(150) NULL,
  sinif_seviyesi VARCHAR(20) NULL, unite_id VARCHAR(191) NULL, unite_adi VARCHAR(255) NULL,
  konu_id VARCHAR(191) NULL, konu_adi VARCHAR(255) NULL, kazanim_id VARCHAR(191) NULL,
  kazanim_adi TEXT NULL, kapsam_turu VARCHAR(30) NULL, tum_konular TINYINT(1) NULL,
  tum_kazanimlar TINYINT(1) NULL, soru_sayisi INT NULL,
  PRIMARY KEY (okul_id, plan_id, sira_no), KEY idx_koc_icerik_ders (okul_id, ders_id),
  KEY idx_koc_icerik_unite (okul_id, unite_id),
  CONSTRAINT fk_koc_icerik_kapsam FOREIGN KEY (okul_id, plan_id)
    REFERENCES egitim_kocu_sinav_icerik_planlari (okul_id, plan_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS deneme_sinavi_tarihleri (
  okul_id VARCHAR(20) NOT NULL, kayit_id VARCHAR(191) NOT NULL, sinif_seviyesi VARCHAR(20) NULL,
  sinav_tarihi VARCHAR(20) NULL, sinav_turu VARCHAR(40) NULL, aciklama TEXT NULL,
  veri_guncellenme_zamani VARCHAR(40) NULL, guncellenme_zamani VARCHAR(40) NOT NULL,
  PRIMARY KEY (okul_id, kayit_id), KEY idx_deneme_tarihi (okul_id, sinav_tarihi),
  KEY idx_deneme_sinif (okul_id, sinif_seviyesi),
  CONSTRAINT fk_deneme_tarihi_okul FOREIGN KEY (okul_id) REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
