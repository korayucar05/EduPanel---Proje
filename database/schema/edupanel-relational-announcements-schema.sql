CREATE TABLE IF NOT EXISTS duyurular (
  okul_id VARCHAR(20) NOT NULL,
  duyuru_id VARCHAR(191) NOT NULL,
  baslik VARCHAR(255) NOT NULL,
  icerik LONGTEXT NOT NULL,
  duyuru_tarihi DATE NULL,
  etiket VARCHAR(40) NOT NULL DEFAULT 'Genel',
  guncellenme_zamani DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (okul_id, duyuru_id),
  KEY idx_duyurular_tarih (okul_id, duyuru_tarihi),
  KEY idx_duyurular_etiket (okul_id, etiket),
  CONSTRAINT fk_duyurular_okul FOREIGN KEY (okul_id)
    REFERENCES okullar (okul_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
