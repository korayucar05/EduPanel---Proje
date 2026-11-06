CREATE TABLE IF NOT EXISTS panel_okullari (
  uygulama_okul_id VARCHAR(191) NOT NULL,
  okul_kodu VARCHAR(80) NOT NULL,
  okul_adi VARCHAR(255) NOT NULL,
  sehir VARCHAR(150) NOT NULL DEFAULT '',
  slogan TEXT NULL,
  durum VARCHAR(20) NOT NULL DEFAULT 'active',
  moduller_tanimli TINYINT(1) NOT NULL DEFAULT 0,
  lisans_notu TEXT NULL,
  guncellenme_zamani DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (uygulama_okul_id),
  KEY idx_panel_okullari_okul_kodu (okul_kodu),
  KEY idx_panel_okullari_durum (durum)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS panel_okul_modulleri (
  uygulama_okul_id VARCHAR(191) NOT NULL,
  modul_id VARCHAR(100) NOT NULL,
  PRIMARY KEY (uygulama_okul_id, modul_id),
  CONSTRAINT fk_panel_okul_modulleri_okul
    FOREIGN KEY (uygulama_okul_id) REFERENCES panel_okullari (uygulama_okul_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kullanicilar (
  kullanici_id VARCHAR(191) NOT NULL,
  uygulama_okul_id VARCHAR(191) NULL,
  ad_soyad VARCHAR(200) NOT NULL,
  e_posta VARCHAR(255) NOT NULL DEFAULT '',
  kullanici_adi VARCHAR(191) NOT NULL,
  rol VARCHAR(40) NOT NULL,
  durum VARCHAR(20) NOT NULL DEFAULT 'active',
  sifre_ozeti VARCHAR(255) NULL,
  sifre_tuzu VARCHAR(255) NULL,
  olusturulma_zamani DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  guncellenme_zamani DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (kullanici_id),
  KEY idx_kullanicilar_okul (uygulama_okul_id),
  KEY idx_kullanicilar_kullanici_adi (kullanici_adi),
  KEY idx_kullanicilar_e_posta (e_posta),
  KEY idx_kullanicilar_rol_durum (rol, durum),
  CONSTRAINT fk_kullanicilar_panel_okulu
    FOREIGN KEY (uygulama_okul_id) REFERENCES panel_okullari (uygulama_okul_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kullanici_modul_izinleri (
  kullanici_id VARCHAR(191) NOT NULL,
  modul_id VARCHAR(100) NOT NULL,
  goruntuleme TINYINT(1) NOT NULL DEFAULT 0,
  olusturma TINYINT(1) NOT NULL DEFAULT 0,
  guncelleme TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (kullanici_id, modul_id),
  CONSTRAINT fk_kullanici_modul_izinleri_kullanici
    FOREIGN KEY (kullanici_id) REFERENCES kullanicilar (kullanici_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS panel_yetkilendirme_ayarlari (
  ayar_id TINYINT UNSIGNED NOT NULL,
  sema_surumu INT NOT NULL DEFAULT 2,
  etkin_kullanici_id VARCHAR(191) NOT NULL,
  etkin_okul_id VARCHAR(191) NULL,
  guncellenme_zamani DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (ayar_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
