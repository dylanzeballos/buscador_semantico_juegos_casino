/**
 * Detail Page JavaScript
 * Handles detailed view functionality for search results
 */

let currentResult = null;
let currentDetailData = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('Detail Page Initialized');
    initializeDetailPage();
});

/**
 * Initialize detail page functionality
 */
function initializeDetailPage() {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const type = urlParams.get('type');
    const uri = urlParams.get('uri');

    if (id && type && uri) {
        loadDetailContent(id, type, uri);
    } else {
        showDetailError('Parámetros de URL faltantes');
    }

    // Initialize event listeners
    initializeDetailEventListeners();
}

/**
 * Initialize event listeners for detail page
 */
function initializeDetailEventListeners() {
    // Copy to clipboard
    window.copyToClipboard = function() {
        const currentUrl = window.location.href;
        navigator.clipboard.writeText(currentUrl).then(() => {
            showDetailNotification('Enlace copiado al portapapeles', 'success');
        }).catch(() => {
            showDetailNotification('Error al copiar enlace', 'error');
        });
    };

    // Export functionality
    window.exportResult = function() {
        const modal = new bootstrap.Modal(document.getElementById('exportModal'));
        modal.show();
    };

    // Share functionality
    window.shareResult = function() {
        const modal = new bootstrap.Modal(document.getElementById('shareModal'));
        const shareUrl = document.getElementById('shareUrl');
        if (shareUrl) {
            shareUrl.value = window.location.href;
        }
        modal.show();
    };

    // Properties view toggle
    window.togglePropertiesView = function() {
        const propertiesContent = document.getElementById('propertiesContent');
        const currentView = propertiesContent.getAttribute('data-view') || 'list';

        if (currentView === 'list') {
            renderPropertiesTable();
            propertiesContent.setAttribute('data-view', 'table');
        } else {
            renderPropertiesList();
            propertiesContent.setAttribute('data-view', 'list');
        }
    };

    // Navigation functions
    window.searchSimilar = function() {
        if (currentResult && currentResult.name) {
            const searchUrl = `/?search=${encodeURIComponent(currentResult.name)}`;
            window.location.href = searchUrl;
        }
    };

    window.exploreCategory = function() {
        if (currentResult && currentResult.category) {
            const searchUrl = `/?search=${encodeURIComponent(currentResult.category)}`;
            window.location.href = searchUrl;
        }
    };

    window.viewInOntology = function() {
        if (currentResult && currentResult.uri) {
            window.open(currentResult.uri, '_blank');
        }
    };

    // Export and share functions
    window.performExport = performExport;
    window.copyShareUrl = copyShareUrl;
    window.shareOnTwitter = shareOnTwitter;
    window.shareOnFacebook = shareOnFacebook;
    window.shareOnWhatsApp = shareOnWhatsApp;
    window.retryLoad = retryLoad;
}

/**
 * Load detailed content
 */
async function loadDetailContent(id, type, uri) {
    try {
        showDetailLoading();

        const response = await fetch(`/api/unified/detail?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}&uri=${encodeURIComponent(uri)}`);
        const data = await response.json();

        if (data.success) {
            currentDetailData = data.detail;
            currentResult = {
                id: id,
                type: type,
                uri: uri,
                name: data.detail.name || 'Resultado',
                category: data.detail.category || '',
                ...data.detail
            };

            renderDetailContent();
            hideDetailLoading();
        } else {
            throw new Error(data.error || 'Error loading details');
        }
    } catch (error) {
        console.error('Error loading detail content:', error);
        showDetailError(error.message);
    }
}

/**
 * Render detail content
 */
function renderDetailContent() {
    if (!currentDetailData || !currentResult) return;

    // Update header
    updateDetailHeader();

    // Update main content sections
    updateMainDescription();
    updatePropertiesSection();
    updateRelatedSection();
    updateExternalLinksSection();

    // Update sidebar
    updateQuickInfo();
    updateStatsInfo();
}

/**
 * Update detail header
 */
