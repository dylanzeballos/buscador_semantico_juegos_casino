require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  OWL_FILE_PATH: process.env.OWL_FILE_PATH || './public/ontologia_35preguntas.owl',
  ONTOLOGY_NAMESPACE: process.env.ONTOLOGY_NAMESPACE || 'http://www.semanticweb.org/dzeba/ontologies/2025/8/untitled-ontology-2#'
};
