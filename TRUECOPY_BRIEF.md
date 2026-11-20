# TrueCopy — Project Brief for Handoff

> Everything agreed so far, so an AI coding assistant can continue the work.
> Full plan with architecture diagram: https://claude.ai/artifact/BStkv3cjUG4jd6gNLKNJwY
> Last updated: 2026-11-20 (full UI/UX redesign shipped. Read **section 11** first, it supersedes the old screen notes)

---

## 0. How to work with the user (read first)

- The user is a **coding beginner**. Explain in plain English, use simple analogies instead of jargon, and give the reason behind each decision.
- If the user's intent is unclear, **ask before building**. Do not guess.
- Work **one phase at a time** (section 8). Finish a phase, let the user test it, then move on.
- Before touching Firebase or Cloudflare (creating projects, setting rules, deploying), explain the steps and ask for permission every time.
- The app's **interface language is Thai**. All on-screen labels, buttons and stamp text are Thai. Thai strings in this brief are exact text to use.

---

## 1. What the app is

**TrueCopy** (Thai: รับรองสำเนาถูกต้อง, "certified true copy") is a web app for certifying copies of personal documents before handing them to an organization such as a bank. In Thailand, the owner writes a restricted-use line plus "รับรองสำเนาถูกต้อง" and signs every page of the copy.

1. Upload PDFs or document images (several files at once).
2. Choose or type a restricted-use line, e.g. `ใช้เพื่อยื่น Refinance กับธนาคาร CIMB THAI เท่านั้น` ("For submitting a refinance to CIMB THAI Bank only").
3. The app stamps that line, the words `รับรองสำเนาถูกต้อง`, and a **saved signature** onto **every page**.
4. Download the certified PDFs.

- **User:** the owner only (single user).
- **Background:** the user certified a 4-file refinance set this way (land title deed, SCB loan receipts, salary slips, Krungthai bank statement) and wants an app to do it themselves.

---

## 2. Decisions already made (do not change without asking)

| Topic | Decision |
| --- | --- |
| App name | **TrueCopy** |
| App format | **One single HTML file** (HTML + CSS + JS together), libraries loaded from a CDN, no build tool |
| Where documents are processed | **In the browser only**. Files are never sent to a server for processing |
| Backend | **Firebase**: Authentication (Google sign-in) + Firestore on the 100% free **Spark plan** (no credit card required). **Firebase Storage** is optional (only needed if the user later wants cloud backup of finished PDFs on the Blaze plan) |
| What is stored on Firebase | Signatures (stored directly in Firestore as compact transparent PNG data URLs, ~15–30 KB), text templates, default settings, history, and optionally stamped output files — **never the original documents** |
| Encrypt files before upload | **No** (security rules protect the data) |
| Flatten pages to images | **On by default**; the user can turn it off |
| Hosting | **Cloudflare Pages** (`https://truecopy-3rh.pages.dev/`) |
| Accounts | Google / Firebase / Cloudflare: `taxicashflow@gmail.com` (Firebase Project: `truecopy-cert-th`, Region: `asia-southeast1` Spark plan · Cloudflare Account ID: `6cf13c91bf3d927563c99ece990518ea`) · GitHub: `PTAero-dev` (`PTAero-dev/TrueCopy`) |
| Fonts the user likes | **Thai Niramit (Niramit)** or **Thai Sarabun (Sarabun)**, plus the bundled **TH SarabunPSK Italic** (added 2026-11-20); see section 5 |
| Defaults chosen in the 2026-11-20 redesign | Stamp weight **Semi-bold (600)**, restricted-use org **ธนาคารกรุงไทย**, app style **Glass**. A one-time migration (`truecopy_migration_v2`) moved saved `fontWeight 700→600` and `org ธนาคาร CIMB THAI→ธนาคารกรุงไทย` in the current settings only (templates/history untouched) |

---

## 3. Features

