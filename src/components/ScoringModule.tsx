import React, { useEffect, useRef, useState } from "react";
import { Calculator, Save, AlertCircle } from "lucide-react";
import { sqliteStorage, flushSyncStateStore } from "../core/state/SyncStateStore";
import { fetchCollectionFromLocalDatabase, upsertLocalDocument } from "../lib/localDatabase";

const TYT_STRUCTURE = [
  {
    testName: "Türkçe Testi",
    subjects: [{ name: "Türkçe", count: 40 }],
  },
  {
    testName: "Sosyal Bilimler Testi",
    subjects: [
      { name: "Tarih", count: 5 },
      { name: "Coğrafya", count: 5 },
      { name: "Felsefe", count: 5 },
      { name: "Din Kültürü ve Ahlak Bilgisi", count: 5 },
    ],
  },
  {
    testName: "Temel Matematik Testi",
    subjects: [{ name: "Matematik", count: 40 }],
  },
  {
    testName: "Fen Bilimleri Testi",
    subjects: [
      { name: "Fizik", count: 7 },
      { name: "Kimya", count: 7 },
      { name: "Biyoloji", count: 6 },
    ],
  },
];

const TYT_GROUPED_TESTS: Record<string, string[]> = {
  "Sosyal Bilimler Testi": [
    "Tarih",
    "Coğrafya",
    "Felsefe",
    "Din Kültürü ve Ahlak Bilgisi",
  ],
  "Fen Bilimleri Testi": ["Fizik", "Kimya", "Biyoloji"],
};

const getTytCoefficientRows = (test: (typeof TYT_STRUCTURE)[number]) => {
  const groupedSubjects = TYT_GROUPED_TESTS[test.testName];
  if (groupedSubjects) {
    return [
      {
        name: test.testName,
        count: test.subjects.reduce((sum, subject) => sum + subject.count, 0),
        subjects: groupedSubjects,
      },
    ];
  }

  return test.subjects.map((subject) => ({
    name: subject.name,
    count: subject.count,
    subjects: [subject.name],
  }));
};

const getAytTytCoefficientKey = (subject: string) =>
  subject === "Din Kültürü ve Ahlak Bilgisi" ? "Din Kültürü" : subject;

const INITIAL_AYT_TYT_COEFFICIENTS: Record<string, Record<string, number>> = {
  "2023": {
    Türkçe: 1.32,
    Tarih: 1.36,
    Coğrafya: 1.36,
    Felsefe: 1.36,
    "Din Kültürü": 1.36,
    Matematik: 1.32,
    Fizik: 1.36,
    Kimya: 1.36,
    Biyoloji: 1.36,
  },
  "2024": {
    Türkçe: 1.32,
    Tarih: 1.36,
    Coğrafya: 1.36,
    Felsefe: 1.36,
    "Din Kültürü": 1.36,
    Matematik: 1.32,
    Fizik: 1.36,
    Kimya: 1.36,
    Biyoloji: 1.36,
  },
  "2025": {
    Türkçe: 1.32,
    Tarih: 1.36,
    Coğrafya: 1.36,
    Felsefe: 1.36,
    "Din Kültürü": 1.36,
    Matematik: 1.32,
    Fizik: 1.36,
    Kimya: 1.36,
    Biyoloji: 1.36,
  },
};

const AYT_SAYISAL_AYT_STRUCTURE = [
  {
    testName: "Matematik Testi",
    subjects: [{ name: "Matematik", count: 40 }],
  },
  {
    testName: "Fen Bilimleri Testi",
    subjects: [
      { name: "Fizik", count: 14 },
      { name: "Kimya", count: 13 },
      { name: "Biyoloji", count: 13 },
    ],
  },
];

const AYT_SAYISAL_AYT_COEFFICIENTS: Record<string, Record<string, number>> = {
  "2023": { Matematik: 3, Fizik: 2.85, Kimya: 3.07, Biyoloji: 3.07 },
  "2024": { Matematik: 3, Fizik: 2.85, Kimya: 3.07, Biyoloji: 3.07 },
  "2025": { Matematik: 3, Fizik: 2.85, Kimya: 3.07, Biyoloji: 3.07 },
};

