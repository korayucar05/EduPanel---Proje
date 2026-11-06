import type { Classroom } from "../types";
import { getSyncStateSnapshot } from "../core/state/SyncStateStore";

export type SchoolBuildingClass = {
  id: string;
  name: string;
  capacity?: number;
  buildingId: string;
  buildingName: string;
  floorId: string;
  floorName: string;
  raw?: any;
};

export type SchoolBuildingFloor = {
  id: string;
  name: string;
  classrooms: SchoolBuildingClass[];
};

export type SchoolBuilding = {
  id: string;
  name: string;
  floors: SchoolBuildingFloor[];
};

export type SchoolBuildingCatalog = {
  buildings: SchoolBuilding[];
  classrooms: SchoolBuildingClass[];
  sourceKeys: string[];
  hasCentralBuildingData: boolean;
};

const normalize = (value: unknown) => String(value || "").trim().toLocaleUpperCase("tr-TR");
const slug = (value: unknown) => normalize(value).replace(/[^A-ZÇĞİÖŞÜ0-9]+/g, "-").replace(/^-+|-+$/g, "");
const firstText = (obj: any, keys: string[]) => {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
};
const firstNumber = (obj: any, keys: string[]) => {
  for (const key of keys) {
    const number = Number(obj?.[key]);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return undefined;
};
const asArray = (value: any): any[] => Array.isArray(value) ? value : value && typeof value === "object" ? Object.values(value) : [];
const parseJson = (value: string) => {
  try { return JSON.parse(value); } catch { return null; }
};

const BUILDING_KEYS = ["buildings", "binalar", "schoolBuildings", "school_buildings", "buildingList", "binaListesi", "blocks", "bloklar"];
const FLOOR_KEYS = ["floors", "katlar", "levels", "floorList", "katListesi"];
const CLASS_KEYS = ["classrooms", "classes", "siniflar", "sınıflar", "rooms", "derslikler", "roomList", "classList"];

function valueForKeys(obj: any, keys: string[]) {
  if (!obj || typeof obj !== "object") return undefined;
  for (const key of keys) if (obj[key] !== undefined) return obj[key];
  return undefined;
}

function looksLikeBuilding(node: any) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return false;
  // Kat nesnelerinin de "classrooms/siniflar" alanı olabileceği için yalnız
  // kat koleksiyonu taşıyan çıplak nesneleri bina kabul ediyoruz. Bina dizisi
  // altındaki doğrudan derslikli bina nesneleri zaten BUILDING_KEYS yoluyla eklenir.
  return FLOOR_KEYS.some((key) => node[key] !== undefined);
}

function parseClassroom(raw: any, building: { id: string; name: string }, floor: { id: string; name: string }, index: number): SchoolBuildingClass | null {
  if (typeof raw === "string") {
    const name = raw.trim();
    if (!name) return null;
    return { id: `${floor.id}-CLS-${slug(name) || index + 1}`, name, buildingId: building.id, buildingName: building.name, floorId: floor.id, floorName: floor.name, raw };
  }
  if (!raw || typeof raw !== "object") return null;
  const name = firstText(raw, ["name", "className", "classroomName", "sinifAdi", "sınıfAdı", "derslikAdi", "derslikAdı", "roomName", "label", "title", "code"]);
  if (!name) return null;
  const id = firstText(raw, ["classroomId", "classId", "sinifId", "sınıfId", "id", "roomId", "code"]) || `${floor.id}-CLS-${slug(name) || index + 1}`;
  const capacity = firstNumber(raw, ["capacity", "kontenjan", "studentCapacity", "ogrenciKapasitesi", "öğrenciKapasitesi"]);
  return { id, name, capacity, buildingId: building.id, buildingName: building.name, floorId: floor.id, floorName: floor.name, raw };
}

function parseFloor(raw: any, building: { id: string; name: string }, index: number): SchoolBuildingFloor | null {
  if (!raw || typeof raw !== "object") return null;
  const name = firstText(raw, ["name", "floorName", "katAdi", "katAdı", "levelName", "label", "title", "code"]) || `${index + 1}. Kat`;
  const id = firstText(raw, ["id", "floorId", "katId", "levelId", "code"]) || `${building.id}-FLR-${slug(name) || index + 1}`;
  const classesRaw = valueForKeys(raw, CLASS_KEYS);
  const classrooms = asArray(classesRaw).map((room, roomIndex) => parseClassroom(room, building, { id, name }, roomIndex)).filter(Boolean) as SchoolBuildingClass[];
  return { id, name, classrooms };
}

