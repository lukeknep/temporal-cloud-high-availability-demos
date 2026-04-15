"use strict";
let chart = null;
let autoRefreshInterval = null;
let timeUpdateInterval = null;
let loadingTimeout = null;
let currentWorkflowsData = [];
// Track errors per workflow so they persist until that workflow succeeds
const workflowErrors = new Map();
// Color palette for multiple workflows
const colors = [
    '#4CAF50',
    '#2196F3',
    '#FF9800',
    '#9C27B0',
    '#F44336',
    '#00BCD4',
    '#FFEB3B',
    '#E91E63'
];
function setWorkflowError(workflowId, message) {
    workflowErrors.set(workflowId, message);
    renderErrors();
}
function clearWorkflowError(workflowId) {
    workflowErrors.delete(workflowId);
    renderErrors();
}
function renderErrors() {
    const errorDiv = document.getElementById('error');
    if (!errorDiv)
        return;
    if (workflowErrors.size === 0) {
        errorDiv.style.display = 'none';
        return;
    }
    errorDiv.innerHTML = Array.from(workflowErrors.values())
        .map(msg => `<div>${msg}</div>`)
        .join('');
    errorDiv.style.display = 'block';
}
function showLoadingDelayed() {
    if (loadingTimeout !== null)
        clearTimeout(loadingTimeout);
    loadingTimeout = window.setTimeout(() => {
        const loadingDiv = document.getElementById('loading');
        if (loadingDiv)
            loadingDiv.style.display = 'block';
    }, 3000);
}
function hideLoading() {
    if (loadingTimeout !== null) {
        clearTimeout(loadingTimeout);
        loadingTimeout = null;
    }
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) {
        loadingDiv.style.display = 'none';
    }
}
async function fetchWorkflowStats(workflowId) {
    try {
        const response = await fetch(`/api/workflows/${encodeURIComponent(workflowId)}/stats`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch workflow stats');
        }
        return await response.json();
    }
    catch (error) {
        console.error(`Error fetching workflow ${workflowId}:`, error);
        throw error;
    }
}
function timeSince(lastChangedAt) {
    const changeTime = new Date(lastChangedAt).getTime();
    const now = Date.now();
    const diffMs = now - changeTime;
    const diffSecs = (diffMs / 1000).toFixed(1);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 0) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    }
    else if (diffHours > 0) {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    }
    else if (diffMins > 0) {
        return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    }
    else {
        return `${diffSecs} seconds ago`;
    }
}
// Compute a continuous background color for a card based on time elapsed.
// Bright blue for <1 min, then fades to grey over the next 5 minutes.
function getCardColor(timestamp) {
    if (!timestamp)
        return 'rgb(144, 164, 174)'; // grey for unknown
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const ONE_MIN = 60 * 1000;
    const SIX_MIN = 6 * 60 * 1000; // 1 min hold + 5 min fade
    if (diffMs < ONE_MIN) {
        return 'rgb(41, 121, 255)'; // bright blue
    }
    // t goes from 0 (at 1 min) to 1 (at 6 min or older)
    const t = Math.min((diffMs - ONE_MIN) / (SIX_MIN - ONE_MIN), 1);
    // Interpolate: blue (41,121,255) → grey (144,164,174)
    const r = Math.round(41 + (144 - 41) * t);
    const g = Math.round(121 + (164 - 121) * t);
    const b = Math.round(255 + (174 - 255) * t);
    return `rgb(${r}, ${g}, ${b})`;
}
// Update the time-since displays and card colors every second
function updateTimeDisplays() {
    // Update "time since change" text
    document.querySelectorAll('.time-since-change').forEach((el) => {
        const ts = el.getAttribute('data-timestamp');
        if (ts)
            el.textContent = timeSince(ts);
    });
    // Update "time since check" text
    document.querySelectorAll('.time-since-check').forEach((el) => {
        const ts = el.getAttribute('data-timestamp');
        if (ts)
            el.textContent = timeSince(ts);
    });
    // Update card background colors based on last-changed timestamp
    document.querySelectorAll('.workflow-card').forEach((card) => {
        const ts = card.getAttribute('data-changed-timestamp');
        if (ts) {
            card.style.background = getCardColor(ts);
        }
    });
}
// Start the interval to update time displays
function startTimeUpdates() {
    // Clear any existing interval
    if (timeUpdateInterval !== null) {
        clearInterval(timeUpdateInterval);
    }
    // Update immediately
    updateTimeDisplays();
    // Then update every second
    timeUpdateInterval = window.setInterval(() => {
        updateTimeDisplays();
    }, 1000);
}
// Stop the time update interval
function stopTimeUpdates() {
    if (timeUpdateInterval !== null) {
        clearInterval(timeUpdateInterval);
        timeUpdateInterval = null;
    }
}
function displayWorkflowInfo(workflowsData) {
    const listDiv = document.getElementById('workflowList');
    if (!listDiv)
        return;
    if (workflowsData.length === 0) {
        listDiv.style.display = 'none';
        return;
    }
    // Store the workflows data for live updates
    currentWorkflowsData = workflowsData;
    // Check if we can update existing cards in-place
    const existingIds = Array.from(listDiv.querySelectorAll('.workflow-card'))
        .map(el => el.getAttribute('data-workflow-id'));
    const newIds = workflowsData.map(w => w.workflowId);
    const canUpdateInPlace = existingIds.length === newIds.length &&
        existingIds.every((id, i) => id === newIds[i]);
    if (canUpdateInPlace) {
        // Update each card's dynamic data without replacing DOM
        workflowsData.forEach(({ workflowId, data }) => {
            const card = listDiv.querySelector(`.workflow-card[data-workflow-id="${workflowId}"]`);
            if (!card)
                return;
            const changedTs = data.contentLastChangedAt || '';
            const checkedTs = data.contentLastCheckedAt || '';
            card.setAttribute('data-changed-timestamp', changedTs);
            card.style.background = getCardColor(changedTs);
            const checkEl = card.querySelector('.time-since-check');
            if (checkEl) {
                checkEl.setAttribute('data-timestamp', checkedTs);
                checkEl.textContent = checkedTs ? timeSince(checkedTs) : 'Never';
            }
            const changeEl = card.querySelector('.time-since-change');
            if (changeEl) {
                changeEl.setAttribute('data-timestamp', changedTs);
                changeEl.textContent = changedTs ? timeSince(changedTs) : 'Never';
            }
            const checksMetaEl = card.querySelector('.card-footer .card-meta:first-child');
            if (checksMetaEl) {
                checksMetaEl.textContent = `${data.latencies.length} checks`;
            }
        });
    }
    else {
        // Full re-render when the set of workflows changed
        let html = '<h2>Monitored Pages</h2><div class="workflow-cards">';
        workflowsData.forEach(({ workflowId, data }) => {
            const changedTs = data.contentLastChangedAt || '';
            const checkedTs = data.contentLastCheckedAt || '';
            const bgColor = getCardColor(changedTs);
            const timeSinceCheck = checkedTs ? timeSince(checkedTs) : 'Never';
            const timeSinceChange = changedTs ? timeSince(changedTs) : 'Never';
            const displayUrl = data.url.replace(/^https?:\/\//, '');
            html += `
        <div class="workflow-card" data-workflow-id="${workflowId}" data-changed-timestamp="${changedTs}" style="background: ${bgColor}">
          <div class="card-url"><a href="${data.url}" target="_blank" rel="noopener">${displayUrl}</a></div>
          <div class="card-times">
            <div class="card-time-block">
              <span class="card-time-label">Last Checked</span>
              <span class="card-time-value time-since-check" data-timestamp="${checkedTs}">${timeSinceCheck}</span>
            </div>
            <div class="card-time-block">
              <span class="card-time-label">Last Changed</span>
              <span class="card-time-value time-since-change" data-timestamp="${changedTs}">${timeSinceChange}</span>
            </div>
          </div>
          <div class="card-footer">
            <span class="card-meta">${data.latencies.length} checks</span>
            <span class="card-meta">${workflowId}</span>
          </div>
        </div>
      `;
        });
        html += '</div>';
        listDiv.innerHTML = html;
    }
    listDiv.style.display = 'block';
    // Start the live time update if not already running
    startTimeUpdates();
}
function buildDatasets(workflowsData) {
    const datasets = [];
    workflowsData.forEach((workflow, index) => {
        const color = colors[index % colors.length];
        const { data } = workflow;
        if (data.latencies.length > 0) {
            const fiveMinAgo = Date.now() - 5 * 60 * 1000;
            const recentLatencies = data.latencies.filter((entry) => new Date(entry.timestamp).getTime() >= fiveMinAgo);
            const displayUrl = data.url.replace(/^https?:\/\//, '');
            datasets.push({
                label: displayUrl,
                data: recentLatencies.map((entry) => ({
                    x: new Date(entry.timestamp).getTime(),
                    y: entry.latency
                })),
                borderColor: color,
                backgroundColor: color + '20',
                borderWidth: 2,
                fill: false,
                tension: 0.3,
                pointRadius: 3,
                pointHoverRadius: 5
            });
        }
    });
    return datasets;
}
function createChart(workflowsData) {
    const datasets = buildDatasets(workflowsData);
    // Update existing chart in-place to avoid layout reflow
    if (chart) {
        chart.data.datasets = datasets;
        chart.update();
        return;
    }
    const canvas = document.getElementById('latencyChart');
    if (!canvas)
        return;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return;
    chart = new window.Chart(ctx, {
        type: 'line',
        data: {
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            animation: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Latency Over Time',
                    font: {
                        size: 32
                    }
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 24
                        },
                        padding: 30,
                        usePointStyle: false,
                        generateLabels: function (chart) {
                            return chart.data.datasets.map((ds, i) => ({
                                text: ds.label,
                                fillStyle: ds.borderColor,
                                strokeStyle: ds.borderColor,
                                fontColor: ds.borderColor,
                                hidden: !chart.isDatasetVisible(i),
                                datasetIndex: i
                            }));
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function (context) {
                            const timestamp = context[0].parsed.x;
                            return new Date(timestamp).toLocaleString();
                        },
                        label: function (context) {
                            return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} ms`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        displayFormats: {
                            millisecond: 'HH:mm:ss.SSS',
                            second: 'HH:mm:ss',
                            minute: 'HH:mm',
                            hour: 'MMM d, HH:mm',
                            day: 'MMM d',
                            week: 'MMM d',
                            month: 'MMM yyyy',
                            quarter: 'MMM yyyy',
                            year: 'yyyy'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Time'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Latency (ms)'
                    },
                    beginAtZero: true
                }
            }
        }
    });
}
async function fetchAndUpdateChart() {
    showLoadingDelayed();
    const input = document.getElementById('workflowIds');
    if (!input)
        return;
    const workflowIds = input.value
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);
    if (workflowIds.length === 0) {
        hideLoading();
        setWorkflowError('_input', 'Please enter at least one workflow ID');
        return;
    }
    clearWorkflowError('_input');
    // Clear errors for workflows no longer in the list
    for (const key of Array.from(workflowErrors.keys())) {
        if (!key.startsWith('_') && !workflowIds.includes(key)) {
            workflowErrors.delete(key);
        }
    }
    renderErrors();
    // Save workflow IDs to localStorage
    saveWorkflowIds();
    try {
        const workflowsData = [];
        for (const workflowId of workflowIds) {
            try {
                const data = await fetchWorkflowStats(workflowId);
                if (data) {
                    workflowsData.push({ workflowId, data });
                    clearWorkflowError(workflowId);
                }
            }
            catch (error) {
                setWorkflowError(workflowId, `Error loading workflow ${workflowId}: ${error.message}`);
            }
        }
        if (workflowsData.length > 0) {
            displayWorkflowInfo(workflowsData);
            createChart(workflowsData);
        }
    }
    catch (error) {
        setWorkflowError('_general', `Error: ${error.message}`);
    }
    finally {
        hideLoading();
    }
}
function toggleAutoRefresh(enabled) {
    if (enabled) {
        if (autoRefreshInterval === null) {
            fetchAndUpdateChart();
            autoRefreshInterval = window.setInterval(() => {
                fetchAndUpdateChart();
            }, 1000); // Refresh every 1 second
        }
    }
    else {
        if (autoRefreshInterval !== null) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
    }
}
// Save workflow IDs to localStorage
function saveWorkflowIds() {
    const input = document.getElementById('workflowIds');
    if (input && input.value.trim()) {
        localStorage.setItem('latencyMonitorWorkflowIds', input.value);
    }
}
// Load workflow IDs from localStorage
function loadWorkflowIds() {
    const savedIds = localStorage.getItem('latencyMonitorWorkflowIds');
    if (savedIds) {
        const input = document.getElementById('workflowIds');
        if (input) {
            input.value = savedIds;
        }
    }
}
// Generate a short deterministic hash from a URL string
function hashUrl(url) {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
        const ch = url.charCodeAt(i);
        hash = ((hash << 5) - hash) + ch;
        hash |= 0; // Convert to 32-bit integer
    }
    return 'monitor-' + Math.abs(hash).toString(16);
}
// Modal functions
function openNewWorkflowModal() {
    const modal = document.getElementById('newWorkflowModal');
    if (modal) {
        modal.style.display = 'block';
    }
}
function closeNewWorkflowModal() {
    const modal = document.getElementById('newWorkflowModal');
    if (modal) {
        modal.style.display = 'none';
    }
    // Reset form
    const form = document.getElementById('newWorkflowForm');
    if (form) {
        form.reset();
    }
}
// Expose functions globally for onclick handlers
window.openNewWorkflowModal = openNewWorkflowModal;
window.closeNewWorkflowModal = closeNewWorkflowModal;
// Start new workflow
async function startNewWorkflow(id, url, sleepInterval) {
    try {
        const response = await fetch('/api/workflows/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id, url, sleepInterval }),
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || 'Failed to start workflow');
        }
        return result;
    }
    catch (error) {
        console.error('Error starting workflow:', error);
        throw error;
    }
}
// Allow Enter key to trigger load
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('workflowIds');
    const autoRefreshCheckbox = document.getElementById('autoRefreshCheckbox');
    // Load saved workflow IDs
    loadWorkflowIds();
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                fetchAndUpdateChart();
            }
        });
        // Save workflow IDs when they change
        input.addEventListener('change', saveWorkflowIds);
        input.addEventListener('blur', saveWorkflowIds);
    }
    // Handle auto-refresh checkbox - enabled by default
    if (autoRefreshCheckbox) {
        autoRefreshCheckbox.checked = true;
        autoRefreshCheckbox.addEventListener('change', (e) => {
            const target = e.target;
            toggleAutoRefresh(target.checked);
        });
        toggleAutoRefresh(true);
    }
    // Handle new workflow form submission
    const newWorkflowForm = document.getElementById('newWorkflowForm');
    if (newWorkflowForm) {
        newWorkflowForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const url = formData.get('url');
            const id = hashUrl(url);
            const sleepInterval = parseInt(formData.get('sleepInterval'));
            try {
                clearWorkflowError('_newWorkflow');
                const result = await startNewWorkflow(id, url, sleepInterval);
                // Close modal
                closeNewWorkflowModal();
                // Show success message
                alert(`Workflow "${result.workflowId}" started successfully!`);
                // Add the new workflow ID to the input field and refresh
                const workflowIdsInput = document.getElementById('workflowIds');
                if (workflowIdsInput) {
                    const currentIds = workflowIdsInput.value
                        .split(',')
                        .map(id => id.trim())
                        .filter(id => id.length > 0);
                    if (!currentIds.includes(result.workflowId)) {
                        currentIds.push(result.workflowId);
                        workflowIdsInput.value = currentIds.join(', ');
                        saveWorkflowIds();
                    }
                }
                // Refresh the chart
                fetchAndUpdateChart();
            }
            catch (error) {
                setWorkflowError('_newWorkflow', `Failed to start workflow: ${error.message}`);
            }
        });
    }
    // Close modal when clicking outside of it
    const modal = document.getElementById('newWorkflowModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeNewWorkflowModal();
            }
        });
    }
});
