import React, { useEffect, useRef, useState } from "react";
import { Activity, Play, Square, X } from "lucide-react";
import type { Classroom, Course, Teacher } from "../../../types";
import type { SolverConfig } from "../../../utils/schedulingSolvers";
import { ScheduleSolverWorkerClient } from "../../../services/schedule/scheduleSolverWorkerClient";

type ResultRow = { algorithm: string; durationMs: number; unplaced: number; penalty: number; success: boolean };
interface Props { open: boolean; onClose: () => void; scheduleData: Record<string, any>; classrooms: Classroom[]; teachers: Teacher[]; courses: Course[]; unwantedTeacherDays: Record<string, string[]>; }
const algorithms: SolverConfig["algorithm"][] = ["hybrid", "backtracking"];
const labels: Record<string,string> = { hybrid:"Hibrit CSP + Genetik", backtracking:"Recursive Backtracking" };

export default function ScheduleBenchmarkModal({ open, onClose, scheduleData, classrooms, teachers, courses, unwantedTeacherDays }: Props) {
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState("");
  const clientRef = useRef<ScheduleSolverWorkerClient | null>(null);
  useEffect(() => () => clientRef.current?.terminate(), []);
  if (!open) return null;

  const run = async () => {
    setRows([]); setRunning(true);
    const client = new ScheduleSolverWorkerClient(); clientRef.current = client;
    try {
      for (const algorithm of algorithms) {
        setCurrent(labels[algorithm]);
        const result = await client.run({ config: { algorithm, scope:"global" }, currentSchedule: scheduleData, classrooms, teachers, courses, unwantedTeacherDays });
        setRows((prev) => [...prev, { algorithm: labels[algorithm], durationMs: result.durationMs, unplaced: result.unplacedBlocks?.length || 0, penalty: result.finalPenalty, success: result.success }]);
      }
    } catch (error: any) {
      setRows((prev) => [...prev, { algorithm: `Hata: ${error?.message || error}`, durationMs: 0, unplaced: -1, penalty: 0, success: false }]);
    } finally { setRunning(false); setCurrent(""); client.terminate(); clientRef.current = null; }
  };
  const cancel = () => { clientRef.current?.cancel(); setRunning(false); };

  return <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
    <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b p-5"><div><h3 className="flex items-center gap-2 font-black"><Activity className="h-5 w-5 text-indigo-600"/>Solver Benchmark</h3><p className="text-xs font-semibold text-slate-500">Aynı veri ve aynı seed ile algoritma profillerini karşılaştırır.</p></div><button onClick={onClose}><X className="h-5 w-5"/></button></header>
      <div className="p-5"><div className="mb-4 flex gap-2"><button disabled={running} onClick={run} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50"><Play className="h-4 w-4"/>Karşılaştırmayı Başlat</button><button disabled={!running} onClick={cancel} className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2 text-xs font-black text-rose-700 disabled:opacity-40"><Square className="h-4 w-4"/>Durdur</button></div>
      {running && <div className="mb-3 rounded-xl bg-indigo-50 p-3 text-xs font-bold text-indigo-700">Çalışıyor: {current}</div>}
      <div className="overflow-hidden rounded-2xl border"><table className="w-full text-left text-xs"><thead className="bg-slate-50"><tr><th className="p-3">Algoritma</th><th>Süre</th><th>Yerleşmeyen</th><th>Ceza</th><th>Durum</th></tr></thead><tbody>{rows.map((row,index)=><tr key={`${row.algorithm}-${index}`} className="border-t"><td className="p-3 font-bold">{row.algorithm}</td><td>{row.durationMs} ms</td><td>{row.unplaced}</td><td>{row.penalty}</td><td className={row.success?"font-black text-emerald-600":"font-black text-rose-600"}>{row.success?"Tam":"Kısmi"}</td></tr>)}{rows.length===0&&<tr><td colSpan={5} className="p-8 text-center text-slate-400">Henüz benchmark çalıştırılmadı.</td></tr>}</tbody></table></div></div>
    </div>
  </div>;
}