function updateDetailHeader() {
    const resultTitle = document.getElementById('resultTitle');
    const sourceBadge = document.getElementById('sourceBadge');
    const uriInfo = document.getElementById('uriInfo');
    const resultIcon = document.getElementById('resultIcon');

    if (resultTitle) {
        resultTitle.textContent = currentResult.name || 'Resultado detallado';
    }

    if (sourceBadge) {
        const sourceText = getSourceDisplayName(currentResult.type);
        const sourceIcon = getSourceIcon(currentResult.type);
        sourceBadge.innerHTML = `<i class="fas fa-${sourceIcon} me-1"></i>${sourceText}`;
    }

    if (uriInfo && currentResult.uri) {
        const shortUri = shortenUri(currentResult.uri);
        uriInfo.innerHTML = `<i class="fas fa-link me-1"></i>${shortUri}`;
    }

    if (resultIcon) {
        const iconClass = getResultIcon(currentResult.type);
        resultIcon.className = `fas fa-${iconClass} fa-2x text-primary`;
    }
}

/**
 * Update main description
 */
function updateMainDescription() {
    const mainDescription = document.getElementById('mainDescription');
    if (!mainDescription) return;

    const description = currentDetailData.fullDescription ||
                       currentResult.description ||
                       currentResult.abstract ||
                       'Sin descripción disponible';

    mainDescription.innerHTML = `
        <div class="description-text">
            ${formatDescription(description)}
        </div>
    `;
}

/**
 * Update properties section
 */