const AYT_EA_AYT_STRUCTURE = [
  {
    testName: "Matematik Testi",
    subjects: [{ name: "Matematik", count: 40 }],
  },
  {
    testName: "Türk Dili ve Edebiyatı - Sosyal Bilimler-1 Testi",
    subjects: [
      { name: "Türk Dili ve Edebiyatı", count: 24 },
      { name: "Tarih-1", count: 10 },
      { name: "Coğrafya-1", count: 6 },
    ],
  },
];

const AYT_EA_AYT_COEFFICIENTS: Record<string, Record<string, number>> = {
  "2023": {
    Matematik: 3,
    "Türk Dili ve Edebiyatı": 3,
    "Tarih-1": 2.8,
    "Coğrafya-1": 3.33,
  },
  "2024": {
    Matematik: 3,
    "Türk Dili ve Edebiyatı": 3,
    "Tarih-1": 2.8,
    "Coğrafya-1": 3.33,
  },
  "2025": {
    Matematik: 3,
    "Türk Dili ve Edebiyatı": 3,
    "Tarih-1": 2.8,
    "Coğrafya-1": 3.33,
  },
};

const AYT_SOZEL_AYT_STRUCTURE = [
  {
    testName: "Türk Dili ve Edebiyatı - Sosyal Bilimler-1 Testi",
    subjects: [
      { name: "Türk Dili ve Edebiyatı", count: 24 },
      { name: "Tarih-1", count: 10 },
      { name: "Coğrafya-1", count: 6 },
    ],
  },
  {
    testName: "Sosyal Bilimler-2 Testi",
    subjects: [
      { name: "Tarih-2", count: 11 },
      { name: "Coğrafya-2", count: 11 },
      { name: "Felsefe Grubu", count: 12 },
      { name: "Din Kültürü ve Ahlak Bilgisi", count: 6 },
    ],
  },
];

const AYT_SOZEL_AYT_COEFFICIENTS: Record<string, Record<string, number>> = {
  "2023": {
    "Türk Dili ve Edebiyatı": 3,
    "Tarih-1": 2.8,
    "Coğrafya-1": 3.33,
    "Tarih-2": 2.91,
    "Coğrafya-2": 2.91,
    "Felsefe Grubu": 3,
    "Din Kültürü ve Ahlak Bilgisi": 3.33,
  },
  "2024": {
    "Türk Dili ve Edebiyatı": 3,
    "Tarih-1": 2.8,
    "Coğrafya-1": 3.33,
    "Tarih-2": 2.91,
    "Coğrafya-2": 2.91,
    "Felsefe Grubu": 3,
    "Din Kültürü ve Ahlak Bilgisi": 3.33,
  },
  "2025": {
    "Türk Dili ve Edebiyatı": 3,
    "Tarih-1": 2.8,
    "Coğrafya-1": 3.33,
    "Tarih-2": 2.91,
    "Coğrafya-2": 2.91,
    "Felsefe Grubu": 3,
    "Din Kültürü ve Ahlak Bilgisi": 3.33,
  },
};

const AYT_DIL_AYT_STRUCTURE = [
  {
    testName: "Yabancı Dil Testi",
    subjects: [{ name: "Yabancı Dil", count: 80 }],
  },
];

const AYT_DIL_AYT_COEFFICIENTS: Record<string, Record<string, number>> = {
  "2023": { "Yabancı Dil": 3 },
  "2024": { "Yabancı Dil": 3 },
  "2025": { "Yabancı Dil": 3 },
};

