import { useState, useCallback } from 'react';
import type { DocumentSection } from '../lib/outlineEngine';

export function useOutlineHistory(initialSections: DocumentSection[]) {
  const [past, setPast] = useState<DocumentSection[][]>([]);
  const [present, setPresent] = useState<DocumentSection[]>(initialSections);
  const [future, setFuture] = useState<DocumentSection[][]>([]);

  const set = useCallback((newPresent: DocumentSection[] | ((current: DocumentSection[]) => DocumentSection[])) => {
    setPresent(currentPresent => {
      const resolvedNewPresent = typeof newPresent === 'function' ? newPresent(currentPresent) : newPresent;
      
      if (currentPresent === resolvedNewPresent) {
        return currentPresent;
      }
      
      setPast(p => [...p, currentPresent]);
      setFuture([]);
      return resolvedNewPresent;
    });
  }, []);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    
    setPast(newPast);
    setFuture(f => [present, ...f]);
    setPresent(previous);
  }, [past, present]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    
    const next = future[0];
    const newFuture = future.slice(1);
    
    setPast(p => [...p, present]);
    setFuture(newFuture);
    setPresent(next);
  }, [future, present]);

  const reset = useCallback((newSections: DocumentSection[]) => {
    setPast([]);
    setPresent(newSections);
    setFuture([]);
  }, []);

  return {
    state: present,
    set,
    undo,
    redo,
    reset,
    canUndo: past.length > 0,
    canRedo: future.length > 0
  };
}