| Feature | Details | Phase |
| --- | --- | --- |
| Multi-file upload | PDF, JPG, PNG; drag and drop; images become PDF pages | 1 |
| Restricted-use line | Supports variables, e.g. `ใช้เพื่อยื่น {purpose} กับ{org} เท่านั้น` | 1 |
| Certification text | Default `รับรองสำเนาถูกต้อง`, editable | 1 |
| Color and font | Default blue `#0D33BF`; choose color and Thai font | 1 |
| Ink opacity & "Real Ink" blend | Opacity slider (default 85%) and multiply blend mode so numbers underneath stay readable | 1 |
| Lines above and below | Frame the restricted-use line; on/off; dashed or solid | 1 |
| Signature | Placed under the certification text; optional printed signer name `(ชื่อ-นามสกุล)` and option to tint signature to match stamp color; upload photo or draw on screen; memorized locally in browser (`localStorage`, synced via Firestore in phase 2) | 1 |
| Direct hand move, rotate & resize + per-page overrides | Drag to move, drag `↻` handle to rotate, drag `⤢` handle or 2-finger pinch/twist to resize/rotate on mobile/iPad/desktop without opening tabs; apply to all pages or per page | 1 |
| Remove / restore PDF pages | Exclude unwanted pages from uploaded multi-page PDFs before generating, and restore anytime | 1 |
| Flatten pages | Prevents removing the stamp or extracting the signature (on by default; user can turn it off) | 1 |
| Preview, download & share | See every page before generating; download per file or all as ZIP; **Share button (`แชร์ไฟล์`)** to send certified PDFs directly via **LINE, WhatsApp, or Email** using the device's native share menu | 1 |
| Cloud signature & template sync | Sync memorized signatures and text templates across devices via Google sign-in + Firestore | 2 |
| Certification date | Auto date; Buddhist Era (พ.ศ.) or Gregorian; optional Thai numerals | 3 |
| Anti-forgery watermark | Faint text repeated across the page | 3 |
| History | Record what was certified, for whom, and when | 3 |
| PDF Editor (`แก้ไข PDF`) | Merge multiple PDFs/photos, drag/tap organize pages, rotate, delete with undo, split/extract pages by click or range (`1, 3-5`), annotate any page with text, freehand pen, highlighter, lines, arrows, rectangles, circles/ellipses, and irreversible blur/pixelate/solid redact (rotation-synced & flattened into exported PDF), compress file size, normalize A4 page size, and send straight to Certify | 4+ |
| Bilingual UI & Dark Theme | Toggle between Thai (`ไทย`) and English (`EN`) UI (with quick Thai/English stamp text presets) and switch cleanly between Light & Dark themes (`☀️`/`🌙`) | 4+ |
| PWA | Installable on a phone | 4 |
| Redesigned UI (2026-11-20) | Preview always on screen; tool tabs below (phone) / right (iPad, laptop); filmstrip of all pages; nav drawer (phone) / rail (wide); 4 app styles (Glass default, Ink & paper, Navy & gold, Graphite) + "app colour follows stamp ink"; see section 11 | 7 |
| New in the redesign | Recently-used purpose/org chips, bank & purpose suggestions, 3×3 quick position grid, hold-eye-button to compare with original, page number on stamp (`หน้า 1/5`), pre-send check sheet, combine all outputs into one PDF, 3 file-name patterns, camera capture input, undo/redo for stamp settings, PIN keypad, "use this wording again" from history, share sheet (LINE / email / OneDrive / other apps / save), highlighter hold-to-snap (line / rectangle / circle / triangle), bundled TH SarabunPSK Italic | 7 |

---

## 4. Approved stamp design

The user already made and approved this stamp. Use it as the default:

