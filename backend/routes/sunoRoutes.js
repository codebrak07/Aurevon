const express = require('express');
const { generate, getFeed } = require('../controllers/sunoController');

const router = express.Router();

router.post('/generate', generate);
router.get('/feed/:ids', getFeed);

module.exports = router;
