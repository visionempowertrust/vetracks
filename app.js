const SUPABASE_URL = "https://yhaloppwmvdyzssknkpc.supabase.co";
const SUPABASE_KEY = "sb_publishable_eIEzksUAWbO6OeHK5eZ4iw_O6XsCchp";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
      participants: ["Operations", "Finance"],
      mom: "Reviewed delayed milestones, partner dependencies, and decision points for the current month."
    }
  ],
  actions: [
    {
      id: crypto.randomUUID(),
      title: "Create person-wise escalation list for delayed milestones",
      people: ["Operations"],
      themes: ["Program Delivery"],
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
      people: ["Finance"],
      themes: ["Finance"],
      priority: "Critical",
      status: "Open",
      dueDate: addDays(isoToday, 1),
      meetingId: "",
      notes: "",
      createdAt: isoToday,
      completedAt: ""
    }
  ],
  actionNotes: []
};

let state = structuredClone(defaultData);
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
  syncStatus: document.querySelector("#syncStatus"),
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
  setMultiSelectValues(document.querySelector("#meetingActionTheme"), [document.querySelector("#meetingTheme").value]);
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

initApp();

async function initApp() {
  setSyncStatus("Database: connecting");
  try {
    state = await loadState();
    render();
    setSyncStatus("Database: synced");
  } catch (error) {
    console.error(error);
    render();
    setSyncStatus(`Database: ${error.message}`, true);
  }
}

function normalizeState(data) {
  const hasOwnerRecords = Array.isArray(data.owners);
  const normalized = {
    themes: Array.isArray(data.themes) ? data.themes : structuredClone(defaultData.themes),
    owners: hasOwnerRecords ? data.owners : [],
    meetings: Array.isArray(data.meetings) ? data.meetings : [],
    actions: Array.isArray(data.actions) ? data.actions : [],
    actionNotes: Array.isArray(data.actionNotes) ? data.actionNotes : []
  };
  const participantOwners = normalized.meetings.flatMap((meeting) => normalizeParticipants(meeting.participants));
  const typedOwners = [
    ...normalized.actions.flatMap((action) => normalizePeople(action.people || action.owner)),
    ...participantOwners
  ];
  normalized.actions = normalized.actions.map((action) => ({
    ...action,
    people: normalizePeople(action.people || action.owner),
    themes: normalizeThemes(action.themes || action.theme)
  }));
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
  normalized.actionNotes = normalized.actionNotes.map((note) => ({
    id: note.id || crypto.randomUUID(),
    actionId: note.actionId || note.action_id || "",
    note: note.note || "",
    person: note.person || note.person_name || "",
    noteDate: note.noteDate || note.note_date || isoToday,
    createdAt: note.createdAt || note.created_at || new Date().toISOString()
  })).filter((note) => note.actionId && note.note);
  return normalized;
}

function persist() {
  // Supabase is the source of truth. This function remains to keep render flow simple.
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

function setSyncStatus(message, isError = false) {
  els.syncStatus.textContent = message;
  els.syncStatus.classList.toggle("error", isError);
}

async function loadState() {
  const [themesResult, ownersResult, meetingsResult, participantsResult, actionsResult, actionPeopleResult, actionThemesResult, actionNotesResult] = await Promise.all([
    db.from("raahat_themes").select("*").order("name"),
    db.from("raahat_people").select("*").order("name"),
    db.from("raahat_meetings").select("*").order("date", { ascending: false }),
    db.from("raahat_meeting_participants").select("*"),
    db.from("raahat_actions").select("*").order("due_date", { ascending: true }),
    db.from("raahat_action_people").select("*"),
    db.from("raahat_action_themes").select("*"),
    db.from("raahat_action_notes").select("*").order("note_date", { ascending: false }).order("created_at", { ascending: false })
  ]);
  [themesResult, ownersResult, meetingsResult, participantsResult, actionsResult, actionPeopleResult, actionThemesResult, actionNotesResult].forEach(throwIfSupabaseError);

  const participantsByMeeting = participantsResult.data.reduce((map, row) => {
    if (!map[row.meeting_id]) map[row.meeting_id] = [];
    map[row.meeting_id].push(row.person_name);
    return map;
  }, {});
  const peopleByAction = actionPeopleResult.data.reduce((map, row) => {
    if (!map[row.action_id]) map[row.action_id] = [];
    map[row.action_id].push(row.person_name);
    return map;
  }, {});
  const themesByAction = actionThemesResult.data.reduce((map, row) => {
    if (!map[row.action_id]) map[row.action_id] = [];
    map[row.action_id].push(row.theme_name);
    return map;
  }, {});

  return normalizeState({
    themes: themesResult.data.map((theme) => theme.name),
    owners: ownersResult.data.map((owner) => ({
      id: owner.id,
      name: owner.name,
      role: owner.role || "",
      email: owner.email || ""
    })),
    meetings: meetingsResult.data.map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      date: meeting.date,
      theme: meeting.theme_name,
      participants: participantsByMeeting[meeting.id] || [],
      mom: meeting.mom
    })),
    actions: actionsResult.data.map((action) => ({
      id: action.id,
      title: action.title,
      people: peopleByAction[action.id] || [],
      themes: themesByAction[action.id] || [],
      priority: action.priority,
      status: action.status,
      dueDate: action.due_date,
      meetingId: action.meeting_id || "",
      notes: action.notes || "",
      createdAt: action.created_at ? action.created_at.slice(0, 10) : isoToday,
      completedAt: action.completed_at || ""
    })),
    actionNotes: actionNotesResult.data.map((note) => ({
      id: note.id,
      actionId: note.action_id,
      note: note.note,
      person: note.person_name,
      noteDate: note.note_date,
      createdAt: note.created_at
    }))
  });
}

