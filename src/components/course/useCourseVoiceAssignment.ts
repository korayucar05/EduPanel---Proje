import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Classroom, Course, Teacher } from "../../types";
import { courseService } from "../../modules/course";
import { isSameCourseName } from "./courseCatalog";

interface Params {
  teachers: Teacher[];
  classrooms: Classroom[];
  courses: Course[];
  customCreatedCourses: any[];
  editingClassId: string | null;
  classCourses: any[];
  setClassCourses: (value: any[] | ((prev: any[]) => any[])) => void;
  setClassrooms: Dispatch<SetStateAction<Classroom[]>>;
  setCourses: Dispatch<SetStateAction<Course[]>>;
  setTempTeacherToAssign: Dispatch<SetStateAction<string>>;
  setTempTeacherToAssign2: Dispatch<SetStateAction<string>>;
  notify: (message: string) => void;
}

const normalizeVoiceTeacherName = (value: string) =>
  String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/\b(öğretmen|öğretmeni|hocam|hoca|hanım|bey)\b/giu, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export function useCourseVoiceAssignment({
  teachers,
  classrooms,
  courses,
  customCreatedCourses,
  editingClassId,
  classCourses,
  setClassCourses,
  setClassrooms,
  setCourses,
  setTempTeacherToAssign,
  setTempTeacherToAssign2,
  notify,
}: Params) {
  const [isListening, setIsListening] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState("");
  const [voiceTeacherSlot, setVoiceTeacherSlot] = useState<1 | 2>(1);
  const recognitionRef = useRef<any>(null);

  const stopSpeechRecognition = (feedback = "") => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try { recognition.stop(); } catch { /* already ended */ }
    }
    setIsListening(false);
    if (feedback) setVoiceFeedback(feedback);
  };

  const findTeacherFromSpeech = (transcript: string): Teacher | null => {
    const spoken = normalizeVoiceTeacherName(transcript);
    if (!spoken) return null;
    const activeTeachers = teachers.filter((teacher) => {
      const status = String(teacher.status || "").toLocaleLowerCase("tr-TR");
      return !status || status === "aktif";
    });
    const exact = activeTeachers.find((teacher) => normalizeVoiceTeacherName(teacher.name) === spoken);
    if (exact) return exact;
    const contained = activeTeachers
      .filter((teacher) => {
        const teacherName = normalizeVoiceTeacherName(teacher.name);
        return teacherName && (spoken.includes(teacherName) || teacherName.includes(spoken));
      })
      .sort((a, b) => normalizeVoiceTeacherName(b.name).length - normalizeVoiceTeacherName(a.name).length);
    if (contained.length === 1) return contained[0];
    const spokenWords = new Set(spoken.split(" ").filter(Boolean));
    const wordMatches = activeTeachers.filter((teacher) => {
      const teacherWords = normalizeVoiceTeacherName(teacher.name).split(" ").filter(Boolean);
      return teacherWords.length > 0 && teacherWords.every((word) => spokenWords.has(word));
    });
    return wordMatches.length === 1 ? wordMatches[0] : null;
  };

  const assignTeacherByVoice = async (courseIndex: number, slot: 1 | 2, teacher: Teacher) => {
    if (slot === 1) setTempTeacherToAssign(teacher.id);
    else setTempTeacherToAssign2(teacher.id);

    const nextClassCourses = classCourses.map((course, index) => {
      if (index !== courseIndex) return course;
      return slot === 1
        ? { ...course, teacherId: teacher.id, teacherName: teacher.name, teacherAssignmentCleared: false }
        : { ...course, teacherId2: teacher.id, teacherName2: teacher.name, teacherAssignmentCleared: false };
    });
    setClassCourses(nextClassCourses);
    if (!editingClassId) throw new Error("Öğretmen ataması yapılacak sınıf bulunamadı.");
    const selectedClassroom = classrooms.find((classroom) => classroom.id === editingClassId);
    if (!selectedClassroom) throw new Error("Seçili sınıf kaydı bulunamadı.");

    const persistedAssignedCourses = nextClassCourses.map((course) => ({
      ...course,
      teacherId: course.teacherId || "",
      teacherName: course.teacherId ? course.teacherName || "Belirtilmedi" : "Öğretmen Atanmadı",
      teacherId2: course.teacherId2 || undefined,
      teacherName2: course.teacherName2 || undefined,
    }));
    const nextClassrooms = classrooms.map((classroom) =>
      classroom.id === editingClassId ? { ...classroom, assignedCourses: persistedAssignedCourses } : classroom,
    );
    const nextCourses = courses.map((course) => {
      if (course.classroom !== selectedClassroom.name) return course;
      const assignment = persistedAssignedCourses.find((item) => {
        if (!isSameCourseName(item.courseName, course.name)) return false;
        const itemGroup = String(item.groupName || "").split(",").map((g) => g.trim().toLocaleUpperCase("tr-TR")).filter(Boolean).sort().join("|");
        const courseGroup = String(course.groupName || "").split(",").map((g) => g.trim().toLocaleUpperCase("tr-TR")).filter(Boolean).sort().join("|");
        return itemGroup === courseGroup;
      });
      if (!assignment) return course;
      return {
        ...course,
        teacher: assignment.teacherId ? assignment.teacherName || "Atanmadı" : "Atanmadı",
        teacherId: assignment.teacherId || "",
        teacherName: assignment.teacherId ? assignment.teacherName || "Belirtilmedi" : "Öğretmen Atanmadı",
        teacherId2: assignment.teacherId2 || undefined,
        teacherName2: assignment.teacherName2 || undefined,
        teacherAssignmentCleared: Boolean(assignment.teacherAssignmentCleared),
      } as Course;
    });
    await courseService.commitAcademicCatalog({ classrooms: nextClassrooms, courses: nextCourses, customCreatedCourses: customCreatedCourses || [] });
    setClassrooms(nextClassrooms);
    setCourses(nextCourses);
  };

  const startSpeechRecognition = (courseIndex: number, slot: 1 | 2 = 1) => {
    stopSpeechRecognition();
    setVoiceTeacherSlot(slot);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceFeedback("Bu tarayıcı sesli öğretmen seçimini desteklemiyor.");
      notify("Tarayıcınız ses tanımayı desteklemiyor. Google Chrome veya Microsoft Edge kullanın.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceFeedback("Mikrofon erişimi bu ortamda kullanılamıyor.");
      notify("Mikrofon erişimi kullanılamıyor.");
      return;
    }
    setIsListening(true);
    setVoiceFeedback(`${slot}. öğretmen için mikrofon hazırlanıyor...`);
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      stream.getTracks().forEach((track) => track.stop());
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = "tr-TR";
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.maxAlternatives = 3;
      recognition.onstart = () => {
        setIsListening(true);
        setVoiceFeedback(`Dinleniyor: ${slot}. öğretmenin adını ve soyadını söyleyin.`);
      };
      recognition.onresult = (event: any) => {
        const alternatives: string[] = [];
        const result = event.results?.[0];
        if (result) for (let i = 0; i < result.length; i += 1) {
          const transcript = String(result[i]?.transcript || "").trim();
          if (transcript) alternatives.push(transcript);
        }
        const transcript = alternatives[0] || "";
        const matchedTeacher = alternatives.map(findTeacherFromSpeech).find(Boolean) || null;
        if (!matchedTeacher) {
          setVoiceFeedback(transcript ? `Öğretmen bulunamadı: “${transcript}”. Tekrar deneyin.` : "Konuşma algılanamadı. Tekrar deneyin.");
          notify(transcript ? `Kayıtlı öğretmen bulunamadı: "${transcript}"` : "Öğretmen adı algılanamadı.");
          return;
        }
        assignTeacherByVoice(courseIndex, slot, matchedTeacher)
          .then(() => {
            setVoiceFeedback(`${slot}. öğretmen: ${matchedTeacher.name} veritabanına kaydedildi. Mikrofon kapatıldı.`);
            notify(`'${matchedTeacher.name}' ${slot}. öğretmen alanına ve veritabanına kaydedildi.`);
          })
          .catch((error) => {
            console.error("Sesli öğretmen ataması veritabanına kaydedilemedi:", error);
            setVoiceFeedback("Öğretmen algılandı ancak veritabanına kaydedilemedi. Lütfen tekrar deneyin.");
            notify("Sesli öğretmen ataması veritabanına kaydedilemedi.");
          });
      };
      recognition.onerror = (event: any) => {
        const error = String(event?.error || "");
        let message = "Ses tanıma sırasında hata oluştu.";
        if (error === "not-allowed" || error === "service-not-allowed") message = "Mikrofon izni reddedildi. Tarayıcı adres çubuğundan mikrofon iznini açın.";
        else if (error === "no-speech") message = "Konuşma duyulmadı. Mikrofon kapatıldı; tekrar deneyin.";
        else if (error === "audio-capture") message = "Kullanılabilir mikrofon bulunamadı.";
        else if (error === "network") message = "Ses tanıma hizmetine bağlanılamadı.";
        else if (error === "aborted") message = "Sesli kayıt durduruldu.";
        setVoiceFeedback(message);
        if (error !== "aborted" && error !== "no-speech") notify(message);
      };
      recognition.onend = () => { recognitionRef.current = null; setIsListening(false); };
      try { recognition.start(); } catch (error) {
        recognitionRef.current = null;
        setIsListening(false);
        setVoiceFeedback("Sesli dinleme başlatılamadı. Tekrar deneyin.");
        console.warn("Ses tanıma başlatılamadı:", error);
      }
    }).catch((error) => {
      recognitionRef.current = null;
      setIsListening(false);
      setVoiceFeedback("Mikrofon izni alınamadı. Tarayıcı mikrofon iznini kontrol edin.");
      notify("Mikrofon erişimi reddedildi.");
      console.warn("Mikrofon izni hatası:", error);
    });
  };

  useEffect(() => () => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) try { recognition.stop(); } catch { /* already ended */ }
  }, []);

  return { isListening, voiceFeedback, setVoiceFeedback, voiceTeacherSlot, startSpeechRecognition, stopSpeechRecognition };
}
