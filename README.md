![Two arrows connect a contents entry to its heading on a tabbed document and back.](assets/banner/banner.png)

# Table of Contents Generator and Structurer

Jump from a contents entry to a heading in Google Docs, then follow the heading’s return link to the same entry. If your document already has headings, you can build that navigation straight from the Docs menu. For rough notes or scanned material, the React editor offers a second starting point: extract text, structure it with Gemini, and review the outline before writing it to a Doc.

[Features](#-features) · [Install & usage](#-install--usage) · [Deployment](#-deployment) · [Tech stack and layout](#-tech-stack-and-layout) · [Status](#-status)

## 🧭 Features

| Start with | What you can do | Implementation |
| --- | --- | --- |
| A Doc with headings | Build a reciprocal TOC for the active tab, collect headings across tabs into one central TOC, or give each tab its own. Each entry links to a specific heading bookmark, even when headings share a title. | [Navigation engine](src/gas/NavigationV42.js) |
| A PDF or image | Drop files into the editor. PDF.js extracts PDF text and Tesseract.js recognizes text in images. | [File intake](src/components/MultiFileUpload.tsx) |
| Unstructured text | Send the text to Gemini, review its outline in the editor, then write the sections to the target document or export them to a new Doc. | [Gemini client](src/services/gemini.ts) · [Editor](src/App.tsx) · [Document writer](src/gas/Code.js) |
| A multi-tab document | Read text from a selected tab or collect it across tabs for structuring. | [Document reader](src/gas/DocumentIOV42.js) |

## 🚀 Install & usage

**In Google Docs.** Open a document with the bound script installed. Under **📜 TOC & Document Architect v4.2**, choose **🔄 Generate Reciprocal TOC (Active Tab)**. Follow an entry to its heading, then follow the return link. For the outline editor, choose **🖥️ Open Sidebar Panel** or **🗖 Open Expanded App Dialog (In-Doc)**. [Menu commands](src/gas/Code.js)

**For local development.** From the repository root, use Node.js and npm to install the locked dependencies and launch Vite.

```powershell
npm ci
npm run dev
```

Open the local URL printed by Vite. Google Docs reads and writes require the Apps Script host. For local Gemini requests the client reads `VITE_GEMINI_API_KEY`. Keep this mode local because Vite exposes client-side values in the bundle. The Apps Script version calls the server-side Gemini proxy. [Client](src/services/gemini.ts) · [Proxy](src/gas/GeminiProxyV42.js)

## 📦 Deployment

Build the browser bundle first, then run the separate Apps Script packager.

```powershell
npm run build
node build-gas.js
```

Vite writes `dist/`. The packager writes `dist-gas/` with the inlined interface, server modules, voice helper and manifest. For your own deployment, configure clasp to target your own document-bound script project with `dist-gas` as its root. After `clasp login`, check the target and file list with `clasp status` before running `clasp push`. To serve the full-screen interface, create a web app deployment in the Apps Script editor. [Packager](build-gas.js) · [Web app entry point](src/gas/Code.js)

## 🧰 Tech stack and layout

| Path | What lives there |
| --- | --- |
| [src/App.tsx](src/App.tsx) and [src/components](src/components) | React and TypeScript editor, attachment intake and history panel |
| [src/lib](src/lib) | Outline parsing, serialization and formatting-mode selection |
| [src/gas](src/gas) | Apps Script document operations, bookmark navigation, Gemini proxy and regression checks |
| [vite.config.ts](vite.config.ts) and [package.json](package.json) | Vite, Tailwind CSS, dependencies and npm commands |

## 🧪 Status

The repository includes a Docs-side regression check for reciprocal links, duplicate headings, repeat builds and bookmark URL format. Run **🧪 Run v4.2 Navigation Regression Tests** from the installed Docs menu to exercise those paths in scratch documents. The repository also includes a deployment workflow definition. A live web app release and its authorization state need to be checked in the target Apps Script project. [Regression checks](src/gas/NavigationV42Tests.js) · [Workflow definition](.github/workflows/deploy.yml)

## 📄 License

[MIT](LICENSE)