function updatePropertiesSection() {
    const propertiesContent = document.getElementById('propertiesContent');
    if (!propertiesContent) return;

    const properties = currentDetailData.properties || {};

    if (Object.keys(properties).length === 0) {
        propertiesContent.innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-info-circle fa-2x text-muted mb-3"></i>
                <p class="text-muted">No hay propiedades adicionales disponibles</p>
            </div>
        `;
        return;
    }

    renderPropertiesList();
}

/**
 * Render properties as list
 */
function renderPropertiesList() {
    const propertiesContent = document.getElementById('propertiesContent');
    if (!propertiesContent) return;

    const properties = currentDetailData.properties || {};
    let html = '<div class="properties-list row g-3">';

    Object.entries(properties).forEach(([key, value]) => {
        if (key === 'type' || !value) return;

        const formattedKey = formatPropertyName(key);
        const formattedValue = Array.isArray(value) ? value.join(', ') : String(value);

        html += `
            <div class="col-md-6">
                <div class="property-item p-3 bg-dark rounded border">
                    <h6 class="property-label text-primary mb-2">
                        <i class="fas fa-tag me-2"></i>
                        ${escapeHtml(formattedKey)}
                    </h6>
                    <p class="property-value mb-0">
                        ${escapeHtml(formattedValue)}
                    </p>
                </div>
            </div>
        `;
    });

    html += '</div>';
    propertiesContent.innerHTML = html;
    propertiesContent.setAttribute('data-view', 'list');
}

/**
 * Render properties as table
 */
function renderPropertiesTable() {
    const propertiesContent = document.getElementById('propertiesContent');
    if (!propertiesContent) return;

    const properties = currentDetailData.properties || {};
    let html = `
        <div class="table-responsive">
            <table class="table table-striped table-hover">
                <thead>
                    <tr>
                        <th style="width: 30%">
                            <i class="fas fa-tag me-2"></i>Propiedad
                        </th>
                        <th>
                            <i class="fas fa-align-left me-2"></i>Valor
                        </th>
                    </tr>
                </thead>
                <tbody>
    `;

    Object.entries(properties).forEach(([key, value]) => {
        if (key === 'type' || !value) return;

        const formattedKey = formatPropertyName(key);
        const formattedValue = Array.isArray(value) ? value.join(', ') : String(value);

        html += `
            <tr>
                <td><strong>${escapeHtml(formattedKey)}</strong></td>
                <td>${escapeHtml(formattedValue)}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    propertiesContent.innerHTML = html;
    propertiesContent.setAttribute('data-view', 'table');
}

/**
 * Update related section
 */
function updateRelatedSection() {
    const relatedContent = document.getElementById('relatedContent');
    const relatedSection = document.getElementById('relatedSection');

    if (!relatedContent) return;

    const relatedConcepts = currentDetailData.relatedConcepts || [];

    if (relatedConcepts.length === 0) {
        relatedSection.style.display = 'none';
        return;
    }

    relatedSection.style.display = 'block';
    let html = '<div class="related-concepts row g-3">';

    relatedConcepts.forEach(concept => {
        html += `
            <div class="col-md-6 col-lg-4">
                <div class="related-item p-3 bg-dark rounded border h-100">
                    <h6 class="mb-2">
                        <i class="fas fa-link me-2 text-primary"></i>
                        ${escapeHtml(concept.name)}
                    </h6>
                    <div class="related-actions">
                        <button class="btn btn-sm btn-outline-primary"
                                onclick="searchRelated('${escapeHtml(concept.name)}')">
                            <i class="fas fa-search me-1"></i>
                            Buscar
                        </button>
                        ${concept.uri ? `
                        <button class="btn btn-sm btn-outline-secondary ms-2"
                                onclick="viewRelated('${escapeHtml(concept.uri)}')">
                            <i class="fas fa-external-link-alt me-1"></i>
                            Ver
                        </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    relatedContent.innerHTML = html;
}

/**
 * Update external links section
 */
function updateExternalLinksSection() {
    const externalLinksContent = document.getElementById('externalLinksContent');
    const externalLinksSection = document.getElementById('externalLinksSection');

    if (!externalLinksContent) return;

    const externalLinks = currentDetailData.externalLinks || [];

    if (externalLinks.length === 0) {
        externalLinksSection.style.display = 'none';
        return;
    }

    externalLinksSection.style.display = 'block';
    externalLinksSection.classList.remove('d-none');

    let html = '<div class="external-links d-flex flex-wrap gap-2">';

    externalLinks.forEach(link => {
        const iconClass = getExternalLinkIcon(link.type);
        html += `
            <a href="${escapeHtml(link.url)}" target="_blank"
               class="btn btn-outline-primary btn-sm">
                <i class="fas fa-${iconClass} me-1"></i>
                ${escapeHtml(link.title)}
            </a>
        `;
    });

    html += '</div>';
    externalLinksContent.innerHTML = html;
}

/**
 * Update quick info sidebar
 */
function updateQuickInfo() {
    const quickInfoContent = document.getElementById('quickInfoContent');
    if (!quickInfoContent) return;

    const quickInfo = extractQuickInfo();
    let html = '<div class="quick-info-list">';

    quickInfo.forEach(info => {
        html += `
            <div class="info-item mb-3">
                <div class="info-label text-muted small">${info.label}</div>
                <div class="info-value">${info.value}</div>
            </div>
        `;
    });

    html += '</div>';
    quickInfoContent.innerHTML = html;
}

/**
 * Update stats info sidebar
 */
function updateStatsInfo() {
    const statsContent = document.getElementById('statsContent');
    if (!statsContent) return;

    const stats = calculateDetailStats();
    let html = '<div class="stats-list">';

    stats.forEach(stat => {
        html += `
            <div class="stat-item mb-3">
                <div class="d-flex justify-content-between align-items-center">
                    <span class="stat-label">${stat.label}</span>
                    <span class="stat-value badge bg-primary">${stat.value}</span>
                </div>
            </div>
        `;
    });

    html += '</div>';
    statsContent.innerHTML = html;
}

/**
 * Extract quick info from current data
 */
function extractQuickInfo() {
    const quickInfo = [];
    const properties = currentDetailData.properties || {};

    // Basic info
    if (currentResult.type) {
        quickInfo.push({
            label: 'Tipo',
            value: getSourceDisplayName(currentResult.type)
        });
    }

    if (currentResult.category) {
        quickInfo.push({
            label: 'Categoría',
            value: currentResult.category
        });
    }

    // Extract relevant properties
    const relevantProps = ['origen', 'origin', 'jugadores', 'players', 'duracion', 'duration'];
    relevantProps.forEach(prop => {
        if (properties[prop]) {
            quickInfo.push({
                label: formatPropertyName(prop),
                value: String(properties[prop])
            });
        }
    });

    return quickInfo;
}

/**
 * Calculate stats for current detail
 */
function calculateDetailStats() {
    const stats = [];
    const properties = currentDetailData.properties || {};

    stats.push({
        label: 'Propiedades',
        value: Object.keys(properties).length
    });

    stats.push({
        label: 'Conceptos relacionados',
        value: (currentDetailData.relatedConcepts || []).length
    });

    stats.push({
        label: 'Enlaces externos',
        value: (currentDetailData.externalLinks || []).length
    });

    return stats;
}

/**
 * Show detail loading state
 */
function showDetailLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('d-none');
    }
}

/**
 * Hide detail loading state
 */
function hideDetailLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('d-none');
    }
}

