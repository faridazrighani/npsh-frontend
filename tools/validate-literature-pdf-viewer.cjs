const fs = require("node:fs");
const path = require("node:path");

const FRONTEND_ROOT = path.resolve(__dirname, "..");
const INDEX_FILE = path.join(FRONTEND_ROOT, "index.html");
const RUNTIME_FILE = path.join(FRONTEND_ROOT, "engineering-literature-pdf-viewer.js");
const MANIFEST_FILE = path.join(FRONTEND_ROOT, "FILE_MANIFEST.md");
const PACKAGE_FILE = path.join(FRONTEND_ROOT, "package.json");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const index = read(INDEX_FILE);
const runtime = read(RUNTIME_FILE);
const manifest = read(MANIFEST_FILE);
const packageJson = JSON.parse(read(PACKAGE_FILE));

const expectedBooks = [
  "cengel-fluid-mechanics-3e",
  "fox-mcdonald-fluid-mechanics-10e",
  "grist-cavitation-centrifugal-pump-1998",
  "hydraulic-institute-npsh-margin-2024"
];

assert(index.includes('id="menu-literature"'), "Help menu must include Literature.");
assert(index.includes('id="dropdown-literature"'), "Help menu must include the Literature right-side dropdown.");
assert(index.includes("dropdown-submenu-flyout literature-submenu"), "Literature menu must be a right-side flyout.");
assert(index.includes("engineering-literature-pdf-viewer.js?v=20260607-literature-pdf-viewer4"), "Index must load the cache-busted literature viewer runtime.");

for (const bookId of expectedBooks) {
  assert(index.includes(`data-literature-id="${bookId}"`), `Index menu must include ${bookId}.`);
  assert(runtime.includes(`id: "${bookId}"`), `Runtime registry must include ${bookId}.`);
}

assert(runtime.includes("vendor/pdf.min.js?v=20260606-literature-pdf-viewer3"), "Runtime must load local PDF.js.");
assert(runtime.includes("vendor/pdf.worker.min.js?v=20260606-literature-pdf-viewer3"), "Runtime must configure local PDF.js worker.");
assert(runtime.includes("pdfjs.getDocument"), "Runtime must render with PDF.js.");
assert(runtime.includes("window.NPSHAuth?.requireApproved"), "Runtime must require the approved Google app session before opening protected PDFs.");
assert(runtime.includes("disableAutoFetch: true"), "Runtime must avoid full eager PDF fetches.");
assert(runtime.includes("rangeChunkSize: 131072"), "Runtime must request PDF range chunks.");
assert(runtime.includes("literature-pdf-canvas"), "Runtime must render PDF pages to a canvas.");
assert(runtime.includes("show-submenu"), "Runtime must support click/focus opening for the Literature flyout.");
assert(runtime.includes(":focus-within"), "Runtime CSS must keep the Literature flyout open while focused.");
assert(runtime.includes("contextmenu"), "Runtime must suppress context menu inside the literature viewer.");
assert(runtime.includes('key === "s" || key === "p"'), "Runtime must suppress save/print shortcuts inside the literature viewer.");
assert(runtime.includes("resize:both"), "Literature task window must be user-resizable.");
assert(runtime.includes("/api/literature/"), "Runtime must use the same-origin literature API.");
assert(!runtime.includes("github.com/faridazrighani/book_pdf"), "Runtime must not expose the private GitHub repository URL.");
assert(!runtime.includes("media.githubusercontent.com"), "Runtime must not expose the GitHub media URL.");
assert(!index.includes("media.githubusercontent.com"), "Index must not expose GitHub media URLs.");

assert(
  packageJson.scripts?.["validate:literature-pdf-viewer"] === "node tools/validate-literature-pdf-viewer.cjs",
  "package.json must expose validate:literature-pdf-viewer."
);
assert(
  manifest.includes("Literature PDF viewer cache key: engineering-literature-pdf-viewer.js?v=20260607-literature-pdf-viewer4"),
  "Manifest must document the literature viewer cache key."
);
assert(
  manifest.includes("Literature PDF viewer validation: npm run validate:literature-pdf-viewer"),
  "Manifest must document literature viewer validation."
);

console.log("Literature PDF viewer validation passed.");
