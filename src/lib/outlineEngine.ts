export interface DocumentSection {
  id: string;
  title: string;
  level: number;
  content: string;
  color: string;
  labels: string[];
  isSelected: boolean;
}

export interface ParsedV42Result {
  analysisBlock: string;
  sections: DocumentSection[];
  validationReport: string;
  rawText: string;
}

const LEVEL_COLORS: Record<number, string> = {
  1: 'Blue',
  2: 'Teal',
  3: 'Purple',
  4: 'Green',
  5: 'Orange',
  6: 'Gray',
  0: 'White'
};

/**
 * Parses full v4.2 response text into Analysis Block, Structured Sections, and Validation Report. 🧠📂
 */
export const parseV42Response = (rawText: string): ParsedV42Result => {
  if (!rawText || !rawText.trim()) {
    return {
      analysisBlock: '',
      sections: [],
      validationReport: '',
      rawText: ''
    };
  }

  const text = rawText.trim();
  let analysisBlock = '';
  let documentBody = text;
  let validationReport = '';

  // 1. Detect and extract 📊 ANALYSIS block
  const analysisMatch = text.match(/(?:📊\s*ANALYSIS|ANALYSIS\s*BLOCK)([\s\S]*?)(?=(?:📄\s*FORMATTED DOCUMENT|📄\s*Formatted Document|##?\s+|$))/i);
  if (analysisMatch) {
    analysisBlock = analysisMatch[1].trim();
  }

  // 2. Detect and extract ✅ VALIDATION REPORT
  const validationMatch = text.match(/(?:✅\s*VALIDATION REPORT|VALIDATION REPORT)([\s\S]*)$/i);
  if (validationMatch) {
    validationReport = validationMatch[1].trim();
  }

  // 3. Isolate the Document Body between Analysis and Validation
  const docBodyMatch = text.match(/(?:📄\s*FORMATTED DOCUMENT|📄\s*Formatted Document)([\s\S]*?)(?=(?:✅\s*VALIDATION REPORT|VALIDATION REPORT|$))/i);
  if (docBodyMatch) {
    documentBody = docBodyMatch[1].trim();
  } else if (analysisMatch && validationMatch) {
    // Slice between analysis end and validation start
    const startIdx = text.indexOf(analysisMatch[0]) + analysisMatch[0].length;
    const endIdx = text.indexOf(validationMatch[0]);
    if (endIdx > startIdx) {
      documentBody = text.substring(startIdx, endIdx).trim();
    }
  }

  // 4. Try parsing JSON array if present
  let sections: DocumentSection[] = [];
  const startBracket = documentBody.indexOf('[');
  const endBracket = documentBody.lastIndexOf(']');
  if (startBracket !== -1 && endBracket !== -1 && endBracket > startBracket) {
    try {
      const jsonStr = documentBody.substring(startBracket, endBracket + 1);
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed) && parsed.length > 0 && (parsed[0].title !== undefined || parsed[0].content !== undefined)) {
        sections = parsed.map((item: any, idx: number) => ({
          id: `sec_${Date.now()}_${idx}`,
          title: item.title || '',
          level: typeof item.level === 'number' ? item.level : 1,
          content: item.content || '',
          color: item.color || LEVEL_COLORS[item.level || 1] || 'White',
          labels: Array.isArray(item.labels) ? item.labels : [`H${item.level || 1}`],
          isSelected: true
        }));
      }
    } catch {
      // Fall through to markdown parsing
    }
  }

  // 5. If JSON wasn't parsed, parse Markdown Headings (# Header, ## Subheader)
  if (sections.length === 0) {
    const lines = documentBody.split(/\r?\n/);
    let currentSection: DocumentSection | null = null;
    let secIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        if (currentSection) {
          currentSection.content = currentSection.content.trim();
          sections.push(currentSection);
        }

        const level = headingMatch[1].length;
        const title = headingMatch[2].trim();

        currentSection = {
          id: `sec_${Date.now()}_${secIndex++}`,
          title: title,
          level: level,
          content: '',
          color: LEVEL_COLORS[level] || 'Blue',
          labels: [`H${level}`],
          isSelected: true
        };
      } else if (currentSection) {
        currentSection.content += (currentSection.content ? '\n' : '') + line;
      } else if (line.trim()) {
        // Leading introductory content before first heading
        currentSection = {
          id: `sec_${Date.now()}_${secIndex++}`,
          title: 'Document Title & Overview',
          level: 1,
          content: line,
          color: 'Blue',
          labels: ['Title'],
          isSelected: true
        };
      }
    }

    if (currentSection) {
      currentSection.content = currentSection.content.trim();
      sections.push(currentSection);
    }
  }

  // 6. If still no headings detected, split paragraphs intelligently
  if (sections.length === 0) {
    const paras = documentBody.split(/\n\s*\n/).filter(p => p.trim());
    if (paras.length > 0) {
      sections = paras.map((p, idx) => {
        const firstLine = p.split('\n')[0].replace(/^[*_\s]+|[*_\s]+$/g, '').slice(0, 60);
        return {
          id: `sec_${Date.now()}_${idx}`,
          title: idx === 0 ? firstLine : `Section ${idx}: ${firstLine}`,
          level: idx === 0 ? 1 : 2,
          content: p,
          color: idx === 0 ? 'Blue' : 'Teal',
          labels: [idx === 0 ? 'H1' : 'H2'],
          isSelected: true
        };
      });
    }
  }

  return {
    analysisBlock,
    sections,
    validationReport,
    rawText
  };
};

/**
 * Backward-compatible parseOutline function.
 */
export const parseOutline = (rawText: string): DocumentSection[] => {
  const result = parseV42Response(rawText);
  return result.sections;
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
