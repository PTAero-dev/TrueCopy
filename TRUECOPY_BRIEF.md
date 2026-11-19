# TrueCopy — Project Brief for Handoff

> Everything agreed so far, so an AI coding assistant can continue the work.
> Full plan with architecture diagram: https://claude.ai/artifact/BStkv3cjUG4jd6gNLKNJwY
> Last updated: 2026-11-18

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
| Fonts the user likes | **Thai Niramit (Niramit)** or **Thai Sarabun (Sarabun)** — see section 5 |

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
| PWA | Installable on a phone | 4 |

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
- **Default:** Sarabun Bold, with Niramit as a choice in the font menu.
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
4. **Phase 4 — Publish:** deploy on Cloudflare (`*.pages.dev`), set Authorized domains and App Check, make it a PWA (a small `manifest.json` and `sw.js` can sit beside `index.html` on Cloudflare Pages while keeping all app code inside the single HTML file).

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

| Screen | Contents |
| --- | --- |
| Sign in | A single "Sign in with Google" button (phase 2 onward) |
| Workspace (main screen) | Left: file list + page thumbnails · Center: page preview with the stamp · Right: settings panel (template, text, color, font, opacity/Real Ink, position/angle, signature + printed name, date, watermark, flatten) · "Generate", "Download" (`ดาวน์โหลด`), and "Share" (`แชร์ไฟล์` — LINE / WhatsApp / Email) buttons. On a phone, the settings panel slides up from the bottom |
| Signature library | Signature cards · photo upload + smooth background-removal slider + "match stamp color" toggle · draw-with-finger/mouse pad |
| Template manager | Template list · editor with live stamp preview · set as default |
| History | Date · file names · template · page count · download again |

- All interface text is in Thai.
- The layout must work on both phones and computers.

---

## 10. User flow

1. **Upload:** drag files in. If a PDF has a password, ask for it.
2. **Pick a template:** e.g. "Refinance CIMB"; edit the variable fields if needed.
3. **Set the look:** color, font, opacity/Real Ink, size, angle, position, signature, optional printed name, date, watermark.
4. **Preview:** check every page; adjust position sliders (or drag directly on the page from phase 3 onward) away from important spots such as amounts or official seals.
5. **Generate, download & share:** automatic file name; download per file or as a ZIP, or tap **แชร์ไฟล์** to send directly via LINE, WhatsApp, or Email (history is saved from phase 3 on).
