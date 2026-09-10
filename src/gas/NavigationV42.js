/**
 * NavigationV42.js
 * Reliable Google Docs TOC + reciprocal navigation engine.
 *
 * Design goals:
 * - Google Docs DocumentTab-aware (including nested tabs)
 * - Exact TOC entry <-> exact heading reciprocal pairs
 * - Duplicate-heading safe identity
 * - Idempotent rebuilds: reuse existing heading bookmarks
 * - Does not delete arbitrary user bookmarks
 * - Structural paragraph indentation (no literal-space indentation)
 * - Validation by reading link destinations back with getLinkUrl()
 *
 * Apps Script runtime: V8
 */

const NAV42_CONFIG = Object.freeze({
  TOC_TITLE: 'TABLE OF CONTENTS',
  TOC_SEPARATOR: '─────────────────────────────────────',
  BACK_TO_TOP_TEXT: '▲ Back to Top',
  INDENT_POINTS: 18,
  LOCK_TIMEOUT_MS: 30000,
  MAX_TOC_SCAN_CHILDREN: 500,
  DEFAULT_MAX_DEPTH: 6,
  DEFAULT_PRESENTATION: 'P3'
});

/**
 * Explicit "Generate / Refresh TOC" entry point for a bound Google Doc.
 * This always generates a TOC, regardless of Smart Mode thresholds.
 *
 * @param {Object=} options
 * @return {Object}
 */
function generateTOCV42(options) {
  const doc = DocumentApp.getActiveDocument();
  if (!doc) {
    throw new Error('No active Google Doc found. Run this from the bound Google Doc.');
  }
  return rebuildNavigationForDocumentV42(doc, Object.assign({
    forceToc: true,
    scope: 'active-tab',
    reciprocal: true,
    backToTop: true,
    maxDepth: 6,
    presentation: 'P3'
  }, options || {}));
}

/**
 * Rebuilds one central TOC in the active tab for headings across all document tabs.
 *
 * @param {Object=} options
 * @return {Object}
 */
function generateAllTabsTOCV42(options) {
  const doc = DocumentApp.getActiveDocument();
  if (!doc) {
    throw new Error('No active Google Doc found.');
  }
  return rebuildNavigationForDocumentV42(doc, Object.assign({
    forceToc: true,
    scope: 'all-tabs-central',
    reciprocal: true,
    backToTop: false,
    includeTabPath: true,
    maxDepth: 6,
    presentation: 'P3'
  }, options || {}));
}

/**
 * Rebuilds a TOC in each Document tab independently.
 *
 * @param {Object=} options
 * @return {Object}
 */
function generatePerTabTOCV42(options) {
  const doc = DocumentApp.getActiveDocument();
  if (!doc) {
    throw new Error('No active Google Doc found.');
  }

  const tabs = nav42FlattenTabs_(doc);
  const reports = [];
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i].tab;
    reports.push(rebuildNavigationForDocumentV42(doc, Object.assign({
      forceToc: true,
      scope: 'active-tab',
      targetTabId: tab.getId(),
      reciprocal: true,
      backToTop: true,
      maxDepth: 6,
      presentation: 'P3'
    }, options || {})));
  }

  return {
    success: reports.every(r => r.success),
    mode: 'all-tabs-per-tab',
    tabsProcessed: reports.length,
    reports
  };
}

/**
 * Entry point for standalone/web-app calls against a specific Google Doc.
 *
 * @param {string} docIdOrUrl
 * @param {Object=} options
 * @return {Object}
 */
function generateTOCV42ForDocument(docIdOrUrl, options) {
  const docId = nav42ExtractDocId_(docIdOrUrl);
  if (!docId) {
    throw new Error('Invalid Google Doc ID or URL.');
  }
  const doc = DocumentApp.openById(docId);
  return rebuildNavigationForDocumentV42(doc, Object.assign({
    forceToc: true,
    scope: 'active-tab',
    reciprocal: true,
    backToTop: true,
    maxDepth: 6,
    presentation: 'P3'
  }, options || {}));
}

/**
 * Core V4.2 navigation rebuild.
 *
 * Supported scope values:
 * - active-tab
 * - all-tabs-central
 *
 * @param {GoogleAppsScript.Document.Document} doc
 * @param {Object=} options
 * @return {Object}
 */
