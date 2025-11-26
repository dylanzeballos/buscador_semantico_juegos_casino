const ontologyService = require("./ontologyService");
const localDbpediaService = require("./localDbpediaService");
const Logger = require("../utils/logger");

class UnifiedSearchService {
  constructor() {
    this.initialized = false;
    this.cache = new Map();
  }

  async init() {
    try {
      await localDbpediaService.init();
      this.initialized = true;
      Logger.info("Unified Search Service initialized");
    } catch (error) {
      Logger.error("Error initializing Unified Search Service:", error);
    }
  }

  async search(query, options = {}) {
    try {
      const {
        includeDbpedia = false,
        maxResults = 20,
        language = "auto",
        preferOffline = false,
        mode = "hybrid", // "local", "dbpedia", "hybrid"
      } = options;

      Logger.info(
        `Unified search for: "${query}" (mode: ${mode}, offline: ${preferOffline})`,
      );

      let localResults = [];
      let dbpediaResults = { english: [], spanish: [], total: 0 };

      if (mode === "local" || mode === "hybrid") {
        localResults = await this.searchLocal(query);
      }

      if (includeDbpedia && (mode === "dbpedia" || mode === "hybrid")) {
        try {
          dbpediaResults = await localDbpediaService.searchWithFallback(query, {
            preferOffline,
            language,
          });
        } catch (error) {
          Logger.warn("DBpedia search failed completely:", error.message);
          dbpediaResults = { english: [], spanish: [], total: 0 };
        }
      }

      const combinedResults = this.combineAndRankResults(
        localResults,
        dbpediaResults,
        query,
      );

      const finalResults = combinedResults.slice(0, maxResults);

      return {
        success: true,
        query,
        mode,
        results: finalResults,
        stats: {
          total: finalResults.length,
          local: localResults.length,
          dbpedia: dbpediaResults ? dbpediaResults.total : 0,
          maxRelevance: finalResults.length > 0 ? finalResults[0].relevance : 0,
          source: dbpediaResults.source || "unknown",
        },
        sources: this.getSourceInfo(localResults, dbpediaResults),
      };
    } catch (error) {
      Logger.error("Error in unified search:", error);
      return {
        success: false,
        error: error.message,
        results: [],
        stats: { total: 0, local: 0, dbpedia: 0 },
      };
    }
  }

  async searchLocal(query) {
    try {
      const results = ontologyService.searchByText(query);
      Logger.info(`Local search found ${results.length} results`);

      return results.map((result) => ({
        ...result,
        searchType: "local",
        displaySource: "Ontología Local",
      }));
    } catch (error) {
      Logger.error("Error in local search:", error);
      return [];
    }
  }

  async searchDbpedia(query) {
    try {
      const results = await dbpediaService.searchDBpedia(query);
      Logger.info(`DBpedia search found ${results.total} results`);

      const formattedResults = [
        ...results.english.map((r) => ({
          ...r,
          searchType: "dbpedia",
          displaySource: "DBpedia (EN)",
          resultType: "dbpedia",
        })),
        ...results.spanish.map((r) => ({
          ...r,
          searchType: "dbpedia",
          displaySource: "DBpedia (ES)",
          resultType: "dbpedia",
        })),
      ];

      return {
        ...results,
        formatted: formattedResults,
      };
    } catch (error) {
      Logger.error("Error in DBpedia search:", error);
      return { english: [], spanish: [], total: 0, formatted: [] };
    }
  }

  combineAndRankResults(localResults, dbpediaResults, query) {
    const allResults = [];
    const queryLower = query.toLowerCase();

    localResults.forEach((result) => {
      allResults.push({
        ...result,
        relevance: this.calculateLocalRelevance(result, queryLower),
        sourceBoost: 1.2, // Boost para ontología local
        resultType: "local",
      });
    });

    if (dbpediaResults) {
      if (dbpediaResults.english && Array.isArray(dbpediaResults.english)) {
        dbpediaResults.english.forEach((result) => {
          allResults.push({
            ...result,
            id: result.id || this.generateId(result.uri || result.label || ""),
            relevance: this.calculateDbpediaRelevance(result, queryLower),
            sourceBoost: 1.0,
            resultType: "dbpedia",
            displaySource: "DBpedia (EN)",
            searchType: "dbpedia",
          });
        });
      }

      if (dbpediaResults.spanish && Array.isArray(dbpediaResults.spanish)) {
        dbpediaResults.spanish.forEach((result) => {
          allResults.push({
            ...result,
            id: result.id || this.generateId(result.uri || result.label || ""),
            relevance: this.calculateDbpediaRelevance(result, queryLower),
            sourceBoost: 1.0,
            resultType: "dbpedia",
            displaySource: "DBpedia (ES)",
            searchType: "dbpedia",
          });
        });
      }
    }

    const uniqueResults = this.removeDuplicates(allResults);

    return uniqueResults.sort((a, b) => {
      const scoreA = (a.relevance || 1) * (a.sourceBoost || 1);
      const scoreB = (b.relevance || 1) * (b.sourceBoost || 1);
      return scoreB - scoreA;
    });
  }

