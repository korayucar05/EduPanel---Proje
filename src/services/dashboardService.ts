export interface DashboardSummary {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  activeAnnouncements: number;
}

export function getDashboardSummary(): DashboardSummary {
  return {
    totalStudents: 0,
    totalTeachers: 0,
    totalClasses: 0,
    activeAnnouncements: 0,
  };
}