import type { Teacher } from "../../types";
import { BaseService } from "../../core/services";
import { assertValidTeacher } from "./teacherValidation";
import { TEACHER_EVENTS } from "./teacherEvents";
import { TeacherRepository, teacherRepository } from "./TeacherRepository";

const normalizeId = (id: string | number) => String(id).trim().toLocaleLowerCase("tr-TR");

export type NewTeacherInput = {
  name: string;
  branch: string;
  email?: string;
  phone: string;
  weeklyHours: number;
  assignedClassrooms: string[];
  status: Teacher["status"];
  avatar: string;
  adminRole?: string;
  commissions?: string[];
  leaveReason?: string;
  leaveDates?: string[];
  [key: string]: unknown;
};

export class TeacherService extends BaseService<Teacher> {
  constructor(private readonly teachers: TeacherRepository = teacherRepository) {
    super(teachers, "teacher");
  }

  private invalidate(): void {
    this.cache.invalidatePrefix("teacher:");
  }

  private async createUniqueId(): Promise<string> {
    const rows = await this.teachers.findAll();
    const used = new Set(rows.map((teacher) => normalizeId(teacher.id)));
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const suffix = `${Date.now().toString(36).slice(-5)}-${Math.floor(1000 + Math.random() * 9000)}`.toUpperCase();
      const candidate = `OGRT-${suffix}`;
      if (!used.has(normalizeId(candidate))) return candidate;
    }
    throw new Error("Yeni öğretmen kimliği üretilemedi. Lütfen tekrar deneyiniz.");
  }

  async createTeacher(input: NewTeacherInput): Promise<Teacher> {
    const teacher: Teacher = { ...input, id: await this.createUniqueId() } as Teacher;
    assertValidTeacher(teacher);
    const saved = await this.teachers.save(teacher);
    this.invalidate();
    await this.events.emit(TEACHER_EVENTS.created, saved);
    return saved;
  }

  async updateTeacher(previousId: string | number, teacher: Teacher): Promise<Teacher> {
    assertValidTeacher(teacher);
    const previous = await this.teachers.findById(previousId);
    if (!previous) throw new Error(`'${previousId}' kimlikli öğretmen bulunamadı.`);

    if (normalizeId(previousId) !== normalizeId(teacher.id)) {
      const duplicate = await this.teachers.findByIdentity(teacher.id);
      if (duplicate) throw new Error(`'${teacher.id}' kimlikli öğretmen zaten kayıtlı.`);
    }

    const saved = await this.teachers.replaceTeacher(previousId, teacher);
    this.invalidate();
    await this.events.emit(TEACHER_EVENTS.updated, { previousId, teacher: saved });
    return saved;
  }

  async removeTeacher(id: string | number): Promise<void> {
    const existing = await this.teachers.findById(id);
    if (!existing) return;
    await this.teachers.delete(id);
    this.invalidate();
    await this.events.emit(TEACHER_EVENTS.deleted, existing);
  }

  async removeMany(ids: Array<string | number>): Promise<Teacher[]> {
    if (ids.length === 0) return this.list();
    const remaining = await this.teachers.deleteMany(ids);
    this.invalidate();
    await this.events.emit(TEACHER_EVENTS.bulkDeleted, { ids: ids.map(String), remainingCount: remaining.length });
    return remaining;
  }

  async replaceAll(teachers: Teacher[]): Promise<Teacher[]> {
    teachers.forEach(assertValidTeacher);
    await this.teachers.replaceAllAtomic(teachers);
    this.invalidate();
    await this.events.emit(TEACHER_EVENTS.collectionReplaced, { count: teachers.length });
    return teachers;
  }
}

export const teacherService = new TeacherService();
