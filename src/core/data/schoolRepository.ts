import type { Announcement, Classroom, Course, Student, Teacher } from "../../types";
import { fetchAcademicCatalogFromLocalDatabase, fetchCollectionFromLocalDatabase } from "../../lib/localDatabase";
import { hasatDataStore } from "./hasatDataStore";
import { recordDataOperation } from "./dataDiagnostics";

export interface SchoolCoreSnapshot {
  students: Student[];
  teachers: Teacher[];
  classrooms: Classroom[];
  courses: Course[];
  customCreatedCourses: any[];
  announcements: Announcement[];
  sources: Record<string, string>;
}

const readCollectionOrCache = async <T>(collection: string, cacheKey: string): Promise<{ value: T[]; source: string }> => {
  const startedAt = performance.now();
  try {
    const rows = await fetchCollectionFromLocalDatabase(collection);
    if (Array.isArray(rows) && rows.length > 0) {
      recordDataOperation({ operation: "read", key: collection, source: "sqlite", success: true, durationMs: performance.now() - startedAt });
      return { value: rows as T[], source: "sqlite" };
    }
  } catch (error) {
    recordDataOperation({ operation: "read", key: collection, source: "sqlite", success: false, durationMs: performance.now() - startedAt, message: error instanceof Error ? error.message : String(error) });
  }
  const cached = await hasatDataStore.readArray<T>(cacheKey);
  return { value: cached.value, source: cached.source };
};

export async function loadSchoolCoreSnapshot(): Promise<SchoolCoreSnapshot> {
  const [studentsResult, teachersResult, announcementsResult] = await Promise.all([
    readCollectionOrCache<Student>("students", "school_students"),
    readCollectionOrCache<Teacher>("teachers", "school_teachers"),
    readCollectionOrCache<Announcement>("announcements", "school_announcements"),
  ]);

  let classrooms: Classroom[] = [];
  let courses: Course[] = [];
  let customCreatedCourses: any[] = [];
  let catalogSource = "sqlite";
  try {
    const catalog = await fetchAcademicCatalogFromLocalDatabase();
    classrooms = Array.isArray(catalog.classrooms) ? catalog.classrooms : [];
    courses = Array.isArray(catalog.courses) ? catalog.courses : [];
    customCreatedCourses = Array.isArray(catalog.customCreatedCourses) ? catalog.customCreatedCourses : [];
  } catch {
    catalogSource = "cache";
    const [classroomCache, courseCache, customCache] = await Promise.all([
      hasatDataStore.readArray<Classroom>("school_classrooms"),
      hasatDataStore.readArray<Course>("school_courses"),
      hasatDataStore.readArray<any>("custom_created_courses"),
    ]);
    classrooms = classroomCache.value;
    courses = courseCache.value;
    customCreatedCourses = customCache.value;
  }

  return {
    students: studentsResult.value,
    teachers: teachersResult.value,
    classrooms,
    courses,
    customCreatedCourses,
    announcements: announcementsResult.value,
    sources: {
      students: studentsResult.source,
      teachers: teachersResult.source,
      announcements: announcementsResult.source,
      academicCatalog: catalogSource,
    },
  };
}
