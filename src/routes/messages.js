const express = require("express");
const router = express.Router();
const messagesController = require("../controllers/messagesController");

router.post("/send", messagesController.sendMessage);
router.get("/sent", messagesController.getSentMessages);
router.get("/received", messagesController.getReceivedMessages);

module.exports = router;

module.exports = router;
