import React, { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import localforage from "../core/state/AppStateService";
import { AlertCircle, Download, FileDown, FileSpreadsheet, FileText, GraduationCap, Plus, Save, Search, Trash2, Upload, X } from "lucide-react";
import schoolLogo from "../assets/ordu-lisesi-logo.png";
import { downloadDiplomaPetition, downloadOfficialLearningDocument } from "../pdf";
import { searchLostDocumentRecords, syncCollectionToLocalDatabase, upsertLocalDocument } from "../core/data/LegacyDatabaseFacade";

import { sqliteStorage } from "../core/state/SyncStateStore";
type DocumentType = "tasdikname" | "diploma";
type DataRow = Record<string, string | number>;

const TASDIKNAME_COLUMNS = [
  "TC No", "Adı Soyadı", "Baba Adı", "Ana Adı", "Doğum Yeri", "Doğum Tarihi",
  "Okul Numarası", "Sınıfı", "Tasdikname Tarihi", "Tasdikname No", "Mezun Olduğu Ortaokul",
];

const DIPLOMA_COLUMNS = [
  "TC Kimlik No", "Adı Soyadı", "Baba Adı", "Anne Adı", "Doğum Yeri", "Doğum Tarihi",
  "Öğretim Yılı", "Alanı", "Sınıfı", "Okul Numarası", "Diploma Tarihi", "Diploma No", "Diploma Notu", "Yabancı Dili",
];

const CONFIG = {
  tasdikname: {
    title: "Tasdikname Kayıtları",
    description: "Tasdikname bilgilerini şablonla toplu olarak sisteme aktarın.",
    columns: TASDIKNAME_COLUMNS,
    fileName: "Tasdikname_Kayit_Sablonu.xlsx",
    sheetName: "Tasdikname Kayıtları",
    databaseCollection: "lostDocumentTasdiknameRecords",
  },
  diploma: {
    title: "Diploma Kayıtları",
    description: "Diploma bilgilerini şablonla toplu olarak sisteme aktarın.",
    columns: DIPLOMA_COLUMNS,
    fileName: "Diploma_Kayit_Sablonu.xlsx",
    sheetName: "Diploma Kayıtları",
    databaseCollection: "lostDocumentDiplomaRecords",
  },
} as const;

const formatCurrentDateForDocument = (): string =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());


