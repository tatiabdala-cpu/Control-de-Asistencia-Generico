import XLSX from 'xlsx-js-style';
import { Course, Student, StudentAttendanceEntry, AttendanceRecordMap } from '../types';
import { formatGenderReport } from './studentSorting';

/**
 * Formats a decimal number using comma separator for Spanish Excel display (e.g. 0,5, 1,5, 2,0)
 */
export function formatDecimalSpanish(val: number): string {
  return val.toFixed(1).replace('.', ',');
}

export function getStatusDescription(status: string | null | undefined): string {
  switch (status) {
    case 'P':
      return 'Presente';
    case 'A':
      return 'Ausente (Injustificada)';
    case 'T':
      return 'Tardanza (0.5)';
    case 'J':
      return 'Ausente Justificado';
    default:
      return 'Sin Registrar';
  }
}

/**
 * Formats a student's full name matching app representation: APELLIDO, Nombre
 */
export function formatStudentFullName(student: Student): string {
  const lastName = (student.lastName || '').trim().toUpperCase();
  const firstName = (student.firstName || '').trim();
  if (!lastName && !firstName) return 'Sin Nombre';
  if (!firstName) return lastName;
  if (!lastName) return firstName;
  return `${lastName}, ${firstName}`;
}

/**
 * Formats YYYY-MM-DD date into DD/MM for header display (e.g. 2026-09-24 -> 24/09)
 */
export function formatDateHeader(dateStr: string): string {
  if (!dateStr) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return dateStr;
}

const SPANISH_MONTHS: Record<string, string> = {
  '01': 'Enero',
  '02': 'Febrero',
  '03': 'Marzo',
  '04': 'Abril',
  '05': 'Mayo',
  '06': 'Junio',
  '07': 'Julio',
  '08': 'Agosto',
  '09': 'Septiembre',
  '10': 'Octubre',
  '11': 'Noviembre',
  '12': 'Diciembre',
};

const SPANISH_MONTHS_SHORT: Record<string, string> = {
  '01': 'Ene',
  '02': 'Feb',
  '03': 'Mar',
  '04': 'Abr',
  '05': 'May',
  '06': 'Jun',
  '07': 'Jul',
  '08': 'Ago',
  '09': 'Sep',
  '10': 'Oct',
  '11': 'Nov',
  '12': 'Dic',
};

// ==========================================
// Reusable Style Definitions for xlsx-js-style
// ==========================================
const BORDER_THIN = {
  top: { style: 'thin', color: { rgb: 'CBD5E1' } },
  bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
  left: { style: 'thin', color: { rgb: 'CBD5E1' } },
  right: { style: 'thin', color: { rgb: 'CBD5E1' } },
};

const BORDER_HEADER = {
  top: { style: 'medium', color: { rgb: '1F4E78' } },
  bottom: { style: 'medium', color: { rgb: '1F4E78' } },
  left: { style: 'thin', color: { rgb: 'B0C4DE' } },
  right: { style: 'thin', color: { rgb: 'B0C4DE' } },
};

const STYLE_INSTITUTION_TITLE = {
  font: { name: 'Arial', sz: 14, bold: true, color: { rgb: '1F4E78' } },
  alignment: { horizontal: 'center', vertical: 'center' },
};

const STYLE_SUBTITLE = {
  font: { name: 'Arial', sz: 11, bold: true, color: { rgb: '334155' } },
  alignment: { horizontal: 'center', vertical: 'center' },
};

const STYLE_META = {
  font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '475569' } },
  alignment: { horizontal: 'center', vertical: 'center' },
};

const STYLE_TABLE_HEADER = {
  font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '1F4E78' } },
  fill: { fgColor: { rgb: 'D9E1F2' } }, // Soft Institutional Blue
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: BORDER_HEADER,
};

const STYLE_CELL_LEFT = {
  font: { name: 'Arial', sz: 10, color: { rgb: '0F172A' } },
  alignment: { horizontal: 'left', vertical: 'center' },
  border: BORDER_THIN,
};

const STYLE_CELL_CENTER = {
  font: { name: 'Arial', sz: 10, color: { rgb: '0F172A' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: BORDER_THIN,
};

const STYLE_SUMMARY_HEADER = {
  font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '1F4E78' } },
  fill: { fgColor: { rgb: 'F1F5F9' } },
  alignment: { horizontal: 'left', vertical: 'center' },
  border: BORDER_THIN,
};

