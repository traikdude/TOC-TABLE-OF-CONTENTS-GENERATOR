import { useState, useEffect, useRef } from 'react';
import { 
  Loader2, Copy, Check, ArrowRight, AlertCircle, 
  Moon, Sun, Trash2, Edit3, 
  Sparkles, ExternalLink, ClipboardCheck, Undo, Redo, Plus, FileUp, List
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { processDocumentStream, GeminiApiError } from './services/gemini';
import { parseOutline } from './lib/outlineEngine';
import type { DocumentSection } from './lib/outlineEngine';
import { cn, generateOutlinePlainText } from './lib/utils';
import { useOutlineHistory } from './hooks/useOutlineHistory';
import { MultiFileUpload } from './components/MultiFileUpload';
import { UrlInput } from './components/UrlInput';
import { VoiceInput } from './components/VoiceInput';
import { HistoryPanel } from './components/HistoryPanel';
import type { HistoryEntry } from './components/HistoryPanel';

const COLOR_CLASSES: Record<string, string> = {
  Red: 'keep-card-red text-red-950 dark:text-red-100 border-red-300 dark:border-red-900',
  Orange: 'keep-card-orange text-amber-950 dark:text-amber-100 border-amber-300 dark:border-amber-900',
  Yellow: 'keep-card-yellow text-yellow-950 dark:text-yellow-100 border-yellow-300 dark:border-yellow-900',
  Green: 'keep-card-green text-green-950 dark:text-green-100 border-green-300 dark:border-green-900',
  Teal: 'keep-card-teal text-teal-950 dark:text-teal-100 border-teal-300 dark:border-teal-900',
  Blue: 'keep-card-blue text-blue-950 dark:text-blue-100 border-blue-300 dark:border-blue-900',
  Purple: 'keep-card-purple text-purple-950 dark:text-purple-100 border-purple-300 dark:border-purple-900',
  Pink: 'keep-card-pink text-rose-950 dark:text-rose-100 border-rose-300 dark:border-rose-900',
  Brown: 'keep-card-brown text-amber-900 dark:text-amber-200 border-amber-800/40 dark:border-amber-950',
  Gray: 'keep-card-gray text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-800',
  White: 'keep-card-white text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800',
};

const EXAMPLES = [
  {
    label: '📋 Project Proposal',
    text: `ROLE AND PURPOSE\nThis project establishes a unified design system. We aim to decrease layout latency and improve cross-team visual alignment.\n\nINPUT REQUIREMENTS\nAll UI layouts must use HSL color tokens. Headings must use Outfit from Google Fonts.\n\nIMPLEMENTATION PROCESS\nFirst, set up a Tailwind configuration. Second, code the atomic layout primitives. Third, audit for WCAG accessibility guidelines.`
  },
  {
    label: '📘 Product Spec Outline',
    text: `PRODUCT SPECIFICATION: MOBILE APP\n\n1. Executive Summary\nThe target is to create a secure, cross-platform Android and iOS companion application.\n\n2. Key Features\n- OAuth login with biometric lock support.\n- Real-time offline synchronization of user data.\n- Custom color cards categorization.\n\n3. Verification Plan\nWe will run automated mocha test checks and conduct user audits on test devices.`
  },
  {
    label: '📔 Course Syllabus',
    text: `MODULE 1: INTRODUCTION TO MACHINE LEARNING\nLearn basic algorithms: linear regression, decision trees, and vector math.\n\nMODULE 2: DEEP NEURAL NETWORKS\nStudy backpropagation, activation layers, and optimization matrices.\n\nMODULE 3: NATURAL LANGUAGE PROCESSING\nBuild Transformer decoders, tokenizers, and text generation systems.`
  }
];

export default function App() {
  const [input, setInput] = useState('');
  const { state: sections, set: setSections, undo, redo, canUndo, canRedo, reset: resetSections } = useOutlineHistory([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState('');
  const [copiedSectionId, setCopiedSectionId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isGasNative, setIsGasNative] = useState(false);
  
  // Doc Sync/Write states
  const [isExportingDoc, setIsExportingDoc] = useState(false);
  const [exportedDocUrl, setExportedDocUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Import State
  const [isImporting, setIsImporting] = useState(false);

  // Presets State
  const [activePreset, setActivePreset] = useState<'smart' | 'expert' | 'training'>('smart');
  const [applyNumbering, setApplyNumbering] = useState(true);
  const [refineLanguage, setRefineLanguage] = useState(false);

  // Session History State
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Inline edit state
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editLevel, setEditLevel] = useState(0);

  // Mobile navigation tab
  const [activeTab, setActiveTab] = useState<'input' | 'output'>('input');

  // Health Metrics
  const [healthScore, setHealthScore] = useState(10);
  const [warningsCount, setWarningsCount] = useState(0);
  const [errorsCount, setErrorsCount] = useState(0);
  const [metricsDetails, setMetricsDetails] = useState<string[]>([]);
  const [fkGrade, setFkGrade] = useState('Grade 6');

  useEffect(() => {
    // Detect Apps Script Native Environment 🔌
    if (typeof window !== 'undefined' && (window as any).google?.script?.run) {
      setIsGasNative(true);
      console.log('🟢 [Apps Script] Detected native GAS environment.');
      
      // Auto import document contents on load to be helpful 📄✨
      handleImportDoc(true);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Keydown undo/redo shortcut listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Compute Health Metrics whenever sections or input changes
  useEffect(() => {
    let currentErrors = 0;
    let currentWarnings = 0;
    const details: string[] = [];
    
    // Readability Estimator (Flesch-Kincaid Grade Level) 🧠📈
    const textSample = input || sections.map(s => `${s.title}\n${s.content}`).join('\n');
    const wordCount = textSample.split(/\s+/).filter(w => w.length > 0).length || 1;
    const sentenceCount = textSample.split(/[.!?]+/).filter(s => s.trim().length > 0).length || 1;
    const avgSentenceLength = wordCount / sentenceCount;
    const estimatedGrade = Math.max(1, Math.min(18, Math.round(0.39 * avgSentenceLength + 11.8 * 1.5 - 15.59)));
    setFkGrade(`Grade ${estimatedGrade}`);

    // Structure Quality Checks
    let lastLevel = 0;
    const seenTitles: Record<string, boolean> = {};

    sections.forEach((sec, index) => {
      if (!sec.isSelected) return;
      
      const level = sec.level;
      if (level > 0) {
        // Skipped level check (e.g., H1 -> H3) ⚠️
        if (lastLevel > 0 && level - lastLevel > 1) {
          currentWarnings++;
          details.push(`Heading skip: Level jumped from H${lastLevel} directly to H${level} at "${sec.title}" ⚠️`);
        }
        lastLevel = level;

        // Duplicate title check
        if (seenTitles[sec.title]) {
          currentWarnings++;
          details.push(`Duplicate heading title: "${sec.title}" ⚠️`);
        }
        seenTitles[sec.title] = true;
      }

      // Empty content warning
      if (!sec.content.trim()) {
        currentWarnings++;
        details.push(`Section outline is empty: "${sec.title || `Section ${index + 1}`}" 💡`);
      }
    });

    // Score deduction
    let score = 10 - currentErrors * 2 - currentWarnings * 0.5;
    score = Math.max(1.0, Math.min(10.0, score));

    setHealthScore(parseFloat(score.toFixed(1)));
    setErrorsCount(currentErrors);
    setWarningsCount(currentWarnings);
    setMetricsDetails(details);
  }, [sections, input]);

  // Explode confetti on successful outline generation 🎉
  const prevIsProcessing = useRef(isProcessing);
  useEffect(() => {
    if (prevIsProcessing.current && !isProcessing && sections.length > 0) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#2563eb', '#10b981', '#fbbf24']
      });
    }
    prevIsProcessing.current = isProcessing;
  }, [isProcessing, sections.length]);

  // Force outline view tab active when outline parsing completes 🗂️
  useEffect(() => {
    if (!isProcessing && sections.length > 0) {
      setActiveTab('output');
    }
  }, [isProcessing, sections.length]);

  // Smart recommendation logic
  useEffect(() => {
    if (activePreset === 'smart') {
      const textSample = input;
      const wordCount = textSample.split(/\s+/).filter(w => w.length > 0).length;
      if (wordCount > 500) {
        setApplyNumbering(true);
        setRefineLanguage(true);
      } else {
        setApplyNumbering(true);
        setRefineLanguage(false);
      }
    }
  }, [activePreset, input]);

  const handleImportDoc = async (isAuto = false) => {
    // Check window.google.script.run directly in the condition to avoid compiler optimization issues 🔌✨
    if (typeof window === 'undefined' || !(window as any).google?.script?.run) {
      if (!isAuto) {
        setError('Import Document requires running inside Google Apps Script container. 🛑');
      }
      return;
    }

    setIsImporting(true);
    setError('');
    
    try {
      const result = await new Promise<any>((resolve, reject) => {
        (window as any).google.script.run
          .withSuccessHandler((response: any) => {
            if (response && response.error) reject(new Error(response.error));
            else resolve(response);
          })
          .withFailureHandler((err: any) => reject(new Error(err?.message || 'Failed to import document.')))
          .getActiveDocText();
      });

      if (result && result.text) {
        setInput(result.text);
        // Alert success with mini-confetti
        confetti({
          particleCount: 40,
          colors: ['#2563eb']
        });
      }
    } catch (err: any) {
      if (!isAuto) {
        setError(`Import error: ${err.message || err} 🚨`);
      } else {
        console.warn('Auto-import failed (expected in standalone web app mode):', err.message || err);
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleProcessOutline = async () => {
    if (!isOnline) {
      setError('You are offline. Please restore internet access to call the model. 📵');
      return;
    }
    if (input.trim().length < 10) {
      setError('Please provide at least 10 characters of document text to structure. 📝');
      return;
    }

    setIsProcessing(true);
    setError('');
    resetSections([]);
    setStreamingContent('');
    setExportedDocUrl(null);
    setExportError(null);

    try {
      const result = await processDocumentStream(input, (chunk) => {
        setStreamingContent(chunk);
      });

      if (!result || result.trim() === '') {
        setError('No structured outline generated. Provide more detailed text. 📝');
      } else {
        const parsed = parseOutline(result);
        resetSections(parsed);

        // Add to history log ⏳✨
        setHistory(prev => {
          const newEntry: HistoryEntry = {
            id: `history-${Date.now()}`,
            timestamp: Date.now(),
            input: input,
            sections: parsed,
            rawOutput: result
          };
          const newHistory = [newEntry, ...prev];
          return newHistory.slice(0, 5); // Cache last 5 items
        });
      }
    } catch (err: any) {
      if (err instanceof GeminiApiError) {
        setError(`${err.message} 🚨`);
      } else {
        setError('Failed to reach Gemini API. Please try again. 🚨');
      }
      console.error(err);
    } finally {
      setIsProcessing(false);
      setStreamingContent('');
    }
  };

  const handleCopySection = async (sec: DocumentSection) => {
    try {
      const prefix = sec.level > 0 ? '#'.repeat(sec.level) + ' ' : '';
      const textToCopy = `${prefix}${sec.title}\n\n${sec.content}`;
      await navigator.clipboard.writeText(textToCopy);
      setCopiedSectionId(sec.id);
      setTimeout(() => setCopiedSectionId(null), 2000);
    } catch (err) {
      console.error('Copy section failed:', err);
    }
  };

  const handleCopyAll = async () => {
    const activeSecs = sections.filter(s => s.isSelected);
    if (activeSecs.length === 0) return;
    try {
      const text = generateOutlinePlainText(activeSecs);
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (err) {
      console.error('Copy all failed:', err);
    }
  };

  const handleApplyToDoc = async () => {
    const activeSecs = sections.filter(s => s.isSelected);
    if (activeSecs.length === 0) return;
    
    const runsNative = typeof window !== 'undefined' && (window as any).google?.script?.run;
    if (!runsNative) {
      setExportError('Applying layout requires running inside Google Apps Script environment. 🔌');
      return;
    }

    setIsExportingDoc(true);
    setExportError(null);
    setExportedDocUrl(null);

    try {
      const result = await new Promise<any>((resolve, reject) => {
        (window as any).google.script.run
          .withSuccessHandler((response: any) => {
            if (response && response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response);
            }
          })
          .withFailureHandler((err: any) => {
            reject(new Error(err?.message || 'Apps Script write transaction failed.'));
          })
          .writeStructuredDoc(activeSecs, {
            applyNumbering: applyNumbering,
            refineLanguage: refineLanguage
          });
      });

      if (result && result.success) {
        setExportedDocUrl(result.url);
        confetti({
          particleCount: 150,
          spread: 80,
          colors: ['#2563eb', '#60a5fa']
        });
      }
    } catch (err: any) {
      setExportError(err?.message || 'Failed to update Google Doc.');
    } finally {
      setIsExportingDoc(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, isSelected: !s.isSelected } : s));
  };

  const deleteSection = (id: string) => {
    setSections(prev => prev.filter(s => s.id !== id));
  };

  const addSection = () => {
    const newSec: DocumentSection = {
      id: `sec_${Date.now()}`,
      title: 'New Outline Heading',
      level: 1,
      content: 'Outline component details go here.',
      color: 'White',
      labels: ['Custom'],
      isSelected: true
    };
    setSections(prev => [...prev, newSec]);
  };

  const changeColor = (id: string, color: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, color: color } : s));
  };

  const startEditing = (sec: DocumentSection) => {
    setEditingSectionId(sec.id);
    setEditTitle(sec.title);
    setEditContent(sec.content);
    setEditLevel(sec.level);
  };

  const saveEdit = (id: string) => {
    setSections(prev => prev.map(s => {
      if (s.id === id) {
        return { ...s, title: editTitle, content: editContent, level: editLevel };
      }
      return s;
    }));
    setEditingSectionId(null);
  };

  const handleRestoreInput = (entry: HistoryEntry) => {
    setInput(entry.input);
  };

  const handleViewOutput = (entry: HistoryEntry) => {
    setSections(entry.sections);
    setInput(entry.input);
    setError('');
  };

  const handleClearHistory = () => {
    setHistory([]);
  };

  const inputLength = input.length;
  const isValid = inputLength >= 10;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans transition-colors duration-500">
      
      {/* Header Bar */}
      <header className="bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm backdrop-blur-md transition-colors duration-300">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="bg-blue-600 p-2 rounded-xl shadow-sm shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-black tracking-tight truncate flex items-center gap-1.5 text-slate-900 dark:text-white">
              📜 <span className="gradient-text">TOC Styler Outline</span>
            </h1>
            <p className="text-[10px] text-slate-550 dark:text-slate-400 hidden sm:block">AI-assisted structural formatting and table of contents generation 🚀✨</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isGasNative ? (
            <div className="flex items-center gap-1 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2 py-1 rounded-xl text-[10px] sm:text-xs font-semibold border border-blue-200 dark:border-blue-900/30">
              <span>🟢 Google Doc Connected</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-xl text-[10px] sm:text-xs font-semibold border border-slate-200 dark:border-slate-800">
              <span>💻 Sandbox Host</span>
            </div>
          )}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-550 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 transition-all"
            title="Toggle Dark Mode"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Tabs navigation for narrow sidebars */}
      <div className="lg:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex sticky top-[53px] z-10 shadow-sm transition-colors duration-300">
        <button
          onClick={() => setActiveTab('input')}
          className={cn(
            'flex-1 py-2.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all',
            activeTab === 'input'
              ? 'border-blue-600 text-blue-600 bg-blue-50/10 dark:bg-blue-950/20'
              : 'border-transparent text-slate-505 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
          )}
        >
          ✏️ Input Text
        </button>
        <button
          onClick={() => setActiveTab('output')}
          className={cn(
            'flex-1 py-2.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all',
            activeTab === 'output'
              ? 'border-blue-600 text-blue-600 bg-blue-50/10 dark:bg-blue-950/20'
              : 'border-transparent text-slate-505 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
          )}
        >
          🗂️ Outline Editor
          {sections.length > 0 && (
            <span className="bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {sections.length}
            </span>
          )}
        </button>
      </div>

      {/* Main workspace layout */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto p-4 lg:grid lg:grid-cols-12 gap-6 relative z-10">
        
        {/* Left column (Text input area) */}
        <div className={cn(
          "lg:col-span-5 flex flex-col gap-4 animate-fade-in-up lg:h-[calc(100vh-8rem)]",
          activeTab === 'input' ? 'flex' : 'hidden lg:flex'
        )}>
          
          {/* Quick Import / Example Templates */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col gap-2.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-450 dark:text-slate-500">📋 Load & Import Outline</span>
              {(typeof window !== 'undefined' && (window as any).google?.script?.run) && (
                <button
                  onClick={() => handleImportDoc(false)}
                  disabled={isImporting}
                  className="flex items-center gap-1 text-[10px] font-black text-blue-650 hover:text-blue-700 disabled:opacity-50"
                >
                  {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
                  <span>Import Active Doc</span>
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setInput(ex.text)}
                  className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all border border-slate-200/50 dark:border-slate-700/50"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Large text area editor card */}
          <div className="flex-1 relative rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-500/10 overflow-hidden flex flex-col min-h-[300px]">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="✏️ Paste draft document, raw meeting transcripts, or syllabus notes here...
              
💡 Tip: If connected, click 'Import Active Doc' above to pull the current document's text directly! 🔌✨"
              className="w-full p-4 resize-none outline-none text-slate-800 dark:text-slate-105 bg-transparent text-xs sm:text-sm placeholder-slate-400 dark:placeholder-slate-650 leading-relaxed font-sans flex-1"
            />
            
            {/* Modular OCR and URL Inputs inside card border */}
            <div className="px-4 pb-2 bg-slate-50/60 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800/50">
              <MultiFileUpload 
                onTextExtracted={(text) => {
                  setInput(prev => prev + text);
                }}
              />
              <UrlInput 
                onContentExtracted={(text) => {
                  setInput(prev => prev + text);
                }}
              />
            </div>

            {/* Input footer actions */}
            <div className="p-4 bg-white dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800/50 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-550">
                <VoiceInput 
                  onTranscript={(text) => {
                    setInput(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + text);
                  }}
                />
                <span className="font-mono font-semibold">
                  {inputLength.toLocaleString()} chars
                </span>
              </div>
              <button
                onClick={handleProcessOutline}
                disabled={isProcessing || !isValid || !isOnline}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all w-full sm:w-auto justify-center shadow-sm",
                  !isValid || isProcessing || !isOnline
                    ? "bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-650 cursor-not-allowed border border-slate-200 dark:border-slate-800/60"
                    : "bg-blue-600 hover:bg-blue-700 text-white hover:shadow-md"
                )}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <span>⚡ Process Outline</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Session History panel */}
          <HistoryPanel 
            history={history}
            onRestoreInput={handleRestoreInput}
            onViewOutput={handleViewOutput}
            onClearHistory={handleClearHistory}
          />
        </div>

        {/* Right column (Outline edit board & Presets) */}
        <div className={cn(
          "lg:col-span-7 flex flex-col gap-4 animate-fade-in-up lg:h-[calc(100vh-8rem)]",
          activeTab === 'output' ? 'flex' : 'hidden lg:flex'
        )}>
          
          {/* Action bar and layout presets */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
            <div className="flex items-center gap-2">
              <List className="w-4.5 h-4.5 text-blue-600" />
              <h2 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                Document Outline Tree
              </h2>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  onClick={() => setActivePreset('smart')}
                  className={cn(
                    "px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all",
                    activePreset === 'smart' ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-white" : "text-slate-550"
                  )}
                >
                  Smart
                </button>
                <button
                  onClick={() => setActivePreset('expert')}
                  className={cn(
                    "px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all",
                    activePreset === 'expert' ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-white" : "text-slate-550"
                  )}
                >
                  Expert
                </button>
                <button
                  onClick={() => setActivePreset('training')}
                  className={cn(
                    "px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all",
                    activePreset === 'training' ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-white" : "text-slate-550"
                  )}
                >
                  Training
                </button>
              </div>

              {activePreset === 'expert' && (
                <div className="flex items-center gap-2 px-1 border-l border-slate-250 dark:border-slate-800 ml-1">
                  <label className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-450 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyNumbering}
                      onChange={(e) => setApplyNumbering(e.target.checked)}
                      className="rounded text-blue-600 cursor-pointer"
                    />
                    <span>Numbering</span>
                  </label>
                  <label className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-450 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={refineLanguage}
                      onChange={(e) => setRefineLanguage(e.target.checked)}
                      className="rounded text-blue-600 cursor-pointer"
                    />
                    <span>Language Optimization</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Health monitor widget */}
          <div className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-550">📊 Outline Health Monitor</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-650 dark:text-slate-350">Score:</span>
                <span className={cn(
                  "text-xs font-black px-2 py-0.5 rounded-full border",
                  healthScore >= 8 ? "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400" :
                  healthScore >= 5 ? "bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400" :
                  "bg-red-50 border-red-200 text-red-600 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400"
                )}>
                  {healthScore}/10 ★★★★☆
                </span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-slate-100/50 dark:bg-slate-800/40 p-2 rounded-xl border border-slate-200/40 dark:border-slate-800/50">
                <span className="block text-[9px] font-semibold text-slate-400 dark:text-slate-500">Readability</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{fkGrade}</span>
              </div>
              <div className="bg-slate-100/50 dark:bg-slate-800/40 p-2 rounded-xl border border-slate-200/40 dark:border-slate-800/50">
                <span className="block text-[9px] font-semibold text-slate-400 dark:text-slate-500">Errors</span>
                <span className="text-xs font-bold text-red-500">{errorsCount}</span>
              </div>
              <div className="bg-slate-100/50 dark:bg-slate-800/40 p-2 rounded-xl border border-slate-200/40 dark:border-slate-800/50">
                <span className="block text-[9px] font-semibold text-slate-400 dark:text-slate-550">Warnings</span>
                <span className="text-xs font-bold text-amber-500">{warningsCount}</span>
              </div>
              <div className="bg-slate-100/50 dark:bg-slate-800/40 p-2 rounded-xl border border-slate-200/40 dark:border-slate-800/50">
                <span className="block text-[9px] font-semibold text-slate-400 dark:text-slate-555">Style</span>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{applyNumbering ? 'Numbered' : 'Standard'}</span>
              </div>
            </div>

            {metricsDetails.length > 0 && activePreset === 'training' && (
              <div className="mt-1 bg-blue-50/20 dark:bg-blue-950/10 border border-blue-200/30 rounded-xl p-3 max-h-[90px] overflow-y-auto scrollbar-thin">
                <h4 className="text-[10px] font-extrabold uppercase text-blue-600 dark:text-blue-400 tracking-wider mb-1">Outline Improvement Recommendations:</h4>
                <ul className="text-[10px] space-y-1 text-slate-550 dark:text-slate-400 pl-0">
                  {metricsDetails.map((det, idx) => (
                    <li key={idx} className="list-none flex items-start gap-1">
                      <span>•</span>
                      <span>{det}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Sync status messages */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-650 dark:text-red-400 rounded-xl text-xs font-semibold animate-slide-down">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {exportError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-655 dark:text-red-400 rounded-xl text-xs font-semibold animate-slide-down">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{exportError}</span>
            </div>
          )}

          {exportedDocUrl && (
            <div className="flex items-center justify-between gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold animate-slide-down">
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Google Doc formatted successfully! Outline & TOC applied.</span>
              </span>
              <a 
                href={exportedDocUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-[10px] shrink-0 shadow-sm"
              >
                <span>Open Document</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Outlining Cards Viewport */}
          <div className="flex-1 bg-slate-100/50 dark:bg-slate-900/20 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-4 overflow-y-auto min-h-[300px]">
            {isProcessing && streamingContent ? (
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-850 shadow-sm opacity-85">
                <p className="text-[10px] font-bold text-slate-400 animate-pulse">Streaming raw AI analysis...</p>
                <pre className="text-xs text-slate-600 dark:text-slate-300 font-mono whitespace-pre-wrap leading-relaxed mt-2.5 max-h-[200px] overflow-y-auto">
                  {streamingContent}
                </pre>
              </div>
            ) : isProcessing ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
                <div className="w-10 h-10 border-4 border-slate-200 dark:border-slate-800 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="text-slate-550 dark:text-slate-400 font-semibold text-xs animate-pulse">🧠 Structuring document outlines...</p>
              </div>
            ) : sections.length > 0 ? (
              <div className="flex flex-col gap-4">
                {/* Outliner Tool Actions */}
                <div className="flex justify-between items-center mb-1 bg-white/40 dark:bg-slate-900/40 p-2 rounded-xl border border-slate-200/30">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={addSection}
                      className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-extrabold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all active:scale-95 shadow-sm"
                    >
                      <Plus className="w-3 h-3" />
                      Add Section
                    </button>
                    <button
                      onClick={handleCopyAll}
                      className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-250 dark:border-slate-700 text-slate-650 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-750 transition-all active:scale-95"
                    >
                      {copiedAll ? <ClipboardCheck className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      Copy Outline
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-1 border-l border-slate-200/50 pl-2">
                    <button 
                      onClick={undo} 
                      disabled={!canUndo} 
                      className={cn("p-1.5 rounded-lg", canUndo ? "text-slate-650 hover:bg-slate-100" : "text-slate-300 cursor-not-allowed")}
                      title="Undo (Ctrl+Z)"
                    >
                      <Undo className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={redo} 
                      disabled={!canRedo} 
                      className={cn("p-1.5 rounded-lg", canRedo ? "text-slate-650 hover:bg-slate-100" : "text-slate-300 cursor-not-allowed")}
                      title="Redo (Ctrl+Y)"
                    >
                      <Redo className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Section outlines list */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sections.map((sec) => (
                    <div
                      key={sec.id}
                      className={cn(
                        "p-4 rounded-xl border transition-all duration-300 relative group flex flex-col gap-2.5 shadow-sm hover:shadow-md",
                        COLOR_CLASSES[sec.color] || COLOR_CLASSES.White
                      )}
                    >
                      {editingSectionId === sec.id ? (
                        <div className="flex flex-col gap-2.5 w-full">
                          <div className="flex gap-2">
                            <select
                              value={editLevel}
                              onChange={(e) => setEditLevel(parseInt(e.target.value))}
                              className="text-[10px] font-bold rounded border bg-white/60 dark:bg-black/30 p-1 border-black/10 outline-none text-slate-800 dark:text-slate-105"
                            >
                              <option value={0}>Paragraph</option>
                              <option value={1}>Heading 1</option>
                              <option value={2}>Heading 2</option>
                              <option value={3}>Heading 3</option>
                              <option value={4}>Heading 4</option>
                              <option value={5}>Heading 5</option>
                              <option value={6}>Heading 6</option>
                            </select>
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="flex-1 font-bold text-xs bg-white/60 dark:bg-black/30 outline-none p-1.5 rounded border border-black/10"
                            />
                          </div>
                          <textarea
                            rows={3}
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full text-xs bg-white/60 dark:bg-black/30 outline-none p-1.5 rounded border border-black/10 resize-none font-mono"
                          />
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => setEditingSectionId(null)}
                              className="px-2 py-1 text-[9px] font-bold bg-black/10 dark:bg-white/10 rounded"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => saveEdit(sec.id)}
                              className="px-2.5 py-1 text-[9px] font-bold bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Card header */}
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={sec.isSelected}
                                onChange={() => toggleSelect(sec.id)}
                                className="rounded border-slate-350 text-blue-600 focus:ring-blue-500 shrink-0 cursor-pointer w-3.5 h-3.5"
                              />
                              <div className="min-w-0">
                                <span className={cn(
                                  "text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-full mr-1.5 tracking-wider bg-black/5 dark:bg-white/10",
                                  sec.level > 0 ? "text-blue-600 dark:text-blue-400" : "text-slate-550 dark:text-slate-455"
                                )}>
                                  {sec.level > 0 ? `H${sec.level}` : 'Para'}
                                </span>
                                <h3 className="font-bold text-xs sm:text-sm truncate inline-block align-middle">{sec.title || '(Body Block)'}</h3>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => deleteSection(sec.id)}
                                className="p-1 rounded-lg text-slate-450 hover:text-red-500 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                title="Delete Section"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Card Content body */}
                          <div className="flex-1 text-xs whitespace-pre-wrap leading-relaxed font-sans mt-0.5 text-slate-700 dark:text-slate-300">
                            {sec.content}
                          </div>

                          {/* Card Labels */}
                          {sec.labels.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {sec.labels.map((lbl, idx) => (
                                <span 
                                  key={idx} 
                                  className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-black/5 dark:bg-white/10 text-slate-650 dark:text-slate-350 border border-black/5"
                                >
                                  {lbl}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Card Footer controllers */}
                          <div className="flex justify-between items-center border-t border-black/5 dark:border-white/5 pt-2 mt-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => startEditing(sec)}
                                className="flex items-center gap-1 text-[9px] font-bold text-slate-500 dark:text-slate-400 hover:text-blue-650"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                              
                              {/* Small color pick bubble list */}
                              <div className="flex items-center gap-0.5 ml-2.5 border-l border-black/10 dark:border-white/10 pl-2.5">
                                {['White', 'Blue', 'Teal', 'Green', 'Yellow', 'Red'].map((colorName) => (
                                  <button
                                    key={colorName}
                                    onClick={() => changeColor(sec.id, colorName)}
                                    className={cn(
                                      "w-2.5 h-2.5 rounded-full border border-black/10 transition-transform hover:scale-125",
                                      colorName === 'White' ? "bg-white" :
                                      colorName === 'Blue' ? "bg-blue-300" :
                                      colorName === 'Teal' ? "bg-teal-350" :
                                      colorName === 'Green' ? "bg-green-300" :
                                      colorName === 'Yellow' ? "bg-yellow-300" :
                                      "bg-red-300",
                                      sec.color === colorName ? "ring-1 ring-blue-500 scale-110" : ""
                                    )}
                                    title={colorName}
                                  />
                                ))}
                              </div>
                            </div>
                            
                            <button
                              onClick={() => handleCopySection(sec)}
                              className="flex items-center gap-1 text-[9px] font-bold text-slate-500 dark:text-slate-400 hover:text-blue-650"
                            >
                              {copiedSectionId === sec.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-500" />
                                  <span className="text-emerald-500">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy Card</span>
                                </>
                              )}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {/* Final document formatting trigger */}
                {typeof window !== 'undefined' && (window as any).google?.script?.run && (
                  <div className="mt-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-center animate-slide-down">
                    <button
                      onClick={handleApplyToDoc}
                      disabled={isExportingDoc}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
                    >
                      {isExportingDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      <span>Format & Generate Table of Contents ⚡</span>
                    </button>
                    <p className="text-[10px] text-slate-455 dark:text-slate-500 mt-2">
                      Clears current document and writes structured outline entries, bookmarks, and Table of Contents navigation. 📄🔌
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Onboarding state */
              <div className="flex flex-col items-center justify-center text-center gap-4 h-full py-12">
                <div className="w-40 h-40 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm bg-white dark:bg-slate-900 flex items-center justify-center animate-bounce-in">
                  <img 
                    src="https://raw.githubusercontent.com/traikdude/Universal-Task-Structurer/main/public/empty_state.png" 
                    alt="Outline Structurer Mascot" 
                    className="w-full h-full object-cover" 
                  />
                </div>
                
                <div className="space-y-1">
                  <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 dark:text-slate-250">Document Outline Styler</h3>
                  <p className="text-[11px] text-slate-450 dark:text-slate-500 max-w-[220px] leading-relaxed">
                    Paste raw text on the left, then click
                    <span className="font-bold text-blue-600"> ⚡ Process Outline </span>
                    to generate your structured preview cards here! 📄✨
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
