/* Carlingsview Yard Check — driver form (no pen, no paper) */
"use strict";

/* ---------------- section definitions (mirrors the paper sheet) ---------------- */
const SECTIONS = [
  { id: "rows",    title: "Trailers with Rows",             cols: ["Trailer number", "Quantity (IN Rows)"],  types: ["text", "number"], start: 3 },
  { id: "product", title: "Trailers with Product",          cols: ["Trailer number", "Sales Day"],           types: ["text", "text"],   start: 1 },
  { id: "third",   title: "3rd Party Empty Trailers",       cols: ["Trailer number", "Company"],             types: ["text", "text"],   start: 3,
    companyList: ["EFS", "FedEx", "UPS", "Other"] },
  { id: "storage", title: "Storage & Locked Out Trailers",  cols: ["Trailer number", "Contents"],            types: ["text", "text"],   start: 3,
    contentsList: ["PARTS", "EMPTY", "EFS", "REEFER"] },
  { id: "dock",    title: "Plant Dock Door #",              cols: ["Wonderbrands Empty Trailer #", "Door #"], types: ["text", "text"], start: 4 },
  { id: "dollies", title: "Dollies",                        cols: ["Quantity"],                              types: ["number"],        start: 1 },
  { id: "broken",  title: "Trailers with Broken Trays",     cols: ["Quantity"],                              types: ["number"],        start: 1 },
];

const STORE_KEY = "yardcheck.history.v1";
const DRAFT_KEY = "yardcheck.draft.v1";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------------- rendering ---------------- */
function renderSections() {
  const main = $("#sections");
  main.innerHTML = "";
  for (const sec of SECTIONS) {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.sec = sec.id;
    card.innerHTML = `
      <div class="card-head"><h2>${sec.title}</h2></div>
      <div class="table-wrap">
        <table>
          <thead><tr>${sec.cols.map(c => `<th>${c}</th>`).join("")}<th></th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <button class="add-row" type="button">＋ Add row</button>`;
    const tbody = $("tbody", card);
    for (let i = 0; i < sec.start; i++) tbody.appendChild(makeRow(sec));
    $(".add-row", card).addEventListener("click", () => {
      tbody.appendChild(makeRow(sec));
      const inputs = $$("input, select", tbody);
      if (inputs.length) inputs[inputs.length - (sec.cols.length)].focus();
      saveDraft();
    });
    main.appendChild(card);
  }
}

function makeRow(sec, vals = []) {
  const tr = document.createElement("tr");
  sec.cols.forEach((_, ci) => {
    const td = document.createElement("td");
    if (sec.types[ci] === "number") td.className = "num";
    let el;
    if (sec.companyList && ci === 1 && sec.id === "third") el = makeSelect(sec.companyList);
    else if (sec.contentsList && ci === 1 && sec.id === "storage") el = makeSelect(sec.contentsList);
    else {
      el = document.createElement("input");
      el.type = sec.types[ci] === "number" ? "number" : "text";
      el.inputMode = sec.types[ci] === "number" ? "numeric" : "text";
    }
    el.value = vals[ci] ?? "";
    el.dataset.col = ci;
    el.addEventListener("input", saveDraft);
    td.appendChild(el);
    tr.appendChild(td);
  });
  const tdDel = document.createElement("td");
  const del = document.createElement("button");
  del.type = "button";
  del.className = "del";
  del.textContent = "✕";
  del.setAttribute("aria-label", "Remove row");
  del.addEventListener("click", () => { tr.remove(); saveDraft(); });
  tdDel.appendChild(del);
  tr.appendChild(tdDel);
  return tr;
}

function makeSelect(options) {
  const sel = document.createElement("select");
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "—";
  sel.appendChild(blank);
  for (const o of options) {
    const opt = document.createElement("option");
    opt.value = o;
    opt.textContent = o;
    sel.appendChild(opt);
  }
  sel.addEventListener("change", saveDraft);
  return sel;
}

/* ---------------- data get/set ---------------- */
function collect() {
  const sections = {};
  for (const sec of SECTIONS) {
    const card = $(`.card[data-sec="${sec.id}"]`);
    sections[sec.id] = $$("tbody tr", card).map(tr =>
      $$("input, select", tr).map(el => el.value.trim())
    ).filter(row => row.some(v => v !== ""));
  }
  return {
    yard: $("#yard").textContent.trim() || "Carlingsview Yard",
    date: $("#date").value,
    time: $("#time").value,
    notes: $("#notes").value.trim(),
    sections,
    updatedAt: new Date().toISOString(),
  };
}

