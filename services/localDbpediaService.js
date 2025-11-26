const fs = require("fs").promises;
const path = require("path");
const fetch = require("node-fetch");
const Logger = require("../utils/logger");

class LocalDbpediaService {
  constructor() {
    this.cacheDir = path.join(__dirname, "..", "data", "dbpedia_cache");
    this.localDatasetPath = path.join(
      __dirname,
      "..",
      "data",
      "offline_dbpedia",
      "casino_games_dataset.json",
    );
    this.localDataset = null;
    this.endpoints = {
      en: "https://dbpedia.org/sparql",
      es: "http://es.dbpedia.org/sparql",
    };
    this.isOnline = true;
    this.cacheExpiry = 7 * 24 * 60 * 60 * 1000; // 7 días
    this.onlineTimeout = 8000; // 8 segundos timeout para consultas online
  }

  async init() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });

      await this.loadLocalDataset();

      Logger.info("Local DBpedia Service initialized successfully");
      Logger.info(
        `Local dataset contains ${this.localDataset?.entries?.length || 0} entries`,
      );
    } catch (error) {
      Logger.error("Error initializing Local DBpedia Service:", error);
      this.localDataset = { metadata: {}, entries: [] };
    }
  }

  async loadLocalDataset() {
    try {
      const data = await fs.readFile(this.localDatasetPath, "utf8");
      this.localDataset = JSON.parse(data);
      Logger.info(
        `Loaded local dataset with ${this.localDataset.entries.length} entries`,
      );
    } catch (error) {
      Logger.warn(
        "Could not load local dataset, creating empty one:",
        error.message,
      );
      this.localDataset = {
        metadata: {
          created: new Date().toISOString(),
          version: "1.0",
          description: "Empty local DBpedia dataset",
          total_entries: 0,
        },
        entries: [],
      };
    }
  }

  async searchWithFallback(searchTerm, options = {}) {
    const { preferOffline = false, language = "auto" } = options;

    try {
      Logger.info(`Searching for: "${searchTerm}"`);

      const localResults = await this.searchLocal(searchTerm);
      if (localResults.total > 0) {
        Logger.info(`Found ${localResults.total} results in local dataset`);
        return localResults;
      }

      const cacheResults = await this.searchFromCache(searchTerm);
      if (cacheResults.total > 0) {
        Logger.info(`Found ${cacheResults.total} results in cache`);
        return cacheResults;
      }

      try {
        const onlineResults = await this.searchOnlineWithTimeout(searchTerm);
        if (onlineResults.total > 0) {
          this.isOnline = true;
          await this.cacheResults(searchTerm, onlineResults);
          Logger.info(`Found ${onlineResults.total} results online`);
          return onlineResults;
        }
      } catch (error) {
        Logger.info(
          "Online search not available, using offline mode:",
          error.message,
        );
        this.isOnline = false;
      }

      Logger.info("No results found in any source");
      return this.getEmptyResult();
    } catch (error) {
      Logger.error("Search error:", error);
      return this.getEmptyResult();
    }
  }

  async searchLocal(searchTerm) {
    try {
      if (!this.localDataset || !this.localDataset.entries) {
        return this.getEmptyResult();
      }

      const term = searchTerm.toLowerCase().trim();
      const results = [];

      this.localDataset.entries.forEach((entry) => {
        const score = this.calculateLocalRelevance(entry, term);
        if (score > 0) {
          results.push({
            ...this.formatLocalEntry(entry),
            relevance: score,
            searchType: "local",
          });
        }
      });

      results.sort((a, b) => b.relevance - a.relevance);

      const english = results.filter((r) => r.language === "en");
      const spanish = results.filter((r) => r.language === "es");

      return {
        english,
        spanish,
        total: results.length,
        source: "local-dataset",
        timestamp: Date.now(),
      };
    } catch (error) {
      Logger.error("Error in local search:", error);
      return this.getEmptyResult();
    }
  }

  async searchOnlineWithTimeout(searchTerm) {
    const searchPromise = this.searchOnline(searchTerm);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Search timeout")), this.onlineTimeout);
    });

    return Promise.race([searchPromise, timeoutPromise]);
  }

  async searchOnline(searchTerm) {
    try {
      const [resultsEN, resultsES] = await Promise.allSettled([
        this.searchInLanguage(searchTerm, "en"),
        this.searchInLanguage(searchTerm, "es"),
      ]);

      const english = resultsEN.status === "fulfilled" ? resultsEN.value : [];
      const spanish = resultsES.status === "fulfilled" ? resultsES.value : [];

      return {
        english,
        spanish,
        total: english.length + spanish.length,
        source: "online",
        timestamp: Date.now(),
      };
    } catch (error) {
      Logger.error("Error in online search:", error);
      throw error;
    }
  }

  async searchInLanguage(searchTerm, lang = "en") {
    try {
      const endpoint = this.endpoints[lang];
      const query = this.buildSearchQuery(searchTerm, lang);
      const url = `${endpoint}?query=${encodeURIComponent(query)}&format=json&timeout=5000`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/sparql-results+json",
          "User-Agent": "SemanticSearchBot/1.0",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`DBpedia HTTP ${response.status}`);
      }

      const data = await response.json();
      const results = this.parseOnlineResults(data, lang);
      Logger.info(`Found ${results.length} results from ${lang} DBpedia`);
      return results;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("DBpedia timeout - no connection");
      }
      throw new Error(`DBpedia ${lang} unavailable: ${error.message}`);
    }
  }

  buildSearchQuery(searchTerm, lang) {
    const term = searchTerm.trim().toLowerCase();
    const langTag = lang === "es" ? "es" : "en";

    return `
      PREFIX dbo: <http://dbpedia.org/ontology/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>

      SELECT DISTINCT ?resource ?label ?abstract ?thumbnail ?comment
      WHERE {
        ?resource rdfs:label ?label .
        OPTIONAL { ?resource dbo:abstract ?abstract . }
        OPTIONAL { ?resource dbo:thumbnail ?thumbnail . }
        OPTIONAL { ?resource rdfs:comment ?comment . }

        FILTER (
          LANG(?label) = "${langTag}" &&
          (
            CONTAINS(LCASE(STR(?label)), "${term}") ||
            CONTAINS(LCASE(STR(?abstract)), "${term}")
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
      ORDER BY STRLEN(?label)
      LIMIT 10
    `.trim();
  }

  parseOnlineResults(data, lang) {
    if (!data || !data.results || !data.results.bindings) {
      return [];
    }

    const uniqueResults = new Map();

    data.results.bindings.forEach((binding) => {
      const uri = binding.resource?.value || "";

      if (uri && !uniqueResults.has(uri)) {
        const abstract = binding.abstract?.value || "";
        const comment = binding.comment?.value || "";

        uniqueResults.set(uri, {
          id: this.generateId(uri),
          uri: uri,
          label: binding.label?.value || "",
          abstract: abstract,
          comment: comment,
          description: abstract || comment || "",
          thumbnail: binding.thumbnail?.value || "",
          language: lang,
          source: "DBpedia",
          relevance: this.calculateOnlineRelevance(binding),
          preview: this.generatePreview(abstract || comment || ""),
          searchType: "remote",
        });
      }
    });

    return Array.from(uniqueResults.values()).sort(
      (a, b) => b.relevance - a.relevance,
    );
  }

  calculateLocalRelevance(entry, searchTerm) {
    let score = 0;
    const term = searchTerm.toLowerCase();

    if (entry.label && entry.label.toLowerCase().includes(term)) {
      score += 10;
      if (entry.label.toLowerCase().startsWith(term)) {
        score += 5;
      }
    }

    if (entry.abstract && entry.abstract.toLowerCase().includes(term)) {
      score += 3;
    }
    if (entry.description && entry.description.toLowerCase().includes(term)) {
      score += 2;
    }

    if (entry.properties) {
      Object.values(entry.properties).forEach((prop) => {
        if (Array.isArray(prop)) {
          prop.forEach((val) => {
            if (typeof val === "string" && val.toLowerCase().includes(term)) {
              score += 1;
            }
          });
        } else if (
          typeof prop === "string" &&
          prop.toLowerCase().includes(term)
        ) {
          score += 1;
        }
      });
    }

    if (entry.category && entry.category.toLowerCase().includes(term)) {
      score += 2;
    }

    return score;
  }

  calculateOnlineRelevance(binding) {
    let score = 1;
    if (binding.abstract?.value) score += 2;
    if (binding.thumbnail?.value) score += 1;
    if (binding.comment?.value) score += 1;
    return score;
  }

  formatLocalEntry(entry) {
    return {
      id: entry.id,
      uri: entry.uri,
      label: entry.label,
      abstract: entry.abstract || entry.description,
      description: entry.description,
      thumbnail: entry.thumbnail || "",
      comment: entry.comment || "",
      type: entry.type || "",
      category: entry.category || "",
      language: entry.language || "en",
      source: "Local Dataset",
      preview: this.generatePreview(entry.description || entry.abstract || ""),
      properties: entry.properties || {},
      external_links: entry.external_links || [],
    };
  }

  async searchFromCache(searchTerm) {
    try {
      const exactCache = await this.getExactCacheResults(searchTerm);
      if (exactCache && exactCache.total > 0) {
        exactCache.source = "cache-exact";
        return exactCache;
      }

      const similarCache = await this.searchSimilarInCache(searchTerm);
      if (similarCache && similarCache.total > 0) {
        similarCache.source = "cache-fuzzy";
        return similarCache;
      }

      return this.getEmptyResult();
    } catch (error) {
      Logger.error("Error searching cache:", error);
      return this.getEmptyResult();
    }
  }

  async getExactCacheResults(searchTerm) {
    try {
      const cacheKey = this.generateCacheKey(searchTerm);
      const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);

      const cacheData = await fs.readFile(cacheFile, "utf8");
      const parsed = JSON.parse(cacheData);

      if (Date.now() <= parsed.expiry) {
        return parsed.results;
      }

      await fs.unlink(cacheFile);
      return null;
    } catch (error) {
      return null;
    }
  }

  async searchSimilarInCache(searchTerm) {
    try {
      const files = await fs.readdir(this.cacheDir);
      const jsonFiles = files.filter((file) => file.endsWith(".json"));
      const allResults = [];

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.cacheDir, file);
          const cacheData = await fs.readFile(filePath, "utf8");
          const parsed = JSON.parse(cacheData);

          if (Date.now() <= parsed.expiry) {
            const filtered = this.filterCachedResults(
              parsed.results,
              searchTerm,
            );
            allResults.push(...filtered.english, ...filtered.spanish);
          }
        } catch (error) {
          try {
            await fs.unlink(path.join(this.cacheDir, file));
          } catch {}
        }
      }

      if (allResults.length === 0) {
        return this.getEmptyResult();
      }

      const scored = allResults.map((result) => ({
        ...result,
        relevance: this.calculateFuzzyRelevance(
          result,
          searchTerm.toLowerCase(),
        ),
      }));

      scored.sort((a, b) => b.relevance - a.relevance);

      return {
        english: scored.filter((r) => r.language === "en"),
        spanish: scored.filter((r) => r.language === "es"),
        total: scored.length,
        source: "cache-fuzzy",
        timestamp: Date.now(),
      };
    } catch (error) {
      Logger.error("Error in fuzzy cache search:", error);
      return this.getEmptyResult();
    }
  }

  filterCachedResults(results, searchTerm) {
    const term = searchTerm.toLowerCase();

    const filterFn = (result) => {
      return (
        (result.label && result.label.toLowerCase().includes(term)) ||
        (result.description &&
          result.description.toLowerCase().includes(term)) ||
        (result.abstract && result.abstract.toLowerCase().includes(term))
      );
    };

    return {
      english: results.english ? results.english.filter(filterFn) : [],
      spanish: results.spanish ? results.spanish.filter(filterFn) : [],
    };
  }

  calculateFuzzyRelevance(result, term) {
    let score = 0;
    const label = (result.label || "").toLowerCase();
    const description = (result.description || "").toLowerCase();

    if (label.includes(term)) score += 10;
    if (label.startsWith(term)) score += 5;
    if (description.includes(term)) score += 3;
    if (result.abstract && result.abstract.toLowerCase().includes(term))
      score += 2;

    return score;
  }

  async cacheResults(searchTerm, results) {
    try {
      const cacheKey = this.generateCacheKey(searchTerm);
      const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);

      const cacheData = {
        searchTerm,
        results,
        timestamp: Date.now(),
        expiry: Date.now() + this.cacheExpiry,
      };

      await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
      Logger.info(`Cached results for: ${searchTerm}`);
    } catch (error) {
      Logger.warn("Failed to cache results:", error);
    }
  }

  generateCacheKey(searchTerm) {
    return searchTerm
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  }

  generateId(uri) {
    return Buffer.from(uri)
      .toString("base64")
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 12);
  }

  generatePreview(text, maxLength = 150) {
    if (!text) return "";

    const cleaned = text.replace(/\n/g, " ").trim();
    if (cleaned.length <= maxLength) return cleaned;

    const truncated = cleaned.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");

    return (
      (lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated) + "..."
    );
  }

  getEmptyResult() {
    return {
      english: [],
      spanish: [],
      total: 0,
      source: "empty",
      timestamp: Date.now(),
    };
  }

  async getDetailedInfo(id, uri) {
    try {
      const localDetail = await this.getLocalDetail(id);
      if (localDetail) {
        return localDetail;
      }

      if (this.isOnline && uri) {
        try {
          const onlineDetail = await this.fetchOnlineDetail(uri);
          if (onlineDetail) {
            await this.cacheDetailedInfo(id, onlineDetail);
            return onlineDetail;
          }
        } catch (error) {
          Logger.warn("Online detail fetch failed:", error.message);
        }
      }

      const cacheDetail = await this.getDetailFromCache(id);
      if (cacheDetail) {
        return cacheDetail;
      }

      return null;
    } catch (error) {
      Logger.error("Error getting detailed info:", error);
      return null;
    }
  }

  async getLocalDetail(id) {
    if (!this.localDataset || !this.localDataset.entries) {
      return null;
    }

    const entry = this.localDataset.entries.find((e) => e.id === id);
    if (!entry) {
      return null;
    }

    return {
      uri: entry.uri,
      properties: entry.properties || {},
      description: entry.description || entry.abstract || "",
      external_links: entry.external_links || [],
      source: "local-detailed",
    };
  }

  async fetchOnlineDetail(uri) {
    return null;
  }

  async cacheDetailedInfo(id, detail) {
    try {
      const cacheFile = path.join(this.cacheDir, `detail_${id}.json`);
      const cacheData = {
        id,
        detail,
        timestamp: Date.now(),
        expiry: Date.now() + this.cacheExpiry,
      };

      await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      Logger.warn("Failed to cache detailed info:", error);
    }
  }

  async getDetailFromCache(id) {
    try {
      const cacheFile = path.join(this.cacheDir, `detail_${id}.json`);
      const cacheData = await fs.readFile(cacheFile, "utf8");
      const parsed = JSON.parse(cacheData);

      if (Date.now() <= parsed.expiry) {
        return parsed.detail;
      }

      await fs.unlink(cacheFile);
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
        if (file.endsWith(".json")) {
          try {
            const filePath = path.join(this.cacheDir, file);
            const content = await fs.readFile(filePath, "utf8");
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
      Logger.error("Error cleaning cache:", error);
    }
  }

  async reloadLocalDataset() {
    await this.loadLocalDataset();
  }

  getStats() {
    return {
      localEntries: this.localDataset ? this.localDataset.entries.length : 0,
      isOnline: this.isOnline,
      cacheDirectory: this.cacheDir,
      datasetPath: this.localDatasetPath,
    };
  }
}

const localDbpediaService = new LocalDbpediaService();
module.exports = localDbpediaService;
