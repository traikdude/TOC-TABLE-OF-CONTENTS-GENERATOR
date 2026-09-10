# TOC Generator v4.2 — Repair + Framework Integration Guide

This patch plan merges the best parts of the existing TOC Generator with the requirements from the
“Enhanced Document Formatting & Analysis System — v4.2 Master” specification.

The goal is **not** to replace the current app. The current React/Gemini/Apps-Script application already
contains valuable features that should remain. The v4.2 specification becomes the behavioral contract
for document architecture and navigation.

---

## 1. What stays from the existing app

Preserve these existing capabilities:

- React sidebar / standalone web-app UI
- Google Doc import
- Google Doc export / rewrite
- Gemini-based restructuring
- professional section numbering
- language refinement controls
- health/readability monitoring
- inline section editing
- undo/redo and recent-session history
- file, URL, clipboard, and voice inputs
- color-card presentation
- generic “Back to Top” navigation as a separate optional feature

The new navigation engine is additive: it replaces the fragile bookmark/TOC layer underneath these features.

---

## 2. What v4.2 adds

### NAV24 exact reciprocal navigation

For every generated pair:

`TOC ENTRY A → HEADING A`

and

`HEADING A → EXACT TOC ENTRY A`

The reverse link does **not** merely point to the top of the TOC.

### One-to-one identity

Each pair is keyed by structural context rather than visible text alone:

- document ID
- Document tab ID/path
- native heading level
- structural child position
- duplicate occurrence index

This prevents duplicate headings such as two “Summary” sections from collapsing onto one bookmark.

### Google Docs tab awareness

The patch uses `Document.getTabs()`, `Tab.getChildTabs()`, `Tab.asDocumentTab()`, and `DocumentTab`
bookmark methods. It supports:

- active-tab TOC
- central TOC across all tabs
- per-tab TOCs
- nested tab paths
- cross-tab forward and reverse links

### Honest verification states

The engine returns explicit statuses such as:

- `BIDIRECTIONAL_NAVIGATION_VERIFIED`
- `NAVIGATION_VERIFIED`
- `NAVIGATION_PARTIAL`
- `NAVIGATION_TARGET_CONTAMINATED`

It reads generated hyperlink destinations back with `Text.getLinkUrl()` before claiming success.

### Smart TOC trigger

When `forceToc` is false and presentation is P2/P3/P5, a TOC is generated when either:

- there are at least 3 H2 headings, or
- the selected content exceeds 500 words.

The existing explicit **Generate / Refresh TOC** command should pass `forceToc: true`.

---

## 3. Files in this patch bundle

Copy these files into the repository:

```text
src/gas/NavigationV42.js
src/gas/DocumentIOV42.js
src/gas/GeminiProxyV42.js
src/gas/NavigationV42Tests.js
src/lib/frameworkV42.ts
src/constants/systemPrompt.ts   <- replace with the v4.2 prompt file
build-gas.js                    <- replace with build-gas.v42.js
```

The build change is required. The current builder copies only `src/gas/Code.js`, so newly added Apps Script
modules would otherwise never reach `dist-gas` or `clasp push`.

---

## 4. Apps Script integration changes

### 4.1 Replace the legacy `generateTOC()` implementation

Keep the function name so the existing custom menu continues working, but replace its body with:

```javascript
function generateTOC() {
  const report = generateTOCV42({
    forceToc: true,
    scope: 'active-tab',
    reciprocal: true,
    backToTop: true,
    maxDepth: 6,
    presentation: 'P3'
  });

  if (!report.success) {
    throw new Error(
      'TOC rebuild did not fully verify. Status: ' + report.navigationStatus
    );
  }

  return 'Success: ' + report.pairCount +
    ' reciprocal TOC pairs. ' + report.navigationStatus;
}
```

This preserves the existing menu binding while routing it to the new engine.

---

### 4.2 Stop deleting every bookmark before a structured write

Delete the current block in `writeStructuredDoc()` that does this:

```javascript
var bookmarks = doc.getBookmarks();
for (var b = bookmarks.length - 1; b >= 0; b--) {
  bookmarks[b].remove();
}
```

The v4.2 engine manages only the targets it owns. Arbitrarily deleting every bookmark is unsafe because
bookmarks can belong to the user or another workflow.

---

### 4.3 Let the existing writer finish, then normalize navigation through v4.2

At the **end** of `writeSectionsToDoc()`, after the existing content has been written, add:

