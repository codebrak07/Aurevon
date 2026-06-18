const fs = require('fs').promises;
const path = require('path');
const { admin, db } = require('../config/firebase-admin');

const DB_PATH = path.join(__dirname, 'db.json');

const isFirebaseEnabled = () => {
  return admin && admin.apps && admin.apps.length > 0;
};

const readData = async () => {
  if (isFirebaseEnabled()) {
    try {
      const docRef = db.collection('app').doc('state');
      const doc = await docRef.get();
      if (doc.exists) {
        const docData = doc.data();
        let parsed = {};
        if (docData.json_data) {
          parsed = JSON.parse(docData.json_data);
        } else {
          parsed = docData;
        }
        if (!parsed.users) parsed.users = [];
        if (!parsed.playlists) parsed.playlists = [];
        return parsed;
      } else {
        const initialData = { users: [], playlists: [] };
        await docRef.set({ json_data: JSON.stringify(initialData) });
        return initialData;
      }
    } catch (error) {
      console.error('🔥 [Firestore] Error reading from Firestore:', error.message);
    }
  }

  try {
    // Ensure file exists with base structure if missing
    try {
      await fs.access(DB_PATH);
    } catch {
      const initialData = { users: [], playlists: [] };
      await fs.writeFile(DB_PATH, JSON.stringify(initialData, null, 2));
      return initialData;
    }

    const data = await fs.readFile(DB_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Safety check: ensure users and playlists arrays exist
    if (!parsed.users) parsed.users = [];
    if (!parsed.playlists) parsed.playlists = [];
    
    return parsed;
  } catch (error) {
    console.error('CRITICAL: Error reading database:', error);
    // Return empty but don't wipe if possible
    return { users: [], playlists: [] };
  }
};

const writeData = async (data) => {
  if (isFirebaseEnabled()) {
    try {
      // 1. Continue existing app/state synchronization
      const docRef = db.collection('app').doc('state');
      await docRef.set({ json_data: JSON.stringify(data) });

      // 2. Synchronize users collection
      const activeUserIds = new Set(data.users.map(u => u.id));

      for (const user of data.users) {
        const userRef = db.collection('users').doc(user.id);
        const likedSongsMapped = (user.likedSongs || []).map(s => ({
          id: s.id || '',
          title: s.title || '',
          artist: s.artist || ''
        }));

        await userRef.set({
          username: user.username || '',
          email: user.email || '',
          likedSongs: likedSongsMapped,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      // Deletion handling: Remove users that no longer exist in the array
      const usersSnapshot = await db.collection('users').get();
      for (const doc of usersSnapshot.docs) {
        if (!activeUserIds.has(doc.id)) {
          await doc.ref.delete();
          console.log(`🗑️ [Firestore] Deleted user document for ID: ${doc.id}`);
        }
      }

      return;
    } catch (error) {
      console.error('🔥 [Firestore] Error writing to Firestore:', error.message);
    }
  }

  try {
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing data:', error);
  }
};

module.exports = {
  readData,
  writeData
};
