import { Course, Student, StudentAttendanceEntry } from '../types';

export interface WhatsAppReportOptions {
  includeHeader: boolean;
  includeStats: boolean;
  includePresent: boolean;
  includeAbsent: boolean;
  includeLate: boolean;
  includeJustified: boolean;
  includeObservations: boolean;
  destinationPhone?: string;
  institutionName?: string;
}

export const DEFAULT_WHATSAPP_OPTIONS: WhatsAppReportOptions = {
  includeHeader: true,
  includeStats: true,
  includePresent: false, // Default to false to avoid huge messages unless selected
  includeAbsent: true,
  includeLate: true,
  includeJustified: true,
  includeObservations: true,
  destinationPhone: '',
  institutionName: 'Escuela / Instituto',
};

export function formatFriendlyDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    };
    const formatted = date.toLocaleDateString('es-AR', options);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch {
    return dateStr;
  }
}

export function generateWhatsAppMessage(
  course: Course,
  dateStr: string,
  students: Student[],
  dayRecord: Record<string, StudentAttendanceEntry>,
  options: WhatsAppReportOptions
): string {
  const parts: string[] = [];
  const friendlyDate = formatFriendlyDate(dateStr);
  const institution = (options.institutionName && options.institutionName.trim()) || 'INSTITUCIÓN EDUCATIVA';

  // Classify students
  const present: { student: Student; entry: StudentAttendanceEntry }[] = [];
  const absent: { student: Student; entry: StudentAttendanceEntry }[] = [];
  const late: { student: Student; entry: StudentAttendanceEntry }[] = [];
  const justified: { student: Student; entry: StudentAttendanceEntry }[] = [];
  const withObs: { student: Student; obs: string; status: string }[] = [];

  students.forEach(student => {
    const entry = dayRecord[student.id] || { status: null };
    if (entry.status === 'P') present.push({ student, entry });
    else if (entry.status === 'A') absent.push({ student, entry });
    else if (entry.status === 'T') late.push({ student, entry });
    else if (entry.status === 'J') justified.push({ student, entry });

    if (entry.observation && entry.observation.trim() !== '') {
      withObs.push({
        student,
        obs: entry.observation.trim(),
        status: entry.status || '-',
      });
    }
  });

  const total = students.length;
  const recordedCount = present.length + absent.length + late.length + justified.length;
  const attendanceRate = total > 0 ? Math.round(((present.length + late.length) / total) * 100) : 0;

  // Header
  if (options.includeHeader) {
    parts.push(`🏫 *${institution.toUpperCase()}*`);
    parts.push(`📋 *PARTE DIARIO DE ASISTENCIA*`);
    parts.push(`📅 *Fecha:* ${friendlyDate}`);
    parts.push(`👥 *Curso:* ${course.name} (${course.shift || 'Mañana'})`);
    if (course.preceptor) {
      parts.push(`🧑🏫 *Preceptor/a:* ${course.preceptor}`);
    }
    parts.push(`────────────────────`);
  }

  // Stats Dashboard
  if (options.includeStats) {
    parts.push(`📊 *RESUMEN GENERAL*`);
    parts.push(`• Total de Alumnos: *${total}*`);
    parts.push(`• Presentismo: *${attendanceRate}%* (${present.length + late.length}/${total})`);
    parts.push(`✅ Presentes: *${present.length}*`);
    parts.push(`❌ Ausentes: *${absent.length}*`);
    parts.push(`⏰ Tardanzas: *${late.length}*`);
    parts.push(`📝 Justificados: *${justified.length}*`);
    if (recordedCount < total) {
      parts.push(`⚠️ Sin registrar: *${total - recordedCount}*`);
    }
    parts.push(`────────────────────`);
  }

  // Absent list
  if (options.includeAbsent) {
    parts.push(`❌ *AUSENTES (${absent.length}):*`);
    if (absent.length === 0) {
      parts.push(`_Sin alumnos ausentes en la jornada._`);
    } else {
      absent.forEach(({ student, entry }, i) => {
        const obsText = entry.observation ? ` - _(${entry.observation})_` : '';
        parts.push(`${i + 1}. *${student.lastName}*, ${student.firstName}${obsText}`);
      });
    }
    parts.push(``);
  }

  // Late list
  if (options.includeLate) {
    parts.push(`⏰ *TARDANZAS (${late.length}):*`);
    if (late.length === 0) {
      parts.push(`_Sin tardanzas registradas._`);
    } else {
      late.forEach(({ student, entry }, i) => {
        const obsText = entry.observation ? ` - _(${entry.observation})_` : '';
        parts.push(`${i + 1}. *${student.lastName}*, ${student.firstName}${obsText}`);
      });
    }
    parts.push(``);
  }

  // Justified list
  if (options.includeJustified) {
    parts.push(`📝 *AUSENTES JUSTIFICADOS (${justified.length}):*`);
    if (justified.length === 0) {
      parts.push(`_Sin ausencias justificadas._`);
    } else {
      justified.forEach(({ student, entry }, i) => {
        const obsText = entry.observation ? ` - Motivo: _${entry.observation}_` : '';
        parts.push(`${i + 1}. *${student.lastName}*, ${student.firstName}${obsText}`);
      });
    }
    parts.push(``);
  }

  // Present list
  if (options.includePresent) {
    parts.push(`✅ *PRESENTES (${present.length}):*`);
    if (present.length === 0) {
      parts.push(`_No hay alumnos marcados como presentes._`);
    } else {
      present.forEach(({ student }, i) => {
        parts.push(`${i + 1}. ${student.lastName}, ${student.firstName}`);
      });
    }
    parts.push(``);
  }

  // Outstanding observations
  if (options.includeObservations) {
    if (withObs.length > 0) {
      parts.push(`📌 *OBSERVACIONES DESTACADAS:*`);
      withObs.forEach(({ student, obs, status }) => {
        parts.push(`• *${student.lastName}, ${student.firstName}* [${status}]: ${obs}`);
      });
      parts.push(``);
    }
  }

  parts.push(`_Reporte generado mediante Sistema de Control de Asistencia_ 📱`);

  return parts.join('\n');
}

export function buildWhatsAppURL(text: string, phone?: string): string {
  const encoded = encodeURIComponent(text);
  if (phone && phone.trim() !== '') {
    const cleaned = phone.replace(/[^0-9]/g, '');
    return `https://wa.me/${cleaned}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}
