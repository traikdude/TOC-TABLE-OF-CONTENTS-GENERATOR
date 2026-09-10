/**
 * NavigationV42Tests.js
 * Destructive tests run ONLY against temporary documents created by the tests.
 *
 * Requires NavigationV42.js.
 */

/**
 * Runs core regression tests and returns a compact report.
 *
 * @return {Object}
 */
function runNavigationV42RegressionTests() {
  const tests = [
    nav42TestExactReciprocal_,
    nav42TestDuplicateHeadings_,
    nav42TestIdempotentRebuild_
  ];

  const results = [];
  for (let i = 0; i < tests.length; i++) {
    const fn = tests[i];
    try {
      results.push(fn());
    } catch (error) {
      results.push({
        name: fn.name,
        pass: false,
        error: error.message
      });
    }
  }

  return {
    passed: results.filter(r => r.pass).length,
    failed: results.filter(r => !r.pass).length,
    results
  };
}

function nav42TestExactReciprocal_() {
  return nav42WithScratchDoc_('V42 TEST - Reciprocal', function(doc, tabMeta) {
    const body = tabMeta.documentTab.getBody();
    nav42TestClearBody_(body);
    nav42TestAppendHeading_(body, 'Executive Summary', 1);
    body.appendParagraph('Summary body.');
    nav42TestAppendHeading_(body, 'Research Method', 2);
    body.appendParagraph('Research body.');
    nav42TestAppendHeading_(body, 'Results', 2);
    body.appendParagraph('Results body.');

    const result = rebuildNavigationForDocumentV42(doc, {
      forceToc: true,
      targetTabId: tabMeta.tab.getId(),
      scope: 'active-tab',
      reciprocal: true,
      backToTop: false
    });

    nav42Assert_(
      result.navigationStatus === 'BIDIRECTIONAL_NAVIGATION_VERIFIED',
      'Expected bidirectional verification; got ' + result.navigationStatus
    );
    nav42Assert_(result.pairCount === 3, 'Expected 3 reciprocal pairs.');
    nav42Assert_(result.failedPairs === 0, 'Expected zero failed pairs.');

    return {
      name: 'exact reciprocal navigation',
      pass: true,
      status: result.navigationStatus,
      pairCount: result.pairCount
    };
  });
}

function nav42TestDuplicateHeadings_() {
  return nav42WithScratchDoc_('V42 TEST - Duplicates', function(doc, tabMeta) {
    const body = tabMeta.documentTab.getBody();
    nav42TestClearBody_(body);
    nav42TestAppendHeading_(body, 'Introduction', 1);
    nav42TestAppendHeading_(body, 'Summary', 2);
    body.appendParagraph('First summary.');
    nav42TestAppendHeading_(body, 'Appendix', 2);
    nav42TestAppendHeading_(body, 'Summary', 2);
    body.appendParagraph('Second summary.');

    const result = rebuildNavigationForDocumentV42(doc, {
      forceToc: true,
      targetTabId: tabMeta.tab.getId(),
      scope: 'active-tab',
      reciprocal: true,
      backToTop: false
    });

    const summaries = result.pairs.filter(p => p.heading === 'Summary');
    nav42Assert_(summaries.length === 2, 'Expected two Summary pairs.');
    nav42Assert_(
      summaries[0].pairId !== summaries[1].pairId,
      'Duplicate headings collapsed to the same pair identity.'
    );
    nav42Assert_(
      summaries[0].forwardDestination !== summaries[1].forwardDestination,
      'Duplicate TOC entries point to the same heading target.'
    );
    nav42Assert_(
      summaries[0].reverseDestination !== summaries[1].reverseDestination,
      'Duplicate headings return to the same TOC target.'
    );

    return {
      name: 'duplicate heading disambiguation',
      pass: true,
      summaryPairIds: summaries.map(p => p.pairId)
    };
  });
}

function nav42TestIdempotentRebuild_() {
  return nav42WithScratchDoc_('V42 TEST - Idempotency', function(doc, tabMeta) {
    const body = tabMeta.documentTab.getBody();
    nav42TestClearBody_(body);
    nav42TestAppendHeading_(body, 'One', 1);
    nav42TestAppendHeading_(body, 'Two', 2);
    nav42TestAppendHeading_(body, 'Three', 2);

    const first = rebuildNavigationForDocumentV42(doc, {
      forceToc: true,
      targetTabId: tabMeta.tab.getId(),
      scope: 'active-tab',
      reciprocal: true,
      backToTop: false
    });

    const doc2 = DocumentApp.openById(doc.getId());
    const tab2 = doc2.getTab(tabMeta.tab.getId()).asDocumentTab();
    const firstBookmarkCount = tab2.getBookmarks().length;

    const second = rebuildNavigationForDocumentV42(doc2, {
      forceToc: true,
      targetTabId: tabMeta.tab.getId(),
      scope: 'active-tab',
      reciprocal: true,
      backToTop: false
    });

    const doc3 = DocumentApp.openById(doc.getId());
    const tab3 = doc3.getTab(tabMeta.tab.getId()).asDocumentTab();
    const secondBookmarkCount = tab3.getBookmarks().length;

    nav42Assert_(first.pairCount === second.pairCount, 'Pair count changed across rebuilds.');
    nav42Assert_(
      secondBookmarkCount === firstBookmarkCount,
      'Bookmark count grew across identical rebuilds: ' +
        firstBookmarkCount + ' → ' + secondBookmarkCount
    );
    nav42Assert_(
      second.navigationStatus === 'BIDIRECTIONAL_NAVIGATION_VERIFIED',
      'Second rebuild was not fully verified.'
    );

    return {
      name: 'idempotent rebuild / no bookmark growth',
      pass: true,
      pairCount: second.pairCount,
      bookmarkCount: secondBookmarkCount
    };
  });
}

function nav42WithScratchDoc_(name, testFn) {
  const doc = DocumentApp.create(name);
  const docId = doc.getId();

  try {
    const tabs = nav42FlattenTabs_(doc);
    nav42Assert_(tabs.length > 0, 'Scratch document has no tab.');
    return testFn(doc, tabs[0]);
  } finally {
    try {
      DriveApp.getFileById(docId).setTrashed(true);
    } catch (cleanupError) {
      console.warn('[NavigationV42Tests] Could not trash scratch doc ' + docId + ': ' + cleanupError.message);
    }
  }
}

function nav42TestClearBody_(body) {
  for (let i = body.getNumChildren() - 1; i > 0; i--) {
    body.removeChild(body.getChild(i));
  }
  const first = body.getChild(0);
  if (first.getType() === DocumentApp.ElementType.PARAGRAPH) {
    first.asParagraph().setText('').setHeading(DocumentApp.ParagraphHeading.NORMAL);
  }
}

function nav42TestAppendHeading_(body, text, level) {
  const p = body.appendParagraph(text);
  p.setHeading(nav42TestHeadingType_(level));
  return p;
}

function nav42TestHeadingType_(level) {
  switch (level) {
    case 1: return DocumentApp.ParagraphHeading.HEADING1;
    case 2: return DocumentApp.ParagraphHeading.HEADING2;
    case 3: return DocumentApp.ParagraphHeading.HEADING3;
    case 4: return DocumentApp.ParagraphHeading.HEADING4;
    case 5: return DocumentApp.ParagraphHeading.HEADING5;
    case 6: return DocumentApp.ParagraphHeading.HEADING6;
    default: throw new Error('Invalid test heading level: ' + level);
  }
}

function nav42Assert_(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed.');
}
