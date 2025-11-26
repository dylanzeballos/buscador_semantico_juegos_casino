const ontologyService = require("../services/ontologyService");
const dbpediaService = require("../services/dbpediaService");
const unifiedSearchService = require("../services/unifiedSearchService");
const ResponseHandler = require("../utils/responseHandler");
const Logger = require("../utils/logger");

class OntologyController {
  async getClasses(req, res) {
    try {
      if (!ontologyService.loaded) {
        Logger.warn("Ontología no cargada, intentando cargar...");
        await ontologyService.loadOntology();
      }

      Logger.info("Obteniendo clases de la ontología");
      const classes = ontologyService.getClasses();
      Logger.info(`Se encontraron ${classes.length} clases`);
      return ResponseHandler.success(
        res,
        classes,
        "Clases obtenidas exitosamente",
      );
    } catch (error) {
      Logger.error("Error al obtener clases:", error);
      return ResponseHandler.error(res, error.message, 500);
    }
  }

  async getInstancesOfClass(req, res) {
    try {
      const { className } = req.params;
      Logger.info(`Obteniendo instancias de la clase: ${className}`);

      const instances = ontologyService.getInstancesOfClass(className);
      return ResponseHandler.success(
        res,
        instances,
        `Instancias de ${className} obtenidas exitosamente`,
      );
    } catch (error) {
      Logger.error("Error al obtener instancias:", error);
      return ResponseHandler.error(res, error.message, 500);
    }
  }

  async searchByText(req, res) {
    try {
      const { query, includeDbpedia } = req.query;

      if (!query) {
        return ResponseHandler.badRequest(
          res,
          'Parámetro "query" es requerido',
        );
      }

      if (!ontologyService.loaded) {
        Logger.warn("Ontología no cargada, intentando cargar...");
        await ontologyService.loadOntology();
      }

      Logger.info(`Buscando: ${query}`);

      const localResults = ontologyService.searchByText(query);
      Logger.info(
        `Se encontraron ${localResults.length} resultados locales para: ${query}`,
      );

      let dbpediaResults = null;
      if (includeDbpedia === "true") {
        Logger.info(`Buscando en DBpedia: ${query}`);
        dbpediaResults = await dbpediaService.searchDBpedia(query);
        Logger.info(
          `DBpedia - EN: ${dbpediaResults.english.length}, ES: ${dbpediaResults.spanish.length}`,
        );
      }

      return ResponseHandler.success(
        res,
        {
          local: localResults,
          dbpedia: dbpediaResults,
          totalLocal: localResults.length,
          totalDbpedia: dbpediaResults ? dbpediaResults.total : 0,
        },
        `Se encontraron ${localResults.length} resultados locales${dbpediaResults ? ` y ${dbpediaResults.total} en DBpedia` : ""}`,
      );
    } catch (error) {
      Logger.error("Error en la búsqueda:", error);
      return ResponseHandler.error(res, error.message, 500);
    }
  }

  async getProperties(req, res) {
    try {
      Logger.info("Obteniendo propiedades de la ontología");
      const properties = ontologyService.getProperties();
      return ResponseHandler.success(
        res,
        properties,
        "Propiedades obtenidas exitosamente",
      );
    } catch (error) {
      Logger.error("Error al obtener propiedades:", error);
      return ResponseHandler.error(res, error.message, 500);
    }
  }

  async getStats(req, res) {
    try {
      Logger.info("Obteniendo estadísticas de la ontología");
      const stats = ontologyService.getOntologyStats();
      return ResponseHandler.success(
        res,
        stats,
        "Estadísticas obtenidas exitosamente",
      );
    } catch (error) {
      Logger.error("Error al obtener estadísticas:", error);
      return ResponseHandler.error(res, error.message, 500);
    }
  }

  async reloadOntology(req, res) {
    try {
      Logger.info("Recargando ontología");
      await ontologyService.loadOntology();
      return ResponseHandler.success(
        res,
        null,
        "Ontología recargada exitosamente",
      );
    } catch (error) {
      Logger.error("Error al recargar ontología:", error);
      return ResponseHandler.error(res, error.message, 500);
    }
  }

  async searchDbpedia(req, res) {
    try {
      const { query } = req.query;

      if (!query) {
        return ResponseHandler.badRequest(
          res,
          'Parámetro "query" es requerido',
        );
      }

      Logger.info(`Buscando en DBpedia: ${query}`);
      const results = await dbpediaService.searchDBpedia(query);

      return ResponseHandler.success(
        res,
        results,
        `Se encontraron ${results.total} resultados en DBpedia (EN: ${results.english.length}, ES: ${results.spanish.length})`,
      );
    } catch (error) {
      Logger.error("Error al buscar en DBpedia:", error);
      return ResponseHandler.error(res, error.message, 500);
    }
  }

  async searchCasinoGameDbpedia(req, res) {
    try {
      const { game } = req.query;

      if (!game) {
        return ResponseHandler.badRequest(res, 'Parámetro "game" es requerido');
      }

      Logger.info(`Buscando juego en DBpedia: ${game}`);
      const results = await dbpediaService.searchCasinoGame(game);

      return ResponseHandler.success(
        res,
        results,
        results.found
          ? `Información encontrada para: ${game}`
          : `No se encontró información para: ${game}`,
      );
    } catch (error) {
      Logger.error("Error al buscar juego en DBpedia:", error);
      return ResponseHandler.error(res, error.message, 500);
    }
  }

