import { BackupData, Course, SchoolConfig, Student, AttendanceRecordMap } from '../types';

const STORAGE_KEYS = {
  COURSES: 'school_courses_v3',
  STUDENTS: 'school_students_v3',
  ATTENDANCE: 'school_attendance_v3',
  CONFIG: 'school_config_v3',
  RESPONSIBLE: 'school_device_responsible',
  SELECTED_COURSE: 'school_selected_course_id_v1',
};

// Legacy keys for seamless migration
const LEGACY_STORAGE_KEYS = {
  COURSES: 'huergo_courses_v2',
  STUDENTS: 'huergo_students_v2',
  ATTENDANCE: 'huergo_attendance_v2',
  CONFIG: 'huergo_config_v2',
  RESPONSIBLE: 'huergo_device_responsible',
  SELECTED_COURSE: 'huergo_selected_course_id_v1',
};

export const DEFAULT_CONFIG: SchoolConfig = {
  nombreInstitucion: 'Escuela / Instituto',
  institutionName: 'Escuela / Instituto',
  shortName: 'Instituto',
  defaultWhatsAppPhone: '',
  defaultStatusOnReset: 'P',
  academicYear: '2026',
  responsibleName: '',
};

export const INITIAL_COURSES: Course[] = [
  {
    id: 'course-1-1-comp',
    name: '4to A Computación',
    division: 'A',
    shift: 'Mañana',
    academicYear: '2026',
    preceptor: 'Prof. Rossi',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'course-2-2-elec',
    name: '5to B Electrónica',
    division: 'B',
    shift: 'Mañana',
    academicYear: '2026',
    preceptor: 'Prof. Gómez',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'course-3-1-mec',
    name: '6to 1ra Mecánica',
    division: '1ra',
    shift: 'Tarde',
    academicYear: '2026',
    preceptor: 'Prof. Martínez',
    createdAt: new Date().toISOString(),
  },
];