  calculateLocalRelevance(result, queryLower) {
    let score = result.relevance || 1;

    if (result.name && result.name.toLowerCase() === queryLower) {
      score += 10;
    } else if (result.name && result.name.toLowerCase().includes(queryLower)) {
      score += 5;
    }

    if (
      result.description &&
      result.description.toLowerCase().includes(queryLower)
    ) {
      score += 3;
    }

    if (result.abstract && result.abstract.toLowerCase().includes(queryLower)) {
      score += 2;
    }

    return score;
  }

  calculateDbpediaRelevance(result, queryLower) {
    let score = result.relevance || 1;

    if (result.label && result.label.toLowerCase() === queryLower) {
      score += 8; // Ligeramente menor que local
    } else if (
      result.label &&
      result.label.toLowerCase().includes(queryLower)
    ) {
      score += 4;
    }

    if (
      result.description &&
      result.description.toLowerCase().includes(queryLower)
    ) {
      score += 2;
    }

    if (result.abstract && result.abstract.toLowerCase().includes(queryLower)) {
      score += 2;
    }

    if (result.thumbnail) {
      score += 1;
    }

    return score;
  }

  removeDuplicates(results) {
    const unique = [];
    const seenNames = new Set();

    for (const result of results) {
      const name = (result.name || result.label || "").toLowerCase();
      const normalizedName = this.normalizeName(name);

      if (!seenNames.has(normalizedName)) {
        seenNames.add(normalizedName);
        unique.push(result);
      } else {
        const existingIndex = unique.findIndex(
          (u) =>
            this.normalizeName((u.name || u.label || "").toLowerCase()) ===
            normalizedName,
        );

        if (existingIndex !== -1) {
          const existing = unique[existingIndex];
          const currentScore =
            (result.relevance || 1) * (result.sourceBoost || 1);
          const existingScore =
            (existing.relevance || 1) * (existing.sourceBoost || 1);

          if (currentScore > existingScore) {
            unique[existingIndex] = result;
          }
        }
      }
    }

    return unique;
  }

  normalizeName(name) {
    return name
      .replace(/[^a-z0-9]/g, "")
      .replace(/\s+/g, "")
      .substring(0, 20); 
  }

  getSourceInfo(localResults, dbpediaResults) {
    const sources = [];

    if (localResults.length > 0) {
      sources.push({
        name: "Ontología Local",
        type: "local",
        count: localResults.length,
        description: "Base de conocimiento específica de juegos de casino",
      });
    }

    if (dbpediaResults && dbpediaResults.total > 0) {
      sources.push({
        name: "DBpedia",
        type: "dbpedia",
        count: dbpediaResults.total,
        description: `Base de conocimiento global (${dbpediaResults.source || "cache"})`,
      });
    }

    return sources;
  }

  async getResultDetails(id, type, uri) {
    try {
      Logger.info(`Getting details for ${type} result: ${id}`);

      if (type === "local") {
        return await this.getLocalDetails(id);
      } else if (type === "dbpedia") {
        return await this.getDbpediaDetails(id, uri);
      }

      throw new Error(`Unknown result type: ${type}`);
    } catch (error) {
      Logger.error("Error getting result details:", error);
      return null;
    }
  }

  async getLocalDetails(uri) {
    try {
      const instance = ontologyService.getPropertiesOfInstance({ value: uri });
      const name = ontologyService.extractLocalName(uri);

      const enrichedDescription = this.generateEnrichedDescription(
        name,
        instance,
      );

      return {
        type: "local",
        uri,
        name: ontologyService.formatDisplayName
          ? ontologyService.formatDisplayName(name)
          : name,
        properties: instance,
        source: "Local Ontology",
        fullDescription: enrichedDescription.full,
        summary: enrichedDescription.summary,
        contextualInfo: enrichedDescription.context,
        relatedConcepts: this.findRelatedConcepts(uri),
        category: this.getCategoryFromProperties(instance),
        keyFeatures: this.extractKeyFeatures(instance),
      };
    } catch (error) {
      Logger.error("Error getting local details:", error);
      throw error;
    }
  }

