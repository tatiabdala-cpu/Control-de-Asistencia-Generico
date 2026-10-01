import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Course, Student, StudentAttendanceEntry, AttendanceRecordMap } from '../types';
import { formatGenderReport } from './studentSorting';

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
 * Formats YYYY-MM-DD date into DD/MM (e.g. 2026-09-24 -> 24/09)
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

/**
 * Adds Header block to a PDF page
 */
function drawPDFHeader(
  doc: jsPDF,
  institutionName: string,
  subtitle: string,
  course: Course,
  extraMeta?: string
) {
  const preceptorText = course.preceptor && course.preceptor.trim() ? course.preceptor.trim() : 'S/D';
  const pageWidth = doc.internal.pageSize.getWidth();
  const displayName = (institutionName && institutionName.trim() ? institutionName.trim() : 'ESCUELA / INSTITUTO').toUpperCase();

  // Top Accent Bar
  doc.setFillColor(31, 78, 120); // Institutional Dark Blue #1F4E78
  doc.rect(0, 0, pageWidth, 5, 'F');

  // Title (Dynamic Institution Name)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(31, 78, 120);
  doc.text(displayName, pageWidth / 2, 13, { align: 'center' });

  // Subtitle
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105); // Slate-600
  doc.text(subtitle.toUpperCase(), pageWidth / 2, 18, { align: 'center' });

  // Metadata Bar Box
  const metaText = `Curso: ${course.name}   |   Turno: ${course.shift || 'Mañana'}   |   Preceptor/a: ${preceptorText}   |   Ciclo Lectivo: ${course.academicYear || '2026'}${extraMeta ? `   |   ${extraMeta}` : ''}`;
  
  doc.setFillColor(241, 245, 249); // Slate-100
  doc.roundedRect(12, 21, pageWidth - 24, 7, 1.5, 1.5, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text(metaText, pageWidth / 2, 25.5, { align: 'center' });
}

/**
 * Adds Footers (timestamps, page numbers, signature line) to all pages of doc
 */
function addPDFFooters(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  const timestampText = `Emitido el ${day}/${month}/${year} a las ${hours}:${mins} hs`;

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Signature Space on the last page
    if (i === totalPages) {
      const sigY = pageHeight - 20;
      doc.setDrawColor(148, 163, 184); // Slate-400
      doc.setLineWidth(0.3);
      doc.line(pageWidth - 85, sigY, pageWidth - 15, sigY);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text('Firma Preceptor/a / Dirección', pageWidth - 50, sigY + 4, { align: 'center' });
    }

    // Bottom Footer Line
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.setLineWidth(0.2);
    doc.line(12, pageHeight - 9, pageWidth - 12, pageHeight - 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);

    // Left timestamp
    doc.text(timestampText, 12, pageHeight - 4.5);

    // Right page numbering
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - 12, pageHeight - 4.5, { align: 'right' });
  }
}

/**
 * Exports single-day course attendance to a beautifully formatted PDF document (Landscape A4)
 */
