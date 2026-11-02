const defaultNotices = [
  { id: "admission-2026", type: "notice", label: "Admission", date: "01 Nov 2026", title: "Admissions open for the 2026–27 session", text: "Applications are invited for Nursery to Class VIII. Contact the school office for availability.", featured: true },
  { id: "weekly-practice", type: "homework", label: "Homework", date: "31 Oct 2026", title: "Weekly practice reminder", text: "Students should complete the assigned English and Mathematics practice before Monday." },
  { id: "parent-meeting", type: "circular", label: "Circular", date: "28 Oct 2026", title: "Parent–teacher meeting", text: "The next parent–teacher interaction will be held class-wise. Timings will be shared by teachers." },
  { id: "winter-timing", type: "notice", label: "School update", date: "25 Oct 2026", title: "Winter timing update", text: "Revised winter timings will be announced soon. Please check the notice board for confirmation." }
];

const DB_NAME = "sunshine-academy-library";
const DB_VERSION = 2;
const NOTICE_KEY = "sunshine-academy-admin-updates";
const HIDDEN_NOTICE_KEY = "sunshine-academy-hidden-notices";
const LEGACY_RESOURCE_KEY = "sunshine-academy-resources";
const ADMIN_PIN_HASH = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4";

const noticeList = document.querySelector("#notice-list");
const filters = document.querySelectorAll(".filter");
const menuButton = document.querySelector(".menu-button");
const navLinks = document.querySelector(".nav-links");
const enquiryForm = document.querySelector("#enquiry-form");
const formStatus = document.querySelector("#form-status");
const installButton = document.querySelector("#install-app");
const adminForm = document.querySelector("#admin-update-form");
const adminStatus = document.querySelector("#admin-status");
const resourceForms = document.querySelectorAll(".resource-upload-form");
const resourceLibrary = document.querySelector("#resource-library");
const resourceCount = document.querySelector("#resource-count");
const pdfForm = document.querySelector("#pdf-library-form");
const pdfGrid = document.querySelector("#pdf-library-grid");
const pdfCount = document.querySelector("#pdf-count");
const pdfSearch = document.querySelector("#pdf-search");
const pinDialog = document.querySelector("#pin-dialog");
const pinForm = document.querySelector("#pin-form");
const pinStatus = document.querySelector("#pin-status");
const viewerDialog = document.querySelector("#pdf-viewer-dialog");
const viewerFrame = document.querySelector("#pdf-viewer-frame");
const viewerTitle = document.querySelector("#viewer-title");
const viewerOpenNew = document.querySelector("#viewer-open-new");

let deferredInstallPrompt;
let pendingAdminTarget = null;
let isAdmin = sessionStorage.getItem("sunshine-admin-session") === "active";
let resources = [];
let pdfs = [];
let activeObjectUrl = null;
let resourceObjectUrls = [];

function loadArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

let adminUpdates = loadArray(NOTICE_KEY).filter((item) => item.title && item.text && item.type);
let hiddenNoticeIds = loadArray(HIDDEN_NOTICE_KEY);

function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatBytes(bytes = 0) {
  if (!bytes) return "Linked PDF";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("resources")) database.createObjectStore("resources", { keyPath: "id" });
      if (!database.objectStoreNames.contains("pdfs")) database.createObjectStore("pdfs", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open the device library."));
  });
}

async function dbRequest(storeName, mode, operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Device storage operation failed."));
    transaction.oncomplete = () => database.close();
  });
}

const getAll = (store) => dbRequest(store, "readonly", (objectStore) => objectStore.getAll());
const putItem = (store, item) => dbRequest(store, "readwrite", (objectStore) => objectStore.put(item));
const deleteItem = (store, id) => dbRequest(store, "readwrite", (objectStore) => objectStore.delete(id));

