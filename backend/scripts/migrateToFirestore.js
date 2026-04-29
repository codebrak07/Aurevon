const { admin, db } = require('../config/firebase-admin');
const fs = require('fs').promises;
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/db.json');

const migrate = async () => {
  try {
    console.log('Starting db.json -> Firestore migration...');
    
    const rawData = await fs.readFile(DB_PATH, 'utf-8');
    const data = JSON.parse(rawData);
    
    if (!data.users || data.users.length === 0) {
      console.log('No users found in db.json to migrate.');
      return;
    }

    let successCount = 0;
    
    // Batch processing isn't strictly necessary for small arrays, 
    // but using separate set() calls ensures we don't hit batch limits if there are many users
    for (const user of data.users) {
      const userRef = db.collection('users').doc(user.id);
      
      // Structure the base profile (excluding massive arrays if needed, but keeping simple for now)
      const userProfile = {
        username: user.username,
        email: user.email,
        googleId: user.googleId || null,
        avatarUrl: user.avatarUrl || null,
        createdAt: user.createdAt || new Date().toISOString(),
        preferences: user.preferences || {},
        // If arrays are small enough (<1MB document limit), they can stay on the main doc.
        // For production scale, these should move to subcollections, but preserving legacy structure for compatibility.
        followedArtists: user.followedArtists || [],
        likedSongs: user.likedSongs || [],
        playlists: user.playlists || []
      };

      await userRef.set(userProfile, { merge: true });
      
      console.log(`Migrated user: ${user.email} (${user.id})`);
      successCount++;
    }

    console.log(`Migration complete! Successfully migrated ${successCount} users to Cloud Firestore.`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrate();
