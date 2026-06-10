import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Image as ImageIcon, X, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker 📄✨
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface MultiFileUploadProps {
  onTextExtracted: (text: string) => void;
}

interface FileStatus {
  id: string;
  name: string;
  type: 'image' | 'pdf';
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
}

export function MultiFileUpload({ onTextExtracted }: MultiFileUploadProps) {
  const [files, setFiles] = useState<FileStatus[]>([]);

  const updateFileStatus = (id: string, updates: Partial<FileStatus>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const processFile = async (file: File, statusId: string) => {
    updateFileStatus(statusId, { status: 'processing', progress: 10 });
    try {
      let extractedText = '';
      if (file.type.startsWith('image/')) {
        const result = await Tesseract.recognize(file, 'eng', {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              updateFileStatus(statusId, { progress: 10 + Math.round(m.progress * 80) });
            }
          },
        });
        extractedText = result.data.text;
      } else if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          fullText += (content.items as any[]).map(item => item.str).join(' ') + '\n';
          updateFileStatus(statusId, { progress: 10 + Math.round((i / pdf.numPages) * 80) });
        }
        extractedText = fullText;
      }
      updateFileStatus(statusId, { status: 'completed', progress: 100 });
      onTextExtracted(`\n--- 📄 Extracted from ${file.name} ---\n${extractedText}\n`);
    } catch (err) {
      console.error('OCR Error:', err);
      updateFileStatus(statusId, { status: 'error', progress: 0, error: 'Extraction failed 😅' });
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      name: file.name,
      type: (file.type.startsWith('image/') ? 'image' : 'pdf') as 'image' | 'pdf',
      status: 'pending' as const,
      progress: 0,
    }));
    setFiles(prev => [...prev, ...newFiles]);
    newFiles.forEach((fs, i) => processFile(acceptedFiles[i], fs.id));
  }, [onTextExtracted]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'], 'application/pdf': ['.pdf'] }
  });

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));

  return (
    <div className="mt-3 mb-2 space-y-2">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={cn(
          'cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-all duration-200 group',
          isDragActive
            ? 'border-blue-600 dark:border-blue-500 bg-blue-50/20 dark:bg-slate-900/50 scale-[1.01]'
            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 hover:border-blue-600 dark:hover:border-blue-500 hover:bg-blue-50/10 dark:hover:bg-slate-900/30',
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          <span className={cn(
            'text-3xl transition-transform duration-200',
            isDragActive ? 'scale-125 animate-bounce' : 'group-hover:scale-110',
          )}>
            {isDragActive ? '⚡' : '🖼️'}
          </span>
          <div>
            <p className={cn(
              'text-sm font-semibold transition-colors',
              isDragActive ? 'text-blue-600 dark:text-blue-500' : 'text-slate-600 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-500',
            )}>
              {isDragActive ? 'Drop files here! 🔥' : 'Drop images or PDFs here'}
            </p>
            <p className="text-[10px] text-slate-450 dark:text-slate-550 mt-0.5">
              📋 Whiteboards · 🧾 Receipts · 📝 Handwritten notes · 📄 PDFs
            </p>
          </div>
          {!isDragActive && (
            <span className="text-[10px] font-bold text-blue-650 dark:text-blue-400 bg-blue-50/50 dark:bg-slate-900 border border-blue-100 dark:border-slate-850 px-2.5 py-0.5 rounded-full">
              🔍 AI-powered OCR extraction
            </span>
          )}
        </div>
      </div>

      {/* File Cards */}
      {files.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {files.map((file) => (
            <div
              key={file.id}
              className={cn(
                'relative rounded-xl p-2.5 flex items-center gap-2.5 border transition-all duration-300 overflow-hidden',
                file.status === 'completed' ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30' :
                file.status === 'error'     ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30' :
                                              'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-250',
              )}
            >
              <div
                className={cn(
                  'absolute inset-0 opacity-10 transition-all duration-500',
                  file.status === 'completed' ? 'bg-emerald-400' :
                  file.status === 'error'     ? 'bg-red-400'     : 'bg-blue-400',
                )}
                style={{ width: `${file.progress}%` }}
              />

              <div className={cn(
                'p-1.5 rounded-lg border shrink-0 z-10',
                file.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400' :
                file.status === 'error'     ? 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-900/40 text-red-500 dark:text-red-400' :
                                              'bg-blue-50 dark:bg-slate-800 border-blue-100 dark:border-slate-700 text-blue-500 dark:text-blue-400',
              )}>
                {file.status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                 file.status === 'error'     ? <AlertTriangle className="w-3.5 h-3.5" /> :
                 file.type === 'pdf'         ? <FileText className="w-3.5 h-3.5" /> :
                                              <ImageIcon className="w-3.5 h-3.5" />}
              </div>

              <div className="flex-1 min-w-0 z-10">
                <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">{file.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        file.status === 'completed' ? 'bg-emerald-500' :
                        file.status === 'error'     ? 'bg-red-450'     : 'bg-blue-500',
                      )}
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-slate-400 dark:text-slate-550 w-7 text-right shrink-0">
                    {file.status === 'completed' ? '✅' : file.status === 'error' ? '❌' : `${file.progress}%`}
                  </span>
                </div>
              </div>

              <button
                onClick={() => removeFile(file.id)}
                className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/35 rounded-lg transition-all z-10 shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
