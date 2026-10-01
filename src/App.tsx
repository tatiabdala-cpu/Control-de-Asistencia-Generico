/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { BottomNav, NavTab } from './components/BottomNav';
import { AttendanceView } from './components/AttendanceView';
import { CoursesManagement } from './components/CoursesManagement';
import { HistoryAndReports } from './components/HistoryAndReports';
import { SettingsView } from './components/SettingsView';
import { SplashScreen } from './components/SplashScreen';
import { ConfirmModal } from './components/ConfirmModal';
import { CourseProvider } from './context/CourseContext';
import { useOnlineStatus } from './hooks/usePWAInstall';
import { useTheme } from './hooks/useTheme';
import { CheckCircle2 } from 'lucide-react';
import {
  AttendanceRecordMap,
  AttendanceStatus,
  Course,
  SchoolConfig,
  Student,
  StudentGender,
  UndoAction,
} from './types';
import {
  getTodayDateString,
  loadAttendance,
  loadConfig,
  loadCourses,
  loadStudents,
  loadSelectedCourseId,
  saveSelectedCourseId,
  saveAttendance,
  saveConfig,
  saveCourses,
  saveStudents,
  cleanCourseName,
} from './utils/storage';
import { sortAndIndexStudents, getFilterByGender } from './utils/studentSorting';

