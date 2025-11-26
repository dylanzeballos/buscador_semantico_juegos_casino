const $rdf = require("rdflib");
const fs = require("fs");
const path = require("path");
const Logger = require("../utils/logger");
const { OWL_FILE_PATH, ONTOLOGY_NAMESPACE } = require("../config/constants");
const nlpService = require("./nlpService");

class OntologyService {
  constructor() {
    this.store = $rdf.graph();
    this.namespace = $rdf.Namespace(ONTOLOGY_NAMESPACE);
    this.rdf = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
    this.rdfs = $rdf.Namespace("http://www.w3.org/2000/01/rdf-schema#");
    this.owl = $rdf.Namespace("http://www.w3.org/2002/07/owl#");
    this.loaded = false;
  }

  async loadOntology() {
    try {
      const filePath = path.join(__dirname, "..", OWL_FILE_PATH);
      Logger.info("Cargando ontología desde:", filePath);

      if (!fs.existsSync(filePath)) {
        throw new Error(`Archivo OWL no encontrado en: ${filePath}`);
      }

      const owlContent = fs.readFileSync(filePath, "utf8");
      Logger.info(`Archivo OWL leído: ${owlContent.length} caracteres`);

      const mimeType = "application/rdf+xml";
      const baseURI = ONTOLOGY_NAMESPACE;

      this.store = $rdf.graph();

      await $rdf.parse(owlContent, this.store, baseURI, mimeType);
      this.loaded = true;

      Logger.info("Ontología cargada exitosamente");
      Logger.info(`Total de statements: ${this.store.statements.length}`);

      return true;
    } catch (error) {
      Logger.error("Error al cargar la ontología:", error);
      this.loaded = false;
      throw error;
    }
  }

  getClasses() {
    try {
      if (!this.loaded) {
        throw new Error(
          "Ontología no cargada. Llame a loadOntology() primero.",
        );
      }

      const classes = this.store.each(
        null,
        this.rdf("type"),
        this.owl("Class"),
      );

      Logger.info(`Clases encontradas en el store: ${classes.length}`);

      const result = classes.map((cls) => ({
        uri: cls.value,
        name: this.extractLocalName(cls.value),
        label: this.getLabel(cls),
      }));

      return result;
    } catch (error) {
      Logger.error("Error al obtener clases:", error);
      throw error;
    }
  }

  getInstancesOfClass(className) {
    try {
      if (!this.loaded) {
        throw new Error("Ontología no cargada");
      }

      const classURI = this.namespace(className);
      const instances = this.store.each(null, this.rdf("type"), classURI);

      return instances.map((instance) => ({
        uri: instance.value,
        name: this.extractLocalName(instance.value),
        properties: this.getPropertiesOfInstance(instance),
      }));
    } catch (error) {
      Logger.error("Error al obtener instancias:", error);
      throw error;
    }
  }

  getPropertiesOfInstance(instance) {
    const properties = {};
    const statements = this.store.statementsMatching(instance, null, null);

    statements.forEach((statement) => {
      const predicate = this.extractLocalName(statement.predicate.value);
      const object = statement.object.value;

      if (predicate !== "type") {
        properties[predicate] = object;
      }
    });

    return properties;
  }

