import React, { useState } from "react";
import { Search, Mail, Phone, MoreVertical, Plus } from "lucide-react";
import { initialTeachers as mockTeachers } from "../data";

export default function TeacherList() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTeachers = mockTeachers.filter(
    (teacher) =>
      teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.branch.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Öğretmen Kadrosu</h2>
          <p className="text-sm text-gray-500 mt-1">
            Okulda görev yapan tüm öğretmenler ve branşları.
          </p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm">
          <Plus className="w-4 h-4" />
          Öğretmen Ekle
        </button>
      </div>

      <div className="mb-6 relative w-full sm:max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="İsim veya branş ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 shadow-sm rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTeachers.map((teacher) => (
          <div
            key={teacher.id}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow relative group"
          >
            <button className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
              <MoreVertical className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-4 mb-4">
              <img
                src={teacher.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(teacher.name)}&background=6366f1&color=fff`}
                alt={teacher.name}
                className="w-16 h-16 rounded-full bg-gray-100 object-cover ring-4 ring-gray-50"
                onError={(e) => {
                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(teacher.name)}&background=6366f1&color=fff`;
                }}
              />
              <div>
                <h3 className="font-semibold text-gray-800 text-lg leading-tight">
                  {teacher.name}
                </h3>
                <span className="text-sm text-blue-600 font-medium inline-block mt-1 bg-blue-50 px-2 py-0.5 rounded-md">
                  {teacher.branch}
                </span>
              </div>
            </div>

            <div className="space-y-3 mt-5 pt-5 border-t border-gray-50">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Mail className="w-4 h-4 text-gray-400" />
                <a
                  href={`mailto:${teacher.email}`}
                  className="hover:text-blue-600 truncate"
                >
                  {teacher.email}
                </a>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Phone className="w-4 h-4 text-gray-400" />
                <span>{teacher.phone}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <div className="w-4 h-4 flex items-center justify-center bg-gray-100 text-xs font-bold rounded-sm text-gray-400">
                  S
                </div>
                <span>
                  {teacher.assignedClassrooms
                    ? teacher.assignedClassrooms.length
                    : 0}{" "}
                  Sınıf (Haftalık)
                </span>
              </div>
            </div>
          </div>
        ))}
        {filteredTeachers.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-100 border-dashed">
            Arama kriterlerine uygun öğretmen bulunamadı.
          </div>
        )}
      </div>
    </div>
  );
}
