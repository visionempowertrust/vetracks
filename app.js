const storageKey = "meeting-action-tracker:v1";

const today = new Date();
const isoToday = today.toISOString().slice(0, 10);
const sampleMeetingId = crypto.randomUUID();

const defaultData = {
  themes: ["Program Delivery", "People & Staffing", "Finance", "Partnerships"],
  owners: [
    { id: crypto.randomUUID(), name: "Operations", role: "Execution", email: "" },
    { id: crypto.randomUUID(), name: "Finance", role: "Approvals", email: "" }
  ],
  meetings: [
    {
      id: sampleMeetingId,
      title: "Weekly Leadership Review",
      date: isoToday,
      theme: "Program Delivery",
      participants: "Meera, Operations, Program Leads",
      mom: "Reviewed delayed milestones, partner dependencies, and decision points for the current month."
    }
  ],
  actions: [
    {
      id: crypto.randomUUID(),
      title: "Create owner-wise escalation list for delayed milestones",
      owner: "Operations",
      theme: "Program Delivery",
      priority: "High",
      status: "In progress",
      dueDate: addDays(isoToday, 3),
      meetingId: sampleMeetingId,
      notes: "Include dependencies and next review date.",
      createdAt: isoToday,
      completedAt: ""
    },
    {
      id: crypto.randomUUID(),
      title: "Confirm budget approval route for upcoming activities",
      owner: "Finance",
      theme: "Finance",
      priority: "Critical",
      status: "Open",
      dueDate: addDays(isoToday, 1),
      meetingId: "",
      notes: "",
      createdAt: isoToday,
      completedAt: ""
    }
  ]
};

let state = loadState();
let meetingActionDrafts = [];
let activeMeetingId = "";

const els = {
  navTabs: document.querySelectorAll(".nav-tab"),
  viewTitle: document.querySelector("#viewTitle"),
  views: {
    dashboard: document.querySelector("#dashboardView"),
    meetings: document.querySelector("#meetingsView"),
    actions: document.querySelector("#actionsView"),
    owners: document.querySelector("#ownersView"),
    themes: document.querySelector("#themesView")
  },
  metrics: document.querySelector("#metrics"),
  priorityList: document.querySelector("#priorityList"),
  priorityCount: document.querySelector("#priorityCount"),
  trendChart: document.querySelector("#trendChart"),
  meetingList: document.querySelector("#meetingList"),
  actionTable: document.querySelector("#actionTable"),
  ownerTable: document.querySelector("#ownerTable"),
  themeBoard: document.querySelector("#themeBoard"),
  themeFilter: document.querySelector("#themeFilter"),
  ownerFilter: document.querySelector("#ownerFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  meetingDialog: document.querySelector("#meetingDialog"),
  meetingForm: document.querySelector("#meetingForm"),
  meetingDialogTitle: document.querySelector("#meetingDialogTitle"),
  meetingActionList: document.querySelector("#meetingActionList"),
  actionDialog: document.querySelector("#actionDialog"),
  actionForm: document.querySelector("#actionForm"),
  actionDialogTitle: document.querySelector("#actionDialogTitle"),
  ownerForm: document.querySelector("#ownerForm"),
  themeForm: document.querySelector("#themeForm"),
  importData: document.querySelector("#importData")
};

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

els.navTabs.forEach((tab) => {
  tab.addEventListener("click", () => setView(tab.dataset.view));
});

document.querySelector("#newMeetingButton").addEventListener("click", () => openMeetingDialog());
document.querySelector("#addMeetingInline").addEventListener("click", () => openMeetingDialog());
document.querySelector("#newActionButton").addEventListener("click", () => openActionDialog());
document.querySelector("#addActionInline").addEventListener("click", () => openActionDialog());
document.querySelector("#exportData").addEventListener("click", exportData);
document.querySelector("#clearData").addEventListener("click", clearData);
document.querySelector("#saveMeetingAction").addEventListener("click", saveMeetingActionDraft);
document.querySelector("#cancelMeetingActionEdit").addEventListener("click", resetMeetingActionForm);
document.querySelector("#meetingTheme").addEventListener("change", () => {
  document.querySelector("#meetingActionTheme").value = document.querySelector("#meetingTheme").value;
});

["change"].forEach((eventName) => {
  els.themeFilter.addEventListener(eventName, render);
  els.ownerFilter.addEventListener(eventName, render);
  els.statusFilter.addEventListener(eventName, render);
});

els.meetingForm.addEventListener("submit", saveMeeting);
els.actionForm.addEventListener("submit", saveAction);
els.ownerForm.addEventListener("submit", saveOwner);
els.themeForm.addEventListener("submit", saveTheme);
els.importData.addEventListener("change", importData);
document.querySelector("#cancelOwnerEdit").addEventListener("click", resetOwnerForm);

render();

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(defaultData);
  try {
    return normalizeState(JSON.parse(saved));
  } catch {
    return structuredClone(defaultData);
  }
}