function throwIfSupabaseError(result) {
  if (result.error) throw result.error;
}

async function seedDatabase(data) {
  await saveThemesToDatabase(data.themes);
  await saveOwnersToDatabase(data.owners);
  await saveMeetingsToDatabase(data.meetings);
  await saveActionsToDatabase(data.actions);
  await saveParticipantsToDatabase(data.meetings);
  await saveActionNotesToDatabase(data.actionNotes || []);
}

async function saveThemesToDatabase(themes) {
  if (!themes.length) return;
  throwIfSupabaseError(await db.from("raahat_themes").upsert(
    themes.map((name) => ({ name })),
    { onConflict: "name" }
  ));
}

async function saveOwnersToDatabase(owners) {
  if (!owners.length) return;
  throwIfSupabaseError(await db.from("raahat_people").upsert(
    owners.map((owner) => ({
      id: owner.id,
      name: owner.name,
      role: owner.role || null,
      email: owner.email || null
    })),
    { onConflict: "id" }
  ));
}

async function saveMeetingsToDatabase(meetings) {
  if (!meetings.length) return;
  throwIfSupabaseError(await db.from("raahat_meetings").upsert(
    meetings.map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      date: meeting.date,
      theme_name: meeting.theme,
      mom: meeting.mom
    })),
    { onConflict: "id" }
  ));
}

async function saveActionsToDatabase(actions) {
  if (!actions.length) return;
  const actionIds = actions.map((action) => action.id);
  throwIfSupabaseError(await db.from("raahat_action_people").delete().in("action_id", actionIds));
  throwIfSupabaseError(await db.from("raahat_action_themes").delete().in("action_id", actionIds));
  throwIfSupabaseError(await db.from("raahat_actions").upsert(
    actions.map(actionToRow),
    { onConflict: "id" }
  ));
  await saveActionPeopleToDatabase(actions);
  await saveActionThemesToDatabase(actions);
}

async function saveParticipantsToDatabase(meetings) {
  const rows = meetings.flatMap((meeting) => normalizeParticipants(meeting.participants).map((personName) => ({
    meeting_id: meeting.id,
    person_name: personName
  })));
  if (!rows.length) return;
  throwIfSupabaseError(await db.from("raahat_meeting_participants").upsert(rows, { onConflict: "meeting_id,person_name" }));
}

async function saveActionPeopleToDatabase(actions) {
  const rows = actions.flatMap((action) => normalizePeople(action.people || action.owner).map((personName) => ({
    action_id: action.id,
    person_name: personName
  })));
  if (!rows.length) return;
  throwIfSupabaseError(await db.from("raahat_action_people").upsert(rows, { onConflict: "action_id,person_name" }));
}

async function saveActionThemesToDatabase(actions) {
  const rows = actions.flatMap((action) => normalizeThemes(action.themes || action.theme).map((themeName) => ({
    action_id: action.id,
    theme_name: themeName
  })));
  if (!rows.length) return;
  throwIfSupabaseError(await db.from("raahat_action_themes").upsert(rows, { onConflict: "action_id,theme_name" }));
}

