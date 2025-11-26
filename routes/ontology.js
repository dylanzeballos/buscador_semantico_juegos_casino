const express = require("express");
const router = express.Router();
const ontologyController = require("../controllers/ontologyController");

router.get("/classes", ontologyController.getClasses.bind(ontologyController));

router.get(
  "/instances/:className",
  ontologyController.getInstancesOfClass.bind(ontologyController),
);

router.get("/search", ontologyController.searchByText.bind(ontologyController));

router.get(
  "/properties",
  ontologyController.getProperties.bind(ontologyController),
);

router.get("/stats", ontologyController.getStats.bind(ontologyController));

router.post(
  "/reload",
  ontologyController.reloadOntology.bind(ontologyController),
);

router.get(
  "/dbpedia/search",
  ontologyController.searchDbpedia.bind(ontologyController),
);

router.get(
  "/dbpedia/game",
  ontologyController.searchCasinoGameDbpedia.bind(ontologyController),
);

module.exports = router;