```javascript
const navReport = rebuildNavigationForDocumentV42(doc, {
  forceToc: true,
  scope: 'active-tab',
  reciprocal: true,
  backToTop: true,
  maxDepth: 6,
  presentation: 'P3',

  // writeStructuredDoc/exportToNewDoc already hold the outer lock.
  skipLock: true,

  // Do not close the Document object out from under the caller.
  closeDocument: false
});

return navReport;
```

The v4.2 engine deliberately removes the legacy generated TOC/Back-to-Top block and rebuilds it as exact
reciprocal pairs. Existing heading bookmarks are reused instead of creating another bookmark on every refresh.

Then update the caller in `writeStructuredDoc()`:

```javascript
const navReport = writeSectionsToDoc(doc, sections, options);

return {
  success: !!navReport.success,
  url: doc.getUrl(),
  count: sections.length,
  navigation: navReport
};
```

And update `exportToNewDoc()` similarly:

```javascript
const navReport = writeSectionsToDoc(doc, sections, options);

return {
  success: !!navReport.success,
  url: docUrl,
  count: sections.length,
  navigation: navReport
};
```

---

### 4.4 Modernize document body access

Where document text operations currently use:

```javascript
var body = doc.getBody();
```

prefer an explicit `DocumentTab`:

```javascript
function getWorkingDocumentTabV42_(doc, requestedTabId) {
  if (requestedTabId) {
    return doc.getTab(requestedTabId).asDocumentTab();
  }

  try {
    const active = doc.getActiveTab();
    if (active) return active.asDocumentTab();
  } catch (error) {
    // Standalone/openById context can lack a user-active tab.
  }

  return doc.getTabs()[0].asDocumentTab();
}
```

Then:

```javascript
const documentTab = getWorkingDocumentTabV42_(doc);
const body = documentTab.getBody();
```

For imports, replace the old `getActiveDocText()` routing with `getActiveDocTextV42()` from
`DocumentIOV42.js`. It can return one tab or all nested tabs and does not use a hard-coded fallback document.

---

## 5. AI/framework integration

The existing AI system prompt is intentionally small and does not implement the v4.2 mode/hotkey behavior.
The supplied `frameworkV42.ts` keeps the existing JSON outline schema but adds:

- Smart / Training / Hybrid / Expert mode resolution
- partial hotkey auto-fill
- parent hotkey resolution
- last-listed conflict resolution
- unknown hotkey reporting
- P-code navigation defaults
- NAV23 vs NAV24 separation
- v4.2 no-fabrication / meaning-preservation constraints
- Smart TOC configuration for the Apps Script layer

### Recommended frontend state

Change:

```typescript
const [activePreset, setActivePreset] =
  useState<'smart' | 'expert' | 'training'>('smart');
```

to:

```typescript
const [activePreset, setActivePreset] =
  useState<'smart' | 'expert' | 'training' | 'hybrid'>('smart');

const [expertHotkeys, setExpertHotkeys] = useState('');
const [navigationScope, setNavigationScope] =
  useState<'active-tab' | 'all-tabs-central'>('active-tab');
const [reciprocalNavigation, setReciprocalNavigation] = useState(true);
const [backToTop, setBackToTop] = useState(true);
```

Before calling Gemini:

```typescript
const resolution = resolveFrameworkV42({
  input,
  mode: activePreset,
  hotkeys: expertHotkeys,
  deliverySurface: 'google-docs'
});

if (resolution.stopBeforeFormatting) {
  const recommendations = recommendHybridConfigurationsV42(input);
  // Render #1 and #2 and STOP until user selects one.
  return;
}

const modelInstruction =
  SYSTEM_PROMPT + '\n\n' + buildModelInstructionV42(resolution);
```

Pass the resolved navigation settings with the write call:

```typescript
const navOptions = {
  ...navigationOptionsForGasV42(resolution),
  scope: navigationScope,
  reciprocal: reciprocalNavigation,
  backToTop
};
```

Merge these into the existing options object sent to `writeStructuredDoc()` / `exportToNewDoc()`.

---

## 6. Replace the AI system prompt

Replace the current `src/constants/systemPrompt.ts` content with the supplied v4.2 system prompt.

The important architectural distinction is:

- Gemini decides **content structure, wording, heading hierarchy, and presentation**.
- Apps Script creates **native bookmarks, forward links, reverse links, tab-aware identities, and link verification**.

Do not ask Gemini to manufacture Google Docs bookmark URLs. Those IDs exist only after the native document
targets are created.

---

## 7. Gemini proxy hardening

