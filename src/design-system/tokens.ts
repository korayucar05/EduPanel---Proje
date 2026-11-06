export const hasatColors={
  brand:{
    ink:"#10283f",
    navy:"#082f58",
    emerald:"#13a66d",
    teal:"#0f9f9a",
    gold:"#d7a62f",
    amber:"#f59e0b",
    violet:"#7855d9",
    coral:"#ef6b6b",
  },
  surface:{
    page:"#f3f7f5",
    card:"#ffffff",
    soft:"#f7faf9",
    line:"#dbe5e1",
  },
  text:{
    primary:"#10283f",
    secondary:"#64748b",
    muted:"#94a3b8",
    inverse:"#ffffff",
  },
} as const;

export const hasatRadius={
  sm:"12px",
  md:"18px",
  lg:"24px",
  xl:"30px",
  pill:"999px",
} as const;

export const hasatShadow={
  card:"0 12px 38px rgba(15,42,72,.07)",
  elevated:"0 22px 60px rgba(8,47,88,.14)",
  floating:"0 14px 40px rgba(15,42,72,.16)",
} as const;

export const hasatMotion={
  fast:"160ms",
  normal:"240ms",
  slow:"420ms",
  easing:"cubic-bezier(.22,1,.36,1)",
} as const;

export const hasatTypography={
  display:"clamp(2rem,8vw,4.5rem)",
  title:"1.5rem",
  heading:"1.05rem",
  body:".875rem",
  caption:".6875rem",
} as const;

export type HasatTone="emerald"|"blue"|"violet"|"amber"|"rose"|"slate";

export const hasatToneClasses:Record<HasatTone,{
  surface:string;
  text:string;
  border:string;
  gradient:string;
}>={
  emerald:{
    surface:"bg-emerald-50",
    text:"text-emerald-700",
    border:"border-emerald-100",
    gradient:"from-emerald-500 to-teal-600",
  },
  blue:{
    surface:"bg-blue-50",
    text:"text-blue-700",
    border:"border-blue-100",
    gradient:"from-blue-600 to-cyan-600",
  },
  violet:{
    surface:"bg-violet-50",
    text:"text-violet-700",
    border:"border-violet-100",
    gradient:"from-violet-600 to-fuchsia-600",
  },
  amber:{
    surface:"bg-amber-50",
    text:"text-amber-700",
    border:"border-amber-100",
    gradient:"from-amber-400 to-orange-500",
  },
  rose:{
    surface:"bg-rose-50",
    text:"text-rose-700",
    border:"border-rose-100",
    gradient:"from-rose-500 to-pink-600",
  },
  slate:{
    surface:"bg-slate-50",
    text:"text-slate-700",
    border:"border-slate-200",
    gradient:"from-slate-800 to-slate-600",
  },
};
