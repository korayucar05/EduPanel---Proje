import type { Classroom, Course } from "../../types";
import { SqliteRepository } from "../../core/repository";
import { transactionManager, type TransactionManager } from "../../core/transactions";
import { normalizeClassroomName } from "./classroomValidation";

export interface AcademicCatalogCollections {
  classrooms: Classroom[];
  courses: Course[];
  customCreatedCourses: unknown[];
}

export class ClassroomRepository extends SqliteRepository<Classroom> {
  constructor(private readonly transactions: TransactionManager = transactionManager) {
    super("classrooms");
  }

  async findByName(name: string): Promise<Classroom | null> {
    const normalized = normalizeClassroomName(name);
    const rows = await this.findAll();
    return rows.find((row) => normalizeClassroomName(row.name) === normalized) ?? null;
  }

  async replaceAllAtomic(classrooms: Classroom[]): Promise<Classroom[]> {
    await this.transactions.run({ classrooms });
    return classrooms;
  }

  async commitAcademicCatalog(snapshot: AcademicCatalogCollections): Promise<void> {
    await this.transactions.run({
      classrooms: snapshot.classrooms,
      courses: snapshot.courses,
      customCreatedCourses: snapshot.customCreatedCourses,
    });
  }
}

export const classroomRepository = new ClassroomRepository();
