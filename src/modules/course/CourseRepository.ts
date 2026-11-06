import type { Classroom, Course } from "../../types";
import { SqliteRepository } from "../../core/repository";
import { transactionManager, type TransactionManager } from "../../core/transactions";
import { normalizeCourseIdentity } from "./courseValidation";

export interface CourseAcademicCatalog {
  classrooms: Classroom[];
  courses: Course[];
  customCreatedCourses: unknown[];
}

export class CourseRepository extends SqliteRepository<Course> {
  constructor(private readonly transactions: TransactionManager = transactionManager) {
    super("courses");
  }

  async findByClassroom(classroom: string): Promise<Course[]> {
    const normalized = String(classroom || "").trim().toLocaleUpperCase("tr-TR");
    return (await this.findAll()).filter(
      (course) => String(course.classroom || "").trim().toLocaleUpperCase("tr-TR") === normalized,
    );
  }

  async findByClassroomAndName(classroom: string, name: string): Promise<Course[]> {
    const identity = normalizeCourseIdentity(name);
    return (await this.findByClassroom(classroom)).filter(
      (course) => normalizeCourseIdentity(course.name) === identity,
    );
  }

  async replaceAllAtomic(courses: Course[]): Promise<Course[]> {
    await this.transactions.run({ courses });
    return courses;
  }

  async commitAcademicCatalog(snapshot: CourseAcademicCatalog): Promise<void> {
    await this.transactions.run({
      classrooms: snapshot.classrooms,
      courses: snapshot.courses,
      customCreatedCourses: snapshot.customCreatedCourses,
    });
  }
}

export const courseRepository = new CourseRepository();