```
- - - - - - - - - - - - - - - - - - - - - - - - - - -   ← dashed line
   ใช้เพื่อยื่น Refinance กับธนาคาร CIMB THAI เท่านั้น      ← bold, large
- - - - - - - - - - - - - - - - - - - - - - - - - - -   ← dashed line
                 รับรองสำเนาถูกต้อง                         ← slightly smaller
                 [signature]                                ← (new in the app)
                 (ชื่อ นามสกุล)                            ← optional printed name
```

- **Color:** blue `#0D33BF` for text and lines.
- **Ink opacity & Real Ink blend:** default 85% opacity with multiply blending so black numbers underneath show clearly through the blue stamp ink.
- **Placement:** centered on the page, **rotated 35°** rising to the right, nearly full page width (about 90–95%).
- **Why it crosses the content:** so nobody can crop or cover the stamp and reuse the copy for another purpose. The figures underneath must stay readable.
- **Every page:** every page gets a stamp, not just the first.
- **Output file name:** `<original name>_รับรองสำเนา_<organization>.pdf`

---

## 5. Fonts

The user likes **Thai Niramit** or **Thai Sarabun**.

| What the user calls it | Use in the app | Source |
| --- | --- | --- |
| Thai Sarabun (TH Sarabun New / TH SarabunPSK) | **Sarabun** | Google Fonts — modern version of the Thai government font TH Sarabun New |
| Thai Niramit (TH Niramit AS) | **Niramit** | Google Fonts — modern version of TH Niramit AS |

- Use the Google Fonts versions: they load from a CDN and use the open OFL license.
- The original SIPA "TH" versions render smaller and need a larger size. If the user wants the original TH fonts, support uploading a `.ttf` file.
- **Default:** Sarabun **Semi-bold (600)** since 2026-11-20 (was Bold), with Niramit and TH SarabunPSK Italic as choices.
- **TH SarabunPSK Italic** is bundled as `fonts/THSarabunPSK-Italic.ttf` (SIPA/DIP licence: free to use and redistribute unmodified, may not be sold on its own; do not rename or modify the font file). It is declared with `@font-face` in `index.html` and cached by `sw.js`. SIPA fonts draw ~1.45× smaller than Google's Sarabun, so `FONT_SCALE` in the script enlarges them so the chosen point size matches. It has one weight; Semi-bold/Bold are browser-synthesised.
- **Before every draw**, wait for the font to load, e.g. `await document.fonts.load('700 48px Sarabun')`. Otherwise the first stamp renders in a fallback font.

---

## 6. Architecture and key technical points

```
Cloudflare Pages ──serves app──▶ Browser (everything happens here)
                                 ├─ pdf.js       read PDFs, preview, open password-protected files
                                 ├─ Canvas       draw the stamp (Thai text + lines + signature)
                                 ├─ pdf-lib      place the stamp on every page, build the new PDF
                                 └─ Firebase SDK ◀──▶ Auth / Firestore / Storage
Original files ──▶ Browser ──▶ Certified PDF (download / save to Storage if the user chooses)
```

### ⚠️ Most important pitfall: Thai vowels and tone marks

- **Do NOT write Thai text with pdf-lib's `page.drawText()`.** pdf-lib has no text shaping, so Thai upper vowels and tone marks float or overlap. Words such as "เท่านั้น" and "ถูกต้อง" break.
- **Correct approach:**
  1. Draw the whole stamp (text, dashed lines, certification text, signature, optional printed name, date) onto a transparent `<canvas>` at **at least 4× resolution**. The browser shapes Thai correctly.
  2. Convert it to PNG (`canvas.toBlob`).
  3. When **Flatten is ON**, draw the stamp canvas onto the page canvas with `globalCompositeOperation = 'multiply'` ("Real Ink" mode) and `globalAlpha` set to the chosen opacity (default `0.85`) before saving the page.
  4. When **Flatten is OFF**, use `pdfDoc.embedPng()` and `page.drawImage()` with the chosen `opacity`, rotated to the set angle (`rotate: degrees(35)`) and centered on the page.
