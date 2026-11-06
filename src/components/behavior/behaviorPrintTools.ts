import { sqliteStorage } from "../../core/state/SyncStateStore";

const TUTANAK_SERIAL_STORAGE_KEY = "behavior_tutanak_serial_registry_v1";
const TUTANAK_NEXT_SERIAL_STORAGE_KEY = "behavior_tutanak_next_serial_v1";

type TutanakStudent = {
  id: string;
  name: string;
  classroom: string;
  number: string;
  behavior?: string;
  behaviorDate?: string;
  description?: string;
  repeatCount?: number;
  sourceRecordId?: string;
};

type ComplaintStudent = {
  id: string;
  name: string;
  classroom: string;
  number: string;
};

const getHeaderLines = () => {
  try {
    const profile = JSON.parse(sqliteStorage.getItem("school_info_a_profile") || "{}");
    const schoolInfo = JSON.parse(sqliteStorage.getItem("school_info") || "{}");
    const storedInstitutionLines = JSON.parse(sqliteStorage.getItem("school_inst_lines") || "[]");
    const institutionLines = Array.isArray(storedInstitutionLines) ? storedInstitutionLines : [];
    const savedSchoolName = sqliteStorage.getItem("schoolName") || "";
    const rawSchoolName =
      profile.officialName ||
      schoolInfo.name ||
      savedSchoolName ||
      profile.instLine3 ||
      institutionLines[2] ||
      "OKUL";
    const schoolName = String(rawSchoolName)
      .replace(/\s+M[ÜU]D[ÜU]RL[ÜU][ĞG][ÜU]\s*$/iu, "")
      .trim()
      .toLocaleUpperCase("tr-TR");

    return [
      profile.instLine1 || institutionLines[0] || "T.C.",
      profile.instLine2 || institutionLines[1] || "MİLLİ EĞİTİM BAKANLIĞI",
      `${schoolName} MÜDÜRLÜĞÜ`,
    ];
  } catch {
    return ["T.C.", "MİLLİ EĞİTİM BAKANLIĞI", "OKUL MÜDÜRLÜĞÜ"];
  }
};

const assignTutanakSerialNumbers = (
  students: TutanakStudent[],
): Array<TutanakStudent & { tutanakSerialNumber: number }> => {
  let registry: { nextNumber: number; assignments: Record<string, number> } = {
    nextNumber: Number(sqliteStorage.getItem(TUTANAK_NEXT_SERIAL_STORAGE_KEY)) || 1,
    assignments: {},
  };

  try {
    const storedRegistry = JSON.parse(sqliteStorage.getItem(TUTANAK_SERIAL_STORAGE_KEY) || "{}");
    const assignments = storedRegistry?.assignments && typeof storedRegistry.assignments === "object"
      ? storedRegistry.assignments
      : {};
    const usedNumbers = Object.values(assignments)
      .map(value => Number(value))
      .filter(value => Number.isInteger(value) && value > 0);
    const storedNextNumber = Number(sqliteStorage.getItem(TUTANAK_NEXT_SERIAL_STORAGE_KEY)) || 1;
    registry = {
      assignments,
      nextNumber: Math.max(Number(storedRegistry?.nextNumber) || 1, storedNextNumber, ...usedNumbers.map(value => value + 1), 1),
    };
  } catch {
    // Bozuk kayıt varsa sıra numarası sistemi güvenli biçimde 1'den başlatılır.
  }

  const numberedStudents = students.map(student => {
    const assignmentKey = `${student.sourceRecordId || `legacy-${student.id}-${student.behavior || "davranis"}`}::${student.id}`;
    if (!registry.assignments[assignmentKey]) {
      registry.assignments[assignmentKey] = registry.nextNumber;
      registry.nextNumber += 1;
    }
    return { ...student, tutanakSerialNumber: registry.assignments[assignmentKey] };
  });

  sqliteStorage.setItem(TUTANAK_SERIAL_STORAGE_KEY, JSON.stringify(registry));
  sqliteStorage.setItem(TUTANAK_NEXT_SERIAL_STORAGE_KEY, String(registry.nextNumber));
  return numberedStudents;
};

