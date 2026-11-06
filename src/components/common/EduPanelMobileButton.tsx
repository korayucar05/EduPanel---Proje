import React from "react";

export const EDU_PANEL_MOBILE_ACCENTS = [
  { base: "#FFB300", dark: "#F59E0B" },
  { base: "#FF5B3A", dark: "#F0442C" },
  { base: "#1597D4", dark: "#087DB9" },
  { base: "#12C7C1", dark: "#0AA8A3" },
  { base: "#9254DE", dark: "#7B3FCC" },
  { base: "#F45F9B", dark: "#DD4A88" },
  { base: "#98D51B", dark: "#7FBC10" },
  { base: "#F3A312", dark: "#DB8D07" },
  { base: "#708594", dark: "#5B6F7E" },
  { base: "#24AAA6", dark: "#178F8C" },
  { base: "#E62831", dark: "#C91C24" },
  { base: "#25368F", dark: "#172876" },
] as const;

type EduPanelMobileButtonProps = {
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  accentIndex?: number;
  disabled?: boolean;
  badge?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: "default" | "speech";
  compact?: boolean;
  microMotion?: boolean;
  motionDelayMs?: number;
};

const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized.length === 3 ? normalized.split("").map((c) => c + c).join("") : normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

const installMobileDetailTheme = () => {
  if (typeof document === "undefined" || document.getElementById("edupanel-mobile-detail-theme")) return;

  const style = document.createElement("style");
  style.id = "edupanel-mobile-detail-theme";
  style.textContent = `
    body[data-edupanel-mobile-detail="true"] main {
      background: linear-gradient(180deg, var(--edupanel-accent-soft, #f8fafc) 0%, #ffffff 34%, #ffffff 100%) !important;
    }

    body[data-edupanel-mobile-detail="true"] main > div:first-child {
      border-color: var(--edupanel-accent-border, #e2e8f0) !important;
      box-shadow: 0 18px 42px var(--edupanel-accent-shadow, rgba(15, 23, 42, .10)) !important;
    }

    body[data-edupanel-mobile-detail="true"] main header {
      border-color: var(--edupanel-accent-border, #e2e8f0) !important;
      background: linear-gradient(135deg, var(--edupanel-accent-soft, #f8fafc) 0%, #ffffff 72%) !important;
    }

    body[data-edupanel-mobile-detail="true"] main header button,
    body[data-edupanel-mobile-detail="true"] main header [class*="rounded-"][class*="text-white"] {
      border-color: var(--edupanel-accent-border, #e2e8f0) !important;
    }

    body[data-edupanel-mobile-detail="true"] main [class*="bg-indigo-50"],
    body[data-edupanel-mobile-detail="true"] main [class*="bg-violet-50"],
    body[data-edupanel-mobile-detail="true"] main [class*="bg-purple-50"],
    body[data-edupanel-mobile-detail="true"] main [class*="bg-blue-50"],
    body[data-edupanel-mobile-detail="true"] main [class*="bg-sky-50"],
    body[data-edupanel-mobile-detail="true"] main [class*="bg-cyan-50"],
    body[data-edupanel-mobile-detail="true"] main [class*="bg-teal-50"],
    body[data-edupanel-mobile-detail="true"] main [class*="bg-pink-50"],
    body[data-edupanel-mobile-detail="true"] main [class*="bg-fuchsia-50"],
    body[data-edupanel-mobile-detail="true"] main [class*="bg-amber-50"],
    body[data-edupanel-mobile-detail="true"] main [class*="bg-orange-50"] {
      background-color: var(--edupanel-accent-soft, #f8fafc) !important;
    }

    body[data-edupanel-mobile-detail="true"] main [class*="border-indigo-"],
    body[data-edupanel-mobile-detail="true"] main [class*="border-violet-"],
    body[data-edupanel-mobile-detail="true"] main [class*="border-purple-"],
    body[data-edupanel-mobile-detail="true"] main [class*="border-blue-"],
    body[data-edupanel-mobile-detail="true"] main [class*="border-sky-"],
    body[data-edupanel-mobile-detail="true"] main [class*="border-cyan-"],
    body[data-edupanel-mobile-detail="true"] main [class*="border-teal-"],
    body[data-edupanel-mobile-detail="true"] main [class*="border-pink-"],
    body[data-edupanel-mobile-detail="true"] main [class*="border-fuchsia-"],
    body[data-edupanel-mobile-detail="true"] main [class*="border-amber-"],
    body[data-edupanel-mobile-detail="true"] main [class*="border-orange-"] {
      border-color: var(--edupanel-accent-border, #e2e8f0) !important;
    }

    body[data-edupanel-mobile-detail="true"] main [class*="text-indigo-6"],
    body[data-edupanel-mobile-detail="true"] main [class*="text-indigo-7"],
    body[data-edupanel-mobile-detail="true"] main [class*="text-violet-6"],
    body[data-edupanel-mobile-detail="true"] main [class*="text-violet-7"],
    body[data-edupanel-mobile-detail="true"] main [class*="text-purple-6"],
    body[data-edupanel-mobile-detail="true"] main [class*="text-purple-7"],
    body[data-edupanel-mobile-detail="true"] main [class*="text-blue-6"],
    body[data-edupanel-mobile-detail="true"] main [class*="text-blue-7"],
    body[data-edupanel-mobile-detail="true"] main [class*="text-sky-6"],
    body[data-edupanel-mobile-detail="true"] main [class*="text-sky-7"],
    body[data-edupanel-mobile-detail="true"] main [class*="text-cyan-6"],
    body[data-edupanel-mobile-detail="true"] main [class*="text-cyan-7"],
    body[data-edupanel-mobile-detail="true"] main [class*="text-teal-6"],
    body[data-edupanel-mobile-detail="true"] main [class*="text-teal-7"],
    body[data-edupanel-mobile-detail="true"] main [class*="text-pink-6"],
    body[data-edupanel-mobile-detail="true"] main [class*="text-pink-7"],
    body[data-edupanel-mobile-detail="true"] main [class*="text-fuchsia-6"],
    body[data-edupanel-mobile-detail="true"] main [class*="text-fuchsia-7"],
    body[data-edupanel-mobile-detail="true"] main [class*="text-amber-6"],
    body[data-edupanel-mobile-detail="true"] main [class*="text-amber-7"],
    body[data-edupanel-mobile-detail="true"] main [class*="text-orange-6"],
    body[data-edupanel-mobile-detail="true"] main [class*="text-orange-7"] {
      color: var(--edupanel-accent-dark, #475569) !important;
    }

    body[data-edupanel-mobile-detail="true"] main button[class*="bg-indigo-"],
    body[data-edupanel-mobile-detail="true"] main button[class*="bg-violet-"],
    body[data-edupanel-mobile-detail="true"] main button[class*="bg-purple-"],
    body[data-edupanel-mobile-detail="true"] main button[class*="bg-blue-"],
    body[data-edupanel-mobile-detail="true"] main button[class*="bg-sky-"],
    body[data-edupanel-mobile-detail="true"] main button[class*="bg-cyan-"],
    body[data-edupanel-mobile-detail="true"] main button[class*="bg-teal-"],
    body[data-edupanel-mobile-detail="true"] main button[class*="bg-pink-"],
    body[data-edupanel-mobile-detail="true"] main button[class*="bg-fuchsia-"],
    body[data-edupanel-mobile-detail="true"] main button[class*="bg-amber-"],
    body[data-edupanel-mobile-detail="true"] main button[class*="bg-orange-"] {
      background-color: var(--edupanel-accent, #64748b) !important;
      color: #ffffff !important;
      border-color: var(--edupanel-accent-dark, #475569) !important;
    }
  `;
  document.head.appendChild(style);
};


