import { Student, Teacher, Course, Announcement, DashboardStats } from './types';

export const initialDashboardStats: DashboardStats = {
  totalStudents: 342,
  activeStudents: 335,
  totalTeachers: 28,
  totalClasses: 14,
  dailyAttendanceRate: 96.4,
  gpaAverage: 82.35,
};

export const attendanceTrends = [
  { day: 'Pzt', rate: 95.8, target: 95 },
  { day: 'Sal', rate: 96.4, target: 95 },
  { day: 'Çar', rate: 97.1, target: 95 },
  { day: 'Per', rate: 96.0, target: 95 },
  { day: 'Cum', rate: 94.2, target: 95 },
];

export const gradeDistribution = [
  { grade: '9. Sınıf', count: 92, avgGpa: 79.2 },
  { grade: '10. Sınıf', count: 88, avgGpa: 81.5 },
  { grade: '11. Sınıf', count: 84, avgGpa: 84.1 },
  { grade: '12. Sınıf', count: 78, avgGpa: 85.3 },
];

export const performanceByBranch = [
  { branch: 'Matematik', avg: 74, limit: 70 },
  { branch: 'Fizik', avg: 68, limit: 70 },
  { branch: 'Kimya', avg: 76, limit: 70 },
  { branch: 'Biyoloji', avg: 81, limit: 70 },
  { branch: 'Edebiyat', avg: 85, limit: 70 },
  { branch: 'Tarih', avg: 88, limit: 70 },
  { branch: 'Coğrafya', avg: 83, limit: 70 },
  { branch: 'İngilizce', avg: 89, limit: 70 },
];

export const initialStudents: Student[] = [];

export const initialTeachers: Teacher[] = [];

export const initialCourses: Course[] = [];

export const initialAnnouncements: Announcement[] = [
  {
    id: 'ANN-001',
    title: '1. Dönem Veli Bilgilendirme Toplantısı',
    content: 'Tüm velilerimizin katılımıyla gerçekleştirilecek olan 1. Dönem genel durum değerlendirme toplantısı 22 Haziran Pazar günü saat 14:00\'te okul konferans salonunda düzenlenecektir.',
    date: '2026-06-18',
    tag: 'Önemli'
  },
  {
    id: 'ANN-002',
    title: 'Üniversite Tanıtım ve Kariyer Günleri',
    content: '12. sınıflarımıza yönelik düzenlenecek olan kariyer günlerinde, alanında uzman akademisyenler ve önde gelen üniversitelerin temsilcileri öğrencilerimizle buluşup rehberlik edecektir.',
    date: '2026-06-17',
    tag: 'Etkinlik'
  },
  {
    id: 'ANN-003',
    title: 'Yaz Dönemi Destekleme Kursları Kayıtları Jenerasyonu',
    content: 'Yaz döneminde açılacak olan TYT-AYT hazırlık ve ek takviye kursları için ön kayıt başvuruları sistem üzerinden başlamıştır. Son başvuru tarihi 25 Haziran\'dır.',
    date: '2026-06-15',
    tag: 'Genel'
  }
];
