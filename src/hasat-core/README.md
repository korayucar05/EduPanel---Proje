# e-Nstitü Core

Bu klasör e-Nstitü'ın ortak tasarım, analiz ve rapor altyapısını içerir.

## Kurallar
- Yeni rapor kartları `ReportCard` kullanır.
- Özet göstergeler `MetricCard` kullanır.
- Durum/risk etiketleri `StatusBadge` kullanır.
- Eğilim hesapları `analytics/trend.ts` üzerinden yapılır.
- Risk hesapları `analytics/risk.ts` üzerinden yapılır.
- Modüle özel iş kuralları ortak çekirdeğe taşınmadan önce en az iki yerde kullanılmalıdır.

## İlk geçiş
Bireysel Karne V2 ve Premium ikinci sayfa ortak kart altyapısına bağlanmıştır.
Mevcut görünüm ve PDF/WhatsApp akışı korunmuştur.