const openPrintWindow = (htmlContent: string) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Lütfen tarayıcınızda açılır pencerelere izin verin.");
    return;
  }
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
};


const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const formatBehaviorDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("tr-TR");
};

export const printBehaviorGroupNotification = ({
  students,
  behaviorName,
  behaviorType,
  behaviorDate,
  notificationDate,
  teachers,
}: {
  students: TutanakStudent[];
  behaviorName: string;
  behaviorType?: "Olumlu" | "Olumsuz" | "Gözlem";
  behaviorDate: string;
  notificationDate: string;
  teachers: string[];
}) => {
  if (students.length === 0) {
    alert("Lütfen tutanağa en az bir öğrenci ekleyin.");
    return;
  }
  if (teachers.length === 0) {
    alert("Davranış tebliğ tutanağı için en az bir öğretmen seçiniz.");
    return;
  }

  const behaviorDateText = formatBehaviorDate(behaviorDate);
  const notificationDateText = formatBehaviorDate(notificationDate);
  const headerHtml = getHeaderLines().map((line, index) => {
    const formatted = escapeHtml(line.trim().toLocaleUpperCase("tr-TR"));
    return '<h1 style="font-size: 13px; margin: 0 0 ' + (index === 0 ? '0px' : '4px') + ' 0; line-height: 1.1; color: #000000; font-weight: bold; font-family: Arial, sans-serif;">' + formatted + '</h1>';
  }).join("");

  const studentRows = students.map((student, index) => `
    <tr>
      <td class="center">${index + 1}</td>
      <td class="center">${escapeHtml(student.classroom)}</td>
      <td class="center">${escapeHtml(student.number)}</td>
      <td>${escapeHtml(student.name)}</td>
      <td>${escapeHtml(student.behavior || behaviorName || "")}</td>
      <td>${escapeHtml(student.description || "")}</td>
      <td class="center repeat-cell">${escapeHtml(student.repeatCount || 1)}</td>
      <td class="signature-cell"></td>
    </tr>
  `).join("");

  const teacherSignatures = teachers.map(teacher => `
    <div class="teacher-signature">
      <div class="signature-space"></div>
      <div class="teacher-name">${escapeHtml(teacher)}</div>
      <div class="teacher-role">Öğretmen</div>
    </div>
  `).join("");

  const shortNotice = `Aşağıda bilgileri bulunan öğrencilerin <strong>${escapeHtml(behaviorDateText)}</strong> tarihinde istenmeyen davranış gösterdikleri tespit edilmiştir. Konu öğrencilere bildirilmiş, benzer davranışların tekrarlanmaması gerektiği kendilerine tebliğ edilmiştir.`;

  openPrintWindow(`
    <html><head><title>Öğrenci Davranışı Bilgilendirme ve Tebliğ Tutanağı</title><style>
      @page { size: A4 landscape; margin: 12mm; }
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; margin: 0; color: #000; background: #fff; }
      .page { width: 100%; margin: 0 auto; }
      .official-header { text-align: center; margin-bottom: 16px; }
      .title { text-align: center; font-size: 15px; font-weight: 800; letter-spacing: .25px; margin: 0 0 16px; }
      .meta { display: grid; grid-template-columns: 82px 10px 1fr; row-gap: 5px; font-size: 11px; margin-bottom: 12px; }
      .meta-label { font-weight: 700; }
      .notice { font-size: 11.5px; line-height: 1.5; text-align: justify; margin: 0 0 10px; }
      .ack { font-size: 10.5px; line-height: 1.45; text-align: justify; margin: 0 0 10px; }
      .appeal-note { font-size: 10.5px; line-height: 1.4; font-weight: 800; margin: 9px 0 5px; }
      .section-title { font-size: 11px; font-weight: 800; margin: 8px 0 6px; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9.4px; }
      th, td { border: 1px solid #000; padding: 5px 4px; vertical-align: middle; }
      th { font-weight: 700; text-align: center; background: #f3f4f6; }
      td.center { text-align: center; }
      th:nth-child(1), td:nth-child(1) { width: 4%; }
      th:nth-child(2), td:nth-child(2) { width: 8%; }
      th:nth-child(3), td:nth-child(3) { width: 8%; }
      th:nth-child(4), td:nth-child(4) { width: 17%; }
      th:nth-child(5), td:nth-child(5) { width: 23%; }
      th:nth-child(6), td:nth-child(6) { width: 20%; }
      th:nth-child(7), td:nth-child(7) { width: 9%; }
      th:nth-child(8), td:nth-child(8) { width: 11%; }
      .repeat-cell { font-weight: 700; }
      .signature-cell { height: 30px; }
      .verification { font-size: 10.5px; line-height: 1.45; margin: 13px 0 7px; }
      .teacher-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px 24px; margin-top: 6px; }
      .teacher-signature { text-align: center; font-size: 10px; min-height: 64px; }
      .signature-space { height: 34px; }
      .teacher-name { font-weight: 700; border-top: 1px solid #000; padding-top: 4px; }
      .teacher-role { margin-top: 2px; }
    </style></head><body>
      <section class="page">
        <div class="official-header">${headerHtml}</div>
        <h2 class="title">ÖĞRENCİ DAVRANIŞI BİLGİLENDİRME VE TEBLİĞ TUTANAĞI</h2>
        <div class="meta">
          <span class="meta-label">Tarih</span><span>:</span><strong>${escapeHtml(notificationDateText)}</strong>
          <span class="meta-label">Konu</span><span>:</span><strong>İstenmeyen Davranışlar</strong>
        </div>
        <p class="notice">${shortNotice}</p>
        <p class="ack">Bu belge, öğrencilerin belirtilen davranış hakkında bilgilendirildiklerini ve tebliği aldıklarını kayıt altına almak amacıyla düzenlenmiştir. Öğrenci imzası yalnızca bilgilendirmenin kendisine yapıldığını gösterir.</p>
        <p class="appeal-note">AÇIKLAMA: Öğrenciler bu davranış kendilerine tebliği edildiğinde itiraz edebilirler. İtirazlar değerlendirilerek gün içinde değerlendirilir. İtiraz eden öğrenci imzalamaz.</p>
        <div class="section-title">TEBLİĞ EDİLEN ÖĞRENCİLER</div>
        <table>
          <thead><tr>
            <th>Sıra</th><th>Sınıf / Şube</th><th>Öğrenci No</th><th>Öğrencinin Adı Soyadı</th><th>Davranış</th><th>Açıklama</th><th>Davranış Tekrarı</th><th>Öğrenci İmzası</th>
          </tr></thead>
          <tbody>${studentRows}</tbody>
        </table>
        <p class="verification">Yukarıdaki davranış kayıtları ve öğrencilere yapılan bilgilendirme, aşağıda adı bulunan öğretmenler tarafından görülerek işbu tutanak imza altına alınmıştır.</p>
        <div class="teacher-grid">${teacherSignatures}</div>
      </section>
    </body></html>
  `);
};

