import React, { useState, useMemo } from 'react';
import { X, Send, Copy, Check, MessageSquare, Phone } from 'lucide-react';
import { Course, Student, StudentAttendanceEntry } from '../types';
import {
  DEFAULT_WHATSAPP_OPTIONS,
  WhatsAppReportOptions,
  buildWhatsAppURL,
  generateWhatsAppMessage,
} from '../utils/whatsapp';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course;
  dateStr: string;
  students: Student[];
  dayRecord: Record<string, StudentAttendanceEntry>;
  defaultPhone?: string;
  institutionName?: string;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  course,
  dateStr,
  students,
  dayRecord,
  defaultPhone = '',
  institutionName = 'Escuela / Instituto',
}) => {
  const [options, setOptions] = useState<WhatsAppReportOptions>({
    ...DEFAULT_WHATSAPP_OPTIONS,
    destinationPhone: defaultPhone,
    institutionName,
  });
  const [copied, setCopied] = useState(false);

  const previewMessage = useMemo(() => {
    return generateWhatsAppMessage(course, dateStr, students, dayRecord, options);
  }, [course, dateStr, students, dayRecord, options]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(previewMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = previewMessage;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleSend = () => {
    const url = buildWhatsAppURL(previewMessage, options.destinationPhone);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-lg max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#151921] border border-slate-200 dark:border-[#2c3444] shadow-2xl text-slate-900 dark:text-white overflow-hidden animate-slide-up">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#252c3b] flex items-center justify-between bg-slate-50 dark:bg-[#12151b]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Enviar Reporte por WhatsApp</h3>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                {course.name} · {dateStr}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Categories Selector */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Información a incluir en el reporte:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 dark:bg-[#0e1116] p-3 rounded-xl border border-slate-200 dark:border-[#212735]">
              <label className="flex items-center gap-2.5 cursor-pointer py-1 text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={options.includeAbsent}
                  onChange={e => setOptions({ ...options, includeAbsent: e.target.checked })}
                  className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-400 w-4 h-4 accent-amber-500"
                />
                <span>Lista de Ausentes</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer py-1 text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={options.includeLate}
                  onChange={e => setOptions({ ...options, includeLate: e.target.checked })}
                  className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-400 w-4 h-4 accent-amber-500"
                />
                <span>Lista de Tardanzas</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer py-1 text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={options.includeJustified}
                  onChange={e => setOptions({ ...options, includeJustified: e.target.checked })}
                  className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-400 w-4 h-4 accent-amber-500"
                />
                <span>Lista de Ausentes Justificados</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer py-1 text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={options.includeObservations}
                  onChange={e => setOptions({ ...options, includeObservations: e.target.checked })}
                  className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-400 w-4 h-4 accent-amber-500"
                />
                <span>Observaciones destacadas</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer py-1 text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={options.includePresent}
                  onChange={e => setOptions({ ...options, includePresent: e.target.checked })}
                  className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-400 w-4 h-4 accent-amber-500"
                />
                <span>Lista de Presentes (completa)</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer py-1 text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={options.includeStats}
                  onChange={e => setOptions({ ...options, includeStats: e.target.checked })}
                  className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-400 w-4 h-4 accent-amber-500"
                />
                <span>Resumen Estadístico (% asistencia)</span>
              </label>
            </div>
          </div>

          {/* Optional phone number */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center justify-between">
              <span>Número de WhatsApp de destino (opcional)</span>
              <span className="text-slate-400 dark:text-slate-500 font-normal">Si se deja vacío, se elige contacto</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="tel"
                placeholder="Ej. +54 9 11 1234-5678 (o celular de preceptoría)"
                value={options.destinationPhone || ''}
                onChange={e => setOptions({ ...options, destinationPhone: e.target.value })}
                className="w-full bg-slate-50 dark:bg-[#0e1116] border border-slate-300 dark:border-[#252c3b] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 transition"
              />
            </div>
          </div>

          {/* Live formatted preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Vista Previa del Mensaje:
              </label>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '¡Copiado!' : 'Copiar Texto'}</span>
              </button>
            </div>
            <div className="w-full h-44 bg-slate-100 dark:bg-[#0a0c0f] border border-slate-200 dark:border-[#202530] rounded-xl p-3 font-mono text-[11.5px] leading-relaxed text-slate-800 dark:text-slate-300 overflow-y-auto whitespace-pre-wrap select-text">
              {previewMessage}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-slate-50 dark:bg-[#12151b] border-t border-slate-200 dark:border-[#252c3b] flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-xs shadow-lg shadow-emerald-950/20 transition"
          >
            <Send className="w-4 h-4" />
            <span>Generar y Enviar por WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
