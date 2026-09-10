/**
 * Google Apps Script Backend Engine — TOC & Document Structurer 📜✨
 * Handles document parsing, outline writing, bookmark navigation, and Gemini proxying. 🛠️🔌
 */

// ─────────────────────────────────────────────
// 🌐 Web-App & Sidebar Entry Points
// ─────────────────────────────────────────────

/**
 * Serves the sidebar interface inside the active Google Doc. 🖥️🎨
 */
function showSidebar() {
  try {
    var html = HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('TOC Generator Control Panel')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setWidth(300);
    DocumentApp.getUi().showSidebar(html);
    console.log('✅ [showSidebar] Sidebar loaded successfully. 🖥️✨');
  } catch (error) {
    console.error('🚨 [showSidebar] Error loading sidebar:', error.message);
    try {
      DocumentApp.getUi().alert('Error loading sidebar: ' + error.message);
    } catch (uiErr) {
      console.warn('⚠️ [showSidebar] UI alert skipped (expected in standalone mode):', uiErr.message);
    }
  }
}

/**
 * Opens a modal launcher to expand the Web App deployment in full-screen in a new tab. 🌐🚀
 */
function openWebAppFullScreen() {
  try {
    var url = getServiceUrl();

    var html = HtmlService.createHtmlOutput(
      '<!DOCTYPE html><html><head><base target="_blank">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<style>' +
      '  * { box-sizing: border-box; }' +
      '  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; padding: 22px 20px; background: #0f172a; color: #f8fafc; margin: 0; overflow: hidden; }' +
      '  .icon { font-size: 34px; margin-bottom: 6px; }' +
      '  .title { font-size: 17px; font-weight: 800; margin-bottom: 6px; color: #60a5fa; letter-spacing: -0.02em; }' +
      '  .desc { font-size: 12px; color: #94a3b8; margin-bottom: 18px; line-height: 1.5; max-width: 380px; margin-left: auto; margin-right: auto; }' +
      '  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff !important; padding: 12px 26px; border-radius: 12px; font-weight: 700; text-decoration: none !important; font-size: 14px; box-shadow: 0 10px 15px -3px rgba(37,99,235,0.4); transition: transform 0.15s, box-shadow 0.15s; cursor: pointer; }' +
      '  .btn:hover { transform: translateY(-2px); box-shadow: 0 12px 20px -3px rgba(37,99,235,0.6); }' +
      '  .close-note { margin-top: 14px; font-size: 11px; color: #64748b; }' +
      '</style>' +
      '</head><body>' +
      '  <div class="icon">🚀</div>' +
      '  <div class="title">TOC & Document Architect v4.2</div>' +
      '  <p class="desc">Launching the verified full-screen web application in a dedicated browser window...</p>' +
      '  <a class="btn" href="' + url + '" target="_blank" onclick="setTimeout(function(){google.script.host.close();}, 1500);">🌐 Open Full-Screen Web App ↗</a>' +
      '  <p class="close-note">Click the button above if popup blocker prevented auto-opening.</p>' +
      '  <script>' +
      '    window.open("' + url + '", "_blank");' +
      '  </script>' +
      '</body></html>'
    ).setWidth(500).setHeight(270);

    DocumentApp.getUi().showModalDialog(html, '🌐 Full-Screen Web App Launcher');
  } catch (error) {
    console.error('🚨 [openWebAppFullScreen] Error:', error.message);
    DocumentApp.getUi().alert('Launcher Error', 'Error opening full-screen launcher: ' + error.message, DocumentApp.getUi().ButtonSet.OK);
  }
}

/**
 * Opens an expanded in-document modal dialog displaying the full web app. 🗖💻
 */
function showExpandedDialog() {
  try {
    var html = HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('TOC & Document Architect v4.2 (Expanded View)')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setWidth(1150)
      .setHeight(750);
    DocumentApp.getUi().showModalDialog(html, '🚀 TOC & Document Architect v4.2 (Expanded View)');
  } catch (error) {
    console.error('🚨 [showExpandedDialog] Error:', error.message);
    DocumentApp.getUi().alert('Dialog Error', 'Error opening expanded dialog: ' + error.message, DocumentApp.getUi().ButtonSet.OK);
  }
}

/**
 * Serves the standalone web application interface. 🌐💻
 */
