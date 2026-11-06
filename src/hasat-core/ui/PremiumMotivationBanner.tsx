import React from "react";

export function PremiumMotivationBanner({
  title,
  children,
  emoji = "🌟",
}: React.PropsWithChildren<{
  title: React.ReactNode;
  emoji?: string;
}>) {
  return (
    <div className="hasat-motivation-banner rounded-2xl border border-blue-200 px-5 py-4">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[25px] shadow-sm">
          {emoji}
        </div>
        <div>
          <strong className="block text-[14px] font-black text-[#082f58]">{title}</strong>
          <div className="mt-1 text-[10px] font-semibold leading-5 text-slate-600">{children}</div>
        </div>
      </div>
    </div>
  );
}
