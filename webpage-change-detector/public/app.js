"use strict";
let chart = null;
let autoRefreshInterval = null;
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
function displayWorkflowInfo(workflowsData) {
    const listDiv = document.getElementById('workflowList');
    if (!listDiv)
        return;
    if (workflowsData.length === 0) {
        listDiv.style.display = 'none';
        return;
    }
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
        html += `
      <div class="workflow-item">
        <h3>${workflowId}</h3>
        <p><strong>URL:</strong> ${data.url}</p>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Last Changed</div>
            <div class="stat-value" style="font-size: 14px;">${lastChanged}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Time Since Change</div>
            <div class="stat-value" style="font-size: 16px;">${timeSinceChange}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Last Checked</div>
            <div class="stat-value" style="font-size: 14px;">${lastChecked}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Time Last Checked</div>
            <div class="stat-value" style="font-size: 16px;">${timeSinceCheck}</div>
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
            const latencyDataset = {
                label: `${workflowId} - Check Latency`,
                data: data.latencies.map((entry) => ({
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
});