function doGet(e) {
  console.log('🌐 [doGet] Web app entry — params:', JSON.stringify(e || {}));

  // Diagnostic authorization helper
  if (e && e.parameter && e.parameter.auth === '1') {
    try {
      UrlFetchApp.fetch('https://httpbin.org/get', { muteHttpExceptions: true });
      return HtmlService.createHtmlOutput(
        '<h2 style="color:#2563eb; font-family:sans-serif;">✅ Authorization Successful!</h2>' +
        '<p style="font-family:sans-serif; color:#374151;">UrlFetchApp is fully authorized. The app can make external API requests.</p>' +
        '<p style="font-family:sans-serif;"><a href="' + ScriptApp.getService().getUrl() + '" style="color:#2563eb; text-decoration:none; font-weight:bold;">← Back to App</a></p>'
      ).setTitle('Auth Verification — Success');
    } catch (authErr) {
      var scriptUrl = 'https://script.google.com/home/projects/' + ScriptApp.getScriptId() + '/edit';
      return HtmlService.createHtmlOutput(
        '<h2 style="color:#ef4444; font-family:sans-serif;">❌ Authorization Required</h2>' +
        '<p style="font-family:sans-serif; color:#374151;">UrlFetchApp is not authorized. Error: <code>' + authErr.message + '</code></p>' +
        '<h3 style="font-family:sans-serif; color:#1f2937;">How to resolve:</h3>' +
        '<ol style="font-family:sans-serif; color:#374151; line-height:1.6;">' +
        '<li>Open the <a href="' + scriptUrl + '" target="_blank" style="color:#2563eb; text-decoration:underline;">Apps Script Editor</a></li>' +
        '<li>Select <strong>forceAuth</strong> from the dropdown</li>' +
        '<li>Click ▶️ <strong>Run</strong></li>' +
        '<li>Accept the OAuth permissions</li>' +
        '<li>Reload this page</li>' +
        '</ol>'
      ).setTitle('Auth Verification — Failed');
    }
  }

  // Voice Popup Page Helper route
  if (e && e.parameter && e.parameter.page === 'voice') {
    try {
      return HtmlService.createHtmlOutputFromFile('voice')
        .setTitle('🎙️ Voice Dictation Helper')
        .setSandboxMode(HtmlService.SandboxMode.IFRAME)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    } catch (voiceErr) {
      console.error('🚨 [doGet] Error serving voice helper:', voiceErr.message);
      return HtmlService.createHtmlOutput('<h2>⚠️ Voice Helper Error</h2><p>' + voiceErr.message + '</p>');
    }
  }
  
  // Verify if Gemini API key is configured
  var currentKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!currentKey) {
    console.warn('🔑 [doGet] GEMINI_API_KEY script property is not configured.');
  }

  try {
    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('TOC Generator & Styler Web App')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (err) {
    console.error('🚨 [doGet] Error serving web app:', err.message);
    return HtmlService.createHtmlOutput('<h2>⚠️ Deployment Error</h2><p>' + err.message + '</p>');
  }
}

// ─────────────────────────────────────────────
// 📄 Document Read & Write Functions
// ─────────────────────────────────────────────

/**
 * Reads document text and structure using tab-aware v4.2 reader.
 * @param {string} docIdOrUrl Optional specific document ID or URL to open.
 * @param {Object=} options Optional settings like allTabs, targetTabId.
 * @returns {Object} Content, title, headings, and tab metadata.
 */
function getActiveDocText(docIdOrUrl, options) {
  return getActiveDocTextV42(docIdOrUrl, options);
}


/**
 * Extracts Google Doc ID from a URL or raw ID string.
 */
function extractDocId(urlOrId) {
  if (!urlOrId) return null;
  urlOrId = urlOrId.trim();
  // Regex to match doc ID from URL
  var match = urlOrId.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  // If no URL format, check if it looks like a clean ID
  if (/^[a-zA-Z0-9-_]{25,}$/.test(urlOrId)) {
    return urlOrId;
  }
  return null;
}

/**
 * Re-formats and writes the structured section hierarchy back to the active Google Doc. 🧠🛡️
 * Adds internal bookmarks, builds the TOC, and injects "Back to Top" links. 🔝⛓️
 * @param {Array} sections Array of section objects: [{ title, level, content, color, labels }]
 * @param {Object} options Styling and layout combination options.
 * @returns {Object} Status results and URL pointer.
 */