export function exportDailyAttendancePDF(
  course: Course,
  date: string,
  students: Student[],
  dayRecord: Record<string, StudentAttendanceEntry>,
  institutionName: string = 'Escuela / Instituto'
): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  drawPDFHeader(doc, institutionName, 'CONTROL DIARIO DE ASISTENCIA', course, `Fecha: ${date}`);

  const tableBody = students.map((student, index) => {
    const entry = dayRecord[student.id] || { status: null };
    return [
      student.listNumber || index + 1,
      formatStudentFullName(student),
      student.dni || 'S/D',
      formatGenderReport(student.genero),
      entry.status || '-',
      getStatusDescription(entry.status),
      entry.observation || '-',
    ];
  });

  autoTable(doc, {
    startY: 31,
    margin: { left: 12, right: 12 },
    head: [['N°', 'Alumno', 'DNI', 'G', 'Estado', 'Detalle Asistencia', 'Observaciones / Novedades']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [31, 78, 120],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
      valign: 'middle',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [15, 23, 42],
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },  // N°
      1: { halign: 'left', cellWidth: 62, fontStyle: 'bold' }, // Alumno
      2: { halign: 'center', cellWidth: 24 },  // DNI
      3: { halign: 'center', cellWidth: 10, fontStyle: 'bold' }, // G (Género)
      4: { halign: 'center', cellWidth: 18, fontStyle: 'bold' }, // Estado
      5: { halign: 'center', cellWidth: 42 },  // Detalle
      6: { halign: 'left', cellWidth: 'auto' }, // Observaciones
    },
  });

  // Calculate Ministerial stats by Gender (V | M | Total)
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

  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 120;

  // Add Cuadro Estadístico Ministerial (Resumen por Género) below
  autoTable(doc, {
    startY: finalY + 5,
    margin: { left: 12 },
    tableWidth: 155,
    head: [['CUADRO ESTADÍSTICO MINISTERIAL (RESUMEN POR GÉNERO)', 'V', 'M', 'TOTAL']],
    body: [
      ['Total de Asistencia', presentV.toString(), presentM.toString(), presentTotal.toString()],
      ['Total de Inasistencia', absentV.toString(), absentM.toString(), absentTotal.toString()],
      ['% de Asistencia', `${pctV}%`, `${pctM}%`, `${pctTotal}%`],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [31, 78, 120],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      valign: 'middle',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [15, 23, 42],
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 74 },
      1: { halign: 'center', cellWidth: 26 },
      2: { halign: 'center', cellWidth: 26 },
      3: { halign: 'center', cellWidth: 29, fontStyle: 'bold' },
    },
  });

  // Additional Day Summary Table
  autoTable(doc, {
    startY: finalY + 5,
    margin: { left: 175 },
    tableWidth: 110,
    head: [['DETALLE ADICIONAL DEL DÍA', 'VALOR']],
    body: [
      ['Total Alumnos Matriculados', total.toString()],
      ['Tardanzas [T] (0.5 c/u)', lateCount.toString()],
      ['Ausentes Justificados [J]', justifiedCount.toString()],
      ['Total Inasistencias Computables', totalInasistenciasDia.toFixed(1).replace('.', ',')],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [71, 85, 105],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 75 },
      1: { halign: 'center', cellWidth: 35, fontStyle: 'bold' },
    },
  });

  addPDFFooters(doc);

  const sanitizedCourse = course.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Asistencia_${sanitizedCourse}_${date}.pdf`);
}

/**
 * Exports full accumulated course history & monthly matrix report to PDF (Landscape A4)
 */
export function exportCourseHistoryMatrixPDF(
  course: Course,
  students: Student[],
  attendanceMap: AttendanceRecordMap,
  institutionName: string = 'Escuela / Instituto'
): boolean {
  const prefix = `${course.id}_`;
  const relevantKeys = Object.keys(attendanceMap).filter(k => k.startsWith(prefix));
  const dates = relevantKeys.map(k => k.substring(prefix.length)).sort();

  if (dates.length === 0) {
    return false;
  }

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

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
      totalInasistencias: totalInasistencias.toFixed(1).replace('.', ','),
      rateEstudiante: `${Math.round(rateEstudiante)}%`,
    };
  });

  const totalStudents = students.length;
  const totalInasistenciasComputables = totalInjustificadas + totalTardanzas * 0.5;
  const totalClasesPosibles = Math.max(
    totalStudents * dates.length,
    totalPresentes + totalTardanzas + totalJustificadas + totalInjustificadas
  );
  const porcentajeGlobal = totalClasesPosibles > 0 ? (totalPresentes / totalClasesPosibles) * 100 : 0;

  // Compute Ministerial Stats by Gender (V | M | Total)
  let asistV = 0, asistM = 0, asistTotal = 0;
  let inasistV = 0, inasistM = 0, inasistTotal = 0;

  students.forEach(st => {
    const g = formatGenderReport(st.genero);
    let p = 0, a = 0, t = 0;
    dates.forEach(d => {
      const rec = attendanceMap[`${course.id}_${d}`] || {};
      const stt = rec[st.id]?.status;
      if (stt === 'P') p++;
      else if (stt === 'A') a++;
      else if (stt === 'T') t++;
    });
    const inasist = a + t * 0.5;

    asistTotal += p;
    inasistTotal += inasist;

    if (g === 'V') {
      asistV += p;
      inasistV += inasist;
    } else if (g === 'M') {
      asistM += p;
      inasistM += inasist;
    }
  });

  const diasCount = dates.length;
  const asistMediaV = diasCount > 0 ? (asistV / diasCount) : 0;
  const asistMediaM = diasCount > 0 ? (asistM / diasCount) : 0;
  const asistMediaTotal = diasCount > 0 ? (asistTotal / diasCount) : 0;

  const pctV = (asistV + inasistV) > 0 ? Math.round((asistV / (asistV + inasistV)) * 100) : 0;
  const pctM = (asistM + inasistM) > 0 ? Math.round((asistM / (asistM + inasistM)) * 100) : 0;
  const pctTotal = (asistTotal + inasistTotal) > 0 ? Math.round((asistTotal / (asistTotal + inasistTotal)) * 100) : 0;

  // ==========================================
  // PAGE 1: "HISTÓRICO ACUMULADO"
  // ==========================================
  drawPDFHeader(
    doc,
    institutionName,
    'INFORME DE INASISTENCIAS ACUMULADAS',
    course,
    `Fechas Registradas: ${dates.length}`
  );

  // Cuadro Estadístico Ministerial Top Left
  autoTable(doc, {
    startY: 31,
    margin: { left: 12 },
    tableWidth: 160,
    head: [['CUADRO ESTADÍSTICO MINISTERIAL (RESUMEN POR GÉNERO)', 'V', 'M', 'TOTAL']],
    body: [
      ['Total de Asistencia', asistV.toString(), asistM.toString(), asistTotal.toString()],
      ['Total de Inasistencia', inasistV.toFixed(1).replace('.', ','), inasistM.toFixed(1).replace('.', ','), inasistTotal.toFixed(1).replace('.', ',')],
      ['Asistencia Media', asistMediaV.toFixed(1).replace('.', ','), asistMediaM.toFixed(1).replace('.', ','), asistMediaTotal.toFixed(1).replace('.', ',')],
      ['% de Asistencia', `${pctV}%`, `${pctM}%`, `${pctTotal}%`],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [31, 78, 120],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      valign: 'middle',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [15, 23, 42],
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 70 },
      1: { halign: 'center', cellWidth: 30 },
      2: { halign: 'center', cellWidth: 30 },
      3: { halign: 'center', cellWidth: 30, fontStyle: 'bold' },
    },
  });

  // Additional Summary Top Right
  autoTable(doc, {
    startY: 31,
    margin: { left: 180 },
    tableWidth: 105,
    head: [['RESUMEN GENERAL DEL CURSO', 'VALOR']],
    body: [
      ['Total Alumnos Matriculados', totalStudents.toString()],
      ['Tardanzas Totales [T]', totalTardanzas.toString()],
      ['Justificadas Totales [J]', totalJustificadas.toString()],
      ['Injustificadas Totales [A]', totalInjustificadas.toString()],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [71, 85, 105],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 70 },
      1: { halign: 'center', cellWidth: 35, fontStyle: 'bold' },
    },
  });

  const s1FinalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 75;

  // Accumulated Student Totals Table
  autoTable(doc, {
    startY: s1FinalY + 6,
    margin: { left: 12, right: 12 },
    head: [['N°', 'Alumno', 'DNI', 'G', 'Presentes [P]', 'Tardanzas [T]', 'Justificadas [J]', 'Injustificadas [A]', 'Total Inasistencias', '% Asistencia']],
    body: studentRowsData.map(st => [
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
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: [31, 78, 120],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      valign: 'middle',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [15, 23, 42],
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'left', cellWidth: 62, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 24 },
      3: { halign: 'center', cellWidth: 10, fontStyle: 'bold' },
      4: { halign: 'center', cellWidth: 23 },
      5: { halign: 'center', cellWidth: 23 },
      6: { halign: 'center', cellWidth: 23 },
      7: { halign: 'center', cellWidth: 24 },
      8: { halign: 'center', cellWidth: 30, fontStyle: 'bold' },
      9: { halign: 'center', cellWidth: 22, fontStyle: 'bold' },
    },
  });

  // ==========================================
  // PAGES FOR MONTHLY MATRICES
  // ==========================================
  const monthGroups: Record<string, string[]> = {};
  dates.forEach(date => {
    const key = date.substring(0, 7);
    if (!monthGroups[key]) monthGroups[key] = [];
    monthGroups[key].push(date);
  });

  const monthKeys = Object.keys(monthGroups).sort();

  monthKeys.forEach(monthKey => {
    doc.addPage('a4', 'landscape');

    const monthDates = monthGroups[monthKey];
    const [year, monthCode] = monthKey.split('-');
    const monthNameFull = SPANISH_MONTHS[monthCode] || monthCode;

    drawPDFHeader(
      doc,
      institutionName,
      `MATRIZ DE ASISTENCIA DIARIA - ${monthNameFull.toUpperCase()} ${year}`,
      course,
      `Fechas en el Mes: ${monthDates.length}`
    );

    const dateHeaders = monthDates.map(formatDateHeader);

    const monthTableBody = students.map((student, index) => {
      const statuses = monthDates.map(date => {
        const dayRecord = attendanceMap[`${course.id}_${date}`] || {};
        return dayRecord[student.id]?.status || '-';
      });

      return [
        student.listNumber || index + 1,
        formatStudentFullName(student),
        student.dni || 'S/D',
        formatGenderReport(student.genero),
        ...statuses,
      ];
    });

    const fixedColsWidth = 10 + 58 + 20 + 10;
    const availableForDates = 273 - fixedColsWidth;
    const colCount = dateHeaders.length;
    const dateColWidth = Math.max(Math.min(availableForDates / colCount, 12), 6.5);
    const fontSize = colCount > 22 ? 6.5 : colCount > 15 ? 7 : 7.5;

    const columnStylesConfig: Record<number, any> = {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'left', cellWidth: 58, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 20 },
      3: { halign: 'center', cellWidth: 10, fontStyle: 'bold' },
    };

    dateHeaders.forEach((_, idx) => {
      columnStylesConfig[4 + idx] = { halign: 'center', cellWidth: dateColWidth };
    });

    autoTable(doc, {
      startY: 31,
      margin: { left: 12, right: 12 },
      head: [['N°', 'Alumno', 'DNI', 'G', ...dateHeaders]],
      body: monthTableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [31, 78, 120],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: fontSize,
        halign: 'center',
        valign: 'middle',
      },
      bodyStyles: {
        fontSize: fontSize,
        textColor: [15, 23, 42],
        valign: 'middle',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: columnStylesConfig,
    });
  });

  addPDFFooters(doc);

  const sanitizedCourse = course.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Planilla_Asistencia_${sanitizedCourse}_${course.academicYear || '2026'}.pdf`);
  return true;
}