function normalizeState(data) {
  const hasOwnerRecords = Array.isArray(data.owners);
  const normalized = {
    themes: Array.isArray(data.themes) ? data.themes : structuredClone(defaultData.themes),
    owners: hasOwnerRecords ? data.owners : [],
    meetings: Array.isArray(data.meetings) ? data.meetings : [],
    actions: Array.isArray(data.actions) ? data.actions : []
  };
  const typedOwners = normalized.actions.map((action) => action.owner).filter(Boolean);
  const ownerNames = new Set(normalized.owners.map((owner) => owner.name).filter(Boolean));
  if (!hasOwnerRecords) {
    typedOwners.forEach((name) => {
      if (!ownerNames.has(name)) {
        normalized.owners.push({ id: crypto.randomUUID(), name, role: "", email: "" });
        ownerNames.add(name);
      }
    });
  }
  normalized.owners = normalized.owners.map((owner) => ({
    id: owner.id || crypto.randomUUID(),
    name: owner.name || "",
    role: owner.role || "",
    email: owner.email || ""
  })).filter((owner) => owner.name).sort((a, b) => a.name.localeCompare(b.name));
  return normalized;
}

function persist() {
  localStorage.setItem(storageKey, JSON.stringify(state, null, 2));
}

function render() {
  renderFilters();
  renderDashboard();
  renderMeetings();
  renderActions();
  renderOwners();
  renderThemes();
  persist();
}

function renderFilters() {
  const currentTheme = els.themeFilter.value || "all";
  const currentOwner = els.ownerFilter.value || "all";
  const owners = state.owners.map((owner) => owner.name).sort();

  els.themeFilter.innerHTML = optionHtml(["all", ...state.themes], currentTheme, "All themes");
  els.ownerFilter.innerHTML = optionHtml(["all", ...owners], currentOwner, "All owners");
  fillThemeSelects();
  fillOwnerSelect();
  fillMeetingSelect();
}

