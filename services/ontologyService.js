const $rdf = require('rdflib');
const fs = require('fs');
const path = require('path');
const Logger = require('../utils/logger');
const { OWL_FILE_PATH, ONTOLOGY_NAMESPACE } = require('../config/constants');


class OntologyService {
  constructor() {
    this.store = $rdf.graph();
    this.namespace = $rdf.Namespace(ONTOLOGY_NAMESPACE);
    this.rdf = $rdf.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
    this.rdfs = $rdf.Namespace('http://www.w3.org/2000/01/rdf-schema#');
    this.owl = $rdf.Namespace('http://www.w3.org/2002/07/owl#');
    this.loaded = false;
  }

  async loadOntology() {
    try {
      const filePath = path.join(__dirname, '..', OWL_FILE_PATH);
      Logger.info('Cargando ontología desde:', filePath);

      if (!fs.existsSync(filePath)) {
        throw new Error(`Archivo OWL no encontrado en: ${filePath}`);
      }

      const owlContent = fs.readFileSync(filePath, 'utf8');
      Logger.info(`Archivo OWL leído: ${owlContent.length} caracteres`);
      
      const mimeType = 'application/rdf+xml';
      const baseURI = ONTOLOGY_NAMESPACE;

      this.store = $rdf.graph();
      
      await $rdf.parse(owlContent, this.store, baseURI, mimeType);
      this.loaded = true;
      
      Logger.info('Ontología cargada exitosamente');
      Logger.info(`Total de statements: ${this.store.statements.length}`);

      return true;
    } catch (error) {
      Logger.error('Error al cargar la ontología:', error);
      this.loaded = false;
      throw error;
    }
  }

  getClasses() {
    try {
      if (!this.loaded) {
        throw new Error('Ontología no cargada. Llame a loadOntology() primero.');
      }

      const classes = this.store.each(
        null,
        this.rdf('type'),
        this.owl('Class')
      );

      Logger.info(`Clases encontradas en el store: ${classes.length}`);
      
      const result = classes.map(cls => ({
        uri: cls.value,
        name: this.extractLocalName(cls.value),
        label: this.getLabel(cls)
      }));
      
      return result;
    } catch (error) {
      Logger.error('Error al obtener clases:', error);
      throw error;
    }
  }

  getInstancesOfClass(className) {
    try {
      if (!this.loaded) {
        throw new Error('Ontología no cargada');
      }

      const classURI = this.namespace(className);
      const instances = this.store.each(
        null,
        this.rdf('type'),
        classURI
      );

      return instances.map(instance => ({
        uri: instance.value,
        name: this.extractLocalName(instance.value),
        properties: this.getPropertiesOfInstance(instance)
      }));
    } catch (error) {
      Logger.error('Error al obtener instancias:', error);
      throw error;
    }
  }

  getPropertiesOfInstance(instance) {
    const properties = {};
    const statements = this.store.statementsMatching(instance, null, null);

    statements.forEach(statement => {
      const predicate = this.extractLocalName(statement.predicate.value);
      const object = statement.object.value;

      if (predicate !== 'type') {
        properties[predicate] = object;
      }
    });

    return properties;
  }

  searchByText(searchText) {
    try {
      if (!this.loaded) {
        throw new Error('Ontología no cargada');
      }

      const allStatements = this.store.statements;
      const results = new Map();
      const searchLower = searchText.toLowerCase();

      Logger.info(`Buscando: "${searchText}" en ${allStatements.length} statements`);

      allStatements.forEach(statement => {
        const subject = statement.subject;
        const predicate = statement.predicate.value;
        const object = statement.object;

        if (subject.value.includes('#') && 
            !predicate.includes('type') &&
            object.value &&
            typeof object.value === 'string') {
          
          const objectLower = object.value.toLowerCase();
          
          if (objectLower.includes(searchLower)) {
            const uri = subject.value;
            if (!results.has(uri)) {
              results.set(uri, {
                uri,
                name: this.extractLocalName(uri),
                properties: {}
              });
            }
          }
        }
      });

      allStatements.forEach(statement => {
        if (statement.predicate.value.includes('type') && 
            statement.subject.value.includes('#')) {
          const uri = statement.subject.value;
          const name = this.extractLocalName(uri);
          
          if (name.toLowerCase().includes(searchLower)) {
            if (!results.has(uri)) {
              results.set(uri, {
                uri,
                name,
                properties: {}
              });
            }
          }
        }
      });

      const finalResults = Array.from(results.values()).map(result => ({
        ...result,
        properties: this.getPropertiesOfInstance($rdf.sym(result.uri))
      }));

      Logger.info(`Se encontraron ${finalResults.length} resultados para: "${searchText}"`);
      
      return finalResults;
    } catch (error) {
      Logger.error('Error en la búsqueda:', error);
      throw error;
    }
  }

  getProperties() {
    try {
      if (!this.loaded) {
        throw new Error('Ontología no cargada');
      }

      const objectProperties = this.store.each(
        null,
        this.rdf('type'),
        this.owl('ObjectProperty')
      );

      const datatypeProperties = this.store.each(
        null,
        this.rdf('type'),
        this.owl('DatatypeProperty')
      );

      const allProperties = [...objectProperties, ...datatypeProperties];

      return allProperties.map(prop => ({
        uri: prop.value,
        name: this.extractLocalName(prop.value),
        label: this.getLabel(prop),
        domain: this.getDomain(prop),
        range: this.getRange(prop)
      }));
    } catch (error) {
      Logger.error('Error al obtener propiedades:', error);
      throw error;
    }
  }

  extractLocalName(uri) {
    if (!uri) return '';
    const parts = uri.split('#');
    if (parts.length > 1) return parts[1];
    const pathParts = uri.split('/');
    return pathParts[pathParts.length - 1];
  }

  getLabel(resource) {
    const label = this.store.any(resource, this.rdfs('label'), null);
    return label ? label.value : this.extractLocalName(resource.value);
  }

  getDomain(property) {
    const domain = this.store.any(property, this.rdfs('domain'), null);
    return domain ? this.extractLocalName(domain.value) : null;
  }

  getRange(property) {
    const range = this.store.any(property, this.rdfs('range'), null);
    return range ? this.extractLocalName(range.value) : null;
  }

  getOntologyStats() {
    try {
      if (!this.loaded) {
        throw new Error('Ontología no cargada');
      }

      const classes = this.getClasses();
      const properties = this.getProperties();
      const totalStatements = this.store.statements.length;

      return {
        totalClasses: classes.length,
        totalProperties: properties.length,
        totalStatements,
        classes: classes.map(c => c.name),
        properties: properties.map(p => p.name)
      };
    } catch (error) {
      Logger.error('Error al obtener estadísticas:', error);
      throw error;
    }
  }
}

const ontologyService = new OntologyService();

module.exports = ontologyService;

