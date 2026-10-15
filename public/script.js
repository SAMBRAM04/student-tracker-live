// ── API Helper ──
async function apiRequest(path, options = {}) {
  let response;

  try {
    response = await fetch(path, options);
  } catch {
    throw new Error('Network error. Check that the server is running.');
  }

  let data;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || `Request failed: ${response.status}`);
  }

  return data;
}

// ── Store (API-backed) ──
const store = {
  list: () => apiRequest('/api/projects'),

  create: (project) =>
    apiRequest('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project),
    }),

  update: (id, project) =>
    apiRequest(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project),
    }),

  remove: (id) =>
    apiRequest(`/api/projects/${id}`, { method: 'DELETE' }),
};

// ── DOM References ──
const form = document.querySelector('#project-form');
const nameInput = document.querySelector('#name');
const statusInput = document.querySelector('#status');
const priorityInput = document.querySelector('#priority');
const descriptionInput = document.querySelector('#description');
const charCounter = document.querySelector('#char-counter');
const saveButton = document.querySelector('#save-button');
const cancelButton = document.querySelector('#cancel-button');
const projectList = document.querySelector('#project-list');
const emptyState = document.querySelector('#empty-state');
const message = document.querySelector('#message');
const formTitle = document.querySelector('#form-title');
const formModeBadge = document.querySelector('#form-mode-badge');

// Filter & Search Controls
const searchInput = document.querySelector('#search-input');
const filterStatus = document.querySelector('#filter-status');
const filterPriority = document.querySelector('#filter-priority');
const sortSelect = document.querySelector('#sort-select');
const showingCount = document.querySelector('#showing-count');

// Stats Elements
const statTotal = document.querySelector('#stat-total');
const statPlanned = document.querySelector('#stat-planned');
const statProgress = document.querySelector('#stat-progress');
const statCompleted = document.querySelector('#stat-completed');
const progressFill = document.querySelector('#progress-fill');
const completionPercent = document.querySelector('#completion-percent');

// Theme & Export
const themeToggle = document.querySelector('#theme-toggle');
const themeIcon = document.querySelector('#theme-icon');
const exportButton = document.querySelector('#export-button');

// ── State ──
let allProjects = [];
let editingId = null;
let isBusy = false;

// ── Theme Management ──
function initTheme() {
  const savedTheme = localStorage.getItem('project_tracker_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
  if (themeIcon) {
    themeIcon.textContent = theme === 'light' ? '☀️' : '🌙';
  }
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('project_tracker_theme', nextTheme);
    updateThemeIcon(nextTheme);
  });
}

// ── Character Counter ──
if (nameInput && charCounter) {
  nameInput.addEventListener('input', () => {
    charCounter.textContent = `${nameInput.value.length} / 80`;
  });
}

// ── Feedback Messaging ──
function tell(text, isError = false) {
  message.textContent = text;
  message.dataset.error = String(isError);
}

// ── Busy State Management ──
function setBusy(value) {
  isBusy = value;

  form
    .querySelectorAll('input, select, textarea, button')
    .forEach((el) => (el.disabled = value));

  projectList
    .querySelectorAll('button')
    .forEach((el) => (el.disabled = value));

  if (saveButton) {
    saveButton.style.cursor = value ? 'wait' : '';
  }
}

// ── Reset Form ──
function resetForm() {
  editingId = null;
  form.reset();
  if (charCounter) charCounter.textContent = '0 / 80';
  saveButton.textContent = 'Add Project';
  cancelButton.hidden = true;
  formTitle.textContent = 'Add a Project';
  if (formModeBadge) {
    formModeBadge.textContent = 'New Entry';
    formModeBadge.style.color = '';
  }
}

// ── Stats & Progress Updates ──
function updateDashboardMetrics(projects) {
  const total = projects.length;
  const planned = projects.filter((p) => p.status === 'Planned').length;
  const inProgress = projects.filter((p) => p.status === 'In Progress').length;
  const completed = projects.filter((p) => p.status === 'Completed').length;

  if (statTotal) statTotal.textContent = total;
  if (statPlanned) statPlanned.textContent = planned;
  if (statProgress) statProgress.textContent = inProgress;
  if (statCompleted) statCompleted.textContent = completed;

  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  if (progressFill) progressFill.style.width = `${percentage}%`;
  if (completionPercent) completionPercent.textContent = `${percentage}%`;

  document.title = total > 0 ? `(${total}) Student Project Tracker` : 'Student Project Tracker';
}