async function saveActionNoteToDatabase(note) {
  if (!note.note.trim()) return;
  throwIfSupabaseError(await db.from("raahat_action_notes").insert({
    id: note.id,
    action_id: note.actionId,
    note: note.note.trim(),
    person_name: note.person,
    note_date: note.noteDate || isoToday
  }));
}

async function saveActionNotesToDatabase(notes) {
  if (!notes.length) return;
  throwIfSupabaseError(await db.from("raahat_action_notes").insert(notes.map((note) => ({
    id: note.id || crypto.randomUUID(),
    action_id: note.actionId,
    note: note.note,
    person_name: note.person,
    note_date: note.noteDate || isoToday
  }))));
}

function actionToRow(action) {
  return {
    id: action.id,
    title: action.title,
    priority: action.priority,
    status: action.status,
    due_date: action.dueDate,
    meeting_id: action.meetingId || null,
    notes: action.notes || null,
    created_at: action.createdAt || isoToday,
    completed_at: action.completedAt || null
  };
}

async function syncFromDatabase(message = "Database: synced") {
  state = await loadState();
  render();
  setSyncStatus(message);
}

async function runDatabaseChange(work, successMessage) {
  setSyncStatus("Database: saving");
  try {
    await work();
    await syncFromDatabase(successMessage);
  } catch (error) {
    console.error(error);
    setSyncStatus(`Database: ${error.message}`, true);
    alert(`Database save failed: ${error.message}`);
  }
}