- **Side benefits:** any font works, numbers underneath stay legible, and a stamp that is an image is harder to edit in a PDF editor.

### Pages and files

- **Password-protected PDFs:** bank statements are often password-protected, and pdf-lib cannot open them. Use pdf.js to ask for the password, render each page to an image (~200 dpi), then build a new PDF.
- **Flatten ON (default):** render the original page with pdf.js at ~200 dpi, draw the stamp on the same canvas (using Real Ink multiply blending + opacity), and add it as an image-only page. Use JPEG quality ~0.85 to keep files small.
- **Flatten OFF:** load the original PDF with pdf-lib and draw the stamp PNG on top. Pages stay vector and the file stays small.
- **Page sizes:** store positions as 0–1 fractions of the page, not pixels. Both A4 (595×842 pt) and US Letter (612×792 pt) must work.
- **Rotated pages** (`page.getRotation()` = 90/270): the stamp must still look correctly angled on screen.
- **JPG/PNG uploads:** convert each image to a PDF page that matches its aspect ratio.
- **Share to LINE / WhatsApp / Email:** uses the browser's Web Share API (`navigator.canShare({ files })` and `navigator.share({ files, title })`) to open the native share sheet on phones and supported computers. On desktop browsers that do not support direct file sharing, fall back gracefully by downloading the file and displaying a clear tip to attach it in LINE, WhatsApp, or Email.

### Libraries (via CDN)

| Task | Library |
| --- | --- |
| Read/preview PDFs, decrypt | pdf.js (`pdfjs-dist`) |
| Place the stamp in the PDF | pdf-lib |
| Draw a signature on screen | signature_pad |
| ZIP download | JSZip |
| Login and data | Firebase JS SDK (modular, v10+) |
| Fonts | Google Fonts: Sarabun, Niramit |

### Signature background removal

Draw the image on a canvas and read `getImageData`. Use a **smooth alpha ramp (soft feathering)** around the brightness threshold (adjustable slider, starting around 200/255) so paper shadows disappear without leaving jagged pen edges. Include a **"Match stamp color" toggle** that recolors the signature strokes to match the stamp color (e.g. `#0D33BF`). **Trim empty margins** before saving.

---

## 7. Firebase data model

Everything lives under `users/{uid}` to keep security rules simple. Signatures are stored directly inside Firestore as compact transparent PNG data URLs (~15–30 KB) so **Phase 2 runs 100% on Firebase's free Spark plan (no credit card required)**.

| Store | Path | Main fields |
| --- | --- | --- |
| Firestore | `users/{uid}/templates/{id}` | name, lines, variables, certifyText, color, font, fontSize, opacity, multiplyInk, showSignerName, signerName, tintSignature, angle, position, dashed, showDate, dateFormat, watermark, flatten |
| Firestore | `users/{uid}/signatures/{id}` | name, dataUrl, width, height, createdAt |
| Firestore | `users/{uid}/settings/default` | defaultTemplateId, defaultSignatureId, outputDpi, fileNamePattern |
| Firestore | `users/{uid}/history/{id}` | createdAt, fileNames, templateId, purposeText, pageCount, outputPath |
| Storage *(optional)* | `users/{uid}/outputs/{historyId}.pdf` | Stamped file (optional — only if cloud PDF backup is enabled later on the Blaze plan) |

Example template:

```json
{
  "name": "Refinance ธนาคาร",
  "lines": ["ใช้เพื่อยื่น {purpose} กับ{org} เท่านั้น"],
  "variables": { "purpose": "Refinance", "org": "ธนาคาร CIMB THAI" },
  "certifyText": "รับรองสำเนาถูกต้อง",
  "color": "#0D33BF",
  "font": "Sarabun",
  "fontWeight": 700,
  "fontSize": 26,
  "opacity": 0.85,
  "multiplyInk": true,
  "showSignerName": false,
  "signerName": "",
  "tintSignature": true,
  "angle": 35,
  "position": { "x": 0.5, "y": 0.5, "scale": 0.93 },
  "dashed": true,
  "showDate": false,
  "dateFormat": "d MMMM BBBB",
  "watermark": { "enabled": false, "opacity": 0.08 },
  "flatten": true
}
```

