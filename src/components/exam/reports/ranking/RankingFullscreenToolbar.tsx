import React from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpDown,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

export type RankingMode = "institution" | "classroom" | "subject";
export type RankingLimit = 10 | 50 | 100 | 0;
export type RankingSort = "ranking" | "net" | "score" | "wrong" | "name";
export type RankingDensity = "compact" | "comfortable";
export type RankingZoom = 70 | 85 | 100;

type Props = {
  mode: RankingMode;
  setMode: React.Dispatch<React.SetStateAction<RankingMode>>;
  classrooms: string[];
  classroom: string;
  setClassroom: React.Dispatch<React.SetStateAction<string>>;
  subjects: string[];
  subject: string;
  setSubject: React.Dispatch<React.SetStateAction<string>>;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  limit: RankingLimit;
  setLimit: React.Dispatch<React.SetStateAction<RankingLimit>>;
  sort: RankingSort;
  setSort: React.Dispatch<React.SetStateAction<RankingSort>>;
  onlyBelowAverage: boolean;
  setOnlyBelowAverage: React.Dispatch<React.SetStateAction<boolean>>;
  density: RankingDensity;
  setDensity: React.Dispatch<React.SetStateAction<RankingDensity>>;
  showHeatmap: boolean;
  setShowHeatmap: React.Dispatch<React.SetStateAction<boolean>>;
  zoom: RankingZoom;
  setZoom: React.Dispatch<React.SetStateAction<RankingZoom>>;
  clearFilters: () => void;
  exportPdf: () => void | Promise<void>;
  generating: boolean;
  close: () => void;
};

export default function RankingFullscreenToolbar({
  mode,
  setMode,
  classrooms,
  classroom,
  setClassroom,
  subjects,
  subject,
  setSubject,
  search,
  setSearch,
  limit,
  setLimit,
  sort,
  setSort,
  onlyBelowAverage,
  setOnlyBelowAverage,
  density,
  setDensity,
  showHeatmap,
  setShowHeatmap,
  zoom,
  setZoom,
  clearFilters,
  exportPdf,
  generating,
  close,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {([
        ["institution", "Kurum Geneli"],
        ["classroom", "Şube Bazında"],
        ["subject", "Ders Bazında"],
      ] as const).map(([nextMode, label]) => (
        <button
          key={nextMode}
          type="button"
          onClick={() => setMode(nextMode)}
          className={`rounded-xl border px-3 py-2 text-[9px] font-black ${
            mode === nextMode
              ? "border-indigo-400 bg-indigo-600 text-white"
              : "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
          }`}
        >
          {label}
        </button>
      ))}

      {mode === "classroom" && (
        <select
          value={classroom}
          onChange={(event) => setClassroom(event.target.value)}
          className="h-9 rounded-xl border border-slate-600 bg-slate-800 px-3 text-[9px] font-bold text-white"
        >
          <option value="all">Tüm şubeler</option>
          {classrooms.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      )}

      {mode === "subject" && (
        <select
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="h-9 rounded-xl border border-slate-600 bg-slate-800 px-3 text-[9px] font-bold text-white"
        >
          <option value="all">Ders seçin</option>
          {subjects.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      )}

      <label className="flex h-9 items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3">
        <Search className="h-3.5 w-3.5 text-slate-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Öğrenci ara"
          className="w-36 bg-transparent text-[9px] font-bold text-white outline-none placeholder:text-slate-500"
        />
      </label>

      <select
        value={limit}
        onChange={(event) => setLimit(Number(event.target.value) as RankingLimit)}
        className="h-9 rounded-xl border border-slate-600 bg-slate-800 px-3 text-[9px] font-bold text-white"
      >
        <option value={10}>İlk 10</option>
        <option value={50}>İlk 50</option>
        <option value={100}>İlk 100</option>
        <option value={0}>Tümü</option>
      </select>

      <label className="flex h-9 items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3">
        <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as RankingSort)}
          className="bg-transparent text-[9px] font-bold text-white outline-none"
        >
          <option className="text-slate-900" value="ranking">Sıralamaya göre</option>
          <option className="text-slate-900" value="net">Nete göre</option>
          <option className="text-slate-900" value="score">Puana göre</option>
          <option className="text-slate-900" value="wrong">En az yanlışa göre</option>
          <option className="text-slate-900" value="name">Ada göre</option>
        </select>
      </label>

      <button
        type="button"
        onClick={() => setOnlyBelowAverage((value) => !value)}
        className={`flex h-9 items-center gap-2 rounded-xl border px-3 text-[9px] font-black ${
          onlyBelowAverage
            ? "border-amber-400 bg-amber-500 text-slate-950"
            : "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
        }`}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        Ortalama Altı
      </button>

      <button
        type="button"
        onClick={() => setDensity((value) => (value === "compact" ? "comfortable" : "compact"))}
        className="flex h-9 items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 text-[9px] font-black text-slate-200 hover:bg-slate-700"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {density === "compact" ? "Rahat Görünüm" : "Sıkı Görünüm"}
      </button>

      <button
        type="button"
        onClick={() => setShowHeatmap((value) => !value)}
        className={`flex h-9 items-center gap-2 rounded-xl border px-3 text-[9px] font-black ${
          showHeatmap
            ? "border-cyan-300 bg-cyan-500 text-slate-950"
            : "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
        }`}
      >
        <Activity className="h-3.5 w-3.5" />
        Başarı Renkleri
      </button>

      <label className="flex h-9 items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 text-[9px] font-black text-slate-200">
        <span>Sütun Ölçeği</span>
        <select
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value) as RankingZoom)}
          className="bg-transparent text-[9px] font-black text-white outline-none"
        >
          <option className="text-slate-900" value={70}>%70</option>
          <option className="text-slate-900" value={85}>%85</option>
          <option className="text-slate-900" value={100}>%100</option>
        </select>
      </label>

      <button
        type="button"
        onClick={clearFilters}
        className="h-9 rounded-xl border border-slate-600 bg-slate-800 px-3 text-[9px] font-black text-slate-200 hover:bg-slate-700"
      >
        Filtreleri Temizle
      </button>

      <button
        type="button"
        onClick={() => void exportPdf()}
        disabled={generating}
        className="rounded-xl bg-indigo-600 px-4 py-2.5 text-[9px] font-black text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        Görünümü PDF Yap
      </button>

      <button
        type="button"
        onClick={close}
        className="flex h-10 items-center gap-2 rounded-xl bg-rose-600 px-4 text-[9px] font-black text-white hover:bg-rose-500"
      >
        <X className="h-4 w-4" />
        İncelemeyi Kapat
      </button>
    </div>
  );
}
