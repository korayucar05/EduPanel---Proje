import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

type Props = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
};

export default function EmptyState({ title, description, icon: Icon = Inbox, action }: Props) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <div className="rounded-2xl bg-slate-100 p-3 text-slate-500"><Icon className="h-6 w-6" /></div>
      <h3 className="mt-4 text-lg font-black text-slate-800">{title}</h3>
      {description ? <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
