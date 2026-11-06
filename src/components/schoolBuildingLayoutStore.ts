import { sqliteStorage } from "../core/state/SyncStateStore";
import { fetchCollectionFromLocalDatabase, upsertLocalDocument } from "../lib/localDatabase";
import type { Classroom } from "../types";

export type RoomElementType = "board" | "teacher-desk" | "door" | "window";

export type RoomElement = {
  id: string;
  type: RoomElementType;
  x: number;
  y: number;
};

export type SchoolRoomLayout = {
  id: string;
  classroomId?: string;
  name: string;
  capacity: number;
  deskColumns: 3 | 4;
  deskRows: number;
  activeDesks: boolean[];
  elements: RoomElement[];
};

export type SchoolFloorLayout = {
  id: string;
  name: string;
  rooms: SchoolRoomLayout[];
};

export type SchoolBuildingLayout = {
  id: string;
  name: string;
  floors: SchoolFloorLayout[];
};

export const SCHOOL_BUILDING_LAYOUT_KEY = "school_building_layouts_v2";
const SCHOOL_BUILDING_LAYOUT_COLLECTION = "school_building_layouts";
const SCHOOL_BUILDING_LAYOUT_DOCUMENT_ID = "state";
let schoolBuildingPersistChain: Promise<unknown> = Promise.resolve();
const LEGACY_KEYS = ["enstitu_exam_seating_buildings_v1", "school_building_catalog_v1"];

export const makeLayoutId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const floorNameByIndex = (index: number) => index === 0 ? "Zemin Kat" : `${index}. Kat`;

export const defaultRoomElements = (): RoomElement[] => [
  { id: makeLayoutId("board"), type: "board", x: 35, y: 3 },
  { id: makeLayoutId("teacher"), type: "teacher-desk", x: 42, y: 14 },
  { id: makeLayoutId("door"), type: "door", x: 2, y: 78 },
  { id: makeLayoutId("window"), type: "window", x: 88, y: 28 },
  { id: makeLayoutId("window"), type: "window", x: 88, y: 55 },
];

const activeDeskDefaults = (columns: number, rows: number) =>
  Array.from({ length: Math.max(1, columns) * Math.max(1, rows) }, () => true);

const normalizeRoom = (raw: any, index = 0): SchoolRoomLayout => {
  const columns: 3 | 4 = Number(raw?.deskColumns) === 3 ? 3 : 4;
  const rows = Math.max(1, Math.min(10, Number(raw?.deskRows) || 8));
  const desired = columns * rows;
  let activeDesks = Array.isArray(raw?.activeDesks) ? raw.activeDesks.map(Boolean) : [];

  // V74 ve daha eski 4-sütun stride kayıtlarını yeni gerçek grid yapısına dönüştür.
  if (activeDesks.length >= 28 && columns === 3 && activeDesks.length !== desired) {
    activeDesks = Array.from({ length: desired }, (_, i) => {
      const row = Math.floor(i / columns);
      const col = i % columns;
      return Boolean(raw.activeDesks[row * 4 + col]);
    });
  }
  if (activeDesks.length < desired) activeDesks = [...activeDesks, ...Array(desired - activeDesks.length).fill(true)];
  activeDesks = activeDesks.slice(0, desired);

  const elements = Array.isArray(raw?.elements) && raw.elements.length
    ? raw.elements
        .filter((item: any) => item && ["board", "teacher-desk", "door", "window"].includes(item.type))
        .map((item: any) => ({
          id: String(item.id || makeLayoutId(item.type)),
          type: item.type as RoomElementType,
          x: Math.max(0, Math.min(92, Number(item.x) || 0)),
          y: Math.max(0, Math.min(92, Number(item.y) || 0)),
        }))
    : defaultRoomElements();

  return {
    id: String(raw?.id || raw?.classroomId || makeLayoutId(`room-${index + 1}`)),
    classroomId: raw?.classroomId ? String(raw.classroomId) : undefined,
    name: String(raw?.name || raw?.className || raw?.classroomName || `Sınıf ${index + 1}`).trim(),
    capacity: Math.max(2, activeDesks.filter(Boolean).length * 2),
    deskColumns: columns,
    deskRows: rows,
    activeDesks,
    elements,
  };
};

const normalizeBuildings = (raw: any): SchoolBuildingLayout[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((building: any, buildingIndex: number) => {
    const rawFloors = Array.isArray(building?.floors) ? building.floors : [];
    const visibleFloors = Array.from({ length: 5 }, (_, floorIndex) => {
      const floor = rawFloors[floorIndex];
      return {
        id: String(floor?.id || makeLayoutId(`floor-${floorIndex + 1}`)),
        name: floorNameByIndex(floorIndex),
        rooms: (Array.isArray(floor?.rooms) ? floor.rooms : Array.isArray(floor?.classrooms) ? floor.classrooms : [])
          .map((room: any, roomIndex: number) => normalizeRoom(room, roomIndex)),
      };
    });
    const extraFloors = rawFloors.slice(5).map((floor: any, floorIndex: number) => ({
      id: String(floor?.id || makeLayoutId(`floor-${floorIndex + 6}`)),
      name: floorNameByIndex(floorIndex + 5),
      rooms: (Array.isArray(floor?.rooms) ? floor.rooms : Array.isArray(floor?.classrooms) ? floor.classrooms : [])
        .map((room: any, roomIndex: number) => normalizeRoom(room, roomIndex)),
    }));
    const floors = [...visibleFloors, ...extraFloors];
    return {
      id: String(building?.id || makeLayoutId(`building-${buildingIndex + 1}`)),
      name: String(building?.name || `Bina ${buildingIndex + 1}`).trim(),
      floors,
    };
  });
};

