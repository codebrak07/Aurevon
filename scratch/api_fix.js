const fs = require('fs');
const path = require('path');

function fixFile(filePath, searchBlocks, replacementBlocks) {
  let content = fs.readFileSync(filePath, 'utf8');
  for (let i = 0; i < searchBlocks.length; i++) {
    const search = searchBlocks[i].trim();
    const replacement = replacementBlocks[i].trim();
    if (content.includes(search)) {
      content = content.replace(search, replacement);
    } else {
      console.log(`❌ Block not found in ${filePath}:`, search);
    }
  }
  fs.writeFileSync(filePath, content);
  console.log(`✅ Updated ${filePath}`);
}

// ── FIX SPOTIFY SERVICE ──
fixFile(
  'src/services/spotifyService.js',
  [
    `const searchUrl = isProd 
      ? \${BASE_URL}/search/itunes?\${params} 
      : https://itunes.apple.com/search?\${params};

    console.log(\`[SpotifyService] Artist search: \${searchUrl}\`);
    const response = await fetch(searchUrl);`,
  ],
  [
    `const searchUrl = isProd 
      ? API(\`/search/itunes?\${params}\`) 
      : \`https://itunes.apple.com/search?\${params}\`;

    const response = await fetch(searchUrl);`,
  ]
);

// ── FIX MOOD SERVICE ──
fixFile(
  'src/services/moodService.js',
  [
    `const searchUrl = isProd 
      ? \${BASE_URL}/search/itunes?term=\${encodeURIComponent(term)}&entity=song&limit=1 
      : \${ITUNES_URL}?term=\${encodeURIComponent(term)}&entity=song&limit=1;

    console.log(\`[MoodService] Genre check: \${searchUrl}\`);
    const response = await fetch(searchUrl);`,
  ],
  [
    `const searchUrl = isProd 
      ? API(\`/search/itunes?term=\${encodeURIComponent(term)}&entity=song&limit=1\`)
      : \`\${ITUNES_URL}?term=\${encodeURIComponent(term)}&entity=song&limit=1\`;

    const response = await fetch(searchUrl);`,
  ]
);