export default function App() {
  const isOnline = useOnlineStatus();
  const { theme, toggleTheme } = useTheme();
  const [currentTab, setCurrentTab] = useState<NavTab>('attendance');
  const [currentDate, setCurrentDate] = useState<string>(getTodayDateString());
  const [isAttendanceLocked, setIsAttendanceLocked] = useState<boolean>(true);

  // Application State
  const [courses, setCourses] = useState<Course[]>(() => loadCourses());
  const [students, setStudents] = useState<Student[]>(() => loadStudents());
  const [attendance, setAttendance] = useState<AttendanceRecordMap>(() => loadAttendance());
  const [config, setConfig] = useState<SchoolConfig>(() => loadConfig());
  const [selectedCourseId, setSelectedCourseId] = useState<string>(() => {
    const loaded = loadCourses();
    const saved = loadSelectedCourseId();
    if (saved && loaded.some(c => c.id === saved)) {
      return saved;
    }
    return loaded[0]?.id || '';
  });

  // Global Undo Action Buffer & Confirmation Modal State
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [isUndoConfirmModalOpen, setIsUndoConfirmModalOpen] = useState(false);
  const [undoToastMessage, setUndoToastMessage] = useState<string | null>(null);

  const pushUndo = useCallback((description: string, undoFn: () => void) => {
    setUndoStack(prev => [
      {
        id: `undo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        description,
        timestamp: Date.now(),
        undo: undoFn,
      },
      ...prev.slice(0, 29), // Retener las últimas 30 acciones en el buffer
    ]);
  }, []);

  const handleConfirmUndo = () => {
    if (undoStack.length === 0) {
      setIsUndoConfirmModalOpen(false);
      return;
    }
    const [actionToUndo, ...remainingStack] = undoStack;
    try {
      actionToUndo.undo();
      setUndoStack(remainingStack);
      setIsUndoConfirmModalOpen(false);
      setUndoToastMessage('Acción revertida correctamente');
      setTimeout(() => {
        setUndoToastMessage(null);
      }, 3500);
    } catch (err) {
      console.error('Error al ejecutar reversión de acción:', err);
      setIsUndoConfirmModalOpen(false);
    }
  };

  // Reload all state from localStorage when backup restored or factory reset
  const reloadFromStorage = useCallback(() => {
    const freshCourses = loadCourses();
    const freshStudents = loadStudents();
    const freshAttendance = loadAttendance();
    const freshConfig = loadConfig();

    setCourses(freshCourses);
    setStudents(freshStudents);
    setAttendance(freshAttendance);
    setConfig(freshConfig);

    if (freshCourses.length > 0) {
      const savedCourseId = loadSelectedCourseId();
      if (savedCourseId && freshCourses.some(c => c.id === savedCourseId)) {
        setSelectedCourseId(savedCourseId);
      } else if (!freshCourses.some(c => c.id === selectedCourseId)) {
        const fallback = freshCourses[0].id;
        setSelectedCourseId(fallback);
        saveSelectedCourseId(fallback);
      }
    }
    // Clear undo history on hard reload
    setUndoStack([]);
  }, [selectedCourseId]);

  // Sync Courses changes
  const handleAddCourse = (courseData: Omit<Course, 'id' | 'createdAt'>) => {
    const newCourse: Course = {
      ...courseData,
      name: cleanCourseName(courseData.name),
      id: `course-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const prevCourses = [...courses];
    const prevSelectedCourseId = selectedCourseId;
    const updated = [...courses, newCourse];
    setCourses(updated);
    saveCourses(updated);
    setSelectedCourseId(newCourse.id);
    saveSelectedCourseId(newCourse.id);

    pushUndo(`la creación del curso "${newCourse.name}"`, () => {
      setCourses(prevCourses);
      saveCourses(prevCourses);
      setSelectedCourseId(prevSelectedCourseId);
      saveSelectedCourseId(prevSelectedCourseId);
    });
  };

  const handleUpdateCourse = (updatedCourse: Course) => {
    const prevCourses = [...courses];
    const oldCourse = courses.find(c => c.id === updatedCourse.id);
    const cleaned = {
      ...updatedCourse,
      name: cleanCourseName(updatedCourse.name),
    };
    const updated = courses.map(c => (c.id === updatedCourse.id ? cleaned : c));
    setCourses(updated);
    saveCourses(updated);

    pushUndo(`la modificación del curso "${oldCourse?.name || updatedCourse.name}"`, () => {
      setCourses(prevCourses);
      saveCourses(prevCourses);
    });
  };

  const handleDeleteCourse = (courseId: string) => {
    const deletedCourse = courses.find(c => c.id === courseId);
    const prevCourses = [...courses];
    const prevStudents = [...students];
    const prevAttendance = { ...attendance };
    const prevSelectedCourseId = selectedCourseId;

    const updated = courses.filter(c => c.id !== courseId);
    setCourses(updated);
    saveCourses(updated);

    const updatedStudents = students.filter(s => s.courseId !== courseId);
    setStudents(updatedStudents);
    saveStudents(updatedStudents);

    let nextAttendanceMap: AttendanceRecordMap = { ...attendance };
    const prefix = `${courseId}_`;
    let changed = false;
    Object.keys(nextAttendanceMap).forEach(key => {
      if (key.startsWith(prefix)) {
        delete nextAttendanceMap[key];
        changed = true;
      }
    });
    if (changed) {
      setAttendance(nextAttendanceMap);
      saveAttendance(nextAttendanceMap);
    }

    if (selectedCourseId === courseId) {
      const nextSelected = updated[0]?.id || '';
      setSelectedCourseId(nextSelected);
      saveSelectedCourseId(nextSelected);
    }

    pushUndo(`la eliminación del curso "${deletedCourse?.name || 'curso'}"`, () => {
      setCourses(prevCourses);
      saveCourses(prevCourses);
      setStudents(prevStudents);
      saveStudents(prevStudents);
      setAttendance(prevAttendance);
      saveAttendance(prevAttendance);
      setSelectedCourseId(prevSelectedCourseId);
      saveSelectedCourseId(prevSelectedCourseId);
    });
  };

  const handleClearCourseStudents = (courseId: string) => {
    const targetCourse = courses.find(c => c.id === courseId);
    const prevStudents = [...students];
    const prevAttendance = { ...attendance };

    const studentsToRemove = students.filter(s => s.courseId === courseId);
    const studentIdsToRemove = new Set(studentsToRemove.map(s => s.id));

    const updatedStudents = students.filter(s => s.courseId !== courseId);
    setStudents(updatedStudents);
    saveStudents(updatedStudents);

    // Delete attendance records for these removed students
    let changed = false;
    const nextMap: AttendanceRecordMap = {};
    Object.entries(attendance).forEach(([key, dayRecord]) => {
      let dayChanged = false;
      const newDayRecord = { ...dayRecord };
      studentIdsToRemove.forEach(id => {
        if (newDayRecord[id]) {
          delete newDayRecord[id];
          dayChanged = true;
        }
      });
      if (dayChanged) {
        changed = true;
        nextMap[key] = newDayRecord;
      } else {
        nextMap[key] = dayRecord;
      }
    });
    if (changed) {
      setAttendance(nextMap);
      saveAttendance(nextMap);
    }

    pushUndo(`el vaciado de la nómina de "${targetCourse?.name || 'curso'}"`, () => {
      setStudents(prevStudents);
      saveStudents(prevStudents);
      setAttendance(prevAttendance);
      saveAttendance(prevAttendance);
    });
  };

  // Sync Students changes
  const handleAddStudent = (studentData: Omit<Student, 'id'>) => {
    const prevStudents = [...students];
    const courseStudents = students.filter(s => s.courseId === studentData.courseId);
    const newStudent: Student = {
      ...studentData,
      id: `st-${Date.now()}`,
      genero: studentData.genero || 'indefinido',
      listNumber: courseStudents.length + 1,
    };
    const updated = [...students, newStudent];
    setStudents(updated);
    saveStudents(updated);

    pushUndo(`el alta del estudiante ${newStudent.lastName}, ${newStudent.firstName}`, () => {
      setStudents(prevStudents);
      saveStudents(prevStudents);
    });
  };

  const handleUpdateStudent = (updatedStudent: Student) => {
    const prevStudents = [...students];
    const prevStudent = students.find(s => s.id === updatedStudent.id);
    const courseChanged = prevStudent && prevStudent.courseId !== updatedStudent.courseId;

    let updated: Student[];
    if (courseChanged) {
      const oldCourseId = prevStudent.courseId;
      const newCourseId = updatedStudent.courseId;
      const withoutStudent = students.filter(s => s.id !== updatedStudent.id);

      const oldCourseStudents = withoutStudent
        .filter(s => s.courseId === oldCourseId)
        .map((s, idx) => ({ ...s, listNumber: idx + 1 }));

      const newCourseStudents = [...withoutStudent.filter(s => s.courseId === newCourseId), updatedStudent]
        .map((s, idx) => ({ ...s, listNumber: idx + 1 }));

      const otherStudents = withoutStudent.filter(
        s => s.courseId !== oldCourseId && s.courseId !== newCourseId
      );

      updated = [...otherStudents, ...oldCourseStudents, ...newCourseStudents];
    } else {
      updated = students.map(s => (s.id === updatedStudent.id ? updatedStudent : s));
    }
    setStudents(updated);
    saveStudents(updated);

    pushUndo(`la modificación del estudiante ${prevStudent?.lastName || updatedStudent.lastName}, ${prevStudent?.firstName || updatedStudent.firstName}`, () => {
      setStudents(prevStudents);
      saveStudents(prevStudents);
    });
  };

  const handleDeleteStudent = (studentId: string) => {
    const targetStudent = students.find(s => s.id === studentId);
    const prevStudents = [...students];
    const prevAttendance = { ...attendance };

    const remaining = students.filter(s => s.id !== studentId);
    let updatedStudents = remaining;
    if (targetStudent) {
      const courseId = targetStudent.courseId;
      const renumberedCourseStudents = remaining
        .filter(s => s.courseId === courseId)
        .map((s, idx) => ({ ...s, listNumber: idx + 1 }));

      const otherCourseStudents = remaining.filter(s => s.courseId !== courseId);
      updatedStudents = [...otherCourseStudents, ...renumberedCourseStudents];
    }

    setStudents(updatedStudents);
    saveStudents(updatedStudents);

    let changed = false;
    const nextMap: AttendanceRecordMap = {};
    Object.entries(attendance).forEach(([key, dayRecord]) => {
      if (dayRecord[studentId]) {
        changed = true;
        const { [studentId]: _, ...rest } = dayRecord;
        nextMap[key] = rest;
      } else {
        nextMap[key] = dayRecord;
      }
    });
    if (changed) {
      setAttendance(nextMap);
      saveAttendance(nextMap);
    }

    const studentName = targetStudent ? `${targetStudent.lastName}, ${targetStudent.firstName}` : 'el estudiante';
    pushUndo(`la eliminación de ${studentName}`, () => {
      setStudents(prevStudents);
      saveStudents(prevStudents);
      setAttendance(prevAttendance);
      saveAttendance(prevAttendance);
    });
  };

  const handleReorderStudents = (courseId: string, reorderedCourseStudents: Student[]) => {
    const prevStudents = [...students];
    const normalized = reorderedCourseStudents.map((st, idx) => ({
      ...st,
      listNumber: idx + 1,
    }));

    const otherStudents = students.filter(s => s.courseId !== courseId);
    const updated = [...otherStudents, ...normalized];
    setStudents(updated);
    saveStudents(updated);

    pushUndo(`el reordenamiento de la nómina de estudiantes`, () => {
      setStudents(prevStudents);
      saveStudents(prevStudents);
    });
  };

  const handleBulkAddStudents = (
    courseId: string,
    newStudentsData: { lastName: string; firstName: string; dni?: string; listNumber?: number; genero?: StudentGender }[]
  ) => {
    const prevStudents = [...students];
    const existingCourseStudents = students.filter(s => s.courseId === courseId);
    const startIndex = existingCourseStudents.length;

    const createdStudents: Student[] = newStudentsData.map((d, index) => ({
      id: `st-${Date.now()}-${index}`,
      courseId,
      lastName: d.lastName,
      firstName: d.firstName,
      dni: d.dni,
      genero: d.genero || 'indefinido',
      listNumber: startIndex + index + 1,
      active: true,
    }));

    const otherStudents = students.filter(s => s.courseId !== courseId);
    const filterByGender = getFilterByGender();
    const allCourseStudents = sortAndIndexStudents(
      [...existingCourseStudents, ...createdStudents],
      filterByGender
    );

    const updated = [...otherStudents, ...allCourseStudents];
    setStudents(updated);
    saveStudents(updated);

    pushUndo(`la importación de ${newStudentsData.length} estudiantes`, () => {
      setStudents(prevStudents);
      saveStudents(prevStudents);
    });
  };

  // Attendance Updates
  const handleUpdateAttendance = (
    courseId: string,
    date: string,
    studentId: string,
    status: AttendanceStatus,
    observation?: string,
    isDiscipline?: boolean
  ) => {
    const key = `${courseId}_${date}`;
    const targetStudent = students.find(s => s.id === studentId);
    const studentName = targetStudent ? `${targetStudent.lastName}, ${targetStudent.firstName}` : 'el alumno';

    const currentDay = attendance[key] || {};
    const prevEntry = currentDay[studentId];

    const updatedDay = {
      ...currentDay,
      [studentId]: {
        ...(prevEntry || { status: null }),
        status,
        observation: observation !== undefined ? observation : prevEntry?.observation,
        isDiscipline: isDiscipline !== undefined ? isDiscipline : prevEntry?.isDiscipline,
        updatedAt: new Date().toISOString(),
      },
    };

    const updatedMap = {
      ...attendance,
      [key]: updatedDay,
    };

    setAttendance(updatedMap);
    saveAttendance(updatedMap);

    // Push Undo Action
    const statusText = status === 'P' ? 'Presente' : status === 'A' ? 'Ausente' : status === 'T' ? 'Tardanza' : status === 'J' ? 'Justificada' : 'Sin registrar';
    pushUndo(`el registro de asistencia de ${studentName} (${statusText})`, () => {
      setAttendance(prevMap => {
        const day = prevMap[key] || {};
        let nextDay;
        if (!prevEntry) {
          const { [studentId]: _, ...rest } = day;
          nextDay = rest;
        } else {
          nextDay = { ...day, [studentId]: prevEntry };
        }
        const restoredMap = { ...prevMap, [key]: nextDay };
        saveAttendance(restoredMap);
        return restoredMap;
      });
    });
  };

  const handleBatchUpdateAttendance = (
    courseId: string,
    date: string,
    updates: Record<string, AttendanceStatus>
  ) => {
    const key = `${courseId}_${date}`;
    const prevDay = attendance[key] ? { ...attendance[key] } : {};

    const currentDay = { ...(attendance[key] || {}) };
    Object.entries(updates).forEach(([studentId, status]) => {
      currentDay[studentId] = {
        ...(currentDay[studentId] || {}),
        status,
        updatedAt: new Date().toISOString(),
      };
    });

    const updatedMap = {
      ...attendance,
      [key]: currentDay,
    };

    setAttendance(updatedMap);
    saveAttendance(updatedMap);

    // Determine descriptive batch text
    const statusValues = Object.values(updates);
    let batchDesc = 'el cambio masivo de asistencia';
    if (statusValues.length > 0 && statusValues.every(s => s === 'P')) {
      batchDesc = 'el marcado de todos como Presentes';
    } else if (statusValues.length > 0 && statusValues.every(s => s === 'A')) {
      batchDesc = 'el marcado de todos como Ausentes';
    } else if (statusValues.length > 0 && statusValues.every(s => s === null)) {
      batchDesc = 'el reinicio de asistencia del día';
    }

    pushUndo(batchDesc, () => {
      setAttendance(prevMap => {
        const restoredMap = { ...prevMap, [key]: prevDay };
        saveAttendance(restoredMap);
        return restoredMap;
      });
    });
  };

  const handleUpdateConfig = (newConfig: SchoolConfig) => {
    setConfig(newConfig);
    saveConfig(newConfig);
  };

  // Navigation and selection handlers with automatic security lock
  const handleTabChange = (newTab: NavTab) => {
    if (newTab !== currentTab) {
      setIsAttendanceLocked(true);
    }
    setCurrentTab(newTab);
  };

  const handleSelectCourse = (courseId: string) => {
    if (courseId !== selectedCourseId) {
      setIsAttendanceLocked(true);
    }
    setSelectedCourseId(courseId);
    saveSelectedCourseId(courseId);
  };

  const handleDateChange = (date: string) => {
    if (date !== currentDate) {
      setIsAttendanceLocked(true);
    }
    setCurrentDate(date);
  };

  const institutionName = config.nombreInstitucion || config.institutionName || 'Escuela / Instituto';

  return (
    <CourseProvider
      courses={courses}
      selectedCourseId={selectedCourseId}
      onSelectCourse={handleSelectCourse}
    >
      <div className="min-h-screen bg-slate-100 dark:bg-[#0e1014] text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black transition-colors">
        {/* App Splash Screen on Launch */}
        <SplashScreen duration={1800} institutionName={institutionName} />

        {/* Top Institutional Header with Undo button & Dark/Light mode toggle */}
        <Header
          onOpenSettings={() => handleTabChange('settings')}
          theme={theme}
          onToggleTheme={toggleTheme}
          canUndo={undoStack.length > 0}
          onUndoClick={() => {
            if (undoStack.length > 0) {
              setIsUndoConfirmModalOpen(true);
            }
          }}
          lastUndoDescription={undoStack[0]?.description}
          institutionName={institutionName}
        />

        {/* Floating Undo Success Toast Alert */}
        {undoToastMessage && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-full font-bold text-xs shadow-2xl flex items-center gap-2 animate-bounce border border-emerald-500/40">
            <CheckCircle2 className="w-4 h-4 text-emerald-200 stroke-[2.5]" />
            <span>{undoToastMessage}</span>
          </div>
        )}

        {/* Offline Toast Banner per PWA skill guidelines */}
        {!isOnline && (
          <div className="bg-amber-500 text-slate-950 px-4 py-1 text-center text-xs font-bold tracking-wide flex items-center justify-center gap-1.5 shadow-md">
            <span className="w-2 h-2 rounded-full bg-slate-950 animate-pulse" />
            <span>Modo Offline Activo — Todos los registros se guardan localmente en tu dispositivo.</span>
          </div>
        )}

        {/* Main View Router */}
        <main className="flex-1 overflow-y-auto">
          {currentTab === 'attendance' && (
            <AttendanceView
              courses={courses}
              selectedCourseId={selectedCourseId}
              onSelectCourse={handleSelectCourse}
              students={students}
              attendanceMap={attendance}
              onUpdateAttendance={handleUpdateAttendance}
              onBatchUpdateAttendance={handleBatchUpdateAttendance}
              currentDate={currentDate}
              onChangeDate={handleDateChange}
              defaultWhatsAppPhone={config.defaultWhatsAppPhone}
              institutionName={institutionName}
              isLocked={isAttendanceLocked}
              onToggleLock={() => setIsAttendanceLocked(prev => !prev)}
              onSetLocked={setIsAttendanceLocked}
            />
          )}

          {currentTab === 'history' && (
            <HistoryAndReports
              courses={courses}
              students={students}
              attendanceMap={attendance}
              selectedCourseId={selectedCourseId}
              onSelectCourse={handleSelectCourse}
              onUpdateAttendance={handleUpdateAttendance}
              config={config}
            />
          )}

          {currentTab === 'courses' && (
            <CoursesManagement
              courses={courses}
              students={students}
              selectedCourseId={selectedCourseId}
              onSelectCourse={handleSelectCourse}
              onAddCourse={handleAddCourse}
              onUpdateCourse={handleUpdateCourse}
              onDeleteCourse={handleDeleteCourse}
              onClearCourseStudents={handleClearCourseStudents}
              onAddStudent={handleAddStudent}
              onUpdateStudent={handleUpdateStudent}
              onDeleteStudent={handleDeleteStudent}
              onBulkAddStudents={handleBulkAddStudents}
              onReorderStudents={handleReorderStudents}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              config={config}
              onUpdateConfig={handleUpdateConfig}
              onRestoreData={reloadFromStorage}
              courses={courses}
              students={students}
              attendanceMap={attendance}
              theme={theme}
              onToggleTheme={toggleTheme}
            />
          )}
        </main>

        {/* Bottom Mobile Navigation Bar */}
        <BottomNav currentTab={currentTab} onChangeTab={handleTabChange} />

        {/* Global Undo Confirmation Dialog Modal */}
        <ConfirmModal
          isOpen={isUndoConfirmModalOpen}
          title="¿Deshacer última acción?"
          message={
            undoStack.length > 0 ? (
              <span>
                Se revertirá{' '}
                <strong className="text-amber-600 dark:text-amber-400 font-bold">
                  {undoStack[0].description}
                </strong>
                . ¿Deseas continuar?
              </span>
            ) : (
              '¿Deseas revertir la última acción realizada?'
            )
          }
          confirmText="Confirmar / Deshacer"
          cancelText="Cancelar"
          variant="undo"
          iconType="undo"
          onConfirm={handleConfirmUndo}
          onClose={() => setIsUndoConfirmModalOpen(false)}
        />
      </div>
    </CourseProvider>
  );
}
