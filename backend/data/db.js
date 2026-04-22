const fs = require('fs').promises;
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');

const readData = async () => {
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