function rebuildNavigationForDocumentV42(doc, options) {
  if (!doc) throw new Error('A Google Document object is required.');

  const cfg = nav42NormalizeOptions_(options || {});
  const lock = cfg.skipLock ? null : (LockService.getDocumentLock() || LockService.getScriptLock());
  let hasLock = false;

  try {
    if (lock) {
      hasLock = lock.tryLock(NAV42_CONFIG.LOCK_TIMEOUT_MS);
      if (!hasLock) {
        throw new Error('Document is busy. Could not acquire the navigation lock.');
      }
    }

    const allTabs = nav42FlattenTabs_(doc);
    if (allTabs.length === 0) {
      throw new Error('No Document tabs are available.');
    }

    const tocTabMeta = nav42ResolveTocTab_(doc, allTabs, cfg.targetTabId);
    const targetTabs = cfg.scope === 'all-tabs-central'
      ? allTabs
      : [tocTabMeta];

    // 1) Capture previous generated TOC targets so only OUR reverse links are cleared.
    const oldToc = nav42InspectExistingToc_(tocTabMeta.documentTab);

    // 2) Clear reverse links/back-to-top links that point into the old TOC.
    if (oldToc.exists && oldToc.bookmarkIds.length > 0) {
      // Clear links across every tab because a previous central TOC may have
      // linked headings in tabs that are not part of the new scope.
      nav42ClearGeneratedReverseLinks_(allTabs, oldToc.bookmarkIds);
      nav42RemoveGeneratedBackToTop_(allTabs, oldToc.bookmarkIds);
    }

    // 3) Remove the prior generated TOC block and its own bookmarks.
    nav42RemoveExistingToc_(tocTabMeta.documentTab, oldToc);

    // 4) Scan native headings AFTER cleanup so the TOC title never self-registers.
    const headingScan = nav42CollectHeadings_(doc, targetTabs, cfg);

    // 5) Apply Smart-mode TOC trigger unless an explicit generate forced it.
    const shouldCreateToc = nav42ShouldCreateToc_(headingScan, cfg);

    if (!shouldCreateToc) {
      return {
        success: true,
        generated: false,
        reason: 'TOC trigger not met',
        wordCount: headingScan.wordCount,
        h2Count: headingScan.h2Count,
        headingCount: headingScan.headings.length,
        navigationStatus: 'N/A',
        hierarchyValid: headingScan.hierarchyValid,
        hierarchyWarnings: headingScan.hierarchyWarnings,
        scope: cfg.scope,
        tocTabId: tocTabMeta.tab.getId()
      };
    }

    if (headingScan.headings.length === 0) {
      return {
        success: false,
        generated: false,
        reason: 'No Heading 1–6 paragraphs found in the selected scope.',
        wordCount: headingScan.wordCount,
        h2Count: headingScan.h2Count,
        headingCount: 0,
        navigationStatus: 'NAVIGATION_PARTIAL',
        scope: cfg.scope,
        tocTabId: tocTabMeta.tab.getId()
      };
    }

    // 6) Register/reuse exact heading targets.
    nav42RegisterHeadingTargets_(headingScan.headings);

    // 7) Construct TOC + per-entry targets.
    const tocBuild = nav42BuildToc_(doc, tocTabMeta, headingScan.headings, cfg);

    // 8) Bind forward and reverse halves of each exact pair.
    nav42BindPairLinks_(doc, tocBuild.pairs, cfg);

    // 9) Add generic NAV23 separately from exact NAV24.
    if (cfg.backToTop) {
      nav42AddBackToTop_(doc, targetTabs, tocBuild.tocHeaderBookmark, cfg);
    }

    // 10) Read links back and validate both directions.
    const validation = nav42ValidatePairs_(doc, tocBuild.pairs, cfg);

    if (cfg.closeDocument) doc.saveAndClose();

    return {
      success: validation.failedPairs === 0 && validation.contaminatedPairs === 0,
      generated: true,
      scope: cfg.scope,
      directionality: cfg.reciprocal ? 'bidirectional' : 'forward-only',
      navigationStatus: validation.navigationStatus,
      pairCount: tocBuild.pairs.length,
      verifiedPairs: validation.verifiedPairs,
      failedPairs: validation.failedPairs,
      contaminatedPairs: validation.contaminatedPairs,
      wordCount: headingScan.wordCount,
      h2Count: headingScan.h2Count,
      hierarchyValid: headingScan.hierarchyValid,
      hierarchyWarnings: headingScan.hierarchyWarnings,
      duplicateHeadingGroups: headingScan.duplicateHeadingGroups,
      tocTabId: tocTabMeta.tab.getId(),
      tocTabPath: tocTabMeta.path,
      pairs: validation.pairs
    };
  } catch (error) {
    console.error('[NavigationV42] ' + (error.stack || error.message));
    throw error;
  } finally {
    if (hasLock) lock.releaseLock();
  }
}