### Security rules (owner only)

Firestore:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null
        && request.auth.uid == uid
        && request.auth.token.email == "taxicashflow@gmail.com";
    }
  }
}
```

Storage *(optional — only needed if Storage is enabled for PDF backup)*:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{uid}/{allPaths=**} {
      allow read, write: if request.auth != null
        && request.auth.uid == uid
        && request.auth.token.email == "taxicashflow@gmail.com";
    }
  }
}
```

- The `firebaseConfig` values (apiKey etc.) can live in the HTML file. They are not secrets.
- In Firebase Console > Authentication > Settings > **Authorized domains**, keep only the app's Cloudflare domain and `localhost`.
- Turn on **App Check** in phase 4.

---

## 8. Development phases

1. **Phase 1 — Local stamping (no Firebase yet):** multi-file upload, restricted-use line + certification text + dashed lines, color/font choice (Sarabun/Niramit), ink opacity + Real Ink blend, signature photo upload or on-screen drawing pad + memorized local signature library, optional `(ชื่อ-นามสกุล)` line, direct hand move/rotate/resize (handles + 2-finger pinch/twist) with per-page overrides, PDF page removal/restore, flatten toggle (on by default), preview, individual + ZIP download, and **Share button (`แชร์ไฟล์` — LINE / WhatsApp / Email)**. Keep defaults and signatures in `localStorage` (wrapped in try/catch).
2. **Phase 2 — Connect Firebase *(Implemented)*:** Google sign-in (`taxicashflow@gmail.com` only), sync memorized signatures and templates across devices in Firestore (`truecopy-cert-th`, `asia-southeast1`, free Spark plan, no credit card needed), strict owner-only `firestore.rules`, and Template Manager UI.
3. **Phase 3 — Extra features *(Implemented)*:** Buddhist Era / Gregorian certification date (with optional Thai digits ๐-๙), diagonal anti-forgery watermark across preview & Flatten ON/OFF exports, and local + Firestore Certification History (`users/{uid}/history/{historyId}`).
4. **Phase 4 — Publish & Security *(Implemented)*:** Cloudflare Pages PWA deployment (`manifest.json`, `sw.js`, `icon.svg`, `icon-192.png`, `icon-512.png`) with install prompt + offline shell caching, plus laptop/device protection (mandatory Google owner sign-in gate, session-only login option, synced 4–12 char PIN lock screen, AES-256-GCM PBKDF2 encrypted local signature vault, idle/tab-leave auto-lock, `Ctrl+Shift+L` lock shortcut, and complete local data wipe on sign-out). Note: Firebase Console **Authorized domains** and optional **App Check** (reCAPTCHA v3) are toggled in the Firebase web console.
5. **PDF Editor & Annotate Studio *(Implemented)*:** Dedicated **📄 แก้ไข PDF** tab inside [index.html](index.html) supporting multi-PDF/image merge, drag-and-drop & mobile touch page reordering, 90° page rotation, page deletion with Undo, page extraction by click or range (`1, 3-5, 8`), a full-screen **Annotate, Draw & Blur Studio** per page (multiline Thai/English text boxes, freehand pen, multiply highlighter, straight lines, arrowheads, rectangles, ellipses/circles, and cross-browser pixel-destructive Blur/Mosaic/Solid Redact with per-page Undo/Redo and rotation sync, flattened cleanly on PDF export), file-size compression (`original`, `high`, `bank`, `small`), A4 page size normalization, and direct download, Web Share, or one-click transfer to **รับรองสำเนาถูกต้อง**.
6. **Bilingual UI & Dark Theme *(Implemented)*:** Complete Thai (`ไทย`) / English (`EN`) live interface toggle (with quick `🇹🇭 ไทย` / `🇬🇧 EN` stamp text presets, English CE date support, and top-right lock-screen language/theme toggles), plus zero-flash Light/Dark theme switcher (`☀️`/`🌙`) persisted in `localStorage`.
7. **Full UI/UX redesign *(Implemented 2026-11-20)*:** Prototyped first in `prototype/` (user tested it on phone/iPad and asked for changes), then rebuilt into the production `index.html` on top of the same engine (pdf.js / pdf-lib / Firebase / PIN vault). See section 11.

