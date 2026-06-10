import { useState, useEffect, useCallback } from 'react';
import { Mic } from 'lucide-react';
import { cn } from '../lib/utils';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  className?: string;
}

export function VoiceInput({ onTranscript, className }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [error, setError] = useState('');
  const [isLocal, setIsLocal] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isHostnameLocal = window.location.hostname === 'localhost' || 
                              window.location.hostname === '127.0.0.1';
      setIsLocal(isHostnameLocal);

      // Only initialize native speech recognition if we are on localhost 🎤✨
      if (isHostnameLocal) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          const rec = new SpeechRecognition();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = 'en-US';

          rec.onresult = (event: any) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript + ' ';
              }
            }
            if (finalTranscript) {
              onTranscript(finalTranscript);
            }
          };

          rec.onerror = (event: any) => {
            console.error('Speech recognition error', event.error);
            if (event.error === 'not-allowed') {
              setError('Microphone access denied');
            }
            setIsListening(false);
          };

          rec.onend = () => {
            setIsListening(false);
          };

          setRecognition(rec);
        } else {
          setError('Speech recognition not supported in this browser.');
        }
      }
    }
  }, [onTranscript]);

  // Listen for messages from the popup helper window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'SPEECH_RESULT') {
        const transcript = event.data.transcript;
        if (transcript) {
          onTranscript(transcript);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onTranscript]);

  const handleMicClick = useCallback(() => {
    if (isLocal) {
      if (!recognition) return;
      if (isListening) {
        recognition.stop();
        setIsListening(false);
      } else {
        setError('');
        try {
          recognition.start();
          setIsListening(true);
        } catch (err) {
          console.error(err);
        }
      }
    } else {
      // Deployed web app (sandboxed iframe) -> Open the popup voice.html helper page 📣✨
      const width = 450;
      const height = 400;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const openPopup = (url: string) => {
        const popup = window.open(
          url,
          'VoiceDictationHelper',
          `width=${width},height=${height},top=${top},left=${left},status=no,menubar=no,toolbar=no`
        );

        if (!popup) {
          setError('Popup blocked! Please allow popups for this page to use voice input.');
          setTimeout(() => setError(''), 5000);
        }
      };

      // Deployed web app (sandboxed iframe) -> Open the popup voice.html helper page directly from GitHub to bypass permission block 📣✨
      if (typeof (window as any).google?.script?.run !== 'undefined') {
        openPopup('https://raw.githack.com/traikdude/TOC-TABLE-OF-CONTENTS-GENERATOR/main/public/voice.html');
      } else {
        openPopup('/voice.html');
      }
    }
  }, [isLocal, isListening, recognition]);

  return (
    <div className={cn("relative flex items-center", className)}>
      <button
        type="button"
        onClick={handleMicClick}
        className={cn(
          "p-2 rounded-full transition-all duration-200 flex items-center justify-center",
          isListening 
            ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 animate-pulse shadow-sm" 
            : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-350 dark:hover:bg-slate-700",
          error && "opacity-50 cursor-not-allowed"
        )}
        title={error || (isListening ? "Stop listening" : "Start voice input")}
        disabled={!!error && !isListening && isLocal}
      >
        <Mic className="w-4.5 h-4.5" />
      </button>
      {isListening && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[10px] px-2 py-1 rounded shadow-lg pointer-events-none z-10">
          Listening...
        </span>
      )}
      {error && !isLocal && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-red-650 text-white text-[10px] px-2 py-1 rounded shadow-lg pointer-events-none z-10">
          {error}
        </span>
      )}
    </div>
  );
}