function writeStructuredDoc(sections, options) {
  console.log('🧠 [writeStructuredDoc] Writing outline back to Doc. 🧠✨');
  sections = sections || [];
  options = options || {};
  
  var doc = null;
  try {
    doc = DocumentApp.getActiveDocument();
  } catch (err) {
    console.warn('⚠️ [writeStructuredDoc] Active document not accessible:', err.message);
  }
  
  // If running standalone without container doc, automatically redirect to new document export
  if (!doc) {
    console.log('💡 [writeStructuredDoc] Standalone mode: Redirecting to create a new document.');
    return exportToNewDoc(sections, 'TOC Outline - Auto Generated', options);
  }
  
  var lock = LockService.getDocumentLock() || LockService.getScriptLock();
  var hasLock = false;
  
  try {
    hasLock = lock.tryLock(30000); // Thread-safe lock. 🔒🔑
    if (!hasLock) {
      throw new Error('Lock acquisition timeout: Document is currently being edited. ⏳🚨');
    }
    
    var navReport = writeSectionsToDoc(doc, sections, options);
    
    return {
      success: !!(navReport && navReport.success),
      url: 'https://docs.google.com/document/d/' + doc.getId() + '/edit',
      count: sections.length,
      navigation: navReport
    };
    
  } catch (err) {
    console.error('🚨 [writeStructuredDoc] Error writing:', err.message);
    return { error: err.message };
  } finally {
    if (hasLock) {
      lock.releaseLock();
    }
  }
}

/**
 * Creates a new Google Doc inside the specified folder and writes the structured content to it. 📂📄
 * Folder URL: https://drive.google.com/drive/folders/1Ivm9x5foCn6athVRA-9xB3FugIjTEjS6
 * @param {Array} sections Outline sections.
 * @param {string} title Document title.
 * @param {Object} options Options.
 * @returns {Object} Success flag and URL.
 */
function exportToNewDoc(sections, title, options) {
  console.log('📂 [exportToNewDoc] Exporting outline to new Google Doc. 📂✨');
  sections = sections || [];
  options = options || {};
  
  var lock = LockService.getDocumentLock() || LockService.getScriptLock();
  var hasLock = false;
  
  try {
    hasLock = lock.tryLock(30000);
    if (!hasLock) {
      throw new Error('Lock acquisition timeout: Document lock is currently busy.');
    }
    
    // 1. Create a new Google Doc
    var doc = DocumentApp.create(title || 'Structured Outline');
    var docId = doc.getId();
    var docUrl = 'https://docs.google.com/document/d/' + docId + '/edit';
    
    // 2. Locate the target folder in Google Drive
    var folderId = '1Ivm9x5foCn6athVRA-9xB3FugIjTEjS6';
    try {
      var folder = DriveApp.getFolderById(folderId);
      var file = DriveApp.getFileById(docId);
      
      // Add file to target folder
      folder.addFile(file);
      // Remove file from root folder
      DriveApp.getRootFolder().removeFile(file);
      console.log('📂 [exportToNewDoc] Moved file to folder: ' + folderId + ' 📂✨');
    } catch (driveErr) {
      console.error('⚠️ [exportToNewDoc] Drive movement error:', driveErr.message);
    }
    
    // 3. Write structured contents to the new document
    var navReport = writeSectionsToDoc(doc, sections, options);
    
    return {
      success: !!(navReport && navReport.success),
      url: docUrl,
      count: sections.length,
      navigation: navReport
    };
    
  } catch (err) {
    console.error('🚨 [exportToNewDoc] Error:', err.message);
    return { error: err.message };
  } finally {
    if (hasLock) {
      lock.releaseLock();
    }
  }
}

/**
 * Core helper that clears and writes sections to any document.
 */
