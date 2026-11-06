import type { Classroom, Course } from "../../types";
import { BaseService } from "../../core/services";
import { ClassroomRepository, classroomRepository } from "./ClassroomRepository";
import { assertValidClassroom, normalizeClassroomName } from "./classroomValidation";
import { CLASSROOM_EVENTS } from "./classroomEvents";

export type NewClassroomInput = {
  name: string;
  level: string;
  groups?: string[];
  group1Name?: string;
  group2Name?: string;
  capacity?: number;
  advisorTeacherId?: string;
  advisorTeacherName?: string;
  counselorTeacherId?: string;
  counselorTeacherName?: string;
  vicePrincipal?: string;
  groupStudentIds?: Classroom["groupStudentIds"];
  assignedCourses?: Classroom["assignedCourses"];
  [key: string]: unknown;
};

const normalizeId = (value: string | number) => String(value).trim().toLocaleLowerCase("tr-TR");

const normalizeGroup = (value: unknown) =>
  String(value || "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace("SOZ", "SÖZ")
    .replace("DIL", "DİL");

const classroomAreaSignature = (classroom: Pick<Classroom, "groups">): string => {
  const normalized = Array.from(
    new Set(
      (Array.isArray(classroom.groups) ? classroom.groups : [])
        .map(normalizeGroup)
        .filter((group) => ["SAY", "EA", "SÖZ", "DİL"].includes(group)),
    ),
  ).sort((a, b) => a.localeCompare(b, "tr-TR"));

  // Alan seçilmemiş sınıf GENEL kabul edilir.
  return normalized.length > 0 ? normalized.join("|") : "GENEL";
};

const sameClassIdentity = (
  left: Pick<Classroom, "name" | "groups">,
  right: Pick<Classroom, "name" | "groups">,
): boolean =>
  normalizeClassroomName(left.name) === normalizeClassroomName(right.name) &&
  classroomAreaSignature(left) === classroomAreaSignature(right);

export class ClassroomService extends BaseService<Classroom> {
  constructor(private readonly classrooms: ClassroomRepository = classroomRepository) {
    super(classrooms, "classroom");
  }

  private invalidate(): void {
    this.cache.invalidatePrefix("classroom:");
  }

  private async createUniqueId(): Promise<string> {
    const rows = await this.classrooms.findAll();
    const used = new Set(rows.map((row) => normalizeId(row.id)));
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const candidate = `CLS-${Date.now().toString(36).slice(-5).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
      if (!used.has(normalizeId(candidate))) return candidate;
    }
    throw new Error("Yeni sınıf kimliği üretilemedi. Lütfen tekrar deneyiniz.");
  }

  async prepareNewClassroom(input: NewClassroomInput): Promise<Classroom> {
    const classroom: Classroom = {
      ...input,
      id: await this.createUniqueId(),
      name: normalizeClassroomName(input.name),
    };
    assertValidClassroom(classroom);
    const rows = await this.classrooms.findAll();
    const duplicate = rows.find((row) => sameClassIdentity(row, classroom));
    if (duplicate) {
      throw new Error(
        `'${classroom.name}' sınıfı ${classroomAreaSignature(classroom)} alanıyla zaten kayıtlı. ` +
          "Aynı sınıf düzeyi ve şube adı ancak alan seçimi farklıysa tekrar tanımlanabilir.",
      );
    }
    return classroom;
  }

  async assertUpdateAllowed(previousId: string | number, classroom: Classroom): Promise<void> {
    assertValidClassroom(classroom);
    const previous = await this.classrooms.findById(previousId);
    if (!previous) throw new Error(`'${previousId}' kimlikli sınıf bulunamadı.`);
    const rows = await this.classrooms.findAll();
    const duplicate = rows.find(
      (row) =>
        normalizeId(row.id) !== normalizeId(previousId) &&
        sameClassIdentity(row, classroom),
    );
    if (duplicate) {
      throw new Error(
        `'${classroom.name}' sınıfı ${classroomAreaSignature(classroom)} alanıyla zaten kayıtlı. ` +
          "Aynı sınıf adı için alan seçimi farklı olmalıdır.",
      );
    }
  }

  async commitAcademicCatalog(
    classrooms: Classroom[],
    courses: Course[],
    customCreatedCourses: unknown[],
    event: "created" | "updated" | "deleted" | "catalogCommitted" = "catalogCommitted",
    payload?: unknown,
  ): Promise<void> {
    const identities = new Set<string>();
    for (const classroom of classrooms) {
      if (!String(classroom.id || "").trim()) throw new Error("Sınıf kimliği boş olamaz.");
      if (!String(classroom.name || "").trim()) throw new Error("Sınıf adı boş olamaz.");

      const normalizedName = normalizeClassroomName(classroom.name);
      const areaSignature = classroomAreaSignature(classroom);
      const identity = `${normalizedName}::${areaSignature}`;

      if (identities.has(identity)) {
        throw new Error(
          `'${normalizedName}' sınıfı ${areaSignature} alanıyla birden fazla kez kayıtlı. ` +
            "Aynı sınıf adı için alan seçenekleri farklı olmalıdır.",
        );
      }

      identities.add(identity);
    }
    await this.classrooms.commitAcademicCatalog({ classrooms, courses, customCreatedCourses });
    this.invalidate();
    await this.events.emit(CLASSROOM_EVENTS[event], payload ?? { classroomCount: classrooms.length, courseCount: courses.length });
  }

  async replaceAll(classrooms: Classroom[]): Promise<Classroom[]> {
    classrooms.forEach(assertValidClassroom);
    await this.classrooms.replaceAllAtomic(classrooms);
    this.invalidate();
    await this.events.emit(CLASSROOM_EVENTS.collectionReplaced, { count: classrooms.length });
    return classrooms;
  }
}

export const classroomService = new ClassroomService();
