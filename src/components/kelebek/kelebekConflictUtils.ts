export const getBaseClassroom = (label: string): string => {
  if (!label) return "";
  let clean = label.trim();
  const parenIndex = clean.indexOf("(");
  if (parenIndex !== -1) {
    clean = clean.substring(0, parenIndex).trim();
  }
  const dashSpaceIndex = clean.indexOf(" - ");
  if (dashSpaceIndex !== -1) {
    clean = clean.substring(0, dashSpaceIndex).trim();
  }
  return clean;
};

export const getNormalizedBaseClassroom = (label: string): string => {
  const base = getBaseClassroom(label);
  return base.replace(/[\s-]+/g, "").toLowerCase();
};

export const getTeacherForStudent = (studentClassroom: string, examCourseName: string, courses: any[]): string => {
  if (!studentClassroom || !examCourseName) return "Öğretmen Atanmadı";
  const studentClassNorm = getNormalizedBaseClassroom(studentClassroom);
  const studentClassExact = studentClassroom.trim().toLowerCase();
  
  // 1. Try EXACT classroom match AND exact base name
  let matchedCourse = courses.find(c => {
    const isExactClass = c.classroom && c.classroom.trim().toLowerCase() === studentClassExact;
    const courseBaseName = (c.name || "").trim().replace(/\s*\([^)]+\)$/, "").trim();
    return isExactClass && courseBaseName.toLowerCase() === examCourseName.toLowerCase();
  });

  // 2. Try Normalized classroom match AND exact base name
  if (!matchedCourse) {
    matchedCourse = courses.find(c => {
      const courseClassNorm = c.classroom ? getNormalizedBaseClassroom(c.classroom) : "";
      const courseBaseName = (c.name || "").trim().replace(/\s*\([^)]+\)$/, "").trim();
      return courseClassNorm === studentClassNorm && courseBaseName.toLowerCase() === examCourseName.toLowerCase();
    });
  }

  return matchedCourse?.teacherName || "Öğretmen Atanmadı";
};

export const doClassroomsConflict = (cls1: string, cls2: string): boolean => {
  if (!cls1 || !cls2) return false;
  
  const trim1 = cls1.trim();
  const trim2 = cls2.trim();
  
  if (trim1 === trim2) return true; // Exactly the same group or class
  
  const getBranchClass = (label: string): string => {
    let clean = label.trim();
    const parenIndex = clean.indexOf("(");
    if (parenIndex !== -1) {
      clean = clean.substring(0, parenIndex).trim();
    }
    return clean.replace(/[\s-]+/g, "").toLowerCase();
  };

  const branch1 = getBranchClass(trim1);
  const branch2 = getBranchClass(trim2);

  if (branch1 !== branch2) {
    return false; // Different classes (e.g. 12-A and 12-D), no conflict
  }

  // Same class branch (e.g., both "12a" or "12d"). Check if they have sub-group parenthesis
  const p1 = trim1.indexOf("(");
  const p2 = trim2.indexOf("(");

  const hasGroup1 = p1 !== -1;
  const hasGroup2 = p2 !== -1;

  if (!hasGroup1 || !hasGroup2) {
    // If one of them has no sub-group, it represents the whole class, which conflicts with any group/sub-group of the same class.
    return true;
  }

  const normalizeGroup = (g: string): string => {
    let clean = g
      .replace(/ı/g, "i")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(/[\s-_/]+/g, "")
      .trim()
      .toLowerCase();

    if (clean === "say" || clean === "sayisal" || clean === "fen") {
      return "say";
    }
    if (clean === "ea" || clean === "esitagirlik") {
      return "ea";
    }
    if (clean === "soz" || clean === "sozel") {
      return "soz";
    }
    if (clean === "dil" || clean === "yabancidil" || clean === "ydil") {
      return "dil";
    }
    if (clean === "ortak" || clean === "genel" || clean === "tum") {
      return ""; // Treat as whole class (empty string)
    }
    return clean;
  };

  // Both have parenthesis (e.g. "12-D (SÖZ)" and "12-D (SAY)")
  let rawGroup1 = trim1.substring(p1 + 1);
  const closing1 = rawGroup1.indexOf(")");
  if (closing1 !== -1) rawGroup1 = rawGroup1.substring(0, closing1);

  let rawGroup2 = trim2.substring(p2 + 1);
  const closing2 = rawGroup2.indexOf(")");
  if (closing2 !== -1) rawGroup2 = rawGroup2.substring(0, closing2);

  const group1 = normalizeGroup(rawGroup1);
  const group2 = normalizeGroup(rawGroup2);

  if (!group1 || !group2) {
    return true; // One of them normalized to whole class (empty/ortak/genel)
  }

  if (group1 === group2) {
    return true; // Same group
  }

  // Handle overlapping groups like "say/ea" or "ea/soz"
  if (group1.includes(group2) || group2.includes(group1)) {
    return true;
  }

  return false; // Disjoint student groups of the same class, no conflict!
};

export const doExamsConflict = (exam1: any, exam2: any): boolean => {
  if (!exam1 || !exam2) return false;
  const classrooms1 = exam1.classrooms || [];
  const classrooms2 = exam2.classrooms || [];

  for (const cls1 of classrooms1) {
    for (const cls2 of classrooms2) {
      // 1. Direct classroom conflict (e.g., same group or overlapping whole class)
      if (doClassroomsConflict(cls1, cls2)) {
        return true;
      }

      // 2. Compulsory course conflict: If either exam is compulsory, and they share the same base classroom,
      // then they conflict because that class or group cannot have another exam.
      if (exam1.isCompulsory || exam2.isCompulsory) {
        const base1 = getNormalizedBaseClassroom(cls1);
        const base2 = getNormalizedBaseClassroom(cls2);
        if (base1 && base2 && base1 === base2) {
          return true;
        }
      }
    }
  }

  return false;
};

