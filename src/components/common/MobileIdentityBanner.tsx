import React from "react";
import { Settings } from "lucide-react";

type MobileIdentityTone = "admin" | "teacher" | "student" | "parent";

type MobileIdentityBannerProps = {
  fullName: string;
  roleLabel: string;
  schoolName?: string;
  schoolLogoSrc: string;
  photoSrc?: string;
  fallbackText?: string;
  tone: MobileIdentityTone;
  meta?: string;
  onClick?: () => void;
};

const TONES: Record<MobileIdentityTone, { main: string; middle: string; end: string }> = {
  admin: { main: "#3b82f6", middle: "#2563eb", end: "#1d4ed8" },
  teacher: { main: "#34c759", middle: "#16a34a", end: "#15803d" },
  student: { main: "#ff4d5a", middle: "#ef3340", end: "#c81e2b" },
  parent: { main: "#a855f7", middle: "#9333ea", end: "#7e22ce" },
};

export default function MobileIdentityBanner({
  fullName,
  roleLabel,
  schoolName = "Ordu Lisesi",
  tone,
  meta,
  onClick,
}: MobileIdentityBannerProps) {
  const palette = TONES[tone];
  const name = String(fullName || "Kullanıcı").trim();
  const role = String(roleLabel || "").trim();

  const content = (
    <span className="relative flex min-h-[118px] items-center gap-3 px-5 py-4 pr-[68px]">
      <span className="min-w-0 flex-1">
        <span className="block whitespace-normal break-words text-[24px] font-black leading-[1.02] tracking-[-0.035em] text-white">
          {name}
        </span>
        <span className="mt-1.5 block whitespace-normal text-[14px] font-bold leading-tight text-white/95">
          {role}
        </span>
        <span className="mt-1.5 block text-[9px] font-black uppercase tracking-[0.14em] text-white/70">
          {schoolName}
        </span>
        {meta ? (
          <span className="mt-1 block text-[8px] font-bold text-white/60">{meta}</span>
        ) : null}
      </span>

      {onClick ? (
        <span
          className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow-[0_5px_12px_rgba(0,0,0,0.14)]"
          style={{ color: palette.end }}
        >
          <Settings className="h-[18px] w-[18px]" />
        </span>
      ) : null}
    </span>
  );

  const sharedClassName =
    "group relative w-full overflow-visible rounded-[26px] border-2 border-slate-950 text-left transition active:scale-[0.995]";

  const body = (
    <>
      <span aria-hidden="true" className="absolute -left-[4px] -top-[17px] z-20 text-[52px] font-black leading-none text-black">“</span>
      <span aria-hidden="true" className="absolute -bottom-[18px] right-[8px] z-20 text-[52px] font-black leading-none text-black">”</span>
      <span aria-hidden="true" className="absolute -left-[8px] top-[50%] h-[7px] w-[7px] rounded-full border border-slate-950" style={{ background: palette.main }} />
      <span aria-hidden="true" className="absolute -right-[8px] top-[58%] h-[7px] w-[7px] rounded-full border border-slate-950" style={{ background: palette.main }} />
      <span aria-hidden="true" className="absolute -left-[7px] top-[68%] h-[2px] w-[10px] rounded-full bg-slate-950" />
      {content}
      <span aria-hidden="true" className="absolute -bottom-[10px] left-1/2 h-[20px] w-[20px] -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-slate-950" style={{ background: palette.end }} />
    </>
  );

  const style: React.CSSProperties = {
    background: `linear-gradient(135deg, ${palette.main} 0%, ${palette.middle} 54%, ${palette.end} 100%)`,
    boxShadow: `0 10px 22px ${palette.end}33`,
  };

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={sharedClassName} style={style}>
        {body}
      </button>
    );
  }

  return <div className={sharedClassName} style={style}>{body}</div>;
}
