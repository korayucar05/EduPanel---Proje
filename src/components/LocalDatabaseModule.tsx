import React, { useState, useEffect } from "react";
import {
  Database,
  HardDrive,
  RefreshCw,
  Trash2,
  Download,
  Upload,
  AlertTriangle,
  FileJson,
  CheckCircle2,
  Cloud,
  Loader2,
  Activity,
  ShieldCheck,
} from "lucide-react";
import { googleSignIn, uploadFileToDrive, listFilesInFolder, downloadFileContentFromDrive, getOrCreateBackupFolder } from "../lib/googleDrive";
import { createLocalDatabaseBackup } from "../core/data/LegacyDatabaseFacade";
import { getSqliteStorageSnapshot } from "../core/state/SyncStateStore";
import { clearDataDiagnostics, getDataDiagnostics, hasatDataStore, inferDataHealth } from "../core/data";

import { sqliteStorage } from "../core/state/SyncStateStore";
export default function LocalDatabaseModule() {
  const [storageItems, setStorageItems] = useState<
    { key: string; size: number; count?: number }[]
  >([]);
  const [totalSize, setTotalSize] = useState(0);
  const [notification, setNotification] = useState("");
  const [importData, setImportData] = useState("");
  const [showImport, setShowImport] = useState(false);
  
  // Google Drive state
  const [driveFiles, setDriveFiles] = useState<{ id: string; name: string; createdTime?: string }[]>([]);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [dataEvents, setDataEvents] = useState(() => getDataDiagnostics());
  const [isMigrating, setIsMigrating] = useState(false);

  const calculateStorage = () => {
    let size = 0;
    const items: Array<{ key: string; size: number; count?: number }> = [];

    for (const { key, value: item } of getSqliteStorageSnapshot()) {
      const itemSize = new Blob([item]).size;
      size += itemSize;

      let count: number | undefined = undefined;
      try {
        const parsed = JSON.parse(item);
        if (Array.isArray(parsed)) count = parsed.length;
        else if (typeof parsed === "object" && parsed !== null) count = Object.keys(parsed).length;
      } catch { /* Not JSON */ }

      items.push({ key, size: itemSize, count });
    }

    setStorageItems(items.sort((a, b) => b.size - a.size));
    setTotalSize(size);
  };

  useEffect(() => {
    calculateStorage();
    setDataEvents(getDataDiagnostics());
  }, []);

  const refreshDiagnostics = () => setDataEvents(getDataDiagnostics());
  const dataHealth = inferDataHealth(dataEvents);

  const handleMigrateLegacyCoreData = async () => {
    const keys = [
      "school_students",
      "school_teachers",
      "school_classrooms",
      "school_courses",
      "custom_created_courses",
      "school_announcements",
      "exams",
      "behaviorRecords",
      "disciplineWarnings",
    ];

    setIsMigrating(true);
    try {
      let migrated = 0;
      for (const key of keys) {
        const result = await hasatDataStore.read<any>(key, {
          fallback: null,
          legacyLocalStorageKey: key,
          validate: (value): value is any => value !== null && value !== undefined,
          migrateLegacy: true,
        });
        if (result.migrated) migrated += 1;
      }
      calculateStorage();
      refreshDiagnostics();
      triggerNotification(`${migrated} eski veri grubu ortak veri katmanına taşındı.`);
    } catch (error: any) {
      alert("Veri taşıma tamamlanamadı: " + (error?.message || String(error)));
    } finally {
      setIsMigrating(false);
    }
  };

  const triggerNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3000);
  };

  const handleSqliteBackup = async () => {
    try {
      setIsDriveLoading(true);
      const result = await createLocalDatabaseBackup();
      triggerNotification(`SQLite yedeği oluşturuldu: ${result.filename}`);
    } catch (error: any) {
      alert("SQLite yedeği oluşturulamadı: " + error.message);
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleClearKey = (key: string) => {
    if (
      window.confirm(
        `"${key}" verisini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      )
    ) {
      sqliteStorage.removeItem(key);
      calculateStorage();
      triggerNotification(`"${key}" verisi silindi.`);
    }
  };

  const handleClearAll = () => {
    if (
      window.confirm(
        "TÜM YEREL DEPO VERİSİNİ SİLMEK istediğinize emin misiniz? Tüm öğrenciler, öğretmenler, sınıflar ve ayarlarınız KALICI OLARAK SİLİNECEKTİR!",
      )
    ) {
      sqliteStorage.clear();
      calculateStorage();
      triggerNotification("Tüm yerel veriler temizlendi.");
      window.location.reload();
    }
  };

  const handleExport = () => {
    const backup: Record<string, string> = {};
    for (const { key, value } of getSqliteStorageSnapshot()) backup[key] = value;

    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(backup, null, 2));
    const dt = new Date();
    const filename = `okul_yonetim_sistemi_yedek_${dt.toISOString().split("T")[0]}.json`;

    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", filename);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();

    triggerNotification("Veritabanı yedeği indirildi.");
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importData);
      if (typeof parsed !== "object" || parsed === null)
        throw new Error("Geçersiz format");

      if (window.confirm("Mevcut verilerin üzerine yazılacak. Emin misiniz?")) {
        Object.keys(parsed).forEach((key) => {
          try {
            sqliteStorage.setItem(key, parsed[key]);
          } catch (e) {
            console.error(`Failed to import key ${key}:`, e);
          }
        });
        calculateStorage();
        setShowImport(false);
        setImportData("");
        triggerNotification("Yedek başarıyla yüklendi.");
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (e) {
      alert(
        "Geçersiz JSON formatı. Lütfen export edilen geçerli bir yedek dosyasının içeriğini yapıştırın.",
      );
    }
  };

  // Format bytes to KB or MB
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + " Bytes";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + " KB";
    else return (bytes / 1048576).toFixed(2) + " MB";
  };

  const handleDriveBackup = async () => {
      try {
          setIsDriveLoading(true);
          const result = await googleSignIn();
          if (!result) throw new Error("Google ile giriş yapılamadı.");
          
          const { accessToken } = result;
          const backup: Record<string, string> = {};
          for (const { key, value } of getSqliteStorageSnapshot()) backup[key] = value;
          
          const dataStr = JSON.stringify(backup, null, 2);
          const dt = new Date();
          const filename = `okul_yonetim_sistemi_yedek_${dt.toISOString().split("T")[0]}.json`;
          
          triggerNotification("Google Drive klasörü hazırlanıyor...");
          const folderId = await getOrCreateBackupFolder(accessToken);
          
          triggerNotification("Yedek Google Drive'a yükleniyor...");
          await uploadFileToDrive(accessToken, filename, dataStr, "application/json", folderId);
          
          triggerNotification("Yedek başarıyla Google Drive'a yüklendi!");
      } catch(e: any) {
          alert("Google Drive yedeği alınırken hata: " + e.message);
      } finally {
          setIsDriveLoading(false);
      }
  }

  const handleOpenDriveRestore = async () => {
      try {
          setIsDriveLoading(true);
          const result = await googleSignIn();
          if (!result) throw new Error("Google ile giriş yapılamadı.");
          
          const { accessToken } = result;
          const folderId = await getOrCreateBackupFolder(accessToken);
          const files = await listFilesInFolder(accessToken, folderId);
          setDriveFiles(files);
          setShowDriveModal(true);
      } catch(e: any) {
          alert("Google Drive dosyaları listelenirken hata: " + e.message);
      } finally {
          setIsDriveLoading(false);
      }
  }

  const handleRestoreFromDrive = async (fileId: string) => {
      try {
          setIsDriveLoading(true);
          const result = await googleSignIn();
          if (!result) throw new Error("Google ile giriş yapılamadı.");
          
          const { accessToken } = result;
          const fileContent = await downloadFileContentFromDrive(accessToken, fileId);
          
          const parsed = JSON.parse(fileContent);
          if (typeof parsed !== "object" || parsed === null)
            throw new Error("Geçersiz format");

          if (window.confirm("Seçili Google Drive yedeği ile mevcut verilerin üzerine yazılacak. Emin misiniz?")) {
            Object.keys(parsed).forEach((key) => {
              try {
                sqliteStorage.setItem(key, parsed[key]);
              } catch (e) {
                console.error(`Failed to import key ${key}:`, e);
              }
            });
            calculateStorage();
            setShowDriveModal(false);
            triggerNotification("Google Drive'dan yedek başarıyla yüklendi.");
            setTimeout(() => window.location.reload(), 1500);
          }
      } catch(e: any) {
          alert("Google Drive'dan yedek yüklenirken hata: " + e.message);
      } finally {
          setIsDriveLoading(false);
      }
  }

  return (
    <div className="relative mx-auto max-w-7xl space-y-6 px-6 pb-6 pt-0 lg:px-8 lg:pb-8 lg:pt-0">
      {/* Container to match other modules */}
      <div className="bg-white border-2 border-dashed border-purple-950 rounded-3xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        {/* Left purple area */}
        <div className="bg-purple-950 bg-theme-pattern p-1.5 rounded-2xl flex items-center overflow-x-auto gap-1 w-full flex-1 md:w-auto scrollbar-hide shrink-0 h-[52px]">
          <div className="flex-none flex items-center justify-center gap-1.5 px-4 rounded-xl text-[13px] font-bold transition-all border whitespace-nowrap h-[40px] bg-white text-purple-900 border-transparent shadow-sm">
            <HardDrive className="w-4 h-4 shrink-0 text-purple-900" />
            <span className="truncate">
              Lokal Veritabanı ve Yerel Depo Yönetimi
            </span>
          </div>
        </div>

        <div className="shrink-0 flex flex-wrap items-center gap-2">
          <button
            onClick={handleSqliteBackup}
            disabled={isDriveLoading}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-5 rounded-2xl cursor-pointer flex items-center justify-center gap-2 shadow-md whitespace-nowrap h-[52px] disabled:opacity-50"
          >
            <HardDrive className="w-4 h-4 shrink-0" />
            <span>SQLite Yedeği Al</span>
          </button>
          <button
            onClick={calculateStorage}
            className="flex items-center justify-center bg-purple-900/10 hover:bg-purple-900/20 text-purple-950 font-bold w-[52px] rounded-2xl cursor-pointer transition-all shadow-md shadow-purple-950/5 h-[52px]"
            title="Yenile"
            disabled={isDriveLoading}
          >
            <RefreshCw className={`w-5 h-5 ${isDriveLoading ? "animate-spin opacity-50" : ""}`} />
          </button>

          <button
            onClick={handleExport}
            disabled={isDriveLoading}
            className="bg-purple-950 hover:bg-purple-900 water-ripple-hover text-white font-bold text-xs px-5 rounded-2xl cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-purple-950/10 hover:scale-[1.01] transition-all whitespace-nowrap h-[52px] disabled:opacity-50"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>İndir</span>
          </button>

          <button
            onClick={() => setShowImport(!showImport)}
            disabled={isDriveLoading}
            className="bg-purple-950 hover:bg-purple-900 water-ripple-hover text-white font-bold text-xs px-5 rounded-2xl cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-purple-950/10 hover:scale-[1.01] transition-all whitespace-nowrap h-[52px] disabled:opacity-50"
          >
            <Upload className="w-4 h-4 shrink-0" />
            <span>Yükle</span>
          </button>
          
          <div className="h-8 w-px bg-slate-200 mx-1 hidden md:block"></div>

          <button
            onClick={handleDriveBackup}
            disabled={isDriveLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 rounded-2xl cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 hover:scale-[1.01] transition-all whitespace-nowrap h-[52px] disabled:opacity-50"
          >
            {isDriveLoading ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" /> : <Cloud className="w-4 h-4 shrink-0" />}
            <span>Drive'a Yedekle</span>
          </button>

          <button
            onClick={handleOpenDriveRestore}
            disabled={isDriveLoading}
            className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs px-5 border border-blue-200 rounded-2xl cursor-pointer flex items-center justify-center gap-2 shadow-sm transition-all whitespace-nowrap h-[52px] disabled:opacity-50"
          >
            <Cloud className="w-4 h-4 shrink-0" />
            <span>Drive'dan Yükle</span>
          </button>
        </div>
      </div>

      {notification && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3 text-sm font-semibold shadow-sm animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          {notification}
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
            <Database className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500 mb-0.5">
              Kullanılan Alan
            </p>
            <p className="text-2xl font-black text-slate-800">
              {formatBytes(totalSize)}
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
            <FileJson className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500 mb-0.5">
              Toplam Kayıt (Tablo)
            </p>
            <p className="text-2xl font-black text-slate-800">
              {storageItems.length}
            </p>
          </div>
        </div>

        <div className="bg-rose-50 border border-rose-100 rounded-3xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <h3 className="font-bold text-rose-900 mb-1">Tehlikeli Bölge</h3>
            <p className="text-xs text-rose-700/80 font-medium">
              Bu işlem tüm sistemi sıfırlar.
            </p>
          </div>
          <button
            onClick={handleClearAll}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md transition-all shadow-rose-600/20 flex items-center gap-2 shrink-0"
          >
            <AlertTriangle className="w-4 h-4" />
            Tümünü Sıfırla
          </button>
        </div>
      </div>

      {showImport && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 shadow-sm space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-emerald-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-emerald-600" />
              Yedek Dosyasından İçe Aktar
            </h3>
            <button
              onClick={() => setShowImport(false)}
              className="text-emerald-700 hover:text-emerald-900"
            >
              İptal
            </button>
          </div>
          <p className="text-sm text-emerald-800/80 font-medium pb-2">
            İndirdiğiniz *.json yedek dosyasını bir metin editörü ile açın,
            içindeki tüm metni kopyalayıp aşağıdaki alana yapıştırın ve Geri
            Yükle butonuna basın.
          </p>
          <textarea
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
            className="w-full h-40 px-4 py-3 bg-white border border-emerald-200 rounded-xl font-mono text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            placeholder="{...}"
          ></textarea>
          <div className="flex justify-end pt-2">
            <button
              onClick={handleImport}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-xl shadow-md transition-all"
            >
              Verileri Geri Yükle
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-slate-800">e-Nstitü Veri Sağlığı</h3>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                SQLite, önbellek ve eski tarayıcı kayıtları arasındaki veri hareketlerini izler.
              </p>
            </div>
            <div className={`rounded-2xl px-4 py-2 text-xs font-black ${
              dataHealth.status === "healthy"
                ? "bg-emerald-50 text-emerald-700"
                : dataHealth.status === "warning"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-rose-50 text-rose-700"
            }`}>
              {dataHealth.status === "healthy" ? "Sağlıklı" : dataHealth.status === "warning" ? "Kontrol gerekli" : "Kritik"}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-2xl font-black text-slate-800">{dataHealth.recentOperations}</div>
              <div className="text-xs font-bold text-slate-500">Son işlem</div>
            </div>
            <div className="rounded-2xl bg-rose-50 p-4">
              <div className="text-2xl font-black text-rose-700">{dataHealth.failures}</div>
              <div className="text-xs font-bold text-rose-600">Başarısız işlem</div>
            </div>
            <div className="rounded-2xl bg-amber-50 p-4">
              <div className="text-2xl font-black text-amber-700">{dataHealth.legacyReads}</div>
              <div className="text-xs font-bold text-amber-600">Eski kayıt okuması</div>
            </div>
          </div>

          <div className="mt-5 max-h-52 overflow-auto rounded-2xl border border-slate-100">
            {dataEvents.length > 0 ? dataEvents.slice(0, 12).map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-slate-700">{event.key}</div>
                  <div className="text-[11px] font-semibold text-slate-400">{event.operation} · {event.source} · {event.durationMs.toFixed(1)} ms</div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${event.success ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  {event.success ? "Başarılı" : "Hata"}
                </span>
              </div>
            )) : (
              <div className="p-6 text-center text-sm font-semibold text-slate-400">Henüz veri işlemi kaydı oluşmadı.</div>
            )}
          </div>
        </div>

        <div className="bg-indigo-950 text-white rounded-3xl p-6 shadow-sm">
          <ShieldCheck className="w-8 h-8 text-indigo-200" />
          <h3 className="mt-4 text-lg font-black">Ortak Veri Katmanı</h3>
          <p className="mt-2 text-sm leading-6 text-indigo-100/80">
            Eski sqliteStorage kayıtlarını güvenli biçimde SQLite tabanlı e-Nstitü veri deposuna taşır. Var olan kayıtlar korunur.
          </p>
          <button
            onClick={handleMigrateLegacyCoreData}
            disabled={isMigrating}
            className="mt-5 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-indigo-950 disabled:opacity-60"
          >
            {isMigrating ? "Veriler taşınıyor..." : "Eski çekirdek verileri taşı"}
          </button>
          <button
            onClick={() => { clearDataDiagnostics(); refreshDiagnostics(); }}
            className="mt-2 w-full rounded-2xl border border-white/20 px-4 py-3 text-xs font-bold text-white/80"
          >
            Tanılama geçmişini temizle
          </button>
        </div>
      </div>

      {/* Storage Items List */}
        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden flex flex-col mt-4">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-bold text-slate-800">
            Veritabanı Tabloları (Local Storage Key'leri)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs tracking-wider">
                <th className="p-4 pl-6">Tablo Adı (Key)</th>
                <th className="p-4">Kayıt Sayısı</th>
                <th className="p-4">Boyut</th>
                <th className="p-4 pr-6 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {storageItems.length > 0 ? (
                storageItems.map((item) => (
                  <tr
                    key={item.key}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                          <Database className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-slate-700 text-sm">
                          {item.key}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-sm font-semibold text-slate-600">
                      {item.count !== undefined ? (
                        <span className="bg-slate-100 px-2 py-1 rounded-md text-xs">
                          {item.count} Kayıt
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium text-xs">
                          Yapısal Veri / Tekil
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-sm font-semibold text-slate-500">
                      {formatBytes(item.size)}
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <button
                        onClick={() => handleClearKey(item.key)}
                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all"
                        title="Bu Tabloyu Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="p-8 text-center text-slate-500 text-sm font-medium"
                  >
                    Yerel depoda henüz veri bulunmuyor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showDriveModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 shrink-0">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <Cloud className="w-6 h-6 text-blue-600" />
                Google Drive Yedekleri
              </h3>
              <button
                onClick={() => setShowDriveModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                Kapat
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 pr-2 space-y-3">
              {driveFiles.length > 0 ? (
                driveFiles.map(file => (
                  <div key={file.id} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{file.name}</p>
                      {file.createdTime && (
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">
                          {new Date(file.createdTime).toLocaleString("tr-TR")}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRestoreFromDrive(file.id)}
                      className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer"
                    >
                      Geri Yükle
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center text-slate-500 py-8 text-sm font-semibold">
                  Google Drive'da hiç yedek bulunamadı.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