const installMobileModuleMotion = () => {
  if (typeof document === "undefined" || document.getElementById("edupanel-mobile-module-motion")) return;
  const style = document.createElement("style");
  style.id = "edupanel-mobile-module-motion";
  style.textContent = `
    @keyframes edupanel-module-whisper {
      0%, 100% { translate: 0 0; }
      24% { translate: .55px 0; }
      57% { translate: -.45px 0; }
      81% { translate: .25px 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .edupanel-module-whisper { animation: none !important; }
    }
  `;
  document.head.appendChild(style);
};

const activateMobileDetailTheme = (base: string, dark: string) => {
  if (typeof document === "undefined") return;
  const { r, g, b } = hexToRgb(base);
  const root = document.documentElement;
  root.style.setProperty("--edupanel-accent", base);
  root.style.setProperty("--edupanel-accent-dark", dark);
  root.style.setProperty("--edupanel-accent-soft", `rgba(${r}, ${g}, ${b}, 0.10)`);
  root.style.setProperty("--edupanel-accent-border", `rgba(${r}, ${g}, ${b}, 0.34)`);
  root.style.setProperty("--edupanel-accent-shadow", `rgba(${r}, ${g}, ${b}, 0.14)`);
  document.body.dataset.edupanelMobileDetail = "true";
};