const DEFAULT_TYT_COEFFICIENTS: Record<string, Record<string, number>> = {
  "2023": {
    Türkçe: 3.3,
    Tarih: 3.4,
    Coğrafya: 3.4,
    Felsefe: 3.4,
    "Din Kültürü ve Ahlak Bilgisi": 3.4,
    Matematik: 3.3,
    Fizik: 3.4,
    Kimya: 3.4,
    Biyoloji: 3.4,
  },
  "2024": {
    Türkçe: 3.3,
    Tarih: 3.4,
    Coğrafya: 3.4,
    Felsefe: 3.4,
    "Din Kültürü ve Ahlak Bilgisi": 3.4,
    Matematik: 3.3,
    Fizik: 3.4,
    Kimya: 3.4,
    Biyoloji: 3.4,
  },
  "2025": {
    Türkçe: 3.3,
    Tarih: 3.4,
    Coğrafya: 3.4,
    Felsefe: 3.4,
    "Din Kültürü ve Ahlak Bilgisi": 3.4,
    Matematik: 3.3,
    Fizik: 3.4,
    Kimya: 3.4,
    Biyoloji: 3.4,
  },
};

const getScoringYears = (date = new Date()): string[] => {
  const currentYear = date.getFullYear();
  // Yeni puanlama yılı ancak Haziran tamamlandıktan sonra (1 Temmuz itibarıyla) açılır.
  const latestYear = date.getMonth() >= 6 ? currentYear : currentYear - 1;
  return [latestYear, latestYear - 1, latestYear - 2].map(String);
};

const keepOnlyScoringYears = (
  source: Record<string, Record<string, number>>,
  years: string[],
): Record<string, Record<string, number>> =>
  Object.fromEntries(years.map((year) => [year, { ...(source[year] || {}) }]));

const keepOnlyAytTytScoringYears = (
  source: Record<string, Record<string, Record<string, number>>>,
  years: string[],
): Record<string, Record<string, Record<string, number>>> =>
  Object.fromEntries(
    Object.entries(source).map(([scoreType, values]) => [
      scoreType,
      keepOnlyScoringYears(values, years),
    ]),
  );

const SCORING_STORAGE_KEY = "edupanel_scoring_coefficients_v3";
const LEGACY_SCORING_STORAGE_KEYS = [
  "edupanel_scoring_coefficients_v2",
  "edupanel_scoring_coefficients_v1",
];
const SCORING_DB_COLLECTION = "scoring_coefficients";
const SCORING_DB_DOCUMENT_ID = "active";

type SavedScoringCoefficients = {
  version?: number;
  savedAt?: string;
  years?: string[];
  tyt?: Record<string, Record<string, number>>;
  aytTyt?: Record<string, Record<string, Record<string, number>>>;
  aytSayisal?: Record<string, Record<string, number>>;
  aytEa?: Record<string, Record<string, number>>;
  aytSozel?: Record<string, Record<string, number>>;
  aytDil?: Record<string, Record<string, number>>;
};

const parseSavedScoringCoefficients = (raw: unknown): SavedScoringCoefficients => {
  try {
    if (!raw) return {};
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === "object" ? (parsed as SavedScoringCoefficients) : {};
  } catch {
    return {};
  }
};

const hasScoringPayload = (value: SavedScoringCoefficients) =>
  Boolean(
    value?.tyt ||
      value?.aytTyt ||
      value?.aytSayisal ||
      value?.aytEa ||
      value?.aytSozel ||
      value?.aytDil,
  );

const readSavedScoringCoefficients = (): SavedScoringCoefficients => {
  for (const key of [SCORING_STORAGE_KEY, ...LEGACY_SCORING_STORAGE_KEYS]) {
    const parsed = parseSavedScoringCoefficients(sqliteStorage.getItem(key));
    if (hasScoringPayload(parsed)) return parsed;
  }
  return {};
};

