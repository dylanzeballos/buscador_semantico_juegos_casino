const fetch = require('node-fetch');
const Logger = require('../utils/logger');


class DBpediaService {
  constructor() {
    this.endpoints = {
      en: 'https://dbpedia.org/sparql',
      es: 'http://es.dbpedia.org/sparql'
    };
  }

  /**
   * Busca información en DBpedia (inglés y español)
   * @param {string} searchTerm - Término de búsqueda
   * @returns {Promise<Object>} Resultados combinados de ambos idiomas
   */
  async searchDBpedia(searchTerm) {
    try {
      Logger.info(`Buscando en DBpedia: ${searchTerm}`);
      
      const [resultsEN, resultsES] = await Promise.all([
        this.searchInLanguage(searchTerm, 'en'),
        this.searchInLanguage(searchTerm, 'es')
      ]);

      return {
        english: resultsEN,
        spanish: resultsES,
        total: resultsEN.length + resultsES.length
      };
    } catch (error) {
      Logger.error('Error al buscar en DBpedia:', error);
      return {
        english: [],
        spanish: [],
        total: 0,
        error: error.message
      };
    }
  }

  /**
   * Busca en DBpedia en un idioma específico
   * @param {string} searchTerm - Término de búsqueda
   * @param {string} lang - Idioma ('en' o 'es')
   * @returns {Promise<Array>} Resultados de la búsqueda
   */
  async searchInLanguage(searchTerm, lang = 'en') {
    try {
      const endpoint = this.endpoints[lang];
      const query = this.buildSearchQuery(searchTerm, lang);
      
      const url = `${endpoint}?query=${encodeURIComponent(query)}&format=json`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/sparql-results+json'
        },
        timeout: 10000 // 10 segundos timeout
      });

      if (!response.ok) {
        Logger.warn(`DBpedia ${lang} respondió con status: ${response.status}`);
        return [];
      }

      const data = await response.json();
      return this.parseResults(data, lang);
    } catch (error) {
      Logger.error(`Error en DBpedia (${lang}):`, error.message);
      return [];
    }
  }

  /**
   * Construye la query SPARQL para buscar
   * @param {string} searchTerm - Término de búsqueda
   * @param {string} lang - Idioma
   * @returns {string} Query SPARQL
   */
  buildSearchQuery(searchTerm, lang) {
    const term = searchTerm.trim().toLowerCase();
    const langTag = lang === 'es' ? 'es' : 'en';
    
    return `
      PREFIX dbo: <http://dbpedia.org/ontology/>
      PREFIX dbr: <http://dbpedia.org/resource/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX dct: <http://purl.org/dc/terms/>
      
      SELECT DISTINCT ?resource ?label ?abstract ?type
      WHERE {
        ?resource rdfs:label ?label .
        OPTIONAL { ?resource dbo:abstract ?abstract . }
        OPTIONAL { ?resource rdf:type ?type . }
        
        FILTER (
          LANG(?label) = "${langTag}" &&
          (
            REGEX(LCASE(STR(?label)), "${term}", "i") ||
            CONTAINS(LCASE(STR(?label)), "${term}")
          )
        )
        
        FILTER (
          STRSTARTS(STR(?resource), "http://dbpedia.org/resource/") ||
          STRSTARTS(STR(?resource), "http://es.dbpedia.org/resource/")
        )
        
        FILTER (
          LANG(?abstract) = "${langTag}" || !BOUND(?abstract)
        )
      }
      LIMIT 10
    `.trim();
  }

  /**
   * Parsea los resultados de DBpedia
   * @param {Object} data - Datos de la respuesta SPARQL
   * @param {string} lang - Idioma
   * @returns {Array} Resultados parseados
   */
  parseResults(data, lang) {
    if (!data || !data.results || !data.results.bindings) {
      return [];
    }

    const uniqueResults = new Map();
    
    data.results.bindings.forEach(binding => {
      const uri = binding.resource?.value || '';
      
      if (uri && !uniqueResults.has(uri)) {
        uniqueResults.set(uri, {
          uri: uri,
          label: binding.label?.value || '',
          abstract: binding.abstract?.value || '',
          type: binding.type?.value || '',
          language: lang,
          source: 'DBpedia'
        });
      }
    });

    return Array.from(uniqueResults.values());
  }

  /**
   * Busca información específica de juegos de casino
   * @param {string} gameName - Nombre del juego
   * @returns {Promise<Object>} Información del juego
   */
  async searchCasinoGame(gameName) {
    try {
      const queries = {
        en: this.buildCasinoGameQuery(gameName, 'en'),
        es: this.buildCasinoGameQuery(gameName, 'es')
      };

      const [resultsEN, resultsES] = await Promise.all([
        this.executeQuery(queries.en, 'en'),
        this.executeQuery(queries.es, 'es')
      ]);

      return {
        english: resultsEN,
        spanish: resultsES,
        found: resultsEN.length > 0 || resultsES.length > 0
      };
    } catch (error) {
      Logger.error('Error buscando juego de casino en DBpedia:', error);
      return {
        english: [],
        spanish: [],
        found: false,
        error: error.message
      };
    }
  }

  /**
   * Construye query específica para juegos de casino
   * @param {string} gameName - Nombre del juego
   * @param {string} lang - Idioma
   * @returns {string} Query SPARQL
   */
  buildCasinoGameQuery(gameName, lang) {
    const langTag = lang === 'es' ? 'es' : 'en';
    const term = gameName.trim().toLowerCase();
    
    return `
      PREFIX dbo: <http://dbpedia.org/ontology/>
      PREFIX dbr: <http://dbpedia.org/resource/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX dct: <http://purl.org/dc/terms/>
      
      SELECT DISTINCT ?resource ?label ?abstract ?thumbnail ?origin
      WHERE {
        ?resource rdfs:label ?label .
        OPTIONAL { ?resource dbo:abstract ?abstract . }
        OPTIONAL { ?resource dbo:thumbnail ?thumbnail . }
        OPTIONAL { ?resource dbo:origin ?origin . }
        
        FILTER (
          LANG(?label) = "${langTag}" &&
          REGEX(LCASE(STR(?label)), "${term}", "i")
        )
        
        FILTER (
          LANG(?abstract) = "${langTag}" || !BOUND(?abstract)
        )
        
        # Filtrar recursos relacionados con juegos/casinos
        FILTER (
          REGEX(STR(?resource), "game", "i") ||
          REGEX(STR(?resource), "casino", "i") ||
          REGEX(STR(?resource), "card", "i") ||
          REGEX(STR(?resource), "gambling", "i")
        )
      }
      LIMIT 5
    `.trim();
  }

  /**
   * Ejecuta una query SPARQL
   * @param {string} query - Query SPARQL
   * @param {string} lang - Idioma
   * @returns {Promise<Array>} Resultados
   */
  async executeQuery(query, lang) {
    try {
      const endpoint = this.endpoints[lang];
      const url = `${endpoint}?query=${encodeURIComponent(query)}&format=json`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/sparql-results+json'
        },
        timeout: 10000
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return this.parseGameResults(data, lang);
    } catch (error) {
      Logger.error(`Error ejecutando query en DBpedia (${lang}):`, error);
      return [];
    }
  }

  /**
   * Parsea resultados de juegos
   * @param {Object} data - Datos SPARQL
   * @param {string} lang - Idioma
   * @returns {Array} Resultados parseados
   */
  parseGameResults(data, lang) {
    if (!data || !data.results || !data.results.bindings) {
      return [];
    }

    const uniqueResults = new Map();
    
    data.results.bindings.forEach(binding => {
      const uri = binding.resource?.value || '';
      
      if (uri && !uniqueResults.has(uri)) {
        uniqueResults.set(uri, {
          uri: uri,
          label: binding.label?.value || '',
          abstract: binding.abstract?.value || '',
          thumbnail: binding.thumbnail?.value || '',
          origin: binding.origin?.value || '',
          language: lang,
          source: 'DBpedia'
        });
      }
    });

    return Array.from(uniqueResults.values());
  }
}

const dbpediaService = new DBpediaService();

module.exports = dbpediaService;
