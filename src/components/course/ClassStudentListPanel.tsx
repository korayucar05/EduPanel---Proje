import React, { useMemo } from "react";
import type { Student } from "../../types";

interface Props {
  students: Student[];
  classNameValue: string;
}

const normalizeClass = (value: unknown) =>
  String(value || "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/[\s\-_/]+/g, "");

const studentNo = (student: any) =>
  String(
    student?.number ??
      student?.studentNumber ??
      student?.schoolNo ??
      student?.no ??
      student?.id ??
      "",
  ).trim();

export default function ClassStudentListPanel({ students, classNameValue }: Props) {
  const rows = useMemo(() => {
    const target = normalizeClass(classNameValue);
    return students
      .filter((student) => normalizeClass(student?.classroom) === target)
      .slice()
      .sort(
        (a: any, b: any) =>
          studentNo(a).localeCompare(studentNo(b), "tr", { numeric: true }) ||
          String(a?.name || "").localeCompare(String(b?.name || ""), "tr"),
      );
  }, [students, classNameValue]);

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
        <div className="text-sm font-black text-slate-900">{classNameValue || "Sınıf"} Sınıf Listesi</div>
        <div className="mt-0.5 text-[10px] font-bold text-slate-500">{rows.length} öğrenci</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-xs">
          <thead className="bg-slate-900 text-white">
            <tr>
              <th className="w-32 px-4 py-3">Sınıf</th>
              <th className="w-36 px-4 py-3">Okul Numarası</th>
              <th className="px-4 py-3">Adı Soyadı</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((student) => (
              <tr key={String(student.id)} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-black text-slate-700">{classNameValue}</td>
                <td className="px-4 py-3 font-mono font-bold text-slate-700">{studentNo(student) || "—"}</td>
                <td className="px-4 py-3 font-black text-slate-900">{student.name || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <div className="p-10 text-center text-sm font-bold text-slate-400">
          Bu sınıfta kayıtlı öğrenci bulunamadı.
        </div>
      )}
    </section>
  );
}
