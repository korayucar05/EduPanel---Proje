import React, { useEffect, useState } from "react";
import DisciplineSixStepWizard, {
  type DisciplineBehaviorChoice,
} from "./discipline/DisciplineSixStepWizard";
import { welfareService } from "../modules/welfare";

interface DisciplineWorkflowModuleProps {
  students?: any[];
  canManageDiscipline?: boolean;
}

/** Sol menüdeki Disiplin bağlantısının altı aşamalı işlem ekranı. */
export default function DisciplineWorkflowModule({
  students = [],
  canManageDiscipline = true,
}: DisciplineWorkflowModuleProps) {
  const [behaviors, setBehaviors] = useState<DisciplineBehaviorChoice[]>([]);

  useEffect(() => {
    let active = true;
    const loadBehaviors = async () => {
      try {
        const records = await welfareService.readCollection<any>("customBehaviors");
        if (!active) return;
        setBehaviors((Array.isArray(records) ? records : []).map((behavior) => ({
          id: String(behavior.id ?? ""),
          name: String(behavior.name ?? ""),
          type: behavior.type,
          sanctionType: behavior.sanctionType,
          article: behavior.article,
          content: behavior.content,
        })));
      } catch (error) {
        console.error("Disiplin davranış listesi yüklenemedi:", error);
      }
    };

    void loadBehaviors();
    window.addEventListener("focus", loadBehaviors);
    return () => {
      active = false;
      window.removeEventListener("focus", loadBehaviors);
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-8 pt-2 lg:px-8">
      <DisciplineSixStepWizard
        students={students}
        behaviors={behaviors}
        readOnly={!canManageDiscipline}
      />
    </div>
  );
}
