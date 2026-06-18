const { admin } = require('./firebase-admin');

/**
 * Get the reference to the default Firebase Storage bucket
 */
const getBucket = () => {
  try {
    return admin.storage().bucket();
  } catch (error) {
    console.error('❌ Failed to get Firebase Storage bucket. Ensure GOOGLE_APPLICATION_CREDENTIALS is set and storage is enabled.');
    throw error;
  }
};

/**
 * Upload a file buffer to Firebase Cloud Storage
 * @param {Buffer} fileBuffer - The file content buffer
 * @param {string} fileName - Destination path/name in the bucket (e.g. 'songs/track-1.mp3')
 * @param {string} mimeType - The MIME type (e.g. 'audio/mpeg' or 'image/jpeg')
 * @returns {Promise<string>} The public URL of the uploaded file
 */
const uploadToFirebase = async (fileBuffer, fileName, mimeType) => {
  const bucket = getBucket();
  const file = bucket.file(fileName);

  // Upload the buffer
  await file.save(fileBuffer, {
    metadata: {
      contentType: mimeType,
    },
    resumable: false,
  });

  // Make the file public (Spark free plan allows public access configuration)
  await file.makePublic();

  // Return the public access URL
  return `https://storage.googleapis.com/${bucket.name}/${file.name}`;
};

/**
 * Generate a temporary secure download/stream URL for private files
 * @param {string} fileName - Path of the file in the bucket
 * @param {number} expiresInMinutes - Expiry duration (default 60 minutes)
 */
const getFirebaseSignedUrl = async (fileName, expiresInMinutes = 60) => {
  const bucket = getBucket();
  const file = bucket.file(fileName);

  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + expiresInMinutes * 60 * 1000,
  });

  return url;
};

module.exports = {
  uploadToFirebase,
  getFirebaseSignedUrl,
  getBucket,
};
