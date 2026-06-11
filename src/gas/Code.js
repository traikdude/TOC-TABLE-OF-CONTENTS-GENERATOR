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
    DocumentApp.getUi().alert('Error loading sidebar: ' + error.message);
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
  
  // Auto-initialize the script property with the active Gemini key if it is not set
  var currentKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  var targetKey = 'AIzaSyCRpIL-o5PTPzkDetXmh1HPZTFnl1H3U3c';
  if (!currentKey || currentKey === 'AIzaSyD_vJWvMEYj2EqCTew5NBP9vkTmoJNNDyQ' || currentKey === 'AIzaSyANsx2ywXXN56IoiJw2WONFVg_0Xt7EPOw') {
    PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', targetKey);
    console.log('🔑 [doGet] Auto-updated GEMINI_API_KEY script property. 🔑✨');
  }

  // Auto-configure Drive permissions to avoid session conflicts
  try {
    var file = DriveApp.getFileById(ScriptApp.getScriptId());
    var access = file.getSharingAccess();
    if (access !== DriveApp.Access.ANYONE && access !== DriveApp.Access.ANYONE_WITH_LINK) {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      console.log('🌐 [doGet] Configured script sharing to ANYONE_WITH_LINK. 🌐✨');
    }
  } catch (driveErr) {
    console.warn('⚠️ [doGet] Drive sharing configuration skipped:', driveErr.message);
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
 * Reads the text content of a specified Google Doc (or active/parent doc as fallback) to send to the frontend. 📄👀
 * @param {string} docIdOrUrl Optional specific document ID or URL to open.
 * @returns {Object} Plain text content, title, and current headings list.
 */
function getActiveDocText(docIdOrUrl) {
  console.log('📄 [getActiveDocText] Reading document contents. 📄👀 params:', docIdOrUrl);
  try {
    var doc = null;
    
    if (docIdOrUrl && docIdOrUrl.trim() !== '') {
      var id = extractDocId(docIdOrUrl);
      if (id) {
        doc = DocumentApp.openById(id);
      } else {
        return { error: 'Invalid Google Doc URL or ID format. 🛑' };
      }
    }
    
    if (!doc) {
      doc = DocumentApp.getActiveDocument();
    }
    
    if (!doc) {
      // Standalone web app fallback to the bound script's parent
      var parentId = '1OLFFJrD_sxsgJ8gZIfQjQS3ts0LfTh8CyV5GfOzNhck';
      try {
        doc = DocumentApp.openById(parentId);
        console.log('📄 [getActiveDocText] Fallback to parent doc ID successful.');
      } catch (e) {
        return { error: 'No active document and fallback parent doc is inaccessible. Please open inside Google Doc or paste a valid Doc URL. 🛑' };
      }
    }
    
    var body = doc.getBody();
    var text = body.getText();
    var docName = doc.getName();
    
    // Scan existing headings
    var headings = [];
    var numChildren = body.getNumChildren();
    for (var i = 0; i < numChildren; i++) {
      var child = body.getChild(i);
      if (child.getType() === DocumentApp.ElementType.PARAGRAPH) {
        var p = child.asParagraph();
        var headingType = p.getHeading();
        if (headingType !== DocumentApp.ParagraphHeading.NORMAL && headingType !== DocumentApp.ParagraphHeading.SUBTITLE) {
          headings.push({
            text: p.getText().trim(),
            level: getLevelFromHeadingType(headingType)
          });
        }
      }
    }
    
    return {
      title: docName,
      text: text,
      headings: headings,
      url: doc.getUrl()
    };
  } catch (err) {
    console.error('🚨 [getActiveDocText] Error:', err.message);
    return { error: err.message };
  }
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
  var doc = DocumentApp.getActiveDocument();
  if (!doc) {
    return { error: 'No active document found. 🚨' };
  }
  
  var lock = LockService.getDocumentLock();
  var hasLock = false;
  
  try {
    hasLock = lock.tryLock(30000); // Thread-safe lock. 🔒🔑
    if (!hasLock) {
      throw new Error('Lock acquisition timeout: Document is currently being edited. ⏳🚨');
    }
    
    // Clear all existing bookmarks before rebuilding them
    var bookmarks = doc.getBookmarks();
    for (var b = bookmarks.length - 1; b >= 0; b--) {
      bookmarks[b].remove();
    }
    
    writeSectionsToDoc(doc, sections, options);
    
    return { success: true, url: doc.getUrl(), count: sections.length };
    
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
  
  var lock = LockService.getDocumentLock();
  var hasLock = false;
  
  try {
    hasLock = lock.tryLock(30000);
    if (!hasLock) {
      throw new Error('Lock acquisition timeout: Document lock is currently busy.');
    }
    
    // 1. Create a new Google Doc
    var doc = DocumentApp.create(title || 'Structured Outline');
    var docId = doc.getId();
    var docUrl = doc.getUrl();
    
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
    writeSectionsToDoc(doc, sections, options);
    
    return { success: true, url: docUrl, count: sections.length };
    
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
  var docUrl = doc.getUrl();
  
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
}

/**
 * Scans the active document and builds a dynamic, bookmark-linked Table of Contents at the top. 📜⛓️
 * @returns {string} Status message.
 */
function generateTOC() {
  var doc = DocumentApp.getActiveDocument();
  if (!doc) {
    throw new Error('No active document found.');
  }
  var body = doc.getBody();
  
  var lock = LockService.getDocumentLock();
  var hasLock = false;
  try {
    hasLock = lock.tryLock(30000);
    if (!hasLock) {
      throw new Error('Lock acquisition timeout: Document is currently busy.');
    }
    
    var numChildren = body.getNumChildren();
    var headings = [];
    
    // Collect headings and assign bookmarks
    for (var i = 0; i < numChildren; i++) {
      var child = body.getChild(i);
      if (child.getType() === DocumentApp.ElementType.PARAGRAPH) {
        var para = child.asParagraph();
        var headingType = para.getHeading();
        var level = getLevelFromHeadingType(headingType);
        
        if (level >= 1 && level <= 6) {
          var text = para.getText().trim();
          if (text.length > 0 && text.toUpperCase() !== 'TABLE OF CONTENTS') {
            var position = doc.newPosition(para, 0);
            var bookmark = doc.addBookmark(position);
            if (bookmark) {
              headings.push({
                text: text,
                level: level,
                bookmarkId: bookmark.getId()
              });
            }
          }
        }
      }
    }
    
    if (headings.length === 0) {
      return 'Execution cancelled: No headings (Heading 1-6) were detected in the document.';
    }
    
    // Remove existing TOC section and old orphans
    removeTOCSection(body);
    
    // Insert the fresh Table of Contents section at the top
    var tocHeader = body.insertParagraph(0, 'TABLE OF CONTENTS');
    tocHeader.setHeading(DocumentApp.ParagraphHeading.HEADING1);
    tocHeader.editAsText().setBold(true);
    
    var insertIndex = 1;
    var docUrl = doc.getUrl();
    
    for (var j = 0; j < headings.length; j++) {
      var h = headings[j];
      var indent = '';
      for (var k = 1; k < h.level; k++) {
        indent += '    ';
      }
      var entryText = indent + h.text;
      var tocEntry = body.insertParagraph(insertIndex, entryText);
      tocEntry.setHeading(DocumentApp.ParagraphHeading.NORMAL);
      
      var bookmarkUrl = docUrl + '#bookmark=' + h.bookmarkId;
      if (entryText.length > 0) {
        tocEntry.editAsText().setLinkUrl(0, entryText.length - 1, bookmarkUrl);
      }
      insertIndex++;
    }
    
    var separator = body.insertParagraph(insertIndex, '─────────────────────────────────────');
    separator.setHeading(DocumentApp.ParagraphHeading.NORMAL);
    
    doc.saveAndClose();
    return 'Success: TOC successfully compiled with ' + headings.length + ' entries.';
    
  } catch (error) {
    console.error('Critical Error in generateTOC execution:', error.message);
    throw new Error(error.message);
  } finally {
    if (hasLock) {
      lock.releaseLock();
    }
  }
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
 * Server-side UrlFetchApp proxy for calling the Gemini API to bypass CORS. 🧠🔌
 */
function queryGemini(modelName, contents, systemInstruction) {
  console.log('🧠 [queryGemini] Sending payload to Gemini. Model:', modelName);
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    console.error('🚨 [queryGemini] GEMINI_API_KEY script property not configured.');
    return { error: 'Gemini API key is not configured in Script Properties.' };
  }
  
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + modelName + ':generateContent?key=' + apiKey;
  var payload = {
    contents: contents,
    generationConfig: {
      temperature: 1.0,
      maxOutputTokens: 8192
    }
  };
  
  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }
  
  try {
    var response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    var code = response.getResponseCode();
    var responseText = response.getContentText();
    console.log('🧠 [queryGemini] Response code:', code, 'Length:', responseText.length);
    
    if (code !== 200) {
      return { error: 'Gemini API error ' + code + ': ' + responseText };
    }
    
    var json = JSON.parse(responseText);
    if (!json.candidates || json.candidates.length === 0) {
      return { error: 'Gemini returned no response candidates.' };
    }
    
    var text = '';
    if (json.candidates[0].content && json.candidates[0].content.parts) {
      text = json.candidates[0].content.parts[0].text || '';
    }
    
    return { text: text };
  } catch (err) {
    console.error('🚨 [queryGemini] URL fetch failed:', err.message);
    return { error: err.message };
  }
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
 * Creates a custom menu in the Google Doc when opened. 🛠️✨
 */
function onOpen() {
  try {
    DocumentApp.getUi().createMenu('📜 TOC Styler')
      .addItem('🖥️ Open Sidebar', 'showSidebar')
      .addItem('🔄 Generate / Refresh TOC', 'generateTOC')
      .addItem('🔑 Authorize Services (diagnostic)', 'forceAuth')
      .addItem('🔌 Force Authorization Prompt (naked)', 'forceAuthorizeNaked')
      .addToUi();
    console.log('✅ [onOpen] Custom menu created successfully. 📜✨');
  } catch (error) {
    console.error('🚨 [onOpen] Error creating menu:', error.message);
  }
}

/**
 * Returns the web app service URL. 🔌💻
 */
function getServiceUrl() {
  console.log('🔌 [getServiceUrl] Fetching service URL. 🔌✨');
  try {
    return ScriptApp.getService().getUrl();
  } catch (err) {
    console.error('🚨 [getServiceUrl] Error:', err.message);
    return '';
  }
}
