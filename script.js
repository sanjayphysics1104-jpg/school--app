const defaultNotices = [
  {
    type: "notice",
    label: "Admission",
    date: "01 Nov 2026",
    title: "Admissions open for the 2026–27 session",
    text: "Applications are invited for Nursery to Class VIII. Contact the school office for availability.",
    featured: true
  },
  {
    type: "homework",
    label: "Homework",
    date: "31 Oct 2026",
    title: "Weekly practice reminder",
    text: "Students should complete the assigned English and Mathematics practice before Monday."
  },
  {
    type: "circular",
    label: "Circular",
    date: "28 Oct 2026",
    title: "Parent–teacher meeting",
    text: "The next parent–teacher interaction will be held class-wise. Timings will be shared by teachers."
  },
  {
    type: "notice",
    label: "School update",
    date: "25 Oct 2026",
    title: "Winter timing update",
    text: "Revised winter timings will be announced soon. Please check the notice board for confirmation."
  }
];

const STORAGE_KEY = "sunshine-academy-admin-updates";

function loadAdminUpdates() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter((item) => item.title && item.text && item.type) : [];
  } catch {
    return [];
  }
}

let adminUpdates = loadAdminUpdates();
let notices = [...adminUpdates, ...defaultNotices];

const noticeList = document.querySelector("#notice-list");
const filters = document.querySelectorAll(".filter");
const menuButton = document.querySelector(".menu-button");
const navLinks = document.querySelector(".nav-links");
const form = document.querySelector("#enquiry-form");
const formStatus = document.querySelector("#form-status");
const installButton = document.querySelector("#install-app");
const adminForm = document.querySelector("#admin-update-form");
const adminStatus = document.querySelector("#admin-status");
const resourceForms = document.querySelectorAll(".resource-upload-form");
const resourceLibrary = document.querySelector("#resource-library");
const resourceCount = document.querySelector("#resource-count");
let deferredInstallPrompt;

const RESOURCE_STORAGE_KEY = "sunshine-academy-resources";
const MAX_PDF_BYTES = 2 * 1024 * 1024;
const MAX_STORED_CHARACTERS = 2.8 * 1024 * 1024;

function loadResources() {
  try {
    const saved = JSON.parse(localStorage.getItem(RESOURCE_STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter((item) => item.title && item.dataUrl && item.mime) : [];
  } catch {
    return [];
  }
}

let resources = loadResources();

function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character]);
}

function renderNotices(filter = "all") {
  const items = filter === "all" ? notices.slice(0, 3) : notices.filter((notice) => notice.type === filter);
  noticeList.innerHTML = items.map((notice) => `
    <article class="notice-card ${notice.featured ? "featured" : ""}">
      <div class="notice-meta">
        <span class="notice-type">${escapeHTML(notice.label)}</span>
        <time class="notice-date">${escapeHTML(notice.date)}</time>
      </div>
      <h3>${escapeHTML(notice.title)}</h3>
      <p>${escapeHTML(notice.text)}</p>
      <button type="button" aria-label="Read ${escapeHTML(notice.title)}">Read update →</button>
    </article>
  `).join("");
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("The selected file could not be read."));
    reader.readAsDataURL(file);
  });
}

async function prepareResourceFile(file) {
  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf";
  if (!isImage && !isPdf) throw new Error("Please choose an image or PDF file.");
  if (isPdf && file.size > MAX_PDF_BYTES) throw new Error("PDF files must be 2 MB or smaller.");

  const originalData = await readFileAsDataURL(file);
  if (!isImage || file.size < 900 * 1024) return { dataUrl: originalData, mime: file.type };

  try {
    const image = await new Promise((resolve, reject) => {
      const preview = new Image();
      preview.onload = () => resolve(preview);
      preview.onerror = reject;
      preview.src = originalData;
    });
    const maximumSide = 1400;
    const scale = Math.min(1, maximumSide / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL("image/jpeg", .82), mime: "image/jpeg" };
  } catch {
    return { dataUrl: originalData, mime: file.type };
  }
}