### Phase 1 acceptance checklist

- [ ] Thai vowels and tone marks sit correctly in both Sarabun and Niramit, especially in "เท่านั้น", "ถูกต้อง", "ที่" and "ปู่".
- [ ] Works on a scanned PDF (land title deed), a text PDF (SCB receipt) and US Letter pages (Krungthai statement).
- [ ] Works on password-protected PDFs and on pages rotated 90/270.
- [ ] A 14+ page file works on a phone without freezing, and the output stays reasonably small (target < 1 MB per page).
- [ ] The stamp prints sharp, not blurry.
- [ ] Every page has a stamp.
- [ ] Numbers and text underneath the stamp stay readable thanks to opacity and Real Ink blending.
- [ ] Share button opens the native share menu (for LINE, WhatsApp, Email) on supported devices, and individual/ZIP downloads work cleanly.

---

## 9. Screens

The screens and responsive rules were replaced by the 2026-11-20 redesign. **See section 11** for the current screens, layout breakpoints and rules.

- All interface text is Thai by default, with a full English toggle.
- `sw.js` serves HTML network-first, so layout fixes reach installed PWAs without bumping `CACHE_NAME`. Bump `CACHE_NAME` when adding new static files (it is `truecopy-shell-v6` since the redesign added `fonts/`).

### How to deploy (Cloudflare Pages)

The Pages project `truecopy` is **not** connected to GitHub (direct upload), so `git push` does **not** deploy. After committing, copy **only the app files** (`index.html`, `manifest.json`, `sw.js`, `icon.svg`, `icon-192.png`, `icon-512.png`, and the `fonts/` folder) into a temporary folder and run:

`npx wrangler pages deploy <that-folder> --project-name truecopy --branch main --commit-hash <sha>`

Never deploy the project root. Until 2026-11-19 it was deployed that way, which made `TRUECOPY_BRIEF.md`, `firestore.rules` and `firebase.json` public.

---

## 10. User flow

1. **Upload:** drag files in. If a PDF has a password, ask for it.
2. **Pick a template:** e.g. "Refinance CIMB"; edit the variable fields if needed.
3. **Set the look:** color, font, opacity/Real Ink, size, angle, position, signature, optional printed name, date, watermark.
4. **Preview:** check every page; adjust position sliders (or drag directly on the page from phase 3 onward) away from important spots such as amounts or official seals.
5. **Generate, download & share:** automatic file name; download per file or as a ZIP, or tap **แชร์ไฟล์** to send directly via LINE, WhatsApp, or Email (history is saved from phase 3 on).

---

## 11. UI/UX redesign (2026-11-20) — read this before changing the interface

### What happened

1. The user asked for a complete UX/UI redesign that keeps every feature, works on laptop, iPad and phone, never lets text overlap, and on phones **never makes the user open and close sheets** to see the result of a setting.
2. A clickable prototype was built in `prototype/` and published privately at https://claude.ai/artifact/EEVBtyN38ogXK2td83daqr. The user tested it and asked for: chip rows that wrap (no sideways scrolling that cuts items at the screen edge), default bank ธนาคารกรุงไทย, default weight Semi-bold, highlighter hold-to-snap shapes, a share sheet (LINE / email / OneDrive), a style switcher (chose **Glass** as default) and the bundled TH SarabunPSK Italic font.
3. The approved design was rebuilt into the production `index.html` on top of the original engine and deployed.

