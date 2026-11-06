import type { Classroom, Course } from "../../types";
import { BaseService } from "../../core/services";
import { CourseRepository, courseRepository, type CourseAcademicCatalog } from "./CourseRepository";
import { assertValidCourse, normalizeCourseIdentity, normalizeCourseName } from "./courseValidation";
import { COURSE_EVENTS } from "./courseEvents";

export type CourseCatalogEvent = keyof Pick<typeof COURSE_EVENTS, "created" | "updated" | "deleted" | "teacherAssigned" | "catalogCommitted">;

const normalizeId = (value: string | number) => String(value).trim().toLocaleLowerCase("tr-TR");

export class CourseService extends BaseService<Course> {
  constructor(private readonly courses: CourseRepository = courseRepository) {
    super(courses, "course");
  }

  private invalidate(): void {
    this.cache.invalidatePrefix("course:");
    this.cache.invalidatePrefix("classroom:");
  }

  private validateCatalog(classrooms: Classroom[], courses: Course[]): void {
    const classroomNames = new Set(
      classrooms.map((classroom) => String(classroom.name || "").trim().toLocaleUpperCase("tr-TR")).filter(Boolean),
    );
    const ids = new Set<string>();
    for (const course of courses) {
      // Legacy kayıtlarda bazı isteğe bağlı alanlar boş olabilir; temel ders kimliği korunur.
      const normalized: Course = {
        ...course,
        name: normalizeCourseName(course.name),
        classroom: String(course.classroom || "").trim(),
        teacherId: String(course.teacherId || ""),
        teacherName: String(course.teacherName || (course.teacherId ? "Belirtilmedi" : "Öğretmen Atanmadı")),
        schedule: String(course.schedule || ""),
        code: String(course.code || ""),
        studentCount: Number(course.studentCount || 0),
      };
      assertValidCourse(normalized);
      const id = normalizeId(normalized.id);
      if (ids.has(id)) throw new Error(`'${normalized.id}' ders kimliği birden fazla kez kayıtlı.`);
      ids.add(id);
      if (classroomNames.size > 0 && !classroomNames.has(normalized.classroom.toLocaleUpperCase("tr-TR"))) {
        throw new Error(`'${normalized.name}' dersi var olmayan '${normalized.classroom}' sınıfına bağlı.`);
      }
    }
  }

  async commitAcademicCatalog(
    snapshot: CourseAcademicCatalog,
    event: CourseCatalogEvent = "catalogCommitted",
    payload?: unknown,
  ): Promise<void> {
    if (!Array.isArray(snapshot.classrooms) || !Array.isArray(snapshot.courses) || !Array.isArray(snapshot.customCreatedCourses)) {
      throw new Error("Akademik katalog snapshot'ı geçersiz.");
    }
    this.validateCatalog(snapshot.classrooms, snapshot.courses);
    await this.courses.commitAcademicCatalog(snapshot);
    this.invalidate();
    await this.events.emit(COURSE_EVENTS[event], payload ?? {
      classroomCount: snapshot.classrooms.length,
      courseCount: snapshot.courses.length,
      customCourseCount: snapshot.customCreatedCourses.length,
    });
  }

  async replaceAll(courses: Course[]): Promise<Course[]> {
    courses.forEach(assertValidCourse);
    await this.courses.replaceAllAtomic(courses);
    this.invalidate();
    await this.events.emit(COURSE_EVENTS.collectionReplaced, { count: courses.length });
    return courses;
  }

  async findByClassroomAndName(classroom: string, name: string): Promise<Course[]> {
    const key = `course:classroom:${String(classroom).trim()}:${normalizeCourseIdentity(name)}`;
    const cached = this.cache.get<Course[]>(key);
    if (cached) return cached;
    const rows = await this.courses.findByClassroomAndName(classroom, name);
    return this.cache.set(key, rows, 30_000);
  }
}

export const courseService = new CourseService();