function parseBuilding(raw: any, index: number): SchoolBuilding | null {
  if (!raw || typeof raw !== "object") return null;
  const name = firstText(raw, ["name", "buildingName", "binaAdi", "binaAdı", "blockName", "blokAdi", "blokAdı", "label", "title", "code"]) || `${index + 1}. Bina`;
  const id = firstText(raw, ["id", "buildingId", "binaId", "blockId", "blokId", "code"]) || `BLD-${slug(name) || index + 1}`;
  const floorsRaw = valueForKeys(raw, FLOOR_KEYS);
  let floors = asArray(floorsRaw).map((floor, floorIndex) => parseFloor(floor, { id, name }, floorIndex)).filter(Boolean) as SchoolBuildingFloor[];

  // Bazı sürümlerde derslikler doğrudan bina altında tutuluyor.
  if (!floors.length) {
    const directClasses = asArray(valueForKeys(raw, CLASS_KEYS));
    if (directClasses.length) {
      const floor = { id: `${id}-FLR-GENEL`, name: "Genel" };
      floors = [{ ...floor, classrooms: directClasses.map((room, roomIndex) => parseClassroom(room, { id, name }, floor, roomIndex)).filter(Boolean) as SchoolBuildingClass[] }];
    }
  }
  return { id, name, floors };
}

function collectBuildingNodes(root: any, depth = 0, result: any[] = [], visited = new Set<any>()) {
  if (depth > 6 || root === null || root === undefined || typeof root !== "object" || visited.has(root)) return result;
  visited.add(root);
  if (Array.isArray(root)) {
    root.forEach((item) => collectBuildingNodes(item, depth + 1, result, visited));
    return result;
  }
  for (const key of BUILDING_KEYS) {
    if (root[key] !== undefined) asArray(root[key]).forEach((item) => result.push(item));
  }
  if (looksLikeBuilding(root) && !result.includes(root)) result.push(root);
  Object.values(root).forEach((value) => collectBuildingNodes(value, depth + 1, result, visited));
  return result;
}

function parseFlatLocationRows(root: any): SchoolBuildingClass[] {
  const rows = Array.isArray(root) ? root : root && typeof root === "object" ? Object.values(root) : [];
  const result: SchoolBuildingClass[] = [];
  rows.forEach((raw: any, index) => {
    if (!raw || typeof raw !== "object") return;
    const className = firstText(raw, ["className", "classroomName", "sinifAdi", "sınıfAdı", "derslikAdi", "roomName"]);
    const buildingName = firstText(raw, ["buildingName", "binaAdi", "binaAdı", "blockName", "blokAdi", "blokAdı"]);
    const floorName = firstText(raw, ["floorName", "katAdi", "katAdı", "levelName"]);
    if (!className || (!buildingName && !floorName)) return;
    const buildingId = firstText(raw, ["buildingId", "binaId", "blockId", "blokId"]) || `BLD-${slug(buildingName || "BINA")}`;
    const floorId = firstText(raw, ["floorId", "katId", "levelId"]) || `${buildingId}-FLR-${slug(floorName || "GENEL")}`;
    result.push({
      id: firstText(raw, ["classId", "classroomId", "sinifId", "sınıfId", "roomId", "id"]) || `${floorId}-CLS-${slug(className) || index + 1}`,
      name: className,
      capacity: firstNumber(raw, ["capacity", "kontenjan", "studentCapacity"]),
      buildingId,
      buildingName: buildingName || "Bina",
      floorId,
      floorName: floorName || "Genel",
      raw,
    });
  });
  return result;
}