  async unifiedSearch(req, res) {
    try {
      const {
        query,
        includeDbpedia,
        maxResults,
        language,
        preferOffline,
        mode,
      } = req.query;

      Logger.info(
        `[CONTROLLER] Received unified search request - Query: ${query}, IncludeDbpedia: ${includeDbpedia}, Mode: ${mode}, PreferOffline: ${preferOffline}`,
      );

      if (!query) {
        Logger.warn(`[CONTROLLER] Missing query parameter`);
        return ResponseHandler.badRequest(
          res,
          'Parámetro "query" es requerido',
        );
      }

      Logger.info(`[CONTROLLER] Unified search for: ${query}`);

      const options = {
        includeDbpedia: includeDbpedia === "true",
        maxResults: parseInt(maxResults) || 20,
        language: language || "auto",
        preferOffline: preferOffline === "true",
        mode: mode || "hybrid", // "local", "dbpedia", "hybrid"
      };

      Logger.info(`[CONTROLLER] Search options:`, options);

      const results = await unifiedSearchService.search(query, options);
      Logger.info(
        `[CONTROLLER] Search completed. Success: ${results.success}, Results count: ${results.results?.length || 0}, Source: ${results.stats?.source}`,
      );

      if (results.success) {
        Logger.info(
          `[CONTROLLER] Sending successful response with ${results.results.length} results`,
        );
      } else {
        Logger.error(`[CONTROLLER] Search failed: ${results.error}`);
      }

      return ResponseHandler.success(
        res,
        {
          results: results.results || [],
          stats: results.stats || { total: 0, local: 0, dbpedia: 0 },
          sources: results.sources || [],
          query: query,
          mode: options.mode,
        },
        `Búsqueda unificada completada para: "${query}"`,
      );
    } catch (error) {
      Logger.error("[CONTROLLER] Error in unified search:", error);
      return ResponseHandler.error(res, error.message, 500);
    }
  }

  async getResultDetail(req, res) {
    try {
      const { id, type, uri } = req.query;
      Logger.info(
        `[CONTROLLER] Getting detail for: ${id} (${type}), URI: ${uri}`,
      );

      if (!id || !type || !uri) {
        Logger.warn(`[CONTROLLER] Missing required parameters for detail`);
        return ResponseHandler.badRequest(
          res,
          'Parámetros "id", "type" y "uri" son requeridos',
        );
      }

      const detail = await unifiedSearchService.getResultDetails(id, type, uri);

      if (!detail) {
        Logger.warn(`[CONTROLLER] No detail found for: ${id}`);
        return ResponseHandler.notFound(res, "Detalles no encontrados");
      }

      Logger.info(`[CONTROLLER] Detail loaded successfully for: ${id}`);

      return ResponseHandler.success(
        res,
        detail,
        "Detalles obtenidos exitosamente",
      );
    } catch (error) {
      Logger.error("[CONTROLLER] Error getting result detail:", error);
      return ResponseHandler.error(res, error.message, 500);
    }
  }

  async initializeUnifiedService(req, res) {
    try {
      await unifiedSearchService.init();
      return ResponseHandler.success(
        res,
        null,
        "Servicio unificado inicializado",
      );
    } catch (error) {
      Logger.error("Error initializing unified service:", error);
      return ResponseHandler.error(res, error.message, 500);
    }
  }

  async cleanCache(req, res) {
    try {
      await unifiedSearchService.cleanup();
      return ResponseHandler.success(res, null, "Cache limpiado exitosamente");
    } catch (error) {
      Logger.error("Error cleaning cache:", error);
      return ResponseHandler.error(res, error.message, 500);
    }
  }

  async reloadLocalDataset(req, res) {
    try {
      await unifiedSearchService.reloadLocalDataset();
      return ResponseHandler.success(
        res,
        null,
        "Dataset local recargado exitosamente",
      );
    } catch (error) {
      Logger.error("Error reloading local dataset:", error);
      return ResponseHandler.error(res, error.message, 500);
    }
  }

  async getServiceStats(req, res) {
    try {
      const stats = unifiedSearchService.getServiceStats();
      return ResponseHandler.success(
        res,
        stats,
        "Estadísticas del servicio obtenidas",
      );
    } catch (error) {
      Logger.error("Error getting service stats:", error);
      return ResponseHandler.error(res, error.message, 500);
    }
  }

  async setOfflineMode(req, res) {
    try {
      const { offline } = req.body;
      Logger.info(`[CONTROLLER] Setting offline mode: ${offline}`);

      return ResponseHandler.success(
        res,
        { offline: offline === true },
        `Modo ${offline ? "offline" : "online"} activado`,
      );
    } catch (error) {
      Logger.error("Error setting offline mode:", error);
      return ResponseHandler.error(res, error.message, 500);
    }
  }
}

module.exports = new OntologyController();
