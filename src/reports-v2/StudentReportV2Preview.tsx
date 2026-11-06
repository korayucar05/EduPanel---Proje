import React from "react";
import { StudentReportV2 } from "./components/StudentReportV2";
import { sampleStudentReport } from "./mock/sampleStudentReport";

export default function StudentReportV2Preview() {
  return (
    <div className="min-h-screen overflow-auto bg-slate-200 p-8">
      <StudentReportV2 report={sampleStudentReport} />
    </div>
  );
}
