var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next) {
  res.render('index', {
    title: 'Buscador Semántico - Juegos de Casino',
    description: 'Sistema de búsqueda semántica basado en ontologías OWL'
  });
});

module.exports = router;
