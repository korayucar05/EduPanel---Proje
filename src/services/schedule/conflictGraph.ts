import type { Classroom } from "../../types";
import { createCourseIdentity, coursesConflictInSameClass, getTeacherIdentityKeys } from "./scheduleIdentity";

export interface ConflictGraphNode { id: string; classId: string; course: any; degree: number; neighbors: Set<string>; }

const norm = (v: any) => String(v || "").trim().toLocaleUpperCase("tr-TR");
const teacherKeys = (c: any) => getTeacherIdentityKeys(c);

export function buildConflictGraph(classrooms: Classroom[]): Map<string, ConflictGraphNode> {
  const nodes = new Map<string, ConflictGraphNode>();
  for (const cls of classrooms as any[]) {
    (cls.assignedCourses || []).forEach((course: any, index: number) => {
      const id = `${createCourseIdentity(course, cls.id)}::${index}`;
      nodes.set(id, { id, classId: cls.id, course, degree: 0, neighbors: new Set() });
    });
  }
  const list = [...nodes.values()];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    const sameClass = a.classId === b.classId;
    const sharedTeacher = teacherKeys(a.course).some((t) => teacherKeys(b.course).includes(t));
    const sameClassConflict =
      sameClass && coursesConflictInSameClass(a.course, b.course);

    if (sameClassConflict || sharedTeacher) {
      a.neighbors.add(b.id); b.neighbors.add(a.id);
    }
  }
  for (const node of list) node.degree = node.neighbors.size;
  return nodes;
}
