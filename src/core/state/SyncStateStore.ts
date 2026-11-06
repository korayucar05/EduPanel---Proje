/**
 * Senkron state uyumluluk kapısı.
 *
 * Bazı eski React ekranları ilk render sırasında senkron getItem/setItem API'sine
 * ihtiyaç duyuyor. Bu facade yalnız cihaza özgü arayüz tercihlerini
 * tarayıcı localStorage alanında tutar. İş verileri ilişkisel repository'lere aittir.
 *
 * Yeni domain kodunda mümkün olduğunda async Repository/Service tercih edilmelidir.
 */
import {
  flushSqliteStorageBridge,
  getSqliteStorageSnapshot,
  sqliteStorage as sqliteBackedStore,
} from "../../lib/sqliteStorageBridge";

export const syncStateStore = sqliteBackedStore;

// Geriye dönük isim: mevcut bileşenleri davranış değiştirmeden katman arkasına alır.
export const sqliteStorage = syncStateStore;

export const getSyncStateSnapshot = getSqliteStorageSnapshot;
// Backward-compatible export used by LocalDatabaseModule.
export { getSqliteStorageSnapshot };
export const flushSyncStateStore = flushSqliteStorageBridge;

export default syncStateStore;