function writeSectionsToDoc(doc, sections, options) {
  var body = doc.getBody();
  
  // Clear the document body content safely without throwing "Can't remove last paragraph" exception
  var numChildren = body.getNumChildren();
  for (var c = numChildren - 1; c > 0; c--) {
    body.removeChild(body.getChild(c));
  }
  var firstChild = body.getChild(0);
  var tempPara;
  if (firstChild.getType() === DocumentApp.ElementType.PARAGRAPH) {
    tempPara = firstChild.asParagraph();
    tempPara.setText('');
  } else {
    tempPara = body.insertParagraph(0, '');
    body.removeChild(firstChild);
  }
  tempPara.setHeading(DocumentApp.ParagraphHeading.NORMAL);
  
  var headingsMeta = [];
  var docUrl = 'https://docs.google.com/document/d/' + doc.getId() + '/edit';
  
  // Step 1: Insert Table of Contents Placeholder at the top
  var tocHeader = body.appendParagraph('TABLE OF CONTENTS');
  tocHeader.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  tocHeader.editAsText().setBold(true);
  
  var tocTopPosition = doc.newPosition(tocHeader, 0);
  var tocTopBookmark = doc.addBookmark(tocTopPosition);
  var tocTopBookmarkId = tocTopBookmark ? tocTopBookmark.getId() : null;
  
  // Create an empty body paragraph separator
  var separatorPara = body.appendParagraph('─────────────────────────────────────');
  separatorPara.setHeading(DocumentApp.ParagraphHeading.NORMAL);
  
  // Step 2: Loop and write outline sections
  var sectionCounters = [0, 0, 0, 0, 0, 0]; // Track nested section numbers
  
  for (var s = 0; s < sections.length; s++) {
    var sec = sections[s];
    var level = parseInt(sec.level || 0);
    var titleText = (sec.title || '').trim();
    var contentText = (sec.content || '').trim();
    
    if (!titleText && !contentText) continue;
    
    // Ensure titleText is not empty if it is being written as a heading or paragraph
    if (!titleText && contentText) {
      titleText = '(Untitled Section)';
    }
    
    var headingPara = null;
    if (level >= 1 && level <= 6) {
      // Apply professional section numbering if requested
      if (options.applyNumbering) {
        sectionCounters[level - 1]++;
        for (var cl = level; cl < 6; cl++) {
          sectionCounters[cl] = 0; // Reset deeper levels
        }
        var numberingStr = sectionCounters.slice(0, level).join('.') + '. ';
        titleText = numberingStr + titleText;
      }
      
      // Append section heading paragraph
      headingPara = body.appendParagraph(titleText);
      var headingType = getHeadingTypeFromLevel(level);
      headingPara.setHeading(headingType);
      
      // Strip any external links on headings
      headingPara.editAsText().setLinkUrl(null);
      
      // Insert bookmark anchor on the heading paragraph
      var headingPos = doc.newPosition(headingPara, 0);
      var headingBookmark = doc.addBookmark(headingPos);
      var bookmarkId = headingBookmark ? headingBookmark.getId() : null;
      
      if (bookmarkId) {
        headingsMeta.push({
          text: titleText,
          level: level,
          bookmarkId: bookmarkId
        });
      }
    } else if (titleText) {
      var normalTitle = body.appendParagraph(titleText);
      normalTitle.setHeading(DocumentApp.ParagraphHeading.NORMAL);
      normalTitle.editAsText().setBold(true);
    }
    
    // Write section body text (markdown-like parsing)
    if (contentText) {
      var lines = contentText.split('\n');
      for (var l = 0; l < lines.length; l++) {
        var line = lines[l].trim();
        if (!line) continue;
        
        var bodyPara = null;
        // Checklist item
        if (line.indexOf('☐ ') === 0 || line.indexOf('[ ] ') === 0) {
          var itemText = line.substring(line.indexOf(' ') + 1);
          bodyPara = body.appendListItem(itemText);
          bodyPara.setGlyphType(DocumentApp.GlyphType.SQUARE_BULLET);
        } 
        // Bullet point
        else if (line.indexOf('- ') === 0 || line.indexOf('* ') === 0) {
          var bulletText = line.substring(2);
          bodyPara = body.appendListItem(bulletText);
          bodyPara.setGlyphType(DocumentApp.GlyphType.BULLET);
        } 
        // Numbered point
        else if (/^\d+[\.\)]\s/.test(line)) {
          var numText = line.replace(/^\d+[\.\)]\s/, '');
          bodyPara = body.appendListItem(numText);
          bodyPara.setGlyphType(DocumentApp.GlyphType.NUMBERED);
        } 
        // Normal paragraph
        else {
          bodyPara = body.appendParagraph(line);
          bodyPara.setHeading(DocumentApp.ParagraphHeading.NORMAL);
        }
        
        // Basic inline markdown bold parser **text**
        if (bodyPara) {
          parseAndApplyFormatting(bodyPara);
        }
      }
    }
    
    // Step 3: Insert "Back to Top" links right-aligned after H1/H2 sections
    if (level === 1 || level === 2) {
      if (tocTopBookmarkId) {
        var backToTop = body.appendParagraph('▲ Back to Top');
        backToTop.setHeading(DocumentApp.ParagraphHeading.NORMAL);
        backToTop.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
        backToTop.editAsText().setLinkUrl(0, 12, docUrl + '#bookmark=' + tocTopBookmarkId);
        backToTop.editAsText().setFontSize(10).setItalic(true).setForegroundColor('#54575b');
      }
    }
  }
  
  // Clear the initial empty paragraph that was used to keep body alive if still present
  if (tempPara.getText() === '' && body.getNumChildren() > 2) {
    body.removeChild(tempPara);
  }
  
  // Step 4: Write Table of Contents items linking to bookmarks
  if (headingsMeta.length > 0) {
    var tocIndex = body.getChildIndex(separatorPara);
    for (var h = 0; h < headingsMeta.length; h++) {
      var meta = headingsMeta[h];
      var indent = '';
      for (var k = 1; k < meta.level; k++) {
        indent += '    ';
      }
      var entryLine = indent + meta.text;
      var tocEntry = body.insertParagraph(tocIndex, entryLine);
      tocEntry.setHeading(DocumentApp.ParagraphHeading.NORMAL);
      
      var linkUrl = docUrl + '#bookmark=' + meta.bookmarkId;
      if (entryLine.length > 0) {
        tocEntry.editAsText().setLinkUrl(0, entryLine.length - 1, linkUrl);
      }
      tocIndex++;
    }
  }
  
  // Append a final Back to Top link at the very end of the document
  if (tocTopBookmarkId) {
    var finalBackToTop = body.appendParagraph('▲ Back to Top');
    finalBackToTop.setHeading(DocumentApp.ParagraphHeading.NORMAL);
    finalBackToTop.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
    finalBackToTop.editAsText().setLinkUrl(0, 12, docUrl + '#bookmark=' + tocTopBookmarkId);
    finalBackToTop.editAsText().setFontSize(10).setItalic(true).setForegroundColor('#54575b');
  }

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
}