function dataUrlToBlob(dataUrl) {
  const [header, encoded] = dataUrl.split(",");
  const mime = header.match(/data:([^;]+)/)?.[1] || "application/octet-stream";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

async function migrateLegacyResources() {
  const legacy = loadArray(LEGACY_RESOURCE_KEY);
  if (!legacy.length) return;
  for (const item of legacy) {
    if (!item.dataUrl) continue;
    await putItem("resources", { id: item.id || crypto.randomUUID(), kind: item.kind, title: item.title, name: item.name, mime: item.mime, blob: dataUrlToBlob(item.dataUrl), date: item.date || formatDate(), createdAt: Date.now() });
  }
  localStorage.removeItem(LEGACY_RESOURCE_KEY);
}

function allNotices() {
  return [...adminUpdates, ...defaultNotices].filter((item) => !hiddenNoticeIds.includes(String(item.id)));
}

function renderNotices(filter = document.querySelector(".filter.active")?.dataset.filter || "all") {
  const items = filter === "all" ? allNotices() : allNotices().filter((notice) => notice.type === filter);
  noticeList.innerHTML = items.map((notice) => `
    <article class="notice-card ${notice.featured ? "featured" : ""}">
      <div class="notice-meta"><span class="notice-type">${escapeHTML(notice.label)}</span><time class="notice-date">${escapeHTML(notice.date)}</time></div>
      <h3>${escapeHTML(notice.title)}</h3><p>${escapeHTML(notice.text)}</p>
      <div class="notice-actions"><button type="button" aria-label="Read ${escapeHTML(notice.title)}">Read update →</button>${isAdmin ? `<button class="delete-control" type="button" data-delete-notice="${escapeHTML(notice.id)}" aria-label="Delete ${escapeHTML(notice.title)}">Delete</button>` : ""}</div>
    </article>`).join("") || '<div class="resource-empty"><span aria-hidden="true">☀</span><strong>No updates in this category</strong><p>Please check again later.</p></div>';
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function updateAdminUI() {
  document.body.classList.toggle("admin-mode", isAdmin);
  document.querySelectorAll("[data-admin-login]").forEach((button) => { button.textContent = isAdmin ? "Exit admin" : "Admin access"; });
  renderNotices();
  renderResources();
  renderPdfs();
}

function requestAdmin(targetId = null) {
  if (isAdmin) { if (targetId) revealAdminPanel(targetId); return; }
  pendingAdminTarget = targetId;
  pinStatus.textContent = "";
  pinForm.reset();
  pinDialog.showModal();
  window.setTimeout(() => document.querySelector("#admin-pin").focus(), 50);
}

function revealAdminPanel(targetId) {
  const panel = document.getElementById(targetId);
  if (!panel) return;
  panel.hidden = false;
  panel.scrollIntoView({ behavior: "smooth", block: "center" });
  panel.querySelector("input, select, textarea")?.focus({ preventScroll: true });
}

document.querySelectorAll("[data-admin-action]").forEach((button) => button.addEventListener("click", () => requestAdmin(button.dataset.adminAction)));
document.querySelectorAll("[data-admin-login]").forEach((button) => button.addEventListener("click", () => {
  if (isAdmin) {
    isAdmin = false;
    sessionStorage.removeItem("sunshine-admin-session");
    document.querySelectorAll(".admin-only-panel").forEach((panel) => { panel.hidden = true; });
    updateAdminUI();
  } else requestAdmin();
}));

pinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const pin = String(new FormData(pinForm).get("pin") || "");
  if (!/^\d{4}$/.test(pin) || await sha256(pin) !== ADMIN_PIN_HASH) {
    pinStatus.textContent = "Incorrect passcode. Please try again.";
    pinForm.querySelector("input").select();
    return;
  }
  isAdmin = true;
  sessionStorage.setItem("sunshine-admin-session", "active");
  pinDialog.close();
  updateAdminUI();
  if (pendingAdminTarget) revealAdminPanel(pendingAdminTarget);
  pendingAdminTarget = null;
});

filters.forEach((button) => button.addEventListener("click", () => {
  filters.forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  renderNotices(button.dataset.filter);
}));

noticeList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-notice]");
  if (!deleteButton || !isAdmin) return;
  const id = deleteButton.dataset.deleteNotice;
  adminUpdates = adminUpdates.filter((item) => String(item.id) !== id);
  if (defaultNotices.some((item) => String(item.id) === id)) hiddenNoticeIds.push(id);
  localStorage.setItem(NOTICE_KEY, JSON.stringify(adminUpdates));
  localStorage.setItem(HIDDEN_NOTICE_KEY, JSON.stringify([...new Set(hiddenNoticeIds)]));
  renderNotices();
});

adminForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!isAdmin) return requestAdmin("notice-form");
  const data = new FormData(adminForm);
  const type = String(data.get("category"));
  const update = { id: crypto.randomUUID(), type, label: ({ notice: "Notice", homework: "Homework", circular: "Circular" })[type] || "Notice", date: formatDate(), title: String(data.get("title")).trim(), text: String(data.get("description")).trim() };
  if (!update.title || !update.text) return;
  adminUpdates.unshift(update);
  localStorage.setItem(NOTICE_KEY, JSON.stringify(adminUpdates));
  filters.forEach((item) => item.classList.toggle("active", item.dataset.filter === "all"));
  renderNotices();
  adminForm.reset();
  adminStatus.textContent = "Notice added successfully.";
  window.setTimeout(() => { adminStatus.textContent = ""; }, 4000);
});

