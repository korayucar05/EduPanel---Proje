import type { Classroom } from "../types";

const gradeFrom = (value: unknown) => {
  const match = String(value || "").match(/(?:^|\D)(\d{1,2})(?:\D|$)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
};

export const compareClassroomNames = (left: unknown, right: unknown) => {
  const leftName = String(left || "").trim();
  const rightName = String(right || "").trim();
  const gradeDifference = gradeFrom(leftName) - gradeFrom(rightName);
  if (gradeDifference) return gradeDifference;
  return leftName.localeCompare(rightName, "tr", { numeric: true, sensitivity: "base" });
};

export const compareClassrooms = (left: Classroom, right: Classroom) => {
  const leftGrade = gradeFrom(left.level || left.name);
  const rightGrade = gradeFrom(right.level || right.name);
  if (leftGrade !== rightGrade) return leftGrade - rightGrade;
  return compareClassroomNames(left.name, right.name);
};

export const sortClassrooms = (classrooms: Classroom[]) => [...classrooms].sort(compareClassrooms);

