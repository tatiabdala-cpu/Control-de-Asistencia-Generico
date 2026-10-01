import { Student, StudentGender } from '../types';

export const STORAGE_KEY_FILTER_BY_GENDER = 'app_filter_by_gender';
const LEGACY_STORAGE_KEY_FILTER_BY_GENDER = 'huergo_filter_by_gender';

/**
 * Retrieves the filter by gender preference from localStorage.
 * Defaults to true as requested.
 */
export function getFilterByGender(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_FILTER_BY_GENDER) || localStorage.getItem(LEGACY_STORAGE_KEY_FILTER_BY_GENDER);
    if (saved === null) return true;
    return saved === 'true';
  } catch {
    return true;
  }
}

/**
 * Saves the filter by gender preference to localStorage.
 */
export function setFilterByGender(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_FILTER_BY_GENDER, String(value));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Normalizes a student's gender: 'V', 'M', or 'indefinido'.
 */
export function normalizeStudentGender(gender?: string | null): StudentGender {
  if (!gender) return 'indefinido';
  const g = gender.trim().toUpperCase();
  if (g === 'V' || g === 'VARON' || g === 'VARÓN' || g === 'MASCULINO' || g === 'HOMBRE') {
    return 'V';
  }
  if (g === 'M' || g === 'MUJER' || g === 'FEMENINO' || g === 'F') {
    return 'M';
  }
  return 'indefinido';
}

/**
 * Formats a student's gender for ministerial reporting: 'V', 'M', or 'X'.
 */
export function formatGenderReport(gender?: string | null): 'V' | 'M' | 'X' {
  const normalized = normalizeStudentGender(gender);
  if (normalized === 'V') return 'V';
  if (normalized === 'M') return 'M';
  return 'X';
}

/**
 * Compares two students alphabetically by lastName, then firstName.
 */
export function compareStudentsByName(a: Student, b: Student): number {
  const cmpLast = a.lastName.localeCompare(b.lastName, 'es', { sensitivity: 'base' });
  if (cmpLast !== 0) return cmpLast;
  return a.firstName.localeCompare(b.firstName, 'es', { sensitivity: 'base' });
}

/**
 * Compares two students within the same group, respecting custom/existing listNumber
 * if present, otherwise sorting alphabetically by lastName, then firstName.
 */
export function compareStudentsWithinGroup(a: Student, b: Student): number {
  const numA = typeof a.listNumber === 'number' ? a.listNumber : 999999;
  const numB = typeof b.listNumber === 'number' ? b.listNumber : 999999;
  if (numA !== numB) return numA - numB;
  return compareStudentsByName(a, b);
}

/**
 * Sorts students according to filtrarPorGenero:
 * When TRUE:
 *   1º Varones (genero === 'V')
 *   2º Mujeres (genero === 'M')
 *   3º Indefinidos (genero === 'indefinido' or unassigned)
 *   Within each group, respects manual position / alphabetical order.
 *   Re-assigns sequential list numbers (1..N).
 * When FALSE:
 *   Ignores gender, unifies all students into a single list ordered by manual position / alphabetical,
 *   and re-assigns sequential list numbers (1..N).
 */
export function sortAndIndexStudents(students: Student[], filtrarPorGenero: boolean = true): Student[] {
  if (!students || students.length === 0) return [];

  let sorted: Student[] = [];

  if (filtrarPorGenero) {
    const varones: Student[] = [];
    const mujeres: Student[] = [];
    const indefinidos: Student[] = [];

    students.forEach(st => {
      const g = normalizeStudentGender(st.genero);
      if (g === 'V') {
        varones.push(st);
      } else if (g === 'M') {
        mujeres.push(st);
      } else {
        indefinidos.push(st);
      }
    });

    varones.sort(compareStudentsWithinGroup);
    mujeres.sort(compareStudentsWithinGroup);
    indefinidos.sort(compareStudentsWithinGroup);

    sorted = [...varones, ...mujeres, ...indefinidos];
  } else {
    sorted = [...students].sort(compareStudentsWithinGroup);
  }

  // Re-assign sequential list numbers (1..N)
  return sorted.map((st, index) => ({
    ...st,
    listNumber: index + 1,
  }));
}

export interface GroupRange {
  start: number;
  end: number;
  count: number;
}

/**
 * Returns the index boundaries of each group in the sorted list.
 * Useful for drag-and-drop and up/down movement constraints.
 */
export function getGroupIndexRanges(
  sortedStudents: Student[],
  filtrarPorGenero: boolean
): Record<StudentGender, GroupRange> {
  if (!filtrarPorGenero || sortedStudents.length === 0) {
    const fullRange: GroupRange = {
      start: 0,
      end: Math.max(0, sortedStudents.length - 1),
      count: sortedStudents.length,
    };
    return {
      V: fullRange,
      M: fullRange,
      indefinido: fullRange,
    };
  }

  const result: Record<StudentGender, GroupRange> = {
    V: { start: -1, end: -1, count: 0 },
    M: { start: -1, end: -1, count: 0 },
    indefinido: { start: -1, end: -1, count: 0 },
  };

  sortedStudents.forEach((st, idx) => {
    const g = normalizeStudentGender(st.genero);
    if (result[g].start === -1) {
      result[g].start = idx;
    }
    result[g].end = idx;
    result[g].count += 1;
  });

  return result;
}

/**
 * Groups and sorts students into:
 * 1º Varones ('V')
 * 2º Mujeres ('M')
 * 3º Indefinidos ('indefinido' or unassigned)
 * Within each group, respects existing order / alphabetical order.
 * Reassigns sequential list numbers (1..N).
 */
export function groupStudentsByGender(students: Student[]): Student[] {
  return sortAndIndexStudents(students, true);
}

/**
 * Unifies all students into a single list ignoring gender,
 * sorted alphabetically by Apellido, then Nombre,
 * and reassigns sequential list numbers (1..N).
 */
export function unifyStudentsAlphabetically(students: Student[]): Student[] {
  const sorted = [...students].sort(compareStudentsByName);
  return sorted.map((st, idx) => ({
    ...st,
    listNumber: idx + 1,
  }));
}
