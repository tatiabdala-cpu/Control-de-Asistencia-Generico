import React, { useState } from 'react';
import { Download, Wifi, WifiOff, Sun, Moon, School, Undo2 } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';
import { ThemeMode } from '../hooks/useTheme';

interface HeaderProps {
  onOpenSettings: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  canUndo?: boolean;
  onUndoClick?: () => void;
  lastUndoDescription?: string;
  institutionName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  theme,
  onToggleTheme,
  canUndo = false,
  onUndoClick,
  lastUndoDescription,
  institutionName = 'Escuela / Instituto',
}) => {
  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#12151b]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#252b37] px-4 py-3 text-slate-900 dark:text-white shadow-sm dark:shadow-lg transition-colors">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
        {/* Institutional Branding (Marca Blanca) */}
        <div className="flex items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white truncate leading-snug">
                {institutionName || 'Escuela / Instituto'}
              </h1>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400/90 font-medium tracking-wide flex items-center gap-1.5">
              <span>Control de Asistencia</span>
              <span className="text-slate-400 dark:text-slate-600 font-bold">·</span>
              <span className="text-slate-500 dark:text-slate-400">100% Offline-First</span>
            </p>
          </div>
        </div>

        {/* Right action items */}
        <div className="flex items-center gap-2">
          {/* Undo Action Button (Deshacer) */}
          <button
            onClick={onUndoClick}
            disabled={!canUndo}
            className={`p-2 rounded-xl border transition active:scale-95 shadow-xs flex items-center justify-center ${
              canUndo
                ? 'bg-slate-100 hover:bg-slate-200 dark:bg-[#1a202c] dark:hover:bg-[#252e3e] text-slate-700 dark:text-slate-200 hover:text-amber-600 dark:hover:text-amber-400 border-slate-300/80 dark:border-[#2d3748] cursor-pointer'
                : 'bg-slate-100/40 dark:bg-[#1a202c]/30 text-slate-300 dark:text-slate-600 border-slate-200/60 dark:border-slate-800/40 cursor-not-allowed opacity-40'
            }`}
            title={canUndo ? (lastUndoDescription ? `Deshacer: ${lastUndoDescription}` : 'Deshacer última acción') : 'No hay acciones para deshacer'}
            aria-label="Deshacer última acción"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          {/* Dark / Light Mode Toggle Button */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1a202c] dark:hover:bg-[#252e3e] text-slate-700 dark:text-amber-400 border border-slate-300/80 dark:border-[#2d3748] transition active:scale-95 shadow-xs"
            title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            aria-label="Cambiar Modo de Color"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 animate-spin-once" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>

          {/* Online/Offline status pill */}
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border transition-colors ${
              isOnline
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40'
                : 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60 animate-pulse'
            }`}
            title={isOnline ? 'Conexión a internet activa' : 'Modo 100% Offline activo'}
          >
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* PWA In-App Install Button */}
          {!isInstalled && isInstallable && (
            <button
              onClick={install}
              className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs px-2.5 py-1.5 rounded-lg shadow-sm active:scale-95 transition"
              title="Instalar como App en este dispositivo"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Instalar</span>
            </button>
          )}

          {!isInstalled && isIOS && !isInstallable && (
            <button
              onClick={() => setShowIOSGuide(true)}
              className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-500 border border-amber-500/30 px-2 py-1 rounded-lg transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Instalar iOS</span>
            </button>
          )}
        </div>
      </div>

      {/* iOS Safari Installation Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#181d26] border border-slate-200 dark:border-[#2e3646] p-5 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center gap-2.5 mb-3 text-amber-600 dark:text-amber-400">
              <School className="w-5 h-5" />
              <h3 className="text-base font-bold">Instalar en iPhone / iPad</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed space-y-2 mb-4">
              Para instalar la app de asistencia en tu pantalla de inicio:
            </p>
            <ol className="text-xs text-slate-700 dark:text-slate-300 space-y-2.5 mb-5 bg-slate-50 dark:bg-[#12151b] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">1</span>
                <span>Toca el botón <strong>Compartir</strong> <span className="text-amber-600 dark:text-amber-400">(ícono cuadrado con flecha hacia arriba)</span> en la barra de Safari.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">2</span>
                <span>Baja en el menú y selecciona <strong>«Agregar a Inicio»</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">3</span>
                <span>Toca <strong>Agregar</strong> arriba a la derecha. ¡Listo!</span>
              </li>
            </ol>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition active:scale-98"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
