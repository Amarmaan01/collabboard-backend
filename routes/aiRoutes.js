const express = require("express");
const router = express.Router();
const { summarize, generateDiagram, recognizeHandwriting } = require("../controllers/aiController");
const { verifyToken } = require("../middleware/auth");

router.use(verifyToken);

router.post("/summarize", summarize);
router.post("/generate-diagram", generateDiagram);
router.post("/handwriting", recognizeHandwriting);

module.exports = router;
