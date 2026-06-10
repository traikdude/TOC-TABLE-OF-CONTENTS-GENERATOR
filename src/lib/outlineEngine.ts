export interface DocumentSection {
  id: string;
  title: string;
  level: number;
  content: string;
  color: string;
  labels: string[];
  isSelected: boolean;
}

/**
 * Parses JSON output from Gemini (or text containing a JSON array) into structured DocumentSection items. 🧠📂
 */
export const parseOutline = (rawText: string): DocumentSection[] => {
  try {
    let jsonStr = rawText.trim();
    
    // Attempt to isolate the JSON array bracket boundaries
    const start = jsonStr.indexOf('[');
    const end = jsonStr.lastIndexOf(']');
    
    if (start !== -1 && end !== -1) {
      jsonStr = jsonStr.substring(start, end + 1);
    }
    
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      throw new Error('Parsed outline is not a JSON array.');
    }
    
    return parsed.map((item: any, index: number) => {
      // Clean up color mapping
      let color = item.color || 'White';
      color = color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();
      const validColors = ['Red', 'Orange', 'Yellow', 'Green', 'Teal', 'Blue', 'Purple', 'Pink', 'Gray', 'White', 'Brown'];
      if (!validColors.includes(color)) {
        color = 'White';
      }

      return {
        id: `sec_${Date.now()}_${index}`,
        title: item.title || '',
        level: typeof item.level === 'number' ? item.level : 0,
        content: item.content || '',
        color: color,
        labels: Array.isArray(item.labels) ? item.labels : [],
        isSelected: true
      };
    });
  } catch (err: any) {
    console.error('⚠️ [parseOutline] JSON parse failed, utilizing fallback structure:', err);
    // Return a fallback single text block containing the raw text
    return [
      {
        id: `sec_${Date.now()}_fallback`,
        title: 'Imported Outline Content',
        level: 0,
        content: rawText,
        color: 'White',
        labels: ['Imported'],
        isSelected: true
      }
    ];
  }
};

/**
 * Serializes the current active outline sections back into a clean JSON string block. 💾🖊️
 */
export const serializeOutline = (sections: DocumentSection[]): string => {
  const cleanList = sections.map(s => ({
    title: s.title,
    level: s.level,
    content: s.content,
    color: s.color,
    labels: s.labels
  }));
  return JSON.stringify(cleanList, null, 2);
};
