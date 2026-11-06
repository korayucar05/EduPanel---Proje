import React, { useEffect, useMemo, useRef, useState } from "react";
import { LayoutTemplate, LockKeyhole, Save } from "lucide-react";
import type { Classroom } from "../types";
import appStateService from "../core/state/AppStateService";
import { compareClassroomNames } from "../utils/classroomSort";
import {
  findSchoolLocationForClass,
  readSchoolBuildingCatalog,
  type SchoolBuildingClass,
} from "./schoolBuildingCatalog";

interface ClassSeatingPlanModuleProps {
  students: any[];
  classrooms?: Classroom[];
  initialClassName?: string;
  onOpenStudentSeating?: () => void;
}

type DeskColumns = 3 | 4;
type CrokiObjectType = "teacher-desk" | "teacher-chair" | "door" | "window";

type CrokiObject = {
  id: string;
  type: CrokiObjectType;
  x: number;
  y: number;
};

type PhysicalLayout = {
  classroomId?: string;
  classroomName?: string;
  buildingId?: string;
  buildingName?: string;
  floorId?: string;
  floorName?: string;
  deskColumns?: DeskColumns;
  deskRows?: number;
  activeDesks?: boolean[];
  capacity?: number;
  objects?: CrokiObject[];
  elements?: Array<{ id: string; type: "teacher-desk" | "door" | "window"; x: number; y: number }>;
  updatedAt?: string;
};

const normalize = (value: unknown) => String(value || "").trim().toLocaleUpperCase("tr-TR");
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const rowsOf = (count: number) => Array.from({ length: clamp(Math.round(count || 8), 1, 8) }, (_, index) => index);
const colsOf = (count: DeskColumns) => Array.from({ length: count }, (_, index) => index);

const defaultObjects = (): CrokiObject[] => [
  { id: "teacher-desk", type: "teacher-desk", x: 38, y: 4 },
  { id: "teacher-chair", type: "teacher-chair", x: 47, y: 9 },
  { id: "door", type: "door", x: 2, y: 80 },
  { id: "window-1", type: "window", x: 88, y: 22 },
  { id: "window-2", type: "window", x: 88, y: 47 },
  { id: "window-3", type: "window", x: 88, y: 70 },
];

const makeActiveDesks = (columns: DeskColumns, rows: number) =>
  Array.from({ length: columns * rows }, () => true);

function normalizeObjects(saved: PhysicalLayout | null | undefined): CrokiObject[] {
  if (Array.isArray(saved?.objects) && saved.objects.length) {
    const valid = saved.objects
      .filter((item): item is CrokiObject => Boolean(item && ["teacher-desk", "teacher-chair", "door", "window"].includes(String(item.type))))
      .map((item) => ({
        id: String(item.id || `${item.type}-${Math.random().toString(36).slice(2, 8)}`),
        type: item.type,
        x: clamp(Number(item.x) || 0, 0, 91),
        y: clamp(Number(item.y) || 0, 0, 91),
      }));
    if (valid.length) return valid;
  }

  if (Array.isArray(saved?.elements) && saved.elements.length) {
    const migrated: CrokiObject[] = saved.elements
      .filter((item) => item && ["teacher-desk", "door", "window"].includes(String(item.type)))
      .map((item, index) => ({
        id: String(item.id || `${item.type}-${index + 1}`),
        type: item.type,
        x: clamp(Number(item.x) || 0, 0, 91),
        y: clamp(Number(item.y) || 0, 0, 91),
      }));
    if (migrated.some((item) => item.type === "teacher-desk")) {
      migrated.push({ id: "teacher-chair", type: "teacher-chair", x: 47, y: 14 });
    }
    if (migrated.length) return migrated;
  }

  return defaultObjects();
}

function normalizeLayout(saved: PhysicalLayout | null | undefined, location?: SchoolBuildingClass | null): PhysicalLayout {
  const deskColumns: DeskColumns = saved?.deskColumns === 3 ? 3 : 4;
  const deskRows = clamp(Number(saved?.deskRows) || 8, 1, 8);
  const desired = deskColumns * deskRows;
  const source = Array.isArray(saved?.activeDesks) ? saved.activeDesks.map(Boolean) : [];

  let activeDesks: boolean[];
  if (source.length >= 28 && deskColumns === 3 && source.length !== desired) {
    activeDesks = Array.from({ length: desired }, (_, index) => {
      const row = Math.floor(index / deskColumns);
      const column = index % deskColumns;
      return source[row * 4 + column] !== false;
    });
  } else {
    activeDesks = Array.from({ length: desired }, (_, index) => source[index] !== false);
  }

  if (!source.length) activeDesks = makeActiveDesks(deskColumns, deskRows);

  return {
    ...saved,
    classroomId: saved?.classroomId || location?.id || "",
    classroomName: saved?.classroomName || location?.name || "",
    buildingId: saved?.buildingId || location?.buildingId || "",
    buildingName: saved?.buildingName || location?.buildingName || "",
    floorId: saved?.floorId || location?.floorId || "",
    floorName: saved?.floorName || location?.floorName || "",
    deskColumns,
    deskRows,
    activeDesks,
    capacity: activeDesks.filter(Boolean).length * 2,
    objects: normalizeObjects(saved),
  };
}

