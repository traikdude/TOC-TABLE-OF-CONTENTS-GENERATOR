/**
 * frameworkV42.ts
 * Smart/Training/Hybrid/Expert mode + hotkey resolution for the TOC app.
 *
 * Important separation of responsibilities:
 * - This module controls AI document-architecture behavior.
 * - Native Google Docs bookmark/link construction is handled by NavigationV42.js.
 */

export type FrameworkMode = 'smart' | 'training' | 'hybrid' | 'expert';
export type DeliverySurface = 'google-docs' | 'markdown' | 'docx' | 'html' | 'pdf' | 'plain-text' | 'unknown';

export interface FrameworkResolution {
  mode: FrameworkMode;
  type: string;
  intent: 'inform' | 'persuade' | 'instruct' | 'entertain' | 'mixed';
  audience: string;
  wordCount: number;
  naturalSections: number;
  structureDetected: string;
  deliverySurface: DeliverySurface;
  nativeNavigationCapability: 'available' | 'unavailable' | 'partially available' | 'unverified' | 'not required';
  directionality: 'bidirectional' | 'forward-only' | 'structural-only' | 'unavailable';
  navigationStrategy: string;
  appliedCombo: string[];
  autoResolved: string[];
  conflicts: string[];
  unknownHotkeys: string[];
  stopBeforeFormatting: boolean;
  learningInsight: boolean;
  navigation: {
    enabled: boolean;
    maxDepth: 3 | 6;
    presentation: 'numbered' | 'bulleted';
    metadata: boolean;
    backToTop: boolean;
    reciprocal: boolean;
    smartToc: boolean;
  };
}

const VALID = new Set([
  'A1', 'A11', 'A12', 'A2', 'A21', 'A22', 'A3', 'A31', 'A32', 'A4', 'A41', 'A42',
  'S1', 'S11', 'S12', 'S2', 'S21', 'S22', 'S3', 'S31', 'S32', 'S33', 'S34', 'S35', 'S4', 'S41', 'S42',
  'F1', 'F2', 'F3', 'F4', 'F5',
  'R1', 'R11', 'R12', 'R13', 'R14', 'R2', 'R21', 'R22', 'R23', 'R24',
  'R3', 'R31', 'R32', 'R33', 'R34', 'R4', 'R41', 'R42', 'R43', 'R44',
  'P1', 'P2', 'P3', 'P4', 'P5',
  'NAV11', 'NAV112', 'NAV121', 'NAV122', 'NAV141', 'NAV23', 'NAV24'
]);

const PARENT_DEFAULTS: Record<string, string> = {
  A1: 'A11',
  A2: 'A22',
  A3: 'A32',
  A4: 'A42',
  S1: 'S12',
  S2: 'S22',
  S3: 'S35',
  S4: 'S41',
  R1: 'R14',
  R2: 'R24',
  R3: 'R34',
  R4: 'R42'
};

const PRESETS = {
  blog: ['A1', 'S32', 'F5', 'R13', 'P5'],
  technical: ['A1', 'S35', 'F2', 'R24', 'P3'],
  quickGuide: ['A1', 'S31', 'F4', 'R12', 'P2'],
  business: ['A1', 'S32', 'F3', 'R23', 'P3'],
  tutorial: ['A1', 'S31', 'F4', 'R13', 'P5']
} as const;

export function resolveFrameworkV42(args: {
  input: string;
  mode?: FrameworkMode;
  hotkeys?: string;
  deliverySurface?: DeliverySurface;
}): FrameworkResolution {
  const input = args.input || '';
  const mode: FrameworkMode = args.mode || 'smart';
  const deliverySurface = args.deliverySurface || 'google-docs';
  const analysis = analyzeInput(input);

  if (mode === 'hybrid') {
    // Hybrid mode returns the best recommendation. The UI should call
    // recommendHybridConfigurationsV42() to render both choices, then STOP.
    const base = smartCombo(analysis);
    return makeResolution({
      mode,
      analysis,
      deliverySurface,
      combo: base,
      autoResolved: ['Hybrid mode: recommendation only; formatting paused'],
      conflicts: [],
      unknownHotkeys: [],
      stopBeforeFormatting: true,
      learningInsight: false
    });
  }

  if (mode === 'expert') {
    const parsed = parseHotkeys(args.hotkeys || '');
    const resolved = resolvePartialCombo(parsed.valid);
    return makeResolution({
      mode,
      analysis,
      deliverySurface,
      combo: resolved.combo,
      autoResolved: resolved.autoResolved,
      conflicts: parsed.conflicts,
      unknownHotkeys: parsed.unknown,
      stopBeforeFormatting: false,
      learningInsight: false
    });
  }

  const combo = smartCombo(analysis);
  return makeResolution({
    mode,
    analysis,
    deliverySurface,
    combo,
    autoResolved: [],
    conflicts: [],
    unknownHotkeys: [],
    stopBeforeFormatting: false,
    learningInsight: mode === 'training'
  });
}