const readSavedScoringCoefficientsFromDatabase = async (): Promise<SavedScoringCoefficients> => {
  try {
    // Önce yeni ve doğrudan puanlama koleksiyonunu oku.
    const rows = await fetchCollectionFromLocalDatabase(SCORING_DB_COLLECTION);
    const row = (rows || []).find((item: any) =>
      String(item?.id ?? item?.__documentId ?? "") === SCORING_DB_DOCUMENT_ID,
    );
    if (row) {
      const candidate = row?.payload ?? row?.data ?? row?.value ?? row;
      const parsed = parseSavedScoringCoefficients(candidate);
      if (hasScoringPayload(parsed)) return parsed;
    }

    // Önceki sürümde storage köprüsüne yazılmış kayıt varsa doğrudan SQLite
    // browser_storage koleksiyonundan da kurtar. Köprü açılışta yüklenememiş olsa
    // bile kullanıcı verisi burada kalmış olabilir.
    const legacyRows = await fetchCollectionFromLocalDatabase("browser_storage");
    for (const key of [SCORING_STORAGE_KEY, ...LEGACY_SCORING_STORAGE_KEYS]) {
      const legacyRow = (legacyRows || []).find((item: any) =>
        String(item?.id ?? item?.__documentId ?? "") === key,
      );
      if (!legacyRow) continue;
      const parsed = parseSavedScoringCoefficients(
        legacyRow?.value ?? legacyRow?.payload ?? legacyRow?.data,
      );
      if (hasScoringPayload(parsed)) return parsed;
    }

    return {};
  } catch (error) {
    console.warn("Puanlama katsayıları doğrudan veritabanından okunamadı:", error);
    return {};
  }
};

const mergeScoringYears = (
  defaults: Record<string, Record<string, number>>,
  saved: Record<string, Record<string, number>> | undefined,
  years: string[],
): Record<string, Record<string, number>> =>
  Object.fromEntries(
    years.map((year) => [
      year,
      { ...(defaults[year] || {}), ...(saved?.[year] || {}) },
    ]),
  );

const mergeAytTytScoringYears = (
  defaults: Record<string, Record<string, Record<string, number>>>,
  saved: Record<string, Record<string, Record<string, number>>> | undefined,
  years: string[],
): Record<string, Record<string, Record<string, number>>> =>
  Object.fromEntries(
    Object.entries(defaults).map(([scoreType, values]) => [
      scoreType,
      mergeScoringYears(values, saved?.[scoreType], years),
    ]),
  );