function DeskIllustration({ active }: { active: boolean }) {
  return (
    <div className={`mx-auto flex h-full w-full max-w-[150px] flex-col items-center justify-center transition ${active ? "opacity-100" : "opacity-35"}`}>
      <div className={`relative h-7 w-[76%] rounded-md border-2 ${active ? "border-amber-700 bg-amber-200" : "border-slate-300 bg-slate-100"}`}>
        <span className={`absolute -bottom-1 left-[22%] h-2 w-1 rounded ${active ? "bg-amber-800" : "bg-slate-300"}`} />
        <span className={`absolute -bottom-1 right-[22%] h-2 w-1 rounded ${active ? "bg-amber-800" : "bg-slate-300"}`} />
      </div>
      <div className="mt-1 flex w-[72%] justify-between px-2">
        <span className={`h-3.5 w-4 rounded-b-md border ${active ? "border-indigo-500 bg-indigo-100" : "border-slate-300 bg-slate-100"}`} />
        <span className={`h-3.5 w-4 rounded-b-md border ${active ? "border-indigo-500 bg-indigo-100" : "border-slate-300 bg-slate-100"}`} />
      </div>
    </div>
  );
}

function TeacherDeskIllustration() {
  return (
    <div className="relative h-14 w-28 select-none">
      <div className="absolute left-1/2 top-1 h-9 w-24 -translate-x-1/2 rounded-lg border-2 border-amber-800 bg-amber-200 shadow-sm">
        <div className="absolute inset-x-2 top-2 h-1.5 rounded bg-amber-700/35" />
        <span className="absolute -bottom-2 left-3 h-3 w-1.5 rounded bg-amber-900" />
        <span className="absolute -bottom-2 right-3 h-3 w-1.5 rounded bg-amber-900" />
      </div>
      <div className="absolute inset-x-0 bottom-0 text-center text-[9px] font-black tracking-wide text-amber-950">ÖĞRETMEN MASASI</div>
    </div>
  );
}

function TeacherChairIllustration() {
  return (
    <div className="relative h-12 w-14 select-none">
      <div className="absolute left-1/2 top-1 h-7 w-8 -translate-x-1/2 rounded-lg border-2 border-slate-600 bg-slate-200" />
      <div className="absolute left-1/2 top-6 h-4 w-9 -translate-x-1/2 rounded-b-lg border-2 border-slate-600 bg-slate-300" />
      <span className="absolute bottom-0 left-3 h-3 w-1 rounded bg-slate-600" />
      <span className="absolute bottom-0 right-3 h-3 w-1 rounded bg-slate-600" />
    </div>
  );
}

function DoorIllustration() {
  return (
    <div className="relative h-16 w-11 select-none">
      <div className="absolute inset-x-1 bottom-0 top-0 rounded-t border-2 border-rose-700 bg-rose-100">
        <div className="absolute right-1.5 top-1/2 h-1.5 w-1.5 rounded-full bg-rose-800" />
      </div>
      <div className="absolute -bottom-3 inset-x-0 text-center text-[9px] font-black text-rose-800">KAPI</div>
    </div>
  );
}

function WindowIllustration() {
  return (
    <div className="relative h-12 w-16 select-none rounded-md border-2 border-cyan-600 bg-cyan-50 shadow-sm">
      <span className="absolute bottom-0 left-1/2 top-0 w-0.5 -translate-x-1/2 bg-cyan-500" />
      <span className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-cyan-500" />
      <span className="absolute left-1 top-1 h-2 w-5 -skew-x-12 rounded-sm bg-white/70" />
    </div>
  );
}

function CrokiObjectView({ type }: { type: CrokiObjectType }) {
  if (type === "teacher-desk") return <TeacherDeskIllustration />;
  if (type === "teacher-chair") return <TeacherChairIllustration />;
  if (type === "door") return <DoorIllustration />;
  return <WindowIllustration />;
}