export function recommendHybridConfigurationsV42(input: string) {
  const analysis = analyzeInput(input);
  const first = smartCombo(analysis);

  let second: string[];
  if (first.includes('F2')) second = [...PRESETS.quickGuide];
  else if (first.includes('F4')) second = [...PRESETS.technical];
  else if (first.includes('F3')) second = [...PRESETS.technical];
  else second = [...PRESETS.business];

  return [
    {
      rank: 1,
      fit: 94,
      combo: first,
      reason: 'Best match for the detected intent, structure, and Google Docs delivery surface.'
    },
    {
      rank: 2,
      fit: 82,
      combo: second,
      reason: 'Strong alternative with a different presentation/formatting emphasis.'
    }
  ];
}

export function buildModelInstructionV42(resolution: FrameworkResolution): string {
  const combo = resolution.appliedCombo.join(' + ');

  return `
V4.2 EXECUTION CONTRACT

Resolved mode: ${resolution.mode}
Resolved hotkeys: ${combo}
Detected type: ${resolution.type}
Detected intent: ${resolution.intent}
Audience: ${resolution.audience}
Delivery surface: ${resolution.deliverySurface}

HARD RULES
- Preserve all factual claims, quantities, names, dates, conditions, exceptions, uncertainty, scope, and attribution.
- Never invent facts, citations, technical values, or unsupported procedures.
- If structurally required information is missing, write "[NEEDED — description]" rather than fabricating it.
- Do not skip native heading levels in the proposed hierarchy.
- Do not create Markdown-style internal navigation links for Google Docs.
- Do not insert fake or AI/session URLs.
- Keep emoji use restrained and never use emojis as machine identity.
- Return COMPLETE content; do not use "content continues", "...", or placeholder summaries.
- Native Google Docs navigation is implemented and validated server-side after your structured output; do not try to fabricate bookmark URLs.

STRUCTURE/FMT/REVISION/PRESENTATION
Apply: ${combo}

OUTPUT CONTRACT
Return ONLY a valid JSON array of section objects compatible with the existing app:
[
  {
    "title": "string",
    "level": 0|1|2|3|4|5|6,
    "content": "complete string",
    "color": "Red|Orange|Yellow|Green|Teal|Blue|Purple|Pink|Brown|Gray|White",
    "labels": ["string"]
  }
]

Do not wrap explanatory prose around the JSON.
`.trim();
}

export function navigationOptionsForGasV42(resolution: FrameworkResolution) {
  return {
    forceToc: !resolution.navigation.smartToc,
    reciprocal: resolution.navigation.reciprocal,
    backToTop: resolution.navigation.backToTop,
    maxDepth: resolution.navigation.maxDepth,
    presentation: resolution.appliedCombo.find(v => /^P[1-5]$/.test(v)) || 'P3'
  };
}