export const INITIAL_STUDENTS: Student[] = [
  // 4to A Computación
  { id: 'st-101', courseId: 'course-1-1-comp', lastName: 'Álvarez', firstName: 'Mateo', listNumber: 1, dni: '48.120.314', genero: 'V', active: true },
  { id: 'st-102', courseId: 'course-1-1-comp', lastName: 'Benítez', firstName: 'Sofía Agustina', listNumber: 2, dni: '47.980.211', genero: 'M', active: true },
  { id: 'st-103', courseId: 'course-1-1-comp', lastName: 'Castillo', firstName: 'Lucas Joaquín', listNumber: 3, dni: '48.330.450', genero: 'V', active: true },
  { id: 'st-104', courseId: 'course-1-1-comp', lastName: 'Di Marco', firstName: 'Valentina Sol', listNumber: 4, dni: '48.512.901', genero: 'M', active: true },
  { id: 'st-105', courseId: 'course-1-1-comp', lastName: 'Fernández', firstName: 'Joaquín Tomás', listNumber: 5, dni: '47.654.128', genero: 'V', active: true },
  { id: 'st-106', courseId: 'course-1-1-comp', lastName: 'García Pereyra', firstName: 'Thiago', listNumber: 6, dni: '48.219.004', genero: 'V', active: true },
  { id: 'st-107', courseId: 'course-1-1-comp', lastName: 'Herrera', firstName: 'Camila Belén', listNumber: 7, dni: '48.441.782', genero: 'M', active: true },
  { id: 'st-108', courseId: 'course-1-1-comp', lastName: 'López', firstName: 'Santino Ezequiel', listNumber: 8, dni: '47.889.320', genero: 'V', active: true },
  { id: 'st-109', courseId: 'course-1-1-comp', lastName: 'Martínez', firstName: 'Emma Carolina', listNumber: 9, dni: '48.091.564', genero: 'M', active: true },
  { id: 'st-110', courseId: 'course-1-1-comp', lastName: 'Navarro', firstName: 'Bautista', listNumber: 10, dni: '48.650.119', genero: 'V', active: true },
  { id: 'st-111', courseId: 'course-1-1-comp', lastName: 'Ortiz', firstName: 'Lucía Milagros', listNumber: 11, dni: '47.742.908', genero: 'M', active: true },
  { id: 'st-112', courseId: 'course-1-1-comp', lastName: 'Pérez Silva', firstName: 'Franco Dante', listNumber: 12, dni: '48.310.871', genero: 'V', active: true },
  { id: 'st-113', courseId: 'course-1-1-comp', lastName: 'Quiroga', firstName: 'Julieta Nicole', listNumber: 13, dni: '48.190.222', genero: 'M', active: true },
  { id: 'st-114', courseId: 'course-1-1-comp', lastName: 'Ríos', firstName: 'Maximiliano', listNumber: 14, dni: '47.994.501', genero: 'V', active: true },
  { id: 'st-115', courseId: 'course-1-1-comp', lastName: 'Zárate', firstName: 'Florencia', listNumber: 15, dni: '48.405.612', genero: 'M', active: true },

  // 5to B Electrónica
  { id: 'st-201', courseId: 'course-2-2-elec', lastName: 'Acosta', firstName: 'Nicolás', listNumber: 1, dni: '47.112.449', genero: 'V', active: true },
  { id: 'st-202', courseId: 'course-2-2-elec', lastName: 'Blanco', firstName: 'Martina', listNumber: 2, dni: '46.998.112', genero: 'M', active: true },
  { id: 'st-203', courseId: 'course-2-2-elec', lastName: 'Correa', firstName: 'Gabriel', listNumber: 3, dni: '47.450.312', genero: 'V', active: true },
  { id: 'st-204', courseId: 'course-2-2-elec', lastName: 'Duarte', firstName: 'Camila', listNumber: 4, dni: '47.331.884', genero: 'M', active: true },
  { id: 'st-205', courseId: 'course-2-2-elec', lastName: 'Escobar', firstName: 'Facundo', listNumber: 5, dni: '47.209.651', genero: 'V', active: true },
  { id: 'st-206', courseId: 'course-2-2-elec', lastName: 'Giménez', firstName: 'Rocío', listNumber: 6, dni: '46.882.109', genero: 'M', active: true },

  // 6to 1ra Mecánica
  { id: 'st-301', courseId: 'course-3-1-mec', lastName: 'Aguirre', firstName: 'Santiago', listNumber: 1, dni: '46.331.092', genero: 'V', active: true },
  { id: 'st-302', courseId: 'course-3-1-mec', lastName: 'Carrizo', firstName: 'Mora', listNumber: 2, dni: '45.990.118', genero: 'M', active: true },
  { id: 'st-303', courseId: 'course-3-1-mec', lastName: 'Domínguez', firstName: 'Esteban', listNumber: 3, dni: '46.204.887', genero: 'V', active: true },
  { id: 'st-304', courseId: 'course-3-1-mec', lastName: 'Ferreira', firstName: 'Tomás', listNumber: 4, dni: '46.115.302', genero: 'V', active: true },
  { id: 'st-305', courseId: 'course-3-1-mec', lastName: 'Lescano', firstName: 'Federico', listNumber: 5, dni: '45.890.661', genero: 'V', active: true },
];

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function cleanCourseName(name: string): string {
  if (!name) return name;
  let clean = name.trim();
  if (clean === '1° 1ra - Computación' || clean === '1ra - Computación') return '4to A Computación';
  if (clean === '2° 2da - Electrónica' || clean === '2da - Electrónica') return '5to B Electrónica';
  if (clean === '3° 1ra - Mecánica' || clean === '1ra - Mecánica') return '6to 1ra Mecánica';

  clean = clean.replace(/^[0-9]+[°º\.]\s*/, '').trim();
  return clean;
}

