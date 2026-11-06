/**
 * e-Nstitü core domain types.
 * Recovered from the project's earlier canonical type definition and kept
 * intentionally extensible for legacy modules that persist additional fields.
 */
export interface Student {
  id: string;
  name: string;
  classroom: string;
  group?: string;
  gpa?: number;
  absences?: number;
  email?: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  status: 'Aktif' | 'Pasif';
  registerDate: string;
  avatar: string;
  dob?: string;
  pob?: string;
  address?: string;
  oob?: number;
  number?: string | number;
  studentNumber?: string | number;
  classId?: string;
  classroomId?: string;
  [key: string]: any;
}

export interface Teacher {
  id: string;
  name: string;
  branch: string;
  email?: string;
  phone: string;
  weeklyHours: number;
  assignedClassrooms: string[];
  status: 'Aktif' | 'İzinli';
  avatar: string;
  adminRole?: string;
  commissions?: string[];
  leaveReason?: string;
  leaveDates?: string[];
  [key: string]: any;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  classroom: string;
  teacherId: string;
  teacherName: string;
  teacherId2?: string;
  teacherName2?: string;
  teacherAssignmentCleared?: boolean;
  schedule: string;
  studentCount: number;
  groupName?: string;
  splitGroupId?: string;
  isCommonElective?: boolean;
  targetGroups?: string[];
  selectedClassrooms?: string[];
  classGroups?: string[];
  weeklyHours?: number;
  type?: 'compulsory' | 'elective' | string;
  [key: string]: any;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  tag: 'Önemli' | 'Genel' | 'Etkinlik';
  [key: string]: any;
}

export interface Classroom {
  id: string;
  name: string;
  level: string;
  groups?: string[];
  group1Name?: string;
  group2Name?: string;
  capacity?: number;
  advisorTeacherId?: string;
  advisorTeacherName?: string;
  counselorTeacherId?: string;
  counselorTeacherName?: string;
  vicePrincipal?: string;
  groupStudentIds?: Record<string, string[]> | string[];
  assignedCourses?: Array<{
    courseName: string;
    courseId?: string;
    teacherId: string;
    teacherName: string;
    teacherId2?: string;
    teacherName2?: string;
    teacherAssignmentCleared?: boolean;
    weeklyHours?: number;
    groupName?: string;
    splitGroupId?: string;
    studentIds?: string[];
    type?: 'compulsory' | 'elective' | string;
    [key: string]: any;
  }>;
  [key: string]: any;
}

export interface DashboardStats {
  totalStudents: number;
  activeStudents: number;
  totalTeachers: number;
  totalClasses: number;
  dailyAttendanceRate: number;
  gpaAverage: number;
  [key: string]: any;
}
