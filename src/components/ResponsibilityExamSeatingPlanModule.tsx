import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Layers3,
  Lock,
  LockOpen,
  Plus,
  RotateCcw,
  Save,
  School,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { Classroom, Student } from "../types";
import { sqliteStorage } from "../core/state/SyncStateStore";
import {
  createBuilding,
  createRoom,
  loadSchoolBuildingLayouts,
  loadSchoolBuildingLayoutsFromDatabase,
  normalizeActiveDesks,
  saveSchoolBuildingLayouts,
  flushSchoolBuildingLayoutWrites,
  type RoomElement,
  type RoomElementType,
  type SchoolBuildingLayout,
  type SchoolRoomLayout,
} from "./schoolBuildingLayoutStore";

interface Props {
  embedded?: boolean;
  students?: Student[];
  classrooms?: Classroom[];
}

type ExamSeatAssignments = Record<string, string>;

const elementMeta: Record<RoomElementType, { label: string }> = {
  board: { label: "Yazı Tahtası" },
  "teacher-desk": { label: "Öğretmen Masası" },
  door: { label: "Kapı" },
  window: { label: "Pencere" },
};

const normalize = (value: unknown) => String(value || "").trim().toLocaleUpperCase("tr-TR");
const studentNo = (student: any) => String(student?.number ?? student?.studentNumber ?? student?.schoolNo ?? student?.no ?? "").trim();

function roomSeatKey(room: SchoolRoomLayout) {
  return String(room.classroomId || room.id || room.name).trim();
}

function DeskPairIllustration({ active }: { active: boolean }) {
  return (
    <div className={`flex h-full w-full items-center justify-center ${active ? "opacity-100" : "opacity-30"}`}>
      <div className="relative h-[76%] w-[86%] min-h-[34px] max-h-[58px] rounded-md border-2 border-amber-800 bg-amber-100 shadow-sm">
        <div className="absolute bottom-0 left-1/2 top-0 w-[2px] -translate-x-1/2 bg-amber-700/70" />
        <div className="absolute -bottom-[9px] left-[10%] h-3 w-[34%] rounded-b-md border border-indigo-500 bg-indigo-100" />
        <div className="absolute -bottom-[9px] right-[10%] h-3 w-[34%] rounded-b-md border border-indigo-500 bg-indigo-100" />
        <span className="absolute -bottom-1 left-[7%] h-2.5 w-1 rounded bg-amber-900" />
        <span className="absolute -bottom-1 right-[7%] h-2.5 w-1 rounded bg-amber-900" />
      </div>
    </div>
  );
}