export default function ScoringModule() {
  const scoringYears = getScoringYears();
  const [persistedScoring] = useState<SavedScoringCoefficients>(() =>
    readSavedScoringCoefficients(),
  );
  const userEditedRef = useRef(false);
  const [selectedYear, setSelectedYear] = useState<string>(scoringYears[0]);
  const [examType, setExamType] = useState<"TYT" | "AYT">("TYT");
  const [aytScoreType, setAytScoreType] = useState<
    "Sayısal" | "Eşit Ağırlık" | "Sözel" | "Dil"
  >("Sayısal");
  const [coefficients, setCoefficients] = useState(() =>
    mergeScoringYears(
      DEFAULT_TYT_COEFFICIENTS,
      persistedScoring.tyt,
      scoringYears,
    ),
  );

  // States for AYT
  const aytTytDefaults = {
    Sayısal: INITIAL_AYT_TYT_COEFFICIENTS,
    "Eşit Ağırlık": INITIAL_AYT_TYT_COEFFICIENTS,
    Sözel: INITIAL_AYT_TYT_COEFFICIENTS,
    Dil: INITIAL_AYT_TYT_COEFFICIENTS,
  };
  const [aytTytCoefficients, setAytTytCoefficients] = useState<
    Record<string, Record<string, Record<string, number>>>
  >(() =>
    mergeAytTytScoringYears(
      aytTytDefaults,
      persistedScoring.aytTyt,
      scoringYears,
    ),
  );
  const [aytSayisalAytCoefficients, setAytSayisalAytCoefficients] = useState(
    () =>
      mergeScoringYears(
        AYT_SAYISAL_AYT_COEFFICIENTS,
        persistedScoring.aytSayisal,
        scoringYears,
      ),
  );
  const [aytEaAytCoefficients, setAytEaAytCoefficients] = useState(() =>
    mergeScoringYears(
      AYT_EA_AYT_COEFFICIENTS,
      persistedScoring.aytEa,
      scoringYears,
    ),
  );
  const [aytSozelAytCoefficients, setAytSozelAytCoefficients] = useState(() =>
    mergeScoringYears(
      AYT_SOZEL_AYT_COEFFICIENTS,
      persistedScoring.aytSozel,
      scoringYears,
    ),
  );
  const [aytDilAytCoefficients, setAytDilAytCoefficients] = useState(() =>
    mergeScoringYears(
      AYT_DIL_AYT_COEFFICIENTS,
      persistedScoring.aytDil,
      scoringYears,
    ),
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const databaseSaved = await readSavedScoringCoefficientsFromDatabase();
      if (cancelled || userEditedRef.current || !hasScoringPayload(databaseSaved)) return;

      setCoefficients(mergeScoringYears(DEFAULT_TYT_COEFFICIENTS, databaseSaved.tyt, scoringYears));
      setAytTytCoefficients(
        mergeAytTytScoringYears(aytTytDefaults, databaseSaved.aytTyt, scoringYears),
      );
      setAytSayisalAytCoefficients(
        mergeScoringYears(AYT_SAYISAL_AYT_COEFFICIENTS, databaseSaved.aytSayisal, scoringYears),
      );
      setAytEaAytCoefficients(
        mergeScoringYears(AYT_EA_AYT_COEFFICIENTS, databaseSaved.aytEa, scoringYears),
      );
      setAytSozelAytCoefficients(
        mergeScoringYears(AYT_SOZEL_AYT_COEFFICIENTS, databaseSaved.aytSozel, scoringYears),
      );
      setAytDilAytCoefficients(
        mergeScoringYears(AYT_DIL_AYT_COEFFICIENTS, databaseSaved.aytDil, scoringYears),
      );

      // Yeni kalıcı anahtara da göç ettir; eski kayıt anahtarları silinmez.
      sqliteStorage.setItem(SCORING_STORAGE_KEY, JSON.stringify(databaseSaved));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const markEdited = () => {
    userEditedRef.current = true;
  };

  const handleCoefficientChange = (
    year: string,
    subjects: string[],
    value: string,
  ) => {
    markEdited();
    let numVal = parseFloat(value);
    if (isNaN(numVal)) numVal = 0;

    setCoefficients((prev) => ({
      ...prev,
      [year]: {
        ...(prev[year] || {}),
        ...Object.fromEntries(subjects.map((subject) => [subject, numVal])),
      },
    }));
  };

  const handleAytTytChange = (
    type: string,
    year: string,
    subjects: string[],
    value: string,
  ) => {
    markEdited();
    let numVal = parseFloat(value);
    if (isNaN(numVal)) numVal = 0;
    setAytTytCoefficients((prev) => ({
      ...prev,
      [type]: {
        ...(prev[type] || {}),
        [year]: {
          ...((prev[type] && prev[type][year]) || {}),
          ...Object.fromEntries(
            subjects.map((subject) => [getAytTytCoefficientKey(subject), numVal]),
          ),
        },
      },
    }));
  };

  const handleAytSayisalAytChange = (
    year: string,
    subject: string,
    value: string,
  ) => {
    markEdited();
    let numVal = parseFloat(value);
    if (isNaN(numVal)) numVal = 0;
    setAytSayisalAytCoefficients((prev) => ({
      ...prev,
      [year]: { ...(prev[year] || {}), [subject]: numVal },
    }));
  };

  const handleAytEaAytChange = (
    year: string,
    subject: string,
    value: string,
  ) => {
    markEdited();
    let numVal = parseFloat(value);
    if (isNaN(numVal)) numVal = 0;
    setAytEaAytCoefficients((prev) => ({
      ...prev,
      [year]: { ...(prev[year] || {}), [subject]: numVal },
    }));
  };

  const handleAytSozelAytChange = (
    year: string,
    subject: string,
    value: string,
  ) => {
    markEdited();
    let numVal = parseFloat(value);
    if (isNaN(numVal)) numVal = 0;
    setAytSozelAytCoefficients((prev) => ({
      ...prev,
      [year]: { ...(prev[year] || {}), [subject]: numVal },
    }));
  };

  const handleAytDilAytChange = (
    year: string,
    subject: string,
    value: string,
  ) => {
    markEdited();
    let numVal = parseFloat(value);
    if (isNaN(numVal)) numVal = 0;
    setAytDilAytCoefficients((prev) => ({
      ...prev,
      [year]: { ...(prev[year] || {}), [subject]: numVal },
    }));
  };

  const handleSave = async () => {
    try {
      const payload: SavedScoringCoefficients = {
        version: 3,
        savedAt: new Date().toISOString(),
        years: scoringYears,
        tyt: keepOnlyScoringYears(coefficients, scoringYears),
        aytTyt: keepOnlyAytTytScoringYears(aytTytCoefficients, scoringYears),
        aytSayisal: keepOnlyScoringYears(
          aytSayisalAytCoefficients,
          scoringYears,
        ),
        aytEa: keepOnlyScoringYears(aytEaAytCoefficients, scoringYears),
        aytSozel: keepOnlyScoringYears(aytSozelAytCoefficients, scoringYears),
        aytDil: keepOnlyScoringYears(aytDilAytCoefficients, scoringYears),
      };

      // Önce doğrudan SQLite'a yaz ve gerçek cevabı bekle. Böylece arka-plan
      // kuyruğu başarısız olsa bile kullanıcıya yanlışlıkla "kaydedildi" denmez.
      await upsertLocalDocument(SCORING_DB_COLLECTION, SCORING_DB_DOCUMENT_ID, {
        id: SCORING_DB_DOCUMENT_ID,
        payload,
        updatedAt: payload.savedAt,
      });

      // Senkron ekran açılışında hızlı erişim için aynı veriyi storage aynasına da koy.
      sqliteStorage.setItem(SCORING_STORAGE_KEY, JSON.stringify(payload));
      await flushSyncStateStore();
      userEditedRef.current = false;
      alert(`${selectedYear} yılı dahil son üç yılın katsayıları kalıcı olarak kaydedildi.`);
    } catch (error) {
      console.error("Puanlama katsayıları kaydedilemedi:", error);
      const message = error instanceof Error ? error.message : String(error || "");
      alert(`Katsayılar kaydedilemedi.${message ? `\n\n${message}` : ""}`);
    }
  };

  return (
    <div className="text-left w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 flex flex-col lg:flex-row items-end justify-between gap-4">
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">
              Puanlama Yılı
            </label>
            <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-1">
              {scoringYears.map((year) => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                    selectedYear === year
                      ? "bg-purple-100 text-purple-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">
              Sınav Türü
            </label>
            <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-1">
              {(["TYT", "AYT"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setExamType(type)}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                    examType === type
                      ? "bg-purple-100 text-purple-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {type} Sınavı Katsayıları
                </button>
              ))}
            </div>
          </div>

          {examType === "AYT" && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                AYT Puan Türü
              </label>
              <div className="flex items-center">
                <select
                  value={aytScoreType}
                  onChange={(e) => setAytScoreType(e.target.value as any)}
                  className="px-4 py-1.5 rounded-md text-xs font-bold bg-purple-100 text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer border-none"
                >
                  <option value="Sayısal">Sayısal</option>
                  <option value="Eşit Ağırlık">Eşit Ağırlık</option>
                  <option value="Sözel">Sözel</option>
                  <option value="Dil">Dil</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap h-fit mb-[2px]"
        >
          <Save className="w-4 h-4 shrink-0" />
          Katsayıları Kaydet
        </button>
      </div>

      {examType === "TYT" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
            {TYT_STRUCTURE.map((test, index) => (
              <div
                key={index}
                className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col"
              >
                <div className="bg-slate-100 px-4 py-3 border-b border-slate-200">
                  <h3 className="font-bold text-slate-800 text-sm">
                    {test.testName}
                  </h3>
                </div>
                <div className="p-4 space-y-4 flex-1">
                  {getTytCoefficientRows(test).map((row, subIndex) => (
                    <div
                      key={subIndex}
                      className="flex items-center justify-between gap-4"
                    >
                      <span className="text-sm font-medium text-slate-600 flex-1">
                        {row.name}{" "}
                        <span className="text-slate-400 text-xs">
                          ({row.count} soru)
                        </span>
                      </span>
                      <div className="w-24">
                        <input
                          type="number"
                          step="0.1"
                          value={
                            coefficients[selectedYear]?.[row.subjects[0]] || 0
                          }
                          onChange={(e) =>
                            handleCoefficientChange(
                              selectedYear,
                              row.subjects,
                              e.target.value,
                            )
                          }
                          className="w-full text-right px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-purple-500/20 outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-100 flex gap-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>
              <strong>Bilgi:</strong> Puan hesaplamalarında ayrıca her yılın
              kendi taban puanı testlerin üzerine eklenecektir. Öğrenci netleri
              bu katsayılar ile çarpılarak ham puanı elde edilir.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="space-y-6">
            {/* HER TÜRE ÖZEL TYT KATSAYILARI */}
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5">
              <h3 className="font-bold text-indigo-900 mb-4 text-sm tracking-wide uppercase">
                {aytScoreType} PUANLAMA İÇİN TYT KATSAYILARI
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
                {TYT_STRUCTURE.map((test, index) => (
                  <div
                    key={`ayt-tyt-${index}`}
                    className="bg-white border border-indigo-100 rounded-xl overflow-hidden"
                  >
                    <div className="bg-indigo-50/80 px-3 py-2 border-b border-indigo-100">
                      <h4 className="font-bold text-indigo-800 text-xs">
                        {test.testName}
                      </h4>
                    </div>
                    <div className="p-3 space-y-3">
                      {getTytCoefficientRows(test).map((row, subIndex) => {
                        const lookupName = getAytTytCoefficientKey(
                          row.subjects[0],
                        );
                        return (
                          <div
                            key={`ayt-tyt-sub-${subIndex}`}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="text-xs font-medium text-slate-600 flex-1 truncate">
                              {row.name}{" "}
                              <span className="text-slate-400">
                                ({row.count}s)
                              </span>
                            </span>
                            <div className="w-20">
                              <input
                                type="number"
                                step="0.01"
                                value={
                                  aytTytCoefficients[aytScoreType]?.[
                                    selectedYear
                                  ]?.[lookupName] || 0
                                }
                                onChange={(e) =>
                                  handleAytTytChange(
                                    aytScoreType,
                                    selectedYear,
                                    row.subjects,
                                    e.target.value,
                                  )
                                }
                                className="w-full text-right px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AYT KATSAYILARI (Sayısal veya Eşit Ağırlık) */}
            {aytScoreType === "Sayısal" ? (
              <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-5">
                <h3 className="font-bold text-purple-900 mb-4 text-sm tracking-wide uppercase">
                  {aytScoreType} PUANLAMA İÇİN AYT KATSAYILARI
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
                  {AYT_SAYISAL_AYT_STRUCTURE.map((test, index) => (
                    <div
                      key={`ayt-ayt-${index}`}
                      className="bg-white border border-purple-100 rounded-xl overflow-hidden"
                    >
                      <div className="bg-purple-50/80 px-3 py-2 border-b border-purple-100">
                        <h4 className="font-bold text-purple-800 text-xs">
                          {test.testName}
                        </h4>
                      </div>
                      <div className="p-3 space-y-3">
                        {test.subjects.map((subject, subIndex) => (
                          <div
                            key={`ayt-ayt-sub-${subIndex}`}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="text-xs font-medium text-slate-600 flex-1 truncate">
                              {subject.name}{" "}
                              <span className="text-slate-400">
                                ({subject.count}s)
                              </span>
                            </span>
                            <div className="w-20">
                              <input
                                type="number"
                                step="0.01"
                                value={
                                  aytSayisalAytCoefficients[selectedYear]?.[
                                    subject.name
                                  ] || 0
                                }
                                onChange={(e) =>
                                  handleAytSayisalAytChange(
                                    selectedYear,
                                    subject.name,
                                    e.target.value,
                                  )
                                }
                                className="w-full text-right px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500/20 outline-none"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : aytScoreType === "Eşit Ağırlık" ? (
              <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-5">
                <h3 className="font-bold text-purple-900 mb-4 text-sm tracking-wide uppercase">
                  {aytScoreType} PUANLAMA İÇİN AYT KATSAYILARI
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
                  {AYT_EA_AYT_STRUCTURE.map((test, index) => (
                    <div
                      key={`ayt-ea-ayt-${index}`}
                      className="bg-white border border-purple-100 rounded-xl overflow-hidden"
                    >
                      <div className="bg-purple-50/80 px-3 py-2 border-b border-purple-100">
                        <h4 className="font-bold text-purple-800 text-xs">
                          {test.testName}
                        </h4>
                      </div>
                      <div className="p-3 space-y-3">
                        {test.subjects.map((subject, subIndex) => (
                          <div
                            key={`ayt-ea-ayt-sub-${subIndex}`}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="text-xs font-medium text-slate-600 flex-1 truncate">
                              {subject.name}{" "}
                              <span className="text-slate-400">
                                ({subject.count}s)
                              </span>
                            </span>
                            <div className="w-20">
                              <input
                                type="number"
                                step="0.01"
                                value={
                                  aytEaAytCoefficients[selectedYear]?.[
                                    subject.name
                                  ] || 0
                                }
                                onChange={(e) =>
                                  handleAytEaAytChange(
                                    selectedYear,
                                    subject.name,
                                    e.target.value,
                                  )
                                }
                                className="w-full text-right px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500/20 outline-none"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : aytScoreType === "Sözel" ? (
              <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-5">
                <h3 className="font-bold text-purple-900 mb-4 text-sm tracking-wide uppercase">
                  {aytScoreType} PUANLAMA İÇİN AYT KATSAYILARI
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
                  {AYT_SOZEL_AYT_STRUCTURE.map((test, index) => (
                    <div
                      key={`ayt-sozel-ayt-${index}`}
                      className="bg-white border border-purple-100 rounded-xl overflow-hidden"
                    >
                      <div className="bg-purple-50/80 px-3 py-2 border-b border-purple-100">
                        <h4 className="font-bold text-purple-800 text-xs">
                          {test.testName}
                        </h4>
                      </div>
                      <div className="p-3 space-y-3">
                        {test.subjects.map((subject, subIndex) => (
                          <div
                            key={`ayt-sozel-ayt-sub-${subIndex}`}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="text-xs font-medium text-slate-600 flex-1 truncate">
                              {subject.name}{" "}
                              <span className="text-slate-400">
                                ({subject.count}s)
                              </span>
                            </span>
                            <div className="w-20">
                              <input
                                type="number"
                                step="0.01"
                                value={
                                  aytSozelAytCoefficients[selectedYear]?.[
                                    subject.name
                                  ] || 0
                                }
                                onChange={(e) =>
                                  handleAytSozelAytChange(
                                    selectedYear,
                                    subject.name,
                                    e.target.value,
                                  )
                                }
                                className="w-full text-right px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500/20 outline-none"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : aytScoreType === "Dil" ? (
              <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-5">
                <h3 className="font-bold text-purple-900 mb-4 text-sm tracking-wide uppercase">
                  {aytScoreType} PUANLAMA İÇİN AYT KATSAYILARI
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
                  {AYT_DIL_AYT_STRUCTURE.map((test, index) => (
                    <div
                      key={`ayt-dil-ayt-${index}`}
                      className="bg-white border border-purple-100 rounded-xl overflow-hidden"
                    >
                      <div className="bg-purple-50/80 px-3 py-2 border-b border-purple-100">
                        <h4 className="font-bold text-purple-800 text-xs">
                          {test.testName}
                        </h4>
                      </div>
                      <div className="p-3 space-y-3">
                        {test.subjects.map((subject, subIndex) => (
                          <div
                            key={`ayt-dil-ayt-sub-${subIndex}`}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="text-xs font-medium text-slate-600 flex-1 truncate">
                              {subject.name}{" "}
                              <span className="text-slate-400">
                                ({subject.count}s)
                              </span>
                            </span>
                            <div className="w-20">
                              <input
                                type="number"
                                step="0.01"
                                value={
                                  aytDilAytCoefficients[selectedYear]?.[
                                    subject.name
                                  ] || 0
                                }
                                onChange={(e) =>
                                  handleAytDilAytChange(
                                    selectedYear,
                                    subject.name,
                                    e.target.value,
                                  )
                                }
                                className="w-full text-right px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500/20 outline-none"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