const STYLE_SUMMARY_LABEL = {
  font: { name: 'Arial', sz: 10, color: { rgb: '334155' } },
  alignment: { horizontal: 'left', vertical: 'center' },
  border: BORDER_THIN,
};

const STYLE_SUMMARY_VALUE = {
  font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '0F172A' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: BORDER_THIN,
};

/**
 * Calculates dynamic column autofit widths
 */
function calculateAutofitWidths(data: (string | number | undefined)[][], headerRowIdx: number): { wch: number }[] {
  const maxCol = Math.max(...data.map(r => r.length));
  const colWidths: { wch: number }[] = [];

  for (let c = 0; c < maxCol; c++) {
    let maxLen = 0;
    for (let r = 0; r < data.length; r++) {
      if (r < headerRowIdx || (data[r] && data[r].length === 1)) continue;
      const val = data[r][c];
      if (val !== undefined && val !== null) {
        const len = String(val).length;
        if (len > maxLen) maxLen = len;
      }
    }
    let wch = Math.max(maxLen + 4, 8);
    if (c === 1) wch = Math.max(wch, 28);
    colWidths.push({ wch });
  }
  return colWidths;
}

/**
 * Exports single-day course attendance to Excel (.xlsx) file
 */
export function exportDailyAttendanceXLSX(
  course: Course,
  date: string,
  students: Student[],
  dayRecord: Record<string, StudentAttendanceEntry>,
  institutionName: string = 'Escuela / Instituto'
): void {
  const wb = XLSX.utils.book_new();
  const data: (string | number | undefined)[][] = [];

  const preceptorText = course.preceptor && course.preceptor.trim() ? course.preceptor.trim() : 'S/D';
  const displayName = (institutionName && institutionName.trim() ? institutionName.trim() : 'ESCUELA / INSTITUTO').toUpperCase();

  // Title / Institution Header
  data.push([displayName]);
  data.push(['CONTROL DIARIO DE ASISTENCIA']);
  data.push([
    `Curso: ${course.name}   |   Turno: ${course.shift || 'Mañana'}   |   Preceptor/a: ${preceptorText}   |   Fecha: ${date}   |   Ciclo Lectivo: ${course.academicYear || '2026'}`,
  ]);
  data.push([]); // blank row 3

  // Table Headers (Row index 4)
  const headers = [
    'N°',
    'Alumno',
    'DNI',
    'Género',
    'Estado',
    'Detalle Asistencia',
    'Observaciones / Novedades',
  ];
  data.push(headers);

  const dataStartIdx = 5;
  students.forEach((student, index) => {
    const entry = dayRecord[student.id] || { status: null };
    const row = [
      student.listNumber || index + 1,
      formatStudentFullName(student),
      student.dni || 'S/D',
      formatGenderReport(student.genero),
      entry.status || '-',
      getStatusDescription(entry.status),
      entry.observation || '',
    ];
    data.push(row);
  });
  const dataEndIdx = dataStartIdx + students.length - 1;

  // Compute Ministerial Stats by Gender (V | M | Total)
  const vStudents = students.filter(s => formatGenderReport(s.genero) === 'V');
  const mStudents = students.filter(s => formatGenderReport(s.genero) === 'M');

  const presentV = vStudents.filter(s => dayRecord[s.id]?.status === 'P').length;
  const presentM = mStudents.filter(s => dayRecord[s.id]?.status === 'P').length;
  const presentTotal = students.filter(s => dayRecord[s.id]?.status === 'P').length;

  const absentV = vStudents.filter(s => dayRecord[s.id]?.status === 'A').length;
  const absentM = mStudents.filter(s => dayRecord[s.id]?.status === 'A').length;
  const absentTotal = students.filter(s => dayRecord[s.id]?.status === 'A').length;

  const pctV = vStudents.length > 0 ? Math.round((presentV / vStudents.length) * 100) : 0;
  const pctM = mStudents.length > 0 ? Math.round((presentM / mStudents.length) * 100) : 0;
  const pctTotal = students.length > 0 ? Math.round((presentTotal / students.length) * 100) : 0;

  // Additional detail stats
  const lateCount = students.filter(s => dayRecord[s.id]?.status === 'T').length;
  const justifiedCount = students.filter(s => dayRecord[s.id]?.status === 'J').length;
  const totalInasistenciasDia = absentTotal + justifiedCount + lateCount * 0.5;
  const total = students.length;

  data.push([]); // blank row

  // Cuadro Estadístico Ministerial (Resumen por Género)
  const minTitleIdx = data.length;
  data.push(['CUADRO ESTADÍSTICO MINISTERIAL (RESUMEN POR GÉNERO)']);
  const minHeaderIdx = data.length;
  data.push(['Métrica', 'V', 'M', 'Total']);
  const minDataStartIdx = data.length;
  data.push(['Total de Asistencia', presentV, presentM, presentTotal]);
  data.push(['Total de Inasistencia', absentV, absentM, absentTotal]);
  data.push(['% de Asistencia', `${pctV}%`, `${pctM}%`, `${pctTotal}%`]);
  const minDataEndIdx = data.length - 1;

  data.push([]); // blank row
  const summaryTitleIdx = data.length;
  data.push(['DETALLE ADICIONAL DE NOVEDADES DEL DÍA']);
  const summaryStartIdx = data.length;
  data.push(['Total Alumnos Matriculados', total]);
  data.push(['Presentes [P]', presentTotal]);
  data.push(['Tardanzas [T] (0.5 inasistencia c/u)', lateCount]);
  data.push(['Ausentes Justificados [J]', justifiedCount]);
  data.push(['Ausentes Injustificados [A]', absentTotal]);
  data.push(['Total Inasistencias Computables del Día', Number(totalInasistenciasDia.toFixed(1))]);
  const summaryEndIdx = data.length - 1;

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set Merges for Title Block, Ministerial Summary & Additional Summary
  const maxCol = headers.length - 1;
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: maxCol } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: maxCol } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: maxCol } },
    { s: { r: minTitleIdx, c: 0 }, e: { r: minTitleIdx, c: 3 } },
    { s: { r: summaryTitleIdx, c: 0 }, e: { r: summaryTitleIdx, c: 1 } },
  ];

  // Set Row Heights
  ws['!rows'] = data.map((_, rIdx) => {
    if (rIdx === 0) return { hpt: 24 };
    if (rIdx === 1) return { hpt: 18 };
    if (rIdx === 2) return { hpt: 16 };
    if (rIdx === 4 || rIdx === minHeaderIdx) return { hpt: 22 };
    return { hpt: 18 };
  });

  // Apply Cell Styling
  for (let r = 0; r < data.length; r++) {
    for (let c = 0; c <= maxCol; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (!ws[cellRef]) {
        ws[cellRef] = { t: 's', v: '' };
      }

      if (r === 0) {
        ws[cellRef].s = STYLE_INSTITUTION_TITLE;
      } else if (r === 1) {
        ws[cellRef].s = STYLE_SUBTITLE;
      } else if (r === 2) {
        ws[cellRef].s = STYLE_META;
      } else if (r === 4) {
        ws[cellRef].s = STYLE_TABLE_HEADER;
      } else if (r >= dataStartIdx && r <= dataEndIdx) {
        if (c === 1 || c === 6) {
          ws[cellRef].s = STYLE_CELL_LEFT;
        } else {
          ws[cellRef].s = STYLE_CELL_CENTER;
        }
      } else if (r === minTitleIdx && c <= 3) {
        ws[cellRef].s = STYLE_SUMMARY_HEADER;
      } else if (r === minHeaderIdx && c <= 3) {
        ws[cellRef].s = STYLE_TABLE_HEADER;
      } else if (r >= minDataStartIdx && r <= minDataEndIdx && c <= 3) {
        if (c === 0) ws[cellRef].s = STYLE_SUMMARY_LABEL;
        else ws[cellRef].s = STYLE_SUMMARY_VALUE;
      } else if (r === summaryTitleIdx && c <= 1) {
        ws[cellRef].s = STYLE_SUMMARY_HEADER;
      } else if (r >= summaryStartIdx && r <= summaryEndIdx && c <= 1) {
        if (c === 0) ws[cellRef].s = STYLE_SUMMARY_LABEL;
        else ws[cellRef].s = STYLE_SUMMARY_VALUE;
      }
    }
  }

  // Column Autofit Widths
  ws['!cols'] = calculateAutofitWidths(data, 4);

  XLSX.utils.book_append_sheet(wb, ws, 'Asistencia Diaria');
  const sanitizedCourse = course.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  docSaveFallback(wb, `Asistencia_${sanitizedCourse}_${date}.xlsx`);
}