export function readSchoolBuildingCatalog(classroomRecords: Classroom[] = []): SchoolBuildingCatalog {
  const snapshot = getSyncStateSnapshot();
  const sourceKeys: string[] = [];
  const roots: any[] = [];

  // V2 merkezi Bina Bilgileri kaydı varsa tek fiziksel kaynak odur.
  // Eski Sınav Yerleşim Planı kayıtlarını bununla karıştırmak, silinen/eski
  // sınıfların yeniden görünmesine neden olur.
  const primary = snapshot.find(({ key }) => String(key || "").toLocaleLowerCase("tr-TR") === "school_building_layouts_v2");
  if (primary) {
    const parsed = parseJson(primary.value);
    if (parsed !== null) {
      roots.push(parsed);
      sourceKeys.push(primary.key);
    }
  } else {
    snapshot.forEach(({ key, value }) => {
      const normalizedKey = String(key || "").toLocaleLowerCase("tr-TR");
      const isCandidate = /bina|building|campus|physical|yerleş|yerles|floor|katlar/.test(normalizedKey) || ["school_info", "school_info_a_profile"].includes(normalizedKey);
      if (!isCandidate) return;
      const parsed = parseJson(value);
      if (parsed === null) return;
      roots.push(parsed);
      sourceKeys.push(key);
    });
  }

  const buildings: SchoolBuilding[] = [];
  const flatLocations: SchoolBuildingClass[] = [];
  roots.forEach((root) => {
    collectBuildingNodes(root).forEach((node, index) => {
      const parsed = parseBuilding(node, index);
      if (parsed && parsed.floors.some((floor) => floor.classrooms.length)) buildings.push(parsed);
    });
    flatLocations.push(...parseFlatLocationRows(root));
  });

  // Aynı bina farklı kaynak anahtarlarından gelmişse birleştir.
  const buildingMap = new Map<string, SchoolBuilding>();
  buildings.forEach((building) => {
    const key = normalize(building.id || building.name);
    const existing = buildingMap.get(key);
    if (!existing) {
      buildingMap.set(key, { ...building, floors: building.floors.map((floor) => ({ ...floor, classrooms: [...floor.classrooms] })) });
      return;
    }
    building.floors.forEach((floor) => {
      let targetFloor = existing.floors.find((item) => normalize(item.id || item.name) === normalize(floor.id || floor.name));
      if (!targetFloor) {
        targetFloor = { ...floor, classrooms: [] };
        existing.floors.push(targetFloor);
      }
      floor.classrooms.forEach((room) => {
        if (!targetFloor!.classrooms.some((item) => normalize(item.id) === normalize(room.id) || normalize(item.name) === normalize(room.name))) targetFloor!.classrooms.push(room);
      });
    });
  });

  flatLocations.forEach((room) => {
    const buildingKey = normalize(room.buildingId || room.buildingName);
    let building = buildingMap.get(buildingKey);
    if (!building) {
      building = { id: room.buildingId, name: room.buildingName, floors: [] };
      buildingMap.set(buildingKey, building);
    }
    let floor = building.floors.find((item) => normalize(item.id || item.name) === normalize(room.floorId || room.floorName));
    if (!floor) {
      floor = { id: room.floorId, name: room.floorName, classrooms: [] };
      building.floors.push(floor);
    }
    if (!floor.classrooms.some((item) => normalize(item.id) === normalize(room.id) || normalize(item.name) === normalize(room.name))) floor.classrooms.push(room);
  });

  const centralBuildings = [...buildingMap.values()].filter((building) => building.floors.some((floor) => floor.classrooms.length));
  let classrooms = centralBuildings.flatMap((building) => building.floors.flatMap((floor) => floor.classrooms));
  const hasCentralBuildingData = classrooms.length > 0;

  // Merkezi Bina Bilgileri henüz boşsa mevcut sınıf kayıtlarını salt-okunur yedek kaynak olarak kullan.
  if (!classrooms.length) {
    classrooms = classroomRecords.map((classroom: any, index) => {
      const buildingName = firstText(classroom, ["buildingName", "building", "binaAdi", "bina", "blockName", "block", "blokAdi", "blok"]) || "Okul Binası";
      const floorName = firstText(classroom, ["floorName", "floor", "katAdi", "kat", "levelName"]) || "Kat bilgisi yok";
      const buildingId = firstText(classroom, ["buildingId", "binaId", "blockId", "blokId"]) || `BLD-${slug(buildingName)}`;
      const floorId = firstText(classroom, ["floorId", "katId", "levelId"]) || `${buildingId}-FLR-${slug(floorName)}`;
      return {
        id: String(classroom.id || `${floorId}-CLS-${index + 1}`),
        name: String(classroom.name || "").trim(),
        capacity: Number(classroom.capacity) || undefined,
        buildingId,
        buildingName,
        floorId,
        floorName,
        raw: classroom,
      };
    }).filter((room) => room.name);
  }

  const deduped = new Map<string, SchoolBuildingClass>();
  classrooms.forEach((room) => {
    const key = normalize(room.id || room.name);
    if (!deduped.has(key)) deduped.set(key, room);
  });

  return {
    buildings: centralBuildings,
    classrooms: [...deduped.values()],
    sourceKeys: [...new Set(sourceKeys)],
    hasCentralBuildingData,
  };
}

export function findSchoolLocationForClass(catalog: SchoolBuildingCatalog, classroomNameOrId: unknown) {
  const target = normalize(classroomNameOrId);
  return catalog.classrooms.find((room) => normalize(room.id) === target || normalize(room.name) === target) || null;
}