/**
 * Scans the active document and builds an exact, tab-aware reciprocal Table of Contents. 📜⛓️
 * @returns {string} Status message.
 */
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

/**
 * Automatically removes any previously generated TOC structure.
 */
function removeTOCSection(body) {
  var numChildren = body.getNumChildren();
  var startIndex = -1;
  var endIndex = -1;
  
  for (var i = 0; i < numChildren; i++) {
    var child = body.getChild(i);
    if (child.getType() === DocumentApp.ElementType.PARAGRAPH) {
      var text = child.asParagraph().getText().trim();
      if (text.toUpperCase() === 'TABLE OF CONTENTS') {
        startIndex = i;
      } else if (text === '─────────────────────────────────────' && startIndex !== -1) {
        endIndex = i;
        break;
      }
    }
  }
  
  if (startIndex !== -1 && endIndex !== -1) {
    for (var j = endIndex; j >= startIndex; j--) {
      body.removeChild(body.getChild(j));
    }
  }
}

// ─────────────────────────────────────────────
// 🧠 Gemini API Proxy
// ─────────────────────────────────────────────

/**
 * Server-side proxy for calling the Gemini API to bypass CORS, delegating to hardened GeminiProxyV42. 🧠🔌
 */
function queryGemini(modelName, contents, systemInstruction) {
  return queryGeminiV42(modelName, contents, systemInstruction);
}

/**
 * Tab-aware working DocumentTab resolver.
 * @param {GoogleAppsScript.Document.Document} doc
 * @param {string=} requestedTabId
 * @returns {GoogleAppsScript.Document.DocumentTab}
 */
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


// ─────────────────────────────────────────────
// 🛠️ Helper Functions
// ─────────────────────────────────────────────

function getLevelFromHeadingType(type) {
  var hp = DocumentApp.ParagraphHeading;
  if (type === hp.HEADING1) return 1;
  if (type === hp.HEADING2) return 2;
  if (type === hp.HEADING3) return 3;
  if (type === hp.HEADING4) return 4;
  if (type === hp.HEADING5) return 5;
  if (type === hp.HEADING6) return 6;
  return 0;
}

function getHeadingTypeFromLevel(level) {
  var hp = DocumentApp.ParagraphHeading;
  if (level === 1) return hp.HEADING1;
  if (level === 2) return hp.HEADING2;
  if (level === 3) return hp.HEADING3;
  if (level === 4) return hp.HEADING4;
  if (level === 5) return hp.HEADING5;
  if (level === 6) return hp.HEADING6;
  return hp.NORMAL;
}