function RoomElementIllustration({ type }: { type: RoomElementType }) {
  if (type === "board") {
    return (
      <svg viewBox="0 0 320 48" className="h-12 w-80 max-w-[42vw] drop-shadow-sm" aria-hidden="true">
        <rect x="5" y="5" width="310" height="34" rx="4" fill="#050505" stroke="#111827" strokeWidth="4" />
        <path d="M16 43h288" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
        <path d="M20 13h92M128 13h62M204 13h92" stroke="#f8fafc" strokeWidth="2" strokeLinecap="round" opacity=".35" />
      </svg>
    );
  }
  if (type === "teacher-desk") {
    return (
      <svg viewBox="0 0 120 64" className="h-16 w-28 drop-shadow-sm" aria-hidden="true">
        <rect x="10" y="12" width="100" height="30" rx="6" fill="#fde68a" stroke="#92400e" strokeWidth="4" />
        <path d="M22 42v14M98 42v14" stroke="#78350f" strokeWidth="6" strokeLinecap="round" />
        <rect x="48" y="6" width="25" height="14" rx="2" fill="#e2e8f0" stroke="#475569" strokeWidth="2" />
      </svg>
    );
  }
  if (type === "door") {
    return (
      <svg viewBox="0 0 64 100" className="h-20 w-14 drop-shadow-sm" aria-hidden="true">
        <path d="M10 94V8h44v86" fill="#fecdd3" stroke="#9f1239" strokeWidth="4" />
        <path d="M18 92V14h30v78" fill="#fff1f2" stroke="#be123c" strokeWidth="3" />
        <circle cx="42" cy="54" r="3" fill="#881337" />
        <path d="M8 95h48" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 200" className="h-40 w-4 drop-shadow-sm" aria-hidden="true">
      <rect x="2" y="2" width="16" height="196" rx="3" fill="#ecfeff" stroke="#0891b2" strokeWidth="2" />
      <path d="M3 42h14M3 82h14M3 122h14M3 162h14" stroke="#06b6d4" strokeWidth="1.6" />
      <path d="M7 8v184" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity=".85" />
    </svg>
  );
}

export default function ResponsibilityExamSeatingPlanModule({ embedded = false, students = [], classrooms = [] }: Props = {}) {
  const [buildings, setBuildings] = useState<SchoolBuildingLayout[]>(() => loadSchoolBuildingLayouts());
  const [selectedBuildingId, setSelectedBuildingId] = useState("");
  const [selectedFloorId, setSelectedFloorId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [newBuildingName, setNewBuildingName] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomClassId, setNewRoomClassId] = useState("");
  const [editingSeat, setEditingSeat] = useState<number | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [assignments, setAssignments] = useState<ExamSeatAssignments>({});
  const [message, setMessage] = useState("");
  const [isSavingBuildingInfo, setIsSavingBuildingInfo] = useState(false);
  const [buildingsDeleteLocked, setBuildingsDeleteLocked] = useState(() => {
    try {
      return window.localStorage.getItem("enstitu-school-buildings-delete-locked-v1") !== "0";
    } catch {
      return true;
    }
  });
  const [roomDeleteLocks, setRoomDeleteLocks] = useState<Record<string, boolean>>(() => {
    try {
      const raw = window.localStorage.getItem("enstitu-school-room-delete-locks-v1");
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ elementId: string; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadSchoolBuildingLayoutsFromDatabase().then((stored) => {
      if (cancelled) return;
      if (stored.length || buildings.length === 0) setBuildings(stored);
    });
    const flush = () => { void flushSchoolBuildingLayoutWrites(); };
    window.addEventListener("pagehide", flush);
    return () => {
      cancelled = true;
      window.removeEventListener("pagehide", flush);
      void flushSchoolBuildingLayoutWrites();
    };
  // Yalnız ilk açılışta doğrudan SQLite koleksiyonundan yükle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("enstitu-school-buildings-delete-locked-v1", buildingsDeleteLocked ? "1" : "0");
    } catch {
      // Yerel depolama kapalıysa kilit yalnız bu oturumda geçerli kalır.
    }
  }, [buildingsDeleteLocked]);

  useEffect(() => {
    try {
      window.localStorage.setItem("enstitu-school-room-delete-locks-v1", JSON.stringify(roomDeleteLocks));
    } catch {
      // Yerel depolama kapalıysa sınıf kilitleri yalnız bu oturumda geçerli kalır.
    }
  }, [roomDeleteLocks]);

  useEffect(() => {
    const refresh = () => {
      if (!embedded) setBuildings(loadSchoolBuildingLayouts());
    };
    window.addEventListener("enstitu-school-building-layout-changed", refresh);
    return () => window.removeEventListener("enstitu-school-building-layout-changed", refresh);
  }, [embedded]);

  useEffect(() => {
    if (!buildings.length) {
      setSelectedBuildingId("");
      setSelectedFloorId("");
      setSelectedRoomId("");
      return;
    }
    const building = buildings.find((item) => item.id === selectedBuildingId) || buildings[0];
    if (building.id !== selectedBuildingId) setSelectedBuildingId(building.id);
    const floor = building.floors.find((item) => item.id === selectedFloorId) || building.floors[0];
    if (!floor) {
      setSelectedFloorId("");
      setSelectedRoomId("");
      return;
    }
    if (floor.id !== selectedFloorId) setSelectedFloorId(floor.id);
    const room = floor.rooms.find((item) => item.id === selectedRoomId) || floor.rooms[0];
    if (room && room.id !== selectedRoomId) setSelectedRoomId(room.id);
    if (!room) setSelectedRoomId("");
  }, [buildings, selectedBuildingId, selectedFloorId, selectedRoomId]);

  const selectedBuilding = useMemo(
    () => buildings.find((item) => item.id === selectedBuildingId) || null,
    [buildings, selectedBuildingId],
  );
  const selectedFloor = useMemo(
    () => selectedBuilding?.floors.find((item) => item.id === selectedFloorId) || null,
    [selectedBuilding, selectedFloorId],
  );
  const selectedRoom = useMemo(
    () => selectedFloor?.rooms.find((item) => item.id === selectedRoomId) || null,
    [selectedFloor, selectedRoomId],
  );

  const updateBuilding = (buildingId: string, updater: (building: SchoolBuildingLayout) => SchoolBuildingLayout) => {
    setBuildings((prev) => prev.map((building) => (building.id === buildingId ? updater(building) : building)));
  };

  const handleSaveBuildingInfo = async () => {
    if (!embedded || isSavingBuildingInfo) return;
    setIsSavingBuildingInfo(true);
    setMessage("");
    try {
      await saveSchoolBuildingLayouts(buildings);
      await flushSchoolBuildingLayoutWrites();
      setMessage("Bina bilgileri veritabanına kaydedildi.");
    } catch (error) {
      console.error("[Bina Bilgileri] Bilgileri Kaydet işlemi başarısız:", error);
      setMessage("Bina bilgileri veritabanına kaydedilemedi.");
    } finally {
      setIsSavingBuildingInfo(false);
    }
  };

  const updateSelectedRoom = (updater: (room: SchoolRoomLayout) => SchoolRoomLayout) => {
    if (!selectedBuildingId || !selectedFloorId || !selectedRoomId) return;
    updateBuilding(selectedBuildingId, (building) => ({
      ...building,
      floors: building.floors.map((floor) => floor.id === selectedFloorId ? {
        ...floor,
        rooms: floor.rooms.map((room) => room.id === selectedRoomId ? updater(room) : room),
      } : floor),
    }));
  };

  const addBuildingRecord = () => {
    const building = createBuilding(newBuildingName.trim() || `Bina ${buildings.length + 1}`);
    setBuildings((prev) => [...prev, building]);
    setSelectedBuildingId(building.id);
    setSelectedFloorId(building.floors[0]?.id || "");
    setSelectedRoomId("");
    setNewBuildingName("");
  };

  const deleteBuilding = (buildingId: string) => {
    if (buildingsDeleteLocked) return;
    setBuildings((prev) => prev.filter((item) => item.id !== buildingId));
  };

  const addRoom = () => {
    if (!selectedBuilding || !selectedFloor) return;
    const classroom = classrooms.find((item) => String(item.id) === newRoomClassId);
    const name = classroom?.name || newRoomName.trim() || `Sınıf ${selectedFloor.rooms.length + 1}`;
    const room = createRoom(name, classroom);
    // Aynı sınıf aynı okul krokisinde ikinci kez eklenmesin.
    const duplicate = buildings.some((building) => building.floors.some((floor) => floor.rooms.some((item) =>
      classroom?.id ? String(item.classroomId || item.id) === String(classroom.id) : normalize(item.name) === normalize(name),
    )));
    if (duplicate) {
      setMessage(`${name} zaten bina bilgileri içinde tanımlı.`);
      return;
    }
    updateBuilding(selectedBuilding.id, (building) => ({
      ...building,
      floors: building.floors.map((floor) => floor.id === selectedFloor.id ? { ...floor, rooms: [...floor.rooms, room] } : floor),
    }));
    setSelectedRoomId(room.id);
    setNewRoomName("");
    setNewRoomClassId("");
    setMessage(`${name} sınıfı eklendi.`);
  };

  const isRoomDeleteLocked = (roomId: string) => roomDeleteLocks[roomId] !== false;

  const toggleRoomDeleteLock = (roomId: string) => {
    setRoomDeleteLocks((prev) => ({ ...prev, [roomId]: !(prev[roomId] !== false) }));
  };

  const deleteRoom = (roomId: string) => {
    if (!selectedBuilding || !selectedFloor || isRoomDeleteLocked(roomId)) return;
    updateBuilding(selectedBuilding.id, (building) => ({
      ...building,
      floors: building.floors.map((floor) => floor.id === selectedFloor.id ? { ...floor, rooms: floor.rooms.filter((room) => room.id !== roomId) } : floor),
    }));
    setRoomDeleteLocks((prev) => {
      const next = { ...prev };
      delete next[roomId];
      return next;
    });
  };

  const beginDrag = (event: React.PointerEvent, element: RoomElement) => {
    if (!embedded || !canvasRef.current) return;
    event.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const elementX = rect.left + (element.x / 100) * rect.width;
    const elementY = rect.top + (element.y / 100) * rect.height;
    dragRef.current = {
      elementId: element.id,
      offsetX: event.clientX - elementX,
      offsetY: event.clientY - elementY,
    };
  };

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!embedded || !dragRef.current || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const rawX = ((event.clientX - rect.left - dragRef.current.offsetX) / rect.width) * 100;
      const rawY = ((event.clientY - rect.top - dragRef.current.offsetY) / rect.height) * 100;
      const elementId = dragRef.current.elementId;
      updateSelectedRoom((room) => ({
        ...room,
        elements: room.elements.map((item) => {
          if (item.id !== elementId) return item;
          const maxX = item.type === "window" ? 96 : 92;
          if (item.type === "window") {
            const x = rawX < 50 ? Math.max(0.5, Math.min(4, rawX)) : Math.max(94, Math.min(97, rawX));
            const y = Math.max(2, Math.min(72, rawY));
            return { ...item, x, y };
          }
          const x = Math.max(0, Math.min(maxX, rawX));
          const y = Math.max(0, Math.min(92, rawY));
          return { ...item, x, y };
        }),
      }));
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [embedded, selectedBuildingId, selectedFloorId, selectedRoomId]);

  const activeDesks = useMemo(() => selectedRoom ? normalizeActiveDesks(selectedRoom) : [], [selectedRoom]);
  const deskCount = selectedRoom ? selectedRoom.deskColumns * selectedRoom.deskRows : 0;

  const toggleDesk = (index: number) => {
    if (!embedded) return;
    updateSelectedRoom((room) => {
      const next = normalizeActiveDesks(room);
      next[index] = !next[index];
      return { ...room, activeDesks: next, capacity: next.filter(Boolean).length * 2 };
    });
  };

  useEffect(() => {
    if (embedded || !selectedRoom) {
      setAssignments({});
      return;
    }
    try {
      const raw = sqliteStorage.getItem(`exam_seating_assignment_${roomSeatKey(selectedRoom)}`) || "{}";
      const parsed = JSON.parse(raw);
      setAssignments(parsed && typeof parsed === "object" ? parsed : {});
    } catch {
      setAssignments({});
    }
    setEditingSeat(null);
    setStudentSearch("");
  }, [embedded, selectedRoom?.id, selectedRoom?.classroomId]);

  const saveAssignments = (next: ExamSeatAssignments, feedback: string) => {
    if (!selectedRoom) return;
    setAssignments(next);
    sqliteStorage.setItem(`exam_seating_assignment_${roomSeatKey(selectedRoom)}`, JSON.stringify(next));
    setMessage(feedback);
  };

  const filteredStudents = useMemo(() => {
    const q = normalize(studentSearch);
    return students
      .filter((student) => !q || normalize(`${studentNo(student)} ${student.name} ${student.classroom}`).includes(q))
      .slice()
      .sort((a, b) => normalize(a.classroom).localeCompare(normalize(b.classroom), "tr") || studentNo(a).localeCompare(studentNo(b), "tr", { numeric: true }));
  }, [students, studentSearch]);

  const studentById = useMemo(() => new Map(students.map((student) => [String(student.id), student])), [students]);

  const assignStudent = (seatIndex: number, studentId: string) => {
    const next = { ...assignments };
    Object.keys(next).forEach((key) => { if (next[key] === studentId) delete next[key]; });
    next[String(seatIndex)] = studentId;
    saveAssignments(next, "Öğrenci sınav oturma yerine atandı.");
    setEditingSeat(null);
    setStudentSearch("");
  };

  const autoAssign = () => {
    if (!selectedRoom) return;
    const activeIndexes = activeDesks.map((active, index) => active ? index : -1).filter((index) => index >= 0);
    const roomClassName = normalize(selectedRoom.name);
    const preferred = students.filter((student) => normalize(student.classroom) === roomClassName);
    const source = preferred.length ? preferred : students;
    const next: ExamSeatAssignments = {};
    source.slice(0, activeIndexes.length).forEach((student, index) => { next[String(activeIndexes[index])] = String(student.id); });
    saveAssignments(next, `${Math.min(source.length, activeIndexes.length)} öğrenci otomatik yerleştirildi.`);
  };

  const unassignedClassrooms = useMemo(() => {
    const used = new Set(buildings.flatMap((building) => building.floors.flatMap((floor) => floor.rooms.map((room) => String(room.classroomId || "")))));
    return classrooms.filter((classroom) => !used.has(String(classroom.id)) || String(classroom.id) === newRoomClassId);
  }, [buildings, classrooms, newRoomClassId]);

  const renderRoomCanvas = (readOnly: boolean) => {
    if (!selectedRoom) return null;
    const currentActiveDesks = activeDesks.filter(Boolean).length;
    const activeIndexes = activeDesks
      .map((active, index) => active ? index : -1)
      .filter((index) => index >= 0);
    const activeCenter = activeIndexes.length
      ? activeIndexes.reduce((acc, index) => {
          acc.col += index % selectedRoom.deskColumns;
          acc.row += Math.floor(index / selectedRoom.deskColumns);
          return acc;
        }, { col: 0, row: 0 })
      : { col: (selectedRoom.deskColumns - 1) / 2, row: (selectedRoom.deskRows - 1) / 2 };
    const averageCol = activeIndexes.length ? activeCenter.col / activeIndexes.length : activeCenter.col;
    const averageRow = activeIndexes.length ? activeCenter.row / activeIndexes.length : activeCenter.row;
    const desiredCol = (selectedRoom.deskColumns - 1) / 2;
    const desiredRow = (selectedRoom.deskRows - 1) / 2;
    const deskTranslateX = ((desiredCol - averageCol) / Math.max(1, selectedRoom.deskColumns)) * 100;
    const deskTranslateY = ((desiredRow - averageRow) / Math.max(1, selectedRoom.deskRows)) * 100;
    return (
      <div
        ref={canvasRef}
        className="relative mx-auto aspect-[210/297] w-full max-w-[900px] overflow-hidden border-[6px] border-slate-300 bg-white shadow-inner select-none touch-none"
      >
        <div
          className="absolute inset-x-[6%] bottom-[5%] top-[17%] grid gap-x-[2.3%] gap-y-[1.05%] p-1 transition-transform duration-300"
          style={{
            gridTemplateColumns: `repeat(${selectedRoom.deskColumns}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${selectedRoom.deskRows}, minmax(0, 1fr))`,
            transform: `translate(${deskTranslateX}%, ${deskTranslateY}%)`,
          }}
        >
          {Array.from({ length: deskCount }).map((_, index) => {
            const active = activeDesks[index] !== false;
            const student = !embedded ? studentById.get(assignments[String(index)] || "") : undefined;
            if (!active) {
              return embedded ? (
                <button key={index} type="button" onClick={() => toggleDesk(index)} className="rounded-lg border-2 border-dashed border-slate-200 bg-white/40 p-1">
                  <DeskPairIllustration active={false} />
                </button>
              ) : <div key={index} className="rounded-lg border border-dashed border-slate-200 bg-transparent" />;
            }
            if (!embedded) {
              return (
                <button key={index} type="button" onClick={() => setEditingSeat(index)} className="min-h-0 rounded-lg border-2 border-violet-300 bg-violet-50/95 p-1 text-center shadow-sm transition hover:border-cyan-400 hover:bg-cyan-50">
                  <DeskPairIllustration active />
                  {student ? <><div className="mt-0.5 truncate text-[8px] font-black text-slate-900">{student.name}</div><div className="truncate text-[7px] font-bold text-slate-500">{student.classroom} • No {studentNo(student) || "—"}</div></> : null}
                </button>
              );
            }
            return (
              <button key={index} type="button" onClick={() => toggleDesk(index)} title="Sırayı aktif/pasif yap" className="min-h-0 rounded-lg border border-amber-300 bg-amber-50/85 p-1 shadow-sm hover:border-indigo-400">
                <DeskPairIllustration active />
              </button>
            );
          })}
        </div>

        {selectedRoom.elements.map((element) => {
          const meta = elementMeta[element.type];
          return (
            <div
              key={element.id}
              onPointerDown={(event) => beginDrag(event, element)}
              className={`group absolute flex items-center justify-center bg-transparent p-0 ${element.type === "window" ? "" : "flex-col"} ${embedded ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"}`}
              style={{ left: `${element.x}%`, top: `${element.y}%`, zIndex: 20 }}
              title={embedded ? `${meta.label} — tut ve sürükle` : meta.label}
              aria-label={meta.label}
            >
              <RoomElementIllustration type={element.type} />
              {element.type === "window" ? (
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90 whitespace-nowrap rounded bg-white/80 px-1 py-0.5 text-[7px] font-black tracking-wide text-cyan-900 shadow-sm">
                  PENCERE
                </div>
              ) : (
                <div className="mt-0.5 whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-black text-slate-700 shadow-sm">{meta.label.toLocaleUpperCase("tr-TR")}</div>
              )}
            </div>
          );
        })}

        <div className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[9px] font-black text-slate-500">
          {selectedRoom.name} · {currentActiveDesks} aktif sıra · kapasite {currentActiveDesks * 2} öğrenci
        </div>
      </div>
    );
  };

  if (!embedded) {
    return (
      <div className="mx-auto max-w-[1700px] space-y-4">
        <section className="rounded-3xl border border-cyan-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2"><LayoutGrid className="h-5 w-5 text-cyan-700"/><h1 className="text-xl font-black text-slate-900">Sınav Yerleşim Planı</h1></div>
              <p className="mt-1 text-xs font-semibold text-slate-500">Bina, kat, sınıf ve kroki düzenlemeleri burada yapılmaz. Bu ekran Okul Bilgileri → Bina Bilgileri’nde hazırlanmış sabit sınıf krokilerini kullanır; yalnız öğrenci ataması değiştirilebilir.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select value={selectedBuildingId} onChange={(e) => { setSelectedBuildingId(e.target.value); setSelectedFloorId(""); setSelectedRoomId(""); }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black">
                {buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
              </select>
              <select value={selectedFloorId} onChange={(e) => { setSelectedFloorId(e.target.value); setSelectedRoomId(""); }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black">
                {(selectedBuilding?.floors || []).map((floor) => <option key={floor.id} value={floor.id}>{floor.name}</option>)}
              </select>
              <select value={selectedRoomId} onChange={(e) => setSelectedRoomId(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black">
                {(selectedFloor?.rooms || []).map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
              </select>
            </div>
          </div>
          {selectedRoom ? <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => setEditingSeat(activeDesks.findIndex(Boolean))} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-black text-white"><UserPlus className="h-4 w-4"/> Öğrenci Ata</button>
            <button type="button" onClick={autoAssign} className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black text-amber-950"><Users className="h-4 w-4"/> Otomatik Yerleştir</button>
            <button type="button" onClick={() => saveAssignments({}, "Sınav öğrenci yerleşimi temizlendi.")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700"><RotateCcw className="h-4 w-4"/> Öğrenci Yerleşimini Temizle</button>
            <span className="ml-auto rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">Kroki kilitli • Kaynak: Bina Bilgileri</span>
          </div> : null}
          {message ? <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">{message}</div> : null}
        </section>

        {selectedRoom ? <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">{renderRoomCanvas(true)}</section> : (
          <section className="flex min-h-[600px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <div><Building2 className="mx-auto h-14 w-14 text-slate-300"/><h2 className="mt-4 text-lg font-black text-slate-700">Bina Bilgileri içinde sınıf krokisi bulunamadı</h2><p className="mt-2 max-w-xl text-sm font-semibold text-slate-400">Önce Okul Bilgileri → Bina Bilgileri ekranında bina, kat ve sınıfları oluşturup sınıf krokisini kaydedin.</p></div>
          </section>
        )}

        {editingSeat !== null && selectedRoom ? (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/50 p-4" onClick={(e) => e.currentTarget === e.target && setEditingSeat(null)}>
            <div className="max-h-[84vh] w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 p-4"><div><h3 className="font-black text-slate-900">Sınav Sırasına Öğrenci Ata</h3><p className="text-xs font-semibold text-slate-500">{selectedRoom.name} • Sıra {editingSeat + 1}</p></div><button type="button" onClick={() => setEditingSeat(null)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5"/></button></div>
              <div className="p-4">
                <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input autoFocus value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Numara, ad soyad veya sınıf ara" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm font-semibold outline-none focus:border-cyan-400"/></div>
                {assignments[String(editingSeat)] ? <button type="button" onClick={() => { const next = { ...assignments }; delete next[String(editingSeat)]; saveAssignments(next, "Sıra boşaltıldı."); setEditingSeat(null); }} className="mt-3 w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-black text-rose-700">Bu Sırayı Boşalt</button> : null}
                <div className="mt-3 max-h-[58vh] space-y-2 overflow-y-auto pr-1">
                  {filteredStudents.map((student) => <button key={student.id} type="button" onClick={() => assignStudent(editingSeat, String(student.id))} className="flex w-full items-center justify-between rounded-2xl border border-slate-200 p-3 text-left hover:border-cyan-300 hover:bg-cyan-50"><div className="min-w-0"><div className="truncate text-sm font-black text-slate-900">{student.name}</div><div className="text-xs font-bold text-slate-500">{student.classroom} • No: {studentNo(student) || "—"}</div></div></button>)}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1700px] space-y-4">
      <div className="grid gap-4 xl:grid-cols-[330px_1fr]">
        <aside className="space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-cyan-700"/><h2 className="text-base font-black text-slate-900">Okul Binaları</h2></div>
            <div className="mt-3 flex gap-2"><input value={newBuildingName} onChange={(e) => setNewBuildingName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addBuildingRecord()} placeholder="Bina adı" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold outline-none focus:border-cyan-400"/><button type="button" onClick={addBuildingRecord} className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600 text-white"><Plus className="h-4 w-4"/></button></div>
            <div className="mt-3 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
              {buildings.map((building) => <div key={building.id} className={`flex min-w-[120px] shrink-0 items-center gap-1 rounded-2xl border p-1.5 ${building.id === selectedBuildingId ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-slate-50"}`}><button type="button" onClick={() => { setSelectedBuildingId(building.id); setSelectedFloorId(building.floors[0]?.id || ""); setSelectedRoomId(building.floors[0]?.rooms[0]?.id || ""); }} className="min-w-0 flex-1 px-2 py-1.5 text-center"><strong className="block truncate text-xs font-black text-slate-900">{building.name}</strong></button>{!buildingsDeleteLocked ? <button type="button" onClick={() => deleteBuilding(building.id)} className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50" title="Bloğu sil"><Trash2 className="h-3.5 w-3.5"/></button> : null}</div>)}
              {buildings.length ? <button type="button" onClick={() => setBuildingsDeleteLocked((locked) => !locked)} className={`sticky right-0 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm ${buildingsDeleteLocked ? "border-slate-300 bg-slate-800 text-white" : "border-amber-300 bg-amber-50 text-amber-700"}`} title={buildingsDeleteLocked ? "Blok silme kilidi kapalı — açmak için tıklayın" : "Blok silme kilidi açık — kapatmak için tıklayın"} aria-label={buildingsDeleteLocked ? "Blok silme kilidini aç" : "Blok silme kilidini kapat"}>{buildingsDeleteLocked ? <Lock className="h-4 w-4"/> : <LockOpen className="h-4 w-4"/>}</button> : null}
              {!buildings.length ? <div className="w-full shrink-0 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-xs font-bold text-slate-400">Okul binasını buradan tanımlayın.</div> : null}
            </div>
          </section>

          {selectedBuilding ? <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2"><Layers3 className="h-5 w-5 text-violet-700"/><h2 className="text-base font-black text-slate-900">Katlar ve Sınıflar</h2></div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">{selectedBuilding.floors.slice(0, 5).map((floor, floorIndex) => {
              const floorButtonLabels = ["Zemin Kat", "1. Kat", "2. Kat", "3. Kat", "4. Kat"];
              return <button key={floor.id} type="button" onClick={() => { setSelectedFloorId(floor.id); setSelectedRoomId(floor.rooms[0]?.id || ""); }} className={`rounded-xl px-2 py-2.5 text-[10px] font-black ${floor.id === selectedFloorId ? "bg-violet-700 text-white" : "bg-slate-100 text-slate-600"}`}>{floorButtonLabels[floorIndex] || floor.name}</button>;
            })}</div>
            {selectedFloor ? <>
              {classrooms.length ? <select value={newRoomClassId} onChange={(e) => { setNewRoomClassId(e.target.value); const found = classrooms.find((item) => String(item.id) === e.target.value); if (found) setNewRoomName(found.name); }} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-black"><option value="">Tanımlı sınıflardan seç…</option>{unassignedClassrooms.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.name}</option>)}</select> : null}
              <div className="mt-2 flex gap-2"><input value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRoom()} placeholder="Sınıf adı (örn. 9/A)" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold outline-none focus:border-cyan-400"/><button type="button" onClick={addRoom} className="rounded-xl bg-violet-700 px-3 text-white"><Plus className="h-4 w-4"/></button></div>
              <div className="mt-3 max-h-[430px] space-y-2 overflow-y-auto pr-1">{selectedFloor.rooms.map((room) => {
                const active = room.id === selectedRoomId;
                const locked = isRoomDeleteLocked(room.id);
                return <div key={room.id} className={`flex items-stretch gap-1.5 rounded-xl border p-1.5 ${active ? "border-red-700 bg-red-600" : "border-slate-200 bg-white"}`}>
                  <button type="button" onClick={() => setSelectedRoomId(room.id)} className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left ${active ? "text-white" : "text-slate-900"}`}>
                    <strong className={`block truncate font-black ${active ? "text-[17px] leading-5 text-white" : "text-[12px]"}`}>{room.name}</strong>
                    <span className={`text-[9px] font-bold ${active ? "text-white/85" : "text-slate-500"}`}>{room.deskColumns}×{room.deskRows} · kapasite {normalizeActiveDesks(room).filter(Boolean).length * 2} öğrenci</span>
                  </button>
                  <button type="button" onClick={() => toggleRoomDeleteLock(room.id)} className={`flex w-9 shrink-0 items-center justify-center rounded-lg border ${locked ? (active ? "border-white/40 bg-white/15 text-white" : "border-slate-300 bg-slate-800 text-white") : "border-amber-300 bg-amber-50 text-amber-700"}`} title={locked ? "Sınıf silme kilidi kapalı — açmak için tıklayın" : "Sınıf silme kilidi açık — kapatmak için tıklayın"} aria-label={locked ? `${room.name} silme kilidini aç` : `${room.name} silme kilidini kapat`}>{locked ? <Lock className="h-4 w-4"/> : <LockOpen className="h-4 w-4"/>}</button>
                  {!locked ? <button type="button" onClick={() => deleteRoom(room.id)} className="flex w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600" title="Sınıfı sil"><X className="h-3.5 w-3.5"/></button> : null}
                </div>;
              })}</div>
            </> : null}
          </section> : null}
        </aside>

        <main className="min-w-0">
          {selectedRoom ? <section className="overflow-hidden rounded-3xl border border-cyan-200 bg-white p-4 shadow-sm">{renderRoomCanvas(false)}</section> : <section className="flex min-h-[620px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm"><div><School className="mx-auto h-12 w-12 text-slate-300"/><h2 className="mt-4 text-lg font-black text-slate-700">Sınıf seçilmedi</h2><p className="mt-2 text-sm font-semibold text-slate-400">Soldan bina, kat ve sınıf tanımlayın. Bu kroki Sınav Yerleşim Planı ve Sınıf Oturma Planı tarafından ortak kullanılacaktır.</p></div></section>}
        </main>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSaveBuildingInfo}
          disabled={isSavingBuildingInfo}
          className="inline-flex items-center gap-2 rounded-xl bg-purple-950 px-6 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-purple-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {isSavingBuildingInfo ? "Kaydediliyor..." : "Bilgileri Kaydet"}
        </button>
      </div>
      {message ? <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">{message}</div> : null}
    </div>
  );
}
