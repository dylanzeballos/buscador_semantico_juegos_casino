const API_BASE_URL = '/api/ontology';

let currentClasses = [];
let currentResults = [];

document.addEventListener('DOMContentLoaded', function() {
  console.log('Buscador Semántico Inicializado');
  
  loadClasses();
  
  const resultsContainer = document.getElementById('resultsContainer');
  if (resultsContainer) {
    resultsContainer.innerHTML = `
      <div class="alert alert-info mb-0" role="alert">
        <i class="fas fa-lightbulb me-2"></i>
        Utiliza el buscador o selecciona una clase para ver los resultados
      </div>
    `;
  }
  
  document.getElementById('searchBtn').addEventListener('click', performSearch);
  document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      performSearch();
    }
  });
});

async function loadClasses() {
  try {
    showLoading('classesList');
    
    const response = await fetch(`${API_BASE_URL}/classes`);
    const data = await response.json();
    
    if (data.success) {
      currentClasses = data.data;
      renderClasses(data.data);
    } else {
      showError('classesList', 'Error al cargar las clases');
    }
  } catch (error) {
    console.error('Error:', error);
    showError('classesList', 'Error de conexión');
  }
}

function renderClasses(classes) {
  const container = document.getElementById('classesList');
  
  if (classes.length === 0) {
    container.innerHTML = '<div class="text-center text-muted p-3"><i class="fas fa-exclamation-circle me-2"></i>No hay clases disponibles</div>';
    return;
  }
  
  let html = '';
  classes.forEach(cls => {
    const displayName = cls.label || cls.name;
    html += `
      <a href="#" class="list-group-item list-group-item-action d-flex align-items-center" onclick="loadInstancesOfClass('${cls.name}'); return false;">
        <i class="fas fa-folder me-3 text-info"></i>
        <span class="flex-grow-1">${displayName}</span>
        <i class="fas fa-chevron-right text-muted small"></i>
      </a>
    `;
  });
  
  container.innerHTML = html;
}