function populate(data) {
  $("#yard").textContent = data.yard || "Carlingsview Yard";
  $("#date").value = data.date || "";
  $("#time").value = data.time || "";
  $("#notes").value = data.notes || "";
  for (const sec of SECTIONS) {
    const card = $(`.card[data-sec="${sec.id}"]`);
    const tbody = $("tbody", card);
    tbody.innerHTML = "";
    const rows = (data.sections && data.sections[sec.id]) || [];
    const n = Math.max(rows.length, sec.start === 1 ? 1 : 0);
    for (let i = 0; i < n; i++) tbody.appendChild(makeRow(sec, rows[i] || []));
  }
}

/* ---------------- draft + history ---------------- */
let saveTimer = null;
function saveDraft() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(collect())); } catch (e) {}
  }, 300);
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch (e) { return []; }
}
function writeHistory(list) {
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
  $("#hist-count").textContent = list.length ? String(list.length) : "";
}

function saveCheck() {
  const data = collect();
  if (!data.date) { toast("Set the date first"); return; }
  const list = loadHistory();
  const id = data.date + "T" + (data.time || "00:00");
  const idx = list.findIndex(x => x.id === id);
  data.id = id;
  data.savedAt = new Date().toISOString();
  if (idx >= 0) list[idx] = data; else list.unshift(data);
  list.sort((a, b) => b.id.localeCompare(a.id));
  writeHistory(list.slice(0, 100));
  toast(idx >= 0 ? "Updated today's check ✓" : "Saved ✓");
}

/* ---------------- PDF ---------------- */
function buildPDF(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const M = 32;
  let y = M;

  const dt = data.date ? new Date(data.date + "T00:00:00") : new Date();
  const dateStr = dt.toLocaleDateString("en-CA", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  const timeStr = data.time ? fmt12(data.time) : "";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`${data.yard} — Yard Check`, M, y); y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`DATE: ${dateStr}    Time: ${timeStr}`, M, y); y += 14;
  doc.setDrawColor(120); doc.setLineWidth(.7);
  doc.line(M, y, doc.internal.pageSize.getWidth() - M, y); y += 10;

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  for (const sec of SECTIONS) {
    const rows = data.sections[sec.id] || [];
    if (!rows.length) continue;

    const head = [sec.cols];
    const body = rows.map(r => r.map((v, i) =>
      sec.types[i] === "number" && v !== "" && !isNaN(v) ? Number(v) : v));

    // estimate height: title + header + rows
    const est = 20 + 18 + body.length * 15;
    if (y + est > pageH - M - 16) { doc.addPage(); y = M; }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(sec.title, M, y); y += 6;

    doc.autoTable({
      head, body: body.map(r => [...r]),
      startY: y,
      margin: { left: M, right: M, bottom: 44 },
      styles: { font: "helvetica", fontSize: 9, cellPadding: 4, lineColor: [180,185,192], lineWidth: .5, textColor: [20,25,35] },
      headStyles: { fillColor: [235,238,243], textColor: [40,50,70], fontStyle: "bold", fontSize: 8.5 },
      alternateRowStyles: { fillColor: [248,249,251] },
      columnStyles: sec.types.reduce((acc, t, i) => {
        if (t === "number") acc[i] = { halign: "center" };
        return acc;
      }, {}),
    });
    y = doc.lastAutoTable.finalY + 14;
  }

  if (data.notes) {
    if (y + 60 > pageH - M) { doc.addPage(); y = M; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("Notes / Remarks", M, y); y += 6;
    doc.autoTable({
      body: [[data.notes]],
      startY: y,
      margin: { left: M, right: M, bottom: 44 },
      styles: { font: "helvetica", fontSize: 9, cellPadding: 5, lineColor: [180,185,192], lineWidth: .5, textColor: [20,25,35] },
      columnStyles: { 0: { cellWidth: "auto" } },
    });
    y = doc.lastAutoTable.finalY;
  }

  // footer note on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text("DRIVER to hand deliver a copy of the yard check to supervisor on duty at Carlingsview",
      M, pageH - 20);
    doc.text(`Page ${p} of ${pages}`, pageW - M, pageH - 20, { align: "right" });
  }
  return doc;
}

function fmt12(t) {
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
}

function pdfFilename(data) {
  const yard = (data.yard || "yard").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
  return `YardCheck_${yard}_${data.date || "undated"}.pdf`;
}

