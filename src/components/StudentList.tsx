import React, { useState } from "react";
import { Search, Filter, MoreVertical, Plus } from "lucide-react";
import { initialStudents as mockStudents } from "../data";

export default function StudentList() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredStudents = mockStudents.filter(
    (student) =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.id.includes(searchTerm) ||
      student.classroom.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Öğrenci Rehberi</h2>
          <p className="text-sm text-gray-500 mt-1">
            Okuldaki tüm öğrencilerin kaydı ve detayları.
          </p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm">
          <Plus className="w-4 h-4" />
          Öğrenci Ekle
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-gray-50/50">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="İsim, ID veya Sınıf ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 w-full sm:w-auto justify-center transition-colors">
            <Filter className="w-4 h-4" />
            Filtrele
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-4">Öğrenci</th>
                <th className="px-6 py-4">Öğrenci No</th>
                <th className="px-6 py-4">Sınıf</th>
                <th className="px-6 py-4 text-center">GNO</th>
                <th className="px-6 py-4 text-center">Devamsızlık</th>
                <th className="px-6 py-4">Durum</th>
                <th className="px-6 py-4 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStudents.map((student) => (
                <tr
                  key={student.id}
                  className="hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <img
                        src={student.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=4f46e5&color=fff`}
                        alt={student.name}
                        className="w-9 h-9 rounded-full bg-gray-100 object-cover"
                        onError={(e) => {
                          e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=4f46e5&color=fff`;
                        }}
                      />
                      <span className="font-medium text-gray-800">
                        {student.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    #{student.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                      {student.classroom}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-800">
                    {student.gpa ?? student.oob ?? "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                    <span
                      className={`font-medium ${(student.absences ?? 0) > 10 ? "text-red-600" : "text-gray-600"}`}
                    >
                      {student.absences ?? 0} Gün
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        student.status === "Aktif"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {student.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredStudents.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    Arama kriterlerine uygun öğrenci bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination placeholder */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500 bg-gray-50/30">
          <span>{filteredStudents.length} öğrenci gösteriliyor.</span>
          <div className="flex gap-1">
            <button
              className="px-3 py-1 border border-gray-200 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50"
              disabled
            >
              Önceki
            </button>
            <button
              className="px-3 py-1 border border-gray-200 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50"
              disabled
            >
              Sonraki
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