/**
 * Show detail error
 */
function showDetailError(message) {
    hideDetailLoading();

    const errorModal = new bootstrap.Modal(document.getElementById('errorModal'));
    const errorMessage = document.getElementById('errorMessage');

    if (errorMessage) {
        errorMessage.innerHTML = `<p>${escapeHtml(message)}</p>`;
    }

    errorModal.show();
}

/**
 * Retry loading
 */
function retryLoad() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const type = urlParams.get('type');
    const uri = urlParams.get('uri');

    if (id && type && uri) {
        loadDetailContent(id, type, uri);
    }
}

/**
 * Search for related concept
 */
function searchRelated(conceptName) {
    const searchUrl = `/?search=${encodeURIComponent(conceptName)}`;
    window.location.href = searchUrl;
}

/**
 * View related concept
 */
function viewRelated(uri) {
    window.open(uri, '_blank');
}

/**
 * Export functionality
 */
async function performExport() {
    try {
        const format = document.getElementById('exportFormat').value;
        const includeRelated = document.getElementById('includeRelated').checked;
        const includeProperties = document.getElementById('includeProperties').checked;

        const exportData = {
            result: currentResult,
            detail: currentDetailData,
            includeRelated,
            includeProperties,
            exportDate: new Date().toISOString()
        };

        let content, filename, mimeType;

        switch (format) {
            case 'json':
                content = JSON.stringify(exportData, null, 2);
                filename = `${currentResult.name || 'result'}.json`;
                mimeType = 'application/json';
                break;
            case 'xml':
                content = generateXML(exportData);
                filename = `${currentResult.name || 'result'}.xml`;
                mimeType = 'application/xml';
                break;
            case 'txt':
                content = generateTextReport(exportData);
                filename = `${currentResult.name || 'result'}.txt`;
                mimeType = 'text/plain';
                break;
            case 'pdf':
                showDetailNotification('Exportación a PDF próximamente', 'info');
                return;
            default:
                throw new Error('Formato no soportado');
        }

        downloadFile(content, filename, mimeType);
        showDetailNotification('Exportación completada', 'success');

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('exportModal'));
        modal.hide();

    } catch (error) {
        console.error('Export error:', error);
        showDetailNotification('Error en la exportación', 'error');
    }
}

/**
 * Generate XML content
 */
function generateXML(data) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<result>\n';
    xml += `  <name>${escapeXml(data.result.name || '')}</name>\n`;
    xml += `  <type>${escapeXml(data.result.type || '')}</type>\n`;
    xml += `  <uri>${escapeXml(data.result.uri || '')}</uri>\n`;

    if (data.includeProperties && data.detail.properties) {
        xml += '  <properties>\n';
        Object.entries(data.detail.properties).forEach(([key, value]) => {
            xml += `    <property name="${escapeXml(key)}">${escapeXml(String(value))}</property>\n`;
        });
        xml += '  </properties>\n';
    }

    xml += '</result>';
    return xml;
}

/**
 * Generate text report
 */
