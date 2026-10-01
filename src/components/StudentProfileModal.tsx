import React, { useState, useMemo } from 'react';
import {
  X,
  FileText,
  Download,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  UserX,
  ShieldAlert,
  PlusCircle,
  Save,
  Check,
} from 'lucide-react';
import { Course, Student, AttendanceRecordMap, AttendanceStatus } from '../types';
import { getTodayDateString } from '../utils/storage';
import { formatDecimalSpanish } from '../utils/excel';
import { exportStudentProfilePDF } from '../utils/pdf';
import { StudentPdfExportModal } from './StudentPdfExportModal';

interface StudentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  course: Course | null;
  attendanceMap: AttendanceRecordMap;
  institutionName?: string;
  onUpdateAttendance?: (
    courseId: string,
    date: string,
    studentId: string,
    status: AttendanceStatus,
    observation?: string,
    isDiscipline?: boolean
  ) => void;
  currentSelectedDate?: string;
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  isOpen,
  onClose,
  student,
  course,
  attendanceMap,
  institutionName = 'Escuela / Instituto',
  onUpdateAttendance,
  currentSelectedDate,
}) => {
  const [selectedIncidentDate, setSelectedIncidentDate] = useState<string>(() => {
    return currentSelectedDate || getTodayDateString();
  });
  const [newObsText, setNewObsText] = useState('');
  const [newIsDiscipline, setNewIsDiscipline] = useState(true);
  const [newStatus, setNewStatus] = useState<AttendanceStatus>('P');
  const [isAddingIncident, setIsAddingIncident] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);
  const [isPdfExportModalOpen, setIsPdfExportModalOpen] = useState(false);

  // Collect all recorded dates for this course
  const recordedDates = useMemo(() => {
    if (!course) return [];
    const prefix = `${course.id}_`;
    const dates: string[] = [];
    Object.keys(attendanceMap).forEach(key => {
      if (key.startsWith(prefix)) {
        const d = key.substring(prefix.length);
        if (d && !dates.includes(d)) dates.push(d);
      }
    });
    return dates.sort().reverse();
  }, [attendanceMap, course]);

  // Compute stats and chronological history
  const { stats, historyList } = useMemo(() => {
    if (!student || !course) {
      return {
        stats: {
          present: 0,
          absent: 0,
          late: 0,
          justified: 0,
          indisciplines: 0,
          totalAusentes: 0,
          totalInasistencias: 0,
          totalRecorded: 0,
          rate: 0,
        },
        historyList: [],
      };
    }

    let present = 0;
    let absent = 0;
    let late = 0;
    let justified = 0;
    let indisciplines = 0;

    const list: Array<{
      date: string;
      status: AttendanceStatus;
      statusLabel: string;
      observation: string;
      isDiscipline: boolean;
      updatedAt?: string;
    }> = [];

    // Combine recorded dates and the currently active date if not yet in recorded
    const allUniqueDates = Array.from(new Set([...recordedDates]));
    allUniqueDates.sort().reverse();

    allUniqueDates.forEach(date => {
      const dayRecord = attendanceMap[`${course.id}_${date}`] || {};
      const entry = dayRecord[student.id];
      if (!entry && !dayRecord) return;

      const st = entry?.status || null;
      const obs = entry?.observation?.trim() || '';
      const isDisc = Boolean(
        entry?.isDiscipline ||
        obs.toLowerCase().includes('indisciplina') ||
        obs.toLowerCase().includes('sanción') ||
        obs.toLowerCase().includes('falta de conducta')
      );

      if (st === 'P') present++;
      else if (st === 'A') absent++;
      else if (st === 'T') late++;
      else if (st === 'J') justified++;

      if (isDisc) {
        indisciplines++;
      }

      let statusLabel = 'Sin registrar';
      if (st === 'P') statusLabel = 'Presente';
      else if (st === 'A') statusLabel = 'Ausente';
      else if (st === 'T') statusLabel = 'Tardanza';
      else if (st === 'J') statusLabel = 'Justificado';

      list.push({
        date,
        status: st,
        statusLabel,
        observation: obs,
        isDiscipline: isDisc,
        updatedAt: entry?.updatedAt,
      });
    });

    const totalAusentes = absent + justified;
    const totalInasistencias = totalAusentes + (late * 0.5);
    const totalEvaluated = present + absent + late + justified;
    const rate = totalEvaluated > 0 ? Math.round((present / totalEvaluated) * 100) : 0;

    return {
      stats: {
        present,
        absent,
        late,
        justified,
        indisciplines,
        totalAusentes,
        totalInasistencias,
        totalRecorded: allUniqueDates.length,
        rate,
      },
      historyList: list,
    };
  }, [student, course, recordedDates, attendanceMap]);

  if (!isOpen || !student || !course) return null;

  // Handle saving an indiscipline or observation
  const handleSaveIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateAttendance || !selectedIncidentDate) return;

    // Check existing entry to retain status if needed
    const dayRecord = attendanceMap[`${course.id}_${selectedIncidentDate}`] || {};
    const existingEntry = dayRecord[student.id];
    const statusToSave: AttendanceStatus = existingEntry?.status || newStatus || 'P';

    onUpdateAttendance(
      course.id,
      selectedIncidentDate,
      student.id,
      statusToSave,
      newObsText.trim(),
      newIsDiscipline
    );

    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 2500);
    setNewObsText('');
    setIsAddingIncident(false);
  };

  // Generate and download TXT report
  const handleDownloadTxtReport = () => {
    const today = getTodayDateString();
    const courseShiftStr = course.shift ? `· Turno ${course.shift}` : '';

    let content = `==================================================\n`;
    content += `FICHA TÉCNICA Y SITUACIÓN DEL ALUMNO\n`;
    content += `Institución: ${institutionName}\n`;
    content += `==================================================\n`;
    content += `Nombre: ${student.lastName}, ${student.firstName}\n`;
    content += `DNI: ${student.dni || 'Sin registrar'}\n`;
    content += `Curso: ${course.name} ${courseShiftStr}\n`;
    content += `Fecha del Informe: ${today}\n\n`;

    content += `--- RESUMEN DE ASISTENCIA Y CONDUCTA ---\n`;
    content += `Porcentaje de Asistencia: ${stats.rate}%\n`;
    content += `Días Presente: ${stats.present}\n`;
    content += `Días Ausente: ${stats.totalAusentes} (Injustificadas: ${stats.absent} / Justificadas: ${stats.justified})\n`;
    content += `Tardanzas: ${stats.late} (0.5 c/u = ${formatDecimalSpanish(stats.late * 0.5)} inasistencias)\n`;
    content += `Total Inasistencias / Faltas Totales: ${formatDecimalSpanish(stats.totalInasistencias)}\n`;
    content += `Indisciplinas: ${stats.indisciplines}\n`;
    content += `Total Clases Registradas: ${stats.totalRecorded}\n\n`;

    content += `--- HISTORIAL DE REGISTROS, OBSERVACIONES E INDISCIPLINAS ---\n`;
    if (historyList.length === 0) {
      content += `No hay registros históricos de asistencia ni observaciones cargadas a la fecha.\n`;
    } else {
      historyList.forEach(item => {
        const tipoStr = item.isDiscipline ? 'Indisciplina' : 'Asistencia';
        const detalleStr = item.observation ? item.observation : 'Sin observaciones particulares';
        content += `[${item.date}] - Estado: ${item.statusLabel}\n`;
        content += `             - Tipo: ${tipoStr}\n`;
        content += `             - Detalle/Observación: ${detalleStr}\n`;
      });
    }

    content += `==================================================\n`;

    // Download trigger
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeStudentName = `${student.lastName}_${student.firstName}`.replace(/[\s/\\?%*:|"<>]/g, '_');
    link.href = url;
    link.download = `Ficha_${safeStudentName}_${today}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3.5 bg-black/75 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#151922] w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-[#283244] flex flex-col max-h-[92vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-slate-200 dark:border-[#232b3b] bg-slate-50 dark:bg-[#11141c]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-base border border-amber-500/30 flex-shrink-0">
              {student.listNumber || '#'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wide">
                  {student.lastName}, {student.firstName}
                </h2>
                {student.genero === 'V' && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold text-[10px] border border-blue-500/30">
                    Varón (V)
                  </span>
                )}
                {student.genero === 'M' && (
                  <span className="px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-600 dark:text-pink-400 font-bold text-[10px] border border-pink-500/30">
                    Mujer (M)
                  </span>
                )}
                {stats.indisciplines > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-[10px] border border-rose-500/30 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" />
                    {stats.indisciplines} Indisciplina{stats.indisciplines === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                DNI: <strong className="text-slate-700 dark:text-slate-300">{student.dni || 'Sin registrar'}</strong> · Curso:{' '}
                <strong className="text-slate-700 dark:text-slate-300">
                  {course.name} {course.shift && `(${course.shift})`}
                </strong>
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

        {/* Scrollable Modal Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 text-slate-800 dark:text-slate-200">
          {/* Quick Success Toast */}
          {saveSuccessMsg && (
            <div className="bg-emerald-500 text-slate-950 px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm animate-fade-in">
              <Check className="w-4 h-4 stroke-[3]" />
              <span>¡Registro de indisciplina / observación guardado con éxito!</span>
            </div>
          )}

          {/* Section: Resumen de Asistencia e Indisciplinas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-500" />
                Resumen de Asistencia y Conducta
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {stats.totalRecorded} jornadas registradas
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {/* % Asistencia */}
              <div className="bg-slate-50 dark:bg-[#0f1218] p-2.5 rounded-xl border border-slate-200 dark:border-[#242c3c] text-center">
                <span className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                  % Asistencia
                </span>
                <span
                  className={`text-lg font-black ${
                    stats.rate >= 80
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : stats.rate >= 65
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {stats.rate}%
                </span>
              </div>

              {/* Presente */}
              <div className="bg-slate-50 dark:bg-[#0f1218] p-2.5 rounded-xl border border-slate-200 dark:border-[#242c3c] text-center">
                <span className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Presente
                </span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  {stats.present}
                </span>
              </div>

              {/* Tardanzas (0.5) */}
              <div className="bg-slate-50 dark:bg-[#0f1218] p-2.5 rounded-xl border border-slate-200 dark:border-[#242c3c] text-center">
                <span className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1" title="Tardanzas computadas como 0.5 inasistencia cada una">
                  <Clock className="w-3 h-3 text-amber-500" /> Tardanzas (0.5)
                </span>
                <span className="text-lg font-black text-amber-600 dark:text-amber-400">
                  {stats.late}
                </span>
                {stats.late > 0 && (
                  <span className="block text-[9px] font-medium text-slate-500 dark:text-slate-400">
                    = {formatDecimalSpanish(stats.late * 0.5)} faltas
                  </span>
                )}
              </div>

              {/* Ausente */}
              <div className="bg-slate-50 dark:bg-[#0f1218] p-2.5 rounded-xl border border-slate-200 dark:border-[#242c3c] text-center">
                <span className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                  <UserX className="w-3 h-3 text-rose-500" /> Ausente
                </span>
                <span className="text-lg font-black text-rose-600 dark:text-rose-400">
                  {stats.totalAusentes}
                </span>
                <span className="block text-[9px] text-slate-500 dark:text-slate-400">
                  {stats.absent} inj. / {stats.justified} just.
                </span>
              </div>

              {/* Total Inasistencias */}
              <div className="bg-rose-50/60 dark:bg-rose-950/20 p-2.5 rounded-xl border border-rose-300 dark:border-rose-900/40 text-center">
                <span className="block text-[10px] uppercase font-bold text-rose-700 dark:text-rose-300" title="Total Inasistencias = Ausentes + (Tardanzas * 0.5)">
                  Faltas Totales
                </span>
                <span className="text-lg font-black text-rose-700 dark:text-rose-400">
                  {formatDecimalSpanish(stats.totalInasistencias)}
                </span>
                <span className="block text-[9px] text-rose-600/80 dark:text-rose-400/80">
                  inasistencias
                </span>
              </div>

              {/* Indisciplinas */}
              <div className="bg-slate-50 dark:bg-[#0f1218] p-2.5 rounded-xl border border-slate-200 dark:border-[#242c3c] text-center">
                <span className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-rose-500" /> Indisciplinas
                </span>
                <span
                  className={`text-lg font-black ${
                    stats.indisciplines > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {stats.indisciplines}
                </span>
              </div>
            </div>
          </div>

          {/* Section: Registrar nueva Indisciplina / Observación */}
          <div className="bg-slate-50 dark:bg-[#0e1116] border border-slate-200 dark:border-[#232b3b] rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                Registrar Indisciplina u Observación
              </span>
              <button
                type="button"
                onClick={() => setIsAddingIncident(!isAddingIncident)}
                className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                {isAddingIncident ? 'Ocultar formulario' : 'Nuevo registro'}
              </button>
            </div>

            {isAddingIncident && (
              <form onSubmit={handleSaveIncident} className="space-y-2.5 pt-1 border-t border-slate-200 dark:border-[#222a3a]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Fecha del suceso:
                    </label>
                    <input
                      type="date"
                      value={selectedIncidentDate}
                      onChange={e => setSelectedIncidentDate(e.target.value)}
                      className="w-full bg-white dark:bg-[#141822] border border-slate-300 dark:border-[#2b3545] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Estado de asistencia ese día:
                    </label>
                    <select
                      value={newStatus || 'P'}
                      onChange={e => setNewStatus(e.target.value as AttendanceStatus)}
                      className="w-full bg-white dark:bg-[#141822] border border-slate-300 dark:border-[#2b3545] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="P">Presente (P)</option>
                      <option value="A">Ausente (A)</option>
                      <option value="T">Tardanza (T)</option>
                      <option value="J">Justificado (J)</option>
                    </select>
                  </div>
                </div>

                {/* Checkbox Indisciplina */}
                <label className="flex items-center gap-2 cursor-pointer select-none bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 p-2 rounded-lg">
                  <input
                    type="checkbox"
                    checked={newIsDiscipline}
                    onChange={e => setNewIsDiscipline(e.target.checked)}
                    className="w-4 h-4 text-rose-600 rounded-sm focus:ring-rose-500 border-rose-300"
                  />
                  <div>
                    <span className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                      Marcar formalmente como falta de Indisciplina / Conducta
                    </span>
                    <span className="text-[10px] text-rose-600 dark:text-rose-400/80 block">
                      Se computará en el contador de faltas disciplinarias del alumno y en su informe descargable.
                    </span>
                  </div>
                </label>

                {/* Textarea */}
                <div>
                  <label className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Descripción detallada de la falta o situación observada:
                  </label>
                  <textarea
                    rows={2}
                    value={newObsText}
                    onChange={e => setNewObsText(e.target.value)}
                    placeholder="Describa el hecho, contexto, intervenciones o advertencias realizadas al alumno..."
                    className="w-full bg-white dark:bg-[#141822] border border-slate-300 dark:border-[#2b3545] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 resize-none"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingIncident(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-xs active:scale-95"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Guardar en Ficha</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Section: Historial completo de observaciones e indisciplinas */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-500" />
              Historial de Registros, Observaciones e Indisciplinas
            </h3>

            {historyList.length === 0 ? (
              <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-xs bg-slate-50 dark:bg-[#0e1116] rounded-xl border border-slate-200 dark:border-[#212735]">
                No hay asistencias ni incidencias registradas aún para este alumno.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {historyList.map(item => (
                  <div
                    key={item.date}
                    className={`p-2.5 rounded-xl border text-xs transition ${
                      item.isDiscipline
                        ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/40'
                        : item.observation
                        ? 'bg-amber-50/50 dark:bg-amber-950/15 border-amber-200 dark:border-amber-900/30'
                        : 'bg-slate-50 dark:bg-[#0f1218] border-slate-200 dark:border-[#232b3b]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-[11.5px]">
                          {item.date}
                        </span>

                        {/* Status chip */}
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${
                            item.status === 'P'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/40'
                              : item.status === 'A'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400 border-rose-300 dark:border-rose-500/40'
                              : item.status === 'T'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400 border-amber-300 dark:border-amber-500/40'
                              : item.status === 'J'
                              ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-400 border-indigo-300 dark:border-indigo-500/40'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {item.statusLabel}
                        </span>

                        {/* Indiscipline vs Attendance badge */}
                        {item.isDiscipline ? (
                          <span className="px-2 py-0.5 rounded-md bg-rose-500 text-white font-extrabold text-[9.5px] uppercase tracking-wider flex items-center gap-1 shadow-xs">
                            <ShieldAlert className="w-2.5 h-2.5" /> Indisciplina
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                            Asistencia
                          </span>
                        )}
                      </div>
                    </div>

                    <p
                      className={`text-[11px] leading-relaxed ${
                        item.isDiscipline
                          ? 'text-rose-900 dark:text-rose-200 font-medium'
                          : item.observation
                          ? 'text-slate-700 dark:text-slate-300'
                          : 'text-slate-400 dark:text-slate-500 italic'
                      }`}
                    >
                      {item.observation || 'Sin observaciones registradas.'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer with Actions */}
        <div className="p-3.5 border-t border-slate-200 dark:border-[#232b3b] bg-slate-50 dark:bg-[#11141c] flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPdfExportModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-sm active:scale-95"
              title="Configurar y descargar informe individual en formato PDF (.pdf)"
            >
              <FileText className="w-4 h-4 stroke-[2]" />
              <span>Descargar Informe (.pdf)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadTxtReport}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-sm active:scale-95"
              title="Descargar informe plano .txt con toda la situación detallada del alumno"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>Informe (.txt)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-[#1d232f] dark:hover:bg-[#262e3d] text-slate-800 dark:text-slate-200 font-bold text-xs transition"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* PDF Export Configuration Modal */}
      <StudentPdfExportModal
        isOpen={isPdfExportModalOpen}
        onClose={() => setIsPdfExportModalOpen(false)}
        student={student}
        course={course}
        attendanceMap={attendanceMap}
        institutionName={institutionName}
      />
    </div>
  );
};