export const printBehaviorIncidentReports = ({ students, date }: {
  students: TutanakStudent[];
  date: string;
}) => {
  if (students.length === 0) {
    alert("Lütfen tutanağa en az bir öğrenci ekleyin.");
    return;
  }

  const formattedDate = new Date(date).toLocaleDateString("tr-TR");
  const numberedTutanakStudents = assignTutanakSerialNumbers(students);
  const headerHtml = getHeaderLines().map((line, index) => {
    const formatted = line.trim().toLocaleUpperCase("tr-TR");
    return '<h1 style="font-size: 13px; margin: 0 0 ' + (index === 0 ? '0px' : '4px') + ' 0; line-height: 1.1; color: #000000; font-weight: bold; font-family: Arial, sans-serif;">' + formatted + '</h1>';
  }).join("");

  const tutanakPages = numberedTutanakStudents.map(student => `
    <section class="tutanak-page">
      <div class="official-header">${headerHtml}</div>
      <div class="title-row"><h2>DAVRANIŞ TESPİT TUTANAĞI</h2></div>
      <div class="info-block">
        <div class="info-row"><span class="info-label">Tutanak Sıra Numarası</span><span class="info-colon">:</span><strong>${String(student.tutanakSerialNumber).padStart(6, "0")}</strong></div>
        <div class="info-row"><span class="info-label">Düzenleme Tarihi</span><span class="info-colon">:</span><strong>${formattedDate}</strong></div>
        <div class="info-row"><span class="info-label">Sınıf / Şube</span><span class="info-colon">:</span><strong>${student.classroom}</strong></div>
        <div class="info-row"><span class="info-label">Okul Numarası</span><span class="info-colon">:</span><strong>${student.number}</strong></div>
        <div class="info-row"><span class="info-label">Öğrencinin Adı Soyadı</span><span class="info-colon">:</span><strong>${student.name}</strong></div>
        <div class="info-row behavior-row"><span class="info-label">Geliştirilmesi Gereken Davranış</span><span class="info-colon">:</span><strong>${student.behavior || "Belirtilmedi"}</strong></div>
      </div>
      <p class="statement">Yukarıda bilgileri bulunan öğrencinin okul yaşamına uyumunu, akademik ve sosyal gelişimini desteklemek amacıyla öğretmenlerin ders içi ve ders dışı gözlemleri ile okul ortamında yapılan rehberlik ve izleme çalışmaları değerlendirilmiştir. Bu süreçte geliştirilmesi gerektiği değerlendirilen davranışa ilişkin gözlem ve tespitler öğrenci bilgileri bölümünde belirtilmiştir. İşbu tutanak; öğrencinin gelişimini desteklemek, gerekli rehberlik çalışmalarını planlamak ve eğitim ortamının sağlıklı ve güvenli bir şekilde sürdürülmesine katkı sağlamak amacıyla düzenlenmiştir.</p>
      <div class="signature-section">
        <p class="signature-declaration">Bu belge kapsamında tarafıma gerekli bilgilendirme yapılmış olup, içeriğini okuduğumu ve süreç hakkında bilgi sahibi olduğumu beyan ederim.</p>
        <div class="student-acknowledgement">
          <div class="acknowledgement-row"><span>Öğrencinin Adı Soyadı</span><b>:</b><strong>${student.name}</strong></div>
          <div class="acknowledgement-row"><span>Sınıfı</span><b>:</b><strong>${student.classroom}</strong></div>
          <div class="acknowledgement-row"><span>Tarih</span><b>:</b><strong>${formattedDate}</strong></div>
          <div class="acknowledgement-row signature-row"><span>İmza</span><b>:</b><strong></strong></div>
        </div>
      </div>
    </section>
  `).join("");

  openPrintWindow(`
    <html><head><title>Davranış Tespit Tutanakları</title><style>
      @page { size: A4; margin: 18mm; } * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; margin: 0; color: #111827; line-height: 1.5; background: white; }
      .tutanak-page { max-width: 800px; min-height: 257mm; margin: 0 auto; break-after: page; page-break-after: always; position: relative; }
      .tutanak-page:last-child { break-after: auto; page-break-after: auto; } .official-header { text-align: center; margin-bottom: 26px; }
      .title-row { min-height: 56px; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; } .title-row h2 { font-size: 16px; letter-spacing: .7px; margin: 0; }
      .info-block { width: calc(100% - 2cm); margin: 0 0 26px 2cm; padding: 14px 18px; border-top: 4px solid #374151; background: #f9fafb; }
      .info-row { display: grid; grid-template-columns: 158px 12px minmax(0, 1fr); align-items: baseline; min-height: 31px; padding: 5px 0; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
      .info-row:last-child { border-bottom: 0; } .info-label { color: #374151; font-weight: bold; } .info-colon { color: #111827; font-weight: bold; text-align: center; }
      .info-row strong { color: #111827; font-size: 11px; } .behavior-row { align-items: start; min-height: 50px; } .behavior-row strong { line-height: 1.5; }
      .statement { margin: 0 0 34px; font-size: 12px; line-height: 1.75; text-align: justify; text-indent: 28px; }
      .signature-section { margin-top: 30px; padding-top: 13px; } .signature-declaration { margin: 0 0 24px; font-size: 11px; line-height: 1.65; text-align: justify; }
      .student-acknowledgement { width: 68%; margin-left: auto; } .acknowledgement-row { display: grid; grid-template-columns: 150px 12px minmax(0, 1fr); min-height: 27px; align-items: baseline; font-size: 11px; }
      .acknowledgement-row span { font-weight: bold; } .acknowledgement-row b { text-align: center; } .acknowledgement-row strong { font-weight: normal; } .signature-row { min-height: 58px; align-items: start; }
    </style></head><body>${tutanakPages}</body></html>
  `);
};

