import React, { useEffect } from "react";
import { UserRound, Presentation } from "lucide-react";
import type { PanelUser } from "../lib/accessControl";
import adminPhoto from "../assets/splash/mobile-role-1.jpg";
import teacherPhoto from "../assets/splash/teacher-splash-pair.jpg";
import studentPhoto from "../assets/splash/mobile-role-3.jpg";
import parentPhoto from "../assets/splash/mobile-role-4.jpg";
import enstituLogo from "../assets/splash/enstitu-logo.png";
import schoolLogo from "../assets/splash/ordu-lisesi-logo.png";
import "../styles/mobile-role-splash.css";

type Props = { user: PanelUser; onFinished: () => void };

type Theme = {
  role: string;
  greeting: string;
  sub: string;
  photo: string;
  icon: React.ReactNode;
  accent: string;
  panel: string;
};

const getTheme = (user: PanelUser): Theme => {
  if (user.role === "teacher") {
    return {
      role: "ÖĞRETMEN",
      greeting: `Sayın ${user.fullName},\niyi çalışmalar.`,
      sub: "Geleceği birlikte inşa ediyoruz.",
      photo: teacherPhoto,
      icon: <Presentation size={42} strokeWidth={1.8} />,
      accent: "#69efb1",
      panel: "linear-gradient(180deg,#149c61 0%,#087c59 48%,#005746 100%)",
    };
  }
  if (user.role === "super_admin") {
    return {
      role: "YÖNETİCİ",
      greeting: "Sayın Koray UÇAR,\niyi çalışmalar.",
      sub: "Okulunuzun tüm süreçleri burada.",
      photo: adminPhoto,
      icon: <UserRound size={42} strokeWidth={1.8} />,
      accent: "#57d7ff",
      panel: "linear-gradient(180deg,#0866bd 0%,#063b79 100%)",
    };
  }
  return {
    role: "YÖNETİCİ",
    greeting: "Sayın Koray UÇAR,\niyi çalışmalar.",
    sub: "Okulunuzun tüm süreçleri burada.",
    photo: adminPhoto,
    icon: <UserRound size={42} strokeWidth={1.8} />,
    accent: "#57d7ff",
    panel: "linear-gradient(180deg,#0866bd 0%,#063b79 100%)",
  };
};

export default function MobileRoleSplash({ user, onFinished }: Props) {
  const theme = getTheme(user);
  const isStudentLike = user.role === "teacher" ? false : false;
  void isStudentLike;

  useEffect(() => {
    const images = [adminPhoto, teacherPhoto, studentPhoto, parentPhoto, enstituLogo, schoolLogo];
    images.forEach((src) => { const image = new Image(); image.src = src; });
    const timer = window.setTimeout(onFinished, 6500);
    return () => window.clearTimeout(timer);
  }, [onFinished]);

  return (
    <main className="mobile-role-splash" style={{ "--panel": theme.panel, "--accent": theme.accent } as React.CSSProperties}>
      <div className={`mobile-role-top ${user.role === "teacher" ? "is-teacher" : ""}`}>
        <img className="mobile-role-enstitu" src={enstituLogo} alt="e-Nstitü" />
        <div className="mobile-role-slogan">Kökü<br />Eğitimde<br />Gücü<br />Gelecekte</div>
      </div>

      <div className="mobile-role-photo-wrap">
        <img className="mobile-role-photo" src={theme.photo} alt="" />
      </div>

      <section className="mobile-role-panel">
        <div className="mobile-role-wave mobile-role-wave-back" />
        <div className="mobile-role-wave mobile-role-wave-front" />
        <div className="mobile-role-content">
          <div className="mobile-role-badge">{theme.icon}</div>
          <div className="mobile-role-title">{theme.role}</div>
          <div className="mobile-role-divider" />
          <div className="mobile-role-greeting">{theme.greeting.split("\n").map((line, index) => <React.Fragment key={line}>{index > 0 && <br />}{line}</React.Fragment>)}</div>
          <div className="mobile-role-sub">{theme.sub}</div>
          <div className="mobile-role-progress"><span /></div>
          <div className="mobile-role-loading">Uygulama hazırlanıyor...</div>
          <div className="mobile-role-school">
            <img src={schoolLogo} alt="Ordu Lisesi" />
            <div className="mobile-role-school-copy"><strong>Ordu Lisesi</strong><span>Ordu'nun taa kendisi</span></div>
          </div>
        </div>
      </section>
    </main>
  );
}
