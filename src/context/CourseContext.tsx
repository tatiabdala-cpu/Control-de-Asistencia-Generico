import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { Course } from '../types';

export interface CourseContextType {
  selectedCourseId: string;
  cursoSeleccionado: string; // Alias requerido
  selectedCourse: Course | undefined;
  setSelectedCourseId: (courseId: string) => void;
  setCursoSeleccionado: (courseId: string) => void; // Alias requerido
}

const CourseContext = createContext<CourseContextType | undefined>(undefined);

export interface CourseProviderProps {
  courses: Course[];
  selectedCourseId: string;
  onSelectCourse: (courseId: string) => void;
  children: ReactNode;
}

export const CourseProvider: React.FC<CourseProviderProps> = ({
  courses,
  selectedCourseId,
  onSelectCourse,
  children,
}) => {
  const selectedCourse = useMemo(() => {
    return courses.find(c => c.id === selectedCourseId) || courses[0];
  }, [courses, selectedCourseId]);

  const value = useMemo<CourseContextType>(
    () => ({
      selectedCourseId,
      cursoSeleccionado: selectedCourseId,
      selectedCourse,
      setSelectedCourseId: onSelectCourse,
      setCursoSeleccionado: onSelectCourse,
    }),
    [selectedCourseId, selectedCourse, onSelectCourse]
  );

  return <CourseContext.Provider value={value}>{children}</CourseContext.Provider>;
};

export const useCourse = (): CourseContextType => {
  const context = useContext(CourseContext);
  if (!context) {
    throw new Error('useCourse debe ser utilizado dentro de un CourseProvider');
  }
  return context;
};
