const fs = require('fs').promises;
const path = require('path');

function generateSimpleId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const DB_PATH = path.join(__dirname, '../data/db.json');

// Helper to classify songs based on keywords and genres
function classifySong(song) {
  const title = (song.title || '').toLowerCase();
  const artist = (song.artist || '').toLowerCase();
  const genres = (song.genres || []).map(g => g.toLowerCase());
  
  // Mood keywords
  const loveKeywords = ['love', 'feel', 'dil', 'pyar', 'ishq', 'heart', 'romance', 'sajana', 'sweet', 'beautiful', 'kiss', 'hug', 'together', 'forever', 'baby', 'need you', 'want you', 'bhar'];
  const sadKeywords = ['sad', 'bairan', 'khat', 'cry', 'pain', 'hurt', 'lonely', 'tear', 'alone', 'dark', 'sorrow', 'miss you', 'gone', 'depression', 'ophelia', 'real', 'rëal'];
  const angryKeywords = ['angry', 'hate', 'kill', 'fight', 'rage', 'mad', 'fire', 'death', 'beat', 'metal', 'rock', 'rap', 'hip-hop', 'king kong', 'beast', 'war', 'attack', 'destruction'];

  // 1. Check title and artist for keywords
  for (const kw of angryKeywords) {
    if (title.includes(kw) || artist.includes(kw)) return 'angry';
  }
  for (const kw of sadKeywords) {
    if (title.includes(kw) || artist.includes(kw)) return 'sad';
  }
  for (const kw of loveKeywords) {
    if (title.includes(kw) || artist.includes(kw)) return 'love';
  }

  // 2. Check genres
  for (const genre of genres) {
    if (genre.includes('rap') || genre.includes('hip-hop') || genre.includes('rock') || genre.includes('metal')) {
      return 'angry';
    }
    if (genre.includes('alternative') || genre.includes('indie') || genre.includes('acoustic')) {
      return 'sad';
    }
    if (genre.includes('pop') || genre.includes('r&b') || genre.includes('soul') || genre.includes('romantic') || genre.includes('bollywood')) {
      return 'love';
    }
  }

  // Heuristic based on character codes to distribute others
  const sum = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const code = sum % 3;
  if (code === 0) return 'love';
  if (code === 1) return 'sad';
  return 'angry';
}

const runClassification = async () => {
  try {
    console.log('📖 Reading db.json...');
    const rawData = await fs.readFile(DB_PATH, 'utf-8');
    const data = JSON.parse(rawData);

    if (!data.users || data.users.length === 0) {
      console.log('⚠️ No users found in db.json.');
      return;
    }

    console.log(`👤 Found ${data.users.length} registered users.`);
    let grandTotalSongs = 0;
    let totalLove = 0;
    let totalSad = 0;
    let totalAngry = 0;

    for (const user of data.users) {
      console.log(`\n-----------------------------------------`);
      console.log(`Processing user: ${user.username} (${user.email})`);

      // Gather all unique songs in user's likes and playlists
      const songMap = new Map();

      if (user.likedSongs) {
        user.likedSongs.forEach(song => {
          if (song && song.id) songMap.set(song.id, song);
        });
      }

      if (user.playlists) {
        user.playlists.forEach(pl => {
          if (pl.tracks) {
            pl.tracks.forEach(song => {
              if (song && song.id) songMap.set(song.id, song);
            });
          }
        });
      }

      const userUniqueSongs = Array.from(songMap.values());
      console.log(`- Found ${userUniqueSongs.length} unique songs in playlists & liked songs.`);
      grandTotalSongs += userUniqueSongs.length;

      // Group songs by mood
      const loveSongs = [];
      const sadSongs = [];
      const angrySongs = [];

      userUniqueSongs.forEach(song => {
        const mood = classifySong(song);
        if (mood === 'love') {
          loveSongs.push(song);
        } else if (mood === 'sad') {
          sadSongs.push(song);
        } else if (mood === 'angry') {
          angrySongs.push(song);
        }
      });

      console.log(`  Classification result:`);
      console.log(`    ❤️ Love: ${loveSongs.length}`);
      console.log(`    😢 Sad: ${sadSongs.length}`);
      console.log(`    😡 Angry: ${angrySongs.length}`);

      totalLove += loveSongs.length;
      totalSad += sadSongs.length;
      totalAngry += angrySongs.length;

      // Ensure user has playlists list
      if (!user.playlists) {
        user.playlists = [];
      }

      // Helper to upsert a playlist
      const upsertPlaylist = (name, tracks) => {
        let pl = user.playlists.find(p => p.name.toLowerCase() === name.toLowerCase());
        if (pl) {
          pl.tracks = tracks;
        } else {
          pl = {
            id: `classified-${name.toLowerCase().replace(/\s+/g, '-')}-${generateSimpleId().substring(0, 8)}`,
            name: name,
            tracks: tracks
          };
          user.playlists.push(pl);
        }
      };

      // Create or update the classified playlists
      upsertPlaylist('Love Songs', loveSongs);
      upsertPlaylist('Sad Songs', sadSongs);
      upsertPlaylist('Angry Songs', angrySongs);

      console.log(`- Updated / created Love, Sad, Angry playlists for ${user.username}.`);
    }

    // Save database back
    console.log(`\n💾 Saving updated db.json...`);
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`✅ Update saved successfully!`);

    console.log(`\n================ SUMMARY ================`);
    console.log(`Total Users Processed: ${data.users.length}`);
    console.log(`Total Songs Cataloged: ${grandTotalSongs}`);
    console.log(`❤️ Total Love Songs:    ${totalLove}`);
    console.log(`😢 Total Sad Songs:     ${totalSad}`);
    console.log(`😡 Total Angry Songs:   ${totalAngry}`);
    console.log(`=========================================`);

  } catch (error) {
    console.error('❌ Classification process failed:', error);
  }
};

runClassification();
