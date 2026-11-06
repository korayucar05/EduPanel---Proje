import React from "react";
import { Calendar, X } from "lucide-react";
import { DAYS, HOURS } from "../../../services/schedule/scheduleRules";

interface ClassroomPreviewModalProps {
  previewClassroom: any | null;
  scheduleData: Record<string, any>;
  timetable: any[];
  onClose: () => void;
  onGoToClass: (classId: string) => void;
}

function ClassroomPreviewModal({ previewClassroom, scheduleData, timetable, onClose, onGoToClass }: ClassroomPreviewModalProps) {
  if (!previewClassroom) return null;
  return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-4xl w-full p-6 relative">
            <button
              onClick={() => onClose()}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-full hover:bg-slate-50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-slate-900 font-extrabold text-base tracking-tight">
                  {previewClassroom.name} Sınıf Planı Önizlemesi
                </h3>
                <p className="text-slate-500 text-xs font-semibold">
                  Sınıf planı arayüzüne geçmek için aşağıdaki tabloya tıklayın.
                </p>
              </div>
            </div>

            {/* Compact Table */}
            <div
              onClick={() => {
                onGoToClass(previewClassroom.id);
              }}
              className="overflow-x-auto border border-slate-100 rounded-2xl cursor-pointer hover:border-indigo-200 transition-colors group"
            >
              <table className="w-full min-w-[500px] border-collapse table-fixed select-none">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="p-2 w-16 text-slate-400 text-center font-extrabold text-[10px]">
                      Saat
                    </th>
                    {DAYS.map((day) => (
                      <th
                        key={day}
                        className="p-2 text-slate-600 font-extrabold text-xs text-center border-l border-slate-100/50"
                      >
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HOURS.map((hour) => (
                    <tr key={hour} className="border-b border-slate-50">
                      <td className="p-1.5 text-center bg-slate-50/30">
                        <div className="text-slate-500 font-extrabold text-[10px]">{hour}</div>
                        {(() => {
                          const timeInfo = timetable.find((t: any) => t.hour === hour);
                          return timeInfo ? (
                            <div className="text-[8px] text-slate-400 font-normal mt-0.5 leading-tight whitespace-nowrap">
                              {timeInfo.start}-{timeInfo.end}
                            </div>
                          ) : null;
                        })()}
                      </td>
                      {DAYS.map((day) => {
                        const key = `class_${previewClassroom.id}_${day}_${hour}`;
                        const rawData = scheduleData[key];
                        const cellDataArray = rawData
                          ? Array.isArray(rawData)
                            ? rawData
                            : [rawData]
                          : [];
                        const hasData = cellDataArray.length > 0;
                        const isBlocked =
                          !!scheduleData[
                            `blocked_class_${previewClassroom.id}_${day}_${hour}`
                          ];

                        return (
                          <td
                            key={`${day}-${hour}`}
                            className={`p-1 text-center h-12 border-l border-slate-50 align-middle transition-colors ${
                              isBlocked
                                ? "bg-slate-100"
                                : hasData
                                  ? cellDataArray.some((cd: any) => {
                                      const isComp = cd.type === "Zorunlu Ders" || cd.type === "compulsory";
                                      return !isComp;
                                    })
                                    ? "bg-yellow-50/50 group-hover:bg-yellow-100/40"
                                    : "bg-emerald-50/50 group-hover:bg-emerald-100/40"
                                  : "bg-transparent group-hover:bg-indigo-50/20"
                            }`}
                          >
                            {isBlocked ? (
                              <span className="text-[8px] font-black text-slate-400 tracking-wider">
                                KAPALI
                              </span>
                            ) : hasData ? (
                              (() => {
                                const isFirstElective = !(cellDataArray[0].type === "Zorunlu Ders" || cellDataArray[0].type === "compulsory");
                                return (
                                  <div className="flex flex-col items-center justify-center gap-0.5">
                                    <span className={`text-[9px] font-black line-clamp-1 ${isFirstElective ? "text-amber-950" : "text-emerald-800"}`}>
                                      {cellDataArray[0].courseName}
                                    </span>
                                    <span
                                      className={`text-[8px] font-semibold truncate max-w-[80px] ${isFirstElective ? "text-amber-800/80" : "text-emerald-700/70"}`}
                                      title={[
                                        cellDataArray[0].teacherName,
                                        cellDataArray[0].teacherName2,
                                      ]
                                        .filter(Boolean)
                                        .join(" & ")}
                                    >
                                      {[
                                        cellDataArray[0].teacherName,
                                        cellDataArray[0].teacherName2,
                                      ]
                                        .filter(Boolean)
                                        .join(" & ")}
                                    </span>
                                  </div>
                                );
                              })()
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2.5 mt-5">
              <button
                onClick={() => onClose()}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer transition-colors"
              >
                Kapat
              </button>
              <button
                onClick={() => {
                  onGoToClass(previewClassroom.id);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer transition-colors"
              >
                Sınıf Planına Git
              </button>
            </div>
          </div>
        </div>

  );
}

export default React.memo(ClassroomPreviewModal);
