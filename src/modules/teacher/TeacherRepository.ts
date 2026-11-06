import type { Teacher } from "../../types";
import { SqliteRepository } from "../../core/repository";
import { transactionManager, type TransactionManager } from "../../core/transactions";

const normalize = (value: string | number) => String(value).trim().toLocaleLowerCase("tr-TR");

export class TeacherRepository extends SqliteRepository<Teacher> {
  constructor(private readonly transactions: TransactionManager = transactionManager) {
    super("teachers");
  }

  async findByIdentity(id: string | number): Promise<Teacher | null> {
    const normalized = normalize(id);
    const teachers = await this.findAll();
    return teachers.find((teacher) => normalize(teacher.id) === normalized) ?? null;
  }

  async replaceAllAtomic(teachers: Teacher[]): Promise<Teacher[]> {
    await this.transactions.run({ teachers });
    return teachers;
  }

  async replaceTeacher(previousId: string | number, teacher: Teacher): Promise<Teacher> {
    const teachers = await this.findAll();
    const index = teachers.findIndex((row) => String(row.id) === String(previousId));
    if (index < 0) throw new Error(`'${previousId}' kimlikli öğretmen bulunamadı.`);

    const duplicate = teachers.some((row, rowIndex) =>
      rowIndex !== index && normalize(row.id) === normalize(teacher.id));
    if (duplicate) throw new Error(`'${teacher.id}' kimlikli öğretmen zaten kayıtlı.`);

    const next = teachers.slice();
    next[index] = teacher;
    await this.replaceAllAtomic(next);
    return teacher;
  }

  async deleteMany(ids: Array<string | number>): Promise<Teacher[]> {
    const idSet = new Set(ids.map(String));
    const next = (await this.findAll()).filter((teacher) => !idSet.has(String(teacher.id)));
    return this.replaceAllAtomic(next);
  }
}

export const teacherRepository = new TeacherRepository();