### Files

| Path | Role |
| --- | --- |
| `index.html` | **The app** (single file: HTML + CSS + JS). Edit this file directly. |
| `fonts/THSarabunPSK-Italic.ttf` | Bundled font (deploy it; cached by `sw.js`). |
| `prototype/` | Design reference only, **not** the app. `prototype/src/*` + `node prototype/build.mjs` regenerate the prototype page (generated `prototype/index.html` / `truecopy-prototype.html` are git-ignored). Documents, sign-in, downloads and sharing there are simulated. |

### Screens (production)

| Screen (hash) | Contents |
| --- | --- |
| Lock (overlay) | Checking → Google sign-in gate (session-only switch, offline PIN button when offline) → first-time PIN setup / PIN unlock (typed field + on-screen keypad; letters allowed; lockout after 5 and 8 wrong tries), forgot-PIN (Google re-auth), sign out & wipe. Open at page load so the workspace never flashes. |
| `#certify` | Header (menu on phones, title + file/page summary, undo/redo, **สร้าง PDF**). Preview stage with overlays: all pages / this page, hold-eye compare, handles toggle, zoom, prev/next, page pill; drag to move, ↻ handle rotates (snaps 0/±35/±90), ⤢ handle resizes, two fingers resize+rotate+move. Filmstrip of every page (vertical column ≥1280 px). Tool tabs: เอกสาร / ข้อความ / ลายเซ็น / หมึก / ตำแหน่ง / ป้องกัน. **สร้าง PDF** opens a sheet: pre-send check → progress → results (download, share, ZIP, share all, open in Edit PDF). |
| `#edit-pdf` | Board of page cards (tap = select, press-and-hold / mouse drag = reorder, double-click = annotate), action bar (rotate, draw/text, extract, delete, clear), export options (quality presets, page size, file name) in a right column (wide) or sheet (phone). Annotate studio: select, text, pen, highlight (hold-to-snap), line, arrow, box, circle, blur/mosaic/redact; per-page undo/redo. |
| `#history` | Grouped by day, search, "use this wording again", delete, clear all (cloud too). |
| `#library` | Templates (live stamp previews, use / default / update / delete) and signatures (use / rename / delete, draw / upload). |
| `#preferences` | Account (Google), security (PIN set/change/remove, auto-lock, lock on tab leave, session-only, lock now, wipe), appearance (language, light/dark/auto, app style, ink-coloured accent), app (install when the browser offers it, reset stamp, keyboard shortcuts), about. |

### Layout rules (keep these)

| Condition | Layout |
| --- | --- |
| default (phones, iPad portrait) | Stacked: header → preview → filmstrip → tool tabs → tool panel. Panel height is draggable on the tab bar (stored as a ratio of screen height in `truecopy_ui_v2.panelRatio`); tap the grip to collapse. Typing in the panel hides the filmstrip so the preview stays visible above the keyboard. 700–899 px wide: panel content in 2 columns. Navigation is a slide-in drawer. |
| `orientation: landscape` and height ≤ 520 px (phones sideways) | Preview left, tools right. |
| ≥ 900 px wide and ≥ 521 px tall | Nav rail (92 px) + preview + 340–380 px tool column. |
| ≥ 1280 px | Adds the vertical filmstrip column on the left. |

- **Never** use sideways-scrolling rows for chips, signature cards or toolbars. The user reported cut-off items as a bug ("หลุดขอบ"). Rows wrap (`.chips`, `.sig-row`, `.an-props`, `.an-dock`, `.ebar`). Only the page filmstrip and the preview scroll.
- Text inputs use 16 px font (stops iOS zoom). Long single-line labels use ellipsis; everything else wraps.
- Every colour is a CSS token; app styles override tokens on `:root[data-skin=…]` for light **and** dark. `--accent-2` is the secondary accent (gold in Navy & gold).
- Tested with a script that flags any element outside its container or overflowing text, at 320/375/390/430 (phones), 844×390 (phone landscape), 820×1180 (iPad portrait), 1024/1180 (iPad landscape), 1366/1440 (laptop), in Thai and English, on every tab, sheet and the lock screen.

