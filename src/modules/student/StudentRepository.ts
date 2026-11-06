import type { Student } from "../../types";
import { SqliteRepository } from "../../core/repository";
import { transactionManager, type TransactionManager } from "../../core/transactions";
import { searchStudentRecords } from "../../lib/localDatabase";

export class StudentRepository extends SqliteRepository<Student> {
  constructor(private readonly transactions: TransactionManager = transactionManager) {
    super("students");
  }

  async search(query: string): Promise<Student[]> {
    const result = await searchStudentRecords(query);
    return Array.isArray(result.records) ? result.records as Student[] : [];
  }

  async findByStudentNumber(studentNumber: string): Promise<Student | null> {
    const normalized = String(studentNumber).trim().toLocaleLowerCase("tr-TR");
    const students = await this.findAll();
    return students.find((student) => String(student.id).trim().toLocaleLowerCase("tr-TR") === normalized) ?? null;
  }

  async replaceAllAtomic(students: Student[]): Promise<Student[]> {
    await this.transactions.run({ students });
    return students;
  }

  async deleteMany(ids: Array<string | number>): Promise<Student[]> {
    const idSet = new Set(ids.map((id) => String(id)));
    const students = (await this.findAll()).filter((student) => !idSet.has(String(student.id)));
    return this.replaceAllAtomic(students);
  }

  async replaceStudent(previousId: string | number, student: Student): Promise<Student> {
    const previousIdText = String(previousId);
    const students = await this.findAll();
    const index = students.findIndex((row) => String(row.id) === previousIdText);
    if (index < 0) throw new Error(`'${previousId}' numaralı öğrenci bulunamadı.`);

    const duplicate = students.some((row, rowIndex) =>
      rowIndex !== index &&
      String(row.id).trim().toLocaleLowerCase("tr-TR") === String(student.id).trim().toLocaleLowerCase("tr-TR"));
    if (duplicate) throw new Error(`'${student.id}' numaralı öğrenci zaten kayıtlı.`);

    const next = students.slice();
    next[index] = student;
    await this.replaceAllAtomic(next);
    return student;
  }
}

export const studentRepository = new StudentRepository();
