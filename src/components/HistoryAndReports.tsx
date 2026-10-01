import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Check,
  AlertCircle,
  BarChart3,
  ShieldAlert,
  FileText,
  Percent,
  UserX,
  Clock,
  Loader2,
  Users,
  Mars,
  Venus,
  HelpCircle,
} from 'lucide-react';
import { AttendanceRecordMap, Course, Student, AttendanceStatus, SchoolConfig, GenderFilterType } from '../types';
import {
  exportDailyAttendanceXLSX,
  exportCourseHistoryMatrixXLSX,
  formatDecimalSpanish,
} from '../utils/excel';
import { exportDailyAttendancePDF, exportCourseHistoryMatrixPDF } from '../utils/pdf';
import { getTodayDateString } from '../utils/storage';
import { normalizeStudentGender } from '../utils/studentSorting';
import { StudentProfileModal } from './StudentProfileModal';

interface HistoryAndReportsProps {
  courses: Course[];
  students: Student[];
  attendanceMap: AttendanceRecordMap;
  onUpdateAttendance?: (
    courseId: string,
    date: string,
    studentId: string,
    status: AttendanceStatus,
    observation?: string,
    isDiscipline?: boolean
  ) => void;
  selectedCourseId?: string;
  onSelectCourse?: (courseId: string) => void;
  config?: SchoolConfig;
}

