const express = require('express');
const { searchSongs, getIndiaTop100 } = require('../controllers/itunesController');
const { getGlobalDashboard: getGenZDashboard } = require('../controllers/globalChartController');

const router = express.Router();

router.get('/search', searchSongs);
router.get('/top100', getIndiaTop100);
router.get('/global-dashboard', getGenZDashboard);

module.exports = router;