export function loadCourses(): Course[] {
  try {
    let raw = localStorage.getItem(STORAGE_KEYS.COURSES);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_STORAGE_KEYS.COURSES);
    }
    if (!raw) {
      saveCourses(INITIAL_COURSES);
      return INITIAL_COURSES;
    }
    const courses: Course[] = JSON.parse(raw);
    const cleaned = courses.map(c => ({
      ...c,
      name: cleanCourseName(c.name),
    }));
    saveCourses(cleaned);
    return cleaned;
  } catch (err) {
    console.error('Error loading courses:', err);
    return INITIAL_COURSES;
  }
}

export function saveCourses(courses: Course[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(courses));
  } catch (err) {
    console.error('Error saving courses:', err);
  }
}

export function loadSelectedCourseId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.SELECTED_COURSE) || localStorage.getItem(LEGACY_STORAGE_KEYS.SELECTED_COURSE);
  } catch (err) {
    console.error('Error loading selected course id:', err);
    return null;
  }
}

export function saveSelectedCourseId(courseId: string): void {
  try {
    if (courseId) {
      localStorage.setItem(STORAGE_KEYS.SELECTED_COURSE, courseId);
    }
  } catch (err) {
    console.error('Error saving selected course id:', err);
  }
}

export function normalizeStudentsListNumbers(students: Student[]): Student[] {
  const courseMap: Record<string, Student[]> = {};
  students.forEach(st => {
    if (!courseMap[st.courseId]) courseMap[st.courseId] = [];
    courseMap[st.courseId].push(st);
  });

  const result: Student[] = [];
  Object.values(courseMap).forEach(list => {
    list.sort((a, b) => {
      const numA = a.listNumber ?? 999999;
      const numB = b.listNumber ?? 999999;
      if (numA !== numB) return numA - numB;
      return a.lastName.localeCompare(b.lastName);
    });
    list.forEach((st, idx) => {
      result.push({
        ...st,
        listNumber: idx + 1,
      });
    });
  });
  return result;
}

export function loadStudents(): Student[] {
  try {
    let raw = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_STORAGE_KEYS.STUDENTS);
    }
    if (!raw) {
      const normalized = normalizeStudentsListNumbers(INITIAL_STUDENTS);
      saveStudents(normalized);
      return normalized;
    }
    const parsed: Student[] = JSON.parse(raw);
    return normalizeStudentsListNumbers(parsed);
  } catch (err) {
    console.error('Error loading students:', err);
    return normalizeStudentsListNumbers(INITIAL_STUDENTS);
  }
}

export function saveStudents(students: Student[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  } catch (err) {
    console.error('Error saving students:', err);
  }
}

export function loadAttendance(): AttendanceRecordMap {
  try {
    let raw = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_STORAGE_KEYS.ATTENDANCE);
    }
    if (!raw) {
      const today = getTodayDateString();
      const initialMap: AttendanceRecordMap = {
        [`course-1-1-comp_${today}`]: {
          'st-101': { status: 'P' },
          'st-102': { status: 'P' },
          'st-103': { status: 'A', observation: 'Fiebre, avisó la madre' },
          'st-104': { status: 'P' },
          'st-105': { status: 'T', observation: 'Llegó 08:15 hs' },
          'st-106': { status: 'P' },
          'st-107': { status: 'J', observation: 'Certificado médico odontológico' },
          'st-108': { status: 'P' },
          'st-109': { status: 'P' },
          'st-110': { status: 'P' },
          'st-111': { status: 'P' },
          'st-112': { status: 'P' },
          'st-113': { status: 'A' },
          'st-114': { status: 'P' },
          'st-115': { status: 'P' },
        },
      };
      saveAttendance(initialMap);
      return initialMap;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading attendance:', err);
    return {};
  }
}

export function saveAttendance(attendance: AttendanceRecordMap): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(attendance));
  } catch (err) {
    console.error('Error saving attendance:', err);
  }
}

