import React, { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, ListChecks, Lock, LockOpen, Printer, RotateCcw } from "lucide-react";
import type { Classroom, Course, Student, Teacher } from "../types";
import { sqliteStorage } from "../core/state/SyncStateStore";

interface ListBuilderModuleProps {
  students: Student[];
  teachers: Teacher[];
  classrooms: Classroom[];
  courses: Course[];
}

type GroupKey =
  | "student"
  | "classroom"
  | "parent"
  | "academic"
  | "responsible"
  | "registration"
  | "other";

type FieldDefinition = {
  key: string;
  label: string;
  value: (student: Student) => string;
  available?: () => boolean;
};

type GroupDefinition = {
  key: GroupKey;
  label: string;
  fields: FieldDefinition[];
};

type ColumnState = {
  group: GroupKey | "";
  field: string;
  filters: string[];
};

const EMPTY_COLUMNS: ColumnState[] = Array.from({ length: 8 }, () => ({
  group: "",
  field: "",
  filters: [],
}));

const normalizeClassroom = (value: unknown) =>
  String(value || "").trim().toLocaleUpperCase("tr-TR");


const LIST_BUILDER_HISTORY_KEY = "list_builder_history_v2";
const MAX_SAVED_LISTS = 10;

type SavedListTemplate = {
  id: string;
  title: string;
  createdAt: string;
  columns: ColumnState[];
  lockedFieldKeys: string[];
  sortState: {
    fieldKey: string;
    direction: "asc" | "desc";
  } | null;
  selectedStudentIds: string[];
};

const readSavedLists = (): SavedListTemplate[] => {
  try {
    const raw = sqliteStorage.getItem(LIST_BUILDER_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_SAVED_LISTS) : [];
  } catch {
    return [];
  }
};