/* ---------------- share ---------------- */
async function shareCheck() {
  const data = collect();
  const hasData = Object.values(data.sections).some(rows => rows.length);
  if (!hasData) { toast("Nothing to share yet"); return; }

  const doc = buildPDF(data);
  const blob = doc.output("blob");
  const file = new File([blob], pdfFilename(data), { type: "application/pdf" });

  // 1) native share sheet (phones) — lands in Gmail/Outlook/WhatsApp with PDF attached
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `Yard Check — ${data.yard} — ${data.date}`,
        text: `Yard check for ${data.yard}, ${data.date}${data.time ? " " + fmt12(data.time) : ""}.`,
      });
      toast("Shared ✓");
      return;
    } catch (e) {
      if (e && e.name === "AbortError") return; // user cancelled
    }
  }
  // 2) desktop fallback — download + open mail composer
  downloadBlob(blob, pdfFilename(data));
  const body = encodeURIComponent(
    `Yard check for ${data.yard}\nDate: ${data.date}${data.time ? "  Time: " + fmt12(data.time) : ""}\n\n` +
    `PDF attached (downloaded as ${pdfFilename(data)}).\n\n` +
    summarize(data));
  window.location.href = `mailto:?subject=${encodeURIComponent(`Yard Check — ${data.yard} — ${data.date}`)}&body=${body}`;
}

function summarize(data) {
  const lines = [];
  for (const sec of SECTIONS) {
    const rows = data.sections[sec.id] || [];
    if (!rows.length) continue;
    lines.push(`== ${sec.title} ==`);
    for (const r of rows) lines.push("  " + r.join(" | "));
  }
  if (data.notes) lines.push("== Notes ==", "  " + data.notes);
  return lines.join("\n");
}

function downloadBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* ---------------- history UI ---------------- */
function renderHistory() {
  const list = loadHistory();
  const ul = $("#hist-list");
  ul.innerHTML = "";
  $("#hist-empty").hidden = list.length > 0;
  for (const item of list) {
    const li = document.createElement("li");
    const dt = new Date(item.date + "T00:00:00");
    const when = document.createElement("div");
    when.className = "when";
    when.innerHTML = `<strong>${dt.toLocaleDateString("en-CA", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</strong>
      <small>${item.time ? fmt12(item.time) : ""} · ${Object.values(item.sections || {}).reduce((n, r) => n + r.length, 0)} rows · ${item.yard || ""}</small>`;
    when.addEventListener("click", () => {
      populate(item);
      $("#history-dialog").close();
      saveDraft();
      toast("Loaded ✓");
    });
    const del = document.createElement("button");
    del.className = "del-h";
    del.textContent = "🗑";
    del.addEventListener("click", () => {
      writeHistory(loadHistory().filter(x => x.id !== item.id));
      renderHistory();
    });
    li.append(when, del);
    ul.appendChild(li);
  }
}

/* ---------------- misc ---------------- */
let toastTimer = null;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

function newCheck() {
  if (!confirm("Start a new blank yard check? Unsaved edits in the form will be cleared.")) return;
  const now = new Date();
  populate({
    yard: $("#yard").textContent.trim(),
    date: now.toISOString().slice(0, 10),
    time: String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0"),
    notes: "",
    sections: {},
  });
  saveDraft();
  toast("Blank check ready");
}

/* ---------------- boot ---------------- */
function boot() {
  renderSections();

  const now = new Date();
  $("#date").value = now.toISOString().slice(0, 10);
  $("#time").value = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");

  // restore draft (accidental refresh-proof)
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
    if (draft && draft.date) populate(draft);
  } catch (e) {}

  $("#date").addEventListener("change", saveDraft);
  $("#time").addEventListener("change", saveDraft);
  $("#notes").addEventListener("input", saveDraft);
  $("#yard").addEventListener("input", saveDraft);

  $("#btn-save").addEventListener("click", saveCheck);
  $("#btn-pdf").addEventListener("click", () => {
    const data = collect();
    buildPDF(data).save(pdfFilename(data));
    toast("PDF downloaded ✓");
  });
  $("#btn-share").addEventListener("click", shareCheck);
  $("#btn-new").addEventListener("click", newCheck);
  $("#btn-history").addEventListener("click", () => { renderHistory(); $("#history-dialog").showModal(); });
  $("#hist-close").addEventListener("click", () => $("#history-dialog").close());

  writeHistory(loadHistory());
}

document.addEventListener("DOMContentLoaded", boot);