function docSaveFallback(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

// Backward compatibility alias
export const exportDailyAttendanceCSV = exportDailyAttendanceXLSX;

/**
 * Builds the complete multi-sheet styled XLSX Workbook for the course historical matrix
 */
export function buildCourseHistoryWorkbook(
  course: Course,
  students: Student[],
  attendanceMap: AttendanceRecordMap,
  responsibleName?: string,
  institutionName: string = 'Escuela / Instituto'
): XLSX.WorkBook | null {
  const prefix = `${course.id}_`;
  const relevantKeys = Object.keys(attendanceMap).filter(k => k.startsWith(prefix));
  const dates = relevantKeys.map(k => k.substring(prefix.length)).sort();

  if (dates.length === 0 && students.length === 0) {
    return null;
  }

  const preceptorText =
    (responsibleName && responsibleName.trim()) ||
    (course.preceptor && course.preceptor.trim()) ||
    'S/D';
  const displayName = (institutionName && institutionName.trim() ? institutionName.trim() : 'ESCUELA / INSTITUTO').toUpperCase();

  let totalPresentes = 0;
  let totalTardanzas = 0;
  let totalJustificadas = 0;
  let totalInjustificadas = 0;

  const studentRowsData = students.map((student, index) => {
    let countP = 0;
    let countA = 0;
    let countT = 0;
    let countJ = 0;

    dates.forEach(date => {
      const dayRecord = attendanceMap[`${course.id}_${date}`] || {};
      const status = dayRecord[student.id]?.status;
      if (status === 'P') countP++;
      else if (status === 'A') countA++;
      else if (status === 'T') countT++;
      else if (status === 'J') countJ++;
    });

    totalPresentes += countP;
    totalTardanzas += countT;
    totalJustificadas += countJ;
    totalInjustificadas += countA;

    const totalInasistencias = countA + countT * 0.5;
    const totalClasesEstudiante = countP + countA + countT + countJ;
    const rateEstudiante = totalClasesEstudiante > 0 ? (countP / totalClasesEstudiante) * 100 : 0;

    return {
      listNumber: student.listNumber || index + 1,
      fullName: formatStudentFullName(student),
      dni: student.dni || 'S/D',
      genero: formatGenderReport(student.genero),
      countP,
      countT,
      countJ,
      countA,
      totalInasistencias: Number(totalInasistencias.toFixed(1)),
      rateEstudiante: `${Math.round(rateEstudiante)}%`,
    };
  });

  // Compute Consolidated Stats by Gender (V | M | Total)
  const matriculadosV = students.filter(s => formatGenderReport(s.genero) === 'V').length;
  const matriculadosM = students.filter(s => formatGenderReport(s.genero) === 'M').length;
  const matriculadosTotal = students.length;

  let presentesV = 0, presentesM = 0, presentesTotal = 0;
  let tardanzasV = 0, tardanzasM = 0, tardanzasTotal = 0;
  let justificadasV = 0, justificadasM = 0, justificadasTotal = 0;
  let injustificadasV = 0, injustificadasM = 0, injustificadasTotal = 0;

  students.forEach(st => {
    const g = formatGenderReport(st.genero);
    let p = 0, a = 0, t = 0, j = 0;
    dates.forEach(d => {
      const rec = attendanceMap[`${course.id}_${d}`] || {};
      const stt = rec[st.id]?.status;
      if (stt === 'P') p++;
      else if (stt === 'A') a++;
      else if (stt === 'T') t++;
      else if (stt === 'J') j++;
    });

    presentesTotal += p;
    tardanzasTotal += t;
    justificadasTotal += j;
    injustificadasTotal += a;

    if (g === 'V') {
      presentesV += p;
      tardanzasV += t;
      justificadasV += j;
      injustificadasV += a;
    } else if (g === 'M') {
      presentesM += p;
      tardanzasM += t;
      justificadasM += j;
      injustificadasM += a;
    }
  });

  const totalInasistenciasComputablesV = injustificadasV + tardanzasV * 0.5;
  const totalInasistenciasComputablesM = injustificadasM + tardanzasM * 0.5;
  const totalInasistenciasComputablesTotal = injustificadasTotal + tardanzasTotal * 0.5;

  const totalAsistenciaV = presentesV;
  const totalAsistenciaM = presentesM;
  const totalAsistenciaTotal = presentesTotal;

  const totalInasistenciaV = totalInasistenciasComputablesV;
  const totalInasistenciaM = totalInasistenciasComputablesM;
  const totalInasistenciaTotal = totalInasistenciasComputablesTotal;

  const diasCount = dates.length;
  const asistenciaMediaV = diasCount > 0 ? Number((totalAsistenciaV / diasCount).toFixed(1)) : 0;
  const asistenciaMediaM = diasCount > 0 ? Number((totalAsistenciaM / diasCount).toFixed(1)) : 0;
  const asistenciaMediaTotal = diasCount > 0 ? Number((totalAsistenciaTotal / diasCount).toFixed(1)) : 0;

  const porcentajeAsistenciaV = (totalAsistenciaV + totalInasistenciaV) > 0 ? Math.round((totalAsistenciaV / (totalAsistenciaV + totalInasistenciaV)) * 100) : 0;
  const porcentajeAsistenciaM = (totalAsistenciaM + totalInasistenciaM) > 0 ? Math.round((totalAsistenciaM / (totalAsistenciaM + totalInasistenciaM)) * 100) : 0;
  const porcentajeAsistenciaTotal = (totalAsistenciaTotal + totalInasistenciaTotal) > 0 ? Math.round((totalAsistenciaTotal / (totalAsistenciaTotal + totalInasistenciaTotal)) * 100) : 0;

  const wb = XLSX.utils.book_new();

  // ==========================================
  // PESTAÑA 1: "Histórico Acumulado"
  // ==========================================
  const dataSheet1: (string | number | undefined)[][] = [];

  // Institution Header
  dataSheet1.push([displayName]);
  dataSheet1.push(['PLANILLA DE INASISTENCIAS ACUMULADAS']);
  dataSheet1.push([
    `Curso: ${course.name}   |   Turno: ${course.shift || 'Mañana'}   |   Preceptor/a: ${preceptorText}   |   Ciclo Lectivo: ${course.academicYear || '2026'}   |   Días Registrados: ${dates.length}`,
  ]);
  dataSheet1.push([]); // blank row 3

  // Cuadro Único Consolidado: Resumen General y Cuadro Estadístico Ministerial Acumulado
  const s1MinTitleIdx = dataSheet1.length;
  dataSheet1.push(['RESUMEN GENERAL Y CUADRO ESTADÍSTICO MINISTERIAL ACUMULADO']);
  const s1MinHeaderIdx = dataSheet1.length;
  dataSheet1.push(['Métrica', 'V', 'M', 'Total']);
  const s1MinDataStartIdx = dataSheet1.length;
  dataSheet1.push(['Total Alumnos Matriculados', matriculadosV, matriculadosM, matriculadosTotal]);
  dataSheet1.push(['Presentes Totales [P]', presentesV, presentesM, presentesTotal]);
  dataSheet1.push(['Tardanzas Totales [T] (0.5 c/u)', tardanzasV, tardanzasM, tardanzasTotal]);
  dataSheet1.push(['Justificadas Totales [J]', justificadasV, justificadasM, justificadasTotal]);
  dataSheet1.push(['Injustificadas Totales [A] (Ausentes)', injustificadasV, injustificadasM, injustificadasTotal]);
  dataSheet1.push(['Total Inasistencias Computables', Number(totalInasistenciasComputablesV.toFixed(1)), Number(totalInasistenciasComputablesM.toFixed(1)), Number(totalInasistenciasComputablesTotal.toFixed(1))]);
  dataSheet1.push(['Total de Asistencia', totalAsistenciaV, totalAsistenciaM, totalAsistenciaTotal]);
  dataSheet1.push(['Total de Inasistencia', Number(totalInasistenciaV.toFixed(1)), Number(totalInasistenciaM.toFixed(1)), Number(totalInasistenciaTotal.toFixed(1))]);
  dataSheet1.push(['Asistencia Media', asistenciaMediaV, asistenciaMediaM, asistenciaMediaTotal]);
  dataSheet1.push(['Porcentaje de Asistencia General', `${porcentajeAsistenciaV}%`, `${porcentajeAsistenciaM}%`, `${porcentajeAsistenciaTotal}%`]);
  const s1MinDataEndIdx = dataSheet1.length - 1;

  dataSheet1.push([]); // blank row

  // Table Headers
  const s1HeaderRowIdx = dataSheet1.length;
  const headersSheet1 = [
    'N°',
    'Alumno',
    'DNI',
    'Género',
    'Presentes [P]',
    'Tardanzas [T]',
    'Justificadas [J]',
    'Injustificadas [A]',
    'Total Inasistencias',
    '% Asistencia',
  ];
  dataSheet1.push(headersSheet1);

  const s1DataStartIdx = dataSheet1.length;
  studentRowsData.forEach(st => {
    dataSheet1.push([
      st.listNumber,
      st.fullName,
      st.dni,
      st.genero,
      st.countP,
      st.countT,
      st.countJ,
      st.countA,
      st.totalInasistencias,
      st.rateEstudiante,
    ]);
  });
  const s1DataEndIdx = s1DataStartIdx + studentRowsData.length - 1;

  const ws1 = XLSX.utils.aoa_to_sheet(dataSheet1);
  const maxCol1 = headersSheet1.length - 1;

  ws1['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: maxCol1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: maxCol1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: maxCol1 } },
    { s: { r: s1MinTitleIdx, c: 0 }, e: { r: s1MinTitleIdx, c: 3 } },
  ];

  ws1['!rows'] = dataSheet1.map((_, rIdx) => {
    if (rIdx === 0) return { hpt: 24 };
    if (rIdx === 1) return { hpt: 18 };
    if (rIdx === 2) return { hpt: 16 };
    if (rIdx === s1HeaderRowIdx || rIdx === s1MinHeaderIdx) return { hpt: 22 };
    return { hpt: 18 };
  });

  // Apply Styling for Sheet 1
  for (let r = 0; r < dataSheet1.length; r++) {
    for (let c = 0; c <= maxCol1; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (!ws1[cellRef]) {
        ws1[cellRef] = { t: 's', v: '' };
      }

      if (r === 0) {
        ws1[cellRef].s = STYLE_INSTITUTION_TITLE;
      } else if (r === 1) {
        ws1[cellRef].s = STYLE_SUBTITLE;
      } else if (r === 2) {
        ws1[cellRef].s = STYLE_META;
      } else if (r === s1MinTitleIdx && c <= 3) {
        ws1[cellRef].s = STYLE_SUMMARY_HEADER;
      } else if (r === s1MinHeaderIdx && c <= 3) {
        ws1[cellRef].s = STYLE_TABLE_HEADER;
      } else if (r >= s1MinDataStartIdx && r <= s1MinDataEndIdx && c <= 3) {
        if (c === 0) ws1[cellRef].s = STYLE_SUMMARY_LABEL;
        else ws1[cellRef].s = STYLE_SUMMARY_VALUE;
      } else if (r === s1HeaderRowIdx) {
        ws1[cellRef].s = STYLE_TABLE_HEADER;
      } else if (r >= s1DataStartIdx && r <= s1DataEndIdx) {
        if (c === 1) ws1[cellRef].s = STYLE_CELL_LEFT;
        else ws1[cellRef].s = STYLE_CELL_CENTER;
      }
    }
  }

  ws1['!cols'] = calculateAutofitWidths(dataSheet1, s1HeaderRowIdx);
  XLSX.utils.book_append_sheet(wb, ws1, 'Histórico Acumulado');

  // ==========================================
  // PESTAÑAS MENSUALES
  // ==========================================
  const monthGroups: Record<string, string[]> = {};
  dates.forEach(date => {
    const key = date.substring(0, 7);
    if (!monthGroups[key]) monthGroups[key] = [];
    monthGroups[key].push(date);
  });

  const monthKeys = Object.keys(monthGroups).sort();

  monthKeys.forEach(monthKey => {
    const monthDates = monthGroups[monthKey];
    const [year, monthCode] = monthKey.split('-');
    const monthNameFull = SPANISH_MONTHS[monthCode] || monthCode;
    const monthNameShort = SPANISH_MONTHS_SHORT[monthCode] || monthCode;
    const tabName = `Matriz_${monthNameShort}_${year}`;

    const dataMonthSheet: (string | number | undefined)[][] = [];

    // Header block
    dataMonthSheet.push([displayName]);
    dataMonthSheet.push([`MATRIZ DE ASISTENCIA - ${monthNameFull.toUpperCase()} ${year}`]);
    dataMonthSheet.push([
      `Curso: ${course.name}   |   Turno: ${course.shift || 'Mañana'}   |   Preceptor/a: ${preceptorText}   |   Ciclo Lectivo: ${course.academicYear || '2026'}   |   Fechas del Mes: ${monthDates.length}`,
    ]);
    dataMonthSheet.push([]);

    // Compute Monthly Ministerial Stats
    let monthAsistV = 0, monthAsistM = 0, monthAsistTotal = 0;
    let monthInasistV = 0, monthInasistM = 0, monthInasistTotal = 0;

    students.forEach(st => {
      const g = formatGenderReport(st.genero);
      let p = 0, a = 0, t = 0;
      monthDates.forEach(d => {
        const rec = attendanceMap[`${course.id}_${d}`] || {};
        const stt = rec[st.id]?.status;
        if (stt === 'P') p++;
        else if (stt === 'A') a++;
        else if (stt === 'T') t++;
      });
      const inasist = a + t * 0.5;

      monthAsistTotal += p;
      monthInasistTotal += inasist;

      if (g === 'V') {
        monthAsistV += p;
        monthInasistV += inasist;
      } else if (g === 'M') {
        monthAsistM += p;
        monthInasistM += inasist;
      }
    });

    const monthDatesCount = monthDates.length;
    const monthAsistMediaV = monthDatesCount > 0 ? Number((monthAsistV / monthDatesCount).toFixed(1)) : 0;
    const monthAsistMediaM = monthDatesCount > 0 ? Number((monthAsistM / monthDatesCount).toFixed(1)) : 0;
    const monthAsistMediaTotal = monthDatesCount > 0 ? Number((monthAsistTotal / monthDatesCount).toFixed(1)) : 0;

    const monthPctV = (monthAsistV + monthInasistV) > 0 ? Math.round((monthAsistV / (monthAsistV + monthInasistV)) * 100) : 0;
    const monthPctM = (monthAsistM + monthInasistM) > 0 ? Math.round((monthAsistM / (monthAsistM + monthInasistM)) * 100) : 0;
    const monthPctTotal = (monthAsistTotal + monthInasistTotal) > 0 ? Math.round((monthAsistTotal / (monthAsistTotal + monthInasistTotal)) * 100) : 0;

    const mMinTitleIdx = dataMonthSheet.length;
    dataMonthSheet.push([`CUADRO ESTADÍSTICO MINISTERIAL - ${monthNameFull.toUpperCase()} ${year}`]);
    const mMinHeaderIdx = dataMonthSheet.length;
    dataMonthSheet.push(['Métrica', 'V', 'M', 'Total']);
    const mMinDataStartIdx = dataMonthSheet.length;
    dataMonthSheet.push(['Total de Asistencia', monthAsistV, monthAsistM, monthAsistTotal]);
    dataMonthSheet.push(['Total de Inasistencia', Number(monthInasistV.toFixed(1)), Number(monthInasistM.toFixed(1)), Number(monthInasistTotal.toFixed(1))]);
    dataMonthSheet.push(['Asistencia Media', monthAsistMediaV, monthAsistMediaM, monthAsistMediaTotal]);
    dataMonthSheet.push(['% de Asistencia', `${monthPctV}%`, `${monthPctM}%`, `${monthPctTotal}%`]);
    const mMinDataEndIdx = dataMonthSheet.length - 1;

    dataMonthSheet.push([]);

    const formattedMonthDateHeaders = monthDates.map(formatDateHeader);

    const mHeaderRowIdx = dataMonthSheet.length;
    const headersMonth = [
      'N°',
      'Alumno',
      'DNI',
      'Género',
      ...formattedMonthDateHeaders,
    ];
    dataMonthSheet.push(headersMonth);

    const mDataStartIdx = dataMonthSheet.length;
    students.forEach((student, index) => {
      const dateStatuses = monthDates.map(date => {
        const dayRecord = attendanceMap[`${course.id}_${date}`] || {};
        const status = dayRecord[student.id]?.status;
        return status || '-';
      });

      const row = [
        student.listNumber || index + 1,
        formatStudentFullName(student),
        student.dni || 'S/D',
        formatGenderReport(student.genero),
        ...dateStatuses,
      ];
      dataMonthSheet.push(row);
    });
    const mDataEndIdx = mDataStartIdx + students.length - 1;

    const wsMonth = XLSX.utils.aoa_to_sheet(dataMonthSheet);
    const maxColMonth = headersMonth.length - 1;

    wsMonth['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: maxColMonth } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: maxColMonth } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: maxColMonth } },
      { s: { r: mMinTitleIdx, c: 0 }, e: { r: mMinTitleIdx, c: 3 } },
    ];

    wsMonth['!rows'] = dataMonthSheet.map((_, rIdx) => {
      if (rIdx === 0) return { hpt: 24 };
      if (rIdx === 1) return { hpt: 18 };
      if (rIdx === 2) return { hpt: 16 };
      if (rIdx === mHeaderRowIdx || rIdx === mMinHeaderIdx) return { hpt: 22 };
      return { hpt: 18 };
    });

    for (let r = 0; r < dataMonthSheet.length; r++) {
      for (let c = 0; c <= maxColMonth; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!wsMonth[cellRef]) {
          wsMonth[cellRef] = { t: 's', v: '' };
        }

        if (r === 0) {
          wsMonth[cellRef].s = STYLE_INSTITUTION_TITLE;
        } else if (r === 1) {
          wsMonth[cellRef].s = STYLE_SUBTITLE;
        } else if (r === 2) {
          wsMonth[cellRef].s = STYLE_META;
        } else if (r === mMinTitleIdx && c <= 3) {
          wsMonth[cellRef].s = STYLE_SUMMARY_HEADER;
        } else if (r === mMinHeaderIdx && c <= 3) {
          wsMonth[cellRef].s = STYLE_TABLE_HEADER;
        } else if (r >= mMinDataStartIdx && r <= mMinDataEndIdx && c <= 3) {
          if (c === 0) wsMonth[cellRef].s = STYLE_SUMMARY_LABEL;
          else wsMonth[cellRef].s = STYLE_SUMMARY_VALUE;
        } else if (r === mHeaderRowIdx) {
          wsMonth[cellRef].s = STYLE_TABLE_HEADER;
        } else if (r >= mDataStartIdx && r <= mDataEndIdx) {
          if (c === 1) wsMonth[cellRef].s = STYLE_CELL_LEFT;
          else wsMonth[cellRef].s = STYLE_CELL_CENTER;
        }
      }
    }

    wsMonth['!cols'] = calculateAutofitWidths(dataMonthSheet, mHeaderRowIdx);
    XLSX.utils.book_append_sheet(wb, wsMonth, tabName);
  });

  return wb;
}