const readStoredJson = (keys: string[]) => {
  for (const key of keys) {
    try {
      const raw = sqliteStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {}
  }
  return {};
};

const readSchoolProfile = () =>
  readStoredJson(["school_info_a_profile", "school_info", "schoolInfo", "school_profile"]);

const unresolvedPrincipalName = "................................";

const principalNameFromTeachers = (teachers: unknown): string => {
  if (!Array.isArray(teachers)) return "";
  const principal = teachers.find((teacher: any) => {
    const role = String(
      teacher?.adminRole ||
      teacher?.role ||
      teacher?.position ||
      teacher?.title ||
      ""
    ).trim().toLocaleLowerCase("tr-TR");
    const isDeputy = /müdür\s*yardımcısı|mudur\s*yardimcisi|vice|deputy|assistant/.test(role);
    return !isDeputy && (/^müdür$|^mudur$|okul\s*müdürü|okul\s*muduru|principal/.test(role));
  });
  return String(
    principal?.name ||
    principal?.fullName ||
    `${principal?.firstName || ""} ${principal?.lastName || ""}`
  ).trim();
};

const readPrincipalName = (profile: any): string => {
  const directCandidates = [
    profile?.principalName,
    profile?.principalFullName,
    profile?.principal,
    profile?.schoolPrincipal,
    profile?.mudurAdi,
    profile?.mudur,
  ];
  for (const value of directCandidates) {
    const normalized = String(value || "").trim();
    if (normalized && normalized.toLocaleLowerCase("tr-TR") !== "okul müdürü") return normalized;
  }

  try {
    const teachers = JSON.parse(sqliteStorage.getItem("school_teachers") || "[]");
    const name = principalNameFromTeachers(teachers);
    if (name) return name;
  } catch {}

  return unresolvedPrincipalName;
};

export default function LostDocumentsModule() {
  const [activeSection, setActiveSection] = useState<"prepare" | "data">("prepare");
  const [activeType, setActiveType] = useState<DocumentType>("diploma");
  const [recordCounts, setRecordCounts] = useState<Record<DocumentType, number>>({ tasdikname: 0, diploma: 0 });
  const [addingType, setAddingType] = useState<DocumentType | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const tasdiknameInput = useRef<HTMLInputElement>(null);
  const diplomaInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleTabSelected = (event: Event) => {
      const tabId = (event as CustomEvent<{ tabId?: string }>).detail?.tabId;
      if (tabId === "lost-documents") setActiveSection("prepare");
    };
    window.addEventListener("edupanel-tab-selected", handleTabSelected);
    return () => window.removeEventListener("edupanel-tab-selected", handleTabSelected);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadCounts = async () => {
      try {
        const entries = await Promise.all((["tasdikname", "diploma"] as DocumentType[]).map(async (type) => {
          const result = await searchLostDocumentRecords(type, "name", "");
          return [type, result.count] as const;
        }));
        if (!cancelled) setRecordCounts(Object.fromEntries(entries) as Record<DocumentType, number>);
      } catch (error) {
        if (!cancelled) setNotice({ type: "error", text: error instanceof Error ? `Kayıtlar okunamadı: ${error.message}` : "Kayıtlar okunamadı." });
      }
    };
    void loadCounts();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!notice || notice.type === "info") return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const downloadTemplate = (type: DocumentType) => {
    const config = CONFIG[type];
    const worksheet = XLSX.utils.aoa_to_sheet([config.columns]);
    worksheet["!cols"] = config.columns.map((column) => ({ wch: Math.max(15, Math.min(28, column.length + 4)) }));
    worksheet["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(config.columns.length - 1)}1` };
    worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, config.sheetName);
    XLSX.writeFile(workbook, config.fileName);
    setNotice({ type: "success", text: `${config.title} için Excel şablonu indirildi.` });
  };

  const uploadFile = async (type: DocumentType, file?: File) => {
    if (!file) return;
    const config = CONFIG[type];
    setNotice({ type: "info", text: `${file.name} okunuyor ve veritabanına kaydediliyor...` });
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!worksheet) throw new Error("Excel dosyasında çalışma sayfası bulunamadı.");
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "", raw: false });
      const headers = (matrix[0] || []).map((value) => String(value).trim());
      const missing = config.columns.filter((column) => !headers.includes(column));
      if (missing.length) throw new Error(`Eksik sütunlar: ${missing.join(", ")}`);
      const imported = XLSX.utils.sheet_to_json<DataRow>(worksheet, { defval: "", raw: false })
        .filter((row) => config.columns.some((column) => String(row[column] ?? "").trim()));
      await syncCollectionToLocalDatabase(config.databaseCollection, imported);
      setRecordCounts((current) => ({ ...current, [type]: imported.length }));
      setActiveType(type);
      setNotice({
        type: "success",
        text: `${imported.length} ${type === "diploma" ? "diploma" : "tasdikname"} kaydı başarıyla veritabanına yüklendi.`,
      });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Excel dosyası okunamadı." });
    }
  };

  const activeConfig = CONFIG[activeType];

  const addRecord = async (type: DocumentType, record: DataRow) => {
    await upsertLocalDocument(CONFIG[type].databaseCollection, crypto.randomUUID(), record);
    setRecordCounts((current) => ({ ...current, [type]: current[type] + 1 }));
    setActiveType(type);
    setAddingType(null);
    setNotice({ type: "success", text: `Yeni ${type === "diploma" ? "diploma" : "tasdikname"} kaydı eklendi.` });
  };

  const clearRecords = async (type: DocumentType) => {
    const title = type === "diploma" ? "diploma" : "tasdikname";
    if (!window.confirm(`Tüm ${title} kayıtlarını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) return;
    await syncCollectionToLocalDatabase(CONFIG[type].databaseCollection, []);
    setRecordCounts((current) => ({ ...current, [type]: 0 }));
    setNotice({ type: "success", text: `Tüm ${title} kayıtları silindi.` });
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 md:p-7">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 rounded-2xl border border-cyan-100 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setActiveSection("prepare")} className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition ${activeSection === "prepare" ? "bg-cyan-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              <FileSpreadsheet className="h-4 w-4" /> Belge Hazırla
            </button>
            <button onClick={() => setActiveSection("data")} className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition ${activeSection === "data" ? "bg-cyan-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              <FileSpreadsheet className="h-4 w-4" /> Veri Girişi
            </button>
          </div>
        </div>

        {activeSection === "prepare" ? <PrepareDocumentView /> : <>
        <div className="grid gap-4 md:grid-cols-2">
          <DocumentCard
            title={CONFIG.diploma.title}
            description={CONFIG.diploma.description}
            count={recordCounts.diploma}
            active={activeType === "diploma"}
            onOpen={() => setActiveType("diploma")}
            onDownload={() => downloadTemplate("diploma")}
            onUpload={() => diplomaInput.current?.click()}
            onAdd={() => setAddingType("diploma")}
            onClear={() => { void clearRecords("diploma"); }}
            icon={<GraduationCap className="h-5 w-5" />}
          />
          <DocumentCard
            title={CONFIG.tasdikname.title}
            description={CONFIG.tasdikname.description}
            count={recordCounts.tasdikname}
            active={activeType === "tasdikname"}
            onOpen={() => setActiveType("tasdikname")}
            onDownload={() => downloadTemplate("tasdikname")}
            onUpload={() => tasdiknameInput.current?.click()}
            onAdd={() => setAddingType("tasdikname")}
            onClear={() => { void clearRecords("tasdikname"); }}
            icon={<FileSpreadsheet className="h-5 w-5" />}
          />
          <input ref={tasdiknameInput} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => { void uploadFile("tasdikname", event.target.files?.[0]); event.target.value = ""; }} />
          <input ref={diplomaInput} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => { void uploadFile("diploma", event.target.files?.[0]); event.target.value = ""; }} />
        </div>

        {notice && <div role="status" aria-live="polite" className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : notice.type === "info" ? "border-cyan-200 bg-cyan-50 text-cyan-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}><AlertCircle className="h-4 w-4 shrink-0" />{notice.text}</div>}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <FileSpreadsheet className="mx-auto mb-3 h-9 w-9 text-cyan-500" />
          <h2 className="font-bold text-slate-800">{activeConfig.title} veritabanında saklanıyor</h2>
          <p className="mt-1 text-sm text-slate-500">Performans için kayıtlar bu ekranda listelenmez ve tarayıcı belleğine alınmaz.</p>
        </section>
        </>}
        {addingType && <EditRecordModal type={addingType} record={{}} onClose={() => setAddingType(null)} onSave={(record) => addRecord(addingType, record)} title="Yeni Bilgi Ekle" />}
      </div>
    </div>
  );
}

function PrepareDocumentView() {
  const [documentType, setDocumentType] = useState<DocumentType>("diploma");
  const [recordSource, setRecordSource] = useState<"graduate" | "student">("graduate");
  const [searchBy, setSearchBy] = useState<"name" | "number" | "tc">("name");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DataRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<DataRow | null>(null);
  const [editingRecord, setEditingRecord] = useState<DataRow | null>(null);
  const [principalName, setPrincipalName] = useState(() => readPrincipalName(readSchoolProfile()));

  useEffect(() => {
    let cancelled = false;
    void localforage.getItem<unknown>("school_teachers")
      .then((teachers) => {
        const name = principalNameFromTeachers(teachers);
        if (!cancelled && name) {
          setPrincipalName((current) =>
            current && current !== unresolvedPrincipalName ? current : name,
          );
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const tcColumn = documentType === "diploma" ? "TC Kimlik No" : "TC No";

  const normalize = (value: unknown) =>
    String(value ?? "").trim().toLocaleLowerCase("tr-TR");

  const studentName = (student: any) => {
    const first = String(student?.firstName || student?.givenName || student?.ad || student?.isim || "").trim();
    const last = String(student?.lastName || student?.surname || student?.soyad || student?.soyadi || "").trim();
    return String(
      student?.name ||
      student?.studentName ||
      student?.fullName ||
      student?.adSoyad ||
      `${first} ${last}`.trim() ||
      ""
    ).trim();
  };

  const studentNumber = (student: any) =>
    String(
      student?.number ||
      student?.studentNumber ||
      student?.schoolNumber ||
      student?.studentNo ||
      student?.no ||
      (String(student?.id || "").match(/^\d+$/) ? student?.id : "") ||
      ""
    ).trim();

  const studentClassroom = (student: any) =>
    String(
      student?.classroom ||
      student?.classroomName ||
      student?.className ||
      student?.branch ||
      student?.sinif ||
      student?.sube ||
      ""
    ).trim();

  const studentTc = (student: any) =>
    String(
      student?.tcKimlikNo ||
      student?.tcKimlikNumarasi ||
      student?.tcNo ||
      student?.tckn ||
      student?.nationalId ||
      student?.identityNumber ||
      student?.identityNo ||
      ""
    ).trim();

  const mapStudentToDocumentRecord = (student: any): DataRow => {
    const record: DataRow = {
      "Adı Soyadı": studentName(student),
      "Okul Numarası": studentNumber(student),
      "Sınıfı": studentClassroom(student),
      __source: "student",
      __sourceStudentId: String(student?.id || student?.studentId || student?.__documentId || "").trim(),
    };
    const tc = studentTc(student);
    if (tc) record[tcColumn] = tc;

    const father = String(student?.fatherName || student?.babaAdi || student?.father || "").trim();
    const mother = String(student?.motherName || student?.anneAdi || student?.mother || "").trim();
    const birthPlace = String(student?.birthPlace || student?.dogumYeri || "").trim();
    const birthDate = String(student?.birthDate || student?.dogumTarihi || "").trim();
    if (father) record["Baba Adı"] = father;
    if (mother) record[documentType === "diploma" ? "Anne Adı" : "Ana Adı"] = mother;
    if (birthPlace) record["Doğum Yeri"] = birthPlace;
    if (birthDate) record["Doğum Tarihi"] = birthDate;
    return record;
  };

  const matchesStudent = (student: any, searched: string) => {
    const q = normalize(searched);
    if (!q) return false;
    if (searchBy === "number") return normalize(studentNumber(student)).includes(q);
    if (searchBy === "tc") return normalize(studentTc(student)).includes(q);
    return normalize(studentName(student)).includes(q);
  };

  const readCollection = async (collection: string): Promise<any[]> => {
    const response = await fetch(`/api/database/collections/${encodeURIComponent(collection)}`, { cache: "no-store" });
    if (!response.ok) return [];
    const payload = await response.json().catch(() => []);
    return Array.isArray(payload) ? payload : [];
  };

  useEffect(() => {
    const searched = query.trim();
    setSelectedRecord(null);
    setEditingRecord(null);
    setSearchError("");
    if (!searched && recordSource === "student") {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const documentPromise: Promise<DataRow[]> = recordSource === "student"
          ? Promise.resolve([])
          : searchLostDocumentRecords(documentType, searchBy, searched)
              .then((response) => (response.records || []) as DataRow[]);

        const studentsPromise = (async (): Promise<DataRow[]> => {
          if (recordSource !== "student") return [];
          let students: any[] = [];

          if (searchBy === "name") {
            try {
              const response = await fetch(`/api/students/search?q=${encodeURIComponent(searched)}`, { cache: "no-store" });
              if (response.ok) {
                const payload = await response.json().catch(() => ({}));
                if (Array.isArray(payload?.records)) students = payload.records;
              }
            } catch {}
          }

          if (searchBy !== "name" || students.length === 0) {
            const [canonical, legacy] = await Promise.all([
              readCollection("students").catch(() => []),
              readCollection("school_students").catch(() => []),
            ]);
            students = [...canonical, ...legacy];
          }

          const seen = new Set<string>();
          return students
            .filter((student) => matchesStudent(student, searched))
            .map((student) => mapStudentToDocumentRecord(student))
            .filter((record) => {
              const key = [record[tcColumn], record["Okul Numarası"], record["Adı Soyadı"], record["Sınıfı"]]
                .map((value) => normalize(value))
                .join("|");
              if (!key.replace(/\|/g, "") || seen.has(key)) return false;
              seen.add(key);
              return true;
            })
            .slice(0, 100);
        })();

        const [documentRowsRaw, studentRows] = await Promise.all([documentPromise, studentsPromise]);
        const documentRows = documentRowsRaw.map((record) => ({ ...record, __source: "document" }));
        const merged: DataRow[] = [];
        const seen = new Set<string>();

        for (const record of [...documentRows, ...studentRows]) {
          const key = [record[tcColumn], record["Okul Numarası"], record["Adı Soyadı"], record["Sınıfı"]]
            .map((value) => normalize(value))
            .join("|");
          if (!key.replace(/\|/g, "") || seen.has(key)) continue;
          seen.add(key);
          merged.push(record);
        }

        if (!cancelled) setResults(merged);
      } catch (error) {
        if (!cancelled) {
          setResults([]);
          setSearchError(error instanceof Error ? error.message : "Kayıtlar aranamadı.");
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [documentType, query, recordSource, searchBy]);

  const changeDocumentType = (type: DocumentType) => {
    setDocumentType(type);
    setQuery("");
    setResults([]);
    setSelectedRecord(null);
    setEditingRecord(null);
  };

  const changeRecordSource = (source: "graduate" | "student") => {
    setRecordSource(source);
    setQuery("");
    setResults([]);
    setSelectedRecord(null);
    setEditingRecord(null);
  };

  const saveEditedRecord = async (edited: DataRow) => {
    if (!editingRecord) return;
    const documentId = String(editingRecord.__documentId || "").trim() || crypto.randomUUID();
    const {
      __documentId: _ignoredDocumentId,
      __source: _ignoredSource,
      __sourceStudentId: _ignoredSourceStudentId,
      ...databaseRecord
    } = edited;
    await upsertLocalDocument(CONFIG[documentType].databaseCollection, documentId, databaseRecord);
    const updated: DataRow = { ...databaseRecord, __documentId: documentId, __source: "document" };
    setResults((current) => {
      const sourceStudentId = String(editingRecord.__sourceStudentId || "");
      const next = current.filter((record) => {
        if (String(record.__documentId || "") === documentId) return false;
        if (sourceStudentId && String(record.__sourceStudentId || "") === sourceStudentId) return false;
        return true;
      });
      return [updated, ...next];
    });
    setSelectedRecord(updated);
    setEditingRecord(null);
  };

  const searchLabel = searchBy === "name" ? "Adı Soyadı" : searchBy === "number" ? "Okul Numarası" : "TC Kimlik Numarası";
  const searchPlaceholder = searchBy === "name"
    ? "Öğrencinin adını veya soyadını yazın"
    : searchBy === "number"
      ? "Okul numarasını yazın"
      : "TC kimlik numarasını yazın";

  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4"><h2 className="font-bold text-slate-900">Belge Kaydı Seçin</h2><p className="mt-1 text-sm text-slate-500">Mezun diploma kayıtları varsayılan olarak listelenir. Güncel öğrenciler yalnızca ayrıca seçildiğinde aranır.</p></div>
      <div className="grid gap-3 lg:grid-cols-[minmax(190px,.7fr)_minmax(240px,.8fr)_minmax(190px,.6fr)_minmax(280px,1.4fr)]">
        <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Kayıt kaynağı</span><select value={recordSource} onChange={(event) => changeRecordSource(event.target.value as "graduate" | "student")} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"><option value="graduate">Mezun / diploma listesi</option><option value="student">Güncel öğrenci listesi</option></select></label>
        <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Belge türü</span><select value={documentType} onChange={(event) => changeDocumentType(event.target.value as DocumentType)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"><option value="diploma">Diploma Kayıt Örneği</option><option value="tasdikname">Tasdikname Kayıt Örneği</option></select></label>
        <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Arama yöntemi</span><select value={searchBy} onChange={(event) => { setSearchBy(event.target.value as "name" | "number" | "tc"); setQuery(""); setSelectedRecord(null); }} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"><option value="name">İsim ile ara</option><option value="number">Okul No ile ara</option><option value="tc">TC No ile ara</option></select></label>
        <label><span className="mb-1.5 block text-xs font-bold text-slate-600">{searchLabel}</span><span className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => { setQuery(event.target.value); setSelectedRecord(null); }} placeholder={searchPlaceholder} className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100" /></span></label>
      </div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 p-5"><div><h2 className="font-bold text-slate-900">{recordSource === "graduate" ? "Mezun / Diploma Kayıtları" : "Güncel Öğrenci Kayıtları"}</h2><p className="mt-1 text-xs text-slate-500">{searching ? "Kayıtlar aranıyor..." : query.trim() ? `${results.length} eşleşme bulundu` : recordSource === "graduate" ? results.length === 1000 ? "İlk 1.000 mezun diploma kaydı listeleniyor; daha eski kayıtlar için arama yapın" : `${results.length} mezun diploma kaydı listeleniyor` : "Aramak için ad soyad, okul numarası veya TC numarası yazın"}</p></div>{selectedRecord && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Belge için seçildi</span>}</div>
      {searchError ? <div className="p-8 text-center text-sm font-medium text-rose-600">{searchError}</div>
      : results.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center p-8 text-center"><AlertCircle className="mb-3 h-9 w-9 text-amber-400" /><p className="font-bold text-slate-600">{searching ? "Aranıyor..." : query.trim() ? "Eşleşen kayıt bulunamadı" : recordSource === "graduate" ? "Kayıtlı mezun diploma bilgisi bulunamadı" : "Arama yapın"}</p><p className="mt-1 text-sm text-slate-400">{query.trim() ? "Ad soyad, okul numarası veya TC bilgisini kontrol edin." : recordSource === "graduate" ? "Mezun listesi diploma kayıtlarından okunur." : "Güncel öğrenci listesinde arama yapabilirsiniz."}</p></div>
      : <div className="divide-y divide-slate-100">{results.map((record, index) => { const isSelected = selectedRecord === record; const source = String(record.__source || "document"); return <button key={`${String(record.__documentId || record.__sourceStudentId || index)}-${index}`} onClick={() => { setSelectedRecord(record); setEditingRecord(record); }} className={`grid w-full gap-3 p-4 text-left transition sm:grid-cols-[1.5fr_.8fr_.8fr_auto] sm:items-center ${isSelected ? "bg-cyan-50" : "hover:bg-slate-50"}`}><div><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-800">{String(record["Adı Soyadı"] || "-")}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${source === "document" ? "bg-cyan-50 text-cyan-700" : "bg-amber-50 text-amber-700"}`}>{source === "document" ? "Belge kaydı" : "Öğrenci listesi"}</span></div><p className="mt-1 text-xs text-slate-400">{String(record["Sınıfı"] || "Sınıf bilgisi yok")}</p></div><div><p className="text-xs font-medium text-slate-400">Okul Numarası</p><p className="mt-0.5 text-sm font-medium text-slate-700">{String(record["Okul Numarası"] || "-")}</p></div><div><p className="text-xs font-medium text-slate-400">TC No</p><p className="mt-0.5 text-sm font-medium text-slate-700">{String(record[tcColumn] || "-")}</p></div><span className={`rounded-lg px-3 py-2 text-xs font-bold ${isSelected ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-600"}`}>{isSelected ? "Düzenle" : "Seç"}</span></button>; })}</div>}
    </section>
    {documentType === "diploma" && selectedRecord && <DiplomaPdfDocument record={selectedRecord} principalName={principalName} />}
    {documentType === "tasdikname" && selectedRecord && <TasdiknamePdfDocument record={selectedRecord} principalName={principalName} />}
    {editingRecord && <EditRecordModal type={documentType} record={editingRecord} onClose={() => setEditingRecord(null)} onSave={saveEditedRecord} title={String(editingRecord.__source || "") === "student" ? "Öğrenci Bilgilerini Belge Kaydına Dönüştür" : "Kişi Bilgilerini Düzenle"} />}
  </div>;
}