export default function EduPanelMobileButton({
  title,
  description,
  icon: Icon,
  accentIndex = 0,
  disabled = false,
  badge,
  onClick,
  className = "",
  variant = "default",
  compact = false,
  microMotion = false,
  motionDelayMs = 0,
}: EduPanelMobileButtonProps) {
  const accent = EDU_PANEL_MOBILE_ACCENTS[Math.abs(accentIndex) % EDU_PANEL_MOBILE_ACCENTS.length];

  React.useEffect(() => {
    installMobileDetailTheme();
    installMobileModuleMotion();
    // Bu ortak butonlar ana sayfada bulunur. Ana sayfaya geri dönüldüğünde
    // detay arayüzü renk zorlamasını otomatik olarak kapatır.
    if (typeof document !== "undefined") {
      document.body.dataset.edupanelMobileDetail = "false";
    }
  }, []);

  const handleClick = () => {
    if (disabled) return;
    activateMobileDetailTheme(accent.base, accent.dark);
    onClick?.();
  };

  if (variant === "speech") {
    return (
      <button
        type="button"
        onClick={disabled ? undefined : handleClick}
        disabled={disabled}
        className={`group relative h-full w-full overflow-visible bg-transparent p-0 text-left outline-none ${compact ? "min-h-[78px]" : "min-h-[116px]"} ${
          disabled ? "cursor-default opacity-60" : "transition-transform duration-150 active:scale-[0.975]"
        } ${microMotion ? "edupanel-module-whisper" : ""} ${className}`}
        style={microMotion ? { animation: "edupanel-module-whisper 8.6s ease-in-out infinite", animationDelay: `${motionDelayMs}ms` } : undefined}
      >
        <span
          aria-hidden="true"
          className={`absolute z-0 border-2 border-slate-950 ${compact ? "inset-x-[2px] bottom-[6px] top-[4px] rounded-[16px]" : "inset-x-[3px] bottom-[8px] top-[5px] rounded-[22px]"}`}
          style={{
            background: `linear-gradient(145deg, ${accent.base} 0%, ${accent.dark} 100%)`,
            boxShadow: `0 9px 16px ${accent.dark}38, inset 0 1px 0 rgba(255,255,255,.24)`,
          }}
        />
        <span
          aria-hidden="true"
          className={`absolute left-1/2 z-0 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-slate-950 ${compact ? "bottom-[1px] h-[13px] w-[13px]" : "bottom-[1px] h-[20px] w-[20px]"}`}
          style={{ background: accent.dark }}
        />

        <span aria-hidden="true" className={`absolute z-20 font-black leading-none text-black ${compact ? "-left-[1px] -top-[5px] text-[28px]" : "-left-[1px] -top-[9px] text-[42px]"}`}>“</span>
        <span aria-hidden="true" className={`absolute z-20 font-black leading-none text-black ${compact ? "-bottom-[6px] right-[3px] text-[28px]" : "-bottom-[10px] right-[4px] text-[42px]"}`}>”</span>

        <span aria-hidden="true" className="absolute -left-[5px] top-[45%] z-20 h-[6px] w-[6px] rounded-full border border-slate-950" style={{ background: accent.base }} />
        <span aria-hidden="true" className="absolute -right-[5px] top-[62%] z-20 h-[6px] w-[6px] rounded-full border border-slate-950" style={{ background: accent.base }} />
        <span aria-hidden="true" className="absolute -left-[4px] top-[63%] z-20 h-[2px] w-[8px] rounded-full bg-slate-950" />

        {badge ? <span className={`absolute z-30 ${compact ? "right-[4px] top-[5px] scale-90" : "right-[7px] top-[8px]"}`}>{badge}</span> : null}

        <span className={`relative z-10 flex h-full items-center justify-center text-center text-white ${compact ? "min-h-[78px] px-[7px] pb-[8px] pt-[6px]" : "min-h-[116px] px-[12px] pb-[10px] pt-[8px]"}`}>
          <strong
            className={`block w-full font-black uppercase tracking-[-0.025em] text-white ${compact ? "text-[10.5px] leading-[12px]" : "text-[15px] leading-[17px]"}`}
            style={{
              fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
              textShadow: '0 1px 1px rgba(0,0,0,.14)',
            }}
          >
            {title.toLocaleUpperCase("tr-TR")}
          </strong>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={disabled ? undefined : handleClick}
      disabled={disabled}
      className={`group relative h-full min-h-[116px] w-full overflow-visible bg-transparent p-0 text-center outline-none ${
        disabled ? "cursor-default opacity-65" : "transition-transform duration-150 active:scale-[0.98]"
      } ${className}`}
    >
      {/* Renkli oval tabaka ana kartın ARKASINDA kalır. Kesişim bölgesi görünmez. */}
      <span
        aria-hidden="true"
        className="absolute left-[7%] right-[7%] top-[9px] z-0 h-[30px] rounded-[18px]"
        style={{
          background: `linear-gradient(180deg, ${accent.base} 0%, ${accent.dark} 100%)`,
          boxShadow: `0 5px 10px ${accent.dark}33`,
        }}
      />

      {/* Yazıların bulunduğu ana kart opak beyazdır; renkli tabakayı örter. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 top-[20px] z-[2] rounded-[22px] bg-white"
        style={{
          border: `1px solid ${accent.base}`,
          boxShadow: `0 10px 18px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.96)`,
        }}
      />

      {/* Dairesel rozet en üst katmandadır. */}
      <span
        className="absolute left-1/2 top-0 z-20 flex h-[44px] w-[44px] -translate-x-1/2 items-center justify-center rounded-full border border-white/55 text-white"
        style={{
          background: `linear-gradient(180deg, ${accent.base} 0%, ${accent.dark} 100%)`,
          boxShadow: `0 7px 10px ${accent.dark}66, inset 0 1px 1px rgba(255,255,255,0.35)`,
        }}
      >
        <Icon className="h-[20px] w-[20px] stroke-[2.45]" />
      </span>

      {badge ? <span className="absolute right-1 top-[22px] z-30">{badge}</span> : null}

      <span className="relative z-10 flex h-full min-h-[116px] flex-col items-center px-2 pb-2 pt-[55px]">
        <strong
          className="block w-full text-[9.5px] font-extrabold uppercase leading-[11.5px] tracking-[-0.01em]"
          style={{
            color: accent.dark,
            fontFamily: '"Arial Narrow", "Roboto Condensed", "Inter", Arial, sans-serif',
          }}
        >
          {title}
        </strong>
        {description ? (
          <span
            className="mt-1.5 line-clamp-2 block w-full text-[6.7px] font-semibold leading-[9.5px] text-slate-500"
            style={{ fontFamily: "Inter, Arial, sans-serif" }}
          >
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}
