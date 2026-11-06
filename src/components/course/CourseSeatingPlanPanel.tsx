import React from "react";
import type { Classroom, Student, Teacher } from "../../types";
import ClassSeatingPlanModule from "../ClassSeatingPlanModule";

interface CourseSeatingPlanPanelProps {
  classError: string;
  classForm: any;
  setClassForm: React.Dispatch<React.SetStateAction<any>>;
  editingClassId: string | null;
  classrooms: Classroom[];
  teachers: Teacher[];
  students: Student[];
  getBranchLetter: (...args: any[]) => any;
  handleLevelChangeInModal: (...args: any[]) => any;
  handleBranchNameChange: (...args: any[]) => any;
  handleAddClass: (...args: any[]) => any;
  handleDeleteClass: (...args: any[]) => any;
  openEditClassModal: (classroom: Classroom) => void;
  seatingPlanClassName: string;
}

export default function CourseSeatingPlanPanel({
  classrooms,
  students,
  editingClassId,
  seatingPlanClassName,
}: CourseSeatingPlanPanelProps) {
  const activeClassName = seatingPlanClassName || classrooms.find((classroom) => classroom.id === editingClassId)?.name || classrooms[0]?.name || "";

  return (
    <ClassSeatingPlanModule
      students={students}
      classrooms={classrooms}
      initialClassName={activeClassName}
    />
  );
}