/**
 * Read-only diagnostics for the active document.
 *
 * @return {Object}
 */
function diagnoseTOCV42() {
  const doc = DocumentApp.getActiveDocument();
  if (!doc) throw new Error('No active Google Doc found.');

  const tabs = nav42FlattenTabs_(doc);
  const perTab = [];
  let totalHeadings = 0;
  let totalBookmarks = 0;

  for (let i = 0; i < tabs.length; i++) {
    const meta = tabs[i];
    const body = meta.documentTab.getBody();
    let headings = 0;
    let h2 = 0;
    let hierarchyValid = true;
    let lastLevel = 0;

    for (let c = 0; c < body.getNumChildren(); c++) {
      const child = body.getChild(c);
      if (child.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
      const p = child.asParagraph();
      const level = nav42HeadingLevel_(p.getHeading());
      const text = p.getText().trim();
      if (!text || level < 1 || level > 6 || text.toUpperCase() === NAV42_CONFIG.TOC_TITLE) continue;
      headings++;
      if (level === 2) h2++;
      if (lastLevel > 0 && level - lastLevel > 1) hierarchyValid = false;
      lastLevel = level;
    }

    const toc = nav42InspectExistingToc_(meta.documentTab);
    const bookmarks = meta.documentTab.getBookmarks().length;
    totalHeadings += headings;
    totalBookmarks += bookmarks;

    perTab.push({
      tabId: meta.tab.getId(),
      tabTitle: meta.tab.getTitle(),
      tabPath: meta.path,
      headings,
      h2,
      bookmarks,
      tocDetected: toc.exists,
      hierarchyValid
    });
  }

  return {
    documentId: doc.getId(),
    documentName: doc.getName(),
    tabCount: tabs.length,
    totalHeadings,
    totalBookmarks,
    tabs: perTab
  };
}

/* -------------------------------------------------------------------------- */
/* Options + tab traversal                                                     */
/* -------------------------------------------------------------------------- */

function nav42NormalizeOptions_(options) {
  const presentation = String(options.presentation || NAV42_CONFIG.DEFAULT_PRESENTATION).toUpperCase();
  const maxDepthRaw = Number(options.maxDepth || NAV42_CONFIG.DEFAULT_MAX_DEPTH);
  const maxDepth = Math.max(1, Math.min(6, isNaN(maxDepthRaw) ? 6 : maxDepthRaw));

  return {
    forceToc: options.forceToc === true,
    scope: options.scope === 'all-tabs-central' ? 'all-tabs-central' : 'active-tab',
    targetTabId: options.targetTabId ? String(options.targetTabId) : '',
    reciprocal: options.reciprocal !== false,
    backToTop: options.backToTop === true,
    includeTabPath: options.includeTabPath === true,
    presentation,
    maxDepth,
    reverseConflictPolicy: options.reverseConflictPolicy === 'skip' ? 'skip' : 'replace',
    skipLock: options.skipLock === true,
    closeDocument: options.closeDocument !== false
  };
}

function nav42FlattenTabs_(doc) {
  const result = [];

  function walk(tab, parentPath) {
    const title = tab.getTitle() || 'Untitled Tab';
    const path = parentPath ? parentPath + ' / ' + title : title;
    result.push({
      tab,
      documentTab: tab.asDocumentTab(),
      path
    });

    const children = tab.getChildTabs();
    for (let i = 0; i < children.length; i++) {
      walk(children[i], path);
    }
  }

  const roots = doc.getTabs();
  for (let i = 0; i < roots.length; i++) {
    walk(roots[i], '');
  }
  return result;
}

function nav42ResolveTocTab_(doc, allTabs, requestedTabId) {
  if (requestedTabId) {
    for (let i = 0; i < allTabs.length; i++) {
      if (allTabs[i].tab.getId() === requestedTabId) return allTabs[i];
    }
    throw new Error('Requested TOC tab ID was not found: ' + requestedTabId);
  }

  // getActiveTab() works in bound scripts. Standalone access falls back to first tab.
  try {
    const active = doc.getActiveTab();
    if (active) {
      for (let i = 0; i < allTabs.length; i++) {
        if (allTabs[i].tab.getId() === active.getId()) return allTabs[i];
      }
    }
  } catch (error) {
    console.warn('[NavigationV42] Active tab unavailable; using first tab.');
  }
  return allTabs[0];
}

/* -------------------------------------------------------------------------- */
/* Existing TOC cleanup                                                        */
/* -------------------------------------------------------------------------- */

function nav42InspectExistingToc_(documentTab) {
  const body = documentTab.getBody();
  const max = Math.min(body.getNumChildren(), NAV42_CONFIG.MAX_TOC_SCAN_CHILDREN);
  let start = -1;
  let end = -1;

  for (let i = 0; i < max; i++) {
    const child = body.getChild(i);
    if (child.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
    const text = child.asParagraph().getText().trim();

    if (start === -1 && text.toUpperCase() === NAV42_CONFIG.TOC_TITLE) {
      start = i;
      continue;
    }
    if (start !== -1 && text === NAV42_CONFIG.TOC_SEPARATOR) {
      end = i;
      break;
    }
  }

  if (start === -1 || end === -1 || end < start) {
    return { exists: false, start: -1, end: -1, bookmarkIds: [] };
  }

  const bookmarkIds = [];
  const bookmarks = documentTab.getBookmarks();
  for (let i = 0; i < bookmarks.length; i++) {
    try {
      const pos = bookmarks[i].getPosition();
      const top = nav42TopLevelBodyChild_(pos.getElement());
      if (!top) continue;
      const idx = body.getChildIndex(top);
      if (idx >= start && idx <= end) bookmarkIds.push(bookmarks[i].getId());
    } catch (error) {
      console.warn('[NavigationV42] Could not inspect bookmark: ' + error.message);
    }
  }

  return { exists: true, start, end, bookmarkIds };
}

function nav42ClearGeneratedReverseLinks_(tabMetas, oldTocBookmarkIds) {
  const ids = new Set(oldTocBookmarkIds);

  for (let t = 0; t < tabMetas.length; t++) {
    const body = tabMetas[t].documentTab.getBody();

    for (let i = 0; i < body.getNumChildren(); i++) {
      const child = body.getChild(i);
      if (child.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
      const p = child.asParagraph();
      const level = nav42HeadingLevel_(p.getHeading());
      if (level < 1 || level > 6 || p.getText().length === 0) continue;

      const text = p.editAsText();
      const link = text.getLinkUrl(0);
      const targetId = nav42BookmarkIdFromUrl_(link);
      if (targetId && ids.has(targetId)) {
        text.setLinkUrl(null);
      }
    }
  }
}

function nav42RemoveGeneratedBackToTop_(tabMetas, oldTocBookmarkIds) {
  const ids = new Set(oldTocBookmarkIds);

  for (let t = 0; t < tabMetas.length; t++) {
    const body = tabMetas[t].documentTab.getBody();

    for (let i = body.getNumChildren() - 1; i >= 0; i--) {
      const child = body.getChild(i);
      if (child.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
      const p = child.asParagraph();
      if (p.getText().trim() !== NAV42_CONFIG.BACK_TO_TOP_TEXT) continue;

      const text = p.editAsText();
      const link = text.getText().length ? text.getLinkUrl(0) : null;
      const targetId = nav42BookmarkIdFromUrl_(link);

      if (targetId && ids.has(targetId)) {
        body.removeChild(child);
      }
    }
  }
}

function nav42RemoveExistingToc_(documentTab, oldToc) {
  if (!oldToc.exists) return;

  // Remove only bookmarks physically anchored inside the generated TOC block.
  for (let i = 0; i < oldToc.bookmarkIds.length; i++) {
    const bookmark = documentTab.getBookmark(oldToc.bookmarkIds[i]);
    if (bookmark) bookmark.remove();
  }

  const body = documentTab.getBody();
  for (let i = oldToc.end; i >= oldToc.start; i--) {
    body.removeChild(body.getChild(i));
  }
}

/* -------------------------------------------------------------------------- */
/* Heading discovery + target registration                                    */
/* -------------------------------------------------------------------------- */

function nav42CollectHeadings_(doc, tabMetas, cfg) {
  const headings = [];
  const duplicateCount = {};
  const duplicateGroups = {};
  const hierarchyWarnings = [];
  let hierarchyValid = true;
  let wordCount = 0;
  let h2Count = 0;

  for (let t = 0; t < tabMetas.length; t++) {
    const meta = tabMetas[t];
    const body = meta.documentTab.getBody();
    wordCount += nav42WordCount_(body.getText());

    let lastLevel = 0;
    for (let i = 0; i < body.getNumChildren(); i++) {
      const child = body.getChild(i);
      if (child.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;

      const p = child.asParagraph();
      const level = nav42HeadingLevel_(p.getHeading());
      const text = p.getText().trim();

      if (!text || level < 1 || level > cfg.maxDepth) continue;
      if (text.toUpperCase() === NAV42_CONFIG.TOC_TITLE) continue;

      if (level === 2) h2Count++;
      if (lastLevel > 0 && level - lastLevel > 1) {
        hierarchyValid = false;
        hierarchyWarnings.push({
          tabId: meta.tab.getId(),
          tabPath: meta.path,
          previousLevel: lastLevel,
          currentLevel: level,
          heading: text,
          childIndex: i
        });
      }
      lastLevel = level;

      const duplicateKey = meta.tab.getId() + '|' + level + '|' + text.toLowerCase();
      duplicateCount[duplicateKey] = (duplicateCount[duplicateKey] || 0) + 1;
      const occurrence = duplicateCount[duplicateKey];

      const groupKey = level + '|' + text.toLowerCase();
      if (!duplicateGroups[groupKey]) duplicateGroups[groupKey] = [];
      duplicateGroups[groupKey].push({ tabId: meta.tab.getId(), tabPath: meta.path, childIndex: i });

      headings.push({
        docId: doc.getId(),
        tab: meta.tab,
        documentTab: meta.documentTab,
        tabId: meta.tab.getId(),
        tabPath: meta.path,
        body,
        paragraph: p,
        childIndex: i,
        text,
        level,
        occurrence,
        pairId: [
          doc.getId(),
          meta.tab.getId(),
          level,
          i,
          occurrence
        ].join(':'),
        headingBookmarkId: null
      });
    }
  }

  let duplicateHeadingGroups = 0;
  Object.keys(duplicateGroups).forEach(key => {
    if (duplicateGroups[key].length > 1) duplicateHeadingGroups++;
  });

  return {
    headings,
    wordCount,
    h2Count,
    hierarchyValid,
    hierarchyWarnings,
    duplicateHeadingGroups
  };
}

function nav42RegisterHeadingTargets_(headings) {
  const bookmarkIndexes = {};

  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];

    if (!bookmarkIndexes[h.tabId]) {
      bookmarkIndexes[h.tabId] = nav42BookmarkIndexByParagraph_(h.documentTab);
    }

    const index = bookmarkIndexes[h.tabId];
    const key = String(h.childIndex);
    let bookmarkId = index[key] || null;

    if (!bookmarkId) {
      const position = nav42ParagraphStartPosition_(h.documentTab, h.paragraph);
      const bookmark = h.documentTab.addBookmark(position);
      bookmarkId = bookmark.getId();
      index[key] = bookmarkId;
    }
    h.headingBookmarkId = bookmarkId;
  }
}

function nav42BookmarkIndexByParagraph_(documentTab) {
  const body = documentTab.getBody();
  const out = {};
  const bookmarks = documentTab.getBookmarks();

  for (let i = 0; i < bookmarks.length; i++) {
    try {
      const pos = bookmarks[i].getPosition();
      if (pos.getOffset() !== 0) continue;
      const top = nav42TopLevelBodyChild_(pos.getElement());
      if (!top || top.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
      const idx = body.getChildIndex(top);
      if (idx >= 0 && out[String(idx)] == null) {
        out[String(idx)] = bookmarks[i].getId();
      }
    } catch (error) {
      console.warn('[NavigationV42] Skipped unreadable bookmark: ' + error.message);
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* TOC construction + pair binding                                            */
/* -------------------------------------------------------------------------- */

function nav42BuildToc_(doc, tocTabMeta, headings, cfg) {
  const documentTab = tocTabMeta.documentTab;
  const body = documentTab.getBody();
  const insertionIndex = nav42TocInsertionIndex_(body);

  const tocHeader = body.insertParagraph(insertionIndex, NAV42_CONFIG.TOC_TITLE);
  tocHeader.setHeading(DocumentApp.ParagraphHeading.NORMAL);
  tocHeader.setSpacingBefore(6).setSpacingAfter(8);
  tocHeader.editAsText().setBold(true).setFontSize(16);

  const headerBookmark = documentTab.addBookmark(
    nav42ParagraphStartPosition_(documentTab, tocHeader)
  );

  const pairs = [];
  let cursor = insertionIndex + 1;

  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    const displayText = cfg.includeTabPath && cfg.scope === 'all-tabs-central'
      ? h.tabPath + ' — ' + h.text
      : h.text;

    const tocEntry = body.insertParagraph(cursor, displayText);
    tocEntry.setHeading(DocumentApp.ParagraphHeading.NORMAL);
    tocEntry.setIndentStart(Math.max(0, h.level - 1) * NAV42_CONFIG.INDENT_POINTS);
    tocEntry.setSpacingBefore(0).setSpacingAfter(0);

    const tocBookmark = documentTab.addBookmark(
      nav42ParagraphStartPosition_(documentTab, tocEntry)
    );

    pairs.push({
      pairId: h.pairId,
      headingText: h.text,
      tocDisplayText: displayText,
      level: h.level,
      occurrence: h.occurrence,
      headingTabId: h.tabId,
      headingTabPath: h.tabPath,
      headingDocumentTab: h.documentTab,
      headingParagraph: h.paragraph,
      headingBookmarkId: h.headingBookmarkId,
      tocTabId: tocTabMeta.tab.getId(),
      tocTabPath: tocTabMeta.path,
      tocDocumentTab: documentTab,
      tocParagraph: tocEntry,
      tocBookmarkId: tocBookmark.getId(),
      forwardExpectedUrl: null,
      reverseExpectedUrl: null,
      forwardActualUrl: null,
      reverseActualUrl: null,
      forwardPass: false,
      reversePass: cfg.reciprocal ? false : null,
      contaminated: false,
      reverseSkippedReason: ''
    });

    cursor++;
  }

  const separator = body.insertParagraph(cursor, NAV42_CONFIG.TOC_SEPARATOR);
  separator.setHeading(DocumentApp.ParagraphHeading.NORMAL);
  separator.setSpacingBefore(8).setSpacingAfter(8);

  return {
    tocHeader,
    tocHeaderBookmark: {
      tabId: tocTabMeta.tab.getId(),
      bookmarkId: headerBookmark.getId()
    },
    separator,
    pairs
  };
}

function nav42BindPairLinks_(doc, pairs, cfg) {
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];

    const forwardUrl = nav42BookmarkUrl_(doc, pair.headingTabId, pair.headingBookmarkId);
    const reverseUrl = nav42BookmarkUrl_(doc, pair.tocTabId, pair.tocBookmarkId);

    pair.forwardExpectedUrl = forwardUrl;
    pair.reverseExpectedUrl = reverseUrl;

    const tocText = pair.tocParagraph.editAsText();
    if (tocText.getText().length > 0) {
      tocText.setLinkUrl(0, tocText.getText().length - 1, forwardUrl);
    }

    if (!cfg.reciprocal) continue;

    const headingText = pair.headingParagraph.editAsText();
    const currentLink = headingText.getText().length ? headingText.getLinkUrl(0) : null;

    if (cfg.reverseConflictPolicy === 'skip' &&
        currentLink &&
        !nav42IsSameDocumentBookmarkUrl_(doc, currentLink)) {
      pair.reverseSkippedReason = 'Existing non-navigation heading link preserved.';
      continue;
    }

    if (headingText.getText().length > 0) {
      // Entire visible heading is the NAV24 return click target.
      // setLinkUrl() changes text attributes only; the paragraph remains a native heading.
      headingText.setLinkUrl(0, headingText.getText().length - 1, reverseUrl);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Generic NAV23 Back-to-Top                                                   */
/* -------------------------------------------------------------------------- */

function nav42AddBackToTop_(doc, tabMetas, tocHeaderBookmark, cfg) {
  if (!tocHeaderBookmark || !tocHeaderBookmark.bookmarkId) return;

  const targetUrl = nav42BookmarkUrl_(
    doc,
    tocHeaderBookmark.tabId,
    tocHeaderBookmark.bookmarkId
  );

  for (let t = 0; t < tabMetas.length; t++) {
    const body = tabMetas[t].documentTab.getBody();
    const insertionPoints = [];

    // Add one broad return link at the end of each H1/H2 section.
    // Scan first; mutate in reverse order so indexes remain valid.
    for (let i = 0; i < body.getNumChildren(); i++) {
      const child = body.getChild(i);
      if (child.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
      const level = nav42HeadingLevel_(child.asParagraph().getHeading());
      if (level !== 1 && level !== 2) continue;

      let endIndex = body.getNumChildren();
      for (let j = i + 1; j < body.getNumChildren(); j++) {
        const next = body.getChild(j);
        if (next.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
        const nextLevel = nav42HeadingLevel_(next.asParagraph().getHeading());
        if (nextLevel > 0 && nextLevel <= level) {
          endIndex = j;
          break;
        }
      }
      insertionPoints.push(endIndex);
    }

    // De-duplicate coincident insertion positions.
    const unique = Array.from(new Set(insertionPoints)).sort((a, b) => b - a);
    for (let u = 0; u < unique.length; u++) {
      const p = body.insertParagraph(unique[u], NAV42_CONFIG.BACK_TO_TOP_TEXT);
      p.setHeading(DocumentApp.ParagraphHeading.NORMAL);
      p.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
      const text = p.editAsText();
      text.setLinkUrl(0, text.getText().length - 1, targetUrl);
      text.setFontSize(10).setItalic(true).setForegroundColor('#54575b');
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

function nav42ValidatePairs_(doc, pairs, cfg) {
  let verifiedPairs = 0;
  let failedPairs = 0;
  let contaminatedPairs = 0;
  const publicPairs = [];

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];

    const tocText = pair.tocParagraph.editAsText();
    const headingText = pair.headingParagraph.editAsText();

    pair.forwardActualUrl = tocText.getText().length ? tocText.getLinkUrl(0) : null;
    pair.reverseActualUrl = cfg.reciprocal && headingText.getText().length
      ? headingText.getLinkUrl(0)
      : null;

    const headingBookmarkExists =
      !!pair.headingDocumentTab.getBookmark(pair.headingBookmarkId);
    const tocBookmarkExists =
      !!pair.tocDocumentTab.getBookmark(pair.tocBookmarkId);

    pair.forwardPass =
      headingBookmarkExists &&
      pair.forwardActualUrl === pair.forwardExpectedUrl &&
      nav42IsSameDocumentBookmarkUrl_(doc, pair.forwardActualUrl);

    if (cfg.reciprocal) {
      pair.reversePass =
        !pair.reverseSkippedReason &&
        tocBookmarkExists &&
        pair.reverseActualUrl === pair.reverseExpectedUrl &&
        nav42IsSameDocumentBookmarkUrl_(doc, pair.reverseActualUrl);
    }

    const forwardContaminated =
      !!pair.forwardActualUrl && !nav42IsSameDocumentBookmarkUrl_(doc, pair.forwardActualUrl);
    const reverseContaminated =
      cfg.reciprocal &&
      !!pair.reverseActualUrl &&
      !nav42IsSameDocumentBookmarkUrl_(doc, pair.reverseActualUrl);

    pair.contaminated = forwardContaminated || reverseContaminated;
    if (pair.contaminated) contaminatedPairs++;

    const pairVerified = cfg.reciprocal
      ? pair.forwardPass && pair.reversePass
      : pair.forwardPass;

    if (pairVerified) verifiedPairs++;
    else failedPairs++;

    publicPairs.push({
      pairId: pair.pairId,
      tocEntry: pair.tocDisplayText,
      heading: pair.headingText,
      headingLevel: pair.level,
      occurrence: pair.occurrence,
      headingTabId: pair.headingTabId,
      headingTabPath: pair.headingTabPath,
      tocTabId: pair.tocTabId,
      forwardDestination: pair.forwardActualUrl,
      reverseDestination: cfg.reciprocal ? pair.reverseActualUrl : null,
      forward: pair.forwardPass ? 'PASS' : 'FAIL',
      reverse: cfg.reciprocal ? (pair.reversePass ? 'PASS' : 'FAIL') : 'N/A',
      status: pairVerified ? 'VERIFIED' : 'FAILED',
      contaminated: pair.contaminated,
      note: pair.reverseSkippedReason || ''
    });
  }

  let navigationStatus;
  if (contaminatedPairs > 0) {
    navigationStatus = 'NAVIGATION_TARGET_CONTAMINATED';
  } else if (failedPairs > 0) {
    navigationStatus = 'NAVIGATION_PARTIAL';
  } else if (cfg.reciprocal) {
    navigationStatus = 'BIDIRECTIONAL_NAVIGATION_VERIFIED';
  } else {
    navigationStatus = 'NAVIGATION_VERIFIED';
  }

  return {
    navigationStatus,
    verifiedPairs,
    failedPairs,
    contaminatedPairs,
    pairs: publicPairs
  };
}

/* -------------------------------------------------------------------------- */
/* Smart TOC trigger + helpers                                                */
/* -------------------------------------------------------------------------- */

function nav42ShouldCreateToc_(scan, cfg) {
  if (cfg.forceToc) return true;
  if (['P2', 'P3', 'P5'].indexOf(cfg.presentation) === -1) return false;
  return scan.h2Count >= 3 || scan.wordCount > 500;
}

function nav42TocInsertionIndex_(body) {
  let index = 0;

  for (let i = 0; i < Math.min(body.getNumChildren(), 6); i++) {
    const child = body.getChild(i);
    if (child.getType() !== DocumentApp.ElementType.PARAGRAPH) break;

    const p = child.asParagraph();
    const heading = p.getHeading();
    if (heading === DocumentApp.ParagraphHeading.TITLE ||
        heading === DocumentApp.ParagraphHeading.SUBTITLE) {
      index = i + 1;
      continue;
    }

    // Permit blank spacer immediately after title/subtitle.
    if (index > 0 && p.getText().trim() === '') {
      index = i + 1;
      continue;
    }
    break;
  }
  return index;
}

function nav42ParagraphStartPosition_(documentTab, paragraph) {
  for (let i = 0; i < paragraph.getNumChildren(); i++) {
    const child = paragraph.getChild(i);
    if (child.getType() === DocumentApp.ElementType.TEXT) {
      return documentTab.newPosition(child, 0);
    }
  }
  throw new Error('Cannot create bookmark: paragraph has no Text child.');
}

function nav42TopLevelBodyChild_(element) {
  let current = element;
  while (current && typeof current.getParent === 'function') {
    const parent = current.getParent();
    if (!parent) return null;
    if (parent.getType() === DocumentApp.ElementType.BODY_SECTION) return current;
    current = parent;
  }
  return null;
}

function nav42BookmarkUrl_(doc, tabId, bookmarkId) {
  const base = String(doc.getUrl()).split('#')[0].split('?')[0];
  return base +
    '?tab=' + encodeURIComponent(tabId) +
    '#bookmark=' + encodeURIComponent(bookmarkId);
}

function nav42BookmarkIdFromUrl_(url) {
  if (!url) return null;
  const match = String(url).match(/#bookmark=([^&]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch (error) {
    return match[1];
  }
}

function nav42IsSameDocumentBookmarkUrl_(doc, url) {
  if (!url) return false;
  const base = String(doc.getUrl()).split('#')[0].split('?')[0];
  const value = String(url);
  return value.indexOf(base + '?tab=') === 0 && value.indexOf('#bookmark=') !== -1;
}

function nav42HeadingLevel_(headingType) {
  switch (headingType) {
    case DocumentApp.ParagraphHeading.HEADING1: return 1;
    case DocumentApp.ParagraphHeading.HEADING2: return 2;
    case DocumentApp.ParagraphHeading.HEADING3: return 3;
    case DocumentApp.ParagraphHeading.HEADING4: return 4;
    case DocumentApp.ParagraphHeading.HEADING5: return 5;
    case DocumentApp.ParagraphHeading.HEADING6: return 6;
    default: return 0;
  }
}

function nav42WordCount_(text) {
  const trimmed = String(text || '').trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function nav42ExtractDocId_(urlOrId) {
  const value = String(urlOrId || '').trim();
  if (!value) return null;
  const match = value.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  return /^[a-zA-Z0-9-_]{25,}$/.test(value) ? value : null;
}
