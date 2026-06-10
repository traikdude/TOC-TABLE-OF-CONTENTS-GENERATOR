import React, { useState } from 'react';
import { Loader2, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

interface UrlInputProps {
  onContentExtracted: (text: string) => void;
}

export function UrlInput({ onContentExtracted }: UrlInputProps) {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const isValidUrl = (value: string) => {
    try { new URL(value); return true; } catch { return false; }
  };

  const handleFetch = async () => {
    if (!url.trim() || !isValidUrl(url)) {
      setStatus('error');
      setErrorMsg('🛑 Please enter a valid URL (e.g. https://example.com)');
      return;
    }
    setStatus('loading');
    setErrorMsg('');

    const getHtmlContent = async (): Promise<string> => {
      // ── Google Apps Script native environment check ────────────────── 🔌✨
      if (typeof window !== 'undefined' && (window as any).google?.script?.run) {
        try {
          return await new Promise<string>((resolve, reject) => {
            (window as any).google.script.run
              .withSuccessHandler((response: { contents?: string; error?: string }) => {
                if (response && response.error) {
                  reject(new Error(response.error));
                } else if (response && response.contents) {
                  resolve(response.contents);
                } else {
                  reject(new Error('No response contents returned from Google Apps Script proxy.'));
                }
              })
              .withFailureHandler((err: any) => {
                reject(new Error(err?.message || 'Google Apps Script proxy execution failed.'));
              })
              .fetchExternalUrl(url);
          });
        } catch (gasErr: any) {
          console.warn('[UrlFetch] Apps Script proxy call failed, falling back to CORS proxy:', gasErr?.message);
        }
      }

      // ── Local / CORS fallback ────────────────────────────────────── 🌐✨
      try {
        console.log('[UrlFetch] Trying corsproxy.io...');
        const res = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(url)}`);
        if (res.ok) {
          const text = await res.text();
          if (text && text.trim()) {
            console.log('[UrlFetch] Successfully fetched via corsproxy.io');
            return text;
          }
        }
      } catch (err: any) {
        console.warn('[UrlFetch] corsproxy.io failed:', err?.message);
      }

      try {
        console.log('[UrlFetch] Trying allorigins.win...');
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.contents) {
            console.log('[UrlFetch] Successfully fetched via allorigins.win');
            return data.contents;
          }
        }
      } catch (err: any) {
        console.warn('[UrlFetch] allorigins.win failed:', err?.message);
      }

      try {
        console.log('[UrlFetch] Trying direct fetch...');
        const res = await fetch(url);
        if (res.ok) {
          const text = await res.text();
          if (text) return text;
        }
      } catch (err: any) {
        console.warn('[UrlFetch] Direct fetch failed:', err?.message);
      }

      throw new Error('Failed to fetch content from this URL. Both CORS proxies and direct fetch failed.');
    };

    try {
      const htmlContent = await getHtmlContent();
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');

      // ── Extract Metadata and Structured Data ────────────────────────── 📊🔍
      const title = doc.querySelector('title')?.innerText || 
                    doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
      const description = doc.querySelector('meta[name="description"]')?.getAttribute('content') || 
                          doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
      
      let jsonLdContent = '';
      doc.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
        try {
          const rawText = script.textContent?.trim();
          if (rawText) {
            const json = JSON.parse(rawText);
            const textContent = json.articleBody || json.description || json.text || json.name || '';
            if (textContent) {
              jsonLdContent += `\n[Structured Data]: ${textContent}\n`;
            }
          }
        } catch {
          // Ignore parse errors
        }
      });

      // Strip layouts 🧹
      doc.querySelectorAll('script, style, nav, footer, aside').forEach(el => el.remove());
      const bodyText = doc.body?.innerText?.trim() || '';

      // Compose combined text ✍️
      let combined = '';
      if (title) combined += `Title: ${title}\n`;
      if (description) combined += `Description: ${description}\n`;
      if (jsonLdContent) combined += `${jsonLdContent}\n`;
      if (bodyText) combined += `\nBody Content:\n${bodyText}`;

      const finalText = combined.trim();
      if (!finalText) {
        throw new Error('No readable content, metadata, or structured data found on this page.');
      }

      onContentExtracted(`\n--- 🔗 Content from ${url} ---\n${finalText.slice(0, 8000)}\n`);
      setStatus('success');
      setTimeout(() => { setStatus('idle'); setUrl(''); }, 2500);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message || 'Failed to fetch content from this URL.');
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleFetch();
  };

  return (
    <div className="mt-3">
      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 px-1">
        🔗 Extract from URL
      </p>
      <div className={cn(
        'flex items-center gap-2 rounded-xl border px-3 py-2 transition-all duration-200',
        status === 'error'
          ? 'border-red-300 dark:border-red-900/50 ring-2 ring-red-100 dark:ring-red-950/30 bg-red-50/10'
          : status === 'success'
          ? 'border-emerald-300 dark:border-emerald-900/50 ring-2 ring-emerald-100 dark:ring-emerald-950/30 bg-emerald-50/10'
          : 'bg-white dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 focus-within:border-blue-600 dark:focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-950/35',
      )}>
        <span className="text-base shrink-0">
          {status === 'success' ? '✅' : status === 'error' ? '⚠️' : '🌐'}
        </span>
        <input
          type="url"
          value={url}
          onChange={e => { setUrl(e.target.value); setStatus('idle'); }}
          onKeyDown={handleKey}
          placeholder="https://paste-any-url-here.com"
          className="flex-1 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-650 outline-none bg-transparent"
          disabled={status === 'loading'}
        />
        {url && (
          <button
            onClick={() => { setUrl(''); setStatus('idle'); }}
            className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-350 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={handleFetch}
          disabled={!url.trim() || status === 'loading'}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 shrink-0 active:scale-95',
            status === 'loading'
              ? 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600 cursor-wait'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-[0_0_10px_rgba(37,99,235,0.25)]',
          )}
        >
          {status === 'loading'
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : '⚡ Fetch'
          }
        </button>
      </div>
      {status === 'error' && errorMsg && (
        <p className="mt-1.5 text-xs text-red-500 dark:text-red-400 px-1 flex items-center gap-1 font-medium">
          <AlertTriangle className="w-3 h-3 shrink-0" /> {errorMsg}
        </p>
      )}
      {status === 'success' && (
        <p className="mt-1.5 text-xs text-emerald-600 px-1 flex items-center gap-1 font-medium">
          <CheckCircle2 className="w-3 h-3 shrink-0" /> ✨ Content extracted and added to your editor!
        </p>
      )}
    </div>
  );
}