export default function ClassSeatingPlanModule({
  students: _students,
  classrooms: classroomRecords = [],
  initialClassName,
}: ClassSeatingPlanModuleProps) {
  const catalog = useMemo(() => readSchoolBuildingCatalog(classroomRecords), [classroomRecords]);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  const classOptions = useMemo(() => {
    const source = catalog.classrooms.length
      ? catalog.classrooms
      : classroomRecords.map((classroom) => ({
          id: String(classroom.id || classroom.name),
          name: classroom.name,
          buildingId: "",
          buildingName: "",
          floorId: "",
          floorName: "",
          capacity: classroom.capacity,
        } as SchoolBuildingClass));
    return source.slice().sort((a, b) => compareClassroomNames(a.name, b.name));
  }, [catalog.classrooms, classroomRecords]);

  const [selectedClass, setSelectedClass] = useState("");
  const [layout, setLayout] = useState<PhysicalLayout>(() => normalizeLayout(null));
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const preferred = classOptions.find((room) => normalize(room.name) === normalize(initialClassName) || normalize(room.id) === normalize(initialClassName));
    setSelectedClass((current) => {
      if (preferred) return preferred.name;
      if (current && classOptions.some((room) => normalize(room.name) === normalize(current))) return current;
      return classOptions[0]?.name || "";
    });
  }, [classOptions, initialClassName]);

  const selectedLocation = useMemo(
    () => findSchoolLocationForClass(catalog, selectedClass) || classOptions.find((room) => normalize(room.name) === normalize(selectedClass)) || null,
    [catalog, classOptions, selectedClass],
  );

  const selectedClassroomRecord = useMemo(
    () => classroomRecords.find((classroom) => normalize(classroom.id) === normalize(selectedLocation?.id) || normalize(classroom.name) === normalize(selectedClass)),
    [classroomRecords, selectedClass, selectedLocation],
  );

  const classroomId = String(selectedClassroomRecord?.id || selectedLocation?.id || selectedClass || "").trim();
  const idStorageKey = classroomId ? `classroom_seating_layout_${classroomId}` : "";
  const legacyStorageKey = selectedClass ? `seating_plan_${selectedClass}` : "";

  useEffect(() => {
    let alive = true;
    if (!selectedClass) return;
    setLoading(true);
    Promise.all([
      idStorageKey ? appStateService.getItem<PhysicalLayout>(idStorageKey) : Promise.resolve(null),
      legacyStorageKey ? appStateService.getItem<PhysicalLayout>(legacyStorageKey) : Promise.resolve(null),
    ]).then(([byId, legacy]) => {
      if (!alive) return;
      const saved = byId || legacy;
      setLayout(normalizeLayout(saved, selectedLocation));
      setLocked(Boolean(saved));
    }).catch((error) => {
      console.error("Sınıf krokisi yüklenemedi:", error);
      if (alive) {
        setLayout(normalizeLayout(null, selectedLocation));
        setLocked(false);
      }
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [selectedClass, selectedLocation?.id, idStorageKey, legacyStorageKey]);

  const columns: DeskColumns = layout.deskColumns === 3 ? 3 : 4;
  const rows = clamp(Number(layout.deskRows) || 8, 1, 8);
  const activeDesks = Array.isArray(layout.activeDesks) && layout.activeDesks.length === columns * rows
    ? layout.activeDesks
    : makeActiveDesks(columns, rows);
  const objects = Array.isArray(layout.objects) && layout.objects.length ? layout.objects : defaultObjects();

  const toggleDesk = (row: number, column: number) => {
    if (locked) return;
    const index = row * columns + column;
    setLayout((current) => {
      const normalized = normalizeLayout(current, selectedLocation);
      const active = [...(normalized.activeDesks || makeActiveDesks(columns, rows))];
      active[index] = !active[index];
      return { ...normalized, activeDesks: active, capacity: active.filter(Boolean).length * 2 };
    });
  };

  const beginDrag = (event: React.PointerEvent<HTMLButtonElement>, object: CrokiObject) => {
    if (locked) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pointerX = ((event.clientX - rect.left) / rect.width) * 100;
    const pointerY = ((event.clientY - rect.top) / rect.height) * 100;
    dragRef.current = { id: object.id, offsetX: pointerX - object.x, offsetY: pointerY - object.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const moveDraggedObject = (event: React.PointerEvent<HTMLDivElement>) => {
    if (locked) return;
    const drag = dragRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!drag || !rect) return;
    const pointerX = ((event.clientX - rect.left) / rect.width) * 100;
    const pointerY = ((event.clientY - rect.top) / rect.height) * 100;
    setLayout((current) => ({
      ...current,
      objects: (current.objects || defaultObjects()).map((object) => object.id === drag.id
        ? { ...object, x: clamp(pointerX - drag.offsetX, 0, 91), y: clamp(pointerY - drag.offsetY, 0, 91) }
        : object),
    }));
  };

  const endDrag = () => { dragRef.current = null; };

  const saveSettings = async () => {
    if (!selectedClass || !classroomId) return;
    const normalizedLayout = normalizeLayout(layout, selectedLocation);
    const savedObjects = normalizedLayout.objects || defaultObjects();
    const payload: PhysicalLayout = {
      ...normalizedLayout,
      classroomId,
      classroomName: selectedClass,
      buildingId: selectedLocation?.buildingId || "",
      buildingName: selectedLocation?.buildingName || "",
      floorId: selectedLocation?.floorId || "",
      floorName: selectedLocation?.floorName || "",
      capacity: (normalizedLayout.activeDesks || []).filter(Boolean).length * 2,
      objects: savedObjects,
      elements: savedObjects
        .filter((object): object is CrokiObject & { type: "teacher-desk" | "door" | "window" } => object.type !== "teacher-chair")
        .map((object) => ({ id: object.id, type: object.type, x: object.x, y: object.y })),
      updatedAt: new Date().toISOString(),
    };
    try {
      await appStateService.setItem(idStorageKey, payload);
      await appStateService.setItem(legacyStorageKey, payload);
      setLayout(payload);
      setLocked(true);
    } catch (error) {
      console.error("Sınıf krokisi kaydedilemedi:", error);

    }
  };

  return (
    <div className="w-full space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <select
            value={selectedClass}
            onChange={(event) => setSelectedClass(event.target.value)}
            aria-label="Sınıf / şube seçiniz"
            className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {!classOptions.length && <option value="">Sınıf bulunamadı</option>}
            {classOptions.map((room) => <option key={`${room.id}-${room.name}`} value={room.name}>{room.name}</option>)}
          </select>

          {locked ? (
            <button
              type="button"
              onClick={() => setLocked(false)}
              disabled={!selectedClass || loading}
              aria-label="Krokide düzenlemeyi aç"
              title="Düzenlemek için kilidi aç"
              className="inline-flex h-11 w-[104px] shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
            >
              <LockKeyhole className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void saveSettings()}
              disabled={!selectedClass || loading}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> Kaydet
            </button>
          )}
        </div>
      </section>

      <section className="w-full rounded-[32px] border border-slate-200 bg-white p-3 shadow-sm md:p-5">
        {!selectedClass ? (
          <div className="flex min-h-[620px] items-center justify-center text-slate-300">
            <LayoutTemplate className="h-16 w-16" />
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[900px]">
            <div
              ref={canvasRef}
              onPointerMove={moveDraggedObject}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onPointerLeave={(event) => { if (event.buttons === 0) endDrag(); }}
              className="relative w-full overflow-hidden border-[8px] border-slate-300 bg-white shadow-inner"
              style={{ aspectRatio: "210 / 297", touchAction: locked ? "auto" : "none" }}
            >
              <div className="absolute left-[18%] right-[18%] top-[-4px] h-[3.6%] rounded-b-xl border-x-4 border-b-4 border-emerald-900 bg-emerald-800" />

              <div
                className="absolute inset-x-[5%] bottom-[3.5%] top-[15%] grid gap-x-[2.2%] gap-y-[0.6%]"
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
              >
                {rowsOf(rows).flatMap((row) => colsOf(columns).map((column) => {
                  const index = row * columns + column;
                  const active = activeDesks[index] !== false;
                  return (
                    <button
                      key={`${row}-${column}`}
                      type="button"
                      disabled={locked}
                      onClick={() => toggleDesk(row, column)}
                      title={locked ? "Kroki kilitli" : active ? "Bu sırayı pasif yapmak için tıklayın" : "Bu sırayı yeniden aktif yapmak için tıklayın"}
                      className={`group min-h-0 rounded-lg border-2 p-0.5 transition ${active ? "border-amber-300 bg-amber-50/80" : "border-dashed border-slate-300 bg-white/50"} ${locked ? "cursor-default" : "hover:border-indigo-400"}`}
                    >
                      <DeskIllustration active={active} />
                    </button>
                  );
                }))}
              </div>

              {objects.map((object) => (
                <button
                  key={object.id}
                  type="button"
                  disabled={locked}
                  onPointerDown={(event) => beginDrag(event, object)}
                  className={`absolute z-20 rounded-lg bg-transparent p-0 outline-none transition ${locked ? "cursor-default" : "cursor-grab hover:scale-[1.03] active:cursor-grabbing"}`}
                  style={{ left: `${object.x}%`, top: `${object.y}%`, touchAction: locked ? "auto" : "none" }}
                  aria-label={`${object.type} objesini taşı`}
                  title={locked ? "Kroki kilitli" : "Sürükleyerek yerini değiştirin"}
                >
                  <CrokiObjectView type={object.type} />
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