function makeResolution(args: {
  mode: FrameworkMode;
  analysis: ReturnType<typeof analyzeInput>;
  deliverySurface: DeliverySurface;
  combo: string[];
  autoResolved: string[];
  conflicts: string[];
  unknownHotkeys: string[];
  stopBeforeFormatting: boolean;
  learningInsight: boolean;
}): FrameworkResolution {
  const p = args.combo.find(v => /^P[1-5]$/.test(v)) || 'P3';
  const navTokens = args.combo.filter(v => v.startsWith('NAV'));
  const navigation = navigationDefaultsForPresentation(p, navTokens, args.deliverySurface);

  return {
    mode: args.mode,
    type: args.analysis.type,
    intent: args.analysis.intent,
    audience: args.analysis.audience,
    wordCount: args.analysis.wordCount,
    naturalSections: args.analysis.naturalSections,
    structureDetected: args.analysis.structureDetected,
    deliverySurface: args.deliverySurface,
    nativeNavigationCapability: args.deliverySurface === 'google-docs' ? 'available' : 'unverified',
    directionality: navigation.reciprocal ? 'bidirectional' : navigation.enabled ? 'forward-only' : 'structural-only',
    navigationStrategy: args.deliverySurface === 'google-docs'
      ? (navigation.reciprocal ? 'reciprocal bookmarks' : 'native heading/bookmark links')
      : 'destination-aware navigation',
    appliedCombo: args.combo,
    autoResolved: args.autoResolved,
    conflicts: args.conflicts,
    unknownHotkeys: args.unknownHotkeys,
    stopBeforeFormatting: args.stopBeforeFormatting,
    learningInsight: args.learningInsight,
    navigation
  };
}

function parseHotkeys(raw: string) {
  const tokens = raw
    .toUpperCase()
    .split(/[+,;\s]+/)
    .map(t => t.trim())
    .filter(Boolean);

  const valid: string[] = [];
  const unknown: string[] = [];
  const conflicts: string[] = [];
  const lastBySlot: Record<string, string> = {};

  for (const token of tokens) {
    if (!/^(A|S|F|R|P|NAV)\d+$/.test(token) || !VALID.has(token)) {
      unknown.push(token);
      continue;
    }

    const expanded = PARENT_DEFAULTS[token] || token;
    if (expanded !== token) {
      valid.push(expanded);
      continue;
    }

    const slot = slotFor(expanded);
    if (slot && lastBySlot[slot] && lastBySlot[slot] !== expanded) {
      conflicts.push(`${lastBySlot[slot]} discarded → ${expanded} wins by last-listed rule`);
      const oldIndex = valid.lastIndexOf(lastBySlot[slot]);
      if (oldIndex >= 0) valid.splice(oldIndex, 1);
    }

    if (slot) lastBySlot[slot] = expanded;
    valid.push(expanded);
  }

  return { valid, unknown, conflicts };
}

function resolvePartialCombo(supplied: string[]) {
  const combo = [...supplied];
  const autoResolved: string[] = [];

  const hasS = combo.some(v => v.startsWith('S'));
  const hasF = combo.some(v => /^F[1-5]$/.test(v));
  const hasR = combo.some(v => v.startsWith('R'));
  const hasP = combo.some(v => /^P[1-5]$/.test(v));

  if (!hasS) { combo.push('S35'); autoResolved.push('S35 (auto)'); }
  if (!hasF) { combo.push('F2'); autoResolved.push('F2 (auto)'); }
  if (!hasR) { combo.push('R24'); autoResolved.push('R24 (auto)'); }
  if (!hasP) { combo.push('P3'); autoResolved.push('P3 (auto)'); }

  if (!combo.some(v => v.startsWith('A'))) combo.unshift('A1');
  appendNavigationDefaults(combo);

  return { combo, autoResolved };
}

function smartCombo(analysis: ReturnType<typeof analyzeInput>): string[] {
  let combo: string[];

  if (analysis.intent === 'instruct') {
    combo = [...PRESETS.tutorial];
  } else if (analysis.type === 'technical documentation' || analysis.type === 'specification') {
    combo = [...PRESETS.technical];
  } else if (analysis.type === 'business report') {
    combo = [...PRESETS.business];
  } else if (analysis.type === 'narrative') {
    combo = [...PRESETS.blog];
  } else {
    combo = ['A1', 'S35', 'F1', 'R24', 'P3'];
  }

  appendNavigationDefaults(combo);
  return combo;
}

