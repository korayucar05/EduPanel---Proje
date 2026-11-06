import React from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Clock, LockKeyhole } from "lucide-react";

interface ScheduleGridProps {
  days: readonly string[];
  hours: readonly number[];
  timetable: any[];
  selectedId: string;
  viewType: "class" | "teacher";
  scheduleData: Record<string, any>;
  activeBlock: any | null;
  availableBlocks: any[];
  getCellData: (day: string, hour: number) => any[];
  onCellClick: (day: string, hour: number) => void;
  onOpenBlockedCell: (day: string, hour: number) => void;
  onPlaceBlock: (day: string, hour: number, block: any) => void;
  canPlaceBlock: (day: string, hour: number, block: any) => boolean;
  getPlacementIssue?: (day: string, hour: number, block: any) => string | null;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent, day: string, hour: number) => void;
  onRequestRemove: (value: { day: string; hour: number; assignment: any }) => void;
  onPreviewTeacher: (assignment: any) => void;
  lockedCellKeys: string[];
  onToggleLock: (day: string, hour: number) => void;
  onPreviousClass?: () => void;
  onNextClass?: () => void;
  canNavigateClasses?: boolean;
}

function ScheduleGrid({
  days,
  hours,
  timetable,
  selectedId,
  viewType,
  scheduleData,
  activeBlock,
  availableBlocks,
  getCellData,
  onCellClick,
  onOpenBlockedCell,
  onPlaceBlock,
  canPlaceBlock,
  getPlacementIssue,
  onDragOver,
  onDrop,
  onRequestRemove, onPreviewTeacher,
  lockedCellKeys, onToggleLock,
  onPreviousClass, onNextClass, canNavigateClasses = false,
}: ScheduleGridProps) {
  const [teacherPickerCell, setTeacherPickerCell] = React.useState<{ day: string; hour: number } | null>(null);
  const [classPickerCell, setClassPickerCell] = React.useState<{ day: string; hour: number; blocks: any[]; secondGroup?: boolean } | null>(null);

  React.useEffect(() => {
    setTeacherPickerCell(null);
    setClassPickerCell(null);
  }, [selectedId, viewType]);

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-3 lg:p-4 flex flex-col gap-4 w-full">
      <div className="relative">
        {viewType === "class" && selectedId && canNavigateClasses && (
          <>
            <button type="button" onClick={onPreviousClass} title="Önceki sınıf" aria-label="Önceki sınıf" className="absolute left-2 top-1/2 z-30 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full border border-rose-200/80 bg-white/90 text-rose-400 shadow-lg backdrop-blur transition hover:scale-105 hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-200">
              <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
            </button>
            <button type="button" onClick={onNextClass} title="Sonraki sınıf" aria-label="Sonraki sınıf" className="absolute right-2 top-1/2 z-30 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full border border-rose-200/80 bg-white/90 text-rose-400 shadow-lg backdrop-blur transition hover:scale-105 hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-200">
              <ChevronRight className="h-6 w-6" strokeWidth={2.5} />
            </button>
          </>
        )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse table-fixed">
          <thead>
            <tr>
              <th className="bg-slate-50 border border-slate-200 p-1.5 w-20 shrink-0">
                <Clock className="w-4 h-4 mx-auto text-slate-400" />
              </th>
              {days.map((day) => (
                <th key={day} className="bg-slate-50 border border-slate-200 p-1.5 font-bold text-slate-700 text-xs w-1/5">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map((hour) => (
              <tr key={hour}>
                <td className="border border-slate-200 p-1 text-center bg-slate-50/50">
                  <div className="font-extrabold text-slate-700 text-xs">{hour}</div>
                  {(() => {
                    const timeInfo = timetable.find((item: any) => item.hour === hour);
                    return timeInfo ? (
                      <div className="text-[9px] text-slate-400 font-medium tracking-tight whitespace-nowrap leading-tight">
                        {timeInfo.start} - {timeInfo.end}
                      </div>
                    ) : null;
                  })()}
                </td>
                {days.map((day) => {
                  const cellDataArray = getCellData(day, hour);
                  const hasData = cellDataArray.length > 0;
                  const isBlocked = selectedId && Boolean(scheduleData[`blocked_${viewType}_${selectedId}_${day}_${hour}`]);
                  const lockKey = `${viewType}_${selectedId}_${day}_${hour}`;
                  const isLocked = lockedCellKeys.includes(lockKey);

                  const hasElective = cellDataArray.some((item: any) => {
                    const compulsory = item.type === "Zorunlu Ders" || item.type === "compulsory";
                    const common = String(item.courseName || "").toLocaleLowerCase("tr-TR").includes("ortak");
                    return !compulsory && !common;
                  });
                  const hasCommon = cellDataArray.some((item: any) =>
                    String(item.courseName || "").toLocaleLowerCase("tr-TR").includes("ortak"),
                  );

                  const normalizeGroup = (value: any) => String(value || "").trim().toLocaleLowerCase("tr-TR");
                  const placedGroups = new Set(cellDataArray.map((item: any) => normalizeGroup(item.groupName)).filter(Boolean));
                  const canAddSecondGroup =
                    viewType === "class" && hasData && !hasCommon && cellDataArray.length < 2 && placedGroups.size === 1;
                  const cellAvailableBlocks = !hasData
                    ? availableBlocks
                    : canAddSecondGroup
                      ? availableBlocks.filter((block: any) => {
                          const blockGroup = normalizeGroup(block.originalCourses?.[0]?.groupName || block.groupName);
                          if (!blockGroup || placedGroups.has(blockGroup)) return false;
                          return !String(block.courseName || "").toLocaleLowerCase("tr-TR").includes("ortak");
                        })
                      : [];

                  return (
                    <td
                      key={`${day}-${hour}`}
                      onClick={() => {
                        if (isLocked) return;
                        if (viewType === "teacher" && !isBlocked && !hasData) {
                          setTeacherPickerCell({ day, hour });
                          return;
                        }
                        if (viewType === "class" && !isBlocked && !hasData && cellAvailableBlocks.length > 0) {
                          setClassPickerCell({ day, hour, blocks: cellAvailableBlocks });
                          return;
                        }
                        if (viewType === "class" && !isBlocked && canAddSecondGroup && cellAvailableBlocks.length > 0) {
                          setClassPickerCell({ day, hour, blocks: cellAvailableBlocks, secondGroup: true });
                          return;
                        }
                        onCellClick(day, hour);
                      }}
                      onContextMenu={(event) => { event.preventDefault(); if (selectedId) onToggleLock(day, hour); }}
                      onDragOver={onDragOver}
                      onDragEnter={(event) => event.preventDefault()}
                      onDrop={(event) => onDrop(event, day, hour)}
                      className={`border-black border p-0.5 ${
                        viewType === "teacher" ? "h-[58px] min-h-[58px]" : "h-[82px] min-h-[82px]"
                      } align-top transition-colors cursor-pointer relative group ${
                        isBlocked
                          ? "bg-slate-200/90 hover:bg-slate-300/80 border-slate-300"
                          : hasData
                            ? hasElective
                              ? "bg-yellow-50 hover:bg-yellow-100 border-yellow-200 text-yellow-900"
                              : hasCommon
                                ? "bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-900"
                                : "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800"
                            : activeBlock
                              ? "hover:bg-indigo-50"
                              : "hover:bg-slate-50"
                      }`}
                    >
                      {isLocked && <span className="absolute right-1 top-1 z-10 rounded bg-slate-900 p-1 text-white" title="Kilitli hücre - sağ tıklayarak aç"><LockKeyhole className="h-3 w-3"/></span>}
                      {isBlocked ? (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-1 text-slate-600">
                          <span className="text-[10px] font-bold tracking-wider uppercase">KAPALI</span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              onOpenBlockedCell(day, hour);
                            }}
                            className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-[9px] font-black text-emerald-700 shadow-sm transition hover:border-emerald-500 hover:bg-emerald-50"
                            title="Bu hücreyi yeniden ders atamaya aç"
                          >
                            Hücreyi Aç
                          </button>
                        </div>
                      ) : hasData ? (
                        <div className="flex flex-col h-full justify-center gap-0.5 overflow-hidden p-0.5">
                          {cellDataArray.map((item: any, index: number) => {
                            const compulsory = item.type === "Zorunlu Ders" || item.type === "compulsory";
                            const common = String(item.courseName || "").toLocaleLowerCase("tr-TR").includes("ortak");
                            const titleClass = !compulsory && !common ? "text-amber-950" : common ? "text-orange-950" : "text-emerald-900";
                            const subClass = !compulsory && !common ? "text-amber-800/95" : common ? "text-orange-800/95" : "text-emerald-800/80";
                            return (
                              <div key={`${item.blockId || item.courseName}-${index}`} className="relative min-h-0">
                                <button
                                  type="button"
                                  className="w-full px-0.5 py-0 rounded flex flex-col justify-center items-center bg-transparent hover:bg-indigo-50 hover:ring-1 hover:ring-indigo-300 transition-all cursor-pointer min-h-0"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    onPreviewTeacher(item);
                                  }}
                                  title="Öğretmenin ders dağıtımını görmek için tıklayın"
                                >
                                <span className={`font-extrabold ${viewType === "teacher" ? "text-[9px]" : "text-[10px]"} text-center block leading-tight line-clamp-2 ${titleClass}`} title={item.courseName}>
                                  {item.courseName}
                                </span>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className={`font-semibold ${viewType === "teacher" ? "text-[9px]" : "text-[8px]"} truncate max-w-[80px] ${subClass}`}>
                                    {viewType === "class"
                                      ? [item.teacherName, item.teacherName2].filter(Boolean).join(" & ")
                                      : item.className}
                                  </span>
                                  {item.groupName && !String(item.courseName || "").includes(`(${item.groupName})`) && (
                                    <span className="px-1 py-[1px] rounded text-[8px] font-extrabold uppercase border bg-white/70 border-current/20">
                                      {item.groupName}
                                    </span>
                                  )}
                                </div>
                                </button>
                              </div>
                            );
                          })}
                          {canAddSecondGroup && (
                            <div className="mt-0.5 border-t border-dashed border-amber-300 pt-0.5" onClick={(event) => event.stopPropagation()}>
                              {cellAvailableBlocks.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setClassPickerCell({ day, hour, blocks: cellAvailableBlocks, secondGroup: true })}
                                  className="h-7 w-full rounded-md border border-amber-300 bg-white px-1 text-[9px] font-black text-amber-800 transition hover:border-amber-500 hover:bg-amber-50"
                                  title="Diğer grubun ders bloğunu bu hücreye yerleştirin"
                                >
                                  + Diğer grubun dersini seç
                                </button>
                              ) : (
                                <span className="block text-center text-[7.5px] font-bold text-amber-500">Diğer grup için kalan blok yok</span>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center p-1" onClick={(event) => event.stopPropagation()}>
                          {viewType === "teacher" ? (
                            <button
                              type="button"
                              onClick={() => setTeacherPickerCell({ day, hour })}
                              className="flex h-full min-h-8 w-full items-center justify-center rounded-lg border border-dashed border-indigo-200 bg-indigo-50/35 px-1.5 text-[9px] font-black text-indigo-500 transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700"
                              title="Bu hücreye atanacak sınıf dersini seçin"
                            >
                              {cellAvailableBlocks.length > 0 ? "+ Sınıf dersi seç" : "Kalan blok yok"}
                            </button>
                          ) : cellAvailableBlocks.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setClassPickerCell({ day, hour, blocks: cellAvailableBlocks })}
                              className="flex h-full min-h-9 w-full items-center justify-center rounded-lg border border-dashed border-indigo-200 bg-indigo-50/35 px-2 text-[10px] font-black text-indigo-600 transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-800"
                              title="Bu hücreye yerleştirilecek ders bloğunu seçin"
                            >
                              + Ders bloğu seç
                            </button>
                          ) : (
                            <span className="text-[9px] font-semibold text-slate-300">Kalan blok yok</span>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>

      {viewType === "class" && classPickerCell && selectedId && (() => {
        const { day, hour, secondGroup } = classPickerCell;
        // availableBlocks zaten useMemo içinde Türkçe alfabetik sıralanır.
        // Modal açılırken listeyi yeniden sıralamamak büyük ders listelerinde gereksiz işi önler.
        const blocks = classPickerCell.blocks;
        return (
          <div
            className="fixed inset-0 z-[125] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[1px]"
            onMouseDown={(event) => { if (event.currentTarget === event.target) setClassPickerCell(null); }}
          >
            <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-cyan-50 px-5 py-4">
                <div>
                  <div className="text-lg font-black text-slate-900">{day} · {hour}. ders saati</div>
                  <div className="mt-1 text-sm font-bold text-slate-500">{secondGroup ? "Diğer grubun dersini seçin" : "Sınıfa atanacak ders bloğunu seçin"}</div>
                </div>
                <button type="button" onClick={() => setClassPickerCell(null)} className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50">Kapat</button>
              </div>
              <div className="max-h-[68vh] overflow-y-auto p-4">
                {blocks.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-bold text-slate-400">Bu sınıf için kalan ders bloğu yok.</div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {blocks.map((block: any) => {
                      const placeable = canPlaceBlock(day, hour, block);
                      const duration = Number(block.duration || 1);
                      const issue = placeable ? null : (getPlacementIssue?.(day, hour, block) || "Bu ders bloğu seçilen saate yerleştirilemez.");
                      const originals = Array.isArray(block.originalCourses) && block.originalCourses.length
                        ? block.originalCourses
                        : [block];
                      const courseLabel = originals.length > 1
                        ? originals.map((item:any)=>String(item?.courseName || item?.name || "Ders").trim()).filter(Boolean).join(" + ")
                        : String(block.courseName || "Ders");
                      const teacherLabel = [...new Set(
                        originals.flatMap((item:any)=>[item?.teacherName,item?.teacherName2]).filter(Boolean).map((name:any)=>String(name).trim())
                      )].join(" / ");
                      return (
                        <button
                          key={block.__pickerId}
                          type="button"
                          title={issue || `${courseLabel}${teacherLabel ? ` · ${teacherLabel}` : ""}`}
                          onClick={() => {
                            if (!placeable) {
                              window.alert(issue);
                              return;
                            }
                            onPlaceBlock(day, hour, block);
                            setClassPickerCell(null);
                          }}
                          className={`flex min-h-[54px] items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${placeable ? "border-indigo-200 bg-white hover:border-indigo-400 hover:bg-indigo-50" : "border-rose-200 bg-rose-50/60 hover:bg-rose-50"}`}
                        >
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
                              <span className="min-w-0 truncate text-[16px] font-black text-slate-950">{courseLabel}</span>
                              {teacherLabel && <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-slate-600">{teacherLabel}</span>}
                            </div>
                          </div>
                          {block.groupName && <span className="shrink-0 rounded-md bg-indigo-50 px-1.5 py-1 text-[10px] font-black text-indigo-700">{block.groupName}</span>}
                          <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-1 text-[10px] font-black text-slate-600">B{Number(block.__blockIndex || 0) + 1}/{Number(block.__blockCount || 1)}</span>
                          {!placeable && <span className="shrink-0 rounded-md bg-rose-100 px-1.5 py-1 text-[10px] font-black text-rose-700">Çakışma</span>}
                          <span className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-black ${duration === 2 ? "bg-indigo-600 text-white" : "bg-amber-300 text-amber-950"}`}>{duration} SAAT</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {viewType === "teacher" && teacherPickerCell && selectedId && (() => {
        const { day, hour } = teacherPickerCell;
        const grouped = availableBlocks.reduce<Record<string, any[]>>((acc, block: any) => {
          const className = String(block.className || "Sınıf belirtilmedi").trim() || "Sınıf belirtilmedi";
          (acc[className] ||= []).push(block);
          return acc;
        }, {});
        Object.values(grouped).forEach((blocks) => blocks.sort((a: any, b: any) =>
          String(a.courseName || "").localeCompare(String(b.courseName || ""), "tr", { sensitivity: "base" })
          || Number(a.__blockIndex || 0) - Number(b.__blockIndex || 0)
        ));
        const classNames = Object.keys(grouped).sort((a, b) => a.localeCompare(b, "tr", { sensitivity: "base" }));
        return (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[1px]"
            onMouseDown={(event) => { if (event.currentTarget === event.target) setTeacherPickerCell(null); }}
          >
            <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-sky-50 px-4 py-3">
                <div>
                  <div className="text-base font-black text-slate-900">{day} · {hour}. ders saati</div>
                  <div className="mt-1 text-xs font-bold text-slate-500">Sınıf dersini seçin · bloklar 2 saat, tek kalan saat 1 saat</div>
                </div>
                <button type="button" onClick={() => setTeacherPickerCell(null)} className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-600 hover:bg-slate-50">Kapat</button>
              </div>
              <div className="max-h-[62vh] overflow-y-auto p-3">
                {classNames.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs font-bold text-slate-400">Bu öğretmen için kalan ders bloğu yok.</div>
                ) : (
                  <div className="space-y-3">
                    {classNames.map((className) => (
                      <div key={className} className="rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
                        <div className="mb-2.5 text-[13px] font-black uppercase tracking-wide text-indigo-700">{className}</div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {grouped[className].map((block: any) => {
                            const placeable = canPlaceBlock(day, hour, block);
                            const duration = Number(block.duration || 1);
                            const hourLabel = duration === 2 ? `${hour}. ve ${hour + 1}. saat` : `${hour}. saat`;
                            return (
                              <button
                                key={block.__pickerId}
                                type="button"
                                onClick={() => {
                                  if (!placeable) {
                                    window.alert(getPlacementIssue?.(day, hour, block) || "Bu ders bloğu seçilen başlangıç saatine yerleştirilemez.");
                                    return;
                                  }
                                  onPlaceBlock(day, hour, block);
                                  setTeacherPickerCell(null);
                                }}
                                className={`rounded-xl border p-3 text-left transition ${placeable ? "border-indigo-200 bg-white hover:border-indigo-400 hover:bg-indigo-50" : "border-rose-200 bg-rose-50/60 hover:bg-rose-50"}`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <span className="text-[15px] font-black leading-tight text-slate-900">{block.courseName}</span>
                                  <div className="flex shrink-0 flex-col items-end gap-1">
                                    <span className={`rounded-md px-2.5 py-1 text-[11px] font-black ${duration === 2 ? "bg-indigo-600 text-white" : "bg-amber-300 text-amber-950"}`}>{duration} SAAT</span>
                                    <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-700">BLOK {Number(block.__blockIndex || 0) + 1}/{Number(block.__blockCount || 1)}</span>
                                  </div>
                                </div>
                                {block.groupName && <div className="mt-1.5 text-[11px] font-bold text-slate-600">Grup: {block.groupName}</div>}
                                <div className="mt-2 text-[11px] font-bold text-slate-600">{hourLabel}{duration === 2 ? " · sonraki hücre zorunlu" : ""}</div>
                                {!placeable && <div className="mt-1.5 text-[10px] font-black leading-snug text-rose-600">{getPlacementIssue?.(day, hour, block) || "Bu başlangıç saatine yerleştirilemez."}</div>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {!selectedId && (
        <div className="flex items-center justify-center gap-2 text-slate-500 py-4 bg-slate-50 rounded-xl border border-slate-100 mx-14">
          <AlertCircle className="w-5 h-5" />
          <span className="font-semibold text-sm">Programı görüntülemek için lütfen yukarıdan bir seçim yapın.</span>
        </div>
      )}
    </div>
  );
}

export default React.memo(ScheduleGrid);
