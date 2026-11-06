import type { BehaviorRecord } from "../behavior/behaviorTypes";
// Discipline document/print helpers extracted from DisciplineModule.
// Keeps print rendering isolated while preserving existing behavior.
export function createDisciplineDocumentTools(deps: any) {
  const {
    classrooms, teachers, getHeaderLines, getRecordStudents, formatHeaderLine,
    getPrincipalName, getBehaviorDetails, printHtmlSafely, boardRecords, selectedRecordIdsForTutanak,
    tutanakStudents, tutanakDate, tutanakTeachers
  } = deps;

  const getClassroomGuidanceNames = (classroomName: string) => {
    const normalizeClassroom = (value: any) =>
      String(value || "")
        .trim()
        .toLocaleUpperCase("tr-TR")
        .replace(/[\s\-_/]+/g, "");
    const classroom = classrooms.find(
      (item) =>
        normalizeClassroom(item?.name || item?.classroom) ===
        normalizeClassroom(classroomName),
    );
    const advisorTeacher =
      teachers.find((teacher) => String(teacher?.id) === String(classroom?.advisorTeacherId))?.name ||
      classroom?.advisorTeacherName ||
      "";
    const counselorTeacher =
      teachers.find((teacher) => String(teacher?.id) === String(classroom?.counselorTeacherId))?.name ||
      classroom?.counselorTeacherName ||
      "";

    return {
      advisorTeacher: String(advisorTeacher || "").trim(),
      counselorTeacher: String(counselorTeacher || "").trim(),
    };
  };

  const getWarningLetterHTML = (warning: BehaviorRecord): string => {
    const headerLines = getHeaderLines();
    const recStudents = getRecordStudents(warning);
    
    let htmlContent = "";
    recStudents.forEach((std, index) => {
      const { advisorTeacher, counselorTeacher } = getClassroomGuidanceNames(std.classroom);
      const behaviorDetails = typeof getBehaviorDetails === "function"
        ? getBehaviorDetails(warning.behaviorName)
        : { regulationName: "Milli Eğitim Bakanlığı Ortaöğretim Kurumları Yönetmeliği", article: "164", paragraph: "", content: warning.behaviorName };
      const regulationArticle = [behaviorDetails?.article, behaviorDetails?.paragraph].filter(Boolean).join(" / ");
      const fullRegulationText = String(behaviorDetails?.content || warning.behaviorName || "").trim();
      const pageBreak = index < recStudents.length - 1 ? '<div style="page-break-after: always;"></div>' : '';
      htmlContent += `
      <div style="font-family: Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; background: white; max-width: 800px; margin: 0 auto; font-size: 12pt;">
        <div style="text-align: center; margin-bottom: 30px; padding-bottom: 10px;">
          ${headerLines.map(line => {
            const formatted = formatHeaderLine(line);
            const isTC = formatted === "T.C.";
            return `<h1 style="font-size: 12pt; margin: 0 0 ${isTC ? '1px' : '4px'} 0; line-height: 1.1; color: #0f172a; font-weight: bold; font-family: Arial, sans-serif;">${formatted}</h1>`;
          }).join("")}
        </div>

        <h2 style="font-size: 14pt; margin: 0 0 28px 0; text-align: center; color: #0f172a; font-weight: bold; text-decoration: underline;">YAZILI UYARI</h2>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 26px; font-size: 11pt;">
          <tbody>
            <tr>
              <th style="padding: 8px; text-align: left; background-color: #f8fafc; width: 35%; font-weight: bold;">Öğrenci Adı Soyadı</th>
              <td style="padding: 8px; text-align: left;">${std.name}</td>
            </tr>
            <tr>
              <th style="padding: 8px; text-align: left; background-color: #f8fafc; font-weight: bold;">Sınıfı / Okul Numarası</th>
              <td style="padding: 8px; text-align: left;">${std.classroom} / ${std.number}</td>
            </tr>
            <tr>
              <th style="padding: 8px; text-align: left; background-color: #f8fafc; font-weight: bold;">Sergilenen Davranış</th>
              <td style="padding: 8px; text-align: left;">${warning.behaviorName}</td>
            </tr>
            <tr>
              <th style="padding: 8px; text-align: left; background-color: #f8fafc; font-weight: bold;">Yönetmelik Maddesi</th>
              <td style="padding: 8px; text-align: left;"><b>${behaviorDetails?.regulationName || "Milli Eğitim Bakanlığı Ortaöğretim Kurumları Yönetmeliği"}</b>${regulationArticle ? ` · ${regulationArticle}` : ""}<br/><span style="display:block; margin-top:6px; line-height:1.5;">${fullRegulationText}</span></td>
            </tr>
            <tr>
              <th style="padding: 8px; text-align: left; background-color: #f8fafc; font-weight: bold;">Açıklama / Detaylar</th>
              <td style="padding: 8px; text-align: left; font-style: italic;">${warning.description || "Belirtilmemiş."}</td>
            </tr>
            <tr>
              <th style="padding: 8px; text-align: left; background-color: #f8fafc; font-weight: bold;">Karar / İşlem Türü</th>
              <td style="padding: 8px; text-align: left; color: #000000;">
                Yazılı Uyarı
              </td>
            </tr>
          </tbody>
        </table>

        <div style="font-size: 11.5pt; text-align: justify; color: #111827; line-height: 1.55;">
          <p style="text-indent: 28px; margin: 0 0 12px 0;">Yapılan inceleme ve görüşmeler sonucunda, öğrencinin <b>${new Date(warning.date).toLocaleDateString("tr-TR")}</b> tarihinde <b>${warning.behaviorName}</b> şeklinde davranışta bulunduğu belirlenmiştir.</p>
          <p style="text-indent: 28px; margin: 0 0 12px 0;">Söz konusu davranış, <b>${behaviorDetails?.regulationName || "Millî Eğitim Bakanlığı Ortaöğretim Kurumları Yönetmeliği"}</b>${regulationArticle ? ` (${regulationArticle})` : ""} kapsamında değerlendirilmiştir. Yönetmelik maddesinin tam metni yukarıda gösterilmiştir.</p>
          <p style="text-indent: 28px; margin: 0 0 12px 0;">Ancak öğrencinin daha önce herhangi bir disiplin cezası almamış olması ve kınama cezasını gerektiren bir davranışı ilk defa gerçekleştirmesi nedeniyle; sınıf/şube rehber öğretmeni ile rehber öğretmenin değerlendirme ve önerileri dikkate alınarak öğrenciye kınama cezası yerine yazılı uyarı yapılmasına karar verilmiştir.</p>
          <p style="text-indent: 28px; margin: 0 0 12px 0;">Öğrencinin davranışının yanlışlığını fark etmesi, benzer davranışlardan kaçınması, okul kurallarına uyması ve <b>${warning.behaviorName}</b> davranışını tekrar göstermemesi beklenmektedir.</p>
          <p style="text-indent: 28px; margin: 0 0 12px 0;">Öğrenciye, olumsuz davranışlarının devam etmesi hâlinde velisinin okula davet edileceği; kınama cezasını gerektiren ikinci bir davranışta bulunması hâlinde ise doğrudan Okul Öğrenci Ödül ve Disiplin Kuruluna gönderileceği bildirilmiştir.</p>
          <p style="text-indent: 28px; margin: 0 0 12px 0;">İşbu yazılı uyarı öğrenciye okunmuş, gerekli açıklamalar yapılmış ve tebliğ edilmiştir.</p>
          <p style="margin: 18px 0 0 0;"><b>Tebliğ Tarihi:</b> …… / …… / …………</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 42px; page-break-inside: avoid;">
          <div style="text-align: center;">
            <div style="height: 30px; border-bottom: 1px dotted #64748b; margin-bottom: 6px;">${std.name}</div>
            <div style="font-weight: bold;">Öğrenci</div>
          </div>
          <div style="text-align: center;">
            <div style="height: 30px; border-bottom: 1px dotted #64748b; margin-bottom: 6px;">${advisorTeacher}</div>
            <div style="font-weight: bold;">Sınıf/Şube Rehber Öğretmeni</div>
          </div>
          <div style="text-align: center;">
            <div style="height: 30px; border-bottom: 1px dotted #64748b; margin-bottom: 6px;">${counselorTeacher}</div>
            <div style="font-weight: bold;">Rehber Öğretmen</div>
          </div>
          <div style="text-align: center;">
            <div style="height: 30px; border-bottom: 1px dotted #64748b; margin-bottom: 6px;">${getPrincipalName()}</div>
            <div style="font-weight: bold;">Okul Müdürü</div>
          </div>
        </div>
      </div>
      ${pageBreak}
      `;
    });
    return htmlContent;
  };

  const printLetter = (warning: BehaviorRecord) => {
    const htmlContent = getWarningLetterHTML(warning);
    printHtmlSafely(htmlContent, "@page { margin: 0; }");
  };

  const handlePrintSevkYazisi = (singleRecord?: BehaviorRecord) => {
    const selectedRecords = singleRecord 
      ? [singleRecord]
      : boardRecords.filter(r => selectedRecordIdsForTutanak.includes(r.id));
    
    if (selectedRecords.length === 0) {
      alert("Lütfen sevk yazısı oluşturmak için listeden en az bir öğrenci seçin (öğrencinin yanındaki Tutanak seçim kutucuğunu kullanın).");
      return;
    }

    const formattedDate = new Date().toLocaleDateString("tr-TR");
    const headerLines = getHeaderLines();
    const principalName = getPrincipalName();

    let printSection = document.getElementById("print-section");
    if (!printSection) {
      printSection = document.createElement("div");
      printSection.id = "print-section";
      document.body.appendChild(printSection);
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 40px; color: #000000; line-height: 1.6; background: white; font-size: 12pt;">
        <div style="max-width: 800px; margin: 0 auto;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 35px;">
            ${headerLines.map((line, index) => {
              const formatted = formatHeaderLine(line);
              const isTC = index === 0;
              return '<h1 style="font-size: 12pt; margin: 0 0 ' + (isTC ? '1px' : '4px') + ' 0; line-height: 1.1; color: #000000; font-weight: bold; font-family: Arial, sans-serif;">' + formatted + '</h1>';
            }).join("")}
          </div>

          <!-- Sayı / Konu / Tarih -->
          <div style="display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 12pt;">
            <div>
              <div><b>Sayı:</b> E-70494665-208.01-</div>
              <div><b>Konu:</b> Ödül ve Disiplin Kurulu Sevk İşlemi</div>
            </div>
            <div style="text-align: right;">
              <b>Tarih:</b> ${formattedDate}
            </div>
          </div>

          <!-- Muhatap -->
          <div style="text-align: center; margin-top: 20px; margin-bottom: 25px; font-weight: bold; font-size: 12pt;">
            ÖDÜL VE DİSİPLİN KURULU BAŞKANLIĞINA
          </div>

          <!-- İçerik -->
          <p style="font-size: 12pt; text-align: justify; text-indent: 30px; margin-bottom: 20px;">
            Okulumuz öğrencilerinden aşağıda bilgileri bulunan öğrencilerin sergilemiş oldukları olumsuz davranışlar nedeniyle, Milli Eğitim Bakanlığı Ortaöğretim Kurumları Yönetmeliği'nin ilgili ödül ve disiplin hükümleri uyarınca Ödül ve Disiplin Kurulu'na sevk edilmesi uygun görülmüştür.
          </p>

          <p style="font-size: 12pt; text-align: justify; text-indent: 30px; margin-bottom: 30px;">
            Gerekli inceleme ve değerlendirmenin yapılarak kurul kararının müdürlüğümüze bildirilmesini rica ederim.
          </p>

          <!-- Okul Müdürü İmza -->
          <div style="display: flex; justify-content: flex-end; margin-bottom: 40px;">
            <div style="text-align: center; width: 250px;">
              <div style="font-size: 12pt; font-weight: bold;">${principalName}</div>
              <div style="font-size: 12pt; color: #475569; margin-top: 2px;">Okul Müdürü</div>
              <div style="border-bottom: 1px dotted #000000; width: 100%; height: 35px; margin-top: 5px;"></div>
              <span style="font-size: 10px; color: #64748b;">İmza</span>
            </div>
          </div>

          <!-- Öğrenci Bilgileri Başlığı -->
          <div style="font-size: 12pt; font-weight: bold; text-decoration: underline; margin-bottom: 10px;">
            SEVK EDİLEN ÖĞRENCİ LİSTESİ:
          </div>

          <!-- Table -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 30px; font-size: 12pt;">
            <thead>
              <tr>
                <th style="padding: 8px 12px; background-color: #f8fafc; text-align: left; width: 15%;">Sınıfı</th>
                <th style="padding: 8px 12px; background-color: #f8fafc; text-align: left; width: 20%;">Öğrenci No</th>
                <th style="padding: 8px 12px; background-color: #f8fafc; text-align: left; width: 30%;">Adı Soyadı</th>
                <th style="padding: 8px 12px; background-color: #f8fafc; text-align: left; width: 35%;">Sevk Nedeni / Davranış</th>
              </tr>
            </thead>
            <tbody>
              ${selectedRecords.flatMap(record => {
                const recStds = getRecordStudents(record);
                return recStds.map(std => `
                  <tr>
                    <td style="padding: 8px 12px;">${std.classroom || "Belirtilmedi"}</td>
                    <td style="padding: 8px 12px;">${std.number || "Belirtilmedi"}</td>
                    <td style="padding: 8px 12px;"><b>${std.name}</b></td>
                    <td style="padding: 8px 12px;">${record.behaviorName || record.boardReason || "Belirtilmedi"}</td>
                  </tr>
                `);
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    printHtmlSafely(htmlContent, "@page { size: A4 portrait; margin: 15mm; }");
  };

  const handlePrintTutanak = () => {
    if (tutanakStudents.length === 0) {
      alert("Lütfen tutanağa en az bir öğrenci ekleyin.");
      return;
    }

    const printSection = document.createElement("div");
    printSection.id = "print-section";
    
    const formattedDate = new Date(tutanakDate).toLocaleDateString("tr-TR");
    const headerLines = getHeaderLines();

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 40px; color: #000000; line-height: 1.5; background: white; max-width: 800px; margin: 0 auto; font-size: 12pt;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 25px;">
          ${headerLines.map((line) => {
            const formatted = formatHeaderLine(line);
            const isTC = formatted === "T.C.";
            return '<h1 style="font-size: 12pt; margin: 0 0 ' + (isTC ? '1px' : '4px') + ' 0; line-height: 1.1; color: #000000; font-weight: bold; font-family: Arial, sans-serif;">' + formatted + '</h1>';
          }).join("")}
        </div>

        <!-- Date & Title Row -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; margin-bottom: 25px;">
          <div style="width: 30%;"></div>
          <h2 style="font-size: 14pt; text-align: center; font-weight: bold; margin: 0; text-decoration: underline; flex: 1;">DAVRANIŞ TESPİT TUTANAĞI</h2>
          <div style="font-size: 12pt; font-weight: bold; width: 30%; text-align: right;">
            Tarih: ${formattedDate}
          </div>
        </div>

        <!-- Statement / Body -->
        <p style="font-size: 12pt; text-align: justify; text-indent: 30px; margin-bottom: 20px;">
          Okulumuz bünyesinde eğitim öğretim saatleri ile ara dinlenme zamanlarında gerçekleştirilen nöbet görevi esnasında, aşağıda sınıfı, okul numarası, adı soyadı belirtilen öğrencilerin yanlarında yazılı bulunan kurallara aykırı ve disiplini bozucu davranışları gösterdikleri yerinde tespit edilmiş olup; durum işbu tutanak ile imza altına alınmıştır.
        </p>

        <!-- Students Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px; font-size: 12pt;">
          <thead>
            <tr style="background-color: #f1f5f9;">
              <th style="padding: 8px 12px; text-align: center; font-weight: bold; width: 15%;">Sınıfı</th>
              <th style="padding: 8px 12px; text-align: center; font-weight: bold; width: 25%;">Öğrenci No</th>
              <th style="padding: 8px 12px; text-align: left; font-weight: bold; width: 60%;">Adı Soyadı</th>
            </tr>
          </thead>
          <tbody>
            ${tutanakStudents.map(student => {
              return '<tr>' +
                '<td style="padding: 8px 12px; text-align: center;">' + student.classroom + '</td>' +
                '<td style="padding: 8px 12px; text-align: center;">' + student.number + '</td>' +
                '<td style="padding: 8px 12px; text-align: left; font-weight: bold;">' + student.name + '</td>' +
              '</tr>';
            }).join("")}
          </tbody>
        </table>

        <!-- Signatures Box -->
        <div style="margin-top: 40px;">
          <p style="font-size: 12pt; font-weight: bold; margin-bottom: 25px;">Tutanak Düzenleyen Nöbetçi Öğretmenler:</p>
          <div style="display: flex; flex-wrap: wrap; justify-content: flex-start; gap: 40px 10%;">
            ${tutanakTeachers.length === 0 ? `
              <div style="width: 26%; text-align: center;">
                <div style="font-size: 12pt; font-weight: bold; margin-bottom: 5px;">Nöbetçi Öğretmen</div>
                <div style="border-bottom: 1px dotted #000000; width: 100%; height: 35px; margin-bottom: 5px;"></div>
                <span style="font-size: 11px; color: #475569;">İmza</span>
              </div>
            ` : tutanakTeachers.map(teacher => {
              return '<div style="width: 26%; text-align: center; min-width: 150px;">' +
                '<div style="font-size: 12pt; font-weight: bold; margin-bottom: 2px;">' + teacher + '</div>' +
                '<div style="font-size: 12pt; color: #475569; margin-bottom: 8px;">Nöbetçi Öğretmen</div>' +
                '<div style="border-bottom: 1px dotted #000000; width: 100%; height: 35px; margin-bottom: 5px;"></div>' +
                '<span style="font-size: 11px; color: #475569; display: block;">İmza</span>' +
              '</div>';
            }).join("")}
          </div>
        </div>
      </div>
    `;

    printHtmlSafely(htmlContent, "@page { size: A4 portrait; margin: 15mm; }");
  };

  return { getClassroomGuidanceNames, getWarningLetterHTML, printLetter, handlePrintSevkYazisi, handlePrintTutanak };
}