function renderResources() {
  resourceObjectUrls.forEach(URL.revokeObjectURL);
  resourceObjectUrls = [];
  resourceLibrary.replaceChildren();
  resourceCount.textContent = `${resources.length} ${resources.length === 1 ? "file" : "files"}`;
  if (!resources.length) {
    resourceLibrary.innerHTML = '<div class="resource-empty"><span aria-hidden="true">▧</span><strong>No files uploaded yet</strong><p>Question papers and study notes will appear here.</p></div>';
    return;
  }
  resources.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).forEach((resource) => {
    const url = URL.createObjectURL(resource.blob);
    resourceObjectUrls.push(url);
    const card = document.createElement("article");
    card.className = "resource-card";
    const previewContent = resource.mime.startsWith("image/") ? `<img src="${url}" alt="Preview of ${escapeHTML(resource.title)}" loading="lazy">` : '<span class="pdf-preview"><span aria-hidden="true">▤</span><small>PDF DOCUMENT</small></span>';
    card.innerHTML = `<button class="resource-preview open-resource" type="button" aria-label="Open ${escapeHTML(resource.title)}">${previewContent}</button><div class="resource-body"><span class="resource-kind">${resource.kind === "question-paper" ? "Question Paper" : "Study Notes"}</span><h4>${escapeHTML(resource.title)}</h4><p class="resource-meta">${escapeHTML(resource.name)} · ${escapeHTML(resource.date)}</p><div class="resource-actions"><button class="open-resource" type="button">${resource.mime === "application/pdf" ? "Read PDF" : "View image"} →</button>${isAdmin ? '<button class="resource-remove delete-control" type="button">Delete</button>' : ""}</div></div>`;
    card.querySelectorAll(".open-resource").forEach((button) => button.addEventListener("click", () => resource.mime === "application/pdf" ? openPdfViewer(resource.title, resource.blob) : window.open(url, "_blank", "noopener,noreferrer")));
    card.querySelector(".resource-remove")?.addEventListener("click", async () => {
      if (!isAdmin) return;
      await deleteItem("resources", resource.id);
      resources = resources.filter((item) => item.id !== resource.id);
      renderResources();
    });
    resourceLibrary.append(card);
  });
}

resourceForms.forEach((resourceForm) => {
  const fileInput = resourceForm.querySelector('input[type="file"]');
  const fileName = resourceForm.querySelector("[data-file-name]");
  const status = resourceForm.querySelector(".upload-status");
  const submitButton = resourceForm.querySelector('button[type="submit"]');
  fileInput.addEventListener("change", () => { fileName.textContent = fileInput.files[0]?.name || "No file selected"; status.textContent = ""; });
  resourceForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!isAdmin) return requestAdmin(resourceForm.id);
    const file = fileInput.files[0];
    const title = resourceForm.elements.title.value.trim();
    if (!file || !title) return;
    if (!(file.type.startsWith("image/") || file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) { status.textContent = "Please choose an image or PDF."; status.classList.add("error"); return; }
    submitButton.disabled = true;
    status.classList.remove("error");
    status.textContent = "Saving to the device library…";
    try {
      const item = { id: crypto.randomUUID(), kind: resourceForm.dataset.kind, title, name: file.name, mime: file.type || "application/pdf", blob: file, date: formatDate(), createdAt: Date.now() };
      await putItem("resources", item);
      resources.unshift(item);
      renderResources();
      resourceForm.reset();
      fileName.textContent = "No file selected";
      status.textContent = "Uploaded and saved on this device.";
    } catch (error) {
      status.textContent = error.name === "QuotaExceededError" ? "Device storage is full. Remove older files or free device space." : error.message;
      status.classList.add("error");
    } finally { submitButton.disabled = false; }
  });
});

function normalizePdfUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Please use a secure https:// link.");
  const driveMatch = url.href.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  return driveMatch ? `https://drive.google.com/file/d/${driveMatch[1]}/preview` : url.href;
}