function optionHtml(values, selected, allLabel) {
  return values.map((value) => {
    const label = value === "all" ? allLabel : value;
    return `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");
}

function fillThemeSelects() {
  const options = state.themes.map((theme) => `<option>${escapeHtml(theme)}</option>`).join("");
  document.querySelector("#meetingTheme").innerHTML = options;
  document.querySelector("#actionTheme").innerHTML = options;
  document.querySelector("#meetingActionTheme").innerHTML = options;
}

function fillOwnerSelect() {
  const options = state.owners.map((owner) => `<option>${escapeHtml(owner.name)}</option>`).join("");
  document.querySelector("#actionOwner").innerHTML = options;
  document.querySelector("#meetingActionOwner").innerHTML = options;
}

function fillMeetingSelect() {
  const options = [
    '<option value="">No linked meeting</option>',
    ...state.meetings.map((meeting) => `<option value="${meeting.id}">${escapeHtml(meeting.title)}</option>`)
  ].join("");
  document.querySelector("#actionMeeting").innerHTML = options;
}

function filteredActions() {
  const theme = els.themeFilter.value || "all";
  const owner = els.ownerFilter.value || "all";
  const status = els.statusFilter.value || "all";
  return state.actions.filter((action) => {
    return (theme === "all" || action.theme === theme)
      && (owner === "all" || action.owner === owner)
      && (status === "all" || action.status === status);
  });
}

function renderDashboard() {
  const actions = filteredActions();
  const open = actions.filter((action) => action.status !== "Done");
  const overdue = open.filter((action) => action.dueDate < isoToday);
  const completed = actions.filter((action) => action.status === "Done");
  const completionRate = actions.length ? Math.round((completed.length / actions.length) * 100) : 0;

  els.metrics.innerHTML = [
    metric("Open actions", open.length),
    metric("Overdue", overdue.length),
    metric("Completion", `${completionRate}%`),
    metric("Meetings", state.meetings.length)
  ].join("");

  const sorted = [...open].sort(sortByPriorityAndDue).slice(0, 8);
  els.priorityCount.textContent = `${sorted.length} active`;
  els.priorityList.innerHTML = sorted.length
    ? sorted.map(actionCard).join("")
    : emptyState("No active actions for the selected filters.");

  renderTrend();
}

function metric(label, value) {
  return `<div class="metric"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></div>`;
}

function renderTrend() {
  const weeks = Array.from({ length: 6 }, (_, index) => weekStart(addDays(isoToday, -7 * (5 - index))));
  els.trendChart.innerHTML = weeks.map((week) => {
    const end = addDays(week, 6);
    const done = state.actions.filter((action) => action.completedAt >= week && action.completedAt <= end).length;
    const open = state.actions.filter((action) => action.createdAt <= end && action.status !== "Done").length;
    const max = Math.max(done + open, 1);
    const doneHeight = Math.max(6, Math.round((done / max) * 210));
    const openHeight = Math.max(6, Math.round((open / max) * 210));
    return `
      <div class="trend-bar" title="${done} done, ${open} open">
        <div class="bar-stack" style="height:${Math.max(doneHeight, openHeight)}px">
          <div class="bar-done" style="height:${doneHeight}px"></div>
          <div class="bar-open" style="height:${openHeight}px"></div>
        </div>
        <div class="trend-label">${formatShortDate(week)}</div>
      </div>
    `;
  }).join("");
}

function renderMeetings() {
  const meetings = [...state.meetings].sort((a, b) => b.date.localeCompare(a.date));
  els.meetingList.innerHTML = meetings.length
    ? meetings.map((meeting) => {
      const linkedActions = state.actions.filter((action) => action.meetingId === meeting.id).length;
      return `
        <article class="meeting-card">
          <div class="card-title">
            <strong>${escapeHtml(meeting.title)}</strong>
            <span class="pill priority-Medium">${escapeHtml(meeting.theme)}</span>
          </div>
          <div class="meta-row">
            <span>${formatDate(meeting.date)}</span>
            <span>${escapeHtml(meeting.participants || "No participants listed")}</span>
            <span>${linkedActions} linked actions</span>
          </div>
          <p>${escapeHtml(meeting.mom)}</p>
          <div class="row-actions">
            <button class="small-button secondary-button" type="button" onclick="openMeetingDialog('${meeting.id}')">Edit meeting</button>
          </div>
        </article>
      `;
    }).join("")
    : emptyState("No meetings yet.");
}

function renderActions() {
  const actions = filteredActions().sort(sortByPriorityAndDue);
  els.actionTable.innerHTML = actions.length
    ? actions.map((action) => `
      <tr>
        <td><strong>${escapeHtml(action.title)}</strong><div class="meta-row">${escapeHtml(action.notes || "")}</div></td>
        <td>${escapeHtml(action.owner)}</td>
        <td>${escapeHtml(action.theme)}</td>
        <td><span class="pill priority-${action.priority}">${escapeHtml(action.priority)}</span></td>
        <td>${formatDate(action.dueDate)}</td>
        <td>
          <select aria-label="Status for ${escapeHtml(action.title)}" onchange="updateStatus('${action.id}', this.value)">
            ${["Open", "In progress", "Blocked", "Done"].map((status) => `<option ${status === action.status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
        </td>
        <td>
          <div class="row-actions">
            <button class="small-button secondary-button" type="button" onclick="openActionDialog('${action.id}')">Edit</button>
          </div>
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="7">${emptyState("No actions for the selected filters.")}</td></tr>`;
}

function renderOwners() {
  els.ownerTable.innerHTML = state.owners.length
    ? state.owners.map((owner) => {
      const openActions = state.actions.filter((action) => action.owner === owner.name && action.status !== "Done").length;
      return `
        <tr>
          <td><strong>${escapeHtml(owner.name)}</strong></td>
          <td>${escapeHtml(owner.role || "-")}</td>
          <td>${owner.email ? `<a href="mailto:${escapeHtml(owner.email)}">${escapeHtml(owner.email)}</a>` : "-"}</td>
          <td>${openActions}</td>
          <td>
            <div class="row-actions">
              <button class="small-button secondary-button" type="button" onclick="editOwner('${owner.id}')">Edit</button>
              <button class="small-button danger-button" type="button" onclick="deleteOwner('${owner.id}')">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join("")
    : `<tr><td colspan="5">${emptyState("No owners yet.")}</td></tr>`;
}

function renderMeetingActionDrafts() {
  els.meetingActionList.innerHTML = meetingActionDrafts.length
    ? meetingActionDrafts.map((action) => `
      <article class="embedded-item">
        <div>
          <strong>${escapeHtml(action.title)}</strong>
          <div class="meta-row">
            <span>${escapeHtml(action.owner)}</span>
            <span>${escapeHtml(action.priority)}</span>
            <span>${escapeHtml(action.status)}</span>
            <span>Due ${formatDate(action.dueDate)}</span>
          </div>
        </div>
        <div class="row-actions">
          <button class="small-button secondary-button" type="button" onclick="editMeetingActionDraft('${action.id}')">Edit</button>
          <button class="small-button danger-button" type="button" onclick="deleteMeetingActionDraft('${action.id}')">Delete</button>
        </div>
      </article>
    `).join("")
    : emptyState("Add at least one action point before saving this meeting.");
}

function renderThemes() {
  els.themeBoard.innerHTML = state.themes.map((theme) => {
    const actions = state.actions.filter((action) => action.theme === theme);
    const done = actions.filter((action) => action.status === "Done").length;
    const overdue = actions.filter((action) => action.status !== "Done" && action.dueDate < isoToday).length;
    return `
      <article class="theme-card">
        <strong>${escapeHtml(theme)}</strong>
        <div class="meta-row">
          <span>${actions.length} actions</span>
          <span>${done} done</span>
          <span>${overdue} overdue</span>
        </div>
      </article>
    `;
  }).join("");
}

function actionCard(action) {
  return `
    <article class="action-card">
      <div class="card-title">
        <strong>${escapeHtml(action.title)}</strong>
        <span class="pill priority-${action.priority}">${escapeHtml(action.priority)}</span>
      </div>
      <div class="meta-row">
        <span>${escapeHtml(action.owner)}</span>
        <span>${escapeHtml(action.theme)}</span>
        <span>Due ${formatDate(action.dueDate)}</span>
        <span class="pill status-${action.status.replaceAll(" ", "-")}">${escapeHtml(action.status)}</span>
      </div>
      <div class="row-actions">
        <button class="small-button secondary-button" type="button" onclick="openActionDialog('${action.id}')">Edit</button>
        <button class="small-button secondary-button" type="button" onclick="updateStatus('${action.id}', 'Done')">Done</button>
      </div>
    </article>
  `;
}

function setView(viewName) {
  Object.entries(els.views).forEach(([name, view]) => view.classList.toggle("active-view", name === viewName));
  els.navTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewName));
  els.viewTitle.textContent = viewName.charAt(0).toUpperCase() + viewName.slice(1);
}

function openMeetingDialog(id = "") {
  if (!state.owners.length) {
    setView("owners");
    document.querySelector("#ownerName").focus();
    return;
  }
  const meeting = state.meetings.find((item) => item.id === id);
  activeMeetingId = meeting?.id || crypto.randomUUID();
  meetingActionDrafts = state.actions
    .filter((action) => action.meetingId === activeMeetingId)
    .map((action) => ({ ...action }));
  els.meetingDialogTitle.textContent = meeting ? "Edit meeting" : "New meeting";
  document.querySelector("#meetingId").value = activeMeetingId;
  document.querySelector("#meetingTitle").value = meeting?.title || "";
  document.querySelector("#meetingDate").value = meeting?.date || isoToday;
  document.querySelector("#meetingTheme").value = meeting?.theme || state.themes[0];
  document.querySelector("#meetingParticipants").value = meeting?.participants || "";
  document.querySelector("#meetingMom").value = meeting?.mom || "";
  resetMeetingActionForm();
  renderMeetingActionDrafts();
  els.meetingDialog.showModal();
}

function openActionDialog(id = "", meetingId = "") {
  const action = state.actions.find((item) => item.id === id);
  const meeting = state.meetings.find((item) => item.id === meetingId);
  if (!state.owners.length) {
    setView("owners");
    document.querySelector("#ownerName").focus();
    return;
  }
  els.actionDialogTitle.textContent = action ? "Edit action" : "New action";
  document.querySelector("#actionId").value = action?.id || "";
  document.querySelector("#actionTitle").value = action?.title || "";
  document.querySelector("#actionOwner").value = action?.owner || state.owners[0].name;
  document.querySelector("#actionTheme").value = action?.theme || meeting?.theme || state.themes[0];
  document.querySelector("#actionPriority").value = action?.priority || "Medium";
  document.querySelector("#actionStatus").value = action?.status || "Open";
  document.querySelector("#actionDueDate").value = action?.dueDate || addDays(isoToday, 7);
  document.querySelector("#actionMeeting").value = action?.meetingId || meetingId || "";
  document.querySelector("#actionNotes").value = action?.notes || "";
  els.actionDialog.showModal();
}

function saveMeeting(event) {
  event.preventDefault();
  const id = document.querySelector("#meetingId").value || activeMeetingId || crypto.randomUUID();
  if (!meetingActionDrafts.length) {
    alert("Add at least one action point before saving the meeting.");
    return;
  }
  const meeting = {
    id,
    title: document.querySelector("#meetingTitle").value.trim(),
    date: document.querySelector("#meetingDate").value,
    theme: document.querySelector("#meetingTheme").value,
    participants: document.querySelector("#meetingParticipants").value.trim(),
    mom: document.querySelector("#meetingMom").value.trim()
  };
  state.meetings = upsert(state.meetings, meeting);
  state.actions = [
    ...state.actions.filter((action) => action.meetingId !== id),
    ...meetingActionDrafts.map((action) => ({ ...action, meetingId: id }))
  ];
  meetingActionDrafts = [];
  activeMeetingId = "";
  els.meetingDialog.close();
  render();
}

function saveMeetingActionDraft() {
  const title = document.querySelector("#meetingActionTitle").value.trim();
  const owner = document.querySelector("#meetingActionOwner").value;
  const dueDate = document.querySelector("#meetingActionDueDate").value;
  if (!title || !owner || !dueDate) {
    alert("Action item, owner, and due date are required.");
    return;
  }
  const id = document.querySelector("#meetingActionId").value || crypto.randomUUID();
  const existing = meetingActionDrafts.find((action) => action.id === id);
  const status = document.querySelector("#meetingActionStatus").value;
  const action = {
    id,
    title,
    owner,
    theme: document.querySelector("#meetingActionTheme").value,
    priority: document.querySelector("#meetingActionPriority").value,
    status,
    dueDate,
    meetingId: activeMeetingId,
    notes: document.querySelector("#meetingActionNotes").value.trim(),
    createdAt: existing?.createdAt || isoToday,
    completedAt: status === "Done" ? (existing?.completedAt || isoToday) : ""
  };
  meetingActionDrafts = upsert(meetingActionDrafts, action).sort(sortByPriorityAndDue);
  resetMeetingActionForm();
  renderMeetingActionDrafts();
}

function editMeetingActionDraft(id) {
  const action = meetingActionDrafts.find((item) => item.id === id);
  if (!action) return;
  document.querySelector("#meetingActionId").value = action.id;
  document.querySelector("#meetingActionTitle").value = action.title;
  document.querySelector("#meetingActionOwner").value = action.owner;
  document.querySelector("#meetingActionTheme").value = action.theme;
  document.querySelector("#meetingActionPriority").value = action.priority;
  document.querySelector("#meetingActionStatus").value = action.status;
  document.querySelector("#meetingActionDueDate").value = action.dueDate;
  document.querySelector("#meetingActionNotes").value = action.notes || "";
  document.querySelector("#saveMeetingAction").textContent = "Update action point";
  document.querySelector("#cancelMeetingActionEdit").classList.remove("hidden");
  document.querySelector("#meetingActionTitle").focus();
}

function deleteMeetingActionDraft(id) {
  meetingActionDrafts = meetingActionDrafts.filter((action) => action.id !== id);
  resetMeetingActionForm();
  renderMeetingActionDrafts();
}

function resetMeetingActionForm() {
  document.querySelector("#meetingActionId").value = "";
  document.querySelector("#meetingActionTitle").value = "";
  document.querySelector("#meetingActionOwner").value = state.owners[0]?.name || "";
  document.querySelector("#meetingActionTheme").value = document.querySelector("#meetingTheme").value || state.themes[0];
  document.querySelector("#meetingActionPriority").value = "Medium";
  document.querySelector("#meetingActionStatus").value = "Open";
  document.querySelector("#meetingActionDueDate").value = addDays(isoToday, 7);
  document.querySelector("#meetingActionNotes").value = "";
  document.querySelector("#saveMeetingAction").textContent = "Add action point";
  document.querySelector("#cancelMeetingActionEdit").classList.add("hidden");
}

function saveAction(event) {
  event.preventDefault();
  const id = document.querySelector("#actionId").value || crypto.randomUUID();
  const existing = state.actions.find((action) => action.id === id);
  const status = document.querySelector("#actionStatus").value;
  const action = {
    id,
    title: document.querySelector("#actionTitle").value.trim(),
    owner: document.querySelector("#actionOwner").value.trim(),
    theme: document.querySelector("#actionTheme").value,
    priority: document.querySelector("#actionPriority").value,
    status,
    dueDate: document.querySelector("#actionDueDate").value,
    meetingId: document.querySelector("#actionMeeting").value,
    notes: document.querySelector("#actionNotes").value.trim(),
    createdAt: existing?.createdAt || isoToday,
    completedAt: status === "Done" ? (existing?.completedAt || isoToday) : ""
  };
  state.actions = upsert(state.actions, action);
  els.actionDialog.close();
  render();
}

function saveOwner(event) {
  event.preventDefault();
  const id = document.querySelector("#ownerId").value || crypto.randomUUID();
  const existing = state.owners.find((owner) => owner.id === id);
  const previousName = existing?.name || "";
  const owner = {
    id,
    name: document.querySelector("#ownerName").value.trim(),
    role: document.querySelector("#ownerRole").value.trim(),
    email: document.querySelector("#ownerEmail").value.trim()
  };
  const duplicate = state.owners.some((item) => item.id !== id && item.name.toLowerCase() === owner.name.toLowerCase());
  if (duplicate) {
    alert("An owner with this name already exists.");
    return;
  }
  state.owners = upsert(state.owners, owner).sort((a, b) => a.name.localeCompare(b.name));
  if (previousName && previousName !== owner.name) {
    state.actions = state.actions.map((action) => action.owner === previousName ? { ...action, owner: owner.name } : action);
  }
  resetOwnerForm();
  render();
}

function editOwner(id) {
  const owner = state.owners.find((item) => item.id === id);
  if (!owner) return;
  document.querySelector("#ownerId").value = owner.id;
  document.querySelector("#ownerName").value = owner.name;
  document.querySelector("#ownerRole").value = owner.role;
  document.querySelector("#ownerEmail").value = owner.email;
  document.querySelector("#saveOwnerButton").textContent = "Save";
  document.querySelector("#cancelOwnerEdit").classList.remove("hidden");
  document.querySelector("#ownerName").focus();
}

function deleteOwner(id) {
  const owner = state.owners.find((item) => item.id === id);
  if (!owner) return;
  const openActions = state.actions.filter((action) => action.owner === owner.name && action.status !== "Done").length;
  if (openActions > 0) {
    alert("Reassign or complete this owner's open actions before deleting.");
    return;
  }
  if (!confirm(`Delete owner "${owner.name}"? Completed action history will keep the owner name.`)) return;
  state.owners = state.owners.filter((item) => item.id !== id);
  resetOwnerForm();
  render();
}

function resetOwnerForm() {
  els.ownerForm.reset();
  document.querySelector("#ownerId").value = "";
  document.querySelector("#saveOwnerButton").textContent = "Add";
  document.querySelector("#cancelOwnerEdit").classList.add("hidden");
}

function saveTheme(event) {
  event.preventDefault();
  const name = document.querySelector("#themeName").value.trim();
  if (name && !state.themes.includes(name)) {
    state.themes.push(name);
    state.themes.sort();
  }
  event.target.reset();
  render();
}

function updateStatus(id, status) {
  state.actions = state.actions.map((action) => {
    if (action.id !== id) return action;
    return {
      ...action,
      status,
      completedAt: status === "Done" ? (action.completedAt || isoToday) : ""
    };
  });
  render();
}

function upsert(items, item) {
  const exists = items.some((existing) => existing.id === item.id);
  return exists ? items.map((existing) => existing.id === item.id ? item : existing) : [...items, item];
}

function sortByPriorityAndDue(a, b) {
  const priority = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  return (priority[a.priority] - priority[b.priority]) || a.dueDate.localeCompare(b.dueDate);
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `meeting-action-tracker-${isoToday}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported.themes) || !Array.isArray(imported.meetings) || !Array.isArray(imported.actions)) {
        throw new Error("Invalid data");
      }
      state = normalizeState(imported);
      render();
    } catch {
      alert("This file does not look like Action Tracker data.");
    }
  };
  reader.readAsText(file);
}

function clearData() {
  if (!confirm("Clear all locally stored meetings and actions?")) return;
  state = { themes: ["Program Delivery"], owners: [], meetings: [], actions: [] };
  render();
}

function emptyState(text) {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(new Date(`${value}T00:00:00`));
}

function weekStart(value) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() - date.getDay());
  return date.toISOString().slice(0, 10);
}

function addDays(value, days) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
