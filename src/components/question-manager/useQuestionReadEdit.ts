import React, { useEffect, useRef, useState } from "react";
import { sqliteStorage } from "../../core/state/SyncStateStore";
import { studentService } from "../../modules/student";
import { examReadEditService } from "../../modules/exam";

type Params = {
  exam: any;
  onUpdateExam: (exam: any) => void;
  showToast: (message: string) => void;
};

export function useQuestionReadEdit({ exam, onUpdateExam, showToast }: Params) {
  // States for Student Optical TXT File Imports ("Eksiklikleri Tamamla")
  const [studentRecords, setStudentRecords] = useState<any[]>(exam.studentTxtRecords || []);
  const [txtUploadOption, setTxtUploadOption] = useState<"replace" | "append" | null>(null);
  const [filterErrorType, setFilterErrorType] = useState<"Tüm" | "Kitapçık" | "Öğrenci No" | "Sınıf">("Tüm");
  const [selectedStudentRecords, setSelectedStudentRecords] = useState<string[]>([]);
  const txtFileInputRef = useRef<HTMLInputElement>(null);

  const [allStudents, setAllStudents] = useState<any[]>([]);

  const getExplicitRegisteredStudentNumber = (student: any) => {
    const candidates = [
      student?.studentNumber,
      student?.studentNo,
      student?.schoolNumber,
      student?.schoolNo,
      student?.number,
      student?.okulNo,
      student?.ogrenciNo,
      student?.["öğrenciNo"],
      student?.numara,
      student?.no,
    ];
    const value = candidates.find(
      (candidate) => candidate !== undefined && candidate !== null && String(candidate).trim(),
    );
    return value === undefined ? "" : String(value).trim();
  };

  const getRegisteredStudentNumber = (student: any) =>
    getExplicitRegisteredStudentNumber(student) || String(student?.id ?? "").trim();

  const loadRegisteredStudents = async (): Promise<any[]> => {
    try {
      return await studentService.list();
    } catch (error) {
      console.warn("Öğrenciler StudentService üzerinden okunamadı.", error);
      return [];
    }
  };

  useEffect(() => {
    let cancelled = false;

    loadRegisteredStudents().then((students) => {
      if (!cancelled) setAllStudents(students);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const normalizeTurkish = (str: string) => {
    if (!str) return "";
    return str
      .toLowerCase()
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .trim();
  };

  const getSmartSuggestionsForStudent = (name: string) => {
    if (!name || name.trim().length < 2) return [];
    const normalizedSearch = normalizeTurkish(name);
    const searchWords = normalizedSearch.split(/\s+/).filter(w => w.length > 1);
    if (searchWords.length === 0) return [];

    return allStudents
      .map((student: any) => {
        const normalizedRegName = normalizeTurkish(student.name);
        const regWords = normalizedRegName.split(/\s+/);
        
        let score = 0;
        if (normalizedRegName === normalizedSearch) {
          score += 100;
        } else if (normalizedRegName.includes(normalizedSearch) || normalizedSearch.includes(normalizedRegName)) {
          score += 50;
        }

        searchWords.forEach(sWord => {
          regWords.forEach(rWord => {
            if (rWord === sWord) {
              score += 20;
            } else if (rWord.includes(sWord) || sWord.includes(rWord)) {
              score += 5;
            }
          });
        });

        return { student, score };
      })
      .filter((item: any) => item.score > 20)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 3)
      .map((item: any) => item.student);
  };

  const normalizeIdentityText = (value: any) => {
    const compact = normalizeTurkish(String(value || ""))
      .replace(/[^a-z0-9]/g, "");
    if (!compact) return "";

    // Optik okuyucular okul numarasını başında sıfırlarla verebilir.
    // Tanımlar ekranındaki 00125 ile TXT'deki 125 aynı öğrenci kabul edilir.
    if (/^\d+$/.test(compact)) {
      return compact.replace(/^0+/, "") || "0";
    }

    return compact;
  };

  const extractGradeAndSection = (value: any) => {
    const raw = String(value || "").trim();
    const gradeMatch = raw.match(/\b(9|10|11|12)\b/);
    const compact = normalizeTurkish(raw).replace(/[^a-z0-9]/g, "");
    const sectionMatch = compact.match(/(?:9|10|11|12)([a-z]+)/);

    return {
      grade: gradeMatch?.[1] || "",
      section: sectionMatch?.[1] || "",
    };
  };

  const getExamGrade = () => {
    const raw = String(exam?.gradeLevel || "").trim();
    if (raw.toLocaleUpperCase("tr-TR") === "YKS") return "12";
    return raw.match(/\b(9|10|11|12)\b/)?.[1] || "";
  };

  const findSystemStudentForRecord = (record: any, students = allStudents) => {
    const recordNumber = normalizeIdentityText(record?.studentNumber);
    if (!recordNumber) return null;

    const explicitMatches = students.filter((student: any) => {
      const systemNumber = normalizeIdentityText(getExplicitRegisteredStudentNumber(student));
      return Boolean(systemNumber && recordNumber === systemNumber);
    });
    if (explicitMatches.length === 1) return explicitMatches[0];
    if (explicitMatches.length > 1) return null;

    const legacyMatches = students.filter((student: any) => {
      if (getExplicitRegisteredStudentNumber(student)) return false;
      const systemNumber = normalizeIdentityText(student?.id);
      return Boolean(systemNumber && recordNumber === systemNumber);
    });

    return legacyMatches.length === 1 ? legacyMatches[0] : null;
  };

  const enrichRecordFromSystem = (record: any, students = allStudents) => {
    const systemStudent = findSystemStudentForRecord(record, students);
    if (!systemStudent) return record;

    const systemName = String(
      systemStudent?.name ||
      systemStudent?.fullName ||
      [systemStudent?.firstName, systemStudent?.lastName].filter(Boolean).join(" ") ||
      "",
    ).trim();

    const systemClass = String(
      systemStudent?.classroom ||
      systemStudent?.gradeLevel ||
      systemStudent?.className ||
      [systemStudent?.grade, systemStudent?.section].filter(Boolean).join(" ") ||
      "",
    ).trim();

    return {
      ...record,
      studentName: systemName || record.studentName || "",
      gradeLevel: systemClass || record.gradeLevel || "",
      matchedSystemStudentId:
        getRegisteredStudentNumber(systemStudent),
      systemMatched: true,
    };
  };

  useEffect(() => {
    if (allStudents.length === 0) return;

    setStudentRecords((currentRecords) => {
      let changed = false;
      const enrichedRecords = currentRecords.map((record) => {
        const enriched = enrichRecordFromSystem(record, allStudents);
        if (
          enriched.studentName !== record.studentName ||
          enriched.gradeLevel !== record.gradeLevel ||
          enriched.systemMatched !== record.systemMatched ||
          enriched.matchedSystemStudentId !== record.matchedSystemStudentId
        ) {
          changed = true;
        }
        return enriched;
      });
      return changed ? enrichedRecords : currentRecords;
    });
  }, [allStudents]);

  const getRecordValidation = (record: any) => {
    const reasons: string[] = [];
    const studentNumber = String(record?.studentNumber || "").trim();
    const studentName = String(record?.studentName || "").trim();
    const bookletType = String(record?.bookletType || "").trim();
    const examGrade = getExamGrade();
    const recordClass = extractGradeAndSection(record?.gradeLevel);

    if (!studentNumber) reasons.push("Öğrenci numarası boş.");
    if (studentNumber && !findSystemStudentForRecord(record)) {
      reasons.push("Öğrenci numarası sistemde kayıtlı bir öğrenciyle eşleşmedi.");
    }
    if (!studentName) reasons.push("Öğrenci adı soyadı boş.");
    if (!recordClass.grade || !recordClass.section) reasons.push("Sınıf düzeyi veya şube bilgisi eksik.");
    if (!bookletType) reasons.push("Kitapçık türü boş.");

    if (
      examGrade &&
      recordClass.grade &&
      examGrade !== recordClass.grade
    ) {
      reasons.push(
        `Sınav ${examGrade}. sınıf düzeyine ait; TXT kaydı ${recordClass.grade}. sınıf.`,
      );
    }

    const systemStudent = findSystemStudentForRecord(record);

    if (systemStudent) {

      const systemClass = extractGradeAndSection(
        systemStudent?.classroom ||
        systemStudent?.gradeLevel ||
        systemStudent?.className ||
        [
          systemStudent?.grade,
          systemStudent?.section,
        ].filter(Boolean).join(" "),
      );

      if (
        recordClass.grade &&
        systemClass.grade &&
        recordClass.grade !== systemClass.grade
      ) {
        reasons.push("Sınıf düzeyi sistemdeki öğrenci kaydıyla uyuşmuyor.");
      }

      if (
        recordClass.section &&
        systemClass.section &&
        recordClass.section !== systemClass.section
      ) {
        reasons.push("Şube bilgisi sistemdeki öğrenci kaydıyla uyuşmuyor.");
      }
    }

    return {
      hasMismatch: reasons.length > 0,
      reasons,
    };
  };

  React.useEffect(() => {
    setStudentRecords(exam.studentTxtRecords || []);
  }, [exam.id, exam.studentTxtRecords]);

  const normalizeOpticName = (value: any) =>
    String(value || "")
      .trim()
      .toLocaleLowerCase("tr-TR")
      .replace(/\s+/g, " ");

  const loadSelectedOpticTemplate = async () => {
    // En güvenilir kaynak: sınav kaydına gömülen optik şablon kopyası.
    const embeddedTemplate =
      exam?.opticTemplate ||
      exam?.opticFormSnapshot ||
      exam?.selectedOpticTemplate;

    if (
      embeddedTemplate &&
      typeof embeddedTemplate === "object" &&
      (
        Array.isArray(embeddedTemplate.fields) ||
        embeddedTemplate.txtCoords
      )
    ) {
      return embeddedTemplate;
    }

    const selectedRaw = exam?.opticForm;
    const selectedId = String(
      exam?.opticFormId ||
      (typeof selectedRaw === "object" ? selectedRaw?.id : "") ||
      "",
    ).trim();

    const selectedName = normalizeOpticName(
      typeof selectedRaw === "object"
        ? selectedRaw?.name || selectedRaw?.label || selectedRaw?.id
        : selectedRaw,
    );

    let forms: any[] = [];

    try {
      const lf = await import("localforage");
      const lfForms = await lf.default.getItem<any[]>("opticForms");
      if (Array.isArray(lfForms)) {
        forms.push(...lfForms.filter(Boolean));
      }
    } catch (error) {
      console.warn("Optik şablon localforage üzerinden okunamadı:", error);
    }

    try {
      const stored = sqliteStorage.getItem("opticForms");
      const localForms = stored ? JSON.parse(stored) : [];
      if (Array.isArray(localForms)) {
        forms.push(...localForms.filter(Boolean));
      }
    } catch (error) {
      console.warn("Optik şablon sqliteStorage üzerinden okunamadı:", error);
    }

    const unique = new Map<string, any>();
    forms.forEach((form: any, index: number) => {
      const key = String(
        form?.id ||
        normalizeOpticName(form?.name || form?.label) ||
        index,
      );
      unique.set(key, form);
    });

    const allForms = Array.from(unique.values());

    return (
      allForms.find(
        (form: any) =>
          selectedId &&
          String(form?.id || "").trim() === selectedId,
      ) ||
      allForms.find(
        (form: any) =>
          selectedName &&
          normalizeOpticName(form?.name || form?.label) === selectedName,
      ) ||
      null
    );
  };

  const getTemplateFields = (template: any) => {
    if (!template) return [];

    if (Array.isArray(template.fields) && template.fields.length > 0) {
      return template.fields
        .filter(Boolean)
        .map((field: any, index: number) => ({
          id: field.id || `optic-field-${index}`,
          fieldName: String(field.fieldName || field.name || field.label || `Alan ${index + 1}`).trim(),
          columnStart: Number(field.columnStart ?? field.start ?? 0),
          columnCount: Number(field.columnCount ?? field.length ?? 0),
        }))
        .filter((field: any) => field.columnStart > 0 && field.columnCount > 0)
        .sort((a: any, b: any) => a.columnStart - b.columnStart);
    }

    // Eski txtCoords yapısındaki kayıtları da destekle.
    if (template.txtCoords && typeof template.txtCoords === "object") {
      const legacyMap: Record<string, string> = {
        schoolCode: "Okul Kodu",
        studentNo: "Öğrenci No",
        fullName: "Öğrenci Adı Soyadı",
        grade: "Alan Sınıf",
        section: "Şube",
        booklet: "Kitapçık",
        turkce: "Türkçe",
        sosyal: "Sosyal Bilimler",
        matematik: "Temel Matematik",
        fen: "Fen Bilimleri",
      };

      return Object.entries(template.txtCoords)
        .map(([key, coord]: [string, any], index) => ({
          id: `legacy-${key}-${index}`,
          fieldName: legacyMap[key] || key,
          columnStart: Number(coord?.start ?? 0),
          columnCount: Number(coord?.length ?? 0),
        }))
        .filter((field: any) => field.columnStart > 0 && field.columnCount > 0)
        .sort((a: any, b: any) => a.columnStart - b.columnStart);
    }

    return [];
  };

  const parseTxtFileContents = (text: string, opticTemplate: any) => {
    const lines = String(text || "").split(/\r?\n/);
    const parsed: any[] = [];
    const templateFields = getTemplateFields(opticTemplate);

    const normalizeFieldLabel = (value: any) =>
      String(value || "")
        .toLocaleUpperCase("tr-TR")
        .replace(/İ/g, "I")
        .replace(/Ğ/g, "G")
        .replace(/Ü/g, "U")
        .replace(/Ş/g, "S")
        .replace(/Ö/g, "O")
        .replace(/Ç/g, "C")
        .replace(/[^A-Z0-9]/g, "");

    const getFieldValue = (rawLine: string, field: any) => {
      const start = Number(field.columnStart || 0);
      const length = Number(field.columnCount || 0);
      if (!start || !length || start < 1 || length < 1) return "";
      const startIndex = start - 1; // Optik sütunları 1'den, JavaScript indeksleri 0'dan başlar.
      return rawLine.slice(startIndex, startIndex + length).trim();
    };

    for (const rawLine of lines) {
      if (!rawLine || !rawLine.trim()) continue;

      const lowerLine = rawLine.trim().toLocaleLowerCase("tr-TR");
      if (
        lowerLine.startsWith("#") ||
        (lowerLine.includes("öğrenci") && lowerLine.includes("no") && lowerLine.includes("cevap")) ||
        (lowerLine.includes("student") && lowerLine.includes("number"))
      ) {
        continue;
      }

      let studentNumber = "";
      let gradeValue = "";
      let sectionValue = "";
      let bookletType = "";
      let studentName = "";
      let answers = "";
      let fieldValues: Record<string, string> = {};
      let usedTemplate = false;

      if (templateFields.length > 0) {
        fieldValues = templateFields.reduce((result: Record<string, string>, field: any) => {
          result[field.fieldName] = getFieldValue(rawLine, field);
          return result;
        }, {});

        const answerParts: { start: number; value: string }[] = [];

        templateFields.forEach((field: any) => {
          const value = fieldValues[field.fieldName] || "";
          const key = normalizeFieldLabel(field.fieldName);

          if (key.includes("OGRENCI") && key.includes("NO")) {
            studentNumber = value;
          } else if ((key.includes("AD") && key.includes("SOYAD")) || key.includes("OGRENCIADISOYADI")) {
            studentName = value;
          } else if (key === "ALANSINIF" || key === "SINIF" || key.includes("SINIF")) {
            gradeValue = value;
          } else if (key === "SUBE" || key.includes("SUBE")) {
            sectionValue = value;
          } else if (key.includes("KITAP")) {
            bookletType = value.toUpperCase();
          } else if (!key.includes("OKULKODU")) {
            // Kimlik alanları dışındaki bütün alanlar cevap bölümü kabul edilir.
            answerParts.push({ start: Number(field.columnStart || 0), value });
          }
        });

        answers = answerParts
          .sort((a, b) => a.start - b.start)
          .map((item) => item.value)
          .filter(Boolean)
          .join("")
          .toUpperCase();

        usedTemplate = true;
      }

      // Şablon bulunamadığında eski esnek okuma yedeği çalışır.
      if (!usedTemplate) {
        const trimmedLine = rawLine.trim();
        const delimiter = trimmedLine.includes(";")
          ? ";"
          : trimmedLine.includes(",")
          ? ","
          : trimmedLine.includes("\t")
          ? "\t"
          : null;

        if (delimiter) {
          const parts = trimmedLine.split(delimiter).map((part) => part.trim());
          const numberPartIndex = parts.findIndex((part) => /^\d+$/.test(part) && part.length <= 10);
          if (numberPartIndex >= 0) studentNumber = parts[numberPartIndex];
          const booklet = parts.find((part) => /^[A-D]$/i.test(part));
          if (booklet) bookletType = booklet.toUpperCase();
          const grade = parts.find((part) => /^(9|10|11|12)([-/\s]?[A-Za-zÇĞİÖŞÜ])?$/i.test(part));
          if (grade) gradeValue = grade;
          const answer = parts.find((part) => part.length > 3 && /^[A-E\-*\s]+$/i.test(part));
          if (answer) answers = answer.toUpperCase();
          const name = parts.find((part) => /^[A-Za-zÇĞİÖŞÜçğıöşü\s]+$/.test(part) && part !== grade && part !== booklet);
          if (name) studentName = name;
        }
      }

      const cleanNumber = (() => {
        const raw = studentNumber.trim();
        if (!raw) return "";
        const digitsOnly = raw.replace(/\s+/g, "");
        const withoutLeadingZeros = digitsOnly.replace(/^0+/, "");
        return withoutLeadingZeros || "0";
      })();

      const gradeLevel = [gradeValue.trim(), sectionValue.trim()].filter(Boolean).join(" ").trim();

      parsed.push({
        id: Math.random().toString(36).substring(2, 9),
        studentNumber: cleanNumber,
        gradeLevel,
        bookletType: bookletType.trim().toUpperCase(),
        studentName: studentName.trim(),
        answers: answers.trim().toUpperCase(),
        fieldValues,
        opticTemplateName: opticTemplate?.name || exam.opticForm || "",
        rawLine,
      });
    }

    return parsed;
  };

  const handleTxtFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!txtUploadOption) {
      showToast("Lütfen dosya yüklemek için önce seçeneklerden birini belirleyin!");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const selectedTemplate = await loadSelectedOpticTemplate();

      if (!selectedTemplate) {
        showToast(`Seçili optik şablon bulunamadı: ${exam.opticForm || "Optik seçilmedi"}`);
        return;
      }

      const registeredStudents = allStudents.length > 0
        ? allStudents
        : await loadRegisteredStudents();

      if (allStudents.length === 0 && registeredStudents.length > 0) {
        setAllStudents(registeredStudents);
      }

      const parsed = parseTxtFileContents(text, selectedTemplate);
      try {
        const result = await examReadEditService.importRecords(String(exam.id), parsed, txtUploadOption, registeredStudents);
        const nextRecords = (result.exam as any).studentTxtRecords || result.reconciliation.records;
        setSelectedStudentRecords([]);
        setStudentRecords(nextRecords);
        onUpdateExam(result.exam);
        const conflictText = result.reconciliation.conflicts.length > 0
          ? ` ${result.reconciliation.conflicts.length} kayıt kontrol gerektiriyor.`
          : "";
        showToast(txtUploadOption === "replace"
          ? `Önceki TXT verileri silindi ve ${parsed.length} kayıt SQLite'a kaydedildi.${conflictText}`
          : `${parsed.length} kayıt mevcut TXT verileriyle birleştirilip SQLite'a kaydedildi.${conflictText}`);
      } catch (error) {
        console.error("TXT kayıtları kaydedilemedi", error);
        showToast(error instanceof Error ? error.message : "TXT kayıtları kaydedilemedi.");
      }
    };
    reader.readAsText(file, "windows-1254");
    e.target.value = ""; // reset
  };

  const saveStudentRecords = async (updatedRecords: any[]) => {
    try {
      const registeredStudents = allStudents.length > 0 ? allStudents : await loadRegisteredStudents();
      const result = await examReadEditService.saveEditedRecords(String(exam.id), updatedRecords, registeredStudents);
      const nextRecords = (result.exam as any).studentTxtRecords || result.reconciliation.records;
      setStudentRecords(nextRecords);
      onUpdateExam(result.exam);
      showToast(result.reconciliation.conflicts.length > 0
        ? `Kayıtlar SQLite'a kaydedildi. ${result.reconciliation.conflicts.length} kayıt kontrol gerektiriyor.`
        : "Öğrenci bilgileri SQLite'a başarıyla kaydedildi.");
    } catch (error) {
      console.error("Öğrenci TXT kayıtları kaydedilemedi", error);
      showToast(error instanceof Error ? error.message : "Öğrenci bilgileri kaydedilemedi.");
    }
  };

  const handleAddEmptyStudent = () => {
    const newStudent = {
      id: Math.random().toString(36).substring(2, 9),
      studentNumber: "",
      gradeLevel: "",
      bookletType: "",
      studentName: "",
      answers: "",
      rawLine: ""
    };
    setStudentRecords([...studentRecords, newStudent]);
  };

  const handleUpdateStudentField = (id: string, field: string, value: string) => {
    const updated = studentRecords.map((rec) => {
      if (rec.id !== id) return rec;
      const changed = { ...rec, [field]: value };
      return field === "studentNumber" ? enrichRecordFromSystem(changed) : changed;
    });
    setStudentRecords(updated);
  };

  const handleDeleteStudent = (id: string) => {
    const filtered = studentRecords.filter(rec => rec.id !== id);
    setStudentRecords(filtered);
    setSelectedStudentRecords(prev => prev.filter(rId => rId !== id));
  };

  const handleDeleteSelectedStudents = () => {
    if (selectedStudentRecords.length === 0) return;
    if (window.confirm(`${selectedStudentRecords.length} öğrenci kaydını silmek istediğinize emin misiniz?`)) {
       const filtered = studentRecords.filter(rec => !selectedStudentRecords.includes(rec.id));
       setStudentRecords(filtered);
       setSelectedStudentRecords([]);
    }
  };

  return {
    studentRecords, setStudentRecords,
    txtUploadOption, setTxtUploadOption,
    filterErrorType, setFilterErrorType,
    selectedStudentRecords, setSelectedStudentRecords,
    txtFileInputRef, allStudents,
    getSmartSuggestionsForStudent,
    handleTxtFileChange, saveStudentRecords,
    handleUpdateStudentField, handleDeleteStudent, handleDeleteSelectedStudents,
    getRecordValidation,
  };
}
