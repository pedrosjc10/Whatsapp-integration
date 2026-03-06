const express = require("express");
const router = express.Router();
const trelloController = require("../controllers/trelloController");

router.post("/config", trelloController.saveConfig);
router.get("/status", trelloController.getStatus);
router.get("/lists", trelloController.getLists);
router.get("/boards", trelloController.getBoards);
router.get("/stats", trelloController.getStats);
router.get("/detailed-stats", trelloController.getDetailedStats);
router.get("/actions", trelloController.getActions);

module.exports = router;

module.exports = router;