  searchByText(searchText) {
    try {
      if (!this.loaded) {
        throw new Error("Ontología no cargada");
      }

      const nlpResult = nlpService.processQuery(searchText);
      Logger.info(
        `NLP procesado - Términos: ${nlpResult.searchTerms.join(", ")}`,
      );
      Logger.info(`Intención detectada: ${nlpResult.intent}`);

      const allStatements = this.store.statements;
      const results = new Map();

      const searchTerms = nlpResult.searchTerms.map((term) =>
        term.toLowerCase(),
      );

      Logger.info(
        `Buscando con ${searchTerms.length} términos en ${allStatements.length} statements`,
      );

      allStatements.forEach((statement) => {
        const subject = statement.subject;
        const predicate = statement.predicate.value;
        const object = statement.object;

        if (
          statement.predicate.value.includes("type") &&
          statement.subject.value.includes("#") &&
          !this.isTechnicalProperty(statement.subject.value)
        ) {
          const uri = statement.subject.value;
          const name = this.extractLocalName(uri);
          const nameLower = name.toLowerCase();

          const hasMatch = searchTerms.some((term) => nameLower.includes(term));

          if (hasMatch && this.isRelevantConcept(name)) {
            if (!results.has(uri)) {
              results.set(uri, {
                uri,
                name,
                properties: {},
                relevance: this.calculateConceptRelevance(name, searchTerms),
              });
            }
          }
        }

        if (
          subject.value.includes("#") &&
          this.isDescriptiveProperty(predicate) &&
          object.value &&
          typeof object.value === "string"
        ) {
          const objectLower = object.value.toLowerCase();
          const hasMatch = searchTerms.some((term) =>
            objectLower.includes(term),
          );

          if (hasMatch) {
            const uri = subject.value;
            if (
              !results.has(uri) &&
              this.isRelevantConcept(this.extractLocalName(uri))
            ) {
              results.set(uri, {
                uri,
                name: this.extractLocalName(uri),
                properties: {},
                relevance: 1,
              });
            } else if (results.has(uri)) {
              results.get(uri).relevance += 1;
            }
          }
        }
      });

      const finalResults = Array.from(results.values())
        .filter((result) => this.isRelevantForDisplay(result))
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 10) // Limitar a los 10 más relevantes
        .map((result) =>
          this.formatAsGoogleStyle(result, nlpResult, searchText),
        );

      Logger.info(
        `Se encontraron ${finalResults.length} resultados relevantes para: "${searchText}"`,
      );

      return finalResults;
    } catch (error) {
      Logger.error("Error en la búsqueda:", error);
      throw error;
    }
  }

  isTechnicalProperty(uri) {
    const name = this.extractLocalName(uri).toLowerCase();
    const technicalTerms = [
      "property",
      "relation",
      "attribute",
      "field",
      "column",
      "datatype",
    ];
    return technicalTerms.some((term) => name.includes(term));
  }

  isDescriptiveProperty(predicate) {
    const propName = predicate.toLowerCase();
    const descriptiveProps = [
      "descripcion",
      "description",
      "definicion",
      "definition",
      "reglas",
      "rules",
      "objetivo",
      "objective",
      "caracteristicas",
      "ventajas",
      "desventajas",
      "probabilidad",
      "estrategia",
    ];
    return descriptiveProps.some((prop) => propName.includes(prop));
  }

  isRelevantConcept(name) {
    const nameLower = name.toLowerCase();
    const irrelevantTerms = [
      "thing",
      "resource",
      "namedindividual",
      "individual",
    ];
    return (
      !irrelevantTerms.some((term) => nameLower.includes(term)) &&
      name.length > 2
    );
  }

  calculateConceptRelevance(name, searchTerms) {
    let score = 1;
    const nameLower = name.toLowerCase();

    searchTerms.forEach((term) => {
      if (nameLower === term)
        score += 10; // Coincidencia exacta
      else if (nameLower.includes(term))
        score += 5; // Coincidencia parcial
      else if (term.includes(nameLower)) score += 3; // Término incluye el nombre
    });

    return score;
  }

  isRelevantForDisplay(result) {
    return result.relevance > 1 && result.name && result.name.length > 2;
  }

  formatAsGoogleStyle(result, nlpResult, originalQuery) {
    const properties = this.getPropertiesOfInstance($rdf.sym(result.uri));
    const smartDescription = this.generateSmartDescription(
      properties,
      result.name,
      originalQuery,
    );
    const contextualInfo = this.generateContextualInfo(
      properties,
      originalQuery,
    );

    const contextualAnswer =
      nlpResult.contextualAnswer || contextualInfo.answer;

    return {
      id: this.generateId(result.uri),
      uri: result.uri,
      label: this.formatDisplayName(result.name),
      name: this.formatDisplayName(result.name),
      abstract: smartDescription.main,
      description: smartDescription.full,
      comment: contextualInfo.context,
      thumbnail: properties.imagen || properties.image || "",
      type: this.getDisplayCategory(result.uri, properties),
      category: this.getDisplayCategory(result.uri, properties),
      properties: this.filterRelevantProperties(properties),
      language: "es",
      source: "Base de Conocimiento de Casinos",
      relevance: result.relevance,
      preview: smartDescription.preview,
      slug: this.generateSlug(result.name),
      displaySource: "Ontología Local",
      resultType: "local",
      contextualAnswer: contextualAnswer,
      nlpInfo: {
        originalQuery: nlpResult.original,
        detectedLanguage: nlpResult.language,
        intent: nlpResult.intent,
        keywords: nlpResult.keywords,
        relevanceScore: result.relevance,
        hasNLPAnswer: !!nlpResult.contextualAnswer,
      },
    };
  }

  formatDisplayName(name) {
    return name
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  generateSmartDescription(properties, name, query) {
    const queryLower = query.toLowerCase();
    const nameLower = name.toLowerCase();

    const directDesc = this.findDirectDescription(properties);
    if (directDesc) {
      return {
        main: directDesc.substring(0, 160),
        full: directDesc,
        preview:
          directDesc.substring(0, 120) + (directDesc.length > 120 ? "..." : ""),
      };
    }

    let description = this.generateContextualDescription(
      name,
      properties,
      query,
    );

    return {
      main: description.substring(0, 160),
      full: description,
      preview:
        description.substring(0, 120) + (description.length > 120 ? "..." : ""),
    };
  }

  findDirectDescription(properties) {
    const descProps = [
      "descripcion",
      "description",
      "definicion",
      "definition",
      "resumen",
      "abstract",
      "explicacion",
      "concepto",
    ];

    for (const prop of descProps) {
      if (
        properties[prop] &&
        typeof properties[prop] === "string" &&
        properties[prop].length > 10
      ) {
        return properties[prop];
      }
    }
    return null;
  }

  generateContextualDescription(name, properties, query) {
    const nameLower = name.toLowerCase();
    const queryLower = query.toLowerCase();

    if (
      queryLower.includes("probabilidad") ||
      queryLower.includes("ganar") ||
      queryLower.includes("ventaja")
    ) {
      return this.generateProbabilityDescription(name, properties);
    } else if (
      queryLower.includes("reglas") ||
      queryLower.includes("como") ||
      queryLower.includes("jugar")
    ) {
      return this.generateRulesDescription(name, properties);
    } else if (
      queryLower.includes("estrategia") ||
      queryLower.includes("estrategias")
    ) {
      return this.generateStrategyDescription(name, properties);
    } else {
      return this.generateGeneralDescription(name, properties);
    }
  }

  generateProbabilityDescription(name, properties) {
    const displayName = this.formatDisplayName(name);
    let desc = `${displayName} es un juego de casino`;

    if (properties.probabilidadCasa || properties.ventajaCasa) {
      const ventaja = properties.probabilidadCasa || properties.ventajaCasa;
      desc += ` con una ventaja de la casa de aproximadamente ${ventaja}`;
    } else if (name.toLowerCase().includes("blackjack")) {
      desc += ` con una de las ventajas de casa más bajas (alrededor del 0.5% con estrategia básica)`;
    } else if (name.toLowerCase().includes("ruleta")) {
      desc += ` con una ventaja de casa del 2.7% en la ruleta europea y 5.26% en la americana`;
    } else if (name.toLowerCase().includes("poker")) {
      desc += ` donde la habilidad del jugador puede influir significativamente en los resultados`;
    }

    desc += ". " + this.addGameplayInfo(name, properties);
    return desc;
  }

  generateRulesDescription(name, properties) {
    const displayName = this.formatDisplayName(name);
    let desc = `${displayName} es un juego de casino donde `;

    if (properties.reglas || properties.rules) {
      desc += properties.reglas || properties.rules;
    } else if (properties.objetivo || properties.objective) {
      desc += `el objetivo es ${properties.objetivo || properties.objective}`;
    } else {
      desc += this.getDefaultRules(name);
    }

    return desc + ". " + this.addPlayerInfo(name, properties);
  }

  generateStrategyDescription(name, properties) {
    const displayName = this.formatDisplayName(name);
    let desc = `Para ${displayName}, `;

    if (properties.estrategia || properties.strategy) {
      desc += properties.estrategia || properties.strategy;
    } else {
      desc += this.getDefaultStrategy(name);
    }

    return desc + ". " + this.addSkillInfo(name, properties);
  }

  generateGeneralDescription(name, properties) {
    const displayName = this.formatDisplayName(name);
    let desc = `${displayName} es `;

    if (properties.tipo || properties.type) {
      desc += `un ${properties.tipo || properties.type} de casino`;
    } else {
      desc += "un popular juego de casino";
    }

    if (properties.jugadores || properties.players) {
      desc += ` para ${properties.jugadores || properties.players} jugadores`;
    }

    if (properties.duracion || properties.duration) {
      desc += ` con una duración típica de ${properties.duracion || properties.duration}`;
    }

    desc += ". " + this.addGeneralInfo(name, properties);
    return desc;
  }

  /**
   * Métodos auxiliares para generar información contextual
   */
  getDefaultRules(name) {
    const nameLower = name.toLowerCase();
    if (nameLower.includes("blackjack")) {
      return "el objetivo es acercarse lo más posible a 21 puntos sin pasarse";
    } else if (nameLower.includes("poker")) {
      return "se busca formar la mejor combinación de cartas posible";
    } else if (nameLower.includes("ruleta")) {
      return "se apuesta en qué número o color caerá la bola";
    }
    return "se siguen reglas específicas del juego";
  }

  getDefaultStrategy(name) {
    const nameLower = name.toLowerCase();
    if (nameLower.includes("blackjack")) {
      return "es fundamental conocer la estrategia básica para minimizar la ventaja de la casa";
    } else if (nameLower.includes("poker")) {
      return "la habilidad, el conocimiento de probabilidades y la lectura de oponentes son clave";
    } else if (nameLower.includes("ruleta")) {
      return "es un juego de azar puro, aunque algunas estrategias de apuestas pueden gestionar el bankroll";
    }
    return "existen diferentes estrategias que pueden mejorar las posibilidades de éxito";
  }

  addGameplayInfo(name, properties) {
    if (properties.jugadores) {
      return `Se juega con ${properties.jugadores} jugadores`;
    }
    return "Es un juego emocionante y popular en casinos";
  }

  addPlayerInfo(name, properties) {
    if (properties.dificultad) {
      return `Tiene una dificultad ${properties.dificultad}`;
    }
    return "Es accesible para jugadores de diferentes niveles";
  }

  addSkillInfo(name, properties) {
    const nameLower = name.toLowerCase();
    if (nameLower.includes("poker")) {
      return "La habilidad y experiencia del jugador son factores determinantes";
    } else if (nameLower.includes("blackjack")) {
      return "Con la estrategia correcta, se puede reducir significativamente la ventaja de la casa";
    }
    return "La práctica y el conocimiento pueden mejorar los resultados";
  }

  addGeneralInfo(name, properties) {
    if (properties.origen) {
      return `Tiene su origen en ${properties.origen}`;
    }
    return "Es uno de los juegos más populares en casinos alrededor del mundo";
  }

  generateContextualInfo(properties, query) {
    const queryLower = query.toLowerCase();
    let context = "";
    let answer = "";

    if (queryLower.includes("probabilidad") || queryLower.includes("ganar")) {
      context = "Información sobre probabilidades y ventajas de casa";
      answer = this.generateProbabilityAnswer(properties);
    } else if (
      queryLower.includes("reglas") ||
      queryLower.includes("como jugar")
    ) {
      context = "Reglas y mecánica del juego";
      answer = this.generateRulesAnswer(properties);
    } else {
      context = "Información general del juego";
      answer = "Consulta nuestra base de conocimiento para más detalles";
    }

    return { context, answer };
  }

  filterRelevantProperties(properties) {
    const relevant = {};
    const importantKeys = [
      "tipo",
      "categoria",
      "jugadores",
      "duracion",
      "dificultad",
      "objetivo",
      "reglas",
      "estrategia",
      "probabilidadCasa",
      "ventajaCasa",
    ];

    importantKeys.forEach((key) => {
      if (properties[key]) {
        relevant[key] = properties[key];
      }
    });

    return relevant;
  }

  getDisplayCategory(uri, properties) {
    if (properties.categoria) return properties.categoria;
    if (properties.tipo) return properties.tipo;

    const name = this.extractLocalName(uri).toLowerCase();
    if (name.includes("card") || name.includes("carta"))
      return "Juego de Cartas";
    if (name.includes("dice") || name.includes("dado")) return "Juego de Dados";
    if (name.includes("wheel") || name.includes("ruleta"))
      return "Juego de Mesa";

    return "Juego de Casino";
  }

  generateProbabilityAnswer(properties) {
    if (properties.probabilidadCasa || properties.ventajaCasa) {
      return `La ventaja de la casa es del ${properties.probabilidadCasa || properties.ventajaCasa}`;
    }
    return "Las probabilidades varían según el tipo de apuesta y estrategia utilizada";
  }

  generateRulesAnswer(properties) {
    if (properties.reglas) {
      return properties.reglas;
    }
    if (properties.objetivo) {
      return `El objetivo del juego es: ${properties.objetivo}`;
    }
    return "Consulta las reglas específicas para este juego";
  }

  formatPropertyName(prop) {
    const translations = {
      tipo: "Tipo",
      type: "Tipo",
      categoria: "Categoría",
      category: "Categoría",
      reglas: "Reglas",
      rules: "Reglas",
      jugadores: "Jugadores",
      players: "Jugadores",
      duracion: "Duración",
      duration: "Duración",
      dificultad: "Dificultad",
      difficulty: "Dificultad",
      objetivo: "Objetivo",
      objective: "Objetivo",
      origen: "Origen",
      origin: "Origen",
    };

    return (
      translations[prop.toLowerCase()] ||
      prop.charAt(0).toUpperCase() + prop.slice(1)
    );
  }

  getCategory(uri) {
    try {
      const typeStatements = this.store.statementsMatching(
        $rdf.sym(uri),
        this.rdf("type"),
        null,
      );

      if (typeStatements.length > 0) {
        const typeUri = typeStatements[0].object.value;
        return this.extractLocalName(typeUri);
      }

      return "General";
    } catch (error) {
      return "General";
    }
  }

  generateId(uri) {
    return Buffer.from(uri)
      .toString("base64")
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 12);
  }

  generateSlug(label) {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
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

  getProperties() {
    try {
      if (!this.loaded) {
        throw new Error("Ontología no cargada");
      }

      const objectProperties = this.store.each(
        null,
        this.rdf("type"),
        this.owl("ObjectProperty"),
      );

      const datatypeProperties = this.store.each(
        null,
        this.rdf("type"),
        this.owl("DatatypeProperty"),
      );

      const allProperties = [...objectProperties, ...datatypeProperties];

      return allProperties.map((prop) => ({
        uri: prop.value,
        name: this.extractLocalName(prop.value),
        label: this.getLabel(prop),
        domain: this.getDomain(prop),
        range: this.getRange(prop),
      }));
    } catch (error) {
      Logger.error("Error al obtener propiedades:", error);
      throw error;
    }
  }

  extractLocalName(uri) {
    if (!uri) return "";
    const parts = uri.split("#");
    if (parts.length > 1) return parts[1];
    const pathParts = uri.split("/");
    return pathParts[pathParts.length - 1];
  }

  getLabel(resource) {
    const label = this.store.any(resource, this.rdfs("label"), null);
    return label ? label.value : this.extractLocalName(resource.value);
  }

  getDomain(property) {
    const domain = this.store.any(property, this.rdfs("domain"), null);
    return domain ? this.extractLocalName(domain.value) : null;
  }

  getRange(property) {
    const range = this.store.any(property, this.rdfs("range"), null);
    return range ? this.extractLocalName(range.value) : null;
  }

  getOntologyStats() {
    try {
      if (!this.loaded) {
        throw new Error("Ontología no cargada");
      }

      const classes = this.getClasses();
      const properties = this.getProperties();
      const totalStatements = this.store.statements.length;

      return {
        totalClasses: classes.length,
        totalProperties: properties.length,
        totalStatements,
        classes: classes.map((c) => c.name),
        properties: properties.map((p) => p.name),
      };
    } catch (error) {
      Logger.error("Error al obtener estadísticas:", error);
      throw error;
    }
  }
}

const ontologyService = new OntologyService();

module.exports = ontologyService;