async function performSearch() {
  const searchInput = document.getElementById('searchInput');
  const query = searchInput.value.trim();
  
  if (!query) {
    showAlert('Por favor ingresa un término de búsqueda', 'warning');
    return;
  }
  
  try {
    showLoading('resultsContainer');
    
    const response = await fetch(`${API_BASE_URL}/search?query=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    if (data.success) {
      currentResults = data.data;
      renderResults(data.data, `Resultados de búsqueda para: "${query}"`);
    } else {
      showError('resultsContainer', 'Error en la búsqueda');
    }
  } catch (error) {
    console.error('Error:', error);
    showError('resultsContainer', 'Error de conexión');
  }
}

async function loadInstancesOfClass(className) {
  try {
    showLoading('resultsContainer');
    
    const response = await fetch(`${API_BASE_URL}/instances/${className}`);
    const data = await response.json();
    
    if (data.success) {
      currentResults = data.data;
      renderResults(data.data, `Instancias de: ${className}`);
    } else {
      showError('resultsContainer', 'Error al cargar instancias');
    }
  } catch (error) {
    console.error('Error:', error);
    showError('resultsContainer', 'Error de conexión');
  }
}

function renderResults(results, title) {
  const container = document.getElementById('resultsContainer');
  const countBadge = document.getElementById('resultsCount');
  
  if (countBadge) {
    countBadge.textContent = results.length;
  }
  
  if (results.length === 0) {
    container.innerHTML = `
      <div class="alert alert-warning mb-0" role="alert">
        <div class="d-flex align-items-center">
          <i class="fas fa-exclamation-triangle fa-2x me-3"></i>
          <div>
            <strong class="d-block">No se encontraron resultados</strong>
            <span>Intenta con otros términos o explora las categorías</span>
          </div>
        </div>
      </div>
    `;
    return;
  }
  
  let html = `
    <div class="mb-3 d-flex justify-content-between align-items-center">
      <h6 class="text-gold mb-0 text-uppercase">
        <i class="fas fa-filter me-2"></i>
        ${title}
      </h6>
    </div>
  `;
  
  results.forEach((result, index) => {
    const properties = result.properties || {};
    const propertiesCount = Object.keys(properties).length;
    
    html += `
      <div class="card mb-3 result-card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h6 class="mb-0 d-flex align-items-center text-gold">
            <i class="fas fa-cube me-2"></i>
            <strong>${result.name}</strong>
          </h6>
          ${propertiesCount > 0 ? `
          <button class="btn btn-sm btn-outline-primary" onclick="toggleProperties(${index})">
            <i class="fas fa-info-circle me-1"></i>
            ${propertiesCount} PROPIEDADES
          </button>
          ` : ''}
        </div>
        ${propertiesCount > 0 ? `
        <div id="properties-${index}" class="card-body collapse">
          ${renderProperties(properties)}
        </div>
        ` : ''}
      </div>
    `;
  });
  
  container.innerHTML = html;
}

function renderProperties(properties) {
  if (Object.keys(properties).length === 0) {
    return `
      <div class="text-center text-muted py-3">
        <i class="fas fa-inbox fa-2x mb-2 opacity-50"></i>
        <p class="mb-0">No hay propiedades adicionales</p>
      </div>
    `;
  }
  
  let html = '<div class="table-responsive"><table class="table table-sm table-striped table-hover mb-0">';
  html += '<thead><tr><th style="width: 30%"><i class="fas fa-tag me-2"></i>Propiedad</th><th><i class="fas fa-align-left me-2"></i>Valor</th></tr></thead><tbody>';
  
  for (const [key, value] of Object.entries(properties)) {
    html += `
      <tr>
        <td><strong class="text-primary">${key}</strong></td>
        <td>${formatValue(value)}</td>
      </tr>
    `;
  }
  
  html += '</tbody></table></div>';
  return html;
}

function formatValue(value) {
  if (typeof value === 'string' && value.startsWith('http')) {
    const localName = extractLocalName(value);
    return `<a href="${value}" target="_blank" class="text-decoration-none"><i class="fas fa-external-link-alt me-1"></i>${localName}</a>`;
  }
  return `<span class="text-dark">${value}</span>`;
}

function extractLocalName(uri) {
  const parts = uri.split('#');
  if (parts.length > 1) return parts[1];
  const pathParts = uri.split('/');
  return pathParts[pathParts.length - 1];
}

function toggleProperties(index) {
  const element = document.getElementById(`properties-${index}`);
  const bsCollapse = new bootstrap.Collapse(element, {
    toggle: true
  });
}

async function showStats() {
  try {
    const modal = new bootstrap.Modal(document.getElementById('statsModal'));
    modal.show();
    
    showLoading('statsContent');
    
    const response = await fetch(`${API_BASE_URL}/stats`);
    const data = await response.json();
    
    if (data.success) {
      renderStats(data.data);
    } else {
      showError('statsContent', 'Error al cargar estadísticas');
    }
  } catch (error) {
    console.error('Error:', error);
    showError('statsContent', 'Error de conexión');
  }
}

function renderStats(stats) {
  const container = document.getElementById('statsContent');
  
  let html = `
    <div class="row g-4 mb-4">
      <div class="col-md-4">
        <div class="card text-center h-100 border-gold">
          <div class="card-body">
            <i class="fas fa-layer-group fa-3x mb-3 text-gold"></i>
            <h2 class="display-4 fw-bold text-gold">${stats.totalClasses}</h2>
            <p class="mb-0 text-uppercase fw-semibold text-white">Clases</p>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card text-center h-100 border-gold">
          <div class="card-body">
            <i class="fas fa-link fa-3x mb-3 text-gold"></i>
            <h2 class="display-4 fw-bold text-gold">${stats.totalProperties}</h2>
            <p class="mb-0 text-uppercase fw-semibold text-white">Propiedades</p>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card text-center h-100 border-gold">
          <div class="card-body">
            <i class="fas fa-database fa-3x mb-3 text-gold"></i>
            <h2 class="display-4 fw-bold text-gold">${stats.totalStatements}</h2>
            <p class="mb-0 text-uppercase fw-semibold text-white">Statements</p>
          </div>
        </div>
      </div>
    </div>
    
    <div class="row g-4">
      <div class="col-md-6">
        <h6 class="mb-3 text-gold text-uppercase"><i class="fas fa-folder me-2"></i>Clases</h6>
        <div class="list-group" style="max-height: 300px; overflow-y: auto;">
          ${stats.classes.map(cls => `
            <div class="list-group-item d-flex align-items-center bg-dark-casino border-0 mb-1">
              <i class="fas fa-folder me-3 text-gold"></i>
              <span class="text-white">${cls}</span>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="col-md-6">
        <h6 class="mb-3 text-gold text-uppercase"><i class="fas fa-link me-2"></i>Propiedades</h6>
        <div class="list-group" style="max-height: 300px; overflow-y: auto;">
          ${stats.properties.map(prop => `
            <div class="list-group-item d-flex align-items-center bg-dark-casino border-0 mb-1">
              <i class="fas fa-link me-3 text-gold"></i>
              <span class="text-white">${prop}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
}

function showLoading(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = `
    <div class="text-center p-5">
      <div class="spinner-border text-primary mb-3" style="width: 3rem; height: 3rem;" role="status">
        <span class="visually-hidden">Cargando...</span>
      </div>
      <p class="text-muted mb-0">Cargando información...</p>
    </div>
  `;
}

function showError(containerId, message) {
  const container = document.getElementById(containerId);
  container.innerHTML = `
    <div class="alert alert-danger shadow-sm" role="alert">
      <div class="d-flex align-items-center">
        <i class="fas fa-exclamation-circle fa-2x me-3"></i>
        <div>
          <strong class="d-block">Error</strong>
          <span>${message}</span>
        </div>
      </div>
    </div>
  `;
}

function showAlert(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3 shadow-lg`;
  alertDiv.style.zIndex = '9999';
  alertDiv.style.minWidth = '300px';
  alertDiv.innerHTML = `
    <div class="d-flex align-items-center">
      <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'} me-2"></i>
      <span>${message}</span>
    </div>
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  document.body.appendChild(alertDiv);
  
  setTimeout(() => {
    alertDiv.classList.remove('show');
    setTimeout(() => alertDiv.remove(), 150);
  }, 3000);
}