function renderResources() {
  resourceLibrary.replaceChildren();
  resourceCount.textContent = `${resources.length} ${resources.length === 1 ? "file" : "files"}`;

  if (!resources.length) {
    const empty = document.createElement("div");
    empty.className = "resource-empty";
    empty.innerHTML = "<span aria-hidden=\"true\">▧</span><strong>No files uploaded yet</strong><p>Your question papers and study notes will appear here.</p>";
    resourceLibrary.append(empty);
    return;
  }

  resources.forEach((resource) => {
    const card = document.createElement("article");
    card.className = "resource-card";

    const preview = document.createElement("div");
    preview.className = "resource-preview";
    if (resource.mime.startsWith("image/")) {
      const image = document.createElement("img");
      image.src = resource.dataUrl;
      image.alt = `Preview of ${resource.title}`;
      image.loading = "lazy";
      preview.append(image);
    } else {
      preview.classList.add("pdf-preview");
      preview.innerHTML = "<div><span aria-hidden=\"true\">▤</span><small>PDF DOCUMENT</small></div>";
    }

    const body = document.createElement("div");
    body.className = "resource-body";
    const kind = document.createElement("span");
    kind.className = "resource-kind";
    kind.textContent = resource.kind === "question-paper" ? "Question Paper" : "Study Notes";
    const title = document.createElement("h4");
    title.textContent = resource.title;
    const meta = document.createElement("p");
    meta.className = "resource-meta";
    meta.textContent = `${resource.name} · ${resource.date}`;

    const actions = document.createElement("div");
    actions.className = "resource-actions";
    const view = document.createElement("a");
    view.href = resource.dataUrl;
    view.target = "_blank";
    view.rel = "noopener";
    view.textContent = resource.mime === "application/pdf" ? "Open PDF ↗" : "View image ↗";
    const remove = document.createElement("button");
    remove.className = "resource-remove";
    remove.type = "button";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      resources = resources.filter((item) => item.id !== resource.id);
      localStorage.setItem(RESOURCE_STORAGE_KEY, JSON.stringify(resources));
      renderResources();
    });
    actions.append(view, remove);
    body.append(kind, title, meta, actions);
    card.append(preview, body);
    resourceLibrary.append(card);
  });
}

filters.forEach((button) => {
  button.addEventListener("click", () => {
    filters.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderNotices(button.dataset.filter);
  });
});

adminForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(adminForm);
  const type = String(data.get("category"));
  const labels = { notice: "Notice", homework: "Homework", circular: "Circular" };
  const update = {
    id: Date.now(),
    type,
    label: labels[type] || "Notice",
    date: new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date()),
    title: String(data.get("title")).trim(),
    text: String(data.get("description")).trim()
  };

  if (!update.title || !update.text) return;

  adminUpdates.unshift(update);
  notices = [...adminUpdates, ...defaultNotices];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(adminUpdates));
  } catch {
    adminStatus.textContent = "Update added, but this browser could not save it for later.";
  }

  filters.forEach((item) => item.classList.toggle("active", item.dataset.filter === "all"));
  renderNotices();
  adminForm.reset();
  if (!adminStatus.textContent) adminStatus.textContent = "Update added to the notice board.";
  noticeList.querySelector(".notice-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => { adminStatus.textContent = ""; }, 5000);
});

resourceForms.forEach((resourceForm) => {
  const fileInput = resourceForm.querySelector('input[type="file"]');
  const fileName = resourceForm.querySelector("[data-file-name]");
  const status = resourceForm.querySelector(".upload-status");
  const submitButton = resourceForm.querySelector('button[type="submit"]');

  fileInput.addEventListener("change", () => {
    fileName.textContent = fileInput.files[0]?.name || "No file selected";
    status.textContent = "";
    status.classList.remove("error");
  });

  resourceForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = fileInput.files[0];
    const title = resourceForm.elements.title.value.trim();
    if (!file || !title) return;

    status.textContent = "Preparing preview…";
    status.classList.remove("error");
    submitButton.disabled = true;

    try {
      const prepared = await prepareResourceFile(file);
      if (prepared.dataUrl.length > MAX_STORED_CHARACTERS) throw new Error("This file is still too large. Try a smaller image or PDF.");
      const item = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind: resourceForm.dataset.kind,
        title,
        name: file.name,
        mime: prepared.mime,
        dataUrl: prepared.dataUrl,
        date: new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date())
      };
      resources.unshift(item);
      try {
        localStorage.setItem(RESOURCE_STORAGE_KEY, JSON.stringify(resources));
      } catch {
        resources.shift();
        throw new Error("Browser storage is full. Remove an older file and try again.");
      }
      renderResources();
      resourceForm.reset();
      fileName.textContent = "No file selected";
      status.textContent = "Uploaded and saved on this device.";
      resourceLibrary.querySelector(".resource-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("error");
    } finally {
      submitButton.disabled = false;
    }
  });
});

menuButton.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("menu-open", open);
});

navLinks.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const message = `Hello The Sunshine Academy, I am ${data.get("name")}. I would like admission information for ${data.get("class")}. My contact number is ${data.get("phone")}.`;
  formStatus.textContent = "Opening WhatsApp with your enquiry…";
  window.open(`https://wa.me/917488875827?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
});

const revealObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll(".reveal").forEach((item) => revealObserver.observe(item));
document.querySelector("#year").textContent = new Date().getFullYear();
renderNotices();
renderResources();

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => console.warn("Service worker registration failed:", error));
  });
}