function EditRecordModal({ type, record, onClose, onSave, title = "Kişi Bilgilerini Düzenle" }: { type: DocumentType; record: DataRow; onClose: () => void; onSave: (record: DataRow) => Promise<void>; title?: string }) {
  const [form, setForm] = useState<DataRow>({ ...record });
  const [saving, setSaving] = useState(false);
  const [assistantPrincipals, setAssistantPrincipals] = useState<string[]>([]);
  const columns = CONFIG[type].columns;
  useEffect(() => {
    let cancelled = false;
    localforage.getItem<Array<{ name?: string; adminRole?: string }>>("school_teachers").then((teachers) => {
      if (cancelled) return;
      const names = (teachers || [])
        .filter((teacher) => teacher.adminRole === "Müdür Yardımcısı")
        .map((teacher) => String(teacher.name || "").trim())
        .filter(Boolean);
      setAssistantPrincipals([...new Set(names)]);
    }).catch(() => setAssistantPrincipals([]));
    return () => { cancelled = true; };
  }, []);
  const handleSave = async () => {
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="font-bold text-slate-900">{title}</h2><p className="mt-0.5 text-xs text-slate-500">Bilgiler kaydedildiğinde belge kayıtlarına ve ön izlemesine uygulanır.</p></div><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button></div>
      <div className="grid flex-1 gap-4 overflow-y-auto p-5 sm:grid-cols-2">{columns.map((column) => <label key={column} className={column === "Mezun Olduğu Ortaokul" ? "sm:col-span-2" : ""}><span className="mb-1.5 block text-xs font-bold text-slate-600">{column}</span><input value={String(form[column] ?? "")} onChange={(event) => setForm((current) => ({ ...current, [column]: event.target.value }))} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100" /></label>)}
        <div className="grid gap-4 border-t border-slate-200 pt-4 sm:col-span-2 sm:grid-cols-2">
          <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Müdür Yardımcısı</span><select value={String(form.__assistantPrincipal ?? "")} onChange={(event) => setForm((current) => ({ ...current, __assistantPrincipal: event.target.value }))} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"><option value="">Müdür yardımcısı seçin</option>{assistantPrincipals.map((name) => <option key={name} value={name}>{name}</option>)}</select>{assistantPrincipals.length === 0 && <span className="mt-1 block text-[11px] text-amber-600">Personel kayıtlarında müdür yardımcısı bulunamadı.</span>}</label>
          <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Sayı</span><div className="flex h-10 overflow-hidden rounded-xl border border-slate-200 focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-100"><span className="flex items-center bg-slate-100 px-3 text-sm font-bold text-slate-600">E-33147656-</span><input value={String(form.__documentNumber ?? "")} onChange={(event) => setForm((current) => ({ ...current, __documentNumber: event.target.value }))} placeholder="Sayıyı girin" className="min-w-0 flex-1 px-3 text-sm text-slate-700 outline-none" /></div></label>
        </div>
        {type === "diploma" && <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:col-span-2">
          <div><h3 className="text-sm font-bold text-amber-900">Dilekçe Bilgileri</h3><p className="mt-1 text-xs text-amber-700">Diplomasını kaybeden kişi için hazırlanacak dilekçede kullanılacaktır.</p></div>
          <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Belgenin düzenlenme sebebi</span><textarea value={String(form.__documentReason ?? "")} onChange={(event) => setForm((current) => ({ ...current, __documentReason: event.target.value }))} rows={3} placeholder="Belgenin neden istendiğini yazın" className="w-full resize-y rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" /></label>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700"><input type="checkbox" checked={String(form.__requesterIsSelf ?? "") === "true"} onChange={(event) => setForm((current) => ({ ...current, __requesterIsSelf: event.target.checked ? "true" : "false", ...(event.target.checked ? { __requesterName: "", __requesterRelationship: "" } : {}) }))} className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500" />Belgeyi isteyen, adına belge düzenlenen kişinin kendisidir</label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Belgeyi isteyenin Adı Soyadı</span><input disabled={String(form.__requesterIsSelf ?? "") === "true"} value={String(form.__requesterIsSelf ?? "") === "true" ? String(form["Adı Soyadı"] || "") : String(form.__requesterName ?? "")} onChange={(event) => setForm((current) => ({ ...current, __requesterName: event.target.value }))} placeholder="Ad Soyad" className="h-10 w-full rounded-xl border border-amber-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500" /></label>
            <label><span className="mb-1.5 block text-xs font-bold text-slate-600">Yakınlığı</span><input disabled={String(form.__requesterIsSelf ?? "") === "true"} value={String(form.__requesterIsSelf ?? "") === "true" ? "Kendisi" : String(form.__requesterRelationship ?? "")} onChange={(event) => setForm((current) => ({ ...current, __requesterRelationship: event.target.value }))} placeholder="Örn: Annesi, Babası, Velisi" className="h-10 w-full rounded-xl border border-amber-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500" /></label>
          </div>
        </div>}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4"><button onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[16.67px] font-bold text-slate-600 hover:bg-slate-100">Vazgeç</button><button disabled={saving} onClick={() => { void handleSave(); }} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-cyan-700 disabled:opacity-60"><Save className="h-4 w-4" />{saving ? "Kaydediliyor..." : "Kaydet"}</button></div>
    </div>
  </div>;
}

function TasdiknamePdfDocument({ record, principalName }: { record: DataRow; principalName: string }) {
  const profile = readSchoolProfile();
  const school = profile.officialName || profile.schoolName || "Ordu Lisesi";
  const principal = principalName || readPrincipalName(profile);
  const tc = String(record["TC No"] || "");
  const fullName = String(record["Adı Soyadı"] || "");
  const certificateDate = String(record["Tasdikname Tarihi"] || "");
  const certificateNo = String(record["Tasdikname No"] || "");
  const assistantPrincipal = String(record.__assistantPrincipal || "................................");
  const documentNumber = String(record.__documentNumber || "................");
  const rows = [
    ["T.C. KİMLİK NO", tc], ["ADI SOYADI", fullName], ["BABA ADI", record["Baba Adı"]], ["ANNE ADI", record["Ana Adı"]],
    ["DOĞUM YERİ VE TARİHİ", `${record["Doğum Yeri"] || ""} / ${record["Doğum Tarihi"] || ""}`], ["OKULU", school],
    ["SINIFI VE OKUL NO", `${record["Sınıfı"] || ""} / ${record["Okul Numarası"] || ""}`], ["TASDİKNAME TARİHİ", certificateDate],
    ["TASDİKNAME NUMARASI", certificateNo], ["DAHA ÖNCE MEZUN OLDUĞU OKUL", record["Mezun Olduğu Ortaokul"]],
  ];
  const downloadPdf = async () => {
    await downloadOfficialLearningDocument({
      filename: `Tasdikname_Kayit_Ornegi_${tc || fullName}.pdf`,
      logoUrl: schoolLogo,
      institutionLine: String(profile.instLine2 || "ALTINORDU KAYMAKAMLIĞI"),
      schoolName: school,
      documentNumber,
      documentDate: formatCurrentDateForDocument(),
      title: "ÖĞRENİM BELGESİ",
      subtitle: "(Tasdiknamesini Kaybedenlere Mahsus)",
      rows,
      paragraph: `Yukarıda açık kimliği yazılı ${tc} kimlik numaralı ${fullName}, ${certificateDate} tarih ve ${certificateNo} sayılı tasdikname ile okulumuzla ilişiği kesilmiştir. İşbu belge ilgilinin isteği üzerine düzenlenmiştir.`,
      assistantPrincipal,
      principal,
      footer: { address: profile.address, phone: profile.phone, email: profile.email, website: profile.website, mebCode: profile.mebCode },
    });
  };
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-slate-900">Tasdikname Kayıt Örneği Ön İzleme</h2><p className="text-xs text-slate-500">Örnek PDF düzenine göre hazırlanmıştır.</p></div><button onClick={downloadPdf} className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-[16.67px] font-bold text-white hover:bg-rose-700"><FileDown className="h-4 w-4" /> PDF Dökümü Al</button></div>
    <div className="overflow-x-auto rounded-xl bg-slate-100 p-4"><div id="tasdikname-pdf-document" style={{ width: "794px", minHeight: "1123px", margin: "0 auto", background: "white", color: "#111", padding: "52px 58px 40px", boxSizing: "border-box", fontFamily: "Times New Roman, serif", fontSize: "16px" }}>
      <div style={{ position: "relative", minHeight: "125px", textAlign: "center" }}><img src={schoolLogo} style={{ position: "absolute", left: "8px", top: "0", width: "105px", height: "105px", objectFit: "contain" }} /><div style={{ fontSize: "17px", lineHeight: 1.35 }}><div>T.C.</div><div style={{ fontWeight: 700 }}>{profile.instLine2 || "ALTINORDU KAYMAKAMLIĞI"}</div><div>İlçe Millî Eğitim Müdürlüğü</div><div>{school}</div></div></div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", lineHeight: 1.4 }}><div><div>Sayı&nbsp;&nbsp;&nbsp;: E-33147656-{documentNumber}</div><div>Konu&nbsp; : Öğrenim Durum Belgesi</div></div><div>{formatCurrentDateForDocument()}</div></div>
      <div style={{ margin: "60px 0 34px", textAlign: "center", fontWeight: 700, fontSize: "18px", lineHeight: 1.25 }}><div>ÖĞRENİM BELGESİ</div><div>(Tasdiknamesini Kaybedenlere Mahsus)</div></div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "15px", lineHeight: 1.05 }}><tbody>{rows.map(([label, value]) => <tr key={String(label)}><td style={{ width: "44%", border: "1px solid #111", padding: "1px 7px 4px", fontWeight: 700, verticalAlign: "top" }}>{String(label)}</td><td style={{ border: "1px solid #111", padding: "1px 7px 4px", fontWeight: 700, verticalAlign: "top" }}>{String(value || "")}</td></tr>)}</tbody></table>
      <p style={{ marginTop: "30px", textAlign: "justify", lineHeight: 1.35, textIndent: "70px" }}>Yukarıda açık kimliği yazılı <b>{tc}</b> kimlik numaralı <b>{fullName}</b>, <b>{certificateDate}</b> tarih ve <b>{certificateNo}</b> sayılı tasdikname ile okulumuzla ilişiği kesilmiştir. İşbu belge ilgilinin isteği üzerine düzenlenmiştir.</p>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "70px", padding: "0 5px", fontWeight: 700, textAlign: "center" }}><div><div>{assistantPrincipal}</div><div>Müdür Yardımcısı</div></div><div><div>{principal}</div><div>Okul Müdürü</div></div></div>
      <div style={{ marginTop: "150px", borderTop: "1px solid #bbb", paddingTop: "10px", display: "flex", justifyContent: "space-between", fontSize: "11px", lineHeight: 1.3 }}><div>Adres: {profile.address || "-"}<br />Telefon: {profile.phone || "-"}<br />E-posta: {profile.email || "-"}</div><div style={{ textAlign: "right" }}>Web: {profile.website || "-"}<br />MEB Kodu: {profile.mebCode || "-"}<br />Belge elektronik ortamda hazırlanmıştır.</div></div>
    </div></div>
  </section>;
}