Replace calls to the old backend `queryGemini()` with:

```javascript
queryGeminiV42(modelName, contents, systemInstruction)
```

or keep the old public function name as a bridge:

```javascript
function queryGemini(modelName, contents, systemInstruction) {
  return queryGeminiV42(modelName, contents, systemInstruction);
}
```

The new proxy:

- keeps the API key only in Script Properties
- sends it in the `x-goog-api-key` request header
- does not embed API keys in request URLs
- removes public hard-coded API-key fingerprints
- uses current GA fallback models
- retries only `429` and `5xx` failures
- gives a managed-domain URL-allowlist diagnostic
- requests schema-constrained JSON output

Recommended model chain in the frontend:

```typescript
const MODEL_CHAIN = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash-lite',
];
```

---

## 8. Remove automatic Drive-sharing mutation from `doGet()`

Delete the `doGet()` block that attempts to call `file.setSharing(...)`.

A web request should not silently change the sharing state of a Drive resource. Deployment access should be
configured deliberately through Apps Script deployment settings / Drive sharing, not as a side effect of page load.

Also remove the hard-coded API-key string comparisons. A missing key can be detected simply by checking whether
the Script Property exists.

---

## 9. Existing features vs v4.2 — merged target

| Area | Current app | v4.2 target |
|---|---|---|
| Gemini restructuring | Keep | Add no-fabrication/meaning-preservation contract |
| React sidebar/web app | Keep | Add Hybrid + full Expert hotkeys |
| Heading hierarchy | Keep | Enforce/diagnose non-skipping hierarchy |
| TOC forward links | Replace internals | Exact tab-aware heading targets |
| Back to Top | Keep as optional NAV23 | Never treat as NAV24 |
| Reverse heading links | New | Exact matching TOC-entry target |
| Duplicate headings | Improve | Structural occurrence-aware pair IDs |
| Document tabs | Improve | Active, nested, central, per-tab modes |
| Bookmark lifecycle | Repair | Reuse heading targets; remove only managed TOC targets |
| Validation | Upgrade | Read destinations back; 100% pair rule |
| Navigation report | New | Pair ID + forward/reverse status |
| Smart mode | Expand | S/F/R/P/NAV selection + TOC trigger |
| Training mode | Expand | Learning insight metadata |
| Hybrid mode | New | Two recommendations then stop |
| Expert mode | Expand | Binding hotkey resolution |
| Gemini API proxy | Harden | header key, retry, current models, schema JSON |
| Build process | Repair | copy every `src/gas/*.js` module |

---

## 10. Regression tests

Run the supplied Apps Script function:

```javascript
runNavigationV42RegressionTests()
```

It creates temporary documents and tests:

1. exact TOC → heading → exact TOC-entry reciprocal navigation
2. duplicate heading disambiguation
3. idempotent rebuilds with no bookmark-count growth

Expected result:

```text
failed: 0
```

Then manually validate one real multi-tab document with:

```javascript
diagnoseTOCV42()
generateAllTabsTOCV42()
```

Inspect the returned `pairs` array. Every reciprocal pair must show:

```text
forward: PASS
reverse: PASS
status: VERIFIED
contaminated: false
```

One failed reverse pair means the document is **not**
`BIDIRECTIONAL_NAVIGATION_VERIFIED`.

---

## 11. Deployment sequence

```bash
npm install
npm run build
node build-gas.js
clasp push
```

Then in Apps Script:

1. run `runNavigationV42RegressionTests`
2. verify `failed: 0`
3. open a real Doc and run `generateTOC`
4. click several TOC entries and their destination headings in both directions
5. test duplicate headings
6. test a Doc containing nested Document tabs
7. inspect `navigation.navigationStatus` returned by structured writes

Do not create a new deployment until the regression tests pass.

---

## 12. Definition of done for this app

The repair is complete when:

- repeated TOC refreshes do not create unbounded new heading bookmarks
- the TOC title is not a Heading 1
- indentation uses paragraph structure instead of literal spaces
- native headings remain native headings after reverse-linking
- every forward TOC link reaches the intended heading
- every NAV24 heading returns to its exact TOC row
- duplicate headings produce different pair IDs and destinations
- nested Document tabs are correctly identified
- internal links never point to AI/session/localhost URLs
- generated destinations can be read back and verified
- the current app’s AI, edit, import/export, history, voice, and UI features still work
- the project no longer exposes old API-key fingerprints or mutates Drive sharing from `doGet()`
- the build copies all Apps Script modules
- all regression tests pass
