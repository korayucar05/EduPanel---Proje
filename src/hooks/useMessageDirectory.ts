import { useEffect, useState } from "react";
import { communicationService } from "../modules/communication";

export function useMessageDirectory() {
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    communicationService.getDirectory().then((directory) => {
      if (!active) return;
      setStudents(directory.students);
      setTeachers(directory.teachers);
      setClassrooms(directory.classrooms);
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : "Mesaj listeleri yüklenemedi.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return { students, teachers, classrooms, loading, error };
}
