import { useState } from 'react';
import { History, ChevronDown, ChevronUp, Trash2, RotateCcw, FileText } from 'lucide-react';
import type { DocumentSection } from '../lib/outlineEngine';

export interface HistoryEntry {
  id: string;
  timestamp: number;
  input: string;
  sections: DocumentSection[];
  rawOutput: string;
}

interface HistoryPanelProps {
  history: HistoryEntry[];
  onRestoreInput: (entry: HistoryEntry) => void;
  onViewOutput: (entry: HistoryEntry) => void;
  onClearHistory: () => void;
}

export function HistoryPanel({ history, onRestoreInput, onViewOutput, onClearHistory }: HistoryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    const today = new Date();
    const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return isToday ? `Today at ${timeStr}` : `${date.toLocaleDateString()} at ${timeStr}`;
  };

  return (
    <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-sm overflow-hidden flex flex-col transition-all duration-300">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950/45 hover:bg-slate-100 dark:hover:bg-slate-900/50 transition-colors w-full text-left"
      >
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-350 font-bold text-sm">
          <History className="w-4 h-4 text-slate-550 dark:text-slate-400" />
          📜 Outline Session History
          {history.length > 0 && (
            <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full ml-2">
              {history.length}
            </span>
          )}
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 dark:text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
      </button>

      {isExpanded && (
        <div className="p-4 border-t border-slate-200 dark:border-slate-800/80">
          {history.length === 0 ? (
            <div className="text-center text-slate-500 dark:text-slate-450 py-4 text-xs">
              No history logged yet. Process a document to record outline sessions. 📝⏳
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex justify-end mb-1">
                <button
                  onClick={onClearHistory}
                  className="flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear History
                </button>
              </div>
              
              {history.map((entry) => (
                <div key={entry.id} className="border border-slate-200 dark:border-slate-800/60 rounded-xl p-3.5 bg-slate-50/50 dark:bg-slate-950/20 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-all duration-200">
                  <div className="flex justify-between items-start mb-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-450">
                      <span>🕐 {formatTime(entry.timestamp)}</span>
                      <span>•</span>
                      <span className="text-blue-600 dark:text-blue-400">📊 {entry.sections.length} sections</span>
                    </div>
                  </div>
                  
                  <p className="text-xs text-slate-650 dark:text-slate-355 mb-3.5 italic line-clamp-2">
                    "{entry.input.length > 80 ? entry.input.substring(0, 80) + '...' : entry.input || 'Document input'}"
                  </p>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onRestoreInput(entry)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-850 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-[0.98]"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      Restore Input
                    </button>
                    <button
                      onClick={() => onViewOutput(entry)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-lg text-xs font-bold text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/40 transition-all shadow-sm active:scale-[0.98]"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      View Output
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