function DiplomaPdfDocument({ record, principalName }: { record: DataRow; principalName: string }) {
  const profile = readSchoolProfile();
  const school = profile.officialName || profile.schoolName || "Ordu Lisesi";
  const principal = principalName || readPrincipalName(profile);
  const tc = String(record["TC Kimlik No"] || "");
  const fullName = String(record["Adı Soyadı"] || "");
  const educationYear = String(record["Öğretim Yılı"] || "");
  const diplomaDate = String(record["Diploma Tarihi"] || "");
  const diplomaNo = String(record["Diploma No"] || "");
  const assistantPrincipal = String(record.__assistantPrincipal || "................................");
  const documentNumber = String(record.__documentNumber || "................");
  const documentReason = String(record.__documentReason || "").trim();
  const requesterIsSelf = String(record.__requesterIsSelf || "") === "true";
  const requesterName = requesterIsSelf ? fullName : String(record.__requesterName || "").trim();
  const requesterRelationship = requesterIsSelf ? "" : String(record.__requesterRelationship || "").trim();
  const rows = [
    ["T.C. KİMLİK NO", tc], ["ADI SOYADI", fullName], ["BABA ADI", record["Baba Adı"]], ["ANNE ADI", record["Anne Adı"]],
    ["DOĞUM YERİ VE TARİHİ", `${record["Doğum Yeri"] || ""} / ${record["Doğum Tarihi"] || ""}`], ["OKULU", school],
    ["SINIFI VE OKUL NO", `${record["Sınıfı"] || ""} / ${record["Okul Numarası"] || ""}`], ["DİPLOMA TARİHİ", diplomaDate],
    ["DİPLOMA NUMARASI", diplomaNo], ["DİPLOMA NOTU", record["Diploma Notu"]], ["ÖĞRETİM YILI", educationYear], ["MEZUNİYET ALANI", record["Alanı"]], ["YABANCI DİL", record["Yabancı Dili"]],
  ];
  const downloadPdf = async () => {
    await downloadOfficialLearningDocument({
      filename: `Diploma_Kayit_Ornegi_${tc || fullName}.pdf`,
      logoUrl: schoolLogo,
      institutionLine: String(profile.instLine2 || "ALTINORDU KAYMAKAMLIĞI"),
      schoolName: school,
      documentNumber,
      documentDate: formatCurrentDateForDocument(),
      title: "ÖĞRENİM BELGESİ",
      subtitle: "(Diplomasını Kaybedenlere Mahsus)",
      rows,
      paragraph: `Yukarıda açık kimliği yazılı ${tc} kimlik numaralı ${fullName}, ${educationYear} öğretim yılında ${diplomaDate} tarih ve ${diplomaNo} sayılı lise diploması ile okulumuzdan mezun olmuştur. İşbu belge ilgilinin isteği üzerine düzenlenmiştir.`,
      assistantPrincipal,
      principal,
      note: "Not: İşbu Mezuniyet Belgesi Ortaöğretim Kurumları Yönetmeliğinin ilgili maddesi gereği bir defaya mahsus olarak düzenlenmektedir.",
      footer: { address: profile.address, phone: profile.phone, email: profile.email, website: profile.website, mebCode: profile.mebCode },
    });
  };
  const downloadPetition = async () => {
    if (!documentReason || !requesterName || (!requesterIsSelf && !requesterRelationship)) {
      window.alert("Dilekçe oluşturmak için kişi düzenleme penceresindeki dilekçe bilgilerini eksiksiz doldurun.");
      return;
    }
    await downloadDiplomaPetition({
      filename: `Diploma_Dilekcesi_${tc || fullName}.pdf`,
      schoolName: school,
      educationYear,
      graduateName: fullName,
      reason: documentReason,
      requesterName,
      requesterRelationship,
      documentDate: formatCurrentDateForDocument(),
    });
  };
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-slate-900">Diploma Kayıt Örneği Ön İzleme</h2><p className="text-xs text-slate-500">Öğrenim belgesi ve başvuru dilekçesi birlikte hazırlanabilir.</p></div><div className="flex flex-col gap-2 sm:flex-row"><button onClick={() => { void downloadPetition(); }} className="flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-[16.67px] font-bold text-white hover:bg-amber-700"><FileText className="h-4 w-4" /> Dilekçe PDF</button><button onClick={downloadPdf} className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-[16.67px] font-bold text-white hover:bg-rose-700"><FileDown className="h-4 w-4" /> Öğrenim Belgesi PDF</button></div></div>
    <div className="overflow-x-auto rounded-xl bg-slate-100 p-4"><div id="diploma-pdf-document" style={{ width: "794px", minHeight: "1123px", margin: "0 auto", background: "white", color: "#111", padding: "52px 58px 40px", boxSizing: "border-box", fontFamily: "Times New Roman, serif", fontSize: "16px" }}>
      <div style={{ position: "relative", minHeight: "125px", textAlign: "center" }}><img src={schoolLogo} style={{ position: "absolute", left: "8px", top: "0", width: "105px", height: "105px", objectFit: "contain" }} /><div style={{ fontSize: "17px", lineHeight: 1.35 }}><div>T.C.</div><div style={{ fontWeight: 700 }}>{profile.instLine2 || "ALTINORDU KAYMAKAMLIĞI"}</div><div>İlçe Millî Eğitim Müdürlüğü</div><div>{school}</div></div></div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", lineHeight: 1.4 }}><div><div>Sayı&nbsp;&nbsp;&nbsp;: E-33147656-{documentNumber}</div><div>Konu&nbsp; : Öğrenim Durum Belgesi</div></div><div>{formatCurrentDateForDocument()}</div></div>
      <div style={{ margin: "60px 0 34px", textAlign: "center", fontWeight: 700, fontSize: "18px", lineHeight: 1.25 }}><div>ÖĞRENİM BELGESİ</div><div>(Diplomasını Kaybedenlere Mahsus)</div></div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "15px", lineHeight: 1.05 }}><tbody>{rows.map(([label, value]) => <tr key={String(label)}><td style={{ width: "50%", border: "1px solid #111", padding: "1px 7px 4px", fontWeight: 700, verticalAlign: "top" }}>{String(label)}</td><td style={{ border: "1px solid #111", padding: "1px 7px 4px", fontWeight: 700, verticalAlign: "top" }}>{String(value || "")}</td></tr>)}</tbody></table>
      <p style={{ marginTop: "30px", textAlign: "justify", lineHeight: 1.35, textIndent: "70px" }}>Yukarıda açık kimliği yazılı <b>{tc}</b> kimlik numaralı <b>{fullName}</b>, <b>{educationYear}</b> öğretim yılında <b>{diplomaDate}</b> tarih ve <b>{diplomaNo}</b> sayılı lise diploması ile okulumuzdan mezun olmuştur. İşbu belge ilgilinin isteği üzerine düzenlenmiştir.</p>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "55px", padding: "0 5px", fontWeight: 700, textAlign: "center" }}><div><div>{assistantPrincipal}</div><div>Müdür Yardımcısı</div></div><div><div>{principal}</div><div>Okul Müdürü</div></div></div>
      <p style={{ marginTop: "58px", fontSize: "13px", fontWeight: 700, fontStyle: "italic" }}>Not: İşbu Mezuniyet Belgesi Ortaöğretim Kurumları Yönetmeliğinin ilgili maddesi gereği bir defaya mahsus olarak düzenlenmektedir.</p>
      <div style={{ marginTop: "48px", borderTop: "1px solid #bbb", paddingTop: "10px", display: "flex", justifyContent: "space-between", fontSize: "11px", lineHeight: 1.3 }}><div>Adres: {profile.address || "-"}<br />Telefon: {profile.phone || "-"}<br />E-posta: {profile.email || "-"}</div><div style={{ textAlign: "right" }}>Web: {profile.website || "-"}<br />MEB Kodu: {profile.mebCode || "-"}<br />Belge elektronik ortamda hazırlanmıştır.</div></div>
    </div></div>
  </section>;
}

