/* CIPHER runtime integration layer
   Keeps the existing UI/theme while making case/evidence/network/GIS/timeline/review
   follow one case-scoped data flow. */
(() => {
  const TOKEN_KEY = "cipher_access_token";
  const STATE_KEY = "cipher_active_case";
  const originalFetch = window.fetch.bind(window);
  const configuredApiBase = String(window.CIPHER_API_BASE || "").trim().replace(/\/$/, "");
  const localAutoApi = (!configuredApiBase && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) && window.location.port && window.location.port !== "8000")
    ? "http://127.0.0.1:8000"
    : "";
  const apiOrigin = /^https?:\/\//i.test(configuredApiBase) ? configuredApiBase : localAutoApi;

  const state = window.CipherCaseState = window.CipherCaseState || {
    id: 0,
    caseNumber: "",
    title: "",
    caseSelected: false,
  };

  const protectedPath = (path) =>
    path.startsWith("/api/") || path.startsWith("/cases/") || path.startsWith("/review/") || path.startsWith("/review-queue/");

  function rewriteCaseUrl(url) {
    if (!state.id) return url;
    return url.replace(/\/cases\/1(?=\/|$)/g, `/cases/${state.id}`);
  }

  window.fetch = function(input, init = {}) {
    let url = typeof input === "string" ? input : (input && input.url) || "";
    const caseRewritten = rewriteCaseUrl(url);
    let rewritten = caseRewritten;
    if (apiOrigin) {
      try {
        const u = new URL(caseRewritten, window.location.origin);
        const path = u.pathname;
        if (path.startsWith("/api/") || path.startsWith("/cases/") || path.startsWith("/review/") || path.startsWith("/review-queue/") || path.startsWith("/health") || path.startsWith("/docs")) {
          rewritten = apiOrigin + path + u.search + u.hash;
        }
      } catch {}
    }
    const parsedPath = new URL(rewritten, window.location.origin).pathname;
    const isProtected = protectedPath(parsedPath);
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    const token = localStorage.getItem(TOKEN_KEY) || localStorage.getItem("token") || sessionStorage.getItem(TOKEN_KEY) || sessionStorage.getItem("token") || "";
    if (isProtected && token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const request = (typeof input === "string" || input instanceof URL)
      ? originalFetch(rewritten, { ...init, headers })
      : originalFetch(new Request(rewritten, input), { ...init, headers });

    return request.then(response => {
      // A stale JWT (for example after a local database reset) must not leave
      // the workspace half-loaded. Clear only investigation-route auth; do not
      // treat an intentionally failed login/register request as session expiry.
      if (response.status === 401 && isProtected && !parsedPath.endsWith("/auth/login") && !parsedPath.endsWith("/auth/register")) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem("token");
        localStorage.removeItem("cipher_user");
        sessionStorage.removeItem(TOKEN_KEY);
        state.id = 0;
        state.caseNumber = "";
        window.dispatchEvent(new CustomEvent("cipher:auth-expired"));
      }
      return response;
    });
  };

  const esc = (v) => String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

  function authHeaders(json = true) {
    const h = {};
    const token = localStorage.getItem(TOKEN_KEY) || localStorage.getItem("token") || sessionStorage.getItem(TOKEN_KEY) || sessionStorage.getItem("token") || "";
    if (token) h.Authorization = `Bearer ${token}`;
    if (json) h["Content-Type"] = "application/json";
    return h;
  }

  // Shared auth helper for legacy CIPHER modules that execute before/after
  // this runtime integration layer. Keep one canonical token lookup.
  window.authHeaders = authHeaders;
  window.getAuthHeaders = authHeaders;

  window.addEventListener("cipher:auth-expired", () => {
    // A stale token may be discovered during the initial landing-page boot.
    // Do not hijack the public landing page with the login modal in that case.
    // Only redirect an investigator to authentication when the protected
    // workspace is actually open.
    try {
      const workspace = document.getElementById("cipherWorkspace");
      if (workspace?.classList.contains("open") && typeof window.cipherOpenAuth === "function") {
        window.cipherOpenAuth("login");
      }
    } catch {}
  });

  function notify(msg) {
    if (typeof window.showNetworkToast === "function") return window.showNetworkToast(msg);
    if (typeof window.notifyUser === "function") return window.notifyUser(msg);
    let el = document.getElementById("cipherRuntimeToast");
    if (!el) {
      el = document.createElement("div"); el.id = "cipherRuntimeToast";
      el.style.cssText = "position:fixed;right:24px;bottom:24px;z-index:99999;background:#081012;color:#d9ff55;border:1px solid #344f43;padding:12px 16px;border-radius:8px;font:12px/1.4 monospace;box-shadow:0 8px 30px rgba(0,0,0,.4);";
      document.body.appendChild(el);
    }
    el.textContent = msg; el.style.display = "block";
    clearTimeout(el._timer); el._timer = setTimeout(() => el.style.display = "none", 3500);
  }

  function setCaseState(c) {
    if (!c) return;
    const dbId = Number(c.id);
    if (!dbId) return;
    state.id = dbId; state.caseNumber = c.case_number || ""; state.title = c.title || "";
    localStorage.setItem(STATE_KEY, String(dbId));
    document.querySelectorAll("[data-cipher-case-number]").forEach(el => el.textContent = c.case_number || "");
    const ids = ["reportCaseStatus","aiCaseKicker","reviewCaseKicker"];
    ids.forEach(id => { const el=document.getElementById(id); if (el && c.case_number) el.textContent=`CASE / ${c.case_number}`; });
    const scope=document.getElementById("aiScopeCase"); if(scope) scope.textContent=`${c.case_number || "CASE"} (Active Case)`;
    const templateLink = document.getElementById("cipherCsvDownloadTemplateLink");
    if (templateLink) {
      templateLink.href = `/api/cases/${c.id}/sample-csv`;
      templateLink.download = `${c.case_number || `case-${c.id}`}_investigation_template.csv`;
    }
    const sampleBtn = document.getElementById("cipherCsvLoadSampleBtn");
    if (sampleBtn) sampleBtn.textContent = `Load ${c.case_number || "Case"} CSV Template ⤓`;

    const reportTitle=document.getElementById("reportTitle"); if(reportTitle) reportTitle.textContent=c.title || "CIPHER Investigation Case";
    const reportSub=document.getElementById("reportSubtitle"); if(reportSub) reportSub.textContent=`${c.case_type || "Investigation"} · ${c.incident_date || "Date not entered"} · ${c.primary_location || "Location not entered"}`;
    const reportId=document.querySelector('[data-report-field="caseId"]'); if(reportId) reportId.value=c.case_number || "";
    const type=document.querySelector('[data-report-field="caseType"]'); if(type) type.value=c.case_type || "Investigation";
    const date=document.querySelector('[data-report-field="incidentDate"]'); if(date) date.value=c.incident_date || "";
    syncReportFromCase(c);
    return c;
  }

  async function apiJson(url, options={}) {
    const res = await fetch(url, options);
    const text = await res.text();
    let data = {}; try { data = text ? JSON.parse(text) : {}; } catch { data = { detail: text }; }
    if (!res.ok) throw new Error(data.detail || data.error || `HTTP ${res.status}`);
    return data;
  }

  async function refreshCaseDiagnostics() {
    if (!state.id) return null;
    try {
      const data = await apiJson(`/api/cases/${state.id}/data-summary`, {headers: authHeaders(false)});
      updateWorkspaceStats(data);
      return data;
    } catch (e) {
      console.warn("case diagnostics", e);
      return null;
    }
  }

  function updateWorkspaceStats(data) {
    const counts = data?.counts || {};
    const verified = data?.verified || {};
    const side = document.querySelector(".side-bottom");
    if (side) side.innerHTML = `<span>${verified.entities ?? 0} VERIFIED ENTITIES</span><span>${verified.relationships ?? 0} VERIFIED LINKS</span><span>${counts.documents ?? 0} EVIDENCE</span>`;
    const navCase = document.querySelector(".workspace-case");
    if (navCase) navCase.innerHTML = `<span>CASE /</span> ${esc(state.caseNumber || state.title || "ACTIVE CASE")} <i></i> ACTIVE INVESTIGATION`;
    const netStatus = document.querySelector(".network-head-status b");
    if (netStatus) netStatus.textContent = `CASE / ${state.caseNumber || "ACTIVE"}`;
  }

  function ensureDynamicCaseRegister() {
    const stage = document.getElementById("caseStage");
    if (!stage || document.getElementById("cipherDynamicCaseRegister")) return;
    const wrap = document.createElement("div");
    wrap.id = "cipherDynamicCaseRegister";
    wrap.style.cssText = "position:relative;z-index:30;margin:0 18px 14px;padding:10px 12px;border:1px solid rgba(126,233,223,.15);background:rgba(7,15,17,.82);border-radius:8px;display:flex;gap:8px;align-items:center;overflow:auto;backdrop-filter:blur(8px);";
    wrap.innerHTML = '<span style="font:10px/1 DM Mono,monospace;color:#70827a;letter-spacing:.12em;white-space:nowrap;">CASE REGISTER</span><div id="cipherDynamicCaseButtons" style="display:flex;gap:7px;flex-wrap:wrap;"></div>';
    stage.parentNode.insertBefore(wrap, stage);
  }

  function renderDynamicCaseRegister(cases) {
    ensureDynamicCaseRegister();
    const holder = document.getElementById("cipherDynamicCaseButtons");
    if (!holder) return;
    holder.innerHTML = cases.map(c => `<button type="button" data-dynamic-case-id="${c.id}" style="border:1px solid ${Number(c.id)===Number(state.id)?"#7fe9df":"#294047"};background:${Number(c.id)===Number(state.id)?"rgba(127,233,223,.12)":"rgba(255,255,255,.02)"};color:#dce8e3;padding:6px 9px;border-radius:5px;font:10px DM Mono,monospace;cursor:pointer;white-space:nowrap;">${esc(c.case_number || "CASE")} · ${esc(c.title || "Investigation")}</button>`).join("");
    holder.querySelectorAll("[data-dynamic-case-id]").forEach(btn => btn.addEventListener("click", async () => {
      const c = cases.find(x => Number(x.id) === Number(btn.dataset.dynamicCaseId));
      if (c) await selectCase(c);
    }));
  }

  async function loadCases() {
    if (!localStorage.getItem(TOKEN_KEY)) return [];
    try {
      const data = await apiJson("/api/cases", {headers: authHeaders(false)});
      const cases = data.cases || [];
      renderCases(cases);
      renderDynamicCaseRegister(cases);
      // Do not auto-select a case. Network/Timeline/Review must remain empty until
      // the investigator explicitly selects a case from the Cases workspace.
      if (!state.caseSelected) {
        state.id = 0; state.caseNumber = ""; state.title = "";
        window.CipherLocalGraphData = null;
        window.CipherLocalTimelineData = null;
        window.CipherLocalTimelineCaseId = null;
      }
      return cases;
    } catch (e) {
      console.warn("CIPHER cases load:", e);
      return [];
    }
  }

  function buildOrbitCaseCard(c, index) {
    const card = document.createElement("article");
    card.className = `floating-case ${index === 2 ? "case-main" : "case-back"} c${index + 1}`;
    card.dataset.dbId = String(c.id);
    card.dataset.caseId = c.case_number || "";
    card.dataset.case = c.title || "Investigation";
    card.dataset.caseType = c.case_type || "Investigation";
    card.dataset.priority = c.priority || "MEDIUM";
    card.dataset.description = c.description || "Investigative case record.";
    card.dataset.incidentDate = c.incident_date || "";
    card.dataset.location = c.primary_location || "";
    card.dataset.officer = c.assigned_officer || "";
    card.dataset.jurisdiction = c.jurisdiction || "";
    card.dataset.tags = c.tags || "";
    const priority = String(c.priority || "MEDIUM").toUpperCase();
    const high = priority.includes("HIGH") || priority.includes("CRITICAL");
    card.innerHTML = `
      <div class="case-top"><span>CASE / ${esc(c.case_number || c.id)}</span><b class="${high ? "high" : ""}">${esc(priority)}</b></div>
      <div class="case-index">${esc(c.case_number || `CASE-${c.id}`)}</div>
      <h3>${esc(c.title || "Investigation")}</h3>
      <p>${esc(c.description || "Investigative case record.")}</p>
      <div class="case-stats"><span>${esc(c.case_type || "INVESTIGATION")}</span><span>${esc(c.primary_location || "LOCATION PENDING")}</span></div>
      <div class="case-footer"><span>${esc(c.incident_date || "DATE PENDING")}</span><button type="button">OPEN CASE ↗</button></div>`;
    return card;
  }

  function renderCaseLibrary(cases) {
    const list = document.getElementById("caseLibraryList");
    const count = document.getElementById("caseLibraryCount");
    if (!list) return;
    const overflow = cases.slice(5);
    if (count) count.textContent = `${cases.length} CASE${cases.length === 1 ? "" : "S"}`;
    list.innerHTML = overflow.length ? overflow.map((c, i) => {
      const priority = String(c.priority || "MEDIUM").toUpperCase();
      const high = priority.includes("HIGH") || priority.includes("CRITICAL");
      const status = String(c.status || "OPEN").toUpperCase();
      return `<article class="case-library-row" data-library-case-id="${esc(c.id)}">
        <div class="case-library-index">${String(i + 6).padStart(2, "0")}</div>
        <div class="case-library-main"><div class="case-library-title-row"><span class="case-library-number">${esc(c.case_number || `CASE-${c.id}`)}</span><h3>${esc(c.title || "Investigation")}</h3></div><p>${esc(c.description || "Investigative case record.")}</p><div class="case-library-meta"><span>${esc(c.case_type || "INVESTIGATION")}</span><span>${esc(c.primary_location || "LOCATION PENDING")}</span><span>${esc(c.incident_date || "DATE PENDING")}</span></div></div>
        <div class="case-library-status"><b class="${high ? "high" : ""}">${esc(priority)}</b><small>${esc(status)}</small></div>
        <button type="button" class="case-library-open" data-library-case-id="${esc(c.id)}">OPEN ↗</button>
      </article>`;
    }).join("") : `<div class="case-library-empty"><span>05</span><div><b>ALL CASES ARE IN ORBIT</b><p>Create another investigation and it will appear here automatically.</p></div></div>`;

    list.querySelectorAll("[data-library-case-id]").forEach(row => row.addEventListener("click", async (e) => {
      const id = Number(row.dataset.libraryCaseId);
      const c = cases.find(x => Number(x.id) === id);
      if (!c) return;
      await selectCase(c);
    }));
  }

  function renderCases(cases) {
    const stage = document.getElementById("caseStage");
    if (!stage) return;
    const empty = document.getElementById("caseOrbitEmpty");
    const orbital = cases.slice(0, 5);
    stage.querySelectorAll(".floating-case").forEach(el => el.remove());
    orbital.forEach((c, i) => stage.appendChild(buildOrbitCaseCard(c, i)));
    if (empty) empty.style.display = orbital.length ? "none" : "grid";
    renderCaseLibrary(cases);

    // script.js owns the orbital physics; initialize it only after real case data
    // has been received, preventing placeholder/demo cards from ever rendering.
    if (typeof window.cipherInitOrbit === "function") {
      window.cipherInitOrbit();
    } else if (typeof window.cipherRefreshCases === "function") {
      window.cipherRefreshCases();
    }
  }

  async function selectCase(c) {
    state.caseSelected = true;
    window.CipherLocalGraphData = null;
    window.CipherLocalTimelineData = null;
    window.CipherLocalTimelineCaseId = null;
    setCaseState(c);
    try { await apiJson(`/api/cases/${c.id}`, {headers:authHeaders(false)}); } catch {}
    await refreshCaseDiagnostics();
    await refreshAll();
    document.querySelector(".side-item[data-view='evidence']")?.click();
  }

  function openCaseWorkspace() {
    document.querySelector(".side-item[data-view='evidence']")?.click();
  }

  async function refreshEvidence() {
    const list=document.getElementById("reportEvidenceList"); if(!list || !state.id) return;
    try {
      const data=await apiJson(`/api/cases/${state.id}/documents`, {headers:authHeaders(false)});
      const docs=data.documents || [];
      list.innerHTML = docs.length ? docs.map(d=>{
        const isFace=["FACE_REFERENCE_IMAGE","FACE_REFERENCE_DATASET"].includes(String(d.source_type||"").toUpperCase());
        const faceStatus=String(d.face_enrollment_status||"").toUpperCase();
        const state=isFace ? (faceStatus==="ENROLLED" ? "ENROLLED" : "FAILED") : String(d.processing_status || "UPLOADED");
        const subtitle=isFace
          ? (faceStatus==="ENROLLED" ? "Face Dataset · enrolled in authorized case gallery" : "Face Dataset · stored as evidence; enrollment failed — see status")
          : `${esc(d.file_type || "source document")} · ${esc(d.processing_status || "UPLOADED")} · SHA-256 ${esc(d.sha256 || "pending")}`;
        return `<div class="evidence-row" data-evidence-id="${d.id}"><span class="evidence-icon">${isFace?"FACE":esc((d.filename||"DOC").split(".").pop().toUpperCase())}</span><div><b>${esc(d.filename)}</b><small>${subtitle}</small></div><em>${esc(state)}</em><button type="button" class="report-mini-btn cipher-evidence-open" data-document-id="${d.id}">OPEN</button></div>`;
      }).join("") : `<div class="evidence-row"><span class="evidence-icon">—</span><div><b>No evidence uploaded for this case</b><small>Upload evidence to start extraction.</small></div><em>EMPTY</em></div>`;
      list.querySelectorAll(".cipher-evidence-open").forEach(btn => btn.addEventListener("click", async () => {
        try {
          const res = await fetch(`/api/cases/${state.id}/evidence/${btn.dataset.documentId}`, {headers: authHeaders(false)});
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          window.open(url, "_blank", "noopener");
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (e) { notify(`Unable to open evidence: ${e.message}`); }
      }));
      const evCount=document.querySelector('[data-report-value="evidence"]'); if(evCount) evCount.textContent=String(docs.length);
    } catch(e) { console.warn("evidence load",e); }
  }

  async function uploadEvidence(file) {
    if(!file || !state.id) { notify("Create or select a case first."); return; }
    const ext=(file.name.split(".").pop()||"").toLowerCase();
    if(!["txt","csv","pdf"].includes(ext)) { notify("Only TXT, CSV and PDF evidence is supported."); return; }
    try {
      const fd=new FormData(); fd.append("file",file);
      notify(`Uploading ${file.name}...`);
      const uploaded=await apiJson(`/api/cases/${state.id}/documents`, {method:"POST", headers:authHeaders(false), body:fd});
      const docId=uploaded.document?.id;
      if(docId) {
        notify(`${file.name} uploaded. Processing started in background...`);
        const queued=await apiJson(`/api/cases/${state.id}/evidence/${docId}/process`, {method:"POST", headers:authHeaders()});

        // Open Review immediately instead of waiting for AI/LLM extraction and
        // unrelated Network/GIS/Timeline refreshes. The worker continues in the
        // background and the lightweight poll below refreshes Review when ready.
        await refreshEvidence();
        await refreshReview();
        document.querySelector(".side-item[data-view='review']")?.click();
        startEvidenceProcessingPoll(docId);
        notify("Evidence uploaded. Review is open; findings will appear when processing finishes.");
        return queued;
      }
      await refreshEvidence();
      await refreshReview();
      document.querySelector(".side-item[data-view='review']")?.click();
    } catch(e) { console.error(e); notify(`Evidence processing failed: ${e.message}`); }
  }

  let evidencePollTimer = null;
  function startEvidenceProcessingPoll(docId) {
    clearInterval(evidencePollTimer);
    let attempts = 0;
    const maxAttempts = 90; // ~90 seconds, safely above the Gemini timeout.
    evidencePollTimer = setInterval(async () => {
      attempts += 1;
      try {
        const data = await apiJson(`/api/cases/${state.id}/documents`, {headers:authHeaders(false)});
        const doc = (data.documents || []).find(d => Number(d.id) === Number(docId));
        const status = String(doc?.processing_status || "").toUpperCase();
        if (status === "PROCESSED" || status === "FAILED") {
          clearInterval(evidencePollTimer); evidencePollTimer = null;
          await Promise.allSettled([refreshEvidence(), refreshReview()]);
          if (status === "PROCESSED") {
            await Promise.allSettled([refreshNetwork(), refreshGIS(), renderDynamicTimeline()]);
            notify("Evidence processing complete. Findings are ready for investigator review.");
          } else {
            notify("Evidence processing failed. Check the evidence status for details.");
          }
        }
      } catch (e) {
        console.warn("evidence processing poll", e);
      }
      if (attempts >= maxAttempts) {
        clearInterval(evidencePollTimer); evidencePollTimer = null;
      }
    }, 1000);
  }

  function setupEvidenceInput() {
    let input=document.getElementById("cipherEvidenceFileInput");
    if(!input){ input=document.createElement("input"); input.type="file"; input.id="cipherEvidenceFileInput"; input.accept=".txt,.csv,.pdf,text/plain,text/csv,application/pdf"; input.style.display="none"; document.body.appendChild(input); input.addEventListener("change",()=>{const f=input.files?.[0]; if(f) uploadEvidence(f); input.value="";}); }
    const open=()=>{input.value=""; input.click();};
    ["reportAddEvidence","reportAddEvidenceInline"].forEach(id=>{
      const b=document.getElementById(id); if(!b || b.dataset.runtimeBound) return; b.dataset.runtimeBound="1";
      b.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();open();},true);
    });
    const ev=document.getElementById("evidenceView");
    if(ev && !ev.dataset.runtimeDrop){ ev.dataset.runtimeDrop="1"; ev.addEventListener("drop",e=>{e.preventDefault();e.stopImmediatePropagation();const f=e.dataTransfer?.files?.[0]; if(f) uploadEvidence(f);},true); }
    ["csvFileInput","evidenceCsvFileInput"].forEach(id=>{
      const old=document.getElementById(id); if(old && !old.dataset.runtimeBound){ old.dataset.runtimeBound="1"; old.addEventListener("change",e=>{e.stopImmediatePropagation(); const f=old.files?.[0]; if(f) uploadEvidence(f); old.value="";},true); }
    });
  }

  async function refreshReview() {
    if(!state.id) return;
    try { window.dispatchEvent(new CustomEvent("cipher:review-refresh")); } catch {}
  }

  async function refreshNetwork() {
    try {
      if (!state.caseSelected || !state.id) {
        if (typeof window.clearNetworkGraph === "function") window.clearNetworkGraph();
        return;
      }
      if(typeof window.loadNetworkGraph === "function") await window.loadNetworkGraph(state.id);
    } catch(e) { console.warn("network refresh",e); }
  }

  async function renderDynamicTimeline(){
    if (!state.caseSelected || !state.id) {
      const feed = document.getElementById("timelineFeed");
      if (feed) feed.innerHTML = '<div class="timeline-feed-empty"><span>◎</span><b>SELECT A CASE</b><p>Choose a case from Cases. Timeline records will then be loaded only from the case database.</p></div>';
      const count = document.getElementById("timelineEventCount"); if(count) count.textContent="00";
      const verified = document.getElementById("timelineVerifiedCount"); if(verified) verified.textContent="00";
      const pending = document.getElementById("timelinePendingCount"); if(pending) pending.textContent="00";
      const source = document.getElementById("timelineFeedSource"); if(source) source.textContent="NO ACTIVE CASE";
      const meta = document.getElementById("timelineFeedMeta"); if(meta) meta.textContent="Waiting for explicit case selection";
      return;
    }
    // The workspace Timeline owns the rendering. Runtime only enforces case scope.
    if (typeof window.renderDynamicTimeline === "function" && window.renderDynamicTimeline !== renderDynamicTimeline) {
      return window.renderDynamicTimeline();
    }
  }

  async function refreshGIS() {
    try { if(typeof window.loadWorkspaceGISData === "function") await window.loadWorkspaceGISData(); } catch(e) { console.warn("GIS refresh",e); }
  }

  async function refreshAll(){
    // These views are independent. Refresh them in parallel so navigating a case
    // does not serialize multiple backend/network requests.
    await Promise.allSettled([
      refreshEvidence(),
      refreshNetwork(),
      refreshGIS(),
      renderDynamicTimeline(),
      refreshReview(),
    ]);
  }

  // Review buttons in the existing UI are kept; this just refreshes all dependent views after a decision.
  document.addEventListener("click", e=>{
    const b=e.target.closest("#reviewBulkAcceptBtn,.review-card-action-accept,[data-review-action='accept'],[data-review-action='reject'],[data-review-action='edit']");
    if(b) setTimeout(refreshAll,450);
  },true);

  // Set case before any existing case-card click handler runs.
  document.addEventListener("click", e=>{
    const card=e.target.closest("#cipherWorkspace .floating-case");
    if(card?.dataset.dbId){
      const n=Number(card.dataset.dbId); if(n) { state.id=n; state.caseSelected=true; }
      state.caseNumber=card.dataset.caseId||state.caseNumber; state.title=card.dataset.case||state.title;
      localStorage.setItem(STATE_KEY,String(state.id));
    }
  },true);

  // Case list loads from the backend instead of the hardcoded demo cards.
  const originalRefresh=window.cipherRefreshCases;
  window.cipherRefreshCases=async()=>{ if(originalRefresh) originalRefresh(); await loadCases(); };

  // Intercept case creation so the UI waits for the real DB id and doesn't leave a phantom card.
  const caseForm=document.getElementById("caseCreateForm");
  if(caseForm && !caseForm.dataset.runtimeCaseBound){
    caseForm.dataset.runtimeCaseBound="1";
    caseForm.addEventListener("submit", async e=>{
      e.preventDefault(); e.stopImmediatePropagation();
      const val=id=>document.getElementById(id)?.value?.trim()||"";
      const payload={
        case_number:val("newCaseIdHidden"), title:val("newCaseName"), case_type:val("newCaseType")||"Investigation",
        priority:val("newCasePriority")||"MEDIUM", incident_date:val("newCaseIncidentDate"), description:val("newCaseDescription"),
        primary_location:val("newCaseLocation"), assigned_officer:val("newCaseOfficerHidden"), jurisdiction:val("newCaseJurisdictionHidden"),
        tags:[...document.querySelectorAll("#caseTagsWrapper .case-tag-chip.active")].map(x=>x.dataset.tag||x.textContent.trim()).join(", ")
      };
      if(!payload.title){notify("Case title is required.");return;}
      try{
        const data=await apiJson("/api/cases",{method:"POST",headers:authHeaders(),body:JSON.stringify(payload)});
        const c=data.case; state.caseSelected=true; setCaseState(c); await loadCases(); await refreshCaseDiagnostics();
        document.getElementById("caseCreateClose")?.click();
        document.querySelector(".side-item[data-view='evidence']")?.click();
        notify(`Case ${c.case_number} created. Add evidence to continue.`);
      }catch(err){notify(`Case creation failed: ${err.message}`);}
    },true);
  }

  // Waypoints are persisted by the GIS module's single map click handler.
  // Keeping persistence there prevents duplicate waypoint records.
  const mapSaveHandler = () => {};

  // Keep UI modules synchronized with the single active case.
  const originalNetworkLoader = window.loadNetworkGraph;
  if (typeof originalNetworkLoader === "function") {
    window.loadNetworkGraph = (caseId) => { if (!state.caseSelected || !state.id) { if (typeof window.clearNetworkGraph === "function") window.clearNetworkGraph(); return Promise.resolve(); } return originalNetworkLoader(Number(caseId || state.id)); };
  }
  const originalGISLoader = window.loadWorkspaceGISData;
  if (typeof originalGISLoader === "function") {
    window.loadWorkspaceGISData = async () => {
      if (!state.id) return;
      try {
        const data = await apiJson(`/api/cases/${state.id}/gis-data`, {headers: authHeaders(false)});
        if (typeof window.cipherRenderGISData === "function") return window.cipherRenderGISData(data);
        // The original loader will render the same backend payload if exposed.
        return data;
      } catch (e) {
        notify(`GIS data unavailable: ${e.message}`);
      }
    };
  }

  function syncReportFromCase(c) {
    if (!c) return;
    const title = document.getElementById("reportTitle"); if (title) title.textContent = c.title || "CIPHER Investigation Case";
    const sub = document.getElementById("reportSubtitle"); if (sub) sub.textContent = `${c.case_type || "Investigation"} · ${c.incident_date || "Date not entered"} · ${c.primary_location || "Location not entered"}`;
    const fields = {
      caseId:c.case_number || "",
      caseType:c.case_type || "Investigation",
      incidentDate:c.incident_date || "",
      location:c.primary_location || "",
      classification:c.case_type || "Investigation",
      investigationRef:c.case_number || "",
      timeWindow: c.incident_date
        ? `${c.incident_date}${c.incident_end ? ` – ${c.incident_end}` : ""}`
        : "Not entered"
    };
    Object.entries(fields).forEach(([k,v]) => { const el=document.querySelector(`[data-report-field="${k}"]`); if(el) el.value=v; });

    const status = document.getElementById("reportCaseStatus");
    if(status) status.textContent = `CASE / ${c.case_number || "ACTIVE"}`;

    // The report sheet ships with historical demo content for the landing/demo
    // state. Once a real case is selected, replace those values with the active
    // case's backend metadata and live counts so stale facts cannot leak between
    // investigations. Layout/classes remain unchanged.
    const reportBadges = document.querySelectorAll(".report-status-row .report-status");
    if (reportBadges.length >= 3) {
      reportBadges[0].textContent = String(c.priority || "MEDIUM").toUpperCase();
      reportBadges[0].classList.toggle("danger", /HIGH|CRITICAL/.test(String(c.priority || "").toUpperCase()));
      reportBadges[1].textContent = String(c.status || "OPEN").toUpperCase();
      reportBadges[2].textContent = "LIVE CASE DATA";
    }

    const hist = document.querySelectorAll(".report-kpi");
    const kpiDefinitions = [
      ["VERIFIED ENTITIES", "verified.entities"],
      ["VERIFIED LINKS", "verified.relationships"],
      ["EVIDENCE", "counts.documents"],
      ["LOCATIONS", "verified.locations"],
      ["TIMELINE EVENTS", "counts.timeline_events"],
      ["REVIEW QUEUE", "counts.review_items"]
    ];
    const updateKpis = (data) => {
      const counts = data?.counts || {};
      const verified = data?.verified || {};
      hist.forEach((card, index) => {
        const [label, path] = kpiDefinitions[index] || [];
        if (!label) return;
        const value = path.split(".").reduce((obj, key) => obj?.[key], { counts, verified }) ?? 0;
        const span = card.querySelector("span");
        const b = card.querySelector("b");
        const sm = card.querySelector("small");
        if (span) span.textContent = label;
        if (b) b.textContent = String(value);
        if (sm) sm.textContent = "active case data";
      });
    };

    const legalGrid = document.querySelectorAll(".legal-grid > div");
    const legalDefinitions = [
      ["STATUS", c.status || "OPEN"],
      ["PRIORITY", c.priority || "MEDIUM"],
      ["INCIDENT DATE", c.incident_date || "Not entered"],
      ["CASE TYPE", c.case_type || "Investigation"],
      ["JURISDICTION", c.jurisdiction || "Not entered"],
      ["ASSIGNED OFFICER", c.assigned_officer || "Not entered"]
    ];
    legalGrid.forEach((item, index) => {
      const [label, value] = legalDefinitions[index] || [];
      if (!label) return;
      const span = item.querySelector("span");
      const b = item.querySelector("b");
      if (span) span.textContent = label;
      if (b) b.textContent = value;
    });
    const legalHeading = document.querySelector(".report-grid-two .report-section-card:nth-child(2) .report-section-head h3");
    if (legalHeading) legalHeading.textContent = "Active case metadata";
    const legalNote = document.querySelector(".legal-notes p");
    if (legalNote) legalNote.textContent = "Metadata shown here is loaded from the active case record. Add and verify source evidence before treating investigative findings as established facts.";

    refreshCaseDiagnostics().then(updateKpis);
  }

  async function boot(){
    // CIPHER always opens on the public landing page. Authentication and the
    // protected workspace are entered explicitly through the landing actions
    // (or their hash routes), never as an automatic startup redirect.
    if (!location.hash || !/^#(?:auth-(?:login|signup)|workspace)$/.test(location.hash)) {
      document.getElementById("cipherAuth")?.classList.remove("open");
      document.getElementById("cipherWorkspace")?.classList.remove("open");
      document.getElementById("cipherAuth")?.setAttribute("aria-hidden", "true");
      document.getElementById("cipherWorkspace")?.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }
    setupEvidenceInput();
    const templateLink = document.getElementById("cipherCsvDownloadTemplateLink");
    if (templateLink && state.id) templateLink.href = `/api/cases/${state.id}/sample-csv`;
    if(localStorage.getItem(TOKEN_KEY) || localStorage.getItem("token")) await loadCases();
    await renderDynamicTimeline();
  }

  // Rehydrate the live workspace immediately after the login flow stores a
  // fresh token. The original UI's enter() function only opened the workspace,
  // which left Network/GIS pointing at stale case state until the user clicked
  // around manually.
  window.cipherAfterLogin = async function () {
    try {
      await loadCases();
      // Do not auto-open a case or hydrate graph/timeline data. The investigator
      // must explicitly select a case first.
      if (!state.caseSelected || !state.id) return;
      if (typeof window.refreshCaseDiagnostics === "function") await window.refreshCaseDiagnostics();
      if (typeof window.loadNetworkGraph === "function") await window.loadNetworkGraph(state.id);
      if (typeof window.loadWorkspaceGISData === "function") await window.loadWorkspaceGISData();
      await renderDynamicTimeline();
    } catch (e) {
      console.warn("CIPHER post-login hydration failed:", e);
    }
  };

  window.cipherRefreshEvidence=refreshEvidence;
  window.cipherRefreshAllData=refreshAll;
  window.cipherUploadEvidence=uploadEvidence;
  window.cipherLoadCases=loadCases;
  window.addEventListener("load",boot);
})();
