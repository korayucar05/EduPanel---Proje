import React, { lazy, Suspense } from "react";
import type { CourseModuleProps } from "./CourseModule";

const CourseModule = lazy(() => import("./CourseModule"));

export default function ClassesModule(props: CourseModuleProps) {
  return (
    <Suspense fallback={<div className="flex min-h-[260px] items-center justify-center text-sm font-semibold text-slate-600">Sınıf krokisi yükleniyor…</div>}>
      <CourseModule {...props} displayMode="classes" />
    </Suspense>
  );
}
