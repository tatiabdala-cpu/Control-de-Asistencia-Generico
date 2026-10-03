import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Plus,
  Users,
  Upload,
  Trash2,
  Edit2,
  X,
  ArrowUpDown,
  BookOpen,
  UserPlus,
  AlertCircle,
  Check,
  MoreVertical,
  UserMinus,
  Settings,
  ChevronUp,
  ChevronDown,
  GripVertical,
} from 'lucide-react';
import { Course, Student, StudentGender } from '../types';
import { ConfirmModal } from './ConfirmModal';
import {
  sortAndIndexStudents,
  getFilterByGender,
  setFilterByGender,
  normalizeStudentGender,
  getGroupIndexRanges,
  compareStudentsByName,
  compareStudentsWithinGroup,
  groupStudentsByGender,
  unifyStudentsAlphabetically,
} from '../utils/studentSorting';

interface CoursesManagementProps {
  courses: Course[];
  students: Student[];
  selectedCourseId?: string;
  onSelectCourse?: (courseId: string) => void;
  onAddCourse: (course: Omit<Course, 'id' | 'createdAt'>) => void;
  onUpdateCourse: (course: Course) => void;
  onDeleteCourse: (courseId: string) => void;
  onClearCourseStudents?: (courseId: string) => void;
  onAddStudent: (student: Omit<Student, 'id'>) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (studentId: string) => void;
  onBulkAddStudents: (courseId: string, newStudents: { lastName: string; firstName: string; dni?: string; listNumber?: number; genero?: StudentGender }[]) => void;
  onReorderStudents?: (courseId: string, reorderedStudents: Student[]) => void;
}