export const HistoryAndReports: React.FC<HistoryAndReportsProps> = ({
  courses,
  students,
  attendanceMap,
  selectedCourseId: controlledSelectedCourseId,
  onSelectCourse: controlledOnSelectCourse,
  onUpdateAttendance,
  config,
}) => {
  const [internalSelectedCourseId, setInternalSelectedCourseId] = useState<string>(
    controlledSelectedCourseId || courses[0]?.id || ''
  );
  const selectedCourseId =
    controlledSelectedCourseId !== undefined
      ? controlledSelectedCourseId
      : internalSelectedCourseId;

  const handleCourseChange = (id: string) => {
    setInternalSelectedCourseId(id);
    controlledOnSelectCourse?.(id);
  };

  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayDateString());
  const [tableMode, setTableMode] = useState<'daily' | 'history'>('daily');
  const [filtroGeneroVista, setFiltroGeneroVista] = useState<GenderFilterType>('todos');
  const [selectedStudentForModal, setSelectedStudentForModal] = useState<Student | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'warning' } | null>(null);

  const showToast = (text: string, type: 'success' | 'warning' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 5000);
  };

  const selectedCourse = courses.find(c => c.id === selectedCourseId) || courses[0];

  const courseStudents = useMemo(() => {
    if (!selectedCourse) return [];
    return students
      .filter(s => s.courseId === selectedCourse.id && s.active)
      .sort((a, b) => {
        if (a.listNumber && b.listNumber) return a.listNumber - b.listNumber;
        return a.lastName.localeCompare(b.lastName);
      });
  }, [students, selectedCourse]);

  // Dynamic subset filtered by gender
  const genderFilteredStudents = useMemo(() => {
    if (filtroGeneroVista === 'todos') return courseStudents;
    return courseStudents.filter(st => normalizeStudentGender(st.genero) === filtroGeneroVista);
  }, [courseStudents, filtroGeneroVista]);

  // Extract all distinct dates recorded for this course
  const recordedDates = useMemo(() => {
    if (!selectedCourse) return [];
    const prefix = `${selectedCourse.id}_`;
    return Object.keys(attendanceMap)
      .filter(k => k.startsWith(prefix))
      .map(k => k.substring(prefix.length))
      .sort()
      .reverse(); // most recent first
  }, [attendanceMap, selectedCourse]);

  const activeDate = selectedDate || getTodayDateString();

  const dayRecord = useMemo(() => {
    if (!selectedCourse || !activeDate) return {};
    return attendanceMap[`${selectedCourse.id}_${activeDate}`] || {};
  }, [attendanceMap, selectedCourse, activeDate]);

  // Cumulative historical stats per student
  const studentHistoryStats = useMemo(() => {
    if (!selectedCourse) return {};

    const stats: Record<
      string,
      {
        present: number;
        absent: number;
        late: number;
        justified: number;
        indisciplines: number;
        totalInasistencias: number;
        totalEvaluated: number;
        rate: number;
      }
    > = {};

    courseStudents.forEach(st => {
      let present = 0;
      let absent = 0;
      let late = 0;
      let justified = 0;
      let indisciplines = 0;

      recordedDates.forEach(date => {
        const record = attendanceMap[`${selectedCourse.id}_${date}`] || {};
        const entry = record[st.id];
        if (entry?.status === 'P') present++;
        else if (entry?.status === 'A') absent++;
        else if (entry?.status === 'T') late++;
        else if (entry?.status === 'J') justified++;

        if (
          entry?.isDiscipline ||
          entry?.observation?.toLowerCase().includes('indisciplina') ||
          entry?.observation?.toLowerCase().includes('sanción') ||
          entry?.observation?.toLowerCase().includes('falta de conducta')
        ) {
          indisciplines++;
        }
      });

      // Business rule: Total Inasistencias Computables = Injustificadas ('A') + (Tardanzas * 0.5)
      const totalInasistencias = absent + (late * 0.5);
      const totalEvaluated = present + absent + late + justified;
      const rate = totalEvaluated > 0 ? Math.round((present / totalEvaluated) * 100) : 0;

      stats[st.id] = {
        present,
        absent,
        late,
        justified,
        indisciplines,
        totalInasistencias,
        totalEvaluated,
        rate,
      };
    });

    return stats;
  }, [selectedCourse, courseStudents, recordedDates, attendanceMap]);

  // Dynamic stats for the 3 Dashboard Cards (adapts to 'daily' or 'history')
  const dashboardStats = useMemo(() => {
    if (!selectedCourse) {
      return {
        rate: 0,
        totalInasistencias: 0,
        totalTardanzas: 0,
        totalPresent: 0,
        totalAbsent: 0,
        totalJustified: 0,
        totalEvaluated: 0,
      };
    }

    if (tableMode === 'daily') {
      let present = 0;
      let absent = 0; // Injustificadas ('A')
      let late = 0; // Tardanzas ('T')
      let justified = 0; // Justificadas ('J')

      genderFilteredStudents.forEach(st => {
        const entry = dayRecord[st.id];
        if (entry?.status === 'P') present++;
        else if (entry?.status === 'A') absent++;
        else if (entry?.status === 'T') late++;
        else if (entry?.status === 'J') justified++;
      });

      const evaluated = present + absent + late + justified;
      const rate = evaluated > 0 ? (present / evaluated) * 100 : 0;
      // Regla: suma de ausentes injustificados + tardanzas * 0.5
      const totalInasistencias = absent + late * 0.5;

      return {
        rate,
        totalInasistencias,
        totalTardanzas: late,
        totalPresent: present,
        totalAbsent: absent,
        totalJustified: justified,
        totalEvaluated: evaluated,
      };
    } else {
      // Histórico Acumulado
      let present = 0;
      let absent = 0;
      let late = 0;
      let justified = 0;

      genderFilteredStudents.forEach(st => {
        const sStats = studentHistoryStats[st.id];
        if (sStats) {
          present += sStats.present;
          absent += sStats.absent;
          late += sStats.late;
          justified += sStats.justified;
        }
      });

      const evaluated = present + absent + late + justified;
      const rate = evaluated > 0 ? (present / evaluated) * 100 : 0;
      // Regla: suma de ausentes injustificados + tardanzas * 0.5
      const totalInasistencias = absent + late * 0.5;

      return {
        rate,
        totalInasistencias,
        totalTardanzas: late,
        totalPresent: present,
        totalAbsent: absent,
        totalJustified: justified,
        totalEvaluated: evaluated,
      };
    }
  }, [tableMode, selectedCourse, genderFilteredStudents, dayRecord, studentHistoryStats]);

  const institutionName = config?.nombreInstitucion || config?.institutionName || 'Escuela / Instituto';

  const handleDownloadDayXLSX = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedCourse || !activeDate) return;
    exportDailyAttendanceXLSX(selectedCourse, activeDate, courseStudents, dayRecord, institutionName);
    showToast(`Planilla del ${activeDate} descargada (.xlsx)`);
  };

  const handleDownloadDayPDF = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedCourse || !activeDate) return;
    exportDailyAttendancePDF(selectedCourse, activeDate, courseStudents, dayRecord, institutionName);
    showToast(`Informe PDF del ${activeDate} generado (.pdf)`);
  };

  const handleDownloadMatrixXLSX = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedCourse) return;
    const success = exportCourseHistoryMatrixXLSX(selectedCourse, courseStudents, attendanceMap, undefined, institutionName);
    if (!success) {
      showToast('No hay fechas registradas para este curso todavía.', 'warning');
    } else {
      showToast(`Matriz histórica de ${selectedCourse.name} descargada (.xlsx)`);
    }
  };

  const handleDownloadMatrixPDF = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedCourse) return;
    const success = exportCourseHistoryMatrixPDF(selectedCourse, courseStudents, attendanceMap, institutionName);
    if (!success) {
      showToast('No hay fechas registradas para este curso todavía.', 'warning');
    } else {
      showToast(`Informe PDF histórico de ${selectedCourse.name} generado (.pdf)`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-3.5 pb-24 pt-3 space-y-4">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full font-bold text-xs shadow-xl flex items-center gap-2 animate-bounce ${
            toastMessage.type === 'success'
              ? 'bg-amber-500 text-slate-950'
              : 'bg-rose-500 text-white'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <Check className="w-4 h-4 stroke-[3]" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white dark:bg-[#151820] border border-slate-200 dark:border-[#262d3a] rounded-2xl p-4 shadow-sm dark:shadow-md flex flex-wrap items-center justify-between gap-3 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Historial y Reportes (Excel / PDF)
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Exportación en planillas Excel (.xlsx) y documentos imprimibles en PDF (.pdf)
            </p>
          </div>
        </div>

        {/* Quick Export Matrix Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadMatrixXLSX}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-md active:scale-95 transition"
            title="Exportar matriz completa en Excel (.xlsx)"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Excel (.xlsx)</span>
          </button>

          <button
            onClick={handleDownloadMatrixPDF}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md active:scale-95 transition"
            title="Exportar informe listo para imprimir en PDF (.pdf)"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF (.pdf)</span>
          </button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="bg-white dark:bg-[#151820] border border-slate-200 dark:border-[#262d3a] rounded-2xl p-3.5 shadow-sm dark:shadow-md grid grid-cols-1 sm:grid-cols-2 gap-3 transition-colors">
        {/* Course Filter */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Seleccionar Curso:
          </label>
          <select
            value={selectedCourse?.id || ''}
            onChange={e => {
              handleCourseChange(e.target.value);
            }}
            className="w-full bg-slate-50 dark:bg-[#0e1116] border border-slate-300 dark:border-[#252c3b] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            {courses.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.shift || 'Mañana'})
              </option>
            ))}
          </select>
        </div>

        {/* Date Filter */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Fecha de la Planilla:
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-slate-50 dark:bg-[#0e1116] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-[#252c3b] focus-within:border-amber-500 transition">
              <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-full bg-transparent text-xs font-semibold text-slate-900 dark:text-white focus:outline-none cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>

            <button
              onClick={() => setSelectedDate(getTodayDateString())}
              className="text-xs px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-[#1e232e] dark:text-amber-400 font-bold dark:hover:bg-[#272e3c] border border-amber-300 dark:border-amber-500/20 transition flex-shrink-0 active:scale-95"
              title="Seleccionar fecha de hoy"
            >
              Hoy
            </button>

            {activeDate && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={handleDownloadDayXLSX}
                  className="px-2.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition active:scale-95 shadow-xs"
                  title="Descargar planilla del día en formato Excel (.xlsx)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Día (.xlsx)</span>
                </button>

                <button
                  onClick={handleDownloadDayPDF}
                  className="px-2.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1 transition active:scale-95 shadow-xs"
                  title="Descargar informe del día listo para imprimir en PDF (.pdf)"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Día (.pdf)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* View Mode Toggle Switch */}
      <div className="bg-white dark:bg-[#151820] border border-slate-200 dark:border-[#262d3a] rounded-2xl p-2.5 shadow-sm dark:shadow-md flex flex-wrap items-center justify-between gap-2.5 transition-colors">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-[#0e1116] rounded-xl border border-slate-200 dark:border-[#212735] w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setTableMode('daily')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              tableMode === 'daily'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Vista Diaria</span>
          </button>

          <button
            type="button"
            onClick={() => setTableMode('history')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              tableMode === 'history'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Histórico Acumulado</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium px-2 flex items-center gap-1.5">
          {tableMode === 'daily' ? (
            <span>Planilla puntual por fecha seleccionada</span>
          ) : (
            <span>Total acumulado en {recordedDates.length} jornada{recordedDates.length === 1 ? '' : 's'} registradas</span>
          )}
        </div>
      </div>

      {/* Sheet / Table Card */}
      <div className="bg-white dark:bg-[#151820] border border-slate-200 dark:border-[#262d3a] rounded-2xl p-4 shadow-sm dark:shadow-md space-y-4 transition-colors">
        {/* Dashboard 3 Cards: % Asistencia Promedio, Total Faltas / Inasistencias, Total Tardanzas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Tarjeta 1: % Asistencia Promedio */}
          <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-3.5 shadow-xs flex flex-col justify-between transition hover:shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase font-bold text-emerald-800 dark:text-emerald-300 tracking-wider">
                % ASISTENCIA
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 dark:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 border border-emerald-500/20">
                <Percent className="w-4 h-4 stroke-[2.5]" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none">
                {dashboardStats.totalEvaluated === 0
                  ? '0%'
                  : dashboardStats.rate % 1 === 0
                  ? `${dashboardStats.rate}%`
                  : `${formatDecimalSpanish(dashboardStats.rate)}%`}
              </div>
              <p className="text-[10.5px] text-emerald-700/80 dark:text-emerald-400/80 font-medium mt-1">
                {tableMode === 'daily' ? 'Asistencia del día' : 'Promedio del curso'}
                {filtroGeneroVista !== 'todos' && ` (${filtroGeneroVista === 'V' ? 'Varones' : filtroGeneroVista === 'M' ? 'Mujeres' : 'Indef.'})`}
              </p>
            </div>
          </div>

          {/* Tarjeta 2: Total Faltas / Inasistencias */}
          <div className="bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 rounded-xl p-3.5 shadow-xs flex flex-col justify-between transition hover:shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase font-bold text-rose-800 dark:text-rose-300 tracking-wider">
                TOTAL FALTAS
              </span>
              <div className="w-8 h-8 rounded-lg bg-rose-500/15 dark:bg-rose-500/25 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0 border border-rose-500/20">
                <UserX className="w-4 h-4 stroke-[2.5]" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400 leading-none">
                {formatDecimalSpanish(dashboardStats.totalInasistencias)}
              </div>
              <p className="text-[10.5px] text-rose-700/80 dark:text-rose-400/80 font-medium mt-1">
                Injust. + 0.5 tard.
                {filtroGeneroVista !== 'todos' && ` (${filtroGeneroVista === 'V' ? 'Varones' : filtroGeneroVista === 'M' ? 'Mujeres' : 'Indef.'})`}
              </p>
            </div>
          </div>

          {/* Tarjeta 3: Total Tardanzas */}
          <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3.5 shadow-xs flex flex-col justify-between transition hover:shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase font-bold text-amber-800 dark:text-amber-300 tracking-wider">
                TARDANZAS TOTALES
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 dark:bg-amber-500/25 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 border border-amber-500/20">
                <Clock className="w-4 h-4 stroke-[2.5]" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 leading-none">
                {dashboardStats.totalTardanzas}
              </div>
              <p className="text-[10.5px] text-amber-700/80 dark:text-amber-400/80 font-medium mt-1">
                0.5 faltas c/u
                {filtroGeneroVista !== 'todos' && ` (${filtroGeneroVista === 'V' ? 'Varones' : filtroGeneroVista === 'M' ? 'Mujeres' : 'Indef.'})`}
              </p>
            </div>
          </div>
        </div>

        {/* Card Header */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-[#252c3b] pb-2.5 gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {tableMode === 'daily'
                  ? `Vista Diaria: ${selectedCourse?.name} · ${activeDate || 'Sin fecha'}`
                  : `Histórico Acumulado: ${selectedCourse?.name}`}
              </h3>

              {/* 4 Icon-only Gender Filter Toggle Buttons */}
              <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-[#0e1116] border border-slate-200 dark:border-[#212735] shadow-xs">
                <button
                  type="button"
                  onClick={() => setFiltroGeneroVista('todos')}
                  className={`p-1.5 rounded-lg transition active:scale-95 ${
                    filtroGeneroVista === 'todos'
                      ? 'bg-amber-500 text-slate-950 shadow-xs ring-1 ring-amber-500'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                  title="Todos los alumnos (Global)"
                  aria-label="Todos los alumnos"
                >
                  <Users className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>

                <button
                  type="button"
                  onClick={() => setFiltroGeneroVista('V')}
                  className={`p-1.5 rounded-lg transition active:scale-95 ${
                    filtroGeneroVista === 'V'
                      ? 'bg-blue-600 text-white shadow-xs ring-1 ring-blue-500'
                      : 'text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400'
                  }`}
                  title="Varones (V)"
                  aria-label="Varones"
                >
                  <Mars className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>

                <button
                  type="button"
                  onClick={() => setFiltroGeneroVista('M')}
                  className={`p-1.5 rounded-lg transition active:scale-95 ${
                    filtroGeneroVista === 'M'
                      ? 'bg-pink-600 text-white shadow-xs ring-1 ring-pink-500'
                      : 'text-slate-500 hover:text-pink-600 dark:text-slate-400 dark:hover:text-pink-400'
                  }`}
                  title="Mujeres (M)"
                  aria-label="Mujeres"
                >
                  <Venus className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>

                <button
                  type="button"
                  onClick={() => setFiltroGeneroVista('indefinido')}
                  className={`p-1.5 rounded-lg transition active:scale-95 ${
                    filtroGeneroVista === 'indefinido'
                      ? 'bg-slate-700 text-white dark:bg-slate-600 shadow-xs ring-1 ring-slate-500'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                  title="Sin especificar (Indefinido)"
                  aria-label="Indefinido"
                >
                  <HelpCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {genderFilteredStudents.length} alumnos {filtroGeneroVista !== 'todos' ? `(${filtroGeneroVista === 'V' ? 'Varones' : filtroGeneroVista === 'M' ? 'Mujeres' : 'Indefinidos'})` : 'matriculados'} {tableMode === 'history' && `· ${recordedDates.length} fechas registradas`}
            </p>
          </div>

          {tableMode === 'daily' ? (
            <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> P: Presente
              </span>
              <span className="flex items-center gap-1 text-rose-700 dark:text-rose-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> A: Ausente
              </span>
              <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> T: Tardanza
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleDownloadMatrixXLSX}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-[#1e232e] dark:text-amber-400 font-bold dark:hover:bg-[#272e3c] border border-amber-300 dark:border-amber-500/20 transition active:scale-95 shadow-xs"
                title="Descargar matriz histórica completa en Excel (.xlsx)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Histórico (.xlsx)</span>
              </button>

              <button
                onClick={handleDownloadMatrixPDF}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-[#281c20] dark:text-rose-400 font-bold dark:hover:bg-[#342328] border border-rose-300 dark:border-rose-500/20 transition active:scale-95 shadow-xs"
                title="Descargar informe histórico completo en PDF (.pdf)"
              >
                <FileText className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>Histórico (.pdf)</span>
              </button>
            </div>
          )}
        </div>

        {/* Content based on tableMode */}
        {tableMode === 'daily' ? (
          /* Daily Table View */
          !activeDate ? (
            <div className="py-8 text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#0e1116] rounded-xl border border-slate-200 dark:border-[#212735]">
              <Calendar className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs">No hay fecha seleccionada.</p>
            </div>
          ) : genderFilteredStudents.length === 0 ? (
            <div className="py-8 text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#0e1116] rounded-xl border border-slate-200 dark:border-[#212735]">
              <Users className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-semibold">
                {filtroGeneroVista !== 'todos'
                  ? `No hay alumnos registrados como "${filtroGeneroVista === 'V' ? 'Varón' : filtroGeneroVista === 'M' ? 'Mujer' : 'Indefinido'}" en este curso.`
                  : 'No hay alumnos en este curso.'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Cambia el filtro de género para visualizar a otros alumnos.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                    <th className="py-2 px-2.5 w-8">N°</th>
                    <th className="py-2 px-2.5">Alumno</th>
                    <th className="py-2 px-2.5 text-center w-24">Estado</th>
                    <th className="py-2 px-2.5">Observación / Novedades</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#202735]">
                  {genderFilteredStudents.map((st, i) => {
                    const entry = dayRecord[st.id] || { status: null };
                    const studentIndexInCourse = courseStudents.findIndex(s => s.id === st.id);
                    const listNum = studentIndexInCourse !== -1 ? studentIndexInCourse + 1 : (st.listNumber || i + 1);
                    return (
                      <tr
                        key={st.id}
                        onClick={() => setSelectedStudentForModal(st)}
                        className="hover:bg-amber-500/10 dark:hover:bg-amber-500/10 cursor-pointer transition select-none group"
                        title="Clic para ver la Ficha Técnica del Alumno"
                      >
                        <td className="py-2.5 px-2.5 font-bold text-amber-700 dark:text-amber-400/90 w-8">
                          {listNum}
                        </td>
                        <td className="py-2.5 px-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <strong className="text-slate-900 dark:text-white uppercase group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
                              {st.lastName}
                            </strong>
                            <span className="text-slate-700 dark:text-slate-300">{st.firstName}</span>
                            {normalizeStudentGender(st.genero) === 'V' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                                V
                              </span>
                            )}
                            {normalizeStudentGender(st.genero) === 'M' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300">
                                M
                              </span>
                            )}
                            {normalizeStudentGender(st.genero) === 'indefinido' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                ?
                              </span>
                            )}
                            {entry.isDiscipline && (
                              <span className="px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-[9.5px] border border-rose-500/30 flex items-center gap-1">
                                <ShieldAlert className="w-2.5 h-2.5" /> Indisciplina
                              </span>
                            )}
                          </div>
                          {st.dni && (
                            <span className="block text-[10px] text-slate-400 dark:text-slate-500">
                              DNI: {st.dni}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2.5 text-center w-24">
                          {entry.status === 'P' && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 font-bold text-[11px] border border-emerald-300 dark:border-emerald-500/40">
                              Presente
                            </span>
                          )}
                          {entry.status === 'A' && (
                            <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-400 font-bold text-[11px] border border-rose-300 dark:border-rose-500/40">
                              Ausente
                            </span>
                          )}
                          {entry.status === 'T' && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400 font-bold text-[11px] border border-amber-300 dark:border-amber-500/40">
                              Tardanza
                            </span>
                          )}
                          {entry.status === 'J' && (
                            <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-400 font-bold text-[11px] border border-indigo-300 dark:border-indigo-500/40">
                              Justificado
                            </span>
                          )}
                          {!entry.status && (
                            <span className="text-slate-400 dark:text-slate-500 text-[10px]">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2.5 text-slate-600 dark:text-slate-400 text-[11px]">
                          {entry.observation || <span className="text-slate-400 dark:text-slate-600 italic">-</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* Cumulative History Table View */
          recordedDates.length === 0 ? (
            <div className="py-8 text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#0e1116] rounded-xl border border-slate-200 dark:border-[#212735]">
              <BarChart3 className="w-8 h-8 text-amber-500/60 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">No hay registros de asistencia para este curso todavía.</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Registra la asistencia diaria para visualizar el historial acumulado.</p>
            </div>
          ) : genderFilteredStudents.length === 0 ? (
            <div className="py-8 text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#0e1116] rounded-xl border border-slate-200 dark:border-[#212735]">
              <Users className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-semibold">
                {filtroGeneroVista !== 'todos'
                  ? `No hay alumnos registrados como "${filtroGeneroVista === 'V' ? 'Varón' : filtroGeneroVista === 'M' ? 'Mujer' : 'Indefinido'}" en este curso.`
                  : 'No hay alumnos en este curso.'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Cambia el filtro de género para visualizar a otros alumnos.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                    <th className="py-2 px-2.5 w-8">N°</th>
                    <th className="py-2 px-2.5">Alumno</th>
                    <th className="py-2 px-2.5 text-center w-20">Presentes</th>
                    <th className="py-2 px-2.5 text-center w-24" title="Cada tardanza computa como 0.5 inasistencia">Tardanzas (0.5)</th>
                    <th className="py-2 px-2.5 text-center w-20">Justificadas</th>
                    <th className="py-2 px-2.5 text-center w-20">Injustificadas</th>
                    <th className="py-2 px-2.5 text-center w-28 bg-rose-50/60 dark:bg-rose-950/20 font-black text-rose-700 dark:text-rose-400" title="Total Inasistencias = Ausentes + (Tardanzas * 0.5)">
                      Total Inasistencias
                    </th>
                    <th className="py-2 px-2.5 text-center w-24">% Asist.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#202735]">
                  {genderFilteredStudents.map((st, i) => {
                    const stats = studentHistoryStats[st.id] || {
                      present: 0,
                      absent: 0,
                      late: 0,
                      justified: 0,
                      indisciplines: 0,
                      totalInasistencias: 0,
                      totalEvaluated: 0,
                      rate: 0,
                    };
                    const studentIndexInCourse = courseStudents.findIndex(s => s.id === st.id);
                    const listNum = studentIndexInCourse !== -1 ? studentIndexInCourse + 1 : (st.listNumber || i + 1);

                    return (
                      <tr
                        key={st.id}
                        onClick={() => setSelectedStudentForModal(st)}
                        className="hover:bg-amber-500/10 dark:hover:bg-amber-500/10 cursor-pointer transition select-none group"
                        title="Clic para ver la Ficha Técnica del Alumno"
                      >
                        <td className="py-2.5 px-2.5 font-bold text-amber-700 dark:text-amber-400/90 w-8">
                          {listNum}
                        </td>
                        <td className="py-2.5 px-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <strong className="text-slate-900 dark:text-white uppercase group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
                              {st.lastName}
                            </strong>
                            <span className="text-slate-700 dark:text-slate-300">{st.firstName}</span>
                            {normalizeStudentGender(st.genero) === 'V' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                                V
                              </span>
                            )}
                            {normalizeStudentGender(st.genero) === 'M' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300">
                                M
                              </span>
                            )}
                            {normalizeStudentGender(st.genero) === 'indefinido' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                ?
                              </span>
                            )}
                            {stats.indisciplines > 0 && (
                              <span className="px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-[9.5px] border border-rose-500/30 flex items-center gap-1">
                                <ShieldAlert className="w-2.5 h-2.5" /> {stats.indisciplines} falta{stats.indisciplines === 1 ? '' : 's'}
                              </span>
                            )}
                          </div>
                          {st.dni && (
                            <span className="block text-[10px] text-slate-400 dark:text-slate-500">
                              DNI: {st.dni}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2.5 text-center">
                          <span className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400">
                            {stats.present}
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 text-center">
                          <span className="font-extrabold text-xs text-amber-600 dark:text-amber-400">
                            {stats.late}
                          </span>
                          {stats.late > 0 && (
                            <span className="block text-[9px] font-medium text-slate-500 dark:text-slate-400">
                              ({formatDecimalSpanish(stats.late * 0.5)} f.)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2.5 text-center">
                          <span className="font-extrabold text-xs text-indigo-600 dark:text-indigo-400">
                            {stats.justified}
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 text-center">
                          <span className="font-extrabold text-xs text-rose-600 dark:text-rose-400">
                            {stats.absent}
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 text-center bg-rose-50/30 dark:bg-rose-950/10">
                          <span className="inline-block px-2 py-0.5 rounded-md font-black text-xs text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/30 border border-rose-300 dark:border-rose-800">
                            {formatDecimalSpanish(stats.totalInasistencias)}
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 text-center">
                          {stats.totalEvaluated === 0 ? (
                            <span className="text-slate-400 dark:text-slate-500 text-[11px]">-</span>
                          ) : (
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-md font-extrabold text-[11px] border ${
                                stats.rate >= 80
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30'
                                  : stats.rate >= 65
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400 border-amber-300 dark:border-amber-500/30'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400 border-rose-300 dark:border-rose-500/30'
                              }`}
                            >
                              {stats.rate}%
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Helpful Hint banner */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300">
        <FileText className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <span>
          <strong>Ficha Técnica Individual:</strong> Haz clic sobre la fila o el nombre de cualquier alumno para ver su ficha completa, historial de faltas de conducta y descargar su informe individual en <strong>.txt</strong>.
        </span>
      </div>

      {/* Student Profile Modal (Ficha Técnica del Alumno) */}
      <StudentProfileModal
        isOpen={Boolean(selectedStudentForModal)}
        onClose={() => setSelectedStudentForModal(null)}
        student={selectedStudentForModal}
        course={selectedCourse}
        attendanceMap={attendanceMap}
        institutionName={institutionName}
        onUpdateAttendance={onUpdateAttendance}
        currentSelectedDate={activeDate}
      />
    </div>
  );
};