### Code map (`index.html` script, numbered sections)

0 helpers & storage keys · 1 language/theme/app style · 2 settings & state · 3 stamp wording · 4 signatures (vault-aware save) · 5 stamp rendering · 6 file loading (password PDFs) · 7 certify workspace (preview, filmstrip, controls, gestures, split, undo) · 8 create PDF (`generateFile`: flatten = render at ~184 DPI + JPEG 0.84; flatten off = pdf-lib vector + rotation-aware stamp/watermark, multiply blend) · 9 history · 10 library · 11 Edit PDF (`edBuild`: original quality copies vector pages; otherwise render at preset DPI, burn in annotations, rotate) · 12 annotate studio & shape recognition · 13 signature pad/upload · 14 crypto vault, lock screen, Google auth (`handleCloudAuthState`, `unlockAndHydrate`, `syncCloudDataAfterUnlock`) · 15 modals/toast/password · 15b share sheet · 16 actions (`onAction` switch) · 17 wiring · 18 boot. The Firebase module (`window.TrueCopyCloud`) is the unchanged module from before.

### Data compatibility (do not break)

- Same `localStorage` keys as before: `truecopy_phase1_settings_v1` (settings; `activeSigId` is the selected signature), `truecopy_saved_signatures_v1` (array `{id,name,rawDataUrl,cleanDataUrl,threshold,tintSignature,createdAt}` or the AES-GCM vault `{encrypted:true,iv,ct}` when a PIN is set), `truecopy_saved_templates_v1` (flat template objects), `truecopy_default_template_id_v1`, `truecopy_history_v1`, `truecopy_security_v1`, `truecopy_lockout_until_v1`, `truecopy_theme_v1`, `truecopy_lang_v1`. New: `truecopy_ui_v2` (tab, panel ratio, app style, ink accent, export options, last share target) and `truecopy_migration_v2`.
- Firestore payloads are whitelisted by the Firebase module (`toTemplatePayload` etc.), so new local-only fields (`showPageNo`, history `purpose/org/templateLine`) never reach the cloud; the Firestore rules were not changed.
- `cleanDataUrl` is now stored untinted; the ink colour is applied when the stamp is drawn.

### Sharing (what is real)

LINE, email, OneDrive and "other apps" all open the **device share sheet** (`navigator.share({ files })`) with the PDF and the message attached; the user taps the app there (a web page cannot pick the target app itself). Without file sharing (most desktop browsers) the file downloads and the sheet explains how to attach it (email also gets a `mailto:` button). **Direct OneDrive upload is not implemented**: it would need Microsoft sign-in (MSAL) and a free Azure app registration; ask the user before setting that up.

### How it was tested

A local test copy of the app with `window.TrueCopyCloud` replaced by an in-memory stand-in (same function names; never deployed) was used to run the real code: old-format data carry-over, PDF + image upload, flatten on/off output (page sizes incl. a /Rotate 90 page, blue ink present, vector text kept when flatten is off), combine into one PDF, Edit PDF rotate/annotate/export (bank and original quality), PIN set → vault encrypted → lock → wrong PIN → unlock, reload → account PIN unlock, draw signature, save template, sign out & wipe → sign in → cloud restore, share sheet (native and download fallback). Real Google sign-in and real Firestore were **not** exercised before deploy. The module is unchanged, but the first real sign-in after deploy is the live check. Not yet verified on a physical iPhone/iPad (watch the on-screen keyboard behaviour while typing in the tool panel).

Note: pdf.js draws pages using animation frames, so in a hidden/background tab rendering and PDF creation pause until the tab is visible again (same as the previous version).