function DocumentCard({ title, description, count, active, onOpen, onDownload, onUpload, onAdd, onClear, icon }: {
  title: string; description: string; count: number; active: boolean; onOpen: () => void; onDownload: () => void; onUpload: () => void; onAdd: () => void; onClear: () => void; icon: React.ReactNode;
}) {
  return <div onClick={onOpen} className={`cursor-pointer rounded-2xl border bg-white p-5 shadow-sm transition ${active ? "border-cyan-500 ring-2 ring-cyan-100" : "border-slate-200 hover:border-cyan-200"}`}>
    <div className="mb-4 flex items-start justify-between"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-500"}`}>{icon}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{count} kayıt</span></div>
    <h2 className="font-bold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p>
    <div className="mt-4 grid grid-cols-2 gap-2"><button onClick={(event) => { event.stopPropagation(); onDownload(); }} className="flex items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2.5 text-xs font-bold text-cyan-700 hover:bg-cyan-100"><Download className="h-4 w-4" /> Excel Şablonu</button><button onClick={(event) => { event.stopPropagation(); onUpload(); }} className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-bold text-white hover:bg-slate-800"><Upload className="h-4 w-4" /> Excel Yükle</button><button onClick={(event) => { event.stopPropagation(); onAdd(); }} className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"><Plus className="h-4 w-4" /> Yeni Bilgi Ekle</button><button disabled={count === 0} onClick={(event) => { event.stopPropagation(); onClear(); }} className="flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-4 w-4" /> Tümünü Sil</button></div>
  </div>;
}
