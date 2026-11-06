import type { Student } from "../../types";
import { BaseService } from "../../core/services";
import { assertValidStudent } from "./studentValidation";
import { STUDENT_EVENTS } from "./studentEvents";
import { StudentRepository, studentRepository } from "./StudentRepository";

const normalizeId = (id: string | number) => String(id).trim().toLocaleLowerCase("tr-TR");

export class StudentService extends BaseService<Student> {
  constructor(private readonly students: StudentRepository = studentRepository) {
    super(students, "student");
  }

  private invalidate(): void {
    this.cache.invalidatePrefix("student:");
  }

  async search(query: string): Promise<Student[]> {
    const normalized = query.trim();
    if (!normalized) return [];
    return this.students.search(normalized);
  }

  async create(student: Student): Promise<Student> {
    assertValidStudent(student);
    const existing = await this.students.findByStudentNumber(String(student.id));
    if (existing) throw new Error(`'${student.id}' numaralı öğrenci zaten kayıtlı.`);
    const saved = await this.students.save(student);
    this.invalidate();
    await this.events.emit(STUDENT_EVENTS.created, saved);
    return saved;
  }

  async update(previousId: string | number, student: Student): Promise<Student> {
    assertValidStudent(student);
    const previous = await this.students.findById(previousId);
    if (!previous) throw new Error(`'${previousId}' numaralı öğrenci bulunamadı.`);

    if (normalizeId(previousId) !== normalizeId(student.id)) {
      const duplicate = await this.students.findByStudentNumber(String(student.id));
      if (duplicate) throw new Error(`'${student.id}' numaralı öğrenci zaten kayıtlı.`);
    }

    const saved = await this.students.replaceStudent(previousId, student);
    this.invalidate();
    await this.events.emit(STUDENT_EVENTS.updated, { previousId, student: saved });
    return saved;
  }

  async removeStudent(id: string | number): Promise<void> {
    const existing = await this.students.findById(id);
    if (!existing) return;
    await this.students.delete(id);
    this.invalidate();
    await this.events.emit(STUDENT_EVENTS.deleted, existing);
  }

  async removeMany(ids: Array<string | number>): Promise<Student[]> {
    if (ids.length === 0) return this.list();
    const remaining = await this.students.deleteMany(ids);
    this.invalidate();
    await this.events.emit(STUDENT_EVENTS.bulkDeleted, { ids: ids.map(String), remainingCount: remaining.length });
    return remaining;
  }

  async importMany(newStudents: Student[]): Promise<Student[]> {
    newStudents.forEach(assertValidStudent);
    const current = await this.students.findAll();
    const currentIds = new Set(current.map((student) => normalizeId(student.id)));
    const incomingIds = new Set<string>();

    for (const student of newStudents) {
      const id = normalizeId(student.id);
      if (currentIds.has(id) || incomingIds.has(id)) {
        throw new Error(`'${student.id}' numaralı öğrenci mükerrer.`);
      }
      incomingIds.add(id);
    }

    const next = [...newStudents, ...current];
    await this.students.replaceAllAtomic(next);
    this.invalidate();
    await this.events.emit(STUDENT_EVENTS.imported, { count: newStudents.length });
    return next;
  }

  async replaceAll(students: Student[], reason: "group" | "photos" | "sync" = "sync"): Promise<Student[]> {
    students.forEach(assertValidStudent);
    await this.students.replaceAllAtomic(students);
    this.invalidate();
    const event = reason === "group"
      ? STUDENT_EVENTS.groupChanged
      : reason === "photos"
        ? STUDENT_EVENTS.photosUpdated
        : STUDENT_EVENTS.collectionReplaced;
    await this.events.emit(event, { count: students.length });
    return students;
  }
}

export const studentService = new StudentService();
