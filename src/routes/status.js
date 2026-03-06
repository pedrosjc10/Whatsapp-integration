const express = require("express");
const router = express.Router();
const statusController = require("../controllers/statusController");

router.get("/all", statusController.getAllStatus);
router.get("/", statusController.getStatus);
router.get("/qr", statusController.getQR);
router.post("/create", statusController.createSession);
router.get("/filters", statusController.getFilters);
router.post("/filters", statusController.setFilters);
router.post("/logout", statusController.logout);

module.exports = router;

module.exports = router;