export default function ListBuilderModule({
  students,
  teachers,
  classrooms,
  courses,
}: ListBuilderModuleProps) {
  const [listTitle, setListTitle] = useState("");
  const [columns, setColumns] = useState<ColumnState[]>(
    EMPTY_COLUMNS.map((column) => ({ ...column, filters: [] })),
  );
  const [sortState, setSortState] = useState<{
    fieldKey: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [lockedFieldKeys, setLockedFieldKeys] = useState<string[]>([]);
  const [pdfOptionsOpen, setPdfOptionsOpen] = useState(false);
  const [savedLists, setSavedLists] = useState<SavedListTemplate[]>(() =>
    readSavedLists(),
  );
  const [selectedSavedListId, setSelectedSavedListId] = useState("");
  const [studentPickerQuery, setStudentPickerQuery] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
useEffect(() => {
    const visibleFieldKeys = new Set(
      columns.map((column) => column.field).filter(Boolean),
    );

    setLockedFieldKeys((current) =>
      current.filter((fieldKey) => visibleFieldKeys.has(fieldKey)),
    );

    setSortState((current) =>
      current && !visibleFieldKeys.has(current.fieldKey) ? null : current,
    );
  }, [columns]);


  const persistSavedLists = (next: SavedListTemplate[]) => {
    const limited = next.slice(0, MAX_SAVED_LISTS);
    setSavedLists(limited);
    sqliteStorage.setItem(LIST_BUILDER_HISTORY_KEY, JSON.stringify(limited));
  };

  const saveCurrentListTemplate = () => {
    const title = listTitle.trim().toLocaleUpperCase("tr-TR");
    if (!title) {
      window.alert("Liste başlığını yazınız.");
      return;
    }

    if (!columns.some((column) => Boolean(column.field))) {
      window.alert("Kaydetmeden önce en az bir liste alanı seçiniz.");
      return;
    }

    const template: SavedListTemplate = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      createdAt: new Date().toISOString(),
      columns: columns.map((column) => ({
        ...column,
        filters: [...column.filters],
      })),
      lockedFieldKeys: [...lockedFieldKeys],
      sortState: sortState ? { ...sortState } : null,
      selectedStudentIds: [...selectedStudentIds],
    };

    // Aynı başlık varsa eski kaydı kaldır; yeni kayıt en üste gelir.
    const next = [
      template,
      ...savedLists.filter(
        (item) =>
          item.title.toLocaleUpperCase("tr-TR") !==
          title.toLocaleUpperCase("tr-TR"),
      ),
    ].slice(0, MAX_SAVED_LISTS);

    persistSavedLists(next);
    setSelectedSavedListId(template.id);
    setListTitle(title);
  };

  const loadSavedListTemplate = (templateId: string) => {
    setSelectedSavedListId(templateId);
    if (!templateId) {
      setListTitle("");
      setColumns(
        EMPTY_COLUMNS.map((column) => ({ ...column, filters: [] })),
      );
      setLockedFieldKeys([]);
      setSortState(null);
      setSelectedStudentIds([]);
      setStudentPickerQuery("");
      return;
    }

    const template = savedLists.find((item) => item.id === templateId);
    if (!template) return;

    setListTitle(template.title);
    setColumns(
      EMPTY_COLUMNS.map((emptyColumn, index) => {
        const saved = template.columns[index] || emptyColumn;
        return {
          group: saved.group || "",
          field: saved.field || "",
          filters: Array.isArray(saved.filters) ? [...saved.filters] : [],
        };
      }),
    );
    setLockedFieldKeys([...(template.lockedFieldKeys || [])]);
    setSortState(template.sortState ? { ...template.sortState } : null);
    setSelectedStudentIds([...(template.selectedStudentIds || [])]);
    setStudentPickerQuery("");
  };

  const classroomByName = useMemo(() => {
    const map = new Map<string, any>();
    classrooms.forEach((classroom: any) => {
      map.set(normalizeClassroom(classroom.name), classroom);
    });
    return map;
  }, [classrooms]);

  const teacherNameById = useMemo(() => {
    const map = new Map<string, string>();
    teachers.forEach((teacher: any) => {
      map.set(String(teacher.id), String(teacher.name || ""));
    });
    return map;
  }, [teachers]);

  const hasAny = (getter: (student: Student) => unknown) =>
    students.some((student) => {
      const value = getter(student);
      return value !== null && value !== undefined && String(value).trim() !== "";
    });

  const classResponsibleValue = (
    student: Student,
    keys: string[],
  ) => {
    const classroom: any = classroomByName.get(normalizeClassroom(student.classroom));
    if (!classroom) return "";
    for (const key of keys) {
      const value = classroom?.[key];
      if (!value) continue;
      const direct = String(value).trim();
      return teacherNameById.get(direct) || direct;
    }
    return "";
  };

  const groups = useMemo<GroupDefinition[]>(
    () => [
      {
        key: "student",
        label: "Öğrenci Bilgileri",
        fields: [
          { key: "studentNo", label: "Ö. No", value: (s) => String(s.id || "") },
          { key: "studentName", label: "Ad Soyad", value: (s) => String(s.name || "") },
          {
            key: "tcIdentityNo",
            label: "T.C. Kimlik No",
            value: (s) =>
              String(
                (s as any).tcIdentityNo ||
                  (s as any).tcKimlikNo ||
                  (s as any).identityNo ||
                  (s as any).nationalId ||
                  "",
              ),
            available: () =>
              hasAny(
                (s) =>
                  (s as any).tcIdentityNo ||
                  (s as any).tcKimlikNo ||
                  (s as any).identityNo ||
                  (s as any).nationalId,
              ),
          },
          {
            key: "phone",
            label: "Telefon Numarası",
            value: (s) => String(s.phone || ""),
            available: () => hasAny((s) => s.phone),
          },
          { key: "classroom", label: "Sınıf / Şube", value: (s) => String(s.classroom || "") },
          { key: "dob", label: "Doğum Tarihi", value: (s) => String(s.dob || ""), available: () => hasAny((s) => s.dob) },
          { key: "pob", label: "Doğum Yeri", value: (s) => String(s.pob || ""), available: () => hasAny((s) => s.pob) },
        ],
      },
      {
        key: "classroom",
        label: "Sınıf Bilgileri",
        fields: [
          { key: "classroom", label: "Sınıf / Şube", value: (s) => String(s.classroom || "") },
          { key: "group", label: "Alan / Grup", value: (s) => String((s as any).group || ""), available: () => hasAny((s) => (s as any).group) },
        ],
      },
      {
        key: "parent",
        label: "Veli Bilgileri",
        fields: [
          { key: "parentName", label: "Veli Adı Soyadı", value: (s) => String(s.parentName || ""), available: () => hasAny((s) => s.parentName) },
          { key: "parentPhone", label: "Veli Telefonu", value: (s) => String(s.parentPhone || ""), available: () => hasAny((s) => s.parentPhone) },
        ],
      },
      {
        key: "academic",
        label: "Akademik Bilgiler",
        fields: [
          { key: "oob", label: "OÖB", value: (s) => String((s as any).oob ?? ""), available: () => hasAny((s) => (s as any).oob) },
          { key: "gpa", label: "Ortalama", value: (s) => String((s as any).gpa ?? ""), available: () => hasAny((s) => (s as any).gpa) },
          { key: "absences", label: "Devamsızlık", value: (s) => String((s as any).absences ?? ""), available: () => hasAny((s) => (s as any).absences) },
        ],
      },
      {
        key: "responsible",
        label: "Sorumlular",
        fields: [
          {
            key: "advisor",
            label: "Sınıf Rehber Öğretmeni",
            value: (s) =>
              classResponsibleValue(s, ["advisorTeacherId", "advisorTeacher", "homeroomTeacherId", "homeroomTeacher"]),
            available: () =>
              students.some((s) =>
                Boolean(classResponsibleValue(s, ["advisorTeacherId", "advisorTeacher", "homeroomTeacherId", "homeroomTeacher"])),
              ),
          },
          {
            key: "counselor",
            label: "Rehber Öğretmen",
            value: (s) =>
              classResponsibleValue(s, ["guidanceTeacherId", "guidanceTeacher", "counselorId", "counselor"]),
            available: () =>
              students.some((s) =>
                Boolean(classResponsibleValue(s, ["guidanceTeacherId", "guidanceTeacher", "counselorId", "counselor"])),
              ),
          },
          {
            key: "assistantPrincipal",
            label: "Sorumlu Müdür Yardımcısı",
            value: (s) =>
              classResponsibleValue(s, ["assistantPrincipalId", "assistantPrincipal", "responsibleAdminId", "responsibleAdmin"]),
            available: () =>
              students.some((s) =>
                Boolean(classResponsibleValue(s, ["assistantPrincipalId", "assistantPrincipal", "responsibleAdminId", "responsibleAdmin"])),
              ),
          },
        ],
      },
      {
        key: "registration",
        label: "Kayıt Bilgileri",
        fields: [
          { key: "registerDate", label: "Kayıt Tarihi", value: (s) => String((s as any).registerDate || ""), available: () => hasAny((s) => (s as any).registerDate) },
          { key: "status", label: "Durum", value: (s) => String((s as any).status || ""), available: () => hasAny((s) => (s as any).status) },
          { key: "source", label: "Kayıt Kaynağı", value: (s) => String((s as any).registrationSource || ""), available: () => hasAny((s) => (s as any).registrationSource) },
        ],
      },
      {
        key: "other",
        label: "Diğer Bilgiler",
        fields: [
          { key: "gender", label: "Cinsiyet", value: (s) => String((s as any).gender || (s as any).cinsiyet || ""), available: () => hasAny((s) => (s as any).gender || (s as any).cinsiyet) },
          { key: "courseCount", label: "Tanımlı Ders Sayısı", value: () => String(courses.length), available: () => courses.length > 0 },
          { key: "teacherCount", label: "Öğretmen Sayısı", value: () => String(teachers.length), available: () => teachers.length > 0 },
        ],
      },
    ],
    [students, teachers, courses, classrooms, classroomByName, teacherNameById],
  );

  const selectedFieldKeys = useMemo(
    () => new Set(columns.map((column) => column.field).filter(Boolean)),
    [columns],
  );

  const selectedDefinitions = useMemo(
    () =>
      columns
        .map((column) => {
          if (!column.group || !column.field) return null;
          const group = groups.find((candidate) => candidate.key === column.group);
          const field = group?.fields.find((candidate) => candidate.key === column.field);
          return field ? { group, field } : null;
        })
        .filter(Boolean) as Array<{ group: GroupDefinition; field: FieldDefinition }>,
    [columns, groups],
  );

  const updateGroup = (index: number, group: GroupKey | "") => {
    setColumns((current) =>
      current.map((column, columnIndex) =>
        columnIndex === index ? { group, field: "", filters: [] } : column,
      ),
    );
  };

  const updateField = (index: number, field: string) => {
    setColumns((current) =>
      current.map((column, columnIndex) =>
        columnIndex === index ? { ...column, field, filters: [] } : column,
      ),
    );
  };

  const reset = () => {
    setSelectedSavedListId("");
    setListTitle("");
    setColumns(EMPTY_COLUMNS.map((column) => ({ ...column, filters: [] })));
    setSortState(null);
    setLockedFieldKeys([]);
    setSelectedStudentIds([]);
    setStudentPickerQuery("");
  };


  const availableClassroomNames = useMemo(
    () =>
      Array.from(
        new Set(
          students
            .map((student) => String(student.classroom || "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) =>
        a.localeCompare(b, "tr", { numeric: true, sensitivity: "base" }),
      ),
    [students],
  );


  const studentPickerResults = useMemo(() => {
    const query = studentPickerQuery.trim().toLocaleUpperCase("tr-TR");
    if (!query) return [];

    return students
      .filter((student) => {
        const id = String(student.id || "").toLocaleUpperCase("tr-TR");
        const name = String(student.name || "").toLocaleUpperCase("tr-TR");
        const classroom = String(student.classroom || "").toLocaleUpperCase("tr-TR");
        return id.includes(query) || name.includes(query) || classroom.includes(query);
      })
      .slice(0, 30);
  }, [students, studentPickerQuery]);

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId],
    );
  };

  const selectedStudents = useMemo(
    () =>
      selectedStudentIds
        .map((id) => students.find((student) => String(student.id) === id))
        .filter(Boolean) as Student[],
    [students, selectedStudentIds],
  );

  const groupFilterOptions = ["SAY", "EA", "SÖZ", "DİL"];

  const toggleThirdRowFilter = (index: number, value: string) => {
    setColumns((current) =>
      current.map((column, columnIndex) => {
        if (columnIndex !== index) return column;

        const selected = column.filters.includes(value);
        return {
          ...column,
          filters: selected
            ? column.filters.filter((item) => item !== value)
            : [...column.filters, value],
        };
      }),
    );
  };

  const hasThirdRowFilter = (column: ColumnState) =>
    column.field === "classroom" || column.field === "group";

  const filteredStudentsForList = useMemo(() => {
    const baseStudents =
      selectedStudentIds.length > 0
        ? students.filter((student) =>
            selectedStudentIds.includes(String(student.id)),
          )
        : students;

    return baseStudents.filter((student) =>
      columns.every((column) => {
        if (column.filters.length === 0) return true;

        if (column.field === "classroom") {
          return column.filters.includes(String(student.classroom || "").trim());
        }

        if (column.field === "group") {
          return column.filters.includes(
            String((student as any).group || "")
              .trim()
              .toLocaleUpperCase("tr-TR"),
          );
        }

        return true;
      }),
    );
  }, [students, columns, selectedStudentIds]);

  const selectedColumnMetrics = useMemo(() => {
    const sample = filteredStudentsForList.slice(0, 160);

    const preferredWidthForField = (fieldKey: string) => {
      switch (fieldKey) {
        case "studentNo":
          return { min: 14, max: 22 };
        case "classroom":
        case "group":
        case "gender":
        case "status":
        case "oob":
        case "gpa":
        case "absences":
          return { min: 18, max: 30 };
        case "tcIdentityNo":
        case "phone":
        case "parentPhone":
        case "dob":
        case "registerDate":
          return { min: 25, max: 38 };
        case "studentName":
        case "parentName":
        case "advisor":
        case "counselor":
        case "assistantPrincipal":
          return { min: 34, max: 55 };
        case "address":
          return { min: 46, max: 72 };
        default:
          return { min: 24, max: 48 };
      }
    };

    return selectedDefinitions.map(({ field }) => {
      const lengths = sample
        .map((student) => String(field.value(student) || "").trim().length)
        .sort((a, b) => a - b);

      // Tek bir aşırı uzun değer tüm tabloyu bozmasın:
      // %90'lık gerçek veri uzunluğunu esas al, başlığı mutlaka hesaba kat.
      const p90Index = Math.max(
        0,
        Math.min(lengths.length - 1, Math.floor(lengths.length * 0.9)),
      );
      const representativeLength =
        lengths.length > 0 ? lengths[p90Index] : 0;
      const contentLength = Math.max(
        field.label.length,
        representativeLength,
      );

      const limits = preferredWidthForField(field.key);
      const estimatedMm = Math.min(
        limits.max,
        Math.max(limits.min, contentLength * 1.65 + 7),
      );

      return {
        key: field.key,
        estimatedMm,
      };
    });
  }, [filteredStudentsForList, selectedDefinitions]);

  const estimatedTableWidthMm = useMemo(
    () =>
      12 +
      selectedColumnMetrics.reduce(
        (total, metric) => total + metric.estimatedMm,
        0,
      ),
    [selectedColumnMetrics],
  );

  // A4 dikeyde 9 mm kenar boşluklarıyla yaklaşık 192 mm kullanılabilir.
  // İçerik bundan genişse yataya geç.
  const printOrientation: "portrait" | "landscape" =
    estimatedTableWidthMm <= 192 ? "portrait" : "landscape";

  const sharedColumnLayout = useMemo(() => {
    const sıraWeight = 12;
    const dataWeights = selectedColumnMetrics.map((metric) =>
      Math.max(10, metric.estimatedMm),
    );
    const totalWeight =
      sıraWeight + dataWeights.reduce((sum, value) => sum + value, 0);

    const screenPercentages = [
      (sıraWeight / totalWeight) * 100,
      ...dataWeights.map((value) => (value / totalWeight) * 100),
    ];

    // pdfmake sayısal genişlikleri doğrudan pt kabul eder.
    // Bu nedenle A4'ün gerçek pt genişliğini kullanıp oranları pt'ye çeviriyoruz.
    const a4WidthPt =
      printOrientation === "portrait" ? 595.28 : 841.89;
    const pdfHorizontalMarginPt = 28.35 * 2;
    const pdfUsableWidthPt = a4WidthPt - pdfHorizontalMarginPt;

    const pdfWidthsPt = screenPercentages.map(
      (percentage) => (pdfUsableWidthPt * percentage) / 100,
    );

    // Excel karakter genişlikleri de aynı ağırlıkların oranını izler.
    const excelWidths = screenPercentages.map((percentage, index) => {
      if (index === 0) return 7;
      const metric = selectedColumnMetrics[index - 1];
      return Math.max(
        9,
        Math.min(42, Math.round(metric.estimatedMm / 1.7)),
      );
    });

    return {
      screenPercentages,
      pdfWidthsPt,
      excelWidths,
      pdfUsableWidthPt,
    };
  }, [printOrientation, selectedColumnMetrics]);



  const toggleColumnLock = (fieldKey: string) => {
    setLockedFieldKeys((current) =>
      current.includes(fieldKey)
        ? current.filter((key) => key !== fieldKey)
        : [...current, fieldKey],
    );
  };

  const lockedDefinitions = useMemo(
    () =>
      lockedFieldKeys
        .map((fieldKey) =>
          selectedDefinitions.find(({ field }) => field.key === fieldKey),
        )
        .filter(Boolean) as Array<{
          group: GroupDefinition;
          field: FieldDefinition;
        }>,
    [lockedFieldKeys, selectedDefinitions],
  );

  const sortedStudentsForList = useMemo(() => {
    if (!sortState && lockedDefinitions.length === 0) {
      return filteredStudentsForList;
    }

    const collator = new Intl.Collator("tr", {
      numeric: true,
      sensitivity: "base",
    });

    const activeSortDefinition = sortState
      ? selectedDefinitions.find(
          ({ field }) => field.key === sortState.fieldKey,
        )
      : null;

    // Kilitlenmiş sütunların grup sırası, ekranda o anda görünen öğrenci
    // sırasındaki ilk görülme düzenine göre korunur.
    const lockOrderMaps = lockedDefinitions.map(({ field }) => {
      const order = new Map<string, number>();
      filteredStudentsForList.forEach((student) => {
        const value = String(field.value(student) || "").trim();
        if (!order.has(value)) order.set(value, order.size);
      });
      return { field, order };
    });

    return [...filteredStudentsForList].sort((a, b) => {
      // 1) Kilitli sütunlar her zaman ana gruplama anahtarıdır.
      //    Böylece başka bir sütuna tıklamak farklı sınıfları/grupları birbirine karıştırmaz.
      for (const { field, order } of lockOrderMaps) {
        const aValue = String(field.value(a) || "").trim();
        const bValue = String(field.value(b) || "").trim();

        if (aValue !== bValue) {
          return (order.get(aValue) ?? Number.MAX_SAFE_INTEGER) -
            (order.get(bValue) ?? Number.MAX_SAFE_INTEGER);
        }
      }

      // 2) Aktif sıralama, yalnızca aynı kilitli grubun içinde çalışır.
      if (activeSortDefinition && sortState) {
        const aValue = String(activeSortDefinition.field.value(a) || "").trim();
        const bValue = String(activeSortDefinition.field.value(b) || "").trim();

        const result = collator.compare(aValue, bValue);
        if (result !== 0) {
          return sortState.direction === "asc" ? result : -result;
        }
      }

      // 3) Eşitlikte mevcut görünüm sırasını korur.
      return 0;
    });
  }, [
    filteredStudentsForList,
    lockedDefinitions,
    selectedDefinitions,
    sortState,
  ]);

  const handleColumnSort = (fieldKey: string) => {
    setSortState((current) => {
      if (!current || current.fieldKey !== fieldKey) {
        return { fieldKey, direction: "asc" };
      }

      return {
        fieldKey,
        direction: current.direction === "asc" ? "desc" : "asc",
      };
    });
  };


  const safeListFilename = useMemo(() => {
    const value = (listTitle.trim() || "ÖĞRENCİ LİSTESİ")
      .toLocaleUpperCase("tr-TR")
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return value || "ÖĞRENCİ LİSTESİ";
  }, [listTitle]);

  const exportHeaders = useMemo(
    () => ["SIRA", ...selectedDefinitions.map(({ field }) => field.label)],
    [selectedDefinitions],
  );

  const exportRows = useMemo(
    () =>
      sortedStudentsForList.map((student, rowIndex) => [
        rowIndex + 1,
        ...selectedDefinitions.map(({ field }) => field.value(student) || ""),
      ]),
    [sortedStudentsForList, selectedDefinitions],
  );

  const downloadPdf = async (mode: "all" | "by-class") => {
    if (selectedDefinitions.length === 0) return;

    const { PdfEngine } = await import("../pdf");
    const pdfWidths = sharedColumnLayout.pdfWidthsPt;

    const buildTableBody = (rows: Student[]) => [
      exportHeaders.map((header) => ({
        text: header,
        bold: true,
        color: "#ffffff",
        fillColor: "#0f172a",
        fontSize:
          selectedDefinitions.length >= 7
            ? 7.2
            : selectedDefinitions.length >= 5
              ? 7.6
              : 8.2,
        margin: [3, 3, 3, 3],
        alignment: header === "SIRA" ? "center" : "left",
      })),
      ...rows.map((student, rowIndex) => {
        const values = [
          rowIndex + 1,
          ...selectedDefinitions.map(({ field }) => field.value(student) || ""),
        ];

        return values.map((value, columnIndex) => ({
          text: String(value ?? ""),
          fontSize:
            selectedDefinitions.length >= 7
              ? 7.2
              : selectedDefinitions.length >= 5
                ? 7.6
                : 8.2,
          color: "#334155",
          fillColor: rowIndex % 2 === 0 ? "#ffffff" : "#f1f5f9",
          margin: [3, 3, 3, 3],
          alignment: columnIndex === 0 ? "center" : "left",
        }));
      }),
    ];

    const buildTable = (rows: Student[]) => ({
      table: {
        headerRows: 1,
        widths: pdfWidths,
        body: buildTableBody(rows),
      },
      layout: {
        hLineColor: () => "#cbd5e1",
        vLineColor: () => "#cbd5e1",
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        paddingLeft: () => 2,
        paddingRight: () => 2,
        paddingTop: () => 1.5,
        paddingBottom: () => 1.5,
      },
    });

    const content: any[] = [];

    if (mode === "all") {
      content.push(
        {
          text: listTitle.trim() || "ÖĞRENCİ LİSTESİ",
          alignment: "center",
          bold: true,
          fontSize: 15,
          margin: [0, 0, 0, 12],
        },
        buildTable(sortedStudentsForList),
      );
    } else {
      const grouped = new Map<string, Student[]>();

      sortedStudentsForList.forEach((student) => {
        const classroom = String(student.classroom || "SINIFI BELİRTİLMEMİŞ").trim();
        const list = grouped.get(classroom) || [];
        list.push(student);
        grouped.set(classroom, list);
      });

      const classEntries = Array.from(grouped.entries()).sort(([a], [b]) =>
        a.localeCompare(b, "tr", { numeric: true, sensitivity: "base" }),
      );

      classEntries.forEach(([classroom, rows], classIndex) => {
        content.push(
          {
            text: listTitle.trim() || "ÖĞRENCİ LİSTESİ",
            alignment: "center",
            bold: true,
            fontSize: 15,
            margin: [0, 0, 0, 4],
          },
          {
            text: classroom,
            alignment: "center",
            bold: true,
            fontSize: 10,
            color: "#475569",
            margin: [0, 0, 0, 10],
          },
          buildTable(rows),
        );

        if (classIndex < classEntries.length - 1) {
          content.push({ text: "", pageBreak: "after" });
        }
      });
    }

    const filename =
      mode === "all"
        ? `${safeListFilename}.pdf`
        : `${safeListFilename}_SINIFLARA_GORE.pdf`;

    const docDefinition: any = {
      pageSize: "A4",
      pageOrientation: printOrientation,
      pageMargins: [28.35, 28, 28.35, 26],
      info: { title: safeListFilename },
      content,
      footer: (currentPage: number, pageCount: number) => ({
        text: `${currentPage} / ${pageCount}`,
        alignment: "center",
        fontSize: 7,
        color: "#94a3b8",
        margin: [0, 8, 0, 0],
      }),
    };

    await PdfEngine.generate(docDefinition, {
      mode: "download",
      filename,
    });

    setPdfOptionsOpen(false);
  };

  const downloadExcel = async () => {
    if (selectedDefinitions.length === 0) return;

    const XLSX = await import("xlsx");
    const worksheetData = [
      [listTitle.trim() || "ÖĞRENCİ LİSTESİ"],
      [],
      exportHeaders,
      ...exportRows,
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    worksheet["!merges"] = [
      {
        s: { r: 0, c: 0 },
        e: { r: 0, c: Math.max(0, exportHeaders.length - 1) },
      },
    ];
    worksheet["!cols"] = sharedColumnLayout.excelWidths.map((wch) => ({
      wch,
    }));
    worksheet["!autofilter"] = {
      ref: `A3:${XLSX.utils.encode_col(exportHeaders.length - 1)}${exportRows.length + 3}`,
    };
    worksheet["!margins"] = {
      left: 0.3,
      right: 0.3,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    };

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Liste");
    XLSX.writeFile(workbook, `${safeListFilename}.xlsx`);
  };

  const printBrowser = () => {
    if (selectedDefinitions.length === 0) return;

    const styleId = "list-builder-dynamic-print-style";
    document.getElementById(styleId)?.remove();

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @page {
        size: A4 ${printOrientation};
        margin: 9mm 10mm;
      }

      @media print {
        body {
          background: #ffffff !important;
        }

        #list-builder-print-area {
          width: 100% !important;
          max-width: none !important;
          overflow: visible !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }

        #list-builder-print-table {
          width: 100% !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
        }

        #list-builder-print-table caption {
          display: table-caption !important;
        }

        #list-builder-print-table thead {
          display: table-header-group !important;
        }

        #list-builder-print-table tr {
          break-inside: avoid;
        }

        #list-builder-print-table th,
        #list-builder-print-table td {
          overflow-wrap: anywhere;
          word-break: normal;
          font-size: ${selectedDefinitions.length >= 7 ? "7.2pt" : selectedDefinitions.length >= 5 ? "7.8pt" : "8.5pt"} !important;
          line-height: 1.15 !important;
        }
      }
    `;
    document.head.appendChild(style);

    window.setTimeout(() => window.print(), 60);
  };

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-hidden p-4 lg:p-5">
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-lg font-black text-slate-900">
            <ListChecks className="h-5 w-5 text-indigo-700" />
            Liste Oluştur
          </h1>
          <div className="mt-2 grid max-w-4xl gap-2 lg:grid-cols-[minmax(240px,0.8fr)_minmax(300px,1.2fr)_90px] lg:items-end">
            <label className="block">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-slate-400">
                Son 10 Liste
              </span>
              <select
                value={selectedSavedListId}
                onChange={(event) => loadSavedListTemplate(event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-black text-slate-800 outline-none focus:border-indigo-500"
              >
                <option value="">YENİ LİSTE OLUŞTUR</option>
                {savedLists.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-slate-400">
                Liste Başlığı
              </span>
              <input
                value={listTitle}
                onChange={(event) => {
                  setSelectedSavedListId("");
                  setListTitle(event.target.value.toLocaleUpperCase("tr-TR"));
                }}
                placeholder="LİSTE BAŞLIĞINI YAZINIZ"
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-black tracking-wide text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </label>

            <button
              type="button"
              onClick={saveCurrentListTemplate}
              className="h-10 rounded-xl bg-emerald-600 px-3 text-[10px] font-black text-white hover:bg-emerald-700"
            >
              Kaydet
            </button>
          </div>

          <p className="mt-2 text-[10px] font-bold text-slate-400">
            Sayfa her açıldığında temiz başlar. Kaydettiğiniz son 10 listeyi açılır menüden seçerek tüm sütun, filtre, kilit, sıralama ve özel öğrenci seçimlerini geri çağırabilirsiniz.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 print:hidden">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Temizle
          </button>

          <button
            type="button"
            disabled={selectedDefinitions.length === 0}
            onClick={() => void downloadExcel()}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-[10px] font-black text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Excel
          </button>

          <button
            type="button"
            disabled={selectedDefinitions.length === 0}
            onClick={() => setPdfOptionsOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rose-600 px-3 text-[10px] font-black text-white hover:bg-rose-700 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            PDF
          </button>

          <button
            type="button"
            disabled={selectedDefinitions.length === 0}
            onClick={printBrowser}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-700 px-3 text-[10px] font-black text-white hover:bg-indigo-800 disabled:opacity-40"
          >
            <Printer className="h-3.5 w-3.5" />
            Yazdır
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm print:hidden">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Özel Öğrenci Seçimi
            </div>
            <p className="mt-1 text-[9px] font-semibold text-slate-400">
              Bu alan isteğe bağlıdır. Öğrenci seçmezseniz mevcut sınıf/alan filtrelerine göre tüm öğrenciler listelenir. Belirli öğrencileri seçerseniz liste yalnızca seçtiklerinizden oluşur.
            </p>

            <div className="relative mt-2">
              <input
                value={studentPickerQuery}
                onChange={(event) => setStudentPickerQuery(event.target.value)}
                placeholder="Öğrenci no, ad soyad veya sınıf ile ara..."
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />

              {studentPickerQuery.trim() && (
                <div className="absolute left-0 right-0 top-[44px] z-40 max-h-64 overflow-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl">
                  {studentPickerResults.length === 0 ? (
                    <div className="px-3 py-4 text-center text-[10px] font-bold text-slate-400">
                      Öğrenci bulunamadı.
                    </div>
                  ) : (
                    studentPickerResults.map((student) => {
                      const id = String(student.id);
                      const checked = selectedStudentIds.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleStudentSelection(id)}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left ${
                            checked
                              ? "bg-amber-100 text-amber-950"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[10px] font-black">
                              {student.name}
                            </span>
                            <span className="mt-0.5 block text-[9px] font-semibold text-slate-400">
                              {student.id} · {student.classroom || "Sınıf yok"}
                            </span>
                          </span>
                          <span className="ml-3 text-[9px] font-black">
                            {checked ? "✓ SEÇİLDİ" : "+ EKLE"}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="w-full lg:w-[360px]">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Seçilen Öğrenciler
              </div>
              {selectedStudentIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedStudentIds([])}
                  className="text-[9px] font-black text-rose-600 hover:underline"
                >
                  Seçimi Temizle
                </button>
              )}
            </div>

            <div className="mt-2 flex min-h-10 max-h-28 flex-wrap gap-1 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
              {selectedStudents.length === 0 ? (
                <span className="text-[9px] font-semibold text-slate-400">
                  Özel öğrenci seçilmedi.
                </span>
              ) : (
                selectedStudents.map((student) => (
                  <button
                    key={String(student.id)}
                    type="button"
                    onClick={() => toggleStudentSelection(String(student.id))}
                    className="rounded-lg border border-amber-300 bg-amber-100 px-2 py-1 text-[8px] font-black text-amber-900"
                    title="Seçimden çıkar"
                  >
                    {student.name} ×
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8 print:hidden">
        {columns.map((column, index) => {
          const group = groups.find((candidate) => candidate.key === column.group);
          return (
            <div key={index} className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
              <div className="mb-2 text-center text-[9px] font-black uppercase tracking-wider text-slate-400">
                {index + 1}. Sütun
              </div>

              <select
                value={column.group}
                onChange={(event) => updateGroup(index, event.target.value as GroupKey | "")}
                className={`h-9 w-full rounded-lg border px-2 text-[10px] font-black outline-none focus:border-indigo-500 ${
                  column.group
                    ? "border-amber-400 bg-amber-100 text-amber-950"
                    : "border-slate-300 bg-white text-slate-800"
                }`}
              >
                <option value="">Bilgi seçiniz</option>
                {groups.map((candidate) => (
                  <option key={candidate.key} value={candidate.key}>
                    {candidate.label}
                  </option>
                ))}
              </select>

              <select
                value={column.field}
                onChange={(event) => updateField(index, event.target.value)}
                disabled={!group}
                className={`mt-2 h-9 w-full rounded-lg border px-2 text-[10px] font-bold outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
                  column.field
                    ? "border-amber-400 bg-amber-100 text-amber-950"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                <option value="">Alt bilgi seçiniz</option>
                {(group?.fields || [])
                  .filter(
                    (field) =>
                      field.key === column.field || !selectedFieldKeys.has(field.key),
                  )
                  .map((field) => {
                    const hasData = field.available ? field.available() : true;

                    return (
                      <option key={field.key} value={field.key} disabled={!hasData}>
                        {field.label}{hasData ? "" : " (Veri yok)"}
                      </option>
                    );
                  })}
              </select>

              <div className="mt-2 min-h-[66px] rounded-lg border border-dashed border-slate-200 bg-slate-50 p-2">
                {!column.field ? (
                  <div className="flex h-[48px] items-center justify-center text-center text-[9px] font-bold text-slate-400">
                    Alt bilgi seçimi bekleniyor
                  </div>
                ) : !hasThirdRowFilter(column) ? (
                  <div className="flex h-[48px] items-center justify-center text-center text-[9px] font-bold text-slate-400">
                    3. satır filtresi gerekmiyor
                  </div>
                ) : column.field === "classroom" ? (
                  <div>
                    <div className="mb-1.5 text-[8px] font-black uppercase tracking-wide text-slate-400">
                      Sınıf / Şube Filtresi
                    </div>
                    <div className="flex max-h-[72px] flex-wrap gap-1 overflow-y-auto">
                      {availableClassroomNames.map((classroomName) => {
                        const checked = column.filters.includes(classroomName);
                        return (
                          <label
                            key={classroomName}
                            className={`flex cursor-pointer items-center gap-1 rounded-md border px-1.5 py-1 text-[8px] font-black ${
                              checked
                                ? "border-amber-400 bg-amber-100 text-amber-900"
                                : "border-slate-200 bg-white text-slate-500"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                toggleThirdRowFilter(index, classroomName)
                              }
                              className="h-3 w-3 accent-amber-500"
                            />
                            {classroomName}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-1.5 text-[8px] font-black uppercase tracking-wide text-slate-400">
                      Alan / Grup Filtresi
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {groupFilterOptions.map((groupName) => {
                        const checked = column.filters.includes(groupName);
                        return (
                          <label
                            key={groupName}
                            className={`flex cursor-pointer items-center gap-1 rounded-md border px-1.5 py-1 text-[8px] font-black ${
                              checked
                                ? "border-amber-400 bg-amber-100 text-amber-900"
                                : "border-slate-200 bg-white text-slate-500"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                toggleThirdRowFilter(index, groupName)
                              }
                              className="h-3 w-3 accent-amber-500"
                            />
                            {groupName}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div
        id="list-builder-print-area"
        className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        {selectedDefinitions.length === 0 ? (
          <div className="grid h-full min-h-[360px] place-items-center p-8 text-center">
            <div>
              <FileText className="mx-auto h-12 w-12 text-slate-200" />
              <h2 className="mt-3 text-sm font-black text-slate-700">
                Liste sütunlarını seçiniz
              </h2>
              <p className="mt-2 text-xs font-semibold text-slate-400">
                Üstteki sekiz sütundan istediğiniz bilgi grubunu ve alt bilgiyi seçtiğinizde liste burada oluşur.
              </p>
            </div>
          </div>
        ) : (
          <table
            id="list-builder-print-table"
            className="w-full table-fixed border-collapse text-left"
          >
            <caption className="caption-top border-b border-slate-200 bg-white px-4 py-4 text-center">
              <div className="text-base font-black uppercase tracking-wide text-slate-950 print:text-[14pt]">
                {listTitle.trim() || "ÖĞRENCİ LİSTESİ"}
              </div>
              <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 print:hidden">
                {printOrientation === "portrait"
                  ? "A4 Dikey çıktı için uygun"
                  : "A4 Yatay çıktı otomatik kullanılacak"}
              </div>
            </caption>

            <colgroup>
              {sharedColumnLayout.screenPercentages.map((percentage, index) => (
                <col
                  key={`column-width-${index}`}
                  style={{ width: `${percentage}%` }}
                />
              ))}
            </colgroup>

            <thead className="sticky top-0 z-10 bg-slate-900 text-white print:static">
              <tr>
                <th className="border border-slate-700 px-1.5 py-2 text-center text-[9px] font-black">
                  SIRA
                </th>
                {selectedDefinitions.map(({ field }, index) => {
                  const activeSort = sortState?.fieldKey === field.key;
                  const locked = lockedFieldKeys.includes(field.key);

                  return (
                    <th
                      key={`${field.key}-${index}`}
                      className="border border-slate-700 p-0 text-[9px] font-black uppercase tracking-wide"
                    >
                      <div
                        className={`flex min-h-[34px] w-full items-stretch ${
                          activeSort
                            ? "bg-amber-300 text-slate-950"
                            : locked
                              ? "bg-indigo-700 text-white"
                              : "bg-slate-900 text-white"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleColumnSort(field.key)}
                          className="flex min-w-0 flex-1 items-center justify-between gap-1 px-2 py-2 text-left font-black uppercase tracking-wide transition hover:bg-black/10"
                          title={
                            activeSort
                              ? sortState.direction === "asc"
                                ? "Artan sıralama — tekrar tıklayınca azalan"
                                : "Azalan sıralama — tekrar tıklayınca artan"
                              : locked
                                ? "Kilitli grup içinde bu sütuna göre sırala"
                                : "Bu sütuna göre sırala"
                          }
                        >
                          <span className="min-w-0 whitespace-normal break-words">{field.label}</span>
                          <span className="shrink-0 text-[10px]">
                            {activeSort
                              ? sortState.direction === "asc"
                                ? "▲"
                                : "▼"
                              : "↕"}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleColumnLock(field.key)}
                          className={`flex w-8 shrink-0 items-center justify-center border-l transition hover:bg-black/10 ${
                            activeSort
                              ? "border-amber-500/60"
                              : "border-white/20"
                          }`}
                          title={
                            locked
                              ? "Sütun kilidini kaldır"
                              : "Sütunu grup olarak kilitle"
                          }
                          aria-label={
                            locked
                              ? `${field.label} kilidini kaldır`
                              : `${field.label} sütununu kilitle`
                          }
                        >
                          {locked ? (
                            <Lock className="h-3.5 w-3.5" />
                          ) : (
                            <LockOpen className="h-3.5 w-3.5 opacity-60" />
                          )}
                        </button>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {sortedStudentsForList.map((student, rowIndex) => (
                <tr
                  key={String(student.id)}
                  className={`border-t border-slate-200 text-[10px] ${
                    rowIndex % 2 === 0 ? "bg-white" : "bg-slate-100"
                  }`}
                >
                  <td className="border border-slate-200 px-1.5 py-2 text-center font-black text-slate-500">
                    {rowIndex + 1}
                  </td>
                  {selectedDefinitions.map(({ field }, columnIndex) => (
                    <td
                      key={`${student.id}-${field.key}-${columnIndex}`}
                      className="border border-slate-200 px-2 py-2 align-middle font-bold leading-tight text-slate-700 break-words"
                    >
                      {field.value(student) || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pdfOptionsOpen && (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm print:hidden"
          onClick={() => setPdfOptionsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="text-center">
              <h2 className="text-lg font-black text-slate-900">
                PDF Oluştur
              </h2>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                Listenin nasıl hazırlanacağını seçiniz.
              </p>
            </div>

            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={() => void downloadPdf("all")}
                className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-left transition hover:border-indigo-400 hover:bg-indigo-100"
              >
                <div className="text-sm font-black text-indigo-900">
                  Tüm Listeyi Yazdır
                </div>
                <div className="mt-1 text-[10px] font-semibold leading-4 text-indigo-600">
                  Ekrandaki mevcut sıralama, kilitler ve filtrelerle tüm liste tek PDF olarak hazırlanır.
                </div>
              </button>

              <button
                type="button"
                onClick={() => void downloadPdf("by-class")}
                className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left transition hover:border-emerald-400 hover:bg-emerald-100"
              >
                <div className="text-sm font-black text-emerald-900">
                  Sınıflara Göre Yazdır
                </div>
                <div className="mt-1 text-[10px] font-semibold leading-4 text-emerald-600">
                  Her sınıf ayrı bölümde hazırlanır. Liste başlığı her sınıfın üstünde yeniden yazılır.
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setPdfOptionsOpen(false)}
              className="mt-4 h-10 w-full rounded-xl bg-slate-100 text-xs font-black text-slate-700 hover:bg-slate-200"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