export const CoursesManagement: React.FC<CoursesManagementProps> = ({
  courses,
  students,
  selectedCourseId: controlledSelectedCourseId,
  onSelectCourse: controlledOnSelectCourse,
  onAddCourse,
  onUpdateCourse,
  onDeleteCourse,
  onClearCourseStudents,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onBulkAddStudents,
  onReorderStudents,
}) => {
  const [internalSelectedCourseId, setInternalSelectedCourseId] = useState<string>(courses[0]?.id || '');
  const selectedCourseId = controlledSelectedCourseId !== undefined ? controlledSelectedCourseId : internalSelectedCourseId;
  const setSelectedCourseId = (id: string) => {
    if (controlledOnSelectCourse) controlledOnSelectCourse(id);
    setInternalSelectedCourseId(id);
  };

  const [isAddCourseModalOpen, setIsAddCourseModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isSingleStudentModalOpen, setIsSingleStudentModalOpen] = useState(false);
  const [isCourseMenuOpen, setIsCourseMenuOpen] = useState(false);

  // Edit Course Modal state
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editCourseName, setEditCourseName] = useState('');
  const [editCourseShift, setEditCourseShift] = useState<'Mañana' | 'Tarde' | 'Vespertino'>('Mañana');
  const [editCoursePreceptor, setEditCoursePreceptor] = useState('');
  const [editCourseYear, setEditCourseYear] = useState('2026');

  // Edit Student Modal state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editLastName, setEditLastName] = useState('');
  const [editFirstName, setEditFirstName] = useState('');
  const [editDni, setEditDni] = useState('');
  const [editCourseId, setEditCourseId] = useState('');

  // Drag & Drop / Reordering State
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchFromIdxRef = useRef<number | null>(null);

  // Confirmation Dialog Modal state (Replaces window.confirm)
  const [confirmModalData, setConfirmModalData] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    variant?: 'danger' | 'warning';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // New Course Form state
  const [courseName, setCourseName] = useState('');
  const [courseShift, setCourseShift] = useState<'Mañana' | 'Tarde' | 'Vespertino'>('Mañana');
  const [coursePreceptor, setCoursePreceptor] = useState('');
  const [courseYear, setCourseYear] = useState('2026');

  // Single Student Form state
  const [studentLastName, setStudentLastName] = useState('');
  const [studentFirstName, setStudentFirstName] = useState('');
  const [studentDni, setStudentDni] = useState('');
  const [studentGender, setStudentGender] = useState<StudentGender>('indefinido');

  // Edit Student Form state
  const [editGender, setEditGender] = useState<StudentGender>('indefinido');

  // Bulk Import state
  const [bulkText, setBulkText] = useState('');
  const [bulkBatchGender, setBulkBatchGender] = useState<StudentGender>('indefinido');
  const [bulkPreview, setBulkPreview] = useState<{
    lastName: string;
    firstName: string;
    dni?: string;
    listNumber?: number;
    genero: StudentGender;
  }[]>([]);

  // Filter by gender state (defaults to true)
  const [filtrarPorGenero, setFiltrarPorGenero] = useState<boolean>(() => getFilterByGender());

  const toggleFiltrarPorGenero = () => {
    const nextVal = !filtrarPorGenero;
    setFiltrarPorGenero(nextVal);
    setFilterByGender(nextVal);

    if (!selectedCourse) return;

    let reindexed: Student[] = [];
    if (nextVal) {
      // Switching to TRUE: group 1º Varones, 2º Mujeres, 3º Indefinidos
      reindexed = groupStudentsByGender(rawCourseStudents);
    } else {
      // Switching to FALSE: unify all students alphabetically by Apellido, Nombre
      reindexed = unifyStudentsAlphabetically(rawCourseStudents);
    }

    if (onReorderStudents) {
      onReorderStudents(selectedCourse.id, reindexed);
    } else {
      reindexed.forEach(st => onUpdateStudent(st));
    }
  };

  const selectedCourse = courses.find(c => c.id === selectedCourseId) || courses[0];

  const rawCourseStudents = useMemo(() => {
    return students.filter(s => s.courseId === selectedCourse?.id && s.active);
  }, [students, selectedCourse?.id]);

  const courseStudents = useMemo(() => {
    return sortAndIndexStudents(rawCourseStudents, filtrarPorGenero);
  }, [rawCourseStudents, filtrarPorGenero]);

  const groupRanges = useMemo(() => {
    return getGroupIndexRanges(courseStudents, filtrarPorGenero);
  }, [courseStudents, filtrarPorGenero]);

  // Reorder student position and reassign dynamic correlative list numbers (1, 2, 3...)
  const handleMoveStudent = (fromIndex: number, toIndex: number) => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= courseStudents.length ||
      toIndex >= courseStudents.length ||
      !selectedCourse
    ) {
      return;
    }

    const stToMove = courseStudents[fromIndex];
    if (!stToMove) return;

    if (filtrarPorGenero) {
      const g = normalizeStudentGender(stToMove.genero);
      const range = groupRanges[g];
      // Restrict move to within the active group
      if (toIndex < range.start || toIndex > range.end) {
        return;
      }
    }

    const updated = [...courseStudents];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);

    // Reassign strictly correlative numbers: 1, 2, 3...
    const reindexed = updated.map((st, i) => ({
      ...st,
      listNumber: i + 1,
    }));

    if (onReorderStudents) {
      onReorderStudents(selectedCourse.id, reindexed);
    } else {
      reindexed.forEach(st => onUpdateStudent(st));
    }
  };

  // HTML5 Drag and Drop Handlers (Desktop Mouse)
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx !== null && filtrarPorGenero) {
      const sourceStudent = courseStudents[draggedIdx];
      if (sourceStudent) {
        const g = normalizeStudentGender(sourceStudent.genero);
        const range = groupRanges[g];
        if (index < range.start || index > range.end) {
          e.dataTransfer.dropEffect = 'none';
          return;
        }
      }
    }
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = draggedIdx !== null ? draggedIdx : Number(e.dataTransfer.getData('text/plain'));
    if (!isNaN(sourceIndex) && sourceIndex !== targetIndex) {
      handleMoveStudent(sourceIndex, targetIndex);
    }
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  // Touch Drag Handlers (Mobile Touch)
  const handleTouchStart = (index: number, e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
    touchFromIdxRef.current = index;
    setDraggedIdx(index);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchFromIdxRef.current === null) return;
    if (e.cancelable) {
      e.preventDefault();
    }
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!element) return;
    const studentCard = element.closest('[data-student-idx]');
    if (studentCard) {
      const targetIdx = Number(studentCard.getAttribute('data-student-idx'));
      if (!isNaN(targetIdx) && targetIdx !== dragOverIdx) {
        if (filtrarPorGenero && touchFromIdxRef.current !== null) {
          const sourceStudent = courseStudents[touchFromIdxRef.current];
          if (sourceStudent) {
            const g = normalizeStudentGender(sourceStudent.genero);
            const range = groupRanges[g];
            if (targetIdx < range.start || targetIdx > range.end) {
              return;
            }
          }
        }
        setDragOverIdx(targetIdx);
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchFromIdxRef.current !== null && dragOverIdx !== null && touchFromIdxRef.current !== dragOverIdx) {
      handleMoveStudent(touchFromIdxRef.current, dragOverIdx);
    }
    touchStartYRef.current = null;
    touchFromIdxRef.current = null;
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  // Handle batch gender selection change for bulk import
  const handleBatchGenderChange = (newGender: StudentGender) => {
    setBulkBatchGender(newGender);
    if (bulkText.trim()) {
      parseBulkText(bulkText, newGender);
    } else {
      setBulkPreview(prev => prev.map(item => ({ ...item, genero: newGender })));
    }
  };

  // Intelligent text parser: Extracts list number, clean DNI (numbers only, stripping dots/spaces/prefix), and clean name
  const parseBulkText = (text: string, currentGender?: StudentGender) => {
    const genderToApply = currentGender !== undefined ? currentGender : bulkBatchGender;
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const parsed: {
      lastName: string;
      firstName: string;
      dni?: string;
      listNumber?: number;
      genero: StudentGender;
    }[] = [];

    lines.forEach((rawLine, index) => {
      // a) Limpiar numeraciones iniciales de lista (ej: "1. ", "01 - ", "1) ", "1: ", "1\t ")
      let line = rawLine.replace(/^\s*\d+[\.\-\)\:\t\s]+\s*/, '').trim();
      if (!line) return;

      let extractedDni: string | undefined = undefined;
      let cleanedFullName = line;

      // Check if line contains tab or semicolon characters (e.g. copied from Excel columns or CSV file)
      if (line.includes('\t') || line.includes(';')) {
        const delimiter = line.includes('\t') ? '\t' : ';';
        const parts = line.split(delimiter).map(p => p.trim()).filter(Boolean);
        // Find if one of the parts is a DNI
        let dniColIdx = -1;
        for (let i = 0; i < parts.length; i++) {
          const col = parts[i];
          const candidate = col.replace(/^(?:D\.?N\.?I\.?\:?\s*)/i, '').replace(/[\.\s\-]/g, '');
          if (/^\d{6,9}$/.test(candidate)) {
            extractedDni = candidate;
            dniColIdx = i;
            break;
          }
        }

        if (dniColIdx !== -1) {
          parts.splice(dniColIdx, 1);
        }

        if (parts.length >= 2) {
          parsed.push({
            listNumber: index + 1,
            lastName: parts[0],
            firstName: parts.slice(1).join(' '),
            dni: extractedDni,
            genero: genderToApply,
          });
          return;
        } else if (parts.length === 1) {
          cleanedFullName = parts[0];
        }
      }

      // b & c) Extraer el DNI buscando cualquiera de los siguientes patrones:
      // - Prefijos: "DNI:", "DNI", "D.N.I.", "D.N.I.:" seguido de números (con o sin puntos)
      // - Secuencias numéricas de 6 a 9 dígitos (ej: 12.345.678 o 12345678)
      if (!extractedDni) {
        // Pattern 1: DNI at end of line (with or without prefix DNI, with or without dots)
        const endDniPattern = /(?:[\s\-,\–\/\|\(\[]+)?(?:\b(?:D\.?N\.?I\.?\:?)\s*)?(\d{1,2}(?:\.\d{3}){2}|\d{6,9})\b[\)\]]?\s*$/i;
        const match = cleanedFullName.match(endDniPattern);

        if (match && match[1]) {
          const cleanDigits = match[1].replace(/\D/g, '');
          if (cleanDigits.length >= 6 && cleanDigits.length <= 9) {
            extractedDni = cleanDigits;
            cleanedFullName = cleanedFullName.slice(0, match.index).replace(/[\s\-,\–\/\|\(\[]+$/, '').trim();
          }
        } else {
          // Pattern 2: DNI with explicit prefix anywhere in the line: e.g. "DNI: 42.123.456"
          const explicitPattern = /\b(?:D\.?N\.?I\.?\:?\s*)(\d{1,2}(?:\.\d{3}){2}|\d{6,9})\b/i;
          const expMatch = cleanedFullName.match(explicitPattern);
          if (expMatch && expMatch[1]) {
            const cleanDigits = expMatch[1].replace(/\D/g, '');
            if (cleanDigits.length >= 6 && cleanDigits.length <= 9) {
              extractedDni = cleanDigits;
              cleanedFullName = (
                cleanedFullName.slice(0, expMatch.index) +
                ' ' +
                cleanedFullName.slice(expMatch.index! + expMatch[0].length)
              )
                .replace(/[\s\-,\–\/\|\(\)]+/g, ' ')
                .trim();
            }
          }
        }
      }

      // Clean remaining punctuation from the full name
      cleanedFullName = cleanedFullName.replace(/^[\s\-,\–]+|[\s\-,\–]+$/g, '').trim();
      if (!cleanedFullName) return;

      // Split into lastName and firstName
      let lastName = '';
      let firstName = '';

      if (cleanedFullName.includes(',')) {
        const commaParts = cleanedFullName.split(',');
        lastName = commaParts[0].trim();
        firstName = commaParts.slice(1).join(',').trim();
      } else {
        const words = cleanedFullName.split(/\s+/).filter(Boolean);
        if (words.length >= 2) {
          if (words.length === 2) {
            lastName = words[0];
            firstName = words[1];
          } else {
            // e.g. "García Pereyra Thiago" -> lastName: "García Pereyra", firstName: "Thiago"
            lastName = words.slice(0, -1).join(' ');
            firstName = words[words.length - 1];
          }
        } else if (words.length === 1) {
          lastName = words[0];
          firstName = '';
        }
      }

      parsed.push({
        listNumber: index + 1,
        lastName: lastName || cleanedFullName,
        firstName: firstName,
        dni: extractedDni,
        genero: genderToApply,
      });
    });

    setBulkPreview(parsed);
  };

  // Helper to process Excel spreadsheets (.xlsx, .xls)
  const processExcelWorkbook = (
    workbook: XLSX.WorkBook,
    defaultGender: StudentGender
  ): {
    students: {
      lastName: string;
      firstName: string;
      dni?: string;
      listNumber?: number;
      genero: StudentGender;
    }[];
    textRepresentation: string;
  } => {
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return { students: [], textRepresentation: '' };

    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as unknown[][];

    // Helper to clean DNI: keeps only digits (6 to 9 digits), stripping points, spaces, and prefixes
    const cleanDni = (val: unknown): string | undefined => {
      if (val === null || val === undefined) return undefined;
      const str = String(val).trim();
      if (!str) return undefined;
      const digits = str.replace(/\D/g, '');
      if (digits.length >= 6 && digits.length <= 9) {
        return digits;
      }
      return undefined;
    };

    // Filter out rows where all cells are empty
    const rows = rawRows.filter(
      row => Array.isArray(row) && row.some(cell => String(cell ?? '').trim().length > 0)
    );

    if (rows.length === 0) return { students: [], textRepresentation: '' };

    // Inspect header row candidates in the first few rows
    let headerRowIdx = -1;
    let dniColIdx = -1;
    let lastNameColIdx = -1;
    let firstNameColIdx = -1;
    let fullNameColIdx = -1;
    let listNumColIdx = -1;
    let genderColIdx = -1;

    for (let r = 0; r < Math.min(5, rows.length); r++) {
      const rowStr = rows[r].map(c => String(c ?? '').toLowerCase().trim());
      const hasDni = rowStr.some(c => /\b(dni|documento|doc\.?|nro\.?\s*doc|identidad)\b/i.test(c));
      const hasName = rowStr.some(c => /\b(apellido|nombre|alumno|estudiante)\b/i.test(c));
      if (hasDni || hasName) {
        headerRowIdx = r;
        rowStr.forEach((cellText, colIdx) => {
          if (/\b(dni|documento|doc\.?|nro\.?\s*doc|identidad)\b/i.test(cellText)) {
            dniColIdx = colIdx;
          } else if (/\bapellido\s*y\s*nombre\b|\bnombre\s*y\s*apellido\b|\balumno\b|\bestudiante\b/i.test(cellText)) {
            fullNameColIdx = colIdx;
          } else if (/\bapellido(s)?\b/i.test(cellText)) {
            lastNameColIdx = colIdx;
          } else if (/\bnombre(s)?\b/i.test(cellText)) {
            firstNameColIdx = colIdx;
          } else if (/^(n°|nro|nro\.|#|orden|pos|lista|item)$/i.test(cellText)) {
            listNumColIdx = colIdx;
          } else if (/\b(sexo|género|genero)\b/i.test(cellText)) {
            genderColIdx = colIdx;
          }
        });
        break;
      }
    }

    const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;
    const parsedStudents: {
      lastName: string;
      firstName: string;
      dni?: string;
      listNumber?: number;
      genero: StudentGender;
    }[] = [];

    for (let r = startRow; r < rows.length; r++) {
      const row = rows[r];
      if (!row.some(c => String(c ?? '').trim().length > 0)) continue;

      let extractedDni: string | undefined = undefined;
      let foundDniCol = -1;

      // 1. Extraer y limpiar DNI
      if (dniColIdx !== -1 && row[dniColIdx] !== undefined) {
        extractedDni = cleanDni(row[dniColIdx]);
        if (extractedDni) {
          foundDniCol = dniColIdx;
        }
      }

      // Si no se encontró en la columna de DNI, buscar prefijo explícito en cualquier celda
      if (!extractedDni) {
        for (let c = 0; c < row.length; c++) {
          const cellStr = String(row[c] ?? '').trim();
          const match = cellStr.match(/\b(?:D\.?N\.?I\.?\:?\s*)(\d{1,2}(?:\.\d{3}){2}|\d{6,9})\b/i);
          if (match && match[1]) {
            const digits = match[1].replace(/\D/g, '');
            if (digits.length >= 6 && digits.length <= 9) {
              extractedDni = digits;
              foundDniCol = c;
              break;
            }
          }
        }
      }

      // Si aún no se encontró, buscar cualquier celda numérica o de 6 a 9 dígitos
      if (!extractedDni) {
        for (let c = 0; c < row.length; c++) {
          if (c === listNumColIdx) continue;
          const candidate = cleanDni(row[c]);
          if (candidate) {
            const numVal = Number(candidate);
            // Ignorar números pequeños de primera columna (ej: número de orden 1, 2, 3)
            if (c === 0 && candidate.length <= 3 && numVal < 200) {
              continue;
            }
            extractedDni = candidate;
            foundDniCol = c;
            break;
          }
        }
      }

      // 2. Extraer Nombre y Apellido
      let lastName = '';
      let firstName = '';

      if (lastNameColIdx !== -1 && firstNameColIdx !== -1) {
        lastName = String(row[lastNameColIdx] ?? '').trim();
        firstName = String(row[firstNameColIdx] ?? '').trim();
      } else if (fullNameColIdx !== -1) {
        const rawFullName = String(row[fullNameColIdx] ?? '').trim();
        const cleaned = rawFullName
          .replace(/\b(?:D\.?N\.?I\.?\:?\s*)?(\d{1,2}(?:\.\d{3}){2}|\d{6,9})\b/gi, '')
          .replace(/^[\s\-,\–\:\/\|\(\[]+|[\s\-,\–\:\/\|\)\]]+$/g, '')
          .trim();

        if (cleaned.includes(',')) {
          const parts = cleaned.split(',');
          lastName = parts[0].trim();
          firstName = parts.slice(1).join(',').trim();
        } else {
          const words = cleaned.split(/\s+/).filter(Boolean);
          if (words.length >= 2) {
            lastName = words.slice(0, -1).join(' ');
            firstName = words[words.length - 1];
          } else if (words.length === 1) {
            lastName = words[0];
            firstName = '';
          }
        }
      } else {
        // Sin columnas identificadas por encabezado: recolectar celdas de texto
        const textCells: string[] = [];
        row.forEach((cellVal, colIdx) => {
          if (colIdx === dniColIdx || colIdx === foundDniCol) return;
          if (colIdx === listNumColIdx) return;
          if (colIdx === genderColIdx) return;

          const valStr = String(cellVal ?? '').trim();
          if (!valStr) return;

          // Ignorar número de lista en columna 0
          if (colIdx === 0 && /^\d{1,3}$/.test(valStr)) return;

          textCells.push(valStr);
        });

        if (textCells.length >= 2) {
          lastName = textCells[0].trim();
          firstName = textCells.slice(1).join(' ').trim();
        } else if (textCells.length === 1) {
          const cleaned = textCells[0]
            .replace(/\b(?:D\.?N\.?I\.?\:?\s*)?(\d{1,2}(?:\.\d{3}){2}|\d{6,9})\b/gi, '')
            .replace(/^[\s\-,\–\:\/\|\(\[]+|[\s\-,\–\:\/\|\)\]]+$/g, '')
            .trim();

          if (cleaned.includes(',')) {
            const parts = cleaned.split(',');
            lastName = parts[0].trim();
            firstName = parts.slice(1).join(',').trim();
          } else {
            const words = cleaned.split(/\s+/).filter(Boolean);
            if (words.length >= 2) {
              lastName = words.slice(0, -1).join(' ');
              firstName = words[words.length - 1];
            } else if (words.length === 1) {
              lastName = words[0];
              firstName = '';
            }
          }
        }
      }

      // Limpiar puntuación residual
      lastName = lastName.replace(/^[\s\-,\–]+|[\s\-,\–]+$/g, '').trim();
      firstName = firstName.replace(/^[\s\-,\–]+|[\s\-,\–]+$/g, '').trim();

      if (!lastName && !firstName) continue;
      if (!lastName && firstName) {
        lastName = firstName;
        firstName = '';
      }

      // 3. Extraer Número de Lista
      let listNumber = parsedStudents.length + 1;
      if (listNumColIdx !== -1 && row[listNumColIdx] !== undefined) {
        const parsedNum = parseInt(String(row[listNumColIdx]).replace(/\D/g, ''), 10);
        if (!isNaN(parsedNum) && parsedNum > 0) {
          listNumber = parsedNum;
        }
      } else if (row[0] !== undefined) {
        const firstColStr = String(row[0]).trim();
        if (/^\d{1,3}$/.test(firstColStr)) {
          const parsedNum = parseInt(firstColStr, 10);
          if (!isNaN(parsedNum) && parsedNum > 0 && parsedNum < 150) {
            listNumber = parsedNum;
          }
        }
      }

      // 4. Género por fila si está indicado
      let rowGender: StudentGender = defaultGender;
      if (genderColIdx !== -1 && row[genderColIdx] !== undefined) {
        const gStr = String(row[genderColIdx]).toLowerCase().trim();
        if (gStr === 'v' || gStr === 'varon' || gStr === 'varón' || gStr === 'masculino') {
          rowGender = 'V';
        } else if (gStr === 'm' || gStr === 'mujer' || gStr === 'f' || gStr === 'femenino') {
          rowGender = 'M';
        }
      }

      parsedStudents.push({
        listNumber,
        lastName,
        firstName,
        dni: extractedDni,
        genero: rowGender,
      });
    }

    // Generar representación de texto para sincronizar el textarea
    const textRepresentation = parsedStudents
      .map(s => `${s.lastName}${s.firstName ? ', ' + s.firstName : ''}${s.dni ? ' DNI: ' + s.dni : ''}`)
      .join('\n');

    return { students: parsedStudents, textRepresentation };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isExcel =
      fileName.endsWith('.xlsx') ||
      fileName.endsWith('.xls') ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel';

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = event => {
        try {
          const buffer = event.target?.result as ArrayBuffer;
          const workbook = XLSX.read(buffer, { type: 'array' });
          const { students, textRepresentation } = processExcelWorkbook(workbook, bulkBatchGender);
          setBulkText(textRepresentation);
          setBulkPreview(students);
        } catch (err) {
          console.error('Error al procesar archivo Excel:', err);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // Archivos estándar de texto .txt o .csv
      const reader = new FileReader();
      reader.onload = event => {
        const content = event.target?.result as string;
        setBulkText(content);
        parseBulkText(content, bulkBatchGender);
      };
      reader.readAsText(file);
    }

    e.target.value = '';
  };

  const handleSaveBulk = () => {
    if (!selectedCourse || bulkPreview.length === 0) return;
    onBulkAddStudents(selectedCourse.id, bulkPreview);
    setBulkText('');
    setBulkPreview([]);
    setIsBulkModalOpen(false);
  };

  const handleSaveSingleStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse || !studentLastName.trim() || !studentFirstName.trim()) return;

    const newStudentData = {
      courseId: selectedCourse.id,
      lastName: studentLastName.trim(),
      firstName: studentFirstName.trim(),
      dni: studentDni.trim() || undefined,
      genero: studentGender,
      active: true,
    };

    if (filtrarPorGenero) {
      const targetGender = normalizeStudentGender(studentGender);
      const tempNew: Student = {
        ...newStudentData,
        id: `st-${Date.now()}`,
      };

      const otherStudents = rawCourseStudents;
      const varones = otherStudents.filter(s => normalizeStudentGender(s.genero) === 'V').sort(compareStudentsWithinGroup);
      const mujeres = otherStudents.filter(s => normalizeStudentGender(s.genero) === 'M').sort(compareStudentsWithinGroup);
      const indef = otherStudents.filter(s => normalizeStudentGender(s.genero) === 'indefinido').sort(compareStudentsWithinGroup);

      if (targetGender === 'V') {
        varones.push(tempNew);
        varones.sort(compareStudentsByName);
      } else if (targetGender === 'M') {
        mujeres.push(tempNew);
        mujeres.sort(compareStudentsByName);
      } else {
        indef.push(tempNew);
        indef.sort(compareStudentsByName);
      }

      const combined = [...varones, ...mujeres, ...indef].map((st, idx) => ({
        ...st,
        listNumber: idx + 1,
      }));

      onAddStudent(newStudentData);
      if (onReorderStudents) {
        onReorderStudents(selectedCourse.id, combined);
      }
    } else {
      onAddStudent({
        ...newStudentData,
        listNumber: courseStudents.length + 1,
      });
    }

    setStudentLastName('');
    setStudentFirstName('');
    setStudentDni('');
    setStudentGender('indefinido');
    setIsSingleStudentModalOpen(false);
  };

  const openEditStudentModal = (st: Student) => {
    setEditingStudent(st);
    setEditLastName(st.lastName);
    setEditFirstName(st.firstName);
    setEditDni(st.dni || '');
    setEditGender(st.genero || 'indefinido');
    setEditCourseId(st.courseId);
  };

  const handleUpdateStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent || !editLastName.trim() || !editFirstName.trim()) return;

    const oldGenderNorm = normalizeStudentGender(editingStudent.genero);
    const newGenderNorm = normalizeStudentGender(editGender);
    const genderChanged = oldGenderNorm !== newGenderNorm;

    const updatedStudent: Student = {
      ...editingStudent,
      lastName: editLastName.trim(),
      firstName: editFirstName.trim(),
      dni: editDni.trim() || undefined,
      genero: editGender,
      courseId: editCourseId,
    };

    if (genderChanged && editCourseId === selectedCourse?.id && filtrarPorGenero) {
      // Dynamic recalculation: Relocate student to their new gender group section
      const otherStudents = rawCourseStudents.filter(s => s.id !== updatedStudent.id);
      const varones = otherStudents.filter(s => normalizeStudentGender(s.genero) === 'V').sort(compareStudentsWithinGroup);
      const mujeres = otherStudents.filter(s => normalizeStudentGender(s.genero) === 'M').sort(compareStudentsWithinGroup);
      const indef = otherStudents.filter(s => normalizeStudentGender(s.genero) === 'indefinido').sort(compareStudentsWithinGroup);

      if (newGenderNorm === 'V') {
        varones.push(updatedStudent);
        varones.sort(compareStudentsByName);
      } else if (newGenderNorm === 'M') {
        mujeres.push(updatedStudent);
        mujeres.sort(compareStudentsByName);
      } else {
        indef.push(updatedStudent);
        indef.sort(compareStudentsByName);
      }

      const combined = [...varones, ...mujeres, ...indef].map((st, idx) => ({
        ...st,
        listNumber: idx + 1,
      }));

      if (onReorderStudents) {
        onReorderStudents(selectedCourse.id, combined);
      } else {
        combined.forEach(st => onUpdateStudent(st));
      }
    } else {
      onUpdateStudent(updatedStudent);
    }

    setEditingStudent(null);
  };

  const openEditCourseModal = (c: Course) => {
    setEditingCourse(c);
    setEditCourseName(c.name);
    setEditCourseShift(c.shift || 'Mañana');
    setEditCoursePreceptor(c.preceptor || '');
    setEditCourseYear(c.academicYear || '2026');
  };

  const handleUpdateCourseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse || !editCourseName.trim()) return;

    onUpdateCourse({
      ...editingCourse,
      name: editCourseName.trim(),
      shift: editCourseShift,
      preceptor: editCoursePreceptor.trim() || undefined,
      academicYear: editCourseYear.trim(),
    });

    setEditingCourse(null);
  };

  const handleSaveCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseName.trim()) return;

    onAddCourse({
      name: courseName.trim(),
      shift: courseShift,
      preceptor: coursePreceptor.trim() || undefined,
      academicYear: courseYear.trim() || '2026',
    });

    setCourseName('');
    setCoursePreceptor('');
    setIsAddCourseModalOpen(false);
  };

  const handleSortAlphabetically = () => {
    if (!selectedCourse) return;
    const compareNames = (a: Student, b: Student) => {
      const cmp = a.lastName.localeCompare(b.lastName, 'es', { sensitivity: 'base' });
      if (cmp !== 0) return cmp;
      return a.firstName.localeCompare(b.firstName, 'es', { sensitivity: 'base' });
    };

    let sorted: Student[] = [];
    if (filtrarPorGenero) {
      const varones = rawCourseStudents.filter(s => normalizeStudentGender(s.genero) === 'V').sort(compareNames);
      const mujeres = rawCourseStudents.filter(s => normalizeStudentGender(s.genero) === 'M').sort(compareNames);
      const indef = rawCourseStudents.filter(s => normalizeStudentGender(s.genero) === 'indefinido').sort(compareNames);
      sorted = [...varones, ...mujeres, ...indef];
    } else {
      sorted = [...rawCourseStudents].sort(compareNames);
    }

    const reindexed = sorted.map((st, idx) => ({
      ...st,
      listNumber: idx + 1,
    }));

    if (onReorderStudents) {
      onReorderStudents(selectedCourse.id, reindexed);
    } else {
      reindexed.forEach(st => onUpdateStudent(st));
    }
  };

  // Safe delete with custom React UI modal
  const requestDeleteCourse = (course: Course) => {
    const studentCount = students.filter(s => s.courseId === course.id).length;
    setConfirmModalData({
      isOpen: true,
      title: 'Eliminar Curso',
      message: `¿Estás seguro de que deseas eliminar el curso "${course.name}"?\n\nSe eliminarán de forma permanente los ${studentCount} alumnos asociados a este curso y sus planillas de asistencia.\n\nEsta acción no se puede deshacer.`,
      confirmText: 'Eliminar Curso',
      variant: 'danger',
      onConfirm: () => {
        onDeleteCourse(course.id);
        setConfirmModalData(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  const requestClearCourseRoster = (course: Course) => {
    const studentCount = students.filter(s => s.courseId === course.id).length;
    if (studentCount === 0) return;

    setConfirmModalData({
      isOpen: true,
      title: 'Vaciar Nómina de Alumnos',
      message: `¿Estás seguro de que deseas eliminar TODOS los alumnos del curso "${course.name}"?\n\nSe eliminarán de forma permanente los ${studentCount} estudiantes matriculados en este curso y sus registros de asistencia correspondientes.\n\nEl curso "${course.name}" se conservará en el sistema para que puedas cargar una nueva nómina. Esta acción no se puede deshacer.`,
      confirmText: 'Vaciar Nómina',
      variant: 'danger',
      onConfirm: () => {
        if (onClearCourseStudents) {
          onClearCourseStudents(course.id);
        } else {
          // Fallback: delete each student
          students.filter(s => s.courseId === course.id).forEach(s => onDeleteStudent(s.id));
        }
        setConfirmModalData(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  const requestDeleteStudent = (st: Student) => {
    setConfirmModalData({
      isOpen: true,
      title: 'Eliminar Alumno',
      message: `¿Estás seguro de que deseas eliminar al alumno "${st.lastName}, ${st.firstName}"${st.dni ? ` (DNI: ${st.dni})` : ''}?\n\nEsta acción eliminará sus registros de asistencia y no se puede deshacer.`,
      confirmText: 'Eliminar Alumno',
      variant: 'danger',
      onConfirm: () => {
        onDeleteStudent(st.id);
        setConfirmModalData(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-3.5 pb-24 pt-3 space-y-4">
      {/* Selected Course Student Roster */}
      {selectedCourse ? (
        <div className="bg-white dark:bg-[#151820] border border-slate-200 dark:border-[#262d3a] rounded-2xl p-4 shadow-sm dark:shadow-md space-y-3.5 transition-colors">
          {/* Section Header with action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200 dark:border-[#252c3b] pb-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <select
                value={selectedCourse?.id || ''}
                onChange={e => setSelectedCourseId(e.target.value)}
                className="text-xs font-bold bg-slate-100 dark:bg-[#1c222e] text-slate-900 dark:text-white border border-slate-300 dark:border-[#2d3647] rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {courses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.shift || 'Mañana'})
                  </option>
                ))}
              </select>

              <button
                onClick={e => {
                  e.stopPropagation();
                  setIsAddCourseModalOpen(true);
                }}
                className="flex items-center gap-1 text-xs bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold px-2.5 py-1.5 rounded-xl shadow-xs transition"
                title="Crear Nuevo Curso"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Curso</span>
              </button>

              {/* Course Advanced Actions Menu (3 dots) */}
              <div className="relative">
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setIsCourseMenuOpen(!isCourseMenuOpen);
                  }}
                  className={`p-1.5 rounded-xl border transition active:scale-95 flex items-center justify-center ${
                    isCourseMenuOpen
                      ? 'bg-amber-100 border-amber-400 text-amber-900 dark:bg-amber-950/60 dark:border-amber-600 dark:text-amber-300'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#1c222e] dark:hover:bg-[#252f40] border-slate-300 dark:border-[#2d3647] text-slate-700 dark:text-slate-300'
                  }`}
                  title="Opciones avanzadas del curso"
                  aria-label="Opciones del curso"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {isCourseMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setIsCourseMenuOpen(false)}
                    />
                    <div
                      className="absolute left-0 sm:left-auto sm:right-0 mt-1.5 w-60 rounded-xl bg-white dark:bg-[#181d26] border border-slate-200 dark:border-[#2d3647] shadow-xl py-1.5 z-30 text-xs animate-in fade-in zoom-in-95 duration-100"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                        Opciones de {selectedCourse.name}
                      </div>

                      {/* 1. Editar Nombre del Curso */}
                      <button
                        onClick={() => {
                          setIsCourseMenuOpen(false);
                          openEditCourseModal(selectedCourse);
                        }}
                        className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-[#202735] text-slate-800 dark:text-slate-200 transition"
                      >
                        <Settings className="w-4 h-4 text-amber-500" />
                        <div>
                          <span className="font-semibold block">Editar Datos del Curso</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                            Nombre, división, turno o preceptor
                          </span>
                        </div>
                      </button>

                      {/* 3. Vaciar Nómina de Alumnos */}
                      <button
                        onClick={() => {
                          setIsCourseMenuOpen(false);
                          requestClearCourseRoster(selectedCourse);
                        }}
                        disabled={courseStudents.length === 0}
                        className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 disabled:opacity-40 disabled:hover:bg-transparent transition"
                      >
                        <UserMinus className="w-4 h-4 text-rose-500" />
                        <div>
                          <span className="font-semibold block">Vaciar Nómina</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                            Eliminar todos los alumnos ({courseStudents.length})
                          </span>
                        </div>
                      </button>

                      <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                      {/* 2. Eliminar Curso Seleccionado */}
                      <button
                        onClick={() => {
                          setIsCourseMenuOpen(false);
                          requestDeleteCourse(selectedCourse);
                        }}
                        className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-rose-100/70 dark:hover:bg-rose-900/30 text-rose-700 dark:text-rose-300 transition font-bold"
                      >
                        <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        <div>
                          <span className="block">Eliminar Curso</span>
                          <span className="text-[10px] font-normal text-rose-600/80 dark:text-rose-400/80 block">
                            Borra el curso y su historial
                          </span>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>

              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                ({courseStudents.length} alumnos)
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Toggle: Filtrar por Género (1º Varones, 2º Mujeres, 3º Indefinidos) vs Lista Unificada */}
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  toggleFiltrarPorGenero();
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition active:scale-95 shadow-xs ${
                  filtrarPorGenero
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-900 dark:text-amber-300 hover:bg-amber-500/25'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#1d232e] dark:text-slate-300 dark:hover:text-white border-slate-200 dark:border-[#2d3647]'
                }`}
                title={
                  filtrarPorGenero
                    ? 'Filtro por género ACTIVO: 1º Varones, 2º Mujeres, 3º Indefinidos. Clic para unificar lista.'
                    : 'Lista unificada alfabética. Clic para agrupar por género.'
                }
              >
                <Users className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>{filtrarPorGenero ? 'Por Género (V/M)' : 'Lista Unificada'}</span>
              </button>

              <button
                onClick={e => {
                  e.stopPropagation();
                  handleSortAlphabetically();
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#1d232e] dark:text-slate-300 dark:hover:text-white border border-slate-200 dark:border-[#2d3647] text-xs font-semibold transition active:scale-95"
                title="Ordenar alfabéticamente y renumerar lista"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Ordenar A-Z</span>
              </button>

              <button
                onClick={e => {
                  e.stopPropagation();
                  setIsBulkModalOpen(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-[#1e2738] dark:hover:bg-[#253247] dark:text-amber-400 border border-amber-300 dark:border-amber-500/30 text-xs font-bold transition active:scale-95 shadow-xs"
                title="Carga masiva desde texto o Excel"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Carga Masiva</span>
              </button>

              <button
                onClick={e => {
                  e.stopPropagation();
                  setIsSingleStudentModalOpen(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-xs font-bold transition active:scale-95 shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>+ Alumno</span>
              </button>
            </div>
          </div>

          {/* Reordering helper & header info */}
          {courseStudents.length > 0 && (
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100/70 dark:bg-[#12161f] px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-[#222938]">
              <span className="flex items-center gap-1">
                <span>Reordenar:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {filtrarPorGenero ? 'Arrastra o usa flechas dentro del grupo' : 'Arrastra o usa flechas en la lista'}
                </span>
                <span className="inline-flex items-center gap-0.5 font-bold text-amber-600 dark:text-amber-400">
                  <ChevronUp className="w-3.5 h-3.5 inline" />
                  <ChevronDown className="w-3.5 h-3.5 inline -ml-1" />
                </span>
              </span>
              <span className="font-bold text-amber-700 dark:text-amber-400">
                {filtrarPorGenero
                  ? `N° 1 a ${courseStudents.length} (V: ${groupRanges.V.count} · M: ${groupRanges.M.count}${groupRanges.indefinido.count > 0 ? ` · Indef: ${groupRanges.indefinido.count}` : ''})`
                  : `N° 1 a ${courseStudents.length} (Lista Unificada)`}
              </span>
            </div>
          )}

          {/* Students table / list */}
          <div className="space-y-1.5">
            {courseStudents.length === 0 ? (
              <div className="py-8 text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#0e1116] rounded-xl border border-slate-200 dark:border-[#212735]">
                <Users className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-800 dark:text-slate-300">Este curso no tiene alumnos cargados aún.</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Usa "Carga Masiva" para pegar la lista de Excel o "+ Alumno" para cargar uno a uno.
                </p>
              </div>
            ) : (
              courseStudents.map((st, idx) => {
                const studentGenderNorm = normalizeStudentGender(st.genero);
                const isAtGroupStart = filtrarPorGenero
                  ? idx === groupRanges[studentGenderNorm].start
                  : idx === 0;
                const isAtGroupEnd = filtrarPorGenero
                  ? idx === groupRanges[studentGenderNorm].end
                  : idx === courseStudents.length - 1;

                return (
                  <React.Fragment key={st.id}>
                    {/* Section Header when filtering by gender is active */}
                    {filtrarPorGenero && idx === groupRanges.V.start && groupRanges.V.count > 0 && (
                      <div className="flex items-center justify-between pt-1 pb-1 px-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-500/20" />
                          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                            1º Varones ({groupRanges.V.count})
                          </span>
                        </div>
                        <span className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">
                          N° {groupRanges.V.start + 1} a {groupRanges.V.end + 1}
                        </span>
                      </div>
                    )}

                    {filtrarPorGenero && idx === groupRanges.M.start && groupRanges.M.count > 0 && (
                      <div className="flex items-center justify-between pt-2.5 pb-1 px-1 border-t border-slate-200/70 dark:border-slate-800/80 mt-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-pink-500 ring-2 ring-pink-500/20" />
                          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                            2º Mujeres ({groupRanges.M.count})
                          </span>
                        </div>
                        <span className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">
                          N° {groupRanges.M.start + 1} a {groupRanges.M.end + 1}
                        </span>
                      </div>
                    )}

                    {filtrarPorGenero && idx === groupRanges.indefinido.start && groupRanges.indefinido.count > 0 && (
                      <div className="flex items-center justify-between pt-2.5 pb-1 px-1 border-t border-slate-200/70 dark:border-slate-800/80 mt-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-400 ring-2 ring-slate-400/20" />
                          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                            3º Sin Especificar / Indefinidos ({groupRanges.indefinido.count})
                          </span>
                        </div>
                        <span className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">
                          N° {groupRanges.indefinido.start + 1} a {groupRanges.indefinido.end + 1}
                        </span>
                      </div>
                    )}

                    <div
                      data-student-idx={idx}
                      draggable
                      onDragStart={e => handleDragStart(e, idx)}
                      onDragOver={e => handleDragOver(e, idx)}
                      onDragLeave={handleDragLeave}
                      onDrop={e => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                        draggedIdx === idx
                          ? 'opacity-40 border-dashed border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 scale-[0.99]'
                          : dragOverIdx === idx
                          ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 ring-2 ring-amber-500/40'
                          : 'bg-slate-50 hover:bg-slate-100 dark:bg-[#191e28] dark:hover:bg-[#1f2533] border-slate-200 dark:border-[#272f3d]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {/* Drag Handle (Desktop & Mobile Touch) */}
                        <div
                          onTouchStart={e => handleTouchStart(idx, e)}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={handleTouchEnd}
                          className="p-1 cursor-grab active:cursor-grabbing text-slate-400 hover:text-amber-600 dark:text-slate-500 dark:hover:text-amber-400 touch-none flex-shrink-0"
                          title={
                            filtrarPorGenero
                              ? 'Arrastrar para reordenar dentro del grupo'
                              : 'Arrastrar para reordenar'
                          }
                          aria-label="Arrastrar para reordenar"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>

                        {/* 100% Dynamic Correlative List Number Badge */}
                        <span className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-400 font-black text-[11px] flex items-center justify-center flex-shrink-0 border border-amber-500/30 shadow-xs">
                          {idx + 1}
                        </span>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              <span className="uppercase text-amber-800 dark:text-amber-300/90">{st.lastName}</span>,{' '}
                              <span className="text-slate-700 dark:text-slate-200">{st.firstName}</span>
                            </p>
                            {/* Gender indicator badge */}
                            {st.genero === 'V' ? (
                              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                                Varón (V)
                              </span>
                            ) : st.genero === 'M' ? (
                              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800/50">
                                Mujer (M)
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                Indef.
                              </span>
                            )}
                          </div>
                          {st.dni && <p className="text-[10px] text-slate-500 dark:text-slate-400">DNI: {st.dni}</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {/* Reorder Buttons (▲ / ▼) */}
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleMoveStudent(idx, idx - 1);
                          }}
                          disabled={isAtGroupStart}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-100/60 dark:text-slate-400 dark:hover:text-amber-400 dark:hover:bg-amber-950/40 disabled:opacity-20 disabled:hover:bg-transparent disabled:cursor-not-allowed transition active:scale-90"
                          title={
                            isAtGroupStart
                              ? filtrarPorGenero
                                ? 'Inicio del grupo'
                                : 'Inicio de lista'
                              : 'Subir posición (▲)'
                          }
                          aria-label="Subir alumno de lugar"
                        >
                          <ChevronUp className="w-4 h-4 stroke-[2.5]" />
                        </button>

                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleMoveStudent(idx, idx + 1);
                          }}
                          disabled={isAtGroupEnd}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-100/60 dark:text-slate-400 dark:hover:text-amber-400 dark:hover:bg-amber-950/40 disabled:opacity-20 disabled:hover:bg-transparent disabled:cursor-not-allowed transition active:scale-90"
                          title={
                            isAtGroupEnd
                              ? filtrarPorGenero
                                ? 'Final del grupo'
                                : 'Final de lista'
                              : 'Bajar posición (▼)'
                          }
                          aria-label="Bajar alumno de lugar"
                        >
                          <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                        </button>

                        <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-1" />

                        {/* Edit Student Button with e.stopPropagation() */}
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            openEditStudentModal(st);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:text-slate-500 dark:hover:text-amber-400 dark:hover:bg-amber-950/40 transition active:scale-90"
                          title="Editar datos del alumno"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Student Button with custom confirm modal and e.stopPropagation() */}
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            requestDeleteStudent(st);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-500 dark:hover:text-rose-400 dark:hover:bg-rose-950/40 transition active:scale-90"
                          title="Eliminar alumno"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-[#151820] rounded-2xl border border-slate-200 dark:border-[#262d3a] p-8">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">No hay cursos creados.</p>
          <button
            onClick={e => {
              e.stopPropagation();
              setIsAddCourseModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition"
          >
            + Crear Nuevo Curso
          </button>
        </div>
      )}

      {/* Modal: Add Course */}
      {isAddCourseModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={e => {
            e.stopPropagation();
            setIsAddCourseModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#151921] border border-slate-200 dark:border-[#2c3444] p-5 shadow-2xl text-slate-900 dark:text-white"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 dark:border-[#252c3b] pb-3">
              <h3 className="text-sm font-bold">Crear Nuevo Curso</h3>
              <button
                onClick={e => {
                  e.stopPropagation();
                  setIsAddCourseModalOpen(false);
                }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCourse} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Nombre del Curso *
                </label>
                <input
                  type="text"
                  placeholder="Ej. 4to A Computación / 2do B Electrónica"
                  value={courseName}
                  onChange={e => setCourseName(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-[#0e1116] border border-slate-300 dark:border-[#252c3b] rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Turno
                  </label>
                  <select
                    value={courseShift}
                    onChange={e => setCourseShift(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-[#0e1116] border border-slate-300 dark:border-[#252c3b] rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Mañana">Mañana</option>
                    <option value="Tarde">Tarde</option>
                    <option value="Vespertino">Vespertino</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Ciclo Lectivo
                  </label>
                  <input
                    type="text"
                    value={courseYear}
                    onChange={e => setCourseYear(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0e1116] border border-slate-300 dark:border-[#252c3b] rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Preceptor / Responsable (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Prof. García"
                  value={coursePreceptor}
                  onChange={e => setCoursePreceptor(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#0e1116] border border-slate-300 dark:border-[#252c3b] rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setIsAddCourseModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow"
                >
                  Crear Curso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Course */}
      {editingCourse && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={e => {
            e.stopPropagation();
            setEditingCourse(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#151921] border border-slate-200 dark:border-[#2c3444] p-5 shadow-2xl text-slate-900 dark:text-white"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 dark:border-[#252c3b] pb-3">
              <h3 className="text-sm font-bold">Editar Datos del Curso</h3>
              <button
                onClick={e => {
                  e.stopPropagation();
                  setEditingCourse(null);
                }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateCourseSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Nombre del Curso *
                </label>
                <input
                  type="text"
                  value={editCourseName}
                  onChange={e => setEditCourseName(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-[#0e1116] border border-slate-300 dark:border-[#252c3b] rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Turno
                  </label>
                  <select
                    value={editCourseShift}
                    onChange={e => setEditCourseShift(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-[#0e1116] border border-slate-300 dark:border-[#252c3b] rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Mañana">Mañana</option>
                    <option value="Tarde">Tarde</option>
                    <option value="Vespertino">Vespertino</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Ciclo Lectivo
                  </label>
                  <input
                    type="text"
                    value={editCourseYear}
                    onChange={e => setEditCourseYear(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0e1116] border border-slate-300 dark:border-[#252c3b] rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Preceptor / Responsable (opcional)
                </label>
                <input
                  type="text"
                  value={editCoursePreceptor}
                  onChange={e => setEditCoursePreceptor(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#0e1116] border border-slate-300 dark:border-[#252c3b] rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setEditingCourse(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Single Student (Add) */}
      {isSingleStudentModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={e => {
            e.stopPropagation();
            setIsSingleStudentModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#151921] border border-slate-200 dark:border-[#2c3444] p-5 shadow-2xl text-slate-900 dark:text-white"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 dark:border-[#252c3b] pb-3">
              <h3 className="text-sm font-bold">Agregar Alumno a {selectedCourse.name}</h3>
              <button
                onClick={e => {
                  e.stopPropagation();
                  setIsSingleStudentModalOpen(false);
                }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSingleStudent} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Apellido *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Álvarez"
                    value={studentLastName}
                    onChange={e => setStudentLastName(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-[#0e1116] border border-slate-300 dark:border-[#252c3b] rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Mateo"
                    value={studentFirstName}
                    onChange={e => setStudentFirstName(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-[#0e1116] border border-slate-300 dark:border-[#252c3b] rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    DNI (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 48.123.456"
                    value={studentDni}
                    onChange={e => setStudentDni(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0e1116] border border-slate-300 dark:border-[#252c3b] rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Género / Sección *
                  </label>
                  <select
                    value={studentGender}
                    onChange={e => setStudentGender(e.target.value as StudentGender)}
                    className="w-full bg-slate-50 dark:bg-[#0e1116] border border-slate-300 dark:border-[#252c3b] rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-medium"
                  >
                    <option value="V">Varón (V)</option>
                    <option value="M">Mujer (M)</option>
                    <option value="indefinido">Sin especificar (Indefinido)</option>
                  </select>
                </div>
              </div>

              {/* Automatic Dynamic Correlative Number Badge */}
              <div className="bg-slate-50 dark:bg-[#0e1116] border border-slate-200 dark:border-[#252c3b] rounded-xl p-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="block font-semibold text-slate-700 dark:text-slate-300">
                    Número de Lista Automático
                  </span>
                  <span className="text-[10.5px] text-slate-500 dark:text-slate-400">
                    Se asigna al final de la nómina (reordenable con ▲/▼ o arrastre)
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 font-black text-xs border border-amber-500/30">
                  N° {courseStudents.length + 1}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setIsSingleStudentModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow"
                >
                  Guardar Alumno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Student */}
      {editingStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={e => {
            e.stopPropagation();
            setEditingStudent(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#151921] border border-slate-200 dark:border-[#2c3444] p-5 shadow-2xl text-slate-900 dark:text-white"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 dark:border-[#252c3b] pb-3">
              <h3 className="text-sm font-bold">Editar Datos de Alumno</h3>
              <button
                onClick={e => {
                  e.stopPropagation();
                  setEditingStudent(null);
                }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateStudentSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Apellido *
                  </label>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={e => setEditLastName(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-[#0e1116] border border-slate-300 dark:border-[#252c3b] rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={e => setEditFirstName(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-[#0e1116] border border-slate-300 dark:border-[#252c3b] rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    DNI (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 48.123.456"
                    value={editDni}
                    onChange={e => setEditDni(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0e1116] border border-slate-300 dark:border-[#252c3b] rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Género / Sección *
                  </label>
                  <select
                    value={editGender}
                    onChange={e => setEditGender(e.target.value as StudentGender)}
                    className="w-full bg-slate-50 dark:bg-[#0e1116] border border-slate-300 dark:border-[#252c3b] rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-medium"
                  >
                    <option value="V">Varón (V)</option>
                    <option value="M">Mujer (M)</option>
                    <option value="indefinido">Sin especificar (Indefinido)</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Correlative List Number Display */}
              <div className="bg-slate-50 dark:bg-[#0e1116] border border-slate-200 dark:border-[#252c3b] rounded-xl p-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="block font-semibold text-slate-700 dark:text-slate-300">
                    Número de Lista (Automático)
                  </span>
                  <span className="text-[10.5px] text-slate-500 dark:text-slate-400">
                    100% correlativo según su orden en la lista (reordenable con ▲/▼ o arrastre)
                  </span>
                </div>
                <span className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 font-black text-xs flex items-center justify-center border border-amber-500/30">
                  {courseStudents.findIndex(s => s.id === editingStudent.id) + 1 || 1}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Curso Asignado
                </label>
                <select
                  value={editCourseId}
                  onChange={e => setEditCourseId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#0e1116] border border-slate-300 dark:border-[#252c3b] rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                >
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.shift || 'Mañana'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    setEditingStudent(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Bulk Import */}
      {isBulkModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
          onClick={e => {
            e.stopPropagation();
            setIsBulkModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#151921] border border-slate-200 dark:border-[#2c3444] shadow-2xl text-slate-900 dark:text-white overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-[#252c3b] flex items-center justify-between bg-slate-50 dark:bg-[#12151b]">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Carga Masiva de Alumnos · {selectedCourse.name}
                </h3>
              </div>
              <button
                onClick={e => {
                  e.stopPropagation();
                  setIsBulkModalOpen(false);
                }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* 1. Selector de Género por Tanda de Carga */}
              <div className="bg-slate-50 dark:bg-[#11141c] p-3.5 rounded-xl border border-slate-200 dark:border-[#232b3b] space-y-2">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Género Predeterminado de la Tanda a Cargar:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleBatchGenderChange('V')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition active:scale-95 ${
                      bulkBatchGender === 'V'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-500/30'
                        : 'bg-white hover:bg-slate-100 text-slate-700 dark:bg-[#1a202c] dark:hover:bg-[#222a3a] dark:text-slate-300 border-slate-300 dark:border-[#2d3748]'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${bulkBatchGender === 'V' ? 'bg-white' : 'bg-blue-500'}`} />
                    <span>Varones (V)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBatchGenderChange('M')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition active:scale-95 ${
                      bulkBatchGender === 'M'
                        ? 'bg-pink-600 text-white border-pink-600 shadow-md ring-2 ring-pink-500/30'
                        : 'bg-white hover:bg-slate-100 text-slate-700 dark:bg-[#1a202c] dark:hover:bg-[#222a3a] dark:text-slate-300 border-slate-300 dark:border-[#2d3748]'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${bulkBatchGender === 'M' ? 'bg-white' : 'bg-pink-500'}`} />
                    <span>Mujeres (M)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBatchGenderChange('indefinido')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition active:scale-95 ${
                      bulkBatchGender === 'indefinido'
                        ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-600 dark:border-slate-600 shadow-md ring-2 ring-slate-500/30'
                        : 'bg-white hover:bg-slate-100 text-slate-700 dark:bg-[#1a202c] dark:hover:bg-[#222a3a] dark:text-slate-300 border-slate-300 dark:border-[#2d3748]'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${bulkBatchGender === 'indefinido' ? 'bg-white' : 'bg-slate-400'}`} />
                    <span>Indefinido</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Todos los alumnos de este bloque se registrarán asignados como{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {bulkBatchGender === 'V'
                      ? 'Varones (V)'
                      : bulkBatchGender === 'M'
                      ? 'Mujeres (M)'
                      : 'Sin especificar (Indefinido)'}
                  </strong>
                  .
                </p>
              </div>

              {/* File upload trigger */}
              <div className="flex items-center justify-between bg-slate-50 dark:bg-[#191e28] p-3 rounded-xl border border-slate-200 dark:border-[#293242]">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">Subir archivo de texto, CSV o Excel</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Archivos .txt, .csv o .xlsx con el listado</p>
                </div>
                <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-400 hover:bg-amber-500/30 border border-amber-400 font-bold text-xs transition">
                  Elegir Archivo
                  <input
                    type="file"
                    accept=".txt,.csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Text Area */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  O pega aquí el texto copiado:
                </label>
                <textarea
                  rows={6}
                  placeholder={`Ejemplos:\nÁlvarez, Mateo DNI: 42.123.456\nBenítez, Sofía 41987654\nCastillo, Lucas\nDi Marco, Valentina - D.N.I. 48.512.901`}
                  value={bulkText}
                  onChange={e => {
                    setBulkText(e.target.value);
                    parseBulkText(e.target.value);
                  }}
                  className="w-full bg-slate-50 dark:bg-[#0a0c0f] border border-slate-300 dark:border-[#252c3b] rounded-xl p-3 font-mono text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Live parsed preview */}
              {bulkPreview.length > 0 && (
                <div>
                  <p className="font-bold text-amber-700 dark:text-amber-400 mb-1.5 flex items-center justify-between">
                    <span>Vista previa ({bulkPreview.length} alumno{bulkPreview.length === 1 ? '' : 's'} detectado{bulkPreview.length === 1 ? '' : 's'}):</span>
                    <span className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">
                      Tanda: <strong className="text-amber-600 dark:text-amber-400 uppercase">{bulkBatchGender === 'V' ? 'Varones' : bulkBatchGender === 'M' ? 'Mujeres' : 'Indefinido'}</strong>
                    </span>
                  </p>
                  <div className="max-h-48 overflow-y-auto bg-slate-50 dark:bg-[#0a0c0f] border border-slate-200 dark:border-[#202633] rounded-xl p-2.5 divide-y divide-slate-200 dark:divide-slate-800 text-[11px]">
                    {bulkPreview.map((item, i) => (
                      <div key={i} className="py-1.5 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-400 font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                            {item.listNumber || i + 1}
                          </span>
                          <span className="text-slate-800 dark:text-slate-200 truncate">
                            <strong className="text-slate-950 dark:text-white uppercase font-bold">{item.lastName}</strong>
                            {item.firstName ? `, ${item.firstName}` : ''}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {item.dni ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-mono font-bold text-[10px] border border-emerald-500/30">
                              DNI: {item.dni}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-slate-400 dark:text-slate-500 text-[10px] italic">
                              Sin DNI
                            </span>
                          )}

                          {item.genero === 'V' ? (
                            <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                              Varón (V)
                            </span>
                          ) : item.genero === 'M' ? (
                            <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800/50">
                              Mujer (M)
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              Indef.
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 bg-slate-50 dark:bg-[#12151b] border-t border-slate-200 dark:border-[#252c3b] flex items-center justify-end gap-2.5">
              <button
                onClick={e => {
                  e.stopPropagation();
                  setIsBulkModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  handleSaveBulk();
                }}
                disabled={bulkPreview.length === 0}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-xs shadow transition"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Incorporar {bulkPreview.length} Alumnos</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom React Confirm Dialog Modal */}
      <ConfirmModal
        isOpen={confirmModalData.isOpen}
        title={confirmModalData.title}
        message={confirmModalData.message}
        confirmText={confirmModalData.confirmText}
        variant={confirmModalData.variant || 'danger'}
        onConfirm={confirmModalData.onConfirm}
        onClose={() => setConfirmModalData(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
