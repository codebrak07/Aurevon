const { db, admin } = require('../config/firebase-admin');
const { v4: uuidv4 } = require('uuid');

// Short ID generator
const generateShareId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const createShareLink = async (req, res) => {
  try {
    const { type, payload, expiryHours = 24 } = req.body;
    const userId = req.userId;

    if (!type || !payload) {
      return res.status(400).json({ message: 'Type and payload are required' });
    }

    const shareId = generateShareId();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);

    await db.collection('sharedLinks').doc(shareId).set({
      type,
      payload,
      creatorId: userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      clicks: 0
    });

    res.status(201).json({
      shareId,
      url: `aurevon.com/share/${shareId}`,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating share link', error: error.message });
  }
};

const getShareLink = async (req, res) => {
  try {
    const { shareId } = req.params;
    const shareRef = db.collection('sharedLinks').doc(shareId);
    const doc = await shareRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Link not found' });
    }

    const data = doc.data();
    
    // Check expiration
    if (data.expiresAt.toDate() < new Date()) {
      return res.status(410).json({ message: 'Link has expired' });
    }

    // Atomic click increment
    await shareRef.update({
      clicks: admin.firestore.FieldValue.increment(1)
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving share link', error: error.message });
  }
};

module.exports = { createShareLink, getShareLink };
