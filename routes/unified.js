const express = require("express");
const router = express.Router();
const ontologyController = require("../controllers/ontologyController");

router.get(
  "/search",
  ontologyController.unifiedSearch.bind(ontologyController),
);

router.get(
  "/detail",
  ontologyController.getResultDetail.bind(ontologyController),
);

router.get(
  "/details",
  ontologyController.getResultDetail.bind(ontologyController),
);

router.post(
  "/init",
  ontologyController.initializeUnifiedService.bind(ontologyController),
);

router.post(
  "/clean-cache",
  ontologyController.cleanCache.bind(ontologyController),
);

router.post(
  "/reload-dataset",
  ontologyController.reloadLocalDataset.bind(ontologyController),
);

router.get(
  "/stats",
  ontologyController.getServiceStats.bind(ontologyController),
);

router.post(
  "/offline-mode",
  ontologyController.setOfflineMode.bind(ontologyController),
);

module.exports = router;
