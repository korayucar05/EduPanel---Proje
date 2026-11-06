import React from "react";
import { Mic, MicOff, X } from "lucide-react";
import type { Classroom, Course, Teacher } from "../../types";
import { courseService } from "../../modules/course";
import { isSameCourseName } from "./courseCatalog";

export default function TeacherAssignmentModal(props: any) {
  const {
    teacherAssignmentModal, setTeacherAssignmentModal, stopSpeechRecognition, setTempTeacherToAssign,
    setTempTeacherToAssign2, setVoiceFeedback, tempTeacherToAssign, tempTeacherToAssign2, teachers,
    isTeacherEligibleForCourse, isListening, voiceTeacherSlot, startSpeechRecognition, voiceFeedback,
    classCourses, setClassCourses, editingClassId, classrooms, setClassrooms, courses, setCourses,
    customCreatedCourses, triggerNotification,
  } = props;
  return (
<>
{teacherAssignmentModal.isOpen && teacherAssignmentModal.courseIndex !== null && (
  <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
    <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-indigo-500">Öğretmen Seçimi</div>
          <h3 className="mt-1 text-lg font-black text-slate-900">{teacherAssignmentModal.courseName}</h3>
        </div>
        <button
          type="button"
          onClick={() => {
            stopSpeechRecognition();
            setTeacherAssignmentModal({ isOpen: false, courseIndex: null, courseName: "" });
            setTempTeacherToAssign("");
            setTempTeacherToAssign2("");
            setVoiceFeedback("");
          }}
          className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-black text-slate-600">1. Öğretmen</label>
          <div className="flex gap-2">
            <select
              value={tempTeacherToAssign}
              onChange={(e) => setTempTeacherToAssign(e.target.value)}
              className="h-12 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            >
              <option value="">Öğretmen Seçiniz</option>
              {[...teachers]
                .filter((teacher) =>
                  isTeacherEligibleForCourse(teacher, teacherAssignmentModal.courseName),
                )
                .sort(
                  (a, b) =>
                    (a.branch || "").localeCompare(b.branch || "", "tr-TR") ||
                    (a.name || "").localeCompare(b.name || "", "tr-TR"),
                )
                .map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name} — {teacher.branch}
                  </option>
                ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const index = teacherAssignmentModal.courseIndex;
                if (index === null) return;
                if (isListening && voiceTeacherSlot === 1) {
                  stopSpeechRecognition("1. öğretmen dinlemesi durduruldu.");
                } else {
                  startSpeechRecognition(index, 1);
                }
              }}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-all ${
                isListening && voiceTeacherSlot === 1
                  ? "animate-pulse border-rose-300 bg-rose-600 text-white"
                  : "border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
              }`}
              title="1. öğretmeni sesle seç"
            >
              {isListening && voiceTeacherSlot === 1
                ? <MicOff className="h-5 w-5" />
                : <Mic className="h-5 w-5" />}
            </button>
          </div>
        </div>
        <div>
          <label className="mb-2 block text-xs font-black text-slate-600">2. Öğretmen</label>
          <div className="flex gap-2">
            <select
              value={tempTeacherToAssign2}
              onChange={(e) => setTempTeacherToAssign2(e.target.value)}
              className="h-12 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            >
              <option value="">İkinci Öğretmen Yok</option>
              {[...teachers]
                .filter(
                  (teacher) =>
                    teacher.id !== tempTeacherToAssign &&
                    isTeacherEligibleForCourse(
                      teacher,
                      teacherAssignmentModal.courseName,
                    ),
                )
                .sort(
                  (a, b) =>
                    (a.branch || "").localeCompare(b.branch || "", "tr-TR") ||
                    (a.name || "").localeCompare(b.name || "", "tr-TR"),
                )
                .map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                  {teacher.name} — {teacher.branch}
                  </option>
                ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const index = teacherAssignmentModal.courseIndex;
                if (index === null) return;
                if (isListening && voiceTeacherSlot === 2) {
                  stopSpeechRecognition("2. öğretmen dinlemesi durduruldu.");
                } else {
                  startSpeechRecognition(index, 2);
                }
              }}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-all ${
                isListening && voiceTeacherSlot === 2
                  ? "animate-pulse border-rose-300 bg-rose-600 text-white"
                  : "border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100"
              }`}
              title="2. öğretmeni sesle seç"
            >
              {isListening && voiceTeacherSlot === 2
                ? <MicOff className="h-5 w-5" />
                : <Mic className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`mt-4 flex min-h-12 items-center gap-3 rounded-2xl border px-4 py-3 text-xs font-bold ${
          isListening
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : voiceFeedback.includes("kaydedildi")
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-slate-50 text-slate-600"
        }`}
      >
        {isListening
          ? <Mic className="h-5 w-5 shrink-0 animate-pulse" />
          : <MicOff className="h-5 w-5 shrink-0" />}
        <span>
          {voiceFeedback ||
            "Ders kartı açıldığında 1. öğretmen için dinleme otomatik başlar. 2. öğretmen için yanındaki mikrofon düğmesine basın."}
        </span>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => {
            const idx = teacherAssignmentModal.courseIndex!;
            const updated = classCourses.map((course, courseIndex) =>
              courseIndex === idx
                ? { ...course, teacherId: "", teacherName: "Öğretmen Atanmadı", teacherId2: undefined, teacherName2: undefined, teacherAssignmentCleared: true }
                : course
            );
            setClassCourses(updated);
            stopSpeechRecognition();
            setTempTeacherToAssign("");
            setTempTeacherToAssign2("");
            setVoiceFeedback("");
            setTeacherAssignmentModal({ isOpen: false, courseIndex: null, courseName: "" });
          }}
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-black text-rose-600 hover:bg-rose-100"
        >
          Atamayı Kaldır
        </button>
        <button
          type="button"
          disabled={!tempTeacherToAssign}
          onClick={() => {
            if (!tempTeacherToAssign) return;
            const idx = teacherAssignmentModal.courseIndex!;
            const teacher = teachers.find((item) => item.id === tempTeacherToAssign);
            const teacher2 = teachers.find((item) => item.id === tempTeacherToAssign2);
            const updated = classCourses.map((course, courseIndex) =>
              courseIndex === idx
                ? {
                    ...course,
                    teacherId: tempTeacherToAssign,
                    teacherName: teacher?.name || "",
                    teacherId2: tempTeacherToAssign2 || undefined,
                    teacherName2: teacher2?.name || undefined,
                    teacherAssignmentCleared: false,
                  }
                : course
            );
            setClassCourses(updated);

            if (editingClassId) {
              const selectedClassroom = classrooms.find(
                (classroom) => classroom.id === editingClassId,
              );

              if (selectedClassroom) {
                const nextClassrooms = classrooms.map((classroom) =>
                  classroom.id === editingClassId
                    ? { ...classroom, assignedCourses: updated }
                    : classroom,
                );

                const nextCourses = courses.map((course) => {
                  if (course.classroom !== selectedClassroom.name) {
                    return course;
                  }

                  const assignment = updated.find((item) => {
                    if (!isSameCourseName(item.courseName, course.name)) {
                      return false;
                    }

                    const itemGroup = String(item.groupName || "")
                      .split(",")
                      .map((group) =>
                        group.trim().toLocaleUpperCase("tr-TR"),
                      )
                      .filter(Boolean)
                      .sort()
                      .join("|");
                    const courseGroup = String(course.groupName || "")
                      .split(",")
                      .map((group) =>
                        group.trim().toLocaleUpperCase("tr-TR"),
                      )
                      .filter(Boolean)
                      .sort()
                      .join("|");

                    return itemGroup === courseGroup;
                  });

                  if (!assignment) return course;

                  return {
                    ...course,
                    teacher: assignment.teacherId
                      ? assignment.teacherName || "Atanmadı"
                      : "Atanmadı",
                    teacherId: assignment.teacherId || "",
                    teacherName: assignment.teacherId
                      ? assignment.teacherName || "Belirtilmedi"
                      : "Öğretmen Atanmadı",
                    teacherId2: assignment.teacherId2 || undefined,
                    teacherName2:
                      assignment.teacherName2 || undefined,
                    teacherAssignmentCleared: Boolean(
                      assignment.teacherAssignmentCleared,
                    ),
                  } as Course;
                });

                setClassrooms(nextClassrooms as Classroom[]);
                setCourses(nextCourses);

                courseService.commitAcademicCatalog({
                  classrooms: nextClassrooms,
                  courses: nextCourses,
                  customCreatedCourses:
                    customCreatedCourses || [],
                })
                  .then(() => {
                    triggerNotification(
                      "Öğretmen ataması veritabanına kaydedildi.",
                    );
                  })
                  .catch((error) => {
                    console.error(
                      "Öğretmen ataması veritabanına kaydedilemedi:",
                      error,
                    );
                    triggerNotification(
                      "Öğretmen ataması veritabanına kaydedilemedi.",
                    );
                  });
              }
            }

            stopSpeechRecognition();
            setTeacherAssignmentModal({ isOpen: false, courseIndex: null, courseName: "" });
            setTempTeacherToAssign("");
            setTempTeacherToAssign2("");
            setVoiceFeedback("");
          }}
          className="ml-auto rounded-2xl bg-indigo-600 px-5 py-3 text-xs font-black text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Öğretmeni Kaydet
        </button>
      </div>
    </div>
  </div>
)}


</>
  );
}
