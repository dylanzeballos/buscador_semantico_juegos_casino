const API_BASE_URL = "/api/unified";

// State management
let currentResults = [];
let currentQuery = "";
let searchInProgress = false;

// Initialize app
document.addEventListener("DOMContentLoaded", function () {
  console.log("Semantic Search App Initialized");
  initializeEventListeners();
  initializeWelcomeState();
});

/**
 * Initialize all event listeners
 */
function initializeEventListeners() {
  const searchBtn = document.getElementById("searchBtn");
  const searchInput = document.getElementById("searchInput");

  if (searchBtn) {
    searchBtn.addEventListener("click", handleSearch);
  }

  if (searchInput) {
    searchInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        handleSearch();
      }
    });

    searchInput.addEventListener("input", debounce(handleInputChange, 300));
  }

  window.filterResults = filterResults;
  window.showStats = showStats;
  window.showResultDetail = showResultDetail;
}

/**
 * Initialize welcome state
 */
function initializeWelcomeState() {
  const resultsContainer = document.getElementById("resultsContainer");
  if (resultsContainer) {
    showWelcomeState();
  }
}

/**
 * Handle search button click or Enter key
 */
async function handleSearch() {
  const searchInput = document.getElementById("searchInput");

  if (!searchInput) return;

  const query = searchInput.value.trim();

  if (!query) {
    showNotification("Por favor ingresa un término de búsqueda", "warning");
    return;
  }

  if (searchInProgress) {
    showNotification("Búsqueda en progreso, por favor espera...", "info");
    return;
  }

  currentQuery = query;
  searchInProgress = true;

  try {
    showLoadingState();
    updateSearchInfo(query, "Buscando...");

    // Búsqueda automática con detección de conexión
    // Siempre incluye DBpedia para búsqueda completa (local + online/offline)
    const url = `/api/unified/search?query=${encodeURIComponent(query)}&includeDbpedia=true`;
    console.log("[FRONTEND] Making request to:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    console.log(
      "[FRONTEND] Response status:",
      response.status,
      response.statusText,
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("[FRONTEND] Response data:", {
      success: data.success,
      resultsCount: data.data?.results?.length || 0,
      stats: data.data?.stats,
    });

    if (data.success) {
      currentResults = data.data.results || [];
      console.log("[FRONTEND] Current results count:", currentResults.length);
      displayGoogleStyleResults(data.data);
    } else {
      console.error("[FRONTEND] API returned error:", data.error);
      showErrorState(data.error || "Error en la búsqueda");
    }
  } catch (error) {
    console.error("[FRONTEND] Search error:", error);
    showErrorState("Error de conexión: " + error.message);
  } finally {
    searchInProgress = false;
  }
}

/**
 * Handle search input change for suggestions
 */
function handleInputChange(e) {
  const query = e.target.value.trim();
  // Future: implement auto-suggestions
}

/**
 * Display Google-style results
 */
function displayGoogleStyleResults(data) {
  const resultsContainer = document.getElementById("resultsContainer");
  const googleResults = document.getElementById("googleResults");
  const searchInfo = document.getElementById("searchInfo");

  hideLoadingState();
  hideWelcomeState();

  if (!googleResults) return;

  const stats = data.stats || { total: 0, local: 0, dbpedia: 0 };

  // Show search info with source breakdown
  if (searchInfo) {
    searchInfo.classList.remove("d-none");
    const sourceInfo =
      stats.dbpedia > 0
        ? ` (Local: ${stats.local}, DBpedia: ${stats.dbpedia})`
        : "";
    updateSearchInfo(
      currentQuery,
      `Aproximadamente ${stats.total} resultados${sourceInfo} (${(Math.random() * 0.5).toFixed(2)}s)`,
    );
  }

  googleResults.classList.remove("d-none");

  const resultsList = googleResults.querySelector(".results-list");
  const results = data.results || [];

  if (!resultsList) return;

  if (results.length === 0) {
    resultsList.innerHTML = generateEmptyResultsHTML(currentQuery);
    return;
  }

  let resultsHTML = "";

  // Mostrar respuesta contextual de NLP si existe
  const firstResult = results[0];
  if (firstResult && firstResult.contextualAnswer) {
    resultsHTML += generateNLPAnswerBox(firstResult.contextualAnswer);
  }

  results.forEach((result, index) => {
    resultsHTML += generateGoogleResultHTML(result, index);
  });

  resultsList.innerHTML = resultsHTML;

  // Add animation and click handlers
  const resultItems = resultsList.querySelectorAll(".google-result-item");
  resultItems.forEach((item, index) => {
    item.style.animationDelay = `${index * 0.05}s`;
    item.addEventListener("click", function (e) {
      if (e.target.tagName !== "A" && !e.target.closest("a")) {
        const link = this.querySelector(".result-title a");
        if (link) link.click();
      }
    });
  });

  showNotification(
    `Se encontraron ${stats.total} resultados${stats.dbpedia > 0 ? " (incluye DBpedia)" : ""}`,
    "success",
  );
}

/**
 * Generate NLP answer box (like Google's featured snippet)
 */
function generateNLPAnswerBox(answer) {
  const cleanAnswer = cleanDescription(answer);

  return `
    <div class="nlp-answer-box">
      <div class="nlp-answer-header">
        <i class="fas fa-brain me-2"></i>
        <strong>Respuesta Inteligente</strong>
        <span class="nlp-badge">IA</span>
      </div>
      <div class="nlp-answer-content">
        ${cleanAnswer}
      </div>
      <div class="nlp-answer-footer">
        <small class="text-muted">
          <i class="fas fa-info-circle me-1"></i>
          Generado por procesamiento de lenguaje natural
        </small>
      </div>
    </div>
  `;
}

/**
 * Generate HTML for a single Google-style result
 */
function generateGoogleResultHTML(result, index) {
  const sourceIcon = getSourceIcon(result.resultType || result.source);
  const sourceBadgeClass = getSourceBadgeClass(
    result.resultType || result.source,
  );
  const title = escapeHtml(result.label || result.name || "Sin título");
  const snippet = cleanDescription(
    result.preview ||
      result.description ||
      result.abstract ||
      "Sin descripción disponible",
  );
  const category = result.category || result.type || "";
  const relevance = Math.round((result.relevance || 1) * 10) / 10;
  const hasImage = result.thumbnail && result.thumbnail.trim() !== "";
  const safeId = result.id || `result_${index}`;
  const safeType =
    result.resultType || result.searchType || result.source || "local";
  const safeUri = result.uri || "";

  return `
        <div class="google-result-item" data-id="${escapeHtml(safeId)}" data-type="${escapeHtml(safeType)}" data-uri="${escapeHtml(safeUri)}">
            <div class="result-header">
                <div class="result-url">
                    <i class="fas fa-${sourceIcon} me-1"></i>
                    <span class="source-badge badge-${sourceBadgeClass}">${escapeHtml(result.displaySource || result.source || "Desconocido")}</span>
                </div>
                <h3 class="result-title">
                    <a href="#" onclick="showResultDetail('${escapeHtml(safeId)}', '${escapeHtml(safeType)}', '${escapeHtml(safeUri)}'); return false;">
                        ${title}
                    </a>
                </h3>
            </div>
            <div class="result-content">
                <p class="result-snippet">${snippet}</p>
                ${
                  hasImage
                    ? `
                <div class="result-image">
                    <img src="${escapeHtml(result.thumbnail)}" alt="${title}" class="img-thumbnail"
                         onerror="this.parentElement.style.display='none'">
                </div>
                `
                    : ""
                }
            </div>
            <div class="result-meta">
                <span class="relevance-score">
                    <i class="fas fa-star me-1"></i>
                    Relevancia: ${relevance}
                </span>
                ${
                  category
                    ? `
                <span class="category-tag">
                    <i class="fas fa-tag me-1"></i>
                    ${escapeHtml(category)}
                </span>
                `
                    : ""
                }
            </div>
        </div>
    `;
}

/**
 * Generate empty results HTML
 */
function generateEmptyResultsHTML(query) {
  return `
        <div class="empty-results text-center py-5">
            <div class="empty-icon mb-4">
                <i class="fas fa-search fa-3x text-muted"></i>
            </div>
            <h3 class="h4 mb-3">No se encontraron resultados</h3>
            <p class="text-muted mb-4">Tu búsqueda "<strong>${escapeHtml(query)}</strong>" no coincide con ningún documento.</p>
            <div class="suggestions">
                <p class="fw-bold mb-2">Sugerencias:</p>
                <ul class="list-unstyled">
                    <li><i class="fas fa-check text-success me-2"></i>Verifica la ortografía</li>
                    <li><i class="fas fa-check text-success me-2"></i>Prueba con palabras clave diferentes</li>
                    <li><i class="fas fa-check text-success me-2"></i>Usa términos más generales</li>
                    <li><i class="fas fa-check text-success me-2"></i>Intenta en inglés o español</li>
                </ul>
            </div>
        </div>
    `;
}

/**
 * Show loading state
 */
function showLoadingState() {
  const loadingContainer = document.getElementById("loadingContainer");
  const googleResults = document.getElementById("googleResults");

  if (loadingContainer) loadingContainer.classList.remove("d-none");
  if (googleResults) googleResults.classList.add("d-none");
}

/**
 * Hide loading state
 */
function hideLoadingState() {
  const loadingContainer = document.getElementById("loadingContainer");
  if (loadingContainer) loadingContainer.classList.add("d-none");
}

/**
 * Show welcome state
 */
function showWelcomeState() {
  const resultsContainer = document.getElementById("resultsContainer");
  const welcomeState = resultsContainer?.querySelector(".welcome-state");
  const googleResults = document.getElementById("googleResults");
  const searchInfo = document.getElementById("searchInfo");

  if (welcomeState) welcomeState.classList.remove("d-none");
  if (googleResults) googleResults.classList.add("d-none");
  if (searchInfo) searchInfo.classList.add("d-none");
}

/**
 * Hide welcome state
 */
function hideWelcomeState() {
  const welcomeState = document.querySelector(".welcome-state");
  if (welcomeState) welcomeState.classList.add("d-none");
}

/**
 * Show error state
 */
function showErrorState(message) {
  const googleResults = document.getElementById("googleResults");
  const resultsList = googleResults?.querySelector(".results-list");

  hideLoadingState();

  if (!googleResults || !resultsList) return;

  googleResults.classList.remove("d-none");
  resultsList.innerHTML = `
        <div class="error-results text-center py-5">
            <div class="error-icon mb-4">
                <i class="fas fa-exclamation-triangle fa-3x text-danger"></i>
            </div>
            <h3 class="h4 mb-3">Error en la búsqueda</h3>
            <p class="text-muted">${escapeHtml(message)}</p>
            <button class="btn btn-primary mt-3" onclick="location.reload()">
                <i class="fas fa-redo me-2"></i>Reintentar
            </button>
        </div>
    `;
}

/**
 * Update search info text
 */
function updateSearchInfo(query, statsText) {
  const searchStatsText = document.getElementById("searchStatsText");
  if (searchStatsText) searchStatsText.textContent = statsText;
}

/**
 * Filter results by source
 */
function filterResults(filterType) {
  console.log("Filtering by:", filterType);

  if (!currentResults || currentResults.length === 0) {
    showNotification("No hay resultados para filtrar", "warning");
    return;
  }

  let filteredResults = currentResults;

  if (filterType === "local") {
    filteredResults = currentResults.filter(
      (r) => r.resultType === "local" || r.source === "local",
    );
  } else if (filterType === "dbpedia") {
    filteredResults = currentResults.filter(
      (r) =>
        r.resultType === "dbpedia" ||
        r.source === "dbpedia" ||
        r.source === "DBpedia" ||
        r.displaySource?.includes("DBpedia"),
    );
  }

  displayFilteredResults(filteredResults);
  showNotification(
    `Mostrando ${filteredResults.length} resultados de ${getFilterName(filterType)}`,
    "info",
  );
}

/**
 * Display filtered results
 */
function displayFilteredResults(results) {
  const googleResults = document.getElementById("googleResults");
  const resultsList = googleResults?.querySelector(".results-list");

  if (!resultsList) return;

  if (results.length === 0) {
    resultsList.innerHTML = generateEmptyResultsHTML(currentQuery);
    return;
  }

  let resultsHTML = "";
  results.forEach((result, index) => {
    resultsHTML += generateGoogleResultHTML(result, index);
  });

  resultsList.innerHTML = resultsHTML;

  const resultItems = resultsList.querySelectorAll(".google-result-item");
  resultItems.forEach((item, index) => {
    item.style.animationDelay = `${index * 0.05}s`;
    item.addEventListener("click", function (e) {
      if (e.target.tagName !== "A" && !e.target.closest("a")) {
        const link = this.querySelector(".result-title a");
        if (link) link.click();
      }
    });
  });
}

/**
 * Show result detail modal
 */
async function showResultDetail(id, type, uri) {
  console.log("Showing detail for:", { id, type, uri });

  const modal = new bootstrap.Modal(document.getElementById("detailModal"));
  const detailTitle = document.getElementById("detailTitle");
  const detailSubtitle = document.getElementById("detailSubtitle");

  const result = currentResults.find((r) => r.id === id || r.uri === uri);

  if (!result) {
    console.error("Result not found");
    return;
  }

  if (detailTitle)
    detailTitle.textContent = result.label || result.name || "Detalles";
  if (detailSubtitle) {
    detailSubtitle.innerHTML = `<i class="fas fa-${getSourceIcon(type)} me-1"></i>${result.displaySource || result.source || ""}`;
  }

  modal.show();

  showDetailLoadingState();

  try {
    const detailData = await loadDetailedInfo(id, type, uri);
    displayDetailContent(detailData, result);
  } catch (error) {
    console.error("Error loading detail:", error);
    displayDetailError(error.message);
  }
}

/**
 * Load detailed information
 */
async function loadDetailedInfo(id, type, uri) {
  console.log("Loading detail info for:", { id, type, uri });

  const response = await fetch(
    `/api/unified/details?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}&uri=${encodeURIComponent(uri)}`,
    {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || "Error al cargar detalles");
  }

  return data.data;
}

/**
 * Display detail content in modal
 */
function displayDetailContent(detailData, result) {
  const overviewContent = document.getElementById("detailOverviewContent");

  if (overviewContent) {
    overviewContent.innerHTML = generateOverviewHTML(detailData, result);
  }
}

/**
 * Generate overview HTML
 */
function generateOverviewHTML(detailData, result) {
  console.log("[FRONTEND] Generating overview HTML with:", {
    detailData,
    result,
  });

  const description = cleanDescription(
    detailData.fullDescription ||
      detailData.summary ||
      result.description ||
      result.abstract ||
      result.preview ||
      "Sin descripción disponible",
  );

  const thumbnail = result.thumbnail || "";
  const category = result.category || result.type || "";
  const contextualAnswer =
    result.contextualAnswer || detailData.contextualAnswer || "";

  return `
        <div class="detail-overview">
            ${
              contextualAnswer
                ? `
            <div class="nlp-answer-box mb-4">
                <div class="nlp-answer-header">
                    <i class="fas fa-brain me-2"></i>
                    <strong>Respuesta Inteligente</strong>
                    <span class="nlp-badge">IA</span>
                </div>
                <div class="nlp-answer-content">
                    ${cleanDescription(contextualAnswer)}
                </div>
            </div>
            `
                : ""
            }

            ${
              thumbnail
                ? `
            <div class="detail-image mb-4 text-center">
                <img src="${escapeHtml(thumbnail)}" alt="${escapeHtml(result.label || result.name)}"
                     class="img-fluid rounded shadow" style="max-height: 300px;"
                     onerror="this.parentElement.style.display='none'">
            </div>
            `
                : ""
            }

            ${
              category
                ? `
            <div class="detail-category mb-3">
                <span class="badge bg-primary fs-6">
                    <i class="fas fa-tag me-2"></i>${escapeHtml(category)}
                </span>
            </div>
            `
                : ""
            }

            <div class="detail-description">
                <h5 class="mb-3"><i class="fas fa-align-left me-2"></i>Descripción</h5>
                <div class="description-text p-3 bg-light rounded" style="line-height: 1.8;">
                    ${description}
                </div>
            </div>

            ${
              detailData.externalLinks && detailData.externalLinks.length > 0
                ? `
            <div class="detail-links mt-4">
                <h5 class="mb-3"><i class="fas fa-external-link-alt me-2"></i>Enlaces externos</h5>
                <div class="links-container">
                    ${detailData.externalLinks
                      .map(
                        (link) => `
                        <a href="${escapeHtml(link.url)}" target="_blank" class="btn btn-outline-primary btn-sm me-2 mb-2">
                            <i class="fas fa-link me-1"></i>
                            ${escapeHtml(link.title)}
                        </a>
                    `,
                      )
                      .join("")}
                </div>
            </div>
            `
                : ""
            }
        </div>
    `;
}

/**
 * Show detail loading state
 */
function showDetailLoadingState() {
  const overviewContent = document.getElementById("detailOverviewContent");

  if (overviewContent) {
    overviewContent.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Cargando...</span>
                </div>
                <p class="mt-3 text-muted">Cargando información detallada...</p>
            </div>
        `;
  }
}

/**
 * Display detail error
 */
function displayDetailError(message) {
  const overviewContent = document.getElementById("detailOverviewContent");

  if (overviewContent) {
    overviewContent.innerHTML = `
            <div class="alert alert-warning" role="alert">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>Error al cargar detalles:</strong> ${escapeHtml(message)}
            </div>
        `;
  }
}

/**
 * Show statistics modal
 */
async function showStats() {
  const modal = new bootstrap.Modal(document.getElementById("statsModal"));
  const statsContent = document.getElementById("statsContent");

  if (!statsContent) return;

  statsContent.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Cargando...</span>
            </div>
            <p class="mt-3 text-muted">Cargando estadísticas...</p>
        </div>
    `;

  modal.show();

  try {
    const response = await fetch("/api/unified/stats", {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    const data = await response.json();

    if (statsContent) {
      statsContent.innerHTML = generateStatsHTML(data);
    }
  } catch (error) {
    console.error("Error loading stats:", error);
    const statsContent = document.getElementById("statsContent");
    if (statsContent) {
      statsContent.innerHTML = `
                <div class="alert alert-danger" role="alert">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Error al cargar estadísticas: ${escapeHtml(error.message)}
                </div>
            `;
    }
  }
}

/**
 * Generate statistics HTML
 */
function generateStatsHTML(data) {
  return `
        <div class="stats-overview">
            <div class="row g-4">
                <div class="col-md-6">
                    <div class="stat-card p-3 border rounded">
                        <h6 class="text-muted mb-2"><i class="fas fa-database me-2"></i>Ontología Local</h6>
                        <p class="h3 mb-0">${data.data?.ontology?.totalInstances || 0}</p>
                        <small class="text-muted">instancias</small>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="stat-card p-3 border rounded">
                        <h6 class="text-muted mb-2"><i class="fas fa-globe me-2"></i>DBpedia Dataset</h6>
                        <p class="h3 mb-0">${data.data?.dbpedia?.localEntries || 0}</p>
                        <small class="text-muted">entradas locales</small>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Show notification toast
 */
function showNotification(message, type = "info") {
  const toastElement = document.getElementById("notificationToast");
  const toastMessage = document.getElementById("toastMessage");

  if (!toastElement || !toastMessage) return;

  const iconMap = {
    success: "check-circle",
    error: "exclamation-triangle",
    warning: "exclamation-circle",
    info: "info-circle",
  };

  const colorMap = {
    success: "text-success",
    error: "text-danger",
    warning: "text-warning",
    info: "text-primary",
  };

  const icon = iconMap[type] || iconMap.info;
  const color = colorMap[type] || colorMap.info;

  const header = toastElement.querySelector(".toast-header i");
  if (header) {
    header.className = `fas fa-${icon} ${color} me-2`;
  }

  toastMessage.textContent = message;

  const toast = new bootstrap.Toast(toastElement, {
    autohide: true,
    delay: 3000,
  });

  toast.show();
}

/**
 * Get source icon
 */
function getSourceIcon(source) {
  const icons = {
    local: "home",
    "Local Ontology": "home",
    dbpedia: "globe",
    DBpedia: "globe",
  };
  return icons[source] || "database";
}

/**
 * Get source badge class
 */
function getSourceBadgeClass(source) {
  const classes = {
    local: "local",
    "Local Ontology": "local",
    dbpedia: "dbpedia",
    DBpedia: "dbpedia",
  };
  return classes[source] || "local";
}

/**
 * Get filter name
 */
function getFilterName(filter) {
  const names = {
    local: "Ontología Local",
    dbpedia: "DBpedia",
    all: "Todas las fuentes",
  };
  return names[filter] || "Desconocido";
}

/**
 * Clean and format description text
 */
function cleanDescription(text) {
  if (!text) return "Sin descripción disponible";

  // Decodificar entidades HTML
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  let cleaned = textarea.value;

  // Remover múltiples espacios y saltos de línea excesivos
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // Limitar longitud pero mantener contexto
  if (cleaned.length > 400) {
    cleaned = cleaned.substring(0, 400);
    const lastPeriod = cleaned.lastIndexOf(".");
    const lastSpace = cleaned.lastIndexOf(" ");
    if (lastPeriod > 300) {
      cleaned = cleaned.substring(0, lastPeriod + 1);
    } else if (lastSpace > 300) {
      cleaned = cleaned.substring(0, lastSpace) + "...";
    } else {
      cleaned += "...";
    }
  }

  // Escapar HTML para prevenir XSS
  return escapeHtml(cleaned);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Debounce function
 */
function debounce(func, wait) {
  let timeout;

  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