export interface StudentPdfExportOptions {
  includeSummary?: boolean;
  categories?: {
    present?: boolean;
    absences?: boolean;
    late?: boolean;
    discipline?: boolean;
  };
  dateRangeMode?: 'all' | 'current_month' | 'custom';
  startDate?: string;
  endDate?: string;
}

/**
 * Exports individual student report in Portrait A4 PDF format with options
 */
export function exportStudentProfilePDF(
  student: Student,
  course: Course,
  attendanceMap: AttendanceRecordMap,
  institutionName: string = 'Escuela / Instituto',
  options: StudentPdfExportOptions = {}
): void {
  const {
    includeSummary = true,
    categories = { present: true, absences: true, late: true, discipline: true },
    dateRangeMode = 'all',
    startDate,
    endDate,
  } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const preceptorText = course.preceptor && course.preceptor.trim() ? course.preceptor.trim() : 'S/D';
  const pageWidth = doc.internal.pageSize.getWidth();
  const displayName = (institutionName && institutionName.trim() ? institutionName.trim() : 'ESCUELA / INSTITUTO').toUpperCase();

  // Top Accent Bar
  doc.setFillColor(31, 78, 120); // Institutional Dark Blue #1F4E78
  doc.rect(0, 0, pageWidth, 5, 'F');

  // Title (Dynamic Institution Name)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(31, 78, 120);
  doc.text(displayName, pageWidth / 2, 13, { align: 'center' });

  // Subtitle
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105); // Slate-600
  doc.text('INFORME INDIVIDUAL DE ASISTENCIA Y CONDUCTA', pageWidth / 2, 18, { align: 'center' });

  // Student Info & Metadata Box
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const dateEmision = `${day}/${month}/${year}`;

  let periodLabel = 'Todo el Año';
  if (dateRangeMode === 'current_month') {
    const monthNameFull = SPANISH_MONTHS[month] || month;
    periodLabel = `Mes: ${monthNameFull} ${year}`;
  } else if (dateRangeMode === 'custom' && startDate && endDate) {
    periodLabel = `Período: ${formatDateHeader(startDate)} al ${formatDateHeader(endDate)}`;
  }

  doc.setFillColor(241, 245, 249); // Slate-100
  doc.roundedRect(12, 21, pageWidth - 24, 16, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42); // Slate-900

  // Line 1: Student info
  const fullName = formatStudentFullName(student);
  const line1 = `Alumno/a: ${fullName}   |   DNI: ${student.dni || 'S/D'}   |   N° Lista: ${student.listNumber || '-'}`;
  doc.text(line1, 15, 27);

  // Line 2: Course & Preceptor info
  const line2 = `Curso: ${course.name} (${course.shift || 'Mañana'})   |   Preceptor/a: ${preceptorText}   |   Rango: ${periodLabel}   |   Emisión: ${dateEmision}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(line2, 15, 33);

  // Collect history and stats
  const prefix = `${course.id}_`;
  let dates: string[] = [];
  Object.keys(attendanceMap).forEach(key => {
    if (key.startsWith(prefix)) {
      const d = key.substring(prefix.length);
      if (d && !dates.includes(d)) dates.push(d);
    }
  });

  // Apply Date Range Filter
  if (dateRangeMode === 'current_month') {
    const currentMonthPrefix = `${year}-${month}`;
    dates = dates.filter(d => d.startsWith(currentMonthPrefix));
  } else if (dateRangeMode === 'custom' && startDate && endDate) {
    dates = dates.filter(d => d >= startDate && d <= endDate);
  }

  dates.sort().reverse();

  let present = 0;
  let absent = 0;
  let late = 0;
  let justified = 0;
  let indisciplines = 0;

  const historyRows: Array<[string, string, string, string]> = [];

  dates.forEach(d => {
    const dayRecord = attendanceMap[`${course.id}_${d}`] || {};
    const entry = dayRecord[student.id];
    if (!entry) return;

    const st = entry.status;
    const obs = entry.observation?.trim() || '';
    const isDisc = Boolean(
      entry.isDiscipline ||
      obs.toLowerCase().includes('indisciplina') ||
      obs.toLowerCase().includes('sanción') ||
      obs.toLowerCase().includes('falta de conducta')
    );

    if (st === 'P') present++;
    else if (st === 'A') absent++;
    else if (st === 'T') late++;
    else if (st === 'J') justified++;

    if (isDisc) indisciplines++;

    let matchesCategory = false;
    if (categories.present && st === 'P') matchesCategory = true;
    if (categories.absences && (st === 'A' || st === 'J')) matchesCategory = true;
    if (categories.late && st === 'T') matchesCategory = true;
    if (categories.discipline && (isDisc || obs !== '')) matchesCategory = true;

    if (matchesCategory) {
      let statusDesc = 'Sin registrar';
      if (st === 'P') statusDesc = 'Presente';
      else if (st === 'A') statusDesc = 'Ausente Injust.';
      else if (st === 'T') statusDesc = 'Tardanza (0.5)';
      else if (st === 'J') statusDesc = 'Ausente Justif.';

      historyRows.push([
        formatDateHeader(d),
        statusDesc,
        isDisc ? 'INDISCIPLINA' : 'Asistencia',
        obs || '-',
      ]);
    }
  });

  const totalAusentes = absent + justified;
  const totalInasistencias = totalAusentes + (late * 0.5);
  const totalEvaluated = present + absent + late + justified;
  const rate = totalEvaluated > 0 ? Math.round((present / totalEvaluated) * 100) : 0;

  let currentY = 40;

  // Render Summary Table if checked
  if (includeSummary) {
    autoTable(doc, {
      startY: currentY,
      margin: { left: 12, right: 12 },
      head: [['RESUMEN DE ASISTENCIA Y CONDUCTA', 'TOTALES / PORCENTAJE']],
      body: [
        ['Porcentaje de Asistencia General', `${rate}%`],
        ['Días Presente [P]', present.toString()],
        ['Ausencias Injustificadas [A]', absent.toString()],
        ['Ausentes Justificados [J]', justified.toString()],
        ['Tardanzas [T] (0.5 inasistencia c/u)', `${late} (${(late * 0.5).toFixed(1).replace('.', ',')} faltas)`],
        ['Total Inasistencias Computables', totalInasistencias.toFixed(1).replace('.', ',')],
        ['Indisciplinas / Faltas de Conducta', indisciplines.toString()],
      ],
      theme: 'grid',
      headStyles: {
        fillColor: [31, 78, 120],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'left',
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [15, 23, 42],
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 120 },
        1: { halign: 'center', cellWidth: 'auto', fontStyle: 'bold' },
      },
    });

    currentY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 6 : 90;
  }

  // Title for Filtered History
  let historySectionTitle = 'HISTORIAL DETALLADO DE ASISTENCIAS, OBSERVACIONES E INDISCIPLINAS';
  const allChecked = categories.present && categories.absences && categories.late && categories.discipline;

  if (!allChecked) {
    const selectedLabels: string[] = [];
    if (categories.present) selectedLabels.push('Presentes');
    if (categories.absences) selectedLabels.push('Inasistencias');
    if (categories.late) selectedLabels.push('Tardanzas');
    if (categories.discipline) selectedLabels.push('Observaciones/Conducta');

    if (selectedLabels.length > 0) {
      historySectionTitle = `HISTORIAL FILTRADO: ${selectedLabels.join(', ').toUpperCase()}`;
    } else {
      historySectionTitle = 'HISTORIAL FILTRADO (SIN CATEGORÍAS SELECCIONADAS)';
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(31, 78, 120);
  doc.text(historySectionTitle, 12, currentY);

  // History Table
  autoTable(doc, {
    startY: currentY + 3,
    margin: { left: 12, right: 12 },
    head: [['Fecha', 'Estado', 'Tipo', 'Observaciones / Detalle de la Novedad']],
    body: historyRows.length > 0 ? historyRows : [['-', 'Sin registros', '-', 'No se encuentran registros con los filtros seleccionados']],
    theme: 'grid',
    headStyles: {
      fillColor: [71, 85, 105],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      valign: 'middle',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [15, 23, 42],
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 20 },
      1: { halign: 'center', cellWidth: 32 },
      2: { halign: 'center', cellWidth: 30, fontStyle: 'bold' },
      3: { halign: 'left', cellWidth: 'auto' },
    },
    didParseCell: (dataCell) => {
      if (dataCell.section === 'body' && dataCell.column.index === 2) {
        if (dataCell.cell.raw === 'INDISCIPLINA') {
          dataCell.cell.styles.textColor = [225, 29, 72]; // Rose-600
        }
      }
    },
  });

  addPDFFooters(doc);

  const safeStudentName = `${student.lastName}_${student.firstName}`.replace(/[\s/\\?%*:|"<>]/g, '_');
  doc.save(`Ficha_Alumno_${safeStudentName}_${day}-${month}-${year}.pdf`);
}
