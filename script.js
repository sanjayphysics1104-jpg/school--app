const notices = [
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

const noticeList = document.querySelector("#notice-list");
const filters = document.querySelectorAll(".filter");
const menuButton = document.querySelector(".menu-button");
const navLinks = document.querySelector(".nav-links");
const form = document.querySelector("#enquiry-form");
const formStatus = document.querySelector("#form-status");
const installButton = document.querySelector("#install-app");
let deferredInstallPrompt;

function renderNotices(filter = "all") {
  const items = filter === "all" ? notices.slice(0, 3) : notices.filter((notice) => notice.type === filter);
  noticeList.innerHTML = items.map((notice) => `
    <article class="notice-card ${notice.featured ? "featured" : ""}">
      <div class="notice-meta">
        <span class="notice-type">${notice.label}</span>
        <time class="notice-date">${notice.date}</time>
      </div>
      <h3>${notice.title}</h3>
      <p>${notice.text}</p>
      <button type="button" aria-label="Read ${notice.title}">Read update →</button>
    </article>
  `).join("");
}

filters.forEach((button) => {
  button.addEventListener("click", () => {
    filters.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderNotices(button.dataset.filter);
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
