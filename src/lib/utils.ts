import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { DocumentSection } from './outlineEngine';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Transforms an array of DocumentSection structures into a single readable plaintext markdown outline. 📄🖊️
 */
export function generateOutlinePlainText(sections: DocumentSection[]): string {
  return sections.map((sec) => {
    let prefix = '';
    if (sec.level >= 1 && sec.level <= 6) {
      prefix = '#'.repeat(sec.level) + ' ';
    }
    let text = `${prefix}${sec.title || 'Untitled Section'}\n`;
    if (sec.labels.length > 0) {
      text += `🏷️ Labels: ${sec.labels.join(', ')}\n`;
    }
    if (sec.color && sec.color !== 'White') {
      text += `🎨 Visual Group: ${sec.color}\n`;
    }
    text += `\n${sec.content}\n`;
    return text;
  }).join('\n─────────────────────────────────────\n\n');
}
