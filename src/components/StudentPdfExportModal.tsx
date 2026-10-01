import React, { useState } from 'react';
import { X, FileText, Calendar, Filter } from 'lucide-react';
import { Course, Student, AttendanceRecordMap } from '../types';
import { exportStudentProfilePDF, StudentPdfExportOptions } from '../utils/pdf';
import { getTodayDateString } from '../utils/storage';

interface StudentPdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  course: Course | null;
  attendanceMap: AttendanceRecordMap;
  institutionName?: string;
}

export const StudentPdfExportModal: React.FC<StudentPdfExportModalProps> = ({
  isOpen,
  onClose,
  student,
  course,
  attendanceMap,
  institutionName = 'Escuela / Instituto',
}) => {
  const today = getTodayDateString();
  const firstDayOfMonth = today.substring(0, 8) + '01';

  // Modal State
  const [includeSummary, setIncludeSummary] = useState(true);

  // Category Checkboxes (multiple selection, all checked by default)
  const [catPresent, setCatPresent] = useState(true);
  const [catAbsences, setCatAbsences] = useState(true);
  const [catLate, setCatLate] = useState(true);
  const [catDiscipline, setCatDiscipline] = useState(true);

  // Date Range State
  const [dateRangeMode, setDateRangeMode] = useState<'all' | 'current_month' | 'custom'>('all');
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(today);

  if (!isOpen || !student || !course) return null;

  const handleGeneratePDF = () => {
    const options: StudentPdfExportOptions = {
      includeSummary,
      categories: {
        present: catPresent,
        absences: catAbsences,
        late: catLate,
        discipline: catDiscipline,
      },
      dateRangeMode,
      startDate: dateRangeMode === 'custom' ? startDate : undefined,
      endDate: dateRangeMode === 'custom' ? endDate : undefined,
    };

    exportStudentProfilePDF(student, course, attendanceMap, institutionName, options);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3.5 bg-black/75 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#151922] w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-[#283244] flex flex-col max-h-[92vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-[#232b3b] bg-slate-50 dark:bg-[#11141c]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20 flex-shrink-0">
              <FileText className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Configurar Exportación PDF
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {student.lastName}, {student.firstName} ({course.name})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 text-slate-800 dark:text-slate-200 text-xs">
          {/* Section 1: Secciones del Documento */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-amber-500" />
              1. Secciones a incluir en el informe:
            </label>

            <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-[#262d3a] bg-slate-50/70 dark:bg-[#0f1218] cursor-pointer hover:border-amber-500/50 transition">
              <input
                type="checkbox"
                checked={includeSummary}
                onChange={e => setIncludeSummary(e.target.checked)}
                className="w-4 h-4 text-amber-500 rounded focus:ring-amber-400 border-slate-300 dark:border-slate-700"
              />
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">
                  Resumen Estadístico General
                </span>
                <span className="text-[10.5px] text-slate-500 dark:text-slate-400">
                  Incluye % de Asistencia, Totales de P, A, T, J y contador de Indisciplinas.
                </span>
              </div>
            </label>
          </div>

          {/* Section 2: Filtro de Categoría de Historial (Selección Múltiple Checkboxes) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-amber-500" />
                2. Filtrar Registros del Historial (Selección Múltiple):
              </label>
              <button
                type="button"
                onClick={() => {
                  const allOn = catPresent && catAbsences && catLate && catDiscipline;
                  setCatPresent(!allOn);
                  setCatAbsences(!allOn);
                  setCatLate(!allOn);
                  setCatDiscipline(!allOn);
                }}
                className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400 hover:underline"
              >
                {catPresent && catAbsences && catLate && catDiscipline ? 'Desmarcar todos' : 'Marcar todos'}
              </button>
            </div>

            <div className="space-y-2 bg-slate-50 dark:bg-[#0e1116] p-3 rounded-xl border border-slate-200 dark:border-[#232b3b]">
              {/* Checkbox 1: Presentes */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={catPresent}
                  onChange={e => setCatPresent(e.target.checked)}
                  className="w-4 h-4 text-amber-500 rounded focus:ring-amber-400 border-slate-300 dark:border-slate-700"
                />
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Días Presentes [P]
                </span>
              </label>

              {/* Checkbox 2: Inasistencias */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={catAbsences}
                  onChange={e => setCatAbsences(e.target.checked)}
                  className="w-4 h-4 text-amber-500 rounded focus:ring-amber-400 border-slate-300 dark:border-slate-700"
                />
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Inasistencias (Ausentes Injustificados / Justificados)
                </span>
              </label>

              {/* Checkbox 3: Tardanzas */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={catLate}
                  onChange={e => setCatLate(e.target.checked)}
                  className="w-4 h-4 text-amber-500 rounded focus:ring-amber-400 border-slate-300 dark:border-slate-700"
                />
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Tardanzas [T]
                </span>
              </label>

              {/* Checkbox 4: Indisciplinas / Observaciones */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={catDiscipline}
                  onChange={e => setCatDiscipline(e.target.checked)}
                  className="w-4 h-4 text-amber-500 rounded focus:ring-amber-400 border-slate-300 dark:border-slate-700"
                />
                <span className="font-bold text-rose-700 dark:text-rose-400">
                  Observaciones / Sanciones de Conducta
                </span>
              </label>
            </div>
          </div>

          {/* Section 3: Rango de Fechas */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-500" />
              3. Rango de Fechas:
            </label>

            <div className="space-y-2 bg-slate-50 dark:bg-[#0e1116] p-2.5 rounded-xl border border-slate-200 dark:border-[#232b3b]">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="dateRangeMode"
                    checked={dateRangeMode === 'all'}
                    onChange={() => setDateRangeMode('all')}
                    className="w-3.5 h-3.5 text-amber-500 focus:ring-amber-400"
                  />
                  <span className="font-medium text-slate-900 dark:text-white">Todo el año</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="dateRangeMode"
                    checked={dateRangeMode === 'current_month'}
                    onChange={() => setDateRangeMode('current_month')}
                    className="w-3.5 h-3.5 text-amber-500 focus:ring-amber-400"
                  />
                  <span className="font-medium text-slate-900 dark:text-white">Mes actual</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="dateRangeMode"
                    checked={dateRangeMode === 'custom'}
                    onChange={() => setDateRangeMode('custom')}
                    className="w-3.5 h-3.5 text-amber-500 focus:ring-amber-400"
                  />
                  <span className="font-medium text-slate-900 dark:text-white">Rango personalizado</span>
                </label>
              </div>

              {dateRangeMode === 'custom' && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-[#222a3a]">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                      Desde:
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full bg-white dark:bg-[#151922] border border-slate-300 dark:border-[#2b3545] rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                      Hasta:
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full bg-white dark:bg-[#151922] border border-slate-300 dark:border-[#2b3545] rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-slate-200 dark:border-[#232b3b] bg-slate-50 dark:bg-[#11141c] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-[#1d232f] dark:hover:bg-[#262e3d] text-slate-800 dark:text-slate-200 font-bold text-xs transition"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleGeneratePDF}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs transition shadow-md active:scale-95"
          >
            <FileText className="w-4 h-4" />
            <span>Generar y Descargar PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};