  async getDbpediaDetails(uri) {
    try {
      return {
        type: "dbpedia",
        uri,
        properties: {},
        source: "DBpedia",
        fullDescription:
          "Información disponible en DBpedia. Accede al enlace externo para más detalles.",
        externalLinks: this.generateExternalLinks(uri),
      };
    } catch (error) {
      Logger.error("Error getting DBpedia details:", error);
      throw error;
    }
  }

  generateFullDescription(properties) {
    const descriptions = [];

    const mainProps = ["descripcion", "definicion", "resumen", "objetivo"];
    for (const prop of mainProps) {
      if (properties[prop]) {
        descriptions.push(properties[prop]);
      }
    }

    const additionalInfo = [];
    const infoProps = ["tipo", "categoria", "jugadores", "duracion", "reglas"];

    for (const prop of infoProps) {
      if (properties[prop]) {
        const label = this.formatPropertyLabel(prop);
        additionalInfo.push(`${label}: ${properties[prop]}`);
      }
    }

    if (additionalInfo.length > 0) {
      descriptions.push(
        "\n\n**Información adicional:**\n" + additionalInfo.join("\n"),
      );
    }

    return (
      descriptions.join("\n\n") ||
      "Información disponible en la ontología local."
    );
  }

  generateEnrichedDescription(name, properties) {
    const displayName = this.formatDisplayName(name);

    let mainDescription = this.findMainDescription(properties);

    if (!mainDescription) {
      mainDescription = this.generateContextualGameDescription(
        name,
        properties,
      );
    }

    const summary = this.generateSummary(name, properties);

    const context = this.generateDetailContext(name, properties);

    return {
      full: mainDescription,
      summary: summary,
      context: context,
    };
  }

  findMainDescription(properties) {
    const descProps = [
      "descripcion",
      "description",
      "definicion",
      "resumen",
      "concepto",
    ];
    for (const prop of descProps) {
      if (
        properties[prop] &&
        typeof properties[prop] === "string" &&
        properties[prop].length > 20
      ) {
        return properties[prop];
      }
    }
    return null;
  }

  generateContextualGameDescription(name, properties) {
    const displayName = this.formatDisplayName(name);
    const nameLower = name.toLowerCase();

    let description = `${displayName} es `;

    if (nameLower.includes("blackjack")) {
      description +=
        "uno de los juegos de cartas más populares en casinos, donde el objetivo es conseguir una mano cuyo valor se acerque lo más posible a 21 sin pasarse. ";
      description +=
        "Es conocido por tener una de las ventajas de casa más bajas cuando se juega con estrategia básica (aproximadamente 0.5%). ";
      description +=
        "Los jugadores reciben cartas y pueden pedir más, plantarse, doblar o dividir según las reglas específicas.";
    } else if (nameLower.includes("poker")) {
      description +=
        "un juego de cartas estratégico donde la habilidad del jugador puede influir significativamente en los resultados. ";
      description +=
        "Combina elementos de suerte, estrategia, psicología y matemáticas. ";
      description +=
        "Existen múltiples variantes, cada una con sus propias reglas y estrategias óptimas.";
    } else if (nameLower.includes("ruleta")) {
      description +=
        "un clásico juego de casino donde los jugadores apuestan en qué número, color o sección caerá una bola giratoria. ";
      description +=
        "Es un juego de azar puro con una ventaja de casa fija (2.7% en europea, 5.26% en americana). ";
      description +=
        "Ofrece múltiples tipos de apuestas con diferentes probabilidades y pagos.";
    } else if (nameLower.includes("baccarat")) {
      description +=
        "un elegante juego de cartas donde los jugadores apuestan en si ganará la mano del jugador, la banca, o si será empate. ";
      description +=
        "Es popular entre los jugadores de altas apuestas y tiene reglas relativamente simples.";
    } else {
      description += "un juego de casino ";
      if (properties.tipo) description += `de tipo ${properties.tipo} `;
      description +=
        "que ofrece entretenimiento y la posibilidad de ganar premios.";
    }

    return description;
  }

  generateSummary(name, properties) {
    const displayName = this.formatDisplayName(name);
    const nameLower = name.toLowerCase();

    if (nameLower.includes("blackjack")) {
      return "Juego de cartas con objetivo de llegar a 21. Baja ventaja de casa con estrategia correcta.";
    } else if (nameLower.includes("poker")) {
      return "Juego estratégico de cartas donde la habilidad del jugador es fundamental.";
    } else if (nameLower.includes("ruleta")) {
      return "Juego de azar clásico con múltiples opciones de apuesta y pagos variados.";
    }

    return `${displayName} - Juego popular de casino con reglas específicas y estrategias particulares.`;
  }

