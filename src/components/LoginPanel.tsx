import React, { useState } from "react";
import { ArrowRight, Building2, Eye, EyeOff, Loader2, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { AccessControlState, PanelUser } from "../lib/accessControl";
import { firebaseAuthSession } from "../core/auth";
import campusVisual from "../assets/enstitu-login-campus.png";
import "../styles/enstitu-login-original.css";

interface LoginPanelProps {
  accessState: AccessControlState;
  onLogin: (user: PanelUser, sessionToken: string, accessState: AccessControlState) => void;
}

type LoginFieldProps = {
  icon: React.ReactNode;
  title: string;
  tone: "orange" | "blue" | "green";
  children: React.ReactNode;
};

export default function LoginPanel({ accessState, onLogin }: LoginPanelProps) {
  void accessState;
  const [schoolCode, setSchoolCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolCode, identifier: username, password, rememberMe }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Giriş yapılamadı.");
        return;
      }
      await firebaseAuthSession.connect(data.user?.email || "", password);
      onLogin(data.user, data.sessionToken, data.accessState);
    } catch {
      setError("Giriş sunucusuna ulaşılamadı.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="enstitu-original-page">
      <section className="enstitu-login-shell">
        <aside className="enstitu-campus-side" aria-label="Ordu Lisesi e-Nstitü tanıtım alanı">
          <img src={campusVisual} alt="Ordu Lisesi ve e-Nstitü tanıtım görseli" />
        </aside>

        <div className="enstitu-login-side">
          <div className="enstitu-deco enstitu-deco-one" />
          <div className="enstitu-deco enstitu-deco-two" />
          <div className="enstitu-deco enstitu-deco-three" />

          <form className="enstitu-original-form" onSubmit={handleSubmit}>
            <header className="enstitu-form-title">
              <div className="enstitu-user-medallion"><UserRound /></div>
              <div>
                <strong>Hoş Geldiniz!</strong>
                <span>e-Nstitü Yönetim Paneli’ne giriş yapın.</span>
              </div>
            </header>

            <div className="enstitu-title-rule"><span /></div>

            <div className="enstitu-fields">
              <LoginField icon={<Building2 />} title="OKUL KODU" tone="orange">
                <input
                  required
                  value={schoolCode}
                  onChange={(e) => setSchoolCode(e.target.value.toLocaleUpperCase("tr-TR"))}
                  placeholder="Okul kodunuzu giriniz"
                  autoComplete="organization"
                />
              </LoginField>

              <LoginField icon={<UserRound />} title="KULLANICI ADI" tone="blue">
                <input
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Kullanıcı adınızı giriniz"
                  autoComplete="username"
                />
              </LoginField>

              <LoginField icon={<LockKeyhole />} title="ŞİFRE" tone="green">
                <input
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Şifrenizi giriniz"
                  autoComplete="current-password"
                  type={showPassword ? "text" : "password"}
                />
                <button
                  type="button"
                  className="enstitu-original-eye"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </LoginField>
            </div>

            <div className="enstitu-original-options">
              <label>
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                <span>Beni Hatırla</span>
              </label>
              <button type="button">Şifremi Unuttum?</button>
            </div>

            {error && <div className="enstitu-original-error" role="alert">{error}</div>}

            <button className="enstitu-original-login" type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="enstitu-spin" /> : <><span>GİRİŞ YAP</span><ArrowRight /></>}
            </button>

            <div className="enstitu-secure-note">
              <span /><ShieldCheck /><span />
              <p>Güvenli bağlantı ile korunmaktadır.</p>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

function LoginField({ icon, title, tone, children }: LoginFieldProps) {
  return (
    <label className={`enstitu-original-field tone-${tone}`}>
      <span className="enstitu-field-icon">{icon}</span>
      <span className="enstitu-field-body">
        <span className="enstitu-field-title">{title}</span>
        <span className="enstitu-field-control">{children}</span>
      </span>
    </label>
  );
}