function appendNavigationDefaults(combo: string[]) {
  const p = combo.find(v => /^P[1-5]$/.test(v)) || 'P3';
  if (p === 'P1') return;
  if (p === 'P4') {
    if (!combo.includes('NAV112')) combo.push('NAV112');
    if (!combo.includes('NAV122')) combo.push('NAV122');
    return;
  }

  if (!combo.includes('NAV11')) combo.push('NAV11');
  if (p === 'P3') {
    if (!combo.includes('NAV121')) combo.push('NAV121');
    if (!combo.includes('NAV141')) combo.push('NAV141');
  } else if (!combo.includes('NAV122')) {
    combo.push('NAV122');
  }

  if (p === 'P5' && !combo.includes('NAV23')) combo.push('NAV23');
  if (!combo.includes('NAV24')) combo.push('NAV24');
}

function navigationDefaultsForPresentation(p: string, navTokens: string[], surface: DeliverySurface) {
  const enabled = p !== 'P1';
  const maxDepth: 3 | 6 = navTokens.includes('NAV112') ? 3 : 6;
  const presentation = navTokens.includes('NAV121') ? 'numbered' : 'bulleted';
  const metadata = navTokens.includes('NAV141');
  const backToTop = navTokens.includes('NAV23');
  const reciprocal = enabled && navTokens.includes('NAV24') &&
    ['google-docs', 'markdown', 'docx', 'html'].includes(surface);

  return {
    enabled,
    maxDepth,
    presentation,
    metadata,
    backToTop,
    reciprocal,
    smartToc: enabled
  } as const;
}

function slotFor(token: string): string | null {
  if (/^F[1-5]$/.test(token)) return 'F';
  if (/^P[1-5]$/.test(token)) return 'P';

  // S and R subfamilies can coexist only when from different subfamilies.
  const s = token.match(/^S([1-4])/);
  if (s) return 'S' + s[1];
  const r = token.match(/^R([1-4])/);
  if (r) return 'R' + r[1];

  // NAV depth/presentation/direction are separate slots.
  if (token === 'NAV11' || token === 'NAV112') return 'NAV_DEPTH';
  if (token === 'NAV121' || token === 'NAV122') return 'NAV_STYLE';
  if (token === 'NAV23') return 'NAV_TOP';
  if (token === 'NAV24') return 'NAV_RECIPROCAL';
  return null;
}

function analyzeInput(input: string) {
  const text = input.trim();
  const words = text ? text.split(/\s+/) : [];
  const wordCount = words.length;
  const naturalSections = Math.max(
    1,
    (text.match(/(^|\n)(#{1,6}\s+|\d+[\.\)]\s+|[A-Z][A-Z0-9 &/-]{4,}\n)/g) || []).length
  );

  const lower = text.toLowerCase();
  const instructSignals = /(step|procedure|how to|setup|install|configure|workflow|instruction|prerequisite)/.test(lower);
  const techSignals = /(api|script|code|function|architecture|system|specification|technical|schema|validation|google docs)/.test(lower);
  const businessSignals = /(executive summary|revenue|kpi|strategy|stakeholder|business|roi|performance)/.test(lower);
  const persuasionSignals = /(recommend|should|proposal|argument|benefit|case for)/.test(lower);
  const narrativeSignals = /(story|chapter|character|scene|journey|memoir)/.test(lower);

  let intent: 'inform' | 'persuade' | 'instruct' | 'entertain' | 'mixed' = 'inform';
  const hits = [instructSignals, persuasionSignals, narrativeSignals].filter(Boolean).length;
  if (hits > 1) intent = 'mixed';
  else if (instructSignals) intent = 'instruct';
  else if (persuasionSignals) intent = 'persuade';
  else if (narrativeSignals) intent = 'entertain';

  let type = 'general document';
  if (techSignals && /specification|contract|requirements|system/.test(lower)) type = 'specification';
  else if (techSignals) type = 'technical documentation';
  else if (businessSignals) type = 'business report';
  else if (narrativeSignals) type = 'narrative';

  const structureDetected = instructSignals
    ? 'chronological / procedural'
    : /versus| vs\.?|compare|comparison/.test(lower)
      ? 'comparative'
      : /problem|solution|issue|fix|resolution/.test(lower)
        ? 'problem-solution'
        : naturalSections >= 3
          ? 'hierarchical'
          : 'mixed';

  return {
    type,
    intent,
    audience: techSignals ? 'technical/professional readers' : 'general readers',
    wordCount,
    naturalSections,
    structureDetected
  };
}
