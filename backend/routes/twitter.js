const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");

const dataPath = path.join(__dirname, "../data/twitter.json");

router.get("/", (req, res) => {
  const data = fs.existsSync(dataPath)
    ? JSON.parse(fs.readFileSync(dataPath, "utf-8"))
    : [];
  res.json(data);
});

module.exports = router;
