import React, { useRef, useState } from 'react';
import {
  Download,
  Upload,
  Database,
  FileCode,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  School,
  User,
  Calendar,
  Phone,
  Building,
  Save,
} from 'lucide-react';
import { Course, SchoolConfig, Student, AttendanceRecordMap } from '../types';
import { exportBackupJSON, importBackupJSON, getDeviceResponsible, setDeviceResponsible } from '../utils/storage';
import { ThemeMode } from '../hooks/useTheme';
import { ConfirmModal } from './ConfirmModal';

interface SettingsViewProps {
  config: SchoolConfig;
  onUpdateConfig: (newConfig: SchoolConfig) => void;
  onRestoreData: () => void;
  courses: Course[];
  students: Student[];
  attendanceMap: AttendanceRecordMap;
  theme: ThemeMode;
  onToggleTheme?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  config,
  onUpdateConfig,
  onRestoreData,
  courses,
  students,
  attendanceMap,
  theme,
}) => {
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [tempInstitutionName, setTempInstitutionName] = useState(
    () => config.nombreInstitucion || config.institutionName || 'Escuela / Instituto'
  );
  const [tempResponsible, setTempResponsible] = useState(
    () => getDeviceResponsible() || config.responsibleName || ''
  );
  const [tempPhone, setTempPhone] = useState(config.defaultWhatsAppPhone || '');
  const [tempYear, setTempYear] = useState(config.academicYear || '2026');
  const [isResetDataModalOpen, setIsResetDataModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleExportBackup = () => {
    try {
      exportBackupJSON();
      showFeedback('success', '¡Archivo de respaldo JSON exportado con éxito!');
    } catch (err) {
      showFeedback('error', 'Error al exportar respaldo: ' + (err as Error).message);
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      const res = importBackupJSON(content);
      if (res.success) {
        showFeedback('success', res.message);
        onRestoreData();
      } else {
        showFeedback('error', res.message);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInstName = tempInstitutionName.trim() || 'Escuela / Instituto';
    const cleanResponsible = tempResponsible.trim();
    setDeviceResponsible(cleanResponsible);
    
    const updatedConfig: SchoolConfig = {
      ...config,
      nombreInstitucion: cleanInstName,
      institutionName: cleanInstName,
      responsibleName: cleanResponsible,
      defaultWhatsAppPhone: tempPhone.trim(),
      academicYear: tempYear.trim() || '2026',
    };
    
    onUpdateConfig(updatedConfig);
    showFeedback('success', 'Configuración institucional y datos guardados correctamente.');
  };

  const handleExecuteResetFactory = () => {
    try {
      localStorage.clear();
      onRestoreData();
      showFeedback('success', 'Base de datos restablecida a los valores iniciales de muestra.');
    } catch (err) {
      showFeedback('error', 'Error al restablecer datos: ' + (err as Error).message);
    }
    setIsResetDataModalOpen(false);
  };

  // Generate self-contained standalone HTML bundle with Dark/Light mode toggle
  const handleDownloadStandaloneHTML = () => {
    const currentInstName = tempInstitutionName.trim() || config.nombreInstitucion || 'Escuela / Instituto';
    const htmlBundle = `<!DOCTYPE html>
<html lang="es" class="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Control de Asistencia - ${currentInstName}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class'
    }
  </script>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 9999px; }
    .dark ::-webkit-scrollbar-thumb { background: #262d3a; }
  </style>
</head>
<body class="bg-slate-100 dark:bg-[#0e1014] text-slate-900 dark:text-slate-100 min-h-screen transition-colors">
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect } = React;

    function StandaloneApp() {
      const [isDark, setIsDark] = useState(${theme === 'dark'});
      const [currentDate, setCurrentDate] = useState(() => {
        const now = new Date();
        return now.toISOString().split('T')[0];
      });
      const [courses, setCourses] = useState(${JSON.stringify(courses)});
      const [students, setStudents] = useState(${JSON.stringify(students)});
      const [attendance, setAttendance] = useState(${JSON.stringify(attendanceMap)});
      const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id || '');
      const institutionName = ${JSON.stringify(currentInstName)};

      useEffect(() => {
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }, [isDark]);

      const currentCourse = courses.find(c => c.id === selectedCourseId) || courses[0];
      const courseStudents = students.filter(s => s.courseId === currentCourse?.id);
      const recordKey = currentCourse ? currentCourse.id + '_' + currentDate : '';
      const dayRecord = attendance[recordKey] || {};

      const updateStatus = (studentId, status) => {
        setAttendance(prev => ({
          ...prev,
          [recordKey]: {
            ...prev[recordKey],
            [studentId]: { status, observation: prev[recordKey]?.[studentId]?.observation || '' }
          }
        }));
      };

      const markAll = (status) => {
        const updates = {};
        courseStudents.forEach(s => { updates[s.id] = { status }; });
        setAttendance(prev => ({ ...prev, [recordKey]: updates }));
      };

      const pCount = courseStudents.filter(s => dayRecord[s.id]?.status === 'P').length;
      const aCount = courseStudents.filter(s => dayRecord[s.id]?.status === 'A').length;
      const tCount = courseStudents.filter(s => dayRecord[s.id]?.status === 'T').length;
      const jCount = courseStudents.filter(s => dayRecord[s.id]?.status === 'J').length;

      return (
        <div className="max-w-2xl mx-auto p-4 space-y-4">
          <header className="flex items-center justify-between p-3 bg-white dark:bg-[#151820] border border-slate-200 dark:border-[#262d3a] rounded-2xl shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-black text-white text-lg">
                A
              </div>
              <div>
                <h1 className="font-bold text-sm text-slate-900 dark:text-white">{institutionName}</h1>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Asistencia Escolar · Versión Autónoma Offline</p>
              </div>
            </div>
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-amber-400 border border-slate-200 dark:border-slate-700 text-xs font-bold"
            >
              {isDark ? '☀️ Modo Claro' : '🌙 Modo Oscuro'}
            </button>
          </header>

          <div className="bg-white dark:bg-[#151820] border border-slate-200 dark:border-[#262d3a] rounded-2xl p-4 space-y-3 shadow-sm">
            <div className="flex justify-between items-center">
              <input type="date" value={currentDate} onChange={e => setCurrentDate(e.target.value)} className="bg-slate-50 dark:bg-[#0e1116] border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs text-slate-900 dark:text-white" />
              <div className="flex gap-2 overflow-x-auto">
                {courses.map(c => (
                  <button key={c.id} onClick={() => setSelectedCourseId(c.id)} className={"px-3 py-1 rounded-xl text-xs font-bold " + (c.id === currentCourse?.id ? "bg-amber-500 text-black shadow" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white")}>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-xl border border-emerald-200 dark:border-emerald-800/40"><span className="text-emerald-700 dark:text-emerald-400 font-bold block">P: {pCount}</span></div>
              <div className="bg-rose-50 dark:bg-rose-950/40 p-2 rounded-xl border border-rose-200 dark:border-rose-800/40"><span className="text-rose-700 dark:text-rose-400 font-bold block">A: {aCount}</span></div>
              <div className="bg-amber-50 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-200 dark:border-amber-800/40"><span className="text-amber-700 dark:text-amber-400 font-bold block">T: {tCount}</span></div>
              <div className="bg-indigo-50 dark:bg-indigo-950/40 p-2 rounded-xl border border-indigo-200 dark:border-indigo-800/40"><span className="text-indigo-700 dark:text-indigo-400 font-bold block">J: {jCount}</span></div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => markAll('P')} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white">Todos Presente</button>
              <button onClick={() => markAll('A')} className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 rounded-xl text-xs font-bold text-white">Todos Ausente</button>
            </div>
          </div>

          <div className="space-y-2">
            {courseStudents.map((s, idx) => {
              const st = dayRecord[s.id]?.status;
              return (
                <div key={s.id} className="flex items-center justify-between p-3 bg-white dark:bg-[#151820] border border-slate-200 dark:border-[#262d3a] rounded-xl shadow-xs">
                  <div className="text-xs">
                    <span className="text-amber-700 dark:text-amber-400 font-bold mr-2">{idx + 1}</span>
                    <strong className="text-slate-900 dark:text-white uppercase">{s.lastName}</strong>, {s.firstName}
                  </div>
                  <div className="flex gap-1 font-bold text-xs">
                    {['P', 'A', 'T', 'J'].map(btn => (
                      <button key={btn} onClick={() => updateStatus(s.id, btn)} className={"w-8 h-8 rounded-lg " + (st === btn ? "bg-amber-400 text-black ring-2 ring-amber-500" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300")}>
                        {btn}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    ReactDOM.render(<StandaloneApp />, document.getElementById('root'));
  </script>
</body>
</html>`;

    const blob = new Blob([htmlBundle], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Control_Asistencia_Offline_Autonoma.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showFeedback('success', '¡Archivo HTML autónomo descargado exitosamente!');
  };

  const totalRegisteredEntries = Object.keys(attendanceMap).length;

  return (
    <div className="max-w-4xl mx-auto px-3.5 pb-24 pt-3 space-y-4">
      {/* Feedback message banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition-all animate-slide-down ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-300 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-700/60 dark:text-emerald-300'
              : 'bg-rose-50 border border-rose-300 text-rose-800 dark:bg-rose-950 dark:border-rose-700/60 dark:text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 stroke-[2.5]" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* School Configuration Form (Parametrización Institucional / Marca Blanca) */}
      <div className="bg-white dark:bg-[#151820] border border-slate-200 dark:border-[#262d3a] rounded-2xl p-4 shadow-sm dark:shadow-md space-y-4 transition-colors">
        <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-[#252c3b] pb-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <School className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Configuración Institucional (Marca Blanca)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Personaliza el nombre de tu institución para los encabezados de pantalla y reportes exportables
            </p>
          </div>
        </div>

        <form onSubmit={handleSavePreferences} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Nombre de la Institución / Escuela</span>
            </label>
            <input
              type="text"
              placeholder="Ej. Escuela Secundaria N° 5 / Instituto Modelo San Martín"
              value={tempInstitutionName}
              onChange={e => setTempInstitutionName(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0e1116] border border-slate-300 dark:border-[#252c3b] rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              required
            />
            <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1">
              Este nombre se mostrará en el encabezado de la app, en las planillas Excel (.xlsx) y en los documentos PDF generados.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Nombre del Responsable / Preceptor Predeterminado</span>
            </label>
            <input
              type="text"
              placeholder="Ej. Prof. Juan Pérez"
              value={tempResponsible}
              onChange={e => {
                const val = e.target.value;
                setTempResponsible(val);
                setDeviceResponsible(val);
              }}
              className="w-full bg-slate-50 dark:bg-[#0e1116] border border-slate-300 dark:border-[#252c3b] rounded-xl px-3.5 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Ciclo Lectivo</span>
              </label>
              <input
                type="text"
                placeholder="2026"
                value={tempYear}
                onChange={e => setTempYear(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#0e1116] border border-slate-300 dark:border-[#252c3b] rounded-xl px-3.5 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Celular Preceptoría WhatsApp (Opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ej. +54911..."
                value={tempPhone}
                onChange={e => setTempPhone(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#0e1116] border border-slate-300 dark:border-[#252c3b] rounded-xl px-3.5 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-md transition active:scale-98"
            >
              <Save className="w-4 h-4 stroke-[2.5]" />
              <span>Guardar Configuración</span>
            </button>
          </div>
        </form>
      </div>

      {/* Main Backup & Recovery Box (100% Offline-First) */}
      <div className="bg-white dark:bg-[#151820] border border-slate-200 dark:border-[#262d3a] rounded-2xl p-4 shadow-sm dark:shadow-md space-y-3.5 transition-colors">
        <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-[#252c3b] pb-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Respaldo y Recuperación (100% Offline-First)
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Almacenamiento privado en memoria local de este dispositivo con exportación y restauración de copias JSON
            </p>
          </div>
        </div>

        {/* Database Stats */}
        <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-[#0e1116] p-3 rounded-xl border border-slate-200 dark:border-[#212735] text-center text-xs">
          <div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-bold">Cursos</span>
            <span className="text-base font-black text-amber-700 dark:text-amber-400">{courses.length}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-bold">Alumnos</span>
            <span className="text-base font-black text-slate-900 dark:text-white">{students.length}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-bold">Días Registrados</span>
            <span className="text-base font-black text-emerald-700 dark:text-emerald-400">{totalRegisteredEntries}</span>
          </div>
        </div>

        {/* 2 Essential Local Actions: Export Backup & Restore Backup */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Export JSON */}
          <button
            onClick={handleExportBackup}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-md active:scale-98 transition"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>Exportar Respaldo (Backup JSON)</span>
          </button>

          {/* Restore JSON */}
          <label className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1b2230] dark:hover:bg-[#232c3f] border border-slate-300 dark:border-[#2e394d] text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer active:scale-98 transition">
            <Upload className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Restaurar Respaldo (Cargar JSON)</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>
        </div>

        <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-relaxed italic">
          * Todo el sistema funciona en modo 100% Offline-First. Todos los datos se resguardan de manera local y privada en la memoria de este navegador. Puedes exportar el archivo JSON para resguardar tus datos o transferirlos a cualquier otro dispositivo sin depender de servidores o la nube.
        </p>
      </div>

      {/* Standalone Single-File HTML Export */}
      <div className="bg-white dark:bg-[#151820] border border-slate-200 dark:border-[#262d3a] rounded-2xl p-4 shadow-sm dark:shadow-md space-y-3 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
            <FileCode className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Generar Archivo .HTML Autónomo
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Descarga un único archivo .html listo para abrir con doble clic en cualquier computadora o celular sin internet
            </p>
          </div>
        </div>

        <button
          onClick={handleDownloadStandaloneHTML}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-cyan-50 hover:bg-cyan-100 dark:bg-[#1a222f] dark:hover:bg-[#202b3c] border border-cyan-300 dark:border-cyan-500/30 text-cyan-800 dark:text-cyan-300 font-bold text-xs transition active:scale-98 shadow-xs"
        >
          <Download className="w-4 h-4" />
          <span>Descargar Código Completo en 1 Archivo .HTML</span>
        </button>
      </div>

      {/* Danger Zone: Factory Reset */}
      <div className="bg-rose-50/70 dark:bg-[#181416] border border-rose-200 dark:border-rose-950/60 rounded-2xl p-4 shadow-sm flex items-center justify-between transition-colors">
        <div>
          <h4 className="text-xs font-bold text-rose-800 dark:text-rose-300">Restablecer datos iniciales</h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Reinicia cursos y alumnos a los ejemplos de muestra iniciales del sistema.
          </p>
        </div>
        <button
          onClick={e => {
            e.stopPropagation();
            setIsResetDataModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/30 dark:hover:bg-rose-900/60 border border-rose-300 dark:border-rose-700/50 text-rose-800 dark:text-rose-300 text-xs font-bold transition active:scale-95"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Restablecer</span>
        </button>
      </div>

      {/* Custom Confirmation Modal for Factory Reset */}
      <ConfirmModal
        isOpen={isResetDataModalOpen}
        title="Restablecer Base de Datos"
        message={`¿Estás seguro de que deseas restablecer la base de datos a los valores iniciales de muestra?\n\nSe restablecerán los cursos, listas de alumnos y planillas. Esta acción no se puede deshacer.`}
        confirmText="Restablecer Todo"
        variant="danger"
        iconType="reset"
        onConfirm={handleExecuteResetFactory}
        onClose={() => setIsResetDataModalOpen(false)}
      />
    </div>
  );
};
