import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

type Props = {
  kind: "subject" | "classroom";
  subjectAverageData?: any[];
  classroomData?: any[];
  currentChartClass?: string;
};

export default function ExamAnalysisCharts({
  kind,
  subjectAverageData = [],
  classroomData = [],
  currentChartClass = "",
}: Props) {
  if (kind === "subject") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={subjectAverageData}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#f1f5f9"
          />

          <XAxis
            dataKey="name"
            tick={{
              fill: "#64748b",
              fontSize: 10,
              fontWeight: "bold",
            }}
            stroke="#cbd5e1"
          />

          <YAxis
            tick={{
              fill: "#64748b",
              fontSize: 10,
              fontWeight: "bold",
            }}
            stroke="#cbd5e1"
          />

          <Tooltip
            content={({ active, payload, label }: any) => {
              if (active && payload && payload.length) {
                return (
                  <div className="max-w-xs space-y-2 rounded-2xl border border-slate-800 bg-slate-900 p-3.5 text-[11px] font-bold text-slate-100 shadow-xl">
                    <p className="border-b border-slate-800/60 pb-1 text-xs font-extrabold text-white">
                      {label}
                    </p>

                    <div className="space-y-1">
                      {payload.map((item: any, i: number) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-6"
                        >
                          <span className="flex items-center gap-1.5 font-medium text-slate-400">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: item.fill }}
                            />
                            {item.name}:
                          </span>

                          <span className="text-right font-mono font-black text-white">
                            {item.value} Net
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              return null;
            }}
          />

          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{
              fontSize: "11px",
              fontWeight: "bold",
              paddingTop: "10px",
            }}
          />

          <Bar
            dataKey="SınıfOrtalaması"
            name={`${currentChartClass || "Sınıf"} Ortalaması`}
            fill="#ea580c"
            radius={[4, 4, 0, 0]}
            barSize={14}
          />

          <Bar
            dataKey="KurumOrtalaması"
            name="Kurum Ortalaması"
            fill="#eab308"
            radius={[4, 4, 0, 0]}
            barSize={14}
          />

          <Bar
            dataKey="GenelOrtalama"
            name="Genel Ortalama"
            fill="#cbd5e1"
            radius={[4, 4, 0, 0]}
            barSize={14}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={classroomData}
        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="#f1f5f9"
        />

        <XAxis
          dataKey="name"
          tick={{
            fill: "#64748b",
            fontSize: 10,
            fontWeight: "bold",
          }}
          stroke="#cbd5e1"
        />

        <YAxis
          tick={{
            fill: "#64748b",
            fontSize: 10,
            fontWeight: "bold",
          }}
          stroke="#cbd5e1"
        />

        <Tooltip
          contentStyle={{
            backgroundColor: "#1e293b",
            borderRadius: "12px",
            border: "none",
          }}
          labelStyle={{
            color: "#fff",
            fontWeight: "bold",
            fontSize: 12,
          }}
        />

        <Bar
          dataKey="OrtalamaNet"
          name="Ortalama Net"
          fill="#0ea5e9"
          radius={[8, 8, 0, 0]}
          barSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
