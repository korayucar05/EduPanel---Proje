import { useCallback, useEffect, useState } from "react";

export interface SchedulingLibraryRecord {
  id: string | number;
  name: string;
  developer?: string;
  description?: string;
  [key: string]: unknown;
}

export interface SchedulingRunRecord {
  id: string | number;
  algorithm: string;
  initial_penalty?: number;
  final_penalty?: number;
  duration_ms?: number;
  status?: string;
  created_at?: string;
  [key: string]: unknown;
}

export function useSchedulingDatabase() {
  const [libraries, setLibraries] = useState<SchedulingLibraryRecord[]>([]);
  const [runs, setRuns] = useState<SchedulingRunRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [librariesResponse, runsResponse] = await Promise.all([
        fetch("/api/scheduling/libraries"),
        fetch("/api/scheduling/runs"),
      ]);

      if (librariesResponse.ok) {
        const data = await librariesResponse.json();
        setLibraries(Array.isArray(data) ? data : []);
      }

      if (runsResponse.ok) {
        const data = await runsResponse.json();
        setRuns(Array.isArray(data) ? data : []);
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Ders dağıtım verileri alınamadı.";
      setError(message);
      console.error("Error fetching scheduling data from backend:", reason);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { libraries, runs, loading, error, refresh };
}
