"use strict";
let chart = null;
let autoRefreshInterval = null;
let timeUpdateInterval = null;
let currentWorkflowsData = [];
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
function showError(message) {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}
function hideError() {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}
function showLoading() {
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) {
        loadingDiv.style.display = 'block';
    }
}
function hideLoading() {
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
    const diffSecs = Math.floor(diffMs / 1000);
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
        return `${diffSecs} second${diffSecs !== 1 ? 's' : ''} ago`; //'Just now';
    }
}
// Determine the color class based on time elapsed
function getTimeColorClass(timestamp) {
    if (!timestamp)
        return '';
    const changeTime = new Date(timestamp).getTime();
    const now = Date.now();
    const diffMs = now - changeTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    // Less than 1 minute: bright green
    if (diffMins < 1) {
        return 'time-highlight-recent';
    }
    // Less than 1 hour: green
    else if (diffHours < 1) {
        return 'time-highlight-hour';
    }
    // Less than 24 hours: darker green
    else if (diffHours < 24) {
        return 'time-highlight-day';
    }
    // 24 hours or more: very dark green
    else {
        return 'time-highlight-old';
    }
}
// Update the time-since displays every second
function updateTimeDisplays() {
    // Update all "Time Since Change" displays
    const timeSinceChangeElements = document.querySelectorAll('.time-since-change');
    timeSinceChangeElements.forEach((element) => {
        const timestamp = element.getAttribute('data-timestamp');
        if (timestamp) {
            element.textContent = timeSince(timestamp);
            // Update the color class on the parent stat-card
            const parentCard = element.closest('.time-card-since-change');
            if (parentCard) {
                // Remove all existing time highlight classes
                parentCard.classList.remove('time-highlight-recent', 'time-highlight-hour', 'time-highlight-day', 'time-highlight-old');
                // Add the new color class
                const colorClass = getTimeColorClass(timestamp);
                if (colorClass) {
                    parentCard.classList.add(colorClass);
                }
            }
        }
    });
    // Update all "Last Changed" displays
    const lastChangedElements = document.querySelectorAll('.last-changed-value');
    lastChangedElements.forEach((element) => {
        const timestamp = element.getAttribute('data-timestamp');
        if (timestamp) {
            // No need to update text content for this one - it shows the date/time
            // Just update the color class on the parent stat-card
            const parentCard = element.closest('.time-card-last-changed');
            if (parentCard) {
                // Remove all existing time highlight classes
                parentCard.classList.remove('time-highlight-recent', 'time-highlight-hour', 'time-highlight-day', 'time-highlight-old');
                // Add the new color class
                const colorClass = getTimeColorClass(timestamp);
                if (colorClass) {
                    parentCard.classList.add(colorClass);
                }
            }
        }
    });
    // Update all "Time Since Check" displays (text only, no color)
    const timeSinceCheckElements = document.querySelectorAll('.time-since-check');
    timeSinceCheckElements.forEach((element) => {
        const timestamp = element.getAttribute('data-timestamp');
        if (timestamp) {
            element.textContent = timeSince(timestamp);
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
    let html = '<h2 style="margin-bottom: 15px;">Webpage Change Status</h2>';
    workflowsData.forEach(({ workflowId, data }) => {
        const lastChecked = data.contentLastCheckedAt
            ? new Date(data.contentLastCheckedAt).toLocaleString()
            : 'Never';
        const lastChanged = data.contentLastChangedAt
            ? new Date(data.contentLastChangedAt).toLocaleString()
            : 'Never';
        // Calculate time since last change
        let timeSinceChange = 'N/A';
        let timeSinceCheck = 'N/A';
        if (data.contentLastChangedAt) {
            timeSinceChange = timeSince(data.contentLastChangedAt);
        }
        if (data.contentLastCheckedAt) {
            timeSinceCheck = timeSince(data.contentLastCheckedAt);
        }
        const avgLatency = data.latencies.length > 0
            ? (data.latencies.reduce((sum, entry) => sum + entry.latency, 0) / data.latencies.length).toFixed(2)
            : 'N/A';
        // Get color classes for time-based highlighting
        const changeColorClass = data.contentLastChangedAt ? getTimeColorClass(data.contentLastChangedAt) : '';
        html += `
      <div class="workflow-item" data-workflow-id="${workflowId}">
        <h3>${workflowId}</h3>
        <p><strong>URL:</strong> ${data.url}</p>
        <div class="stats-grid">
          <div class="stat-card time-card-last-changed ${changeColorClass}">
            <div class="stat-label">Last Changed</div>
            <div class="stat-value last-changed-value" style="font-size: 14px;" data-timestamp="${data.contentLastChangedAt || ''}">${lastChanged}</div>
          </div>
          <div class="stat-card time-card-since-change ${changeColorClass}">
            <div class="stat-label">Time Since Change</div>
            <div class="stat-value time-since-change" style="font-size: 16px;" data-timestamp="${data.contentLastChangedAt || ''}">${timeSinceChange}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Last Checked</div>
            <div class="stat-value" style="font-size: 14px;">${lastChecked}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Time Last Checked</div>
            <div class="stat-value time-since-check" style="font-size: 16px;" data-timestamp="${data.contentLastCheckedAt || ''}">${timeSinceCheck}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label"># Times Checked</div>
            <div class="stat-value">${data.latencies.length}</div>
          </div>

        </div>
      </div>
    `;
        // <div class="stat-card">
        //         <div class="stat-label">Avg Latency</div>
        //         <div class="stat-value">${avgLatency} ms</div>
        //       </div>
    });
    listDiv.innerHTML = html;
    listDiv.style.display = 'block';
    // Start the live time update if not already running
    startTimeUpdates();
}
function createChart(workflowsData) {
    const canvas = document.getElementById('latencyChart');
    if (!canvas)
        return;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return;
    // Destroy existing chart
    if (chart) {
        chart.destroy();
    }
    // Prepare datasets
    const datasets = [];
    workflowsData.forEach((workflow, index) => {
        const color = colors[index % colors.length];
        const { data, workflowId } = workflow;
        // Create data points for latencies with timestamps
        if (data.latencies.length > 0) {
            // Only show the most recent 20 latencies
            const recentLatencies = data.latencies.slice(-20);
            const latencyDataset = {
                label: `${workflowId} - Check Latency`,
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
            };
            datasets.push(latencyDataset);
        }
    });
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
                    text: 'Webpage Check Latency History',
                    font: {
                        size: 18
                    }
                },
                legend: {
                    display: true,
                    position: 'top'
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
    hideError();
    showLoading();
    const input = document.getElementById('workflowIds');
    if (!input)
        return;
    const workflowIds = input.value
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);
    if (workflowIds.length === 0) {
        hideLoading();
        showError('Please enter at least one workflow ID');
        return;
    }
    // Save workflow IDs to localStorage
    saveWorkflowIds();
    try {
        const workflowsData = [];
        for (const workflowId of workflowIds) {
            try {
                const data = await fetchWorkflowStats(workflowId);
                if (data) {
                    workflowsData.push({ workflowId, data });
                }
            }
            catch (error) {
                showError(`Error loading workflow ${workflowId}: ${error.message}`);
            }
        }
        if (workflowsData.length > 0) {
            displayWorkflowInfo(workflowsData);
            createChart(workflowsData);
            hideError();
        }
        else {
            showError('No workflow data could be loaded');
        }
    }
    catch (error) {
        showError(`Error: ${error.message}`);
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
            }, 10000); // Refresh every 10 seconds
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
    // Handle auto-refresh checkbox
    if (autoRefreshCheckbox) {
        autoRefreshCheckbox.addEventListener('change', (e) => {
            const target = e.target;
            toggleAutoRefresh(target.checked);
        });
    }
    // Handle new workflow form submission
    const newWorkflowForm = document.getElementById('newWorkflowForm');
    if (newWorkflowForm) {
        newWorkflowForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const id = formData.get('id');
            const url = formData.get('url');
            const sleepInterval = parseInt(formData.get('sleepInterval'));
            try {
                hideError();
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
                showError(`Failed to start workflow: ${error.message}`);
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
