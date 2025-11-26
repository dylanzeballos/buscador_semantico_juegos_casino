const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const Logger = require('../utils/logger');

class OfflineDbpediaService {
  constructor() {
    this.cacheDir = path.join(__dirname, '..', 'data', 'dbpedia_cache');
    this.endpoints = {
      en: 'https://dbpedia.org/sparql',
      es: 'http://es.dbpedia.org/sparql'
    };
    this.isOnline = true;
    this.cacheExpiry = 7 * 24 * 60 * 60 * 1000; // 7 días en milisegundos
  }

  async init() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      Logger.info('Cache directory initialized:', this.cacheDir);
    } catch (error) {
      Logger.error('Error creating cache directory:', error);
    }
  }

  async searchWithFallback(searchTerm) {
    try {
      Logger.info(`Searching for: ${searchTerm}`);

      if (this.isOnline) {
        try {
          const onlineResults = await this.searchOnline(searchTerm);
          await this.cacheResults(searchTerm, onlineResults);
          return onlineResults;
        } catch (error) {
          Logger.warn('Online search failed, falling back to cache:', error.message);
          this.isOnline = false;
        }
      }

      return await this.searchFromCache(searchTerm);

    } catch (error) {
      Logger.error('Complete search failure:', error);
      return this.getEmptyResult();
    }
  }

  async searchOnline(searchTerm) {
    const [resultsEN, resultsES] = await Promise.all([
      this.searchInLanguage(searchTerm, 'en'),
      this.searchInLanguage(searchTerm, 'es')
    ]);

    return {
      english: resultsEN,
      spanish: resultsES,
      total: resultsEN.length + resultsES.length,
      source: 'online',
      timestamp: Date.now()
    };
  }

  async searchInLanguage(searchTerm, lang = 'en') {
    try {
      const endpoint = this.endpoints[lang];
      const query = this.buildEnhancedSearchQuery(searchTerm, lang);

      const url = `${endpoint}?query=${encodeURIComponent(query)}&format=json`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/sparql-results+json',
          'User-Agent': 'CasinoSemanticSearch/1.0'
        },
        timeout: 15000
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseEnhancedResults(data, lang);
    } catch (error) {
      Logger.error(`Error in DBpedia search (${lang}):`, error.message);
      throw error;
    }
  }

  buildEnhancedSearchQuery(searchTerm, lang) {
    const term = searchTerm.trim().toLowerCase();
    const langTag = lang === 'es' ? 'es' : 'en';

    return `
      PREFIX dbo: <http://dbpedia.org/ontology/>
      PREFIX dbr: <http://dbpedia.org/resource/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX dct: <http://purl.org/dc/terms/>
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      PREFIX dbp: <http://dbpedia.org/property/>

      SELECT DISTINCT ?resource ?label ?abstract ?thumbnail ?comment ?type ?category
      WHERE {
        ?resource rdfs:label ?label .
        OPTIONAL { ?resource dbo:abstract ?abstract . }
        OPTIONAL { ?resource dbo:thumbnail ?thumbnail . }
        OPTIONAL { ?resource rdfs:comment ?comment . }
        OPTIONAL { ?resource rdf:type ?type . }
        OPTIONAL { ?resource dct:subject ?category . }

        FILTER (
          LANG(?label) = "${langTag}" &&
          (
            REGEX(LCASE(STR(?label)), "${term}", "i") ||
            CONTAINS(LCASE(STR(?label)), "${term}") ||
            REGEX(LCASE(STR(?abstract)), "${term}", "i")
          )
        )

        FILTER (
          STRSTARTS(STR(?resource), "http://dbpedia.org/resource/") ||
          STRSTARTS(STR(?resource), "http://es.dbpedia.org/resource/")
        )

        FILTER (
          LANG(?abstract) = "${langTag}" || !BOUND(?abstract)
        )

        FILTER (
          LANG(?comment) = "${langTag}" || !BOUND(?comment)
        )
      }
      ORDER BY STRLEN(?abstract)
      LIMIT 15
    `.trim();
  }

  parseEnhancedResults(data, lang) {
    if (!data || !data.results || !data.results.bindings) {
      return [];
    }

    const uniqueResults = new Map();

    data.results.bindings.forEach(binding => {
      const uri = binding.resource?.value || '';

      if (uri && !uniqueResults.has(uri)) {
        const abstract = binding.abstract?.value || '';
        const comment = binding.comment?.value || '';

        uniqueResults.set(uri, {
          id: this.generateId(uri),
          uri: uri,
          label: binding.label?.value || '',
          abstract: abstract,
          comment: comment,
          description: abstract || comment || '',
          thumbnail: binding.thumbnail?.value || '',
          type: binding.type?.value || '',
          category: binding.category?.value || '',
          language: lang,
          source: 'DBpedia',
          relevance: this.calculateRelevance(binding, lang),
          preview: this.generatePreview(abstract || comment || binding.label?.value || ''),
          slug: this.generateSlug(binding.label?.value || '')
        });
      }
    });

    return Array.from(uniqueResults.values())
      .sort((a, b) => b.relevance - a.relevance);
  }

  async cacheResults(searchTerm, results) {
    try {
      const cacheKey = this.generateCacheKey(searchTerm);
      const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);

      const cacheData = {
        searchTerm,
        results,
        timestamp: Date.now(),
        expiry: Date.now() + this.cacheExpiry
      };

      await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
      Logger.info(`Cached results for: ${searchTerm}`);
    } catch (error) {
      Logger.warn('Failed to cache results:', error);
    }
  }

  async searchFromCache(searchTerm) {
    try {
      const cacheKey = this.generateCacheKey(searchTerm);
      const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);

      const cacheData = await fs.readFile(cacheFile, 'utf8');
      const parsed = JSON.parse(cacheData);

      if (Date.now() > parsed.expiry) {
        Logger.info('Cache expired for:', searchTerm);
        return await this.searchSimilarInCache(searchTerm);
      }

      Logger.info(`Using cached results for: ${searchTerm}`);
      parsed.results.source = 'cache';
      return parsed.results;

    } catch (error) {
      Logger.info('No cache found, searching similar terms');
      return await this.searchSimilarInCache(searchTerm);
    }
  }

  async searchSimilarInCache(searchTerm) {
    try {
      const files = await fs.readdir(this.cacheDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));

      const allResults = [];

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.cacheDir, file);
          const cacheData = await fs.readFile(filePath, 'utf8');
          const parsed = JSON.parse(cacheData);

          if (Date.now() <= parsed.expiry) {
            const filtered = this.filterCachedResults(parsed.results, searchTerm);
            allResults.push(...filtered.english, ...filtered.spanish);
          }
        } catch (error) {
          Logger.warn(`Error reading cache file ${file}:`, error);
        }
      }

      const grouped = this.groupAndScoreResults(allResults, searchTerm);

      return {
        english: grouped.filter(r => r.language === 'en'),
        spanish: grouped.filter(r => r.language === 'es'),
        total: grouped.length,
        source: 'cache-fuzzy',
        timestamp: Date.now()
      };

    } catch (error) {
      Logger.error('Error searching cache:', error);
      return this.getEmptyResult();
    }
  }

  filterCachedResults(results, searchTerm) {
    const term = searchTerm.toLowerCase();

    const filterFn = (result) => {
      return result.label.toLowerCase().includes(term) ||
             result.description.toLowerCase().includes(term) ||
             result.abstract.toLowerCase().includes(term);
    };

    return {
      english: results.english ? results.english.filter(filterFn) : [],
      spanish: results.spanish ? results.spanish.filter(filterFn) : []
    };
  }

  groupAndScoreResults(results, searchTerm) {
    const term = searchTerm.toLowerCase();
    const scored = results.map(result => ({
      ...result,
      relevance: this.calculateFuzzyRelevance(result, term)
    }));

    return scored.sort((a, b) => b.relevance - a.relevance).slice(0, 20);
  }

  calculateFuzzyRelevance(result, term) {
    let score = 0;
    const label = result.label.toLowerCase();
    const description = result.description.toLowerCase();

    if (label.includes(term)) score += 10;
    if (label.startsWith(term)) score += 5;
    if (description.includes(term)) score += 3;
    if (result.abstract && result.abstract.toLowerCase().includes(term)) score += 2;

    return score;
  }

  generateCacheKey(searchTerm) {
    return searchTerm.toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  generateId(uri) {
    return Buffer.from(uri).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 12);
  }

  generateSlug(label) {
    return label.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  calculateRelevance(binding, lang) {
    let score = 1;

    if (binding.abstract?.value) score += 2;
    if (binding.thumbnail?.value) score += 1;
    if (binding.comment?.value) score += 1;
    if (binding.type?.value) score += 1;

    return score;
  }

  generatePreview(text, maxLength = 150) {
    if (!text) return '';

    const cleaned = text.replace(/\n/g, ' ').trim();
    if (cleaned.length <= maxLength) return cleaned;

    const truncated = cleaned.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    return (lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated) + '...';
  }

  async getDetailedInfo(uri, lang = 'en') {
    try {
      if (this.isOnline) {
        try {
          const detail = await this.fetchDetailedInfo(uri, lang);
          await this.cacheDetailedInfo(uri, detail);
          return detail;
        } catch (error) {
          Logger.warn('Online detail fetch failed, using cache');
        }
      }

      return await this.getDetailFromCache(uri);

    } catch (error) {
      Logger.error('Error getting detailed info:', error);
      return null;
    }
  }

  async fetchDetailedInfo(uri, lang) {
    const query = this.buildDetailQuery(uri, lang);
    const endpoint = this.endpoints[lang];

    const response = await fetch(`${endpoint}?query=${encodeURIComponent(query)}&format=json`, {
      timeout: 10000,
      headers: {
        'Accept': 'application/sparql-results+json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return this.parseDetailedInfo(data, uri);
  }

  buildDetailQuery(uri, lang) {
    const langTag = lang === 'es' ? 'es' : 'en';

    return `
      PREFIX dbo: <http://dbpedia.org/ontology/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      PREFIX dbp: <http://dbpedia.org/property/>

      SELECT ?property ?value WHERE {
        <${uri}> ?property ?value .
        FILTER (
          LANG(?value) = "${langTag}" ||
          !isLiteral(?value) ||
          LANG(?value) = ""
        )
      }
      LIMIT 50
    `;
  }

  parseDetailedInfo(data, uri) {
    if (!data || !data.results || !data.results.bindings) {
      return null;
    }

    const properties = {};
    data.results.bindings.forEach(binding => {
      const prop = binding.property?.value || '';
      const value = binding.value?.value || '';

      if (prop && value) {
        const propName = this.extractLocalName(prop);
        if (!properties[propName]) {
          properties[propName] = [];
        }
        properties[propName].push(value);
      }
    });

    return {
      uri,
      properties,
      source: 'dbpedia-detailed'
    };
  }

  extractLocalName(uri) {
    const parts = uri.split('#');
    if (parts.length > 1) return parts[1];
    const pathParts = uri.split('/');
    return pathParts[pathParts.length - 1];
  }

  getEmptyResult() {
    return {
      english: [],
      spanish: [],
      total: 0,
      source: 'empty',
      timestamp: Date.now()
    };
  }

  async cacheDetailedInfo(uri, detail) {
    try {
      const id = this.generateId(uri);
      const cacheFile = path.join(this.cacheDir, `detail_${id}.json`);

      const cacheData = {
        uri,
        detail,
        timestamp: Date.now(),
        expiry: Date.now() + this.cacheExpiry
      };

      await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      Logger.warn('Failed to cache detailed info:', error);
    }
  }

  async getDetailFromCache(uri) {
    try {
      const id = this.generateId(uri);
      const cacheFile = path.join(this.cacheDir, `detail_${id}.json`);

      const cacheData = await fs.readFile(cacheFile, 'utf8');
      const parsed = JSON.parse(cacheData);

      if (Date.now() <= parsed.expiry) {
        return parsed.detail;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  async cleanExpiredCache() {
    try {
      const files = await fs.readdir(this.cacheDir);
      const now = Date.now();
      let cleaned = 0;

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(this.cacheDir, file);
            const content = await fs.readFile(filePath, 'utf8');
            const data = JSON.parse(content);

            if (data.expiry && now > data.expiry) {
              await fs.unlink(filePath);
              cleaned++;
            }
          } catch (error) {
            await fs.unlink(path.join(this.cacheDir, file));
            cleaned++;
          }
        }
      }

      if (cleaned > 0) {
        Logger.info(`Cleaned ${cleaned} expired cache files`);
      }
    } catch (error) {
      Logger.error('Error cleaning cache:', error);
    }
  }
}

const offlineDbpediaService = new OfflineDbpediaService();
module.exports = offlineDbpediaService;
