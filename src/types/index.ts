export type AttendanceStatus = 'P' | 'A' | 'T' | 'J' | null;

export type StudentGender = 'V' | 'M' | 'indefinido';

export type GenderFilterType = 'todos' | 'V' | 'M' | 'indefinido';

export interface Student {
  id: string;
  courseId: string;
  lastName: string;
  firstName: string;
  listNumber?: number;
  dni?: string;
  genero?: StudentGender;
  notes?: string;
  active: boolean;
}

export interface Course {
  id: string;
  name: string; // e.g. "4to A Computación"
  division?: string;
  shift?: 'Mañana' | 'Tarde' | 'Vespertino';
  academicYear: string; // e.g. "2026"
  preceptor?: string;
  createdAt: string;
}

export interface StudentAttendanceEntry {
  status: AttendanceStatus;
  observation?: string;
  isDiscipline?: boolean;
  disciplineDetail?: string;
  updatedAt?: string;
}

// Keyed by `courseId_YYYY-MM-DD`
// Inside: { [studentId]: StudentAttendanceEntry }
export type AttendanceRecordMap = Record<string, Record<string, StudentAttendanceEntry>>;

export interface SchoolConfig {
  nombreInstitucion: string; // Dynamic parameterizable Institution Name (Marca Blanca)
  institutionName?: string; // Backwards compatibility alias
  shortName?: string;
  defaultWhatsAppPhone?: string;
  defaultStatusOnReset?: AttendanceStatus;
  academicYear: string;
  responsibleName?: string;
}

export interface BackupData {
  version: number;
  exportDate: string;
  institution: string;
  courses: Course[];
  students: Student[];
  attendance: AttendanceRecordMap;
  config: SchoolConfig;
}

export interface DayStats {
  total: number;
  present: number;
  absent: number;
  late: number;
  justified: number;
  unrecorded: number;
  presentPercentage: number;
}

export interface UndoAction {
  id: string;
  description: string;
  timestamp: number;
  undo: () => void;
}
