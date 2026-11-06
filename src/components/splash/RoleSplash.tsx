import React from "react";
import { BriefcaseBusiness, GraduationCap, Presentation, UsersRound } from "lucide-react";
import enstituLogo from "../../assets/splash/enstitu-logo.png";
import schoolLogo from "../../assets/splash/ordu-lisesi-logo.png";
import adminPhoto from "../../assets/splash/splash-admin.jpg";
import teacherPhoto from "../../assets/splash/splash-teacher.jpg";
import studentPhoto from "../../assets/splash/splash-student.jpg";
import parentPhoto from "../../assets/splash/splash-parent.jpg";
import "./role-splash.css";

type SplashRole = "admin" | "teacher" | "student" | "parent";

type Props = {
  role: SplashRole;
  name?: string;
  children: React.ReactNode;
};

const config = {
  admin: {
    label: "YÖNETİCİ",
    photo: adminPhoto,
    tone: "admin",
    Icon: BriefcaseBusiness,
    greeting: (name: string) => `Sayın ${name},`,
    line: "iyi çalışmalar.",
    subline: "Okulunuzun tüm süreçleri burada.",
  },
  teacher: {
    label: "ÖĞRETMEN",
    photo: teacherPhoto,
    tone: "teacher",
    Icon: Presentation,
    greeting: (name: string) => `Sayın ${name},`,
    line: "iyi çalışmalar dileriz.",
    subline: "Eğitimin gücü sizinle başlar.",
  },
  student: {
    label: "ÖĞRENCİ",
    photo: studentPhoto,
    tone: "student",
    Icon: GraduationCap,
    greeting: (name: string) => `Sevgili ${name},`,
    line: "hoş geldin.",
    subline: "Başarı yolculuğun burada.",
  },
  parent: {
    label: "VELİ",
    photo: parentPhoto,
    tone: "parent",
    Icon: UsersRound,
    greeting: (name: string) => `Sayın ${name},`,
    line: "hoş geldiniz.",
    subline: "Başarıyı birlikte büyütüyoruz.",
  },
} as const;

const cleanName = (name?: string, role?: SplashRole) => {
  const value = String(name || "").trim();
  if (value) return value;
  return role === "student" ? "Öğrenci" : role === "parent" ? "Veli" : role === "teacher" ? "Öğretmen" : "Yönetici";
};

export default function RoleSplash({ role, name, children }: Props) {
  const [visible, setVisible] = React.useState(true);
  const [done, setDone] = React.useState(false);
  const item = config[role];
  const displayName = cleanName(name, role);
  const RoleIcon = item.Icon;

  React.useEffect(() => {
    const fadeTimer = window.setTimeout(() => setVisible(false), 2850);
    const doneTimer = window.setTimeout(() => setDone(true), 3300);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [role]);

  if (done) return <>{children}</>;

  return (
    <div className={`role-splash ${visible ? "is-visible" : "is-leaving"}`} aria-label="e-Nstitü açılış ekranı">
      <div className={`role-splash-card ${item.tone}`}>
        <div className="role-splash-brand">
          <img className="role-splash-enstitu" src={enstituLogo} alt="e-Nstitü" />
        </div>

        <div className="role-splash-photo-wrap">
          <img className="role-splash-photo" src={item.photo} alt="" />
          <div className="role-splash-photo-shade" />
        </div>

        <section className={`role-splash-panel ${item.tone}`}>
          <div className="role-splash-role-icon" aria-hidden="true"><RoleIcon /></div>
          <div className="role-splash-role">{item.label}</div>
          <div className="role-splash-divider" />

          <div className="role-splash-greeting">
            <strong>{item.greeting(displayName)}</strong>
            <span>{item.line}</span>
          </div>
          <p>{item.subline}</p>

          <div className="role-splash-progress" aria-hidden="true"><span /></div>
          <div className="role-splash-loading">Uygulama hazırlanıyor...</div>

          <div className="role-splash-school">
            <img src={schoolLogo} alt="Ordu Lisesi" />
            <div>
              <strong>Ordu Lisesi</strong>
              <span>Ordu'nun taa kendisi</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