function generateTextReport(data) {
    let text = `REPORTE DE RESULTADO\n`;
    text += `===================\n\n`;
    text += `Nombre: ${data.result.name || 'N/A'}\n`;
    text += `Tipo: ${data.result.type || 'N/A'}\n`;
    text += `URI: ${data.result.uri || 'N/A'}\n`;
    text += `Fecha de exportación: ${new Date().toLocaleString()}\n\n`;

    if (data.detail.fullDescription) {
        text += `DESCRIPCIÓN\n`;
        text += `-----------\n`;
        text += `${data.detail.fullDescription}\n\n`;
    }

    if (data.includeProperties && data.detail.properties) {
        text += `PROPIEDADES\n`;
        text += `-----------\n`;
        Object.entries(data.detail.properties).forEach(([key, value]) => {
            text += `${formatPropertyName(key)}: ${value}\n`;
        });
        text += '\n';
    }

    return text;
}

/**
 * Share functionality
 */
function copyShareUrl() {
    const shareUrl = document.getElementById('shareUrl');
    if (shareUrl) {
        shareUrl.select();
        document.execCommand('copy');
        showDetailNotification('URL copiada al portapapeles', 'success');
    }
}

function shareOnTwitter() {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`Revisa este resultado: ${currentResult.name || 'Resultado'}`);
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank');
}

function shareOnFacebook() {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
}

function shareOnWhatsApp() {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`Revisa este resultado: ${currentResult.name || 'Resultado'} - ${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
}

/**
 * Utility functions
 */

function getSourceDisplayName(type) {
    const names = {
        'local': 'Ontología Local',
        'dbpedia': 'DBpedia',
        'Local Ontology': 'Ontología Local',
        'DBpedia': 'DBpedia'
    };
    return names[type] || type || 'Desconocido';
}

function getSourceIcon(type) {
    const icons = {
        'local': 'home',
        'dbpedia': 'globe',
        'Local Ontology': 'home',
        'DBpedia': 'globe'
    };
    return icons[type] || 'database';
}

function getResultIcon(type) {
    const icons = {
        'local': 'cube',
        'dbpedia': 'globe',
        'Local Ontology': 'cube',
        'DBpedia': 'globe'
    };
    return icons[type] || 'info-circle';
}

function getExternalLinkIcon(type) {
    const icons = {
        'dbpedia': 'globe',
        'wikipedia': 'wikipedia-w'
    };
    return icons[type] || 'external-link-alt';
}

function shortenUri(uri) {
    if (!uri) return '';
    if (uri.length <= 50) return uri;
    return uri.substring(0, 47) + '...';
}

function formatPropertyName(propName) {
    const translations = {
        'descripcion': 'Descripción',
        'tipo': 'Tipo',
        'categoria': 'Categoría',
        'jugadores': 'Jugadores',
        'players': 'Jugadores',
        'duracion': 'Duración',
        'duration': 'Duración',
        'reglas': 'Reglas',
        'rules': 'Reglas',
        'objetivo': 'Objetivo',
        'objective': 'Objetivo',
        'dificultad': 'Dificultad',
        'difficulty': 'Dificultad',
        'origen': 'Origen',
        'origin': 'Origen'
    };

    return translations[propName.toLowerCase()] ||
           propName.charAt(0).toUpperCase() + propName.slice(1).replace(/([A-Z])/g, ' $1');
}

function formatDescription(text) {
    if (!text) return 'Sin descripción disponible';

    return text.split('\n\n')
        .map(paragraph => `<p>${escapeHtml(paragraph.trim())}</p>`)
        .join('');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeXml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&#39;');
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function showDetailNotification(message, type = 'info') {
    const toastElement = document.getElementById('detailToast');
    const toastMessage = document.getElementById('toastMessage');

    if (!toastElement || !toastMessage) return;

    toastMessage.textContent = message;

    // Remove previous classes
    toastElement.classList.remove('bg-primary', 'bg-success', 'bg-warning', 'bg-danger');

    // Add appropriate class
    switch (type) {
        case 'success':
            toastElement.classList.add('bg-success');
            break;
        case 'warning':
            toastElement.classList.add('bg-warning');
            break;
        case 'error':
            toastElement.classList.add('bg-danger');
            break;
        default:
            toastElement.classList.add('bg-primary');
    }

    const toast = new bootstrap.Toast(toastElement);
    toast.show();
}