// ── Format Date Utility ──
function formatDate(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

// ── Render Filtered & Sorted Project List ──
function renderList() {
  const query = (searchInput?.value || '').toLowerCase().trim();
  const statusFilter = filterStatus?.value || 'ALL';
  const priorityFilter = filterPriority?.value || 'ALL';
  const sortBy = sortSelect?.value || 'newest';

  // Apply filters
  let filtered = allProjects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(query) ||
      (project.description && project.description.toLowerCase().includes(query));

    const matchesStatus = statusFilter === 'ALL' || project.status === statusFilter;
    const matchesPriority = priorityFilter === 'ALL' || project.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Apply sorting
  filtered.sort((a, b) => {
    if (sortBy === 'newest') return (b.id || 0) - (a.id || 0);
    if (sortBy === 'oldest') return (a.id || 0) - (b.id || 0);
    if (sortBy === 'az') return a.name.localeCompare(b.name);
    if (sortBy === 'za') return b.name.localeCompare(a.name);
    return 0;
  });

  if (showingCount) {
    showingCount.textContent = `${filtered.length} of ${allProjects.length}`;
  }

  projectList.replaceChildren();
  emptyState.hidden = filtered.length > 0;

  for (const project of filtered) {
    const item = document.createElement('li');
    item.className = 'project-item' + (project.status === 'Completed' ? ' completed-state' : '');

    // Project Body Info
    const body = document.createElement('div');
    body.className = 'project-body';

    // Title Row
    const titleRow = document.createElement('div');
    titleRow.className = 'project-title-row';

    const nameHeading = document.createElement('h3');
    nameHeading.className = 'project-name';
    nameHeading.textContent = project.name;

    // Status Badge
    const statusBadge = document.createElement('span');
    const statusClass =
      project.status === 'Planned'
        ? 'tag-status-planned'
        : project.status === 'In Progress'
        ? 'tag-status-in-progress'
        : 'tag-status-completed';

    statusBadge.className = `tag-badge ${statusClass}`;
    statusBadge.textContent = project.status;

    // Priority Badge
    const priority = project.priority || 'Medium';
    const priorityBadge = document.createElement('span');
    const priorityClass =
      priority === 'High'
        ? 'tag-priority-high'
        : priority === 'Low'
        ? 'tag-priority-low'
        : 'tag-priority-medium';

    priorityBadge.className = `tag-badge ${priorityClass}`;
    priorityBadge.textContent = `${priority} Priority`;

    titleRow.append(nameHeading, statusBadge, priorityBadge);
    body.appendChild(titleRow);

    // Optional Description
    if (project.description) {
      const descPara = document.createElement('p');
      descPara.className = 'project-desc';
      descPara.textContent = project.description;
      body.appendChild(descPara);
    }

    // Meta Footer
    const metaFooter = document.createElement('div');
    metaFooter.className = 'project-footer-meta';
    if (project.created_at) {
      const timeSpan = document.createElement('span');
      timeSpan.textContent = `Added: ${formatDate(project.created_at)}`;
      metaFooter.appendChild(timeSpan);
    }
    const idSpan = document.createElement('span');
    idSpan.textContent = `#ID: ${project.id}`;
    metaFooter.appendChild(idSpan);

    body.appendChild(metaFooter);

    // Actions Block
    const controls = document.createElement('div');
    controls.className = 'project-controls';

    // Quick Status Toggle Button
    const quickToggleBtn = document.createElement('button');
    quickToggleBtn.type = 'button';
    quickToggleBtn.className = 'btn btn-small btn-quick-toggle';
    quickToggleBtn.title = 'Quick status toggle';
    quickToggleBtn.textContent = project.status === 'Completed' ? '↩ Reopen' : '✓ Done';
    quickToggleBtn.addEventListener('click', async () => {
      if (isBusy) return;
      const nextStatus = project.status === 'Completed' ? 'In Progress' : 'Completed';
      setBusy(true);
      tell('Updating status...');
      try {
        await store.update(project.id, {
          name: project.name,
          status: nextStatus,
          priority: project.priority || 'Medium',
          description: project.description || ''
        });
        await refreshProjects();
        tell(`Status updated to "${nextStatus}".`);
      } catch (err) {
        tell('Error: ' + err.message, true);
      } finally {
        setBusy(false);
      }
    });

    // Edit Button
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-small btn-edit';
    editBtn.textContent = 'Edit';
    editBtn.setAttribute('aria-label', `Edit ${project.name}`);

    editBtn.addEventListener('click', () => {
      if (isBusy) return;

      editingId = project.id;
      nameInput.value = project.name;
      statusInput.value = project.status;
      if (priorityInput) priorityInput.value = project.priority || 'Medium';
      if (descriptionInput) descriptionInput.value = project.description || '';
      if (charCounter) charCounter.textContent = `${project.name.length} / 80`;

      saveButton.textContent = 'Save Changes';
      cancelButton.hidden = false;
      formTitle.textContent = 'Edit Project';
      if (formModeBadge) {
        formModeBadge.textContent = `Editing #${project.id}`;
        formModeBadge.style.color = 'var(--status-progress-text)';
      }

      tell(`Editing project "${project.name}".`);
      nameInput.focus();
    });

    // Delete Button
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-small btn-delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('aria-label', `Delete ${project.name}`);

    deleteBtn.addEventListener('click', async () => {
      if (isBusy) return;

      const confirmed = window.confirm(
        `Are you sure you want to delete "${project.name}"?`
      );

      if (!confirmed) {
        tell('Deletion cancelled.');
        return;
      }

      setBusy(true);
      tell('Deleting project...');

      try {
        await store.remove(project.id);

        if (editingId === project.id) {
          resetForm();
        }

        await refreshProjects();
        tell('Project deleted successfully!');
      } catch (error) {
        tell('Error: ' + error.message, true);
      } finally {
        setBusy(false);
      }
    });

    controls.append(quickToggleBtn, editBtn, deleteBtn);
    item.append(body, controls);
    projectList.appendChild(item);
  }
}

// ── Refresh Projects from API ──
async function refreshProjects() {
  const data = await store.list();

  if (!Array.isArray(data)) {
    throw new Error('The server returned an invalid project list.');
  }

  allProjects = data;

  updateDashboardMetrics(allProjects);

  // If currently editing a project that was deleted, reset form
  if (editingId !== null && !allProjects.some((p) => p.id === editingId)) {
    resetForm();
  }

  renderList();
}

// ── Filter & Search Listeners ──
if (searchInput) searchInput.addEventListener('input', renderList);
if (filterStatus) filterStatus.addEventListener('change', renderList);
if (filterPriority) filterPriority.addEventListener('change', renderList);
if (sortSelect) sortSelect.addEventListener('change', renderList);

// ── Export to JSON Feature ──
if (exportButton) {
  exportButton.addEventListener('click', () => {
    if (allProjects.length === 0) {
      tell('No projects available to export.');
      return;
    }

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(allProjects, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `student-projects-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    tell('Projects exported to JSON!');
  });
}

// ── Form Submit Listener ──
form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (isBusy) return;

  const name = nameInput.value.trim();
  const status = statusInput.value;
  const priority = priorityInput?.value || 'Medium';
  const description = descriptionInput?.value.trim() || '';

  if (!name) {
    tell('Please enter a project name.', true);
    nameInput.focus();
    return;
  }

  if (name.length > 80) {
    tell('Project name must be 80 characters or fewer.', true);
    nameInput.focus();
    return;
  }

  if (!['Planned', 'In Progress', 'Completed'].includes(status)) {
    tell('Please select a valid project status.', true);
    return;
  }

  const wasEditing = editingId !== null;
  const projectPayload = { name, status, priority, description };

  setBusy(true);
  tell(wasEditing ? 'Saving changes...' : 'Adding project...');

  try {
    if (wasEditing) {
      await store.update(editingId, projectPayload);
    } else {
      await store.create(projectPayload);
    }

    resetForm();
    await refreshProjects();

    tell(
      wasEditing
        ? 'Project updated successfully!'
        : 'Project added successfully!'
    );

    nameInput.focus();
  } catch (error) {
    tell('Error: ' + error.message, true);
  } finally {
    setBusy(false);
  }
});

// ── Cancel Button Listener ──
cancelButton.addEventListener('click', () => {
  if (isBusy) return;
  resetForm();
  tell('Edit cancelled.');
  nameInput.focus();
});

// ── Keyboard Shortcuts (Esc to cancel) ──
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && editingId !== null) {
    resetForm();
    tell('Edit cancelled via Escape key.');
  }
});

// ── App Initialization ──
async function initialize() {
  initTheme();
  setBusy(true);
  tell('Loading projects...');

  try {
    await refreshProjects();
    tell('Ready.');
  } catch (error) {
    tell(
      'Could not load projects: ' + error.message + ' Check that the server is running.',
      true
    );
  } finally {
    setBusy(false);
  }
}

initialize();