export function loadSchoolBuildingLayouts(): SchoolBuildingLayout[] {
  const keys = [SCHOOL_BUILDING_LAYOUT_KEY, ...LEGACY_KEYS];
  for (const key of keys) {
    try {
      const text = sqliteStorage.getItem(key);
      if (!text) continue;
      const parsed = normalizeBuildings(JSON.parse(text));
      if (!parsed.length) continue;
      if (key !== SCHOOL_BUILDING_LAYOUT_KEY) {
        sqliteStorage.setItem(SCHOOL_BUILDING_LAYOUT_KEY, JSON.stringify(parsed));
      }
      return parsed;
    } catch {
      // Bir sonraki uyumluluk anahtarını dene.
    }
  }
  return [];
}

export async function loadSchoolBuildingLayoutsFromDatabase(): Promise<SchoolBuildingLayout[]> {
  try {
    const rows = await fetchCollectionFromLocalDatabase(SCHOOL_BUILDING_LAYOUT_COLLECTION);
    const state = (rows || []).find((item: any) => String(item?.id || item?.__documentId || "") === SCHOOL_BUILDING_LAYOUT_DOCUMENT_ID) || rows?.[0];
    const raw = state?.buildings ?? state?.layouts ?? state?.value;
    const payload = typeof raw === "string" ? JSON.parse(raw) : raw;
    const normalized = normalizeBuildings(payload);
    if (normalized.length) {
      sqliteStorage.setItem(SCHOOL_BUILDING_LAYOUT_KEY, JSON.stringify(normalized));
      return normalized;
    }
  } catch (error) {
    console.warn("[Bina Bilgileri] SQLite kalıcı kayıt okunamadı; eski kayıt kontrol ediliyor.", error);
  }

  // Eski browser_storage kaydı varsa kaybetmeden yeni, doğrudan SQLite koleksiyonuna taşı.
  const legacy = loadSchoolBuildingLayouts();
  if (legacy.length) {
    try {
      await saveSchoolBuildingLayouts(legacy);
    } catch (error) {
      console.warn("[Bina Bilgileri] Eski kayıt veritabanına taşınamadı.", error);
    }
  }
  return legacy;
}

export function saveSchoolBuildingLayouts(buildings: SchoolBuildingLayout[]) {
  const normalized = normalizeBuildings(buildings);
  sqliteStorage.setItem(SCHOOL_BUILDING_LAYOUT_KEY, JSON.stringify(normalized));
  const payload = {
    id: SCHOOL_BUILDING_LAYOUT_DOCUMENT_ID,
    buildings: normalized,
    updatedAt: new Date().toISOString(),
  };
  const writeOperation = schoolBuildingPersistChain
    .catch(() => undefined)
    .then(() => upsertLocalDocument(SCHOOL_BUILDING_LAYOUT_COLLECTION, SCHOOL_BUILDING_LAYOUT_DOCUMENT_ID, payload));
  schoolBuildingPersistChain = writeOperation.catch((error) => {
    console.error("[Bina Bilgileri] SQLite kalıcı kayıt yazılamadı:", error);
    throw error;
  });
  try {
    window.dispatchEvent(new CustomEvent("enstitu-school-building-layout-changed", { detail: { key: SCHOOL_BUILDING_LAYOUT_KEY } }));
  } catch {}
  return writeOperation;
}

export async function flushSchoolBuildingLayoutWrites() {
  await schoolBuildingPersistChain.catch(() => undefined);
}

export function createBuilding(name = "Yeni Bina"): SchoolBuildingLayout {
  return {
    id: makeLayoutId("building"),
    name,
    floors: Array.from({ length: 5 }, (_, index) => ({
      id: makeLayoutId("floor"),
      name: floorNameByIndex(index),
      rooms: [],
    })),
  };
}

export function createFloor(name = "Zemin Kat"): SchoolFloorLayout {
  return { id: makeLayoutId("floor"), name, rooms: [] };
}

export function createRoom(name = "Sınıf", classroom?: Classroom): SchoolRoomLayout {
  const deskColumns: 3 | 4 = 4;
  const deskRows = 8;
  return {
    id: String(classroom?.id || makeLayoutId("room")),
    classroomId: classroom?.id ? String(classroom.id) : undefined,
    name: String(classroom?.name || name).trim(),
    capacity: deskColumns * deskRows * 2,
    deskColumns,
    deskRows,
    activeDesks: activeDeskDefaults(deskColumns, deskRows),
    elements: defaultRoomElements(),
  };
}

export function normalizeActiveDesks(room: Pick<SchoolRoomLayout, "deskColumns" | "deskRows" | "activeDesks">) {
  const count = room.deskColumns * room.deskRows;
  return Array.from({ length: count }, (_, index) => room.activeDesks?.[index] !== false);
}