/**
 * Generates the base64 string of the styled multi-sheet XLSX Workbook
 */
export function generateCourseHistoryXLSXBase64(
  course: Course,
  students: Student[],
  attendanceMap: AttendanceRecordMap,
  responsibleName?: string,
  institutionName: string = 'Escuela / Instituto'
): string | null {
  const wb = buildCourseHistoryWorkbook(course, students, attendanceMap, responsibleName, institutionName);
  if (!wb) return null;
  return XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
}

/**
 * Downloads the styled multi-sheet XLSX Workbook locally
 */
export function exportCourseHistoryMatrixXLSX(
  course: Course,
  students: Student[],
  attendanceMap: AttendanceRecordMap,
  responsibleName?: string,
  institutionName: string = 'Escuela / Instituto'
): boolean {
  const wb = buildCourseHistoryWorkbook(course, students, attendanceMap, responsibleName, institutionName);
  if (!wb) return false;

  const sanitizedCourse = course.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `Planilla_Inasistencias_${sanitizedCourse}_${course.academicYear || '2026'}.xlsx`);
  return true;
}

// Backward compatibility alias
export const exportCourseHistoryMatrixCSV = exportCourseHistoryMatrixXLSX;
export const exportHistoricalToCSV = exportCourseHistoryMatrixXLSX;

/**
 * Detailed daily breakdown matrix export (.xlsx) with all dates and summary
 */
export function exportCourseDailyBreakdownMatrixXLSX(
  course: Course,
  students: Student[],
  attendanceMap: AttendanceRecordMap,
  institutionName?: string
): boolean {
  return exportCourseHistoryMatrixXLSX(course, students, attendanceMap, undefined, institutionName);
}

export const exportCourseDailyBreakdownMatrixCSV = exportCourseDailyBreakdownMatrixXLSX;
