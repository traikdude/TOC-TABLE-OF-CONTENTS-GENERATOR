/**
 * DocumentIOV42.js
 * Tab-aware Google Docs read helpers for the TOC app.
 *
 * Requires NavigationV42.js for nav42FlattenTabs_(), nav42ExtractDocId_(),
 * and nav42HeadingLevel_().
 */

/**
 * Reads one selected Document tab by default, or every tab when allTabs=true.
 * Does not fall back to a hard-coded document ID.
 *
 * @param {string=} docIdOrUrl
 * @param {Object=} options
 * @return {Object}
 */
function getActiveDocTextV42(docIdOrUrl, options) {
  const cfg = options || {};
  let doc = null;

  if (docIdOrUrl && String(docIdOrUrl).trim()) {
    const id = nav42ExtractDocId_(docIdOrUrl);
    if (!id) return { error: 'Invalid Google Doc URL or ID format.' };

    try {
      doc = DocumentApp.openById(id);
    } catch (error) {
      return { error: 'Could not open the requested Google Doc: ' + error.message };
    }
  } else {
    try {
      doc = DocumentApp.getActiveDocument();
    } catch (error) {
      doc = null;
    }
  }

  if (!doc) {
    return {
      text: '',
      title: 'No document selected',
      headings: [],
      tabs: [],
      url: '',
      warning: 'Paste a Google Doc URL/ID or run the sidebar from a bound Google Doc.'
    };
  }

  const tabs = nav42FlattenTabs_(doc);
  if (tabs.length === 0) {
    return { error: 'The document contains no readable Document tabs.' };
  }

  if (cfg.allTabs === true) {
    return nav42ReadAllTabs_(doc, tabs);
  }

  const selected = nav42SelectReadTab_(doc, tabs, cfg.targetTabId);
  return nav42ReadOneTab_(doc, selected, tabs);
}

/**
 * Lists available tab IDs/paths without returning full document text.
 *
 * @param {string=} docIdOrUrl
 * @return {Object}
 */
function listDocumentTabsV42(docIdOrUrl) {
  const id = nav42ExtractDocId_(docIdOrUrl);
  let doc;

  if (id) {
    doc = DocumentApp.openById(id);
  } else {
    doc = DocumentApp.getActiveDocument();
  }

  if (!doc) throw new Error('No Google Doc is available.');

  const tabs = nav42FlattenTabs_(doc);
  return {
    documentId: doc.getId(),
    title: doc.getName(),
    tabs: tabs.map(meta => ({
      id: meta.tab.getId(),
      title: meta.tab.getTitle(),
      path: meta.path
    }))
  };
}

function nav42ReadAllTabs_(doc, tabs) {
  const headings = [];
  const textParts = [];
  let totalWords = 0;

  for (let t = 0; t < tabs.length; t++) {
    const meta = tabs[t];
    const body = meta.documentTab.getBody();
    const bodyText = body.getText();

    textParts.push('=== DOCUMENT TAB: ' + meta.path + ' ===');
    textParts.push(bodyText);
    totalWords += nav42WordCount_(bodyText);

    const tabHeadings = nav42ReadHeadings_(meta);
    for (let h = 0; h < tabHeadings.length; h++) headings.push(tabHeadings[h]);
  }

  return {
    title: doc.getName(),
    text: textParts.join('\n\n'),
    headings,
    tabs: tabs.map(meta => ({
      id: meta.tab.getId(),
      title: meta.tab.getTitle(),
      path: meta.path
    })),
    allTabs: true,
    wordCount: totalWords,
    url: doc.getUrl()
  };
}

function nav42ReadOneTab_(doc, selected, allTabs) {
  const body = selected.documentTab.getBody();
  const text = body.getText();

  return {
    title: doc.getName(),
    text,
    headings: nav42ReadHeadings_(selected),
    tabs: allTabs.map(meta => ({
      id: meta.tab.getId(),
      title: meta.tab.getTitle(),
      path: meta.path
    })),
    selectedTabId: selected.tab.getId(),
    selectedTabTitle: selected.tab.getTitle(),
    selectedTabPath: selected.path,
    allTabs: false,
    wordCount: nav42WordCount_(text),
    url: doc.getUrl()
  };
}

function nav42ReadHeadings_(meta) {
  const body = meta.documentTab.getBody();
  const headings = [];

  for (let i = 0; i < body.getNumChildren(); i++) {
    const child = body.getChild(i);
    if (child.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;

    const p = child.asParagraph();
    const level = nav42HeadingLevel_(p.getHeading());
    const text = p.getText().trim();

    if (level < 1 || level > 6 || !text ||
        text.toUpperCase() === NAV42_CONFIG.TOC_TITLE) {
      continue;
    }

    headings.push({
      text,
      level,
      childIndex: i,
      tabId: meta.tab.getId(),
      tabTitle: meta.tab.getTitle(),
      tabPath: meta.path
    });
  }

  return headings;
}

function nav42SelectReadTab_(doc, tabs, requestedTabId) {
  if (requestedTabId) {
    for (let i = 0; i < tabs.length; i++) {
      if (tabs[i].tab.getId() === String(requestedTabId)) return tabs[i];
    }
    throw new Error('Requested document tab was not found: ' + requestedTabId);
  }

  try {
    const active = doc.getActiveTab();
    if (active) {
      for (let i = 0; i < tabs.length; i++) {
        if (tabs[i].tab.getId() === active.getId()) return tabs[i];
      }
    }
  } catch (error) {}

  return tabs[0];
}