export const printBehaviorComplaint = ({ complainants, accused, description, date }: {
  complainants: ComplaintStudent[];
  accused: ComplaintStudent[];
  description: string;
  date: string;
}) => {
  if (complainants.length === 0) {
    alert("Lütfen en az bir şikayetçi öğrenci ekleyin.");
    return;
  }
  if (accused.length === 0) {
    alert("Lütfen en az bir şikayet edilen öğrenci ekleyin.");
    return;
  }

  const formattedDate = new Date(date).toLocaleDateString("tr-TR");
  const headerLines = getHeaderLines();
  const htmlContent = `
    <html><head><title>Şikayet Dilekçesi</title><style>
      body { font-family: Arial, sans-serif; padding: 50px; color: #000000; line-height: 1.6; background: white; }
      .header { text-align: center; margin-bottom: 30px; } .header h1 { font-size: 13px; margin: 0 0 4px 0; line-height: 1.2; font-weight: bold; }
      .date { text-align: right; font-weight: bold; font-size: 12px; margin-bottom: 25px; } .content { font-size: 13px; text-align: justify; text-indent: 40px; margin-bottom: 30px; }
      .signatures-title { font-weight: bold; font-size: 13px; margin-top: 40px; margin-bottom: 15px; } .signatures-box { display: flex; justify-content: flex-end; gap: 60px; margin-top: 10px; }
      .signature-item { text-align: center; min-width: 180px; } .signature-line { border-bottom: 1px solid #000000; width: 100%; height: 40px; margin-bottom: 6px; }
      .signature-name { font-size: 12px; font-weight: bold; } .signature-class { font-size: 11px; color: #333; }
    </style></head><body><div style="max-width: 800px; margin: 0 auto;">
      <div class="header">${headerLines.map(line => `<h1>${line.trim().toLocaleUpperCase("tr-TR")}</h1>`).join("")}</div>
      <div class="date">Tarih: ${formattedDate}</div>
      <p class="content">Okulumuz ${accused.map(std => `${std.classroom} sınıfı ${std.number || std.id} nolu öğrencisi ${std.name}`).join(", ")} hakkında ${description || "belirtilen olay"} dolayısıyla şikayetçiyim.</p>
      <p class="content">Söz konusu işlemlerin, Milli Eğitim Bakanlığı Ortaöğretim Kurumları Yönetmeliğinin değerlendirilerek gerekli incelemenin yapılması ve işleyişin düzenlenmesinin düzenlenmesi / disiplin işlemlerinin davranış hususlarını bilgilerinize saygılarımla arz ederim.</p>
      <div class="signatures-title" style="text-align: right; padding-right: 40px;">Şikayetçi Öğrenci / Öğrenciler (İmza):</div>
      <div class="signatures-box">${complainants.map(std => `<div class="signature-item"><div class="signature-line"></div><div class="signature-name">${std.name}</div><div class="signature-class">${std.classroom} - No: ${std.number || std.id}</div></div>`).join("")}</div>
    </div></body></html>
  `;
  openPrintWindow(htmlContent);
};