  generateDetailContext(name, properties) {
    const contexts = [];

    if (properties.probabilidadCasa || properties.ventajaCasa) {
      contexts.push(
        `Ventaja de casa: ${properties.probabilidadCasa || properties.ventajaCasa}`,
      );
    }

    if (properties.jugadores) {
      contexts.push(`Número de jugadores: ${properties.jugadores}`);
    }

    if (properties.dificultad) {
      contexts.push(`Nivel de dificultad: ${properties.dificultad}`);
    }

    if (properties.duracion) {
      contexts.push(`Duración típica: ${properties.duracion}`);
    }

    return contexts.join(" | ");
  }

  getCategoryFromProperties(properties) {
    if (properties.categoria) return properties.categoria;
    if (properties.tipo) return properties.tipo;
    return "Juego de Casino";
  }

  extractKeyFeatures(properties) {
    const features = [];

    if (properties.ventajaCasa)
      features.push(`Ventaja casa: ${properties.ventajaCasa}`);
    if (properties.jugadores)
      features.push(`${properties.jugadores} jugadores`);
    if (properties.dificultad)
      features.push(`Dificultad: ${properties.dificultad}`);

    return features;
  }

  formatDisplayName(name) {
    return name
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  formatDbpediaDescription(properties) {
    if (!properties) return "";

    const descriptions = [];

    const descProps = ["abstract", "comment", "description"];
    for (const prop of descProps) {
      if (properties[prop] && Array.isArray(properties[prop])) {
        descriptions.push(...properties[prop]);
      }
    }

    return descriptions.join("\n\n") || "Información disponible en DBpedia.";
  }

  findRelatedConcepts(uri) {
    try {
      const statements = ontologyService.store.statementsMatching(
        { value: uri },
        ontologyService.rdf("type"),
        null,
      );

      if (statements.length > 0) {
        const classUri = statements[0].object.value;
        const relatedInstances = ontologyService.getInstancesOfClass(
          ontologyService.extractLocalName(classUri),
        );

        return relatedInstances
          .filter((instance) => instance.uri !== uri)
          .slice(0, 5)
          .map((instance) => ({
            uri: instance.uri,
            name: instance.name,
            type: "related",
          }));
      }

      return [];
    } catch (error) {
      Logger.error("Error finding related concepts:", error);
      return [];
    }
  }

  generateExternalLinks(uri) {
    const links = [];

    if (uri.includes("dbpedia.org")) {
      links.push({
        title: "Ver en DBpedia",
        url: uri,
        type: "dbpedia",
      });

      const resourceName = uri.split("/").pop();
      if (resourceName) {
        const wikiUrl = uri.includes("es.dbpedia.org")
          ? `https://es.wikipedia.org/wiki/${resourceName}`
          : `https://en.wikipedia.org/wiki/${resourceName}`;

        links.push({
          title: "Ver en Wikipedia",
          url: wikiUrl,
          type: "wikipedia",
        });
      }
    }

    return links;
  }

  formatPropertyLabel(prop) {
    const labels = {
      tipo: "Tipo",
      categoria: "Categoría",
      jugadores: "Número de jugadores",
      duracion: "Duración",
      reglas: "Reglas",
      objetivo: "Objetivo",
      dificultad: "Dificultad",
      origen: "Origen",
    };

    return labels[prop] || prop.charAt(0).toUpperCase() + prop.slice(1);
  }

  async cleanup() {
    try {
      this.cache.clear();
      await localDbpediaService.cleanExpiredCache();
      Logger.info("Unified Search Service cleanup completed");
    } catch (error) {
      Logger.error("Error during cleanup:", error);
    }
  }

  async reloadLocalDataset() {
    try {
      await localDbpediaService.reloadLocalDataset();
      Logger.info("Local dataset reloaded successfully");
    } catch (error) {
      Logger.error("Error reloading local dataset:", error);
    }
  }

  getServiceStats() {
    return {
      unified: {
        initialized: this.initialized,
        cacheSize: this.cache.size,
      },
      dbpedia: localDbpediaService.getStats(),
    };
  }

  generateId(text) {
    return Buffer.from(text || "default")
      .toString("base64")
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 12);
  }
}

const unifiedSearchService = new UnifiedSearchService();
module.exports = unifiedSearchService;
