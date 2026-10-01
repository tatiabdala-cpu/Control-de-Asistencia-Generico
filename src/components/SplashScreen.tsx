import React, { useState, useEffect } from 'react';

interface SplashScreenProps {
  onFinish?: () => void;
  duration?: number;
  institutionName?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  duration = 2000,
  institutionName = 'Sistema de Asistencia Escolar',
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Start fade-out slightly before finishing
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, Math.max(duration - 400, 1000));

    const endTimer = setTimeout(() => {
      setIsVisible(false);
      if (onFinish) onFinish();
    }, duration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(endTimer);
    };
  }, [duration, onFinish]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0e1014] text-white transition-opacity duration-400 ease-out select-none ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-label="Cargando Sistema de Asistencia"
    >
      <div className="flex flex-col items-center px-6 text-center max-w-sm animate-in fade-in zoom-in-95 duration-500">
        {/* App Logo / Icon */}
        <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mb-4 shadow-xl border border-white/20">
          <span className="text-4xl font-black text-blue-700 tracking-tighter">A</span>
        </div>

        {/* Institution Titles */}
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mb-1.5">
          {institutionName || 'Sistema de Asistencia'}
        </h1>
        <p className="text-sm font-semibold text-amber-400 tracking-wide mb-6">
          Control Diario de Asistencia Escolar
        </p>

        {/* Loading Spinner / Progress indicator */}
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-bounce" />
        </div>

        <span className="text-[11px] text-slate-500 mt-5 tracking-wider uppercase font-medium">
          Iniciando sistema offline...
        </span>
      </div>
    </div>
  );
};