export function loadConfig(): SchoolConfig {
  try {
    let raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_STORAGE_KEYS.CONFIG);
    }
    if (!raw) {
      saveConfig(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }
    const parsed = JSON.parse(raw);
    let instName = parsed.nombreInstitucion || parsed.institutionName;
    if (!instName || instName.toLowerCase().includes('huergo')) {
      instName = DEFAULT_CONFIG.nombreInstitucion;
    }
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      nombreInstitucion: instName,
      institutionName: instName,
    };
  } catch (err) {
    console.error('Error loading config:', err);
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: SchoolConfig): void {
  try {
    const instName = config.nombreInstitucion || config.institutionName || DEFAULT_CONFIG.nombreInstitucion;
    const normalized: SchoolConfig = {
      ...config,
      nombreInstitucion: instName,
      institutionName: instName,
    };
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(normalized));
    if (config.responsibleName !== undefined) {
      localStorage.setItem(STORAGE_KEYS.RESPONSIBLE, config.responsibleName.trim());
    }
  } catch (err) {
    console.error('Error saving config:', err);
  }
}

export function getDeviceResponsible(): string {
  try {
    const direct = localStorage.getItem(STORAGE_KEYS.RESPONSIBLE) || localStorage.getItem(LEGACY_STORAGE_KEYS.RESPONSIBLE);
    if (direct && direct.trim()) {
      return direct.trim();
    }
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG) || localStorage.getItem(LEGACY_STORAGE_KEYS.CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.responsibleName && parsed.responsibleName.trim()) {
        return parsed.responsibleName.trim();
      }
    }
  } catch (err) {
    console.error('Error loading device responsible:', err);
  }
  return '';
}

export function setDeviceResponsible(name: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.RESPONSIBLE, (name || '').trim());
  } catch (err) {
    console.error('Error saving device responsible:', err);
  }
}

export function exportBackupJSON(): string {
  const currentConfig = loadConfig();
  const instName = currentConfig.nombreInstitucion || currentConfig.institutionName || 'Escuela / Instituto';

  const data: BackupData = {
    version: 3,
    exportDate: new Date().toISOString(),
    institution: instName,
    courses: loadCourses(),
    students: loadStudents(),
    attendance: loadAttendance(),
    config: currentConfig,
  };

  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = getTodayDateString();
  const safeName = instName.replace(/[^a-zA-Z0-9_-]/g, '_');
  a.href = url;
  a.download = `Respaldo_Asistencia_${safeName}_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return jsonString;
}

export function importBackupJSON(jsonString: string): { success: boolean; message: string; data?: BackupData } {
  try {
    const parsed = JSON.parse(jsonString) as BackupData;
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, message: 'El archivo no contiene un JSON válido.' };
    }

    if (!Array.isArray(parsed.courses) || !Array.isArray(parsed.students)) {
      return { success: false, message: 'El formato de respaldo es incompatible (faltan cursos o alumnos).' };
    }

    saveCourses(parsed.courses);
    saveStudents(parsed.students);
    if (parsed.attendance && typeof parsed.attendance === 'object') {
      saveAttendance(parsed.attendance);
    }
    if (parsed.config && typeof parsed.config === 'object') {
      const parsedConfig = parsed.config;
      const instName = parsedConfig.nombreInstitucion || parsedConfig.institutionName || parsed.institution || DEFAULT_CONFIG.nombreInstitucion;
      saveConfig({
        ...DEFAULT_CONFIG,
        ...parsedConfig,
        nombreInstitucion: instName,
        institutionName: instName,
      });
    }

    return {
      success: true,
      message: `¡Respaldo restaurado con éxito! Se cargaron ${parsed.courses.length} cursos y ${parsed.students.length} alumnos.`,
      data: parsed,
    };
  } catch (err) {
    return { success: false, message: `Error al procesar el archivo: ${(err as Error).message}` };
  }
}