function parseAndApplyFormatting(paragraph) {
  var text = paragraph.getText();
  var index = 0;
  
  // Basic double-asterisk bold parser **text**
  while (true) {
    var start = text.indexOf('**', index);
    if (start === -1) break;
    var end = text.indexOf('**', start + 2);
    if (end === -1) break;
    
    // Check if deleting the asterisks would leave the text completely empty
    if (text.length <= 4 && start === 0 && end === text.length - 2) {
      paragraph.setText(' ');
      break;
    }
    
    // Remove the asterisks and set bold
    paragraph.editAsText().deleteText(end, end + 1);
    paragraph.editAsText().deleteText(start, start + 1);
    
    // Adjust indices after deletion
    var boldStart = start;
    var boldEnd = end - 3;
    if (boldEnd >= boldStart) {
      paragraph.editAsText().setBold(boldStart, boldEnd, true);
    }
    
    text = paragraph.getText();
    index = boldEnd + 1;
  }
}

/**
 * Triggers authorization consent dialogs.
 */
function forceAuth() {
  console.log('🔑 [forceAuth] Entry points diagnostic execution initiated. 🔑✨');
  try {
    DocumentApp.getActiveDocument();
    DriveApp.getRootFolder();
    UrlFetchApp.fetch('https://generativelanguage.googleapis.com', { muteHttpExceptions: true });
    console.log('✅ [forceAuth] All services successfully executed without authorization errors. 🎉');
  } catch (err) {
    console.warn('⚠️ [forceAuth] Diagnostic warning (expected if no key/endpoints):', err.message);
  }
}

/**
 * Naked execution function to bypass the try-catch block and force the Google Apps Script IDE 
 * to display the "Review Permissions" authorization prompt for DriveApp and UrlFetchApp.
 * Select this function from the dropdown in the script editor and click "Run". 🔌⚡
 */
function forceAuthorizeNaked() {
  console.log('🔌 [forceAuthorizeNaked] Triggering naked service calls to force OAuth consent... 🔌✨');
  var doc = DocumentApp.getActiveDocument();
  var folder = DriveApp.getRootFolder();
  var response = UrlFetchApp.fetch('https://generativelanguage.googleapis.com', { muteHttpExceptions: true });
  console.log('✅ [forceAuthorizeNaked] Success! Response Code:', response.getResponseCode());
}

/**
 * Menu action: Generates exact reciprocal Table of Contents for the active tab with full user alert. 📜✨
 */
function menuGenerateActiveTabTOC() {
  try {
    var report = generateTOCV42({
      forceToc: true,
      scope: 'active-tab',
      reciprocal: true,
      backToTop: true,
      maxDepth: 6,
      presentation: 'P3'
    });

    var ui = DocumentApp.getUi();
    var statusEmoji = report.success ? '✅' : '⚠️';
    var msg = statusEmoji + ' Reciprocal Table of Contents (v4.2) Report:\n\n' +
      '• Navigation Status: ' + report.navigationStatus + '\n' +
      '• Reciprocal Pairs: ' + (report.pairCount || 0) + ' (Verified: ' + (report.verifiedPairs || 0) + ')\n' +
      '• Headings Linked: ' + (report.h2Count ? report.h2Count + ' headings' : (report.pairCount || 0)) + '\n' +
      '• Scope: Active Tab\n' +
      '• Directionality: Exact Bidirectional (NAV24) + Back to Top (NAV23)\n\n' +
      (report.hierarchyWarnings && report.hierarchyWarnings.length > 0
        ? '⚠️ Hierarchy Notes:\n' + report.hierarchyWarnings.join('\n') + '\n\n'
        : '') +
      '🎉 Exact bidirectional navigation established!';
    ui.alert('TOC v4.2 Generation Complete', msg, ui.ButtonSet.OK);
  } catch (err) {
    DocumentApp.getUi().alert('TOC Generation Error', '🚨 Error: ' + err.message, DocumentApp.getUi().ButtonSet.OK);
  }
}

/**
 * Menu action: Generates a central Table of Contents spanning all Document tabs. 📑🌐
 */
