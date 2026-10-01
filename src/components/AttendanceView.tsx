import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCheck,
  UserX,
  FileSpreadsheet,
  FileText,
  MessageSquare,
  Search,
  MessageCircle,
  RotateCcw,
  Info,
  Check,
  ShieldAlert,
  Lock,
  Unlock,
  Users,
  Mars,
  Venus,
  HelpCircle,
} from 'lucide-react';
import { AttendanceStatus, Course, Student, StudentAttendanceEntry, AttendanceRecordMap, GenderFilterType } from '../types';
import { exportDailyAttendanceXLSX } from '../utils/excel';
import { exportDailyAttendancePDF } from '../utils/pdf';
import { WhatsAppModal } from './WhatsAppModal';
import { ConfirmModal } from './ConfirmModal';
import { normalizeStudentGender } from '../utils/studentSorting';

interface AttendanceViewProps {
  courses: Course[];
  selectedCourseId: string;
  onSelectCourse: (id: string) => void;
  students: Student[];
  attendanceMap: AttendanceRecordMap;
  onUpdateAttendance: (
    courseId: string,
    date: string,
    studentId: string,
    status: AttendanceStatus,
    observation?: string,
    isDiscipline?: boolean
  ) => void;
  onBatchUpdateAttendance: (courseId: string, date: string, updates: Record<string, AttendanceStatus>) => void;
  onUpdateStudent?: (student: Student) => void;
  currentDate: string;
  onChangeDate: (date: string) => void;
  defaultWhatsAppPhone?: string;
  institutionName?: string;
  isLocked?: boolean;
  onToggleLock?: () => void;
  onSetLocked?: (locked: boolean) => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  courses,
  selectedCourseId,
  onSelectCourse,
  students,
  attendanceMap,
  onUpdateAttendance,
  onBatchUpdateAttendance,
  onUpdateStudent,
  currentDate,
  onChangeDate,
  defaultWhatsAppPhone,
  institutionName = 'Escuela / Instituto',
  isLocked: externalIsLocked,
  onToggleLock: externalToggleLock,
  onSetLocked: externalSetLocked,
}) => {
  const [internalLocked, setInternalLocked] = useState(true);
  const isLocked = externalIsLocked !== undefined ? externalIsLocked : internalLocked;

  const setIsLocked = useCallback(
    (locked: boolean) => {
      setInternalLocked(locked);
      externalSetLocked?.(locked);
    },
    [externalSetLocked]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [activeObsStudentId, setActiveObsStudentId] = useState<string | null>(null);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Fast Gender Filter state ('todos' | 'V' | 'M' | 'indefinido')
  const [filtroGeneroVista, setFiltroGeneroVista] = useState<GenderFilterType>('todos');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Manual Lock/Unlock Toggle Button (🔒 / 🔓)
  const handleToggleLock = () => {
    if (isLocked) {
      setIsLocked(false);
    } else {
      setIsLocked(true);
    }
    if (externalToggleLock) {
      externalToggleLock();
    }
  };

  // 1. Page Visibility API & Window focus loss/backgrounding
  const wasHiddenOrBlurredRef = useRef(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Tab changed away, phone locked, or screen turned off
        setIsLocked(true);
        wasHiddenOrBlurredRef.current = true;
      } else if (document.visibilityState === 'visible') {
        // Screen turned back on / app returned to foreground
        if (wasHiddenOrBlurredRef.current) {
          wasHiddenOrBlurredRef.current = false;
        }
      }
    };

    const handleWindowBlur = () => {
      // Window lost focus (user switched apps or locked device)
      setIsLocked(true);
      wasHiddenOrBlurredRef.current = true;
    };

    const handleWindowFocus = () => {
      if (wasHiddenOrBlurredRef.current) {
        wasHiddenOrBlurredRef.current = false;
      }
    };

    const handlePageHide = () => {
      setIsLocked(true);
      wasHiddenOrBlurredRef.current = true;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [setIsLocked]);

  // 2. Navigation in main selectors: automatically lock when changing date or course
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setIsLocked(true);
  }, [currentDate, selectedCourseId, setIsLocked]);

  const selectedCourse = useMemo(() => {
    return courses.find(c => c.id === selectedCourseId) || courses[0];
  }, [courses, selectedCourseId]);

  const courseStudents = useMemo(() => {
    if (!selectedCourse) return [];
    return students
      .filter(s => s.courseId === selectedCourse.id && s.active)
      .sort((a, b) => {
        const numA = a.listNumber ?? 999999;
        const numB = b.listNumber ?? 999999;
        if (numA !== numB) return numA - numB;
        return a.lastName.localeCompare(b.lastName);
      });
  }, [students, selectedCourse]);

  // Dynamic subset filtered by gender
  const genderFilteredStudents = useMemo(() => {
    if (filtroGeneroVista === 'todos') return courseStudents;
    return courseStudents.filter(st => normalizeStudentGender(st.genero) === filtroGeneroVista);
  }, [courseStudents, filtroGeneroVista]);

  const filteredStudents = useMemo(() => {
    let base = genderFilteredStudents;
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase().trim();
    return base.filter(s => {
      const full = `${s.lastName} ${s.firstName} ${s.dni || ''} ${s.listNumber || ''}`.toLowerCase();
      return full.includes(q);
    });
  }, [genderFilteredStudents, searchQuery]);

  const recordKey = `${selectedCourse?.id}_${currentDate}`;
  const dayRecord: Record<string, StudentAttendanceEntry> = useMemo(() => {
    return attendanceMap[recordKey] || {};
  }, [attendanceMap, recordKey]);

  // Statistics dynamically recalculated according to selected gender filter
  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let justified = 0;
    let unrecorded = 0;

    genderFilteredStudents.forEach(st => {
      const status = dayRecord[st.id]?.status;
      if (status === 'P') present++;
      else if (status === 'A') absent++;
      else if (status === 'T') late++;
      else if (status === 'J') justified++;
      else unrecorded++;
    });

    const total = genderFilteredStudents.length;
    const presentPercentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return { total, present, absent, late, justified, unrecorded, presentPercentage };
  }, [genderFilteredStudents, dayRecord]);

  // Date navigation helpers
  const handleShiftDay = (delta: number) => {
    const [year, month, day] = currentDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + delta);
    const newY = date.getFullYear();
    const newM = String(date.getMonth() + 1).padStart(2, '0');
    const newD = String(date.getDate()).padStart(2, '0');
    onChangeDate(`${newY}-${newM}-${newD}`);
  };

  const setDateToToday = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    onChangeDate(`${y}-${m}-${d}`);
  };

  // Mass actions
  const handleMarkAll = (status: AttendanceStatus) => {
    if (isLocked) {
      showToast('Asistencia bloqueada por seguridad');
      return;
    }
    if (!selectedCourse) return;
    const targetStudents = genderFilteredStudents;
    const updates: Record<string, AttendanceStatus> = {};
    targetStudents.forEach(s => {
      updates[s.id] = status;
    });
    onBatchUpdateAttendance(selectedCourse.id, currentDate, updates);
    showToast(status === 'P' ? '¡Todos marcados como PRESENTES!' : '¡Todos marcados como AUSENTES!');
  };

  const handleResetDay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isLocked) {
      showToast('Asistencia bloqueada por seguridad');
      return;
    }
    if (!selectedCourse) return;
    setIsResetConfirmOpen(true);
  };

  const confirmResetDay = () => {
    if (isLocked) {
      showToast('Asistencia bloqueada por seguridad');
      setIsResetConfirmOpen(false);
      return;
    }
    if (!selectedCourse) return;
    const updates: Record<string, AttendanceStatus> = {};
    courseStudents.forEach(s => {
      updates[s.id] = null;
    });
    onBatchUpdateAttendance(selectedCourse.id, currentDate, updates);
    showToast('Registro diario reiniciado');
    setIsResetConfirmOpen(false);
  };

  const handleExportXLSX = () => {
    if (!selectedCourse) return;
    exportDailyAttendanceXLSX(selectedCourse, currentDate, courseStudents, dayRecord, institutionName);
    showToast('Planilla Excel descargada (.xlsx)');
  };

  const handleExportPDF = () => {
    if (!selectedCourse) return;
    exportDailyAttendancePDF(selectedCourse, currentDate, courseStudents, dayRecord, institutionName);
    showToast('Documento PDF generado (.pdf)');
  };

  const handleUpdateStudentStatus = (studentId: string, status: AttendanceStatus, observation?: string) => {
    if (isLocked) {
      showToast('Asistencia bloqueada por seguridad');
      return;
    }
    onUpdateAttendance(selectedCourse.id, currentDate, studentId, status, observation);
  };

  if (!selectedCourse) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
        <p>No hay cursos registrados. Dirígete a la pestaña "Cursos" para crear uno.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3.5 pb-24 pt-3 space-y-3.5">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 px-4 py-2.5 rounded-full font-bold text-xs shadow-2xl flex items-center gap-2 animate-bounce border border-amber-600/30">
          {toastMessage.includes('bloqueada') ? (
            <Lock className="w-4 h-4 text-slate-950 stroke-[2.5]" />
          ) : toastMessage.includes('desbloqueada') ? (
            <Unlock className="w-4 h-4 text-slate-950 stroke-[2.5]" />
          ) : (
            <Check className="w-4 h-4 stroke-[3]" />
          )}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Date & Course Selectors Card */}
      <div className="bg-white dark:bg-[#151820] border border-slate-200 dark:border-[#262d3a] rounded-2xl p-3.5 shadow-sm dark:shadow-md space-y-3 transition-colors">
        {/* Date Selector Row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleShiftDay(-1)}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#1e232e] text-slate-700 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700 transition"
              title="Día anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#0d0f13] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#283140]">
              <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <input
                type="date"
                value={currentDate}
                onChange={e => onChangeDate(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={() => handleShiftDay(1)}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#1e232e] text-slate-700 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700 transition"
              title="Día siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={setDateToToday}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-[#1e232e] dark:text-amber-400 font-bold dark:hover:bg-[#272e3c] border border-amber-300 dark:border-amber-500/20 transition"
            >
              Hoy
            </button>
          </div>
        </div>

        {/* Course Pills Slider */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            <span>Seleccionar Curso:</span>
            <span className="text-amber-600 dark:text-amber-400/90 font-medium lowercase">
              {courseStudents.length} alumnos en lista
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
            {courses.map(c => {
              const isSelected = c.id === selectedCourse.id;
              const count = students.filter(s => s.courseId === c.id && s.active).length;
              return (
                <button
                  key={c.id}
                  onClick={() => onSelectCourse(c.id)}
                  className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    isSelected
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-amber-950/20 scale-[1.02]'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#1b202a] dark:text-slate-300 dark:hover:bg-[#232936] border border-slate-200 dark:border-[#2b3342]'
                  }`}
                >
                  <span>{c.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                      isSelected ? 'bg-black/20 text-slate-950' : 'bg-black/10 dark:bg-black/40 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Real-Time Dashboard Metrics */}
      <div className="bg-white dark:bg-[#151820] border border-slate-200 dark:border-[#262d3a] rounded-2xl p-3.5 shadow-sm dark:shadow-md transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Control Diario
            </span>

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
        </div>

        {/* Segmented Progress Bar */}
        <div className="w-full h-2 bg-slate-100 dark:bg-[#0e1115] rounded-full overflow-hidden flex gap-0.5 mb-3 border border-slate-200 dark:border-slate-800">
          <div
            style={{ width: `${stats.total > 0 ? (stats.present / stats.total) * 100 : 0}%` }}
            className="bg-emerald-500 transition-all duration-300"
            title="Presentes"
          />
          <div
            style={{ width: `${stats.total > 0 ? (stats.late / stats.total) * 100 : 0}%` }}
            className="bg-amber-500 transition-all duration-300"
            title="Tardanzas"
          />
          <div
            style={{ width: `${stats.total > 0 ? (stats.justified / stats.total) * 100 : 0}%` }}
            className="bg-indigo-500 transition-all duration-300"
            title="Justificados"
          />
          <div
            style={{ width: `${stats.total > 0 ? (stats.absent / stats.total) * 100 : 0}%` }}
            className="bg-rose-500 transition-all duration-300"
            title="Ausentes"
          />
        </div>

        {/* 4 Stat Badges Grid */}
        <div className="grid grid-cols-4 gap-2">
          {/* Present */}
          <div className="bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/40 rounded-xl p-2 text-center transition-colors">
            <span className="block text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-tight">
              Presentes
            </span>
            <span className="text-lg font-black text-emerald-800 dark:text-emerald-300">{stats.present}</span>
          </div>

          {/* Absent */}
          <div className="bg-rose-50 border border-rose-200 dark:bg-rose-950/30 dark:border-rose-800/40 rounded-xl p-2 text-center transition-colors">
            <span className="block text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-tight">
              Ausentes
            </span>
            <span className="text-lg font-black text-rose-800 dark:text-rose-300">{stats.absent}</span>
          </div>

          {/* Late */}
          <div className="bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/40 rounded-xl p-2 text-center transition-colors">
            <span className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-tight">
              Tardanzas
            </span>
            <span className="text-lg font-black text-amber-800 dark:text-amber-300">{stats.late}</span>
          </div>

          {/* Justified */}
          <div className="bg-indigo-50 border border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800/40 rounded-xl p-2 text-center transition-colors">
            <span className="block text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-tight">
              Justificados
            </span>
            <span className="text-lg font-black text-indigo-800 dark:text-indigo-300">{stats.justified}</span>
          </div>
        </div>
      </div>

      {/* Action Toolbar: WhatsApp, Excel, PDF */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setIsWhatsAppModalOpen(true)}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition active:scale-95 shadow-md shadow-emerald-950/20"
        >
          <MessageSquare className="w-4 h-4" />
          <span>WhatsApp</span>
        </button>

        <button
          onClick={handleExportXLSX}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 dark:bg-[#1b202a] dark:hover:bg-[#242b38] dark:border-amber-500/30 dark:text-amber-400 text-xs font-bold transition active:scale-95 shadow-xs"
          title="Exportar planilla diaria en formato Excel (.xlsx)"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Excel (.xlsx)</span>
        </button>

        <button
          onClick={handleExportPDF}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 dark:bg-[#26181b] dark:hover:bg-[#311f23] dark:border-rose-600/30 dark:text-rose-400 text-xs font-bold transition active:scale-95 shadow-xs"
          title="Exportar informe diario listo para imprimir en formato PDF (.pdf)"
        >
          <FileText className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          <span>PDF (.pdf)</span>
        </button>
      </div>

      {/* Security Lock Banner - Permanent Control above Student Search */}
      <div
        className={`rounded-2xl p-3 flex items-center justify-between gap-3 text-xs transition-all shadow-xs border ${
          isLocked
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-300'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-300'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isLocked
                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {isLocked ? (
              <Lock className="w-4 h-4 stroke-[2.5]" />
            ) : (
              <Unlock className="w-4 h-4 stroke-[2.5]" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-xs truncate text-slate-900 dark:text-white">
              {isLocked
                ? 'Asistencia bloqueada por seguridad'
                : 'Edición de asistencia habilitada'}
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
              {isLocked
                ? 'Toca "Desbloquear" para permitir registros y modificaciones.'
                : 'Edición activa. Toca "Bloquear" para proteger contra toques accidentales.'}
            </p>
          </div>
        </div>

        {isLocked ? (
          <button
            onClick={() => setIsLocked(false)}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs transition active:scale-95 flex items-center gap-1.5 flex-shrink-0 shadow-sm"
          >
            <Unlock className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Desbloquear 🔓</span>
          </button>
        ) : (
          <button
            onClick={() => setIsLocked(true)}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-[#1b202a] dark:hover:bg-[#232a38] dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold text-xs transition active:scale-95 flex items-center gap-1.5 flex-shrink-0 shadow-sm"
          >
            <Lock className="w-3.5 h-3.5 stroke-[2.5] text-amber-600 dark:text-amber-400" />
            <span>Bloquear 🔒</span>
          </button>
        )}
      </div>

      {/* Mass Actions Bar (Todos Presente / Todos Ausente) - Positioned directly below Security Lock Banner */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleMarkAll('P')}
          disabled={isLocked}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 dark:bg-[#1a232f] dark:hover:bg-[#202c3c] dark:border-emerald-600/30 dark:text-emerald-400 text-xs font-bold transition active:scale-95 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          title={isLocked ? 'Desbloquea la asistencia para marcar a todos los alumnos' : 'Marcar todos los alumnos como Presente'}
        >
          <CheckCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Todos Presente</span>
        </button>

        <button
          onClick={() => handleMarkAll('A')}
          disabled={isLocked}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 dark:bg-[#26181b] dark:hover:bg-[#311f23] dark:border-rose-600/30 dark:text-rose-400 text-xs font-bold transition active:scale-95 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          title={isLocked ? 'Desbloquea la asistencia para marcar a todos los alumnos' : 'Marcar todos los alumnos como Ausente'}
        >
          <UserX className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          <span>Todos Ausente</span>
        </button>
      </div>

      {/* Student List Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          placeholder="Buscar alumno por apellido, nombre o N° de lista..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full bg-white dark:bg-[#151820] border border-slate-200 dark:border-[#262d3a] rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 transition"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Interactive Student List Cards */}
      <div className="space-y-2">
        {filteredStudents.length === 0 ? (
          <div className="bg-white dark:bg-[#151820] border border-slate-200 dark:border-[#262d3a] rounded-2xl p-8 text-center text-slate-500 dark:text-slate-400">
            <p className="text-sm">No se encontraron alumnos en este curso.</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Agrega alumnos desde la pestaña "Cursos y Alumnos".
            </p>
          </div>
        ) : (
          filteredStudents.map((student, index) => {
            const entry = dayRecord[student.id] || { status: null };
            const isObsOpen = activeObsStudentId === student.id;
            const hasObs = Boolean(entry.observation && entry.observation.trim() !== '');
            const studentIndexInCourse = courseStudents.findIndex(s => s.id === student.id);
            const correlativeNumber = studentIndexInCourse !== -1 ? studentIndexInCourse + 1 : (student.listNumber || index + 1);

            return (
              <div
                key={student.id}
                className={`bg-white dark:bg-[#151820] border rounded-2xl p-3 transition-all shadow-xs ${
                  entry.status === 'P'
                    ? 'border-emerald-300 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-950/5'
                    : entry.status === 'A'
                    ? 'border-rose-300 dark:border-rose-800/40 bg-rose-50/40 dark:bg-rose-950/5'
                    : entry.status === 'T'
                    ? 'border-amber-300 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-950/5'
                    : entry.status === 'J'
                    ? 'border-indigo-300 dark:border-indigo-800/40 bg-indigo-50/40 dark:bg-indigo-950/5'
                    : 'border-slate-200 dark:border-[#262d3a]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Student Info */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* 100% Dynamic Correlative List Number Badge */}
                    <span className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-400 font-black text-[11px] flex items-center justify-center flex-shrink-0 border border-amber-500/30 shadow-xs">
                      {correlativeNumber}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          <span className="uppercase text-amber-800 dark:text-amber-200/90">{student.lastName}</span>,{' '}
                          <span className="font-normal text-slate-700 dark:text-slate-200">{student.firstName}</span>
                        </p>
                        {student.genero === 'V' ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                            V
                          </span>
                        ) : student.genero === 'M' ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800/50">
                            M
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                        {student.dni && <span>DNI: {student.dni}</span>}
                        {entry.isDiscipline && (
                          <span className="px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold text-[9.5px] border border-rose-500/30 flex items-center gap-1">
                            <ShieldAlert className="w-2.5 h-2.5" /> Indisciplina
                          </span>
                        )}
                        {hasObs && (
                          <span className="text-amber-700 dark:text-amber-400 font-medium truncate">
                            · {entry.observation}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 4 Attendance Status Action Buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Presente [P] */}
                    <button
                      onClick={() => handleUpdateStudentStatus(student.id, 'P', entry.observation)}
                      className={`w-8 h-8 rounded-lg font-black text-xs transition-all active:scale-90 flex items-center justify-center ${
                        isLocked ? 'cursor-pointer' : ''
                      } ${
                        entry.status === 'P'
                          ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30 scale-105 ring-2 ring-emerald-400'
                          : 'bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 dark:bg-[#1e2430] dark:text-slate-300 dark:hover:bg-emerald-950 dark:hover:text-emerald-400'
                      }`}
                      title={isLocked ? 'Asistencia bloqueada' : 'Marcar Presente'}
                    >
                      P
                    </button>

                    {/* Ausente [A] */}
                    <button
                      onClick={() => handleUpdateStudentStatus(student.id, 'A', entry.observation)}
                      className={`w-8 h-8 rounded-lg font-black text-xs transition-all active:scale-90 flex items-center justify-center ${
                        isLocked ? 'cursor-pointer' : ''
                      } ${
                        entry.status === 'A'
                          ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30 scale-105 ring-2 ring-rose-400'
                          : 'bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-700 dark:bg-[#1e2430] dark:text-slate-300 dark:hover:bg-rose-950 dark:hover:text-rose-400'
                      }`}
                      title={isLocked ? 'Asistencia bloqueada' : 'Marcar Ausente'}
                    >
                      A
                    </button>

                    {/* Tardanza [T] */}
                    <button
                      onClick={() => handleUpdateStudentStatus(student.id, 'T', entry.observation)}
                      className={`w-8 h-8 rounded-lg font-black text-xs transition-all active:scale-90 flex items-center justify-center ${
                        isLocked ? 'cursor-pointer' : ''
                      } ${
                        entry.status === 'T'
                          ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30 scale-105 ring-2 ring-amber-300'
                          : 'bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-700 dark:bg-[#1e2430] dark:text-slate-300 dark:hover:bg-amber-950 dark:hover:text-amber-400'
                      }`}
                      title={isLocked ? 'Asistencia bloqueada' : 'Marcar Tardanza'}
                    >
                      T
                    </button>

                    {/* Justificado [J] */}
                    <button
                      onClick={() => handleUpdateStudentStatus(student.id, 'J', entry.observation)}
                      className={`w-8 h-8 rounded-lg font-black text-xs transition-all active:scale-90 flex items-center justify-center ${
                        isLocked ? 'cursor-pointer' : ''
                      } ${
                        entry.status === 'J'
                          ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30 scale-105 ring-2 ring-indigo-400'
                          : 'bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 dark:bg-[#1e2430] dark:text-slate-300 dark:hover:bg-indigo-950 dark:hover:text-indigo-400'
                      }`}
                      title={isLocked ? 'Asistencia bloqueada' : 'Marcar Justificado'}
                    >
                      J
                    </button>

                    {/* Toggle Observation Button */}
                    <button
                      onClick={() => setActiveObsStudentId(isObsOpen ? null : student.id)}
                      className={`p-1.5 rounded-lg transition-colors ml-0.5 ${
                        hasObs
                          ? 'text-amber-600 bg-amber-100 hover:bg-amber-200 dark:text-amber-400 dark:bg-amber-950/40 dark:hover:bg-amber-900/40'
                          : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-[#1f2633]'
                      }`}
                      title="Observaciones"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Inline Observation Panel */}
                {isObsOpen && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-[#262d3a] animate-fade-in space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Observación particular:
                      </span>
                      {entry.observation && (
                        <button
                          onClick={() => {
                            if (isLocked) {
                              showToast('Asistencia bloqueada por seguridad');
                              return;
                            }
                            onUpdateAttendance(selectedCourse.id, currentDate, student.id, entry.status, '', false);
                          }}
                          className="text-[10px] text-rose-500 hover:underline"
                        >
                          Borrar nota
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      disabled={isLocked}
                      placeholder={isLocked ? 'Asistencia bloqueada para edición...' : 'Ej. Llegó 8:30 con nota / Certificado médico / Se retiró 10:45...'}
                      defaultValue={entry.observation || ''}
                      onBlur={e => {
                        if (isLocked) return;
                        onUpdateAttendance(selectedCourse.id, currentDate, student.id, entry.status, e.target.value, entry.isDiscipline);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          if (isLocked) {
                            showToast('Asistencia bloqueada por seguridad');
                            return;
                          }
                          onUpdateAttendance(selectedCourse.id, currentDate, student.id, entry.status, e.currentTarget.value, entry.isDiscipline);
                          setActiveObsStudentId(null);
                        }
                      }}
                      className={`w-full bg-slate-50 dark:bg-[#0d0f13] border border-slate-300 dark:border-[#2b3444] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 ${
                        isLocked ? 'cursor-not-allowed opacity-75' : ''
                      }`}
                    />

                    {/* Indiscipline checkbox toggle */}
                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-rose-700 dark:text-rose-400 font-bold select-none pt-0.5">
                      <input
                        type="checkbox"
                        checked={Boolean(entry.isDiscipline)}
                        disabled={isLocked}
                        onChange={e => {
                          if (isLocked) {
                            showToast('Asistencia bloqueada por seguridad');
                            return;
                          }
                          onUpdateAttendance(selectedCourse.id, currentDate, student.id, entry.status, entry.observation, e.target.checked);
                        }}
                        className="w-3.5 h-3.5 text-rose-600 rounded-sm focus:ring-rose-500 border-rose-300"
                      />
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Marcar como falta de Indisciplina / Conducta</span>
                    </label>

                    {/* Quick observation chips */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        'Llegó con nota tutor',
                        'Certificado médico',
                        'Enfermería',
                        'Retiro anticipado c/tutor',
                        'Evaluación trimestral',
                        'Falta de conducta en clase',
                      ].map(preset => (
                        <button
                          key={preset}
                          onClick={() => {
                            if (isLocked) {
                              showToast('Asistencia bloqueada por seguridad');
                              return;
                            }
                            const isDisciplinePreset = preset === 'Falta de conducta en clase';
                            onUpdateAttendance(selectedCourse.id, currentDate, student.id, entry.status, preset, isDisciplinePreset || entry.isDiscipline);
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded-md border transition ${
                            preset === 'Falta de conducta en clase'
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-900/40'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#1a202c] dark:hover:bg-[#252d3d] dark:text-slate-300 border-slate-200 dark:border-slate-700/60'
                          }`}
                        >
                          + {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Floating Bottom Quick Status Helper */}
      <div className="bg-white/95 dark:bg-[#12151b]/95 border border-slate-200 dark:border-[#242c3b] rounded-2xl p-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shadow-lg transition-colors">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>
            Registrados: <strong className="text-slate-900 dark:text-white">{courseStudents.length - stats.unrecorded}</strong> de {courseStudents.length}
          </span>
        </div>
        <button
          onClick={e => {
            e.stopPropagation();
            handleResetDay(e);
          }}
          className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 hover:text-rose-500 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reiniciar día</span>
        </button>
      </div>

      {/* WhatsApp Modal Dialog */}
      <WhatsAppModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        course={selectedCourse}
        dateStr={currentDate}
        students={courseStudents}
        dayRecord={dayRecord}
        defaultPhone={defaultWhatsAppPhone}
        institutionName={institutionName}
      />

      {/* Custom Confirmation Modal for Day Reset */}
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        title="Reiniciar Asistencia del Día"
        message={`¿Estás seguro de que deseas reiniciar la asistencia de hoy (${currentDate}) para el curso "${selectedCourse.name}"?\n\nSe restablecerán las marcas de todos los alumnos de este curso a estado sin registrar.`}
        confirmText="Reiniciar Día"
        variant="warning"
        iconType="reset"
        onConfirm={confirmResetDay}
        onClose={() => setIsResetConfirmOpen(false)}
      />
    </div>
  );
};
