// Global variables
let currentPage = 1;
const limit = 10;
let totalPages = 1;
let totalTransactions = 0;
let categoryChart = null;
let trendChart = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Set current date
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    
    // Set default date range for reports (current month)
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    document.getElementById('startDate').valueAsDate = firstDay;
    document.getElementById('endDate').valueAsDate = lastDay;
    
    // Initialize event listeners
    initEventListeners();
    
    // Load initial data
    loadTransactions();
    loadCategories();
    loadCharts();
});

// Initialize event listeners
function initEventListeners() {
    // File upload handling
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileUpload');

    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#4e73df';
        dropZone.style.backgroundColor = 'rgba(78, 115, 223, 0.1)';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '#d1d3e2';
        dropZone.style.backgroundColor = 'rgba(78, 115, 223, 0.05)';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#d1d3e2';
        dropZone.style.backgroundColor = 'rgba(78, 115, 223, 0.05)';
        
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
            handleFileUpload(fileInput.files[0]);
        }
    });

    // Category filter
    document.getElementById('categoryFilter').addEventListener('change', () => {
        currentPage = 1;
        loadTransactions();
    });

    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
        loadTransactions();
        loadCategories();
        loadCharts();
    });

    // Generate report button
    document.getElementById('generateReportBtn').addEventListener('click', generateReport);

    // Save category button
    document.getElementById('saveCategoryBtn').addEventListener('click', saveCategory);
}

// Handle file upload
async function handleFileUpload(file) {
    const dropZone = document.getElementById('dropZone');
    const originalContent = dropZone.innerHTML;
    
    // Show loading state
    dropZone.innerHTML = '<div class="spinner-border text-primary mb-3" role="status"></div><h5>Processing M-Pesa Statement...</h5>';
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch('/api/transactions/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            dropZone.innerHTML = '<i class="fas fa-check-circle fa-3x text-success mb-3"></i><h5>Analysis Complete!</h5><p class="text-muted">' + result.count + ' transactions processed</p>';
            
            // Reload all data
            loadTransactions();
            loadCategories();
            loadCharts();
            
            // Show success message
            alert('M-Pesa statement processed successfully! ' + result.count + ' transactions imported and categorized.');
        } else {
            throw new Error(result.error || 'Upload failed');
        }
    } catch (error) {
        dropZone.innerHTML = originalContent;
        alert('Error: ' + error.message);
        console.error('Upload error:', error);
    }
}

// Load transactions with pagination
async function loadTransactions() {
    try {
        const categoryFilter = document.getElementById('categoryFilter').value;
        let url = `/api/transactions?page=${currentPage}&limit=${limit}`;
        
        if (categoryFilter !== 'all') {
            url += `&category=${encodeURIComponent(categoryFilter)}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (response.ok) {
            displayTransactions(data.transactions);
            updatePagination(data);
            updateStats(data);
        } else {
            throw new Error(data.error || 'Failed to load transactions');
        }
    } catch (error) {
        console.error('Error loading transactions:', error);
        alert('Error loading transactions: ' + error.message);
    }
}

// Display transactions in the table
function displayTransactions(transactions) {
    const tbody = document.getElementById('transactions-body');
    tbody.innerHTML = '';
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No transactions found</td></tr>';
        return;
    }
    
    transactions.forEach(transaction => {
        const row = document.createElement('tr');
        
        const date = new Date(transaction.transactionDate).toLocaleDateString();
        const amountClass = transaction.transactionType === 'debit' ? 'text-danger' : 'text-success';
        const amountSign = transaction.transactionType === 'debit' ? '-' : '+';
        
        row.innerHTML = `
            <td>${date}</td>
            <td>${transaction.description}</td>
            <td class="${amountClass}">${amountSign}Ksh ${transaction.amount.toLocaleString()}</td>
            <td><span class="category-badge category-${transaction.category.toLowerCase().replace(' ', '-')}">${transaction.category}</span></td>
            <td>
                <button class="btn btn-sm btn-outline-primary edit-btn" data-id="${transaction._id}" data-description="${transaction.description}" data-amount="${transaction.amount}" data-category="${transaction.category}">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Add event listeners to edit buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const description = e.currentTarget.getAttribute('data-description');
            const amount = e.currentTarget.getAttribute('data-amount');
            const category = e.currentTarget.getAttribute('data-category');
            
            openEditModal(id, description, amount, category);
        });
    });
}

// Open edit category modal
function openEditModal(id, description, amount, category) {
    document.getElementById('editTransactionId').value = id;
    document.getElementById('editDescription').value = description;
    document.getElementById('editAmount').value = 'Ksh ' + parseFloat(amount).toLocaleString();
    document.getElementById('editCategory').value = category;
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('editCategoryModal'));
    modal.show();
}

