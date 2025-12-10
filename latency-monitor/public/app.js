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
function displayWorkflowInfo(workflowsData) {
    const listDiv = document.getElementById('workflowList');
    if (!listDiv)
        return;
    if (workflowsData.length === 0) {
        listDiv.style.display = 'none';
        return;
    }
    let html = '<h2 style="margin-bottom: 15px;">Workflow Information</h2>';
    workflowsData.forEach(({ workflowId, data }) => {
        const lastSet = data.lastSets[data.lastSets.length - 1];
        const latestAvg = lastSet ? lastSet.avgMs.toFixed(2) : 'N/A';
        const startedAt = lastSet ? new Date(lastSet.startedAt).toLocaleString() : 'N/A';
        const endedAt = lastSet ? new Date(lastSet.endedAt).toLocaleString() : 'N/A';
        html += `
      <div class="workflow-item">
        <h3>${workflowId}</h3>
        <p><strong>URL:</strong> ${data.url}</p>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Latest Avg</div>
            <div class="stat-value">${latestAvg} ms</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Overall Min</div>
            <div class="stat-value">${data.overallMinMs !== null ? data.overallMinMs.toFixed(2) : 'N/A'} ms</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Overall Max</div>
            <div class="stat-value">${data.overallMaxMs !== null ? data.overallMaxMs.toFixed(2) : 'N/A'} ms</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Data Points</div>
            <div class="stat-value">${data.lastSets.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Latest Started At</div>
            <div class="stat-value" style="font-size: 14px;">${startedAt}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Latest Ended At</div>
            <div class="stat-value" style="font-size: 14px;">${endedAt}</div>
          </div>
        </div>
      </div>
    `;
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
        // Line dataset for averages
        const avgDataset = {
            label: `${workflowId} - Average`,
            data: data.lastSets.map(set => ({
                x: new Date(set.startedAt).getTime(),
                y: set.avgMs
            })),
            borderColor: color,
            backgroundColor: color + '20',
            borderWidth: 2,
            fill: false,
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6
        };
        datasets.push(avgDataset);
        // Min and max lines hidden
        // if (data.overallMinMs !== null && data.lastSets.length > 0) {
        //   const minLine = {
        //     label: `${workflowId} - Overall Min`,
        //     data: [
        //       { x: new Date(data.lastSets[0].startedAt).getTime(), y: data.overallMinMs },
        //       { x: new Date(data.lastSets[data.lastSets.length - 1].startedAt).getTime(), y: data.overallMinMs }
        //     ],
        //     borderColor: color,
        //     backgroundColor: color,
        //     borderWidth: 2,
        //     borderDash: [5, 5],
        //     fill: false,
        //     pointRadius: 0
        //   };
        //   datasets.push(minLine);
        // }
        // if (data.overallMaxMs !== null && data.lastSets.length > 0) {
        //   const maxLine = {
        //     label: `${workflowId} - Overall Max`,
        //     data: [
        //       { x: new Date(data.lastSets[0].startedAt).getTime(), y: data.overallMaxMs },
        //       { x: new Date(data.lastSets[data.lastSets.length - 1].startedAt).getTime(), y: data.overallMaxMs }
        //     ],
        //     borderColor: color,
        //     backgroundColor: color,
        //     borderWidth: 2,
        //     borderDash: [10, 5],
        //     fill: false,
        //     pointRadius: 0
        //   };
        //   datasets.push(maxLine);
        // }
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
                    text: 'Latency Monitor - Average Latency',
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
                        unit: 'minute',
                        displayFormats: {
                            minute: 'HH:mm',
                            hour: 'HH:mm'
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
