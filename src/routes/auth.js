const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", authController.getMe);
router.post("/filters", authController.updateFilters);

module.exports = router;

module.exports = router;