// Save category changes
async function saveCategory() {
    const id = document.getElementById('editTransactionId').value;
    const category = document.getElementById('editCategory').value;
    
    try {
        const response = await fetch(`/api/transactions/${id}/category`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ category })
        });
        
        if (response.ok) {
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('editCategoryModal'));
            modal.hide();
            
            // Reload transactions and charts
            loadTransactions();
            loadCharts();
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update category');
        }
    } catch (error) {
        alert('Error updating category: ' + error.message);
        console.error('Update error:', error);
    }
}

// Update pagination controls
function updatePagination(data) {
    totalPages = data.totalPages;
    totalTransactions = data.total;
    
    const paginationInfo = document.getElementById('pagination-info');
    paginationInfo.textContent = `Showing ${data.transactions.length} of ${data.total} transactions`;
    
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';
    
    // Previous button
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `<a class="page-link" href="#" data-page="${currentPage - 1}">Previous</a>`;
    pagination.appendChild(prevLi);
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        const pageLi = document.createElement('li');
        pageLi.className = `page-item ${i === currentPage ? 'active' : ''}`;
        pageLi.innerHTML = `<a class="page-link" href="#" data-page="${i}">${i}</a>`;
        pagination.appendChild(pageLi);
    }
    
    // Next button
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `<a class="page-link" href="#" data-page="${currentPage + 1}">Next</a>`;
    pagination.appendChild(nextLi);
    
    // Add event listeners to pagination links
    pagination.querySelectorAll('.page-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = parseInt(e.target.getAttribute('data-page'));
            if (!isNaN(page)) {
                currentPage = page;
                loadTransactions();
            }
        });
    });
}

// Update stats cards
function updateStats(data) {
    // This would be enhanced with actual stats from the backend
    document.getElementById('total-transactions').textContent = data.total || 0;
}

// Load categories for filter dropdown
async function loadCategories() {
    try {
        const response = await fetch('/api/transactions/categories');
        const categories = await response.json();
        
        if (response.ok) {
            const categoryFilter = document.getElementById('categoryFilter');
            // Clear existing options except "All Categories"
            while (categoryFilter.options.length > 1) {
                categoryFilter.remove(1);
            }
            
            // Add categories from API
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category._id;
                option.textContent = `${category._id} (${category.count})`;
                categoryFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Load charts
async function loadCharts() {
    try {
        // Load category data
        const categoryResponse = await fetch('/api/transactions/categories');
        const categories = await categoryResponse.json();
        
        // Load monthly data
        const monthlyResponse = await fetch('/api/transactions/monthly');
        const monthlyData = await monthlyResponse.ok ? monthlyResponse.json() : [];
        
        // Update charts
        updateCategoryChart(categories);
        updateTrendChart(monthlyData);
        
        // Update stats based on category data
        updateStatsFromCategories(categories);
    } catch (error) {
        console.error('Error loading charts:', error);
    }
}

// Update category chart
function updateCategoryChart(categories) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (categoryChart) {
        categoryChart.destroy();
    }
    
    const labels = categories.map(c => c._id);
    const data = categories.map(c => c.total);
    
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b',
                    '#6f42c1', '#fd7e14', '#20c997', '#6610f2', '#6c757d'
                ],
                hoverOffset: 4
            }]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12
                    }
                }
            }
        }
    });
}

// Update trend chart
function updateTrendChart(monthlyData) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (trendChart) {
        trendChart.destroy();
    }
    
    // Format monthly data
    const labels = monthlyData.map(item => {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${monthNames[item._id.month - 1]} ${item._id.year}`;
    });
    
    const data = monthlyData.map(item => item.total);
    
    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Monthly Spending',
                data: data,
                fill: false,
                borderColor: '#4e73df',
                tension: 0.1,
                pointBackgroundColor: '#4e73df',
                pointRadius: 4
            }]
        },
        options: {
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        drawBorder: false
                    },
                    ticks: {
                        callback: function(value) {
                            return 'Ksh ' + value.toLocaleString();
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Update stats from categories
function updateStatsFromCategories(categories) {
    if (categories.length > 0) {
        // Calculate total monthly spending
        const monthlyTotal = categories.reduce((sum, category) => sum + category.total, 0);
        document.getElementById('monthly-spending').textContent = 'Ksh ' + monthlyTotal.toLocaleString();
        
        // Find top category
        const topCategory = categories.reduce((max, category) => 
            category.total > max.total ? category : max, categories[0]);
        document.getElementById('top-category').textContent = topCategory._id;
        
        // Calculate savings potential (20% of total spending)
        const savingsPotential = monthlyTotal * 0.2;
        document.getElementById('savings-potential').textContent = 'Ksh ' + Math.round(savingsPotential).toLocaleString();
    }
}

// Generate report
async function generateReport() {
    const reportType = document.getElementById('reportType').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    try {
        // In a real application, this would generate and download a PDF/Excel report
        // For this demo, we'll just show an alert
        
        alert(`Report generation started for:\nType: ${reportType}\nDate Range: ${startDate} to ${endDate}\n\nThis would generate a downloadable report in a real application.`);
        
    } catch (error) {
        console.error('Error generating report:', error);
        alert('Error generating report: ' + error.message);
    }
}