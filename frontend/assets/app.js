const API_BASE = window.MIDAS_API_BASE || "";

const metricsEl = document.getElementById("metrics");
const tableEl = document.getElementById("lead-table");
const uploadForm = document.getElementById("upload-form");
const fileInput = document.getElementById("lead-file");
const uploadMessage = document.getElementById("upload-message");
const searchInput = document.getElementById("search-input");
const statusFilter = document.getElementById("status-filter");

const defaultMetrics = [
  ["Total Leads", 0],
  ["New", 0],
  ["Outreached", 0],
  ["Follow Up Due", 0],
  ["Replied", 0],
  ["Opted Out", 0],
];

function renderMetricCards(metrics) {
  const cards = [
    ["Total Leads", metrics.total_leads ?? 0],
    ["New", (metrics.total_leads ?? 0) - (metrics.outreached ?? 0) - (metrics.replied ?? 0) - (metrics.follow_up_due ?? 0)],
    ["Outreached", metrics.outreached ?? 0],
    ["Follow Up Due", metrics.follow_up_due ?? 0],
    ["Replied", metrics.replied ?? 0],
    ["Conversion Rate", `${metrics.conversion_rate ?? 0}%`],
  ];

  metricsEl.innerHTML = cards
    .map(
      ([label, value]) =>
        `<article class="card"><div class="label">${label}</div><div class="value">${value}</div></article>`,
    )
    .join("");
}

function renderFallbackMetrics() {
  metricsEl.innerHTML = defaultMetrics
    .map(
      ([label, value]) =>
        `<article class="card"><div class="label">${label}</div><div class="value">${value}</div></article>`,
    )
    .join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderLeads(leads) {
  if (!leads.length) {
    tableEl.innerHTML = '<tr><td colspan="6">No leads found.</td></tr>';
    return;
  }

  tableEl.innerHTML = leads
    .map((lead) => {
      const createdDate = new Date(lead.created_at);
      const formatted = Number.isNaN(createdDate.valueOf())
        ? "-"
        : createdDate.toLocaleDateString();
      return `<tr>
        <td>${escapeHtml(lead.name)}</td>
        <td>${escapeHtml(lead.email)}</td>
        <td>${escapeHtml(lead.company || "-")}</td>
        <td>${escapeHtml(lead.position || "-")}</td>
        <td><span class="status-pill">${escapeHtml(lead.status.replaceAll("_", " "))}</span></td>
        <td>${formatted}</td>
      </tr>`;
    })
    .join("");
}

async function loadDashboard() {
  try {
    const response = await fetch(`${API_BASE}/api/v1/dashboard`);
    if (!response.ok) throw new Error(`dashboard status ${response.status}`);
    const payload = await response.json();
    renderMetricCards(payload.metrics || {});
  } catch {
    renderFallbackMetrics();
  }
}

async function loadLeads() {
  const search = searchInput.value.trim();
  const status = statusFilter.value;
  const query = new URLSearchParams({ limit: "100" });
  if (search) query.set("search", search);
  if (status) query.set("status", status);

  const response = await fetch(`${API_BASE}/api/v1/leads?${query.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load leads");
  }
  const payload = await response.json();
  renderLeads(payload.leads || []);
}

async function uploadLeads(event) {
  event.preventDefault();
  uploadMessage.className = "message";
  uploadMessage.textContent = "";

  const file = fileInput.files?.[0];
  if (!file) {
    uploadMessage.classList.add("error");
    uploadMessage.textContent = "Select a file before uploading.";
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  const submitBtn = uploadForm.querySelector("button[type='submit']");
  submitBtn.disabled = true;

  try {
    const response = await fetch(`${API_BASE}/api/v1/leads/import`, {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.detail || "Lead upload failed.");
    }

    uploadMessage.classList.add("success");
    uploadMessage.textContent = `Imported ${payload.inserted}. Existing ${payload.skipped_existing}. Opted-out skipped ${payload.skipped_opted_out}. Invalid ${payload.invalid_rows}.`;
    fileInput.value = "";

    await Promise.all([loadDashboard(), loadLeads()]);
  } catch (error) {
    uploadMessage.classList.add("error");
    uploadMessage.textContent = error instanceof Error ? error.message : "Upload failed.";
  } finally {
    submitBtn.disabled = false;
  }
}

uploadForm.addEventListener("submit", uploadLeads);
searchInput.addEventListener("input", () => {
  loadLeads().catch(() => {
    tableEl.innerHTML = '<tr><td colspan="6">Could not load leads.</td></tr>';
  });
});
statusFilter.addEventListener("change", () => {
  loadLeads().catch(() => {
    tableEl.innerHTML = '<tr><td colspan="6">Could not load leads.</td></tr>';
  });
});

loadDashboard();
loadLeads().catch(() => {
  tableEl.innerHTML = '<tr><td colspan="6">Could not load leads.</td></tr>';
});
