const express = require('express');
const { identifyContact } = require('../controllers/contactController');

const router = express.Router();

router.post('/identify', identifyContact);
router.get("/", (req, res) => {
    res.send("Hello, world!");
});
module.exports = router;