function renderPdfs() {
  const query = pdfSearch.value.trim().toLowerCase();
  const visible = pdfs.filter((pdf) => `${pdf.title} ${pdf.category || ""}`.toLowerCase().includes(query));
  pdfCount.textContent = `${pdfs.length} ${pdfs.length === 1 ? "PDF" : "PDFs"}`;
  pdfGrid.replaceChildren();
  if (!visible.length) {
    pdfGrid.innerHTML = `<div class="resource-empty"><span aria-hidden="true">▤</span><strong>${pdfs.length ? "No matching PDFs" : "The PDF shelf is ready"}</strong><p>${pdfs.length ? "Try another search." : "Admin-added books and documents will appear here."}</p></div>`;
    return;
  }
  visible.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).forEach((pdf) => {
    const card = document.createElement("article");
    card.className = "pdf-library-card";
    card.innerHTML = `<button class="pdf-card-open" type="button"><span class="pdf-book-icon" aria-hidden="true">PDF</span><span class="pdf-card-copy"><small>${escapeHTML(pdf.category || "School Library")}</small><strong>${escapeHTML(pdf.title)}</strong><span>${pdf.blob ? formatBytes(pdf.blob.size) : "Online document"} · ${escapeHTML(pdf.date)}</span></span><span class="pdf-open-arrow" aria-hidden="true">→</span></button>${isAdmin ? `<button class="pdf-delete delete-control" type="button" aria-label="Delete ${escapeHTML(pdf.title)}">Delete</button>` : ""}`;
    card.querySelector(".pdf-card-open").addEventListener("click", () => openPdfViewer(pdf.title, pdf.blob || pdf.url));
    card.querySelector(".pdf-delete")?.addEventListener("click", async () => { if (!isAdmin) return; await deleteItem("pdfs", pdf.id); pdfs = pdfs.filter((item) => item.id !== pdf.id); renderPdfs(); });
    pdfGrid.append(card);
  });
}

pdfForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isAdmin) return requestAdmin("pdf-upload-panel");
  const status = document.querySelector("#pdf-upload-status");
  const submit = pdfForm.querySelector('button[type="submit"]');
  const file = pdfForm.elements.file.files[0];
  const rawUrl = pdfForm.elements.url.value.trim();
  const title = pdfForm.elements.title.value.trim();
  if (!file && !rawUrl) { status.textContent = "Choose a PDF file or paste a PDF sharing link."; status.classList.add("error"); return; }
  if (file && !(file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) { status.textContent = "The selected file must be a PDF."; status.classList.add("error"); return; }
  submit.disabled = true;
  status.classList.remove("error");
  status.textContent = "Saving PDF to IndexedDB…";
  try {
    const item = { id: crypto.randomUUID(), title, category: pdfForm.elements.category.value.trim(), name: file?.name || "Linked PDF", blob: file || null, url: file ? null : normalizePdfUrl(rawUrl), date: formatDate(), createdAt: Date.now() };
    await putItem("pdfs", item);
    pdfs.unshift(item);
    renderPdfs();
    pdfForm.reset();
    status.textContent = "PDF saved to the library.";
    if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  } catch (error) {
    status.textContent = error.name === "QuotaExceededError" ? "Device storage is full. Free space or remove an older PDF." : error.message;
    status.classList.add("error");
  } finally { submit.disabled = false; }
});

pdfSearch.addEventListener("input", renderPdfs);

function openPdfViewer(title, source) {
  if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
  activeObjectUrl = source instanceof Blob ? URL.createObjectURL(source) : null;
  const url = activeObjectUrl || source;
  viewerTitle.textContent = title;
  viewerFrame.src = url;
  viewerOpenNew.href = url;
  viewerDialog.showModal();
}

function closeViewer() {
  if (viewerDialog.open) viewerDialog.close();
}

function releaseViewer() {
  viewerFrame.src = "about:blank";
  if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
  activeObjectUrl = null;
}

document.querySelector("#viewer-close").addEventListener("click", closeViewer);
viewerDialog.addEventListener("click", (event) => { if (event.target === viewerDialog) closeViewer(); });
viewerDialog.addEventListener("close", releaseViewer);

menuButton.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("menu-open", open);
});

navLinks.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
  navLinks.classList.remove("open");
  menuButton.setAttribute("aria-expanded", "false");
  document.body.classList.remove("menu-open");
}));

enquiryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(enquiryForm);
  const message = `Hello The Sunshine Academy, I am ${data.get("name")}. I would like admission information for ${data.get("class")}. My contact number is ${data.get("phone")}.`;
  formStatus.textContent = "Opening WhatsApp with your enquiry…";
  window.open(`https://wa.me/917488875827?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
});

const revealObserver = new IntersectionObserver((entries, observer) => entries.forEach((entry) => {
  if (entry.isIntersecting) { entry.target.classList.add("visible"); observer.unobserve(entry.target); }
}), { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach((item) => revealObserver.observe(item));
document.querySelector("#year").textContent = new Date().getFullYear();

async function initialiseLibraries() {
  try {
    await migrateLegacyResources();
    [resources, pdfs] = await Promise.all([getAll("resources"), getAll("pdfs")]);
  } catch (error) { console.error("Library initialisation failed:", error); }
  updateAdminUI();
}

renderNotices();
renderResources();
renderPdfs();
initialiseLibraries();

window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); deferredInstallPrompt = event; installButton.hidden = false; });
installButton.addEventListener("click", async () => { if (!deferredInstallPrompt) return; deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; installButton.hidden = true; });
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch((error) => console.warn("Service worker registration failed:", error)));