function menuGenerateAllTabsTOC() {
  try {
    var report = generateAllTabsTOCV42();
    var ui = DocumentApp.getUi();
    var statusEmoji = report.success ? '✅' : '⚠️';
    var msg = statusEmoji + ' Central Table of Contents (All Tabs) Report:\n\n' +
      '• Navigation Status: ' + report.navigationStatus + '\n' +
      '• Reciprocal Pairs: ' + (report.pairCount || 0) + ' (Verified: ' + (report.verifiedPairs || 0) + ')\n' +
      '• Scope: All Document Tabs (Central TOC)\n' +
      '• Directionality: Exact Cross-Tab Reciprocal (NAV24)\n\n' +
      (report.duplicateHeadingGroups && report.duplicateHeadingGroups.length > 0
        ? 'ℹ️ Disambiguated duplicate headings across tabs: ' + report.duplicateHeadingGroups.length + ' group(s)\n\n'
        : '') +
      '🎉 Central document navigation complete across all tabs!';
    ui.alert('Central TOC (All Tabs) Complete', msg, ui.ButtonSet.OK);
  } catch (err) {
    DocumentApp.getUi().alert('Central TOC Error', '🚨 Error: ' + err.message, DocumentApp.getUi().ButtonSet.OK);
  }
}

/**
 * Menu action: Generates independent Table of Contents inside each Document tab. 📚📑
 */
function menuGeneratePerTabTOC() {
  try {
    var report = generatePerTabTOCV42();
    var ui = DocumentApp.getUi();
    var statusEmoji = report.success ? '✅' : '⚠️';
    var msg = statusEmoji + ' Multi-Tab TOC Generation Report:\n\n' +
      '• Tabs Processed: ' + report.tabsProcessed + '\n' +
      '• Mode: Independent TOC per Document Tab\n' +
      '• Status: ' + (report.success ? 'All tabs successfully verified' : 'Completed with partial notes') + '\n\n' +
      '🎉 Each tab now has its own reciprocal Table of Contents!';
    ui.alert('Per-Tab TOC Complete', msg, ui.ButtonSet.OK);
  } catch (err) {
    DocumentApp.getUi().alert('Per-Tab TOC Error', '🚨 Error: ' + err.message, DocumentApp.getUi().ButtonSet.OK);
  }
}

/**
 * Menu action: Safely cleans and removes the existing Table of Contents and reverse bookmarks. 🧹🗑️
 */
function menuRemoveTOC() {
  try {
    var ui = DocumentApp.getUi();
    var resp = ui.alert(
      'Remove Table of Contents',
      'Are you sure you want to remove the Table of Contents and all reverse navigation bookmarks?',
      ui.ButtonSet.YES_NO
    );
    if (resp !== ui.Button.YES) return;

    var doc = DocumentApp.getActiveDocument();
    var tabs = nav42FlattenTabs_(doc);
    var removedCount = 0;

    for (var i = 0; i < tabs.length; i++) {
      var tabMeta = tabs[i];
      var oldToc = nav42InspectExistingToc_(tabMeta.documentTab);
      if (oldToc.exists && oldToc.bookmarkIds.length > 0) {
        nav42ClearGeneratedReverseLinks_(tabs, oldToc.bookmarkIds);
        nav42RemoveGeneratedBackToTop_(tabs, oldToc.bookmarkIds);
        nav42RemoveExistingToc_(tabMeta.documentTab, oldToc);
        removedCount++;
      }
    }

    ui.alert('TOC Removed', '🧹 Table of Contents and navigation bookmarks removed cleanly (' + removedCount + ' tab(s) cleaned).', ui.ButtonSet.OK);
  } catch (err) {
    DocumentApp.getUi().alert('Remove Error', '🚨 Error: ' + err.message, DocumentApp.getUi().ButtonSet.OK);
  }
}

/**
 * Menu action: Auto-formats active document structure and generates reciprocal TOC. 🤖✨
 */
function menuAutoFormatAndBuildTOC() {
  try {
    var ui = DocumentApp.getUi();
    var doc = DocumentApp.getActiveDocument();
    if (!doc) throw new Error('No active Google Document found.');

    var body = doc.getBody();
    var text = body.getText().trim();
    if (!text) {
      ui.alert('Empty Document', 'The document has no text content to format. Please add text first.', ui.ButtonSet.OK);
      return;
    }

    var confirmResp = ui.alert(
      '🤖 Format Document & Build Reciprocal TOC (v4.2)',
      'This action will scan your document structure, verify heading hierarchy, and generate an exact reciprocal Table of Contents (NAV24).\n\nWould you like to proceed?',
      ui.ButtonSet.YES_NO
    );
    if (confirmResp !== ui.Button.YES) return;

    var report = generateTOCV42({
      forceToc: true,
      scope: 'active-tab',
      reciprocal: true,
      backToTop: true,
      maxDepth: 6,
      presentation: 'P3'
    });

    var msg = '🎉 v4.2 Document Navigation Established!\n\n' +
      '• Navigation Status: ' + report.navigationStatus + '\n' +
      '• Reciprocal Pairs: ' + (report.pairCount || 0) + ' verified\n' +
      '• Headings Linked: ' + (report.verifiedPairs || 0) + '\n' +
      '• Exact Reciprocal Linking: NAV24 active\n' +
      '• Generic Back to Top: NAV23 active\n\n' +
      'Every heading now links directly back to its exact TOC entry!';
    ui.alert('v4.2 Architecture Applied', msg, ui.ButtonSet.OK);
  } catch (err) {
    DocumentApp.getUi().alert('Format Error', '🚨 Error: ' + err.message, DocumentApp.getUi().ButtonSet.OK);
  }
}

