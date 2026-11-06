CREATE TABLE IF NOT EXISTS yoklama_mobil_gonderimleri (
  okul_id VARCHAR(20) NOT NULL, gonderim_id VARCHAR(191) NOT NULL, tarih VARCHAR(20) NULL,
  sinif_id VARCHAR(80) NULL, sinif_adi VARCHAR(80) NULL, ders_adi VARCHAR(150) NULL,
  gecerli_ders_saati INT NULL, ogretmen_id VARCHAR(80) NULL, ogretmen_adi VARCHAR(150) NULL,
  baglanti_id VARCHAR(191) NULL, baglanti_anahtari TEXT NULL, kaynak VARCHAR(80) NULL,
  durum VARCHAR(30) NULL, gonderilme_zamani VARCHAR(40) NULL, revizyon INT NULL,
  onaylanma_zamani VARCHAR(40) NULL, onaylayan_id VARCHAR(80) NULL, onaylayan_adi VARCHAR(150) NULL,
  guncellenme_zamani VARCHAR(40) NOT NULL,
  PRIMARY KEY (okul_id, gonderim_id), KEY idx_mobil_yoklama_tarih (okul_id, tarih),
  KEY idx_mobil_yoklama_sinif (okul_id, sinif_id),
  CONSTRAINT fk_mobil_yoklama_okul FOREIGN KEY (okul_id) REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS yoklama_mobil_gonderim_dersleri (
  okul_id VARCHAR(20) NOT NULL, gonderim_id VARCHAR(191) NOT NULL, sira_no SMALLINT UNSIGNED NOT NULL,
  ders_saati INT NOT NULL,
  PRIMARY KEY (okul_id, gonderim_id, sira_no),
  CONSTRAINT fk_mobil_yoklama_ders FOREIGN KEY (okul_id, gonderim_id)
    REFERENCES yoklama_mobil_gonderimleri (okul_id, gonderim_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS yoklama_mobil_gonderim_ogrencileri (
  okul_id VARCHAR(20) NOT NULL, gonderim_id VARCHAR(191) NOT NULL, sira_no SMALLINT UNSIGNED NOT NULL,
  ogrenci_id VARCHAR(80) NULL, ogrenci_adi VARCHAR(150) NULL, durum VARCHAR(30) NULL,
  PRIMARY KEY (okul_id, gonderim_id, sira_no), KEY idx_mobil_yoklama_ogrenci (okul_id, ogrenci_id),
  CONSTRAINT fk_mobil_yoklama_ogrenci FOREIGN KEY (okul_id, gonderim_id)
    REFERENCES yoklama_mobil_gonderimleri (okul_id, gonderim_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS yoklama_mobil_ogrenci_dersleri (
  okul_id VARCHAR(20) NOT NULL, gonderim_id VARCHAR(191) NOT NULL,
  ogrenci_sira_no SMALLINT UNSIGNED NOT NULL, ders_turu VARCHAR(20) NOT NULL,
  sira_no SMALLINT UNSIGNED NOT NULL, ders_saati INT NOT NULL,
  PRIMARY KEY (okul_id, gonderim_id, ogrenci_sira_no, ders_turu, sira_no),
  CONSTRAINT fk_mobil_yoklama_ogrenci_ders FOREIGN KEY (okul_id, gonderim_id, ogrenci_sira_no)
    REFERENCES yoklama_mobil_gonderim_ogrencileri (okul_id, gonderim_id, sira_no) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS yoklama_devamsizliklari (
  okul_id VARCHAR(20) NOT NULL, kayit_id VARCHAR(191) NOT NULL, tarih VARCHAR(20) NULL,
  sinif_id VARCHAR(80) NULL, sinif_adi VARCHAR(80) NULL, ogrenci_id VARCHAR(80) NULL,
  ogrenci_adi VARCHAR(150) NULL, durum VARCHAR(30) NULL, kaynak_gonderim_id VARCHAR(191) NULL,
  onaylayan_id VARCHAR(80) NULL, onaylayan_adi VARCHAR(150) NULL, onaylanma_zamani VARCHAR(40) NULL,
  guncellenme_zamani VARCHAR(40) NOT NULL,
  PRIMARY KEY (okul_id, kayit_id), KEY idx_devamsizlik_tarih (okul_id, tarih),
  KEY idx_devamsizlik_ogrenci (okul_id, ogrenci_id),
  CONSTRAINT fk_devamsizlik_okul FOREIGN KEY (okul_id) REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS yoklama_izinsiz_ders_kayitlari (
  okul_id VARCHAR(20) NOT NULL, kayit_id VARCHAR(191) NOT NULL, tarih VARCHAR(20) NULL,
  sinif_id VARCHAR(80) NULL, sinif_adi VARCHAR(80) NULL, ogrenci_id VARCHAR(80) NULL,
  ogrenci_adi VARCHAR(150) NULL, kaynak_gonderim_id VARCHAR(191) NULL,
  onaylayan_id VARCHAR(80) NULL, onaylayan_adi VARCHAR(150) NULL, onaylanma_zamani VARCHAR(40) NULL,
  guncellenme_zamani VARCHAR(40) NOT NULL,
  PRIMARY KEY (okul_id, kayit_id), KEY idx_izinsiz_tarih (okul_id, tarih),
  KEY idx_izinsiz_ogrenci (okul_id, ogrenci_id),
  CONSTRAINT fk_izinsiz_okul FOREIGN KEY (okul_id) REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS yoklama_izinsiz_ders_saatleri (
  okul_id VARCHAR(20) NOT NULL, kayit_id VARCHAR(191) NOT NULL, sira_no SMALLINT UNSIGNED NOT NULL,
  ders_saati INT NOT NULL,
  PRIMARY KEY (okul_id, kayit_id, sira_no),
  CONSTRAINT fk_izinsiz_ders FOREIGN KEY (okul_id, kayit_id)
    REFERENCES yoklama_izinsiz_ders_kayitlari (okul_id, kayit_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS yoklama_etkinlik_kayitlari (
  okul_id VARCHAR(20) NOT NULL, kayit_id VARCHAR(191) NOT NULL, tarih VARCHAR(20) NULL,
  sinif_id VARCHAR(80) NULL, sinif_adi VARCHAR(80) NULL, ogrenci_id VARCHAR(80) NULL,
  ogrenci_adi VARCHAR(150) NULL, durum VARCHAR(30) NULL, kaynak_gonderim_id VARCHAR(191) NULL,
  onaylayan_id VARCHAR(80) NULL, onaylayan_adi VARCHAR(150) NULL, onaylanma_zamani VARCHAR(40) NULL,
  guncellenme_zamani VARCHAR(40) NOT NULL,
  PRIMARY KEY (okul_id, kayit_id), KEY idx_etkinlik_tarih (okul_id, tarih),
  KEY idx_etkinlik_ogrenci (okul_id, ogrenci_id),
  CONSTRAINT fk_etkinlik_okul FOREIGN KEY (okul_id) REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS optik_yoklama_kayitlari (
  okul_id VARCHAR(20) NOT NULL, kayit_id VARCHAR(191) NOT NULL, tarih VARCHAR(20) NULL,
  sinif_id VARCHAR(80) NULL, sinif_adi VARCHAR(80) NULL, kaynak_adi TEXT NULL,
  olusturulma_zamani VARCHAR(40) NULL, gonderilme_zamani VARCHAR(40) NULL, baglanti_id VARCHAR(191) NULL,
  guncellenme_zamani VARCHAR(40) NOT NULL,
  PRIMARY KEY (okul_id, kayit_id), KEY idx_optik_yoklama_tarih (okul_id, tarih),
  KEY idx_optik_yoklama_sinif (okul_id, sinif_id),
  CONSTRAINT fk_optik_yoklama_okul FOREIGN KEY (okul_id) REFERENCES okullar (okul_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS optik_yoklama_ogrencileri (
  okul_id VARCHAR(20) NOT NULL, kayit_id VARCHAR(191) NOT NULL, sira_no SMALLINT UNSIGNED NOT NULL,
  ogrenci_id VARCHAR(80) NULL, ogrenci_adi VARCHAR(150) NULL, okul_numarasi VARCHAR(30) NULL,
  PRIMARY KEY (okul_id, kayit_id, sira_no), KEY idx_optik_yoklama_ogrenci (okul_id, ogrenci_id),
  CONSTRAINT fk_optik_yoklama_ogrenci FOREIGN KEY (okul_id, kayit_id)
    REFERENCES optik_yoklama_kayitlari (okul_id, kayit_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS optik_yoklama_ogrenci_dersleri (
  okul_id VARCHAR(20) NOT NULL, kayit_id VARCHAR(191) NOT NULL,
  ogrenci_sira_no SMALLINT UNSIGNED NOT NULL, sira_no SMALLINT UNSIGNED NOT NULL, ders_saati INT NOT NULL,
  PRIMARY KEY (okul_id, kayit_id, ogrenci_sira_no, sira_no),
  CONSTRAINT fk_optik_yoklama_ogrenci_ders FOREIGN KEY (okul_id, kayit_id, ogrenci_sira_no)
    REFERENCES optik_yoklama_ogrencileri (okul_id, kayit_id, sira_no) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