function renderFilters() {
  const currentTheme = els.themeFilter.value || "all";
  const currentOwner = els.ownerFilter.value || "all";
  const owners = state.owners.map((owner) => owner.name).sort();

  els.themeFilter.innerHTML = optionHtml(["all", ...state.themes], currentTheme, "All themes");
  els.ownerFilter.innerHTML = optionHtml(["all", ...owners], currentOwner, "All people");
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
  document.querySelector("#meetingParticipants").innerHTML = options;
  document.querySelector("#actionNotePerson").innerHTML = options;
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
    return (theme === "all" || normalizeThemes(action.themes || action.theme).includes(theme))
      && (owner === "all" || normalizePeople(action.people || action.owner).includes(owner))
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
            <span>${escapeHtml(formatParticipants(meeting.participants))}</span>
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
        <td>${escapeHtml(formatPeople(action.people || action.owner))}</td>
        <td>${escapeHtml(formatThemes(action.themes || action.theme))}</td>
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
            <button class="small-button danger-button" type="button" onclick="deleteAction('${action.id}')">Delete</button>
          </div>
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="7">${emptyState("No actions for the selected filters.")}</td></tr>`;
}

function renderOwners() {
  els.ownerTable.innerHTML = state.owners.length
    ? state.owners.map((owner) => {
      const openActions = state.actions.filter((action) => normalizePeople(action.people || action.owner).includes(owner.name) && action.status !== "Done").length;
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
    : `<tr><td colspan="5">${emptyState("No people yet.")}</td></tr>`;
}

function renderMeetingActionDrafts() {
  els.meetingActionList.innerHTML = meetingActionDrafts.length
    ? meetingActionDrafts.map((action) => `
      <article class="embedded-item">
        <div>
          <strong>${escapeHtml(action.title)}</strong>
          <div class="meta-row">
            <span>${escapeHtml(formatPeople(action.people || action.owner))}</span>
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

function renderActionNoteHistory(actionId) {
  const notes = state.actionNotes
    .filter((note) => note.actionId === actionId)
    .sort((a, b) => `${b.noteDate}${b.createdAt}`.localeCompare(`${a.noteDate}${a.createdAt}`));
  document.querySelector("#actionNoteHistory").innerHTML = notes.length
    ? notes.map((note) => `
      <article class="embedded-item">
        <div>
          <strong>${escapeHtml(formatDate(note.noteDate))} · ${escapeHtml(note.person || "Unknown person")}</strong>
          <p>${escapeHtml(note.note)}</p>
        </div>
      </article>
    `).join("")
    : emptyState("No note history yet.");
}

function renderThemes() {
  els.themeBoard.innerHTML = state.themes.map((theme) => {
    const actions = state.actions.filter((action) => normalizeThemes(action.themes || action.theme).includes(theme));
    const done = actions.filter((action) => action.status === "Done").length;
    const overdue = actions.filter((action) => action.status !== "Done" && action.dueDate < isoToday).length;
    return `
      <article class="theme-card clickable-card" role="button" tabindex="0" onclick="showThemeActions('${escapeJs(theme)}')" onkeydown="handleThemeCardKey(event, '${escapeJs(theme)}')">
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

function showThemeActions(theme) {
  els.themeFilter.value = theme;
  els.statusFilter.value = "all";
  renderActions();
  renderDashboard();
  setView("actions");
}

function handleThemeCardKey(event, theme) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  showThemeActions(theme);
}

function actionCard(action) {
  return `
    <article class="action-card">
      <div class="card-title">
        <strong>${escapeHtml(action.title)}</strong>
        <span class="pill priority-${action.priority}">${escapeHtml(action.priority)}</span>
      </div>
      <div class="meta-row">
        <span>${escapeHtml(formatPeople(action.people || action.owner))}</span>
        <span>${escapeHtml(formatThemes(action.themes || action.theme))}</span>
        <span>Due ${formatDate(action.dueDate)}</span>
        <span class="pill status-${action.status.replaceAll(" ", "-")}">${escapeHtml(action.status)}</span>
      </div>
      <div class="row-actions">
        <button class="small-button secondary-button" type="button" onclick="openActionDialog('${action.id}')">Edit</button>
        <button class="small-button secondary-button" type="button" onclick="updateStatus('${action.id}', 'Done')">Done</button>
        <button class="small-button danger-button" type="button" onclick="deleteAction('${action.id}')">Delete</button>
      </div>
    </article>
  `;
}

function setView(viewName) {
  Object.entries(els.views).forEach(([name, view]) => view.classList.toggle("active-view", name === viewName));
  els.navTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewName));
  const titles = { owners: "People" };
  els.viewTitle.textContent = titles[viewName] || viewName.charAt(0).toUpperCase() + viewName.slice(1);
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
  setMultiSelectValues(document.querySelector("#meetingParticipants"), normalizeParticipants(meeting?.participants));
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
  setMultiSelectValues(document.querySelector("#actionOwner"), normalizePeople(action?.people || action?.owner || state.owners[0].name));
  setMultiSelectValues(document.querySelector("#actionTheme"), normalizeThemes(action?.themes || action?.theme || meeting?.theme || state.themes[0]));
  document.querySelector("#actionPriority").value = action?.priority || "Medium";
  document.querySelector("#actionStatus").value = action?.status || "Open";
  document.querySelector("#actionDueDate").value = action?.dueDate || addDays(isoToday, 7);
  document.querySelector("#actionMeeting").value = action?.meetingId || meetingId || "";
  document.querySelector("#actionNotes").value = action?.notes || "";
  document.querySelector("#actionNotePerson").value = state.owners[0]?.name || "";
  document.querySelector("#actionNoteDate").value = isoToday;
  document.querySelector("#actionNewNote").value = "";
  renderActionNoteHistory(action?.id || "");
  els.actionDialog.showModal();
}

async function saveMeeting(event) {
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
    participants: getMultiSelectValues(document.querySelector("#meetingParticipants")),
    mom: document.querySelector("#meetingMom").value.trim()
  };
  const linkedActions = meetingActionDrafts.map((action) => ({ ...action, meetingId: id }));
  await runDatabaseChange(async () => {
    throwIfSupabaseError(await db.from("raahat_meetings").upsert({
      id: meeting.id,
      title: meeting.title,
      date: meeting.date,
      theme_name: meeting.theme,
      mom: meeting.mom
    }, { onConflict: "id" }));
    throwIfSupabaseError(await db.from("raahat_meeting_participants").delete().eq("meeting_id", id));
    await saveParticipantsToDatabase([meeting]);
    throwIfSupabaseError(await db.from("raahat_actions").delete().eq("meeting_id", id));
    await saveActionsToDatabase(linkedActions);
    meetingActionDrafts = [];
    activeMeetingId = "";
    els.meetingDialog.close();
  }, "Database: meeting saved");
}

function saveMeetingActionDraft() {
  const title = document.querySelector("#meetingActionTitle").value.trim();
  const people = getMultiSelectValues(document.querySelector("#meetingActionOwner"));
  const themes = getMultiSelectValues(document.querySelector("#meetingActionTheme"));
  const dueDate = document.querySelector("#meetingActionDueDate").value;
  if (!title || !people.length || !themes.length || !dueDate) {
    alert("Action item, people, themes, and due date are required.");
    return;
  }
  const id = document.querySelector("#meetingActionId").value || crypto.randomUUID();
  const existing = meetingActionDrafts.find((action) => action.id === id);
  const status = document.querySelector("#meetingActionStatus").value;
  const action = {
    id,
    title,
    people,
    themes,
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
  setMultiSelectValues(document.querySelector("#meetingActionOwner"), normalizePeople(action.people || action.owner));
  setMultiSelectValues(document.querySelector("#meetingActionTheme"), normalizeThemes(action.themes || action.theme));
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
  setMultiSelectValues(document.querySelector("#meetingActionOwner"), state.owners[0]?.name ? [state.owners[0].name] : []);
  setMultiSelectValues(document.querySelector("#meetingActionTheme"), [document.querySelector("#meetingTheme").value || state.themes[0]].filter(Boolean));
  document.querySelector("#meetingActionPriority").value = "Medium";
  document.querySelector("#meetingActionStatus").value = "Open";
  document.querySelector("#meetingActionDueDate").value = addDays(isoToday, 7);
  document.querySelector("#meetingActionNotes").value = "";
  document.querySelector("#saveMeetingAction").textContent = "Add action point";
  document.querySelector("#cancelMeetingActionEdit").classList.add("hidden");
}

function normalizeParticipants(participants) {
  if (Array.isArray(participants)) return participants.filter(Boolean);
  if (typeof participants === "string") {
    return participants.split(",").map((name) => name.trim()).filter(Boolean);
  }
  return [];
}

function normalizePeople(people) {
  return normalizeParticipants(people);
}

function normalizeThemes(themes) {
  return normalizeParticipants(themes);
}

function formatParticipants(participants) {
  const names = normalizeParticipants(participants);
  return names.length ? names.join(", ") : "No participants listed";
}

function formatPeople(people) {
  const names = normalizePeople(people);
  return names.length ? names.join(", ") : "No people selected";
}

function formatThemes(themes) {
  const names = normalizeThemes(themes);
  return names.length ? names.join(", ") : "No themes selected";
}

function getMultiSelectValues(select) {
  return [...select.selectedOptions].map((option) => option.value);
}

function setMultiSelectValues(select, values) {
  const selected = new Set(values);
  [...select.options].forEach((option) => {
    option.selected = selected.has(option.value);
  });
}

async function saveAction(event) {
  event.preventDefault();
  const id = document.querySelector("#actionId").value || crypto.randomUUID();
  const existing = state.actions.find((action) => action.id === id);
  const status = document.querySelector("#actionStatus").value;
  const people = getMultiSelectValues(document.querySelector("#actionOwner"));
  const themes = getMultiSelectValues(document.querySelector("#actionTheme"));
  const newNote = document.querySelector("#actionNewNote").value.trim();
  const notePerson = document.querySelector("#actionNotePerson").value;
  const noteDate = document.querySelector("#actionNoteDate").value || isoToday;
  if (!people.length || !themes.length) {
    alert("Select at least one person and one theme.");
    return;
  }
  if (newNote && !notePerson) {
    alert("Select the person adding the note.");
    return;
  }
  const action = {
    id,
    title: document.querySelector("#actionTitle").value.trim(),
    people,
    themes,
    priority: document.querySelector("#actionPriority").value,
    status,
    dueDate: document.querySelector("#actionDueDate").value,
    meetingId: document.querySelector("#actionMeeting").value,
    notes: document.querySelector("#actionNotes").value.trim(),
    createdAt: existing?.createdAt || isoToday,
    completedAt: status === "Done" ? (existing?.completedAt || isoToday) : ""
  };
  await runDatabaseChange(async () => {
    await saveActionsToDatabase([action]);
    if (newNote) {
      await saveActionNoteToDatabase({
        id: crypto.randomUUID(),
        actionId: id,
        note: newNote,
        person: notePerson,
        noteDate
      });
    }
    els.actionDialog.close();
  }, "Database: action saved");
}

async function saveOwner(event) {
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
    alert("A person with this name already exists.");
    return;
  }
  await runDatabaseChange(async () => {
    throwIfSupabaseError(await db.from("raahat_people").upsert({
      id: owner.id,
      name: owner.name,
      role: owner.role || null,
      email: owner.email || null
    }, { onConflict: "id" }));
    if (previousName && previousName !== owner.name) {
      throwIfSupabaseError(await db.from("raahat_action_people").update({ person_name: owner.name }).eq("person_name", previousName));
      throwIfSupabaseError(await db.from("raahat_meeting_participants").update({ person_name: owner.name }).eq("person_name", previousName));
    }
    resetOwnerForm();
  }, "Database: person saved");
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

async function deleteOwner(id) {
  const owner = state.owners.find((item) => item.id === id);
  if (!owner) return;
  const openActions = state.actions.filter((action) => normalizePeople(action.people || action.owner).includes(owner.name) && action.status !== "Done").length;
  if (openActions > 0) {
    alert("Reassign or complete this person's open actions before deleting.");
    return;
  }
  if (!confirm(`Delete person "${owner.name}"? Completed action history will keep the person name.`)) return;
  await runDatabaseChange(async () => {
    throwIfSupabaseError(await db.from("raahat_people").delete().eq("id", id));
    resetOwnerForm();
  }, "Database: person deleted");
}

function resetOwnerForm() {
  els.ownerForm.reset();
  document.querySelector("#ownerId").value = "";
  document.querySelector("#saveOwnerButton").textContent = "Add";
  document.querySelector("#cancelOwnerEdit").classList.add("hidden");
}

async function saveTheme(event) {
  event.preventDefault();
  const name = document.querySelector("#themeName").value.trim();
  if (!name) return;
  await runDatabaseChange(async () => {
    throwIfSupabaseError(await db.from("raahat_themes").upsert({ name }, { onConflict: "name" }));
    event.target.reset();
  }, "Database: theme saved");
}

async function updateStatus(id, status) {
  const action = state.actions.find((item) => item.id === id);
  const completedAt = status === "Done" ? (action?.completedAt || isoToday) : null;
  await runDatabaseChange(async () => {
    throwIfSupabaseError(await db.from("raahat_actions").update({ status, completed_at: completedAt }).eq("id", id));
  }, "Database: status updated");
}

async function deleteAction(id) {
  const action = state.actions.find((item) => item.id === id);
  if (!action) return;
  if (!confirm(`Delete action "${action.title}"? This will also delete its people, theme, and note history links.`)) return;
  await runDatabaseChange(async () => {
    throwIfSupabaseError(await db.from("raahat_actions").delete().eq("id", id));
  }, "Database: action deleted");
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
  reader.onload = async () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported.themes) || !Array.isArray(imported.meetings) || !Array.isArray(imported.actions)) {
        throw new Error("Invalid data");
      }
      const normalized = normalizeState(imported);
      await runDatabaseChange(async () => {
        await clearDatabaseTables();
        await seedDatabase(normalized);
      }, "Database: imported");
    } catch (error) {
      alert(`Import failed: ${error.message}`);
    }
  };
  reader.readAsText(file);
}

async function clearData() {
  if (!confirm("Clear all database records for meetings, actions, people, and themes?")) return;
  setSyncStatus("Database: clearing");
  try {
    await clearDatabaseTables();
    state = await loadState();
    render();
    setSyncStatus("Database: cleared");
  } catch (error) {
    console.error(error);
    setSyncStatus(`Database: ${error.message}`, true);
    alert(`Clear failed: ${error.message}`);
  }
}

async function clearDatabaseTables() {
  throwIfSupabaseError(await db.from("raahat_meeting_participants").delete().neq("meeting_id", "00000000-0000-0000-0000-000000000000"));
  throwIfSupabaseError(await db.from("raahat_action_people").delete().neq("action_id", "00000000-0000-0000-0000-000000000000"));
  throwIfSupabaseError(await db.from("raahat_action_themes").delete().neq("action_id", "00000000-0000-0000-0000-000000000000"));
  throwIfSupabaseError(await db.from("raahat_action_notes").delete().neq("id", "00000000-0000-0000-0000-000000000000"));
  throwIfSupabaseError(await db.from("raahat_actions").delete().neq("id", "00000000-0000-0000-0000-000000000000"));
  throwIfSupabaseError(await db.from("raahat_meetings").delete().neq("id", "00000000-0000-0000-0000-000000000000"));
  throwIfSupabaseError(await db.from("raahat_people").delete().neq("id", "00000000-0000-0000-0000-000000000000"));
  throwIfSupabaseError(await db.from("raahat_themes").delete().neq("name", ""));
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

function escapeJs(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "");
}