/**
 * Creates a custom menu in the Google Doc when opened. 🛠️✨
 */
function onOpen() {
  try {
    DocumentApp.getUi().createMenu('📜 TOC & Document Architect v4.2')
      .addItem('🌐 Launch Full-Screen Web App (New Tab) ↗', 'openWebAppFullScreen')
      .addItem('🗖 Open Expanded App Dialog (In-Doc)', 'showExpandedDialog')
      .addItem('🖥️ Open Sidebar Panel', 'showSidebar')
      .addSeparator()
      .addItem('🔄 Generate Reciprocal TOC (Active Tab)', 'menuGenerateActiveTabTOC')
      .addItem('📑 Generate Central TOC (All Document Tabs)', 'menuGenerateAllTabsTOC')
      .addItem('📚 Generate TOC in Every Tab (Per-Tab)', 'menuGeneratePerTabTOC')
      .addItem('🧹 Remove Existing TOC', 'menuRemoveTOC')
      .addSeparator()
      .addItem('🤖 Auto-Format Document & Build TOC (v4.2)', 'menuAutoFormatAndBuildTOC')
      .addItem('🔍 Diagnose Navigation & Heading Structure', 'diagnoseTOCV42')
      .addItem('🧪 Run v4.2 Navigation Regression Tests', 'runNavigationV42RegressionTests')
      .addSeparator()
      .addItem('🔑 Authorize Services (Diagnostic)', 'forceAuth')
      .addItem('🔌 Force Authorization Prompt (naked)', 'forceAuthorizeNaked')
      .addToUi();
    console.log('✅ [onOpen] Custom menu created successfully. 📜✨');
  } catch (error) {
    console.error('🚨 [onOpen] Error creating menu:', error.message);
  }
}


/**
 * Canonical verified production Web App deployment ID (v16).
 */
var CANONICAL_WEBAPP_DEPLOYMENT_ID = 'AKfycbxIuWySjvgSgZdVOSXf0_4suf3Klz00xVup-_0_nfYdc8idL7Ba6zR1P3767QoGonhC';

/**
 * Returns the web app service URL, prioritizing the active verified deployment ID. 🔌💻
 */
function getServiceUrl() {
  console.log('🔌 [getServiceUrl] Fetching service URL. 🔌✨');
  try {
    var customId = PropertiesService.getScriptProperties().getProperty('WEBAPP_DEPLOYMENT_ID');
    if (customId && customId.trim()) {
      return 'https://script.google.com/macros/s/' + customId.trim() + '/exec';
    }

    if (CANONICAL_WEBAPP_DEPLOYMENT_ID) {
      return 'https://script.google.com/macros/s/' + CANONICAL_WEBAPP_DEPLOYMENT_ID + '/exec';
    }

    var serviceUrl = ScriptApp.getService().getUrl();
    if (serviceUrl && serviceUrl.indexOf('macros/s/') !== -1) {
      return serviceUrl;
    }
  } catch (err) {
    console.error('🚨 [getServiceUrl] Error:', err.message);
  }

  return 'https://script.google.com/macros/s/' + CANONICAL_WEBAPP_DEPLOYMENT_ID + '/exec';
}

/**
 * Saves a new Gemini API key to Script Properties securely. 🔑💾
 */
function setGeminiApiKey(key) {
  console.log('🔑 [setGeminiApiKey] Updating API key.');
  if (key && key.trim().indexOf('AIzaSy') === 0) {
    PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', key.trim());
    return { success: true };
  }
  return { error: 'Invalid API key format. Must start with AIzaSy. 🛑' };
}

/**
 * Checks if the Gemini API key is configured. 🔑🔍
 */
function isApiKeyConfigured() {
  var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  return !!key && key.length > 10;
}
