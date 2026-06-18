const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

/**
 * Initialize S3 Client configured for Cloudflare R2
 */
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT, // e.g. https://<account_id>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || '';

/**
 * Upload a file buffer to Cloudflare R2
 * @param {Buffer} fileBuffer - The file content
 * @param {string} fileName - Destination path/name in bucket (e.g. 'tracks/song-1.mp3')
 * @param {string} mimeType - The MIME type (e.g. 'audio/mpeg' or 'image/jpeg')
 */
const uploadToR2 = async (fileBuffer, fileName, mimeType) => {
  if (!BUCKET_NAME) throw new Error('R2_BUCKET_NAME is not set in environment variables');

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  await r2Client.send(command);
  
  // Return the public URL if public access is enabled on the bucket,
  // or a custom domain if configured.
  const publicDomain = process.env.R2_PUBLIC_DOMAIN; // e.g. https://pub-xxxxxx.r2.dev or custom domain
  return publicDomain ? `${publicDomain}/${fileName}` : null;
};

/**
 * Generate a secure, temporary pre-signed URL to download or stream a private file from R2
 * @param {string} fileName - Path of the file in the bucket
 * @param {number} expiresInSeconds - Expiration time (default 1 hour)
 */
const getPresignedDownloadUrl = async (fileName, expiresInSeconds = 3600) => {
  if (!BUCKET_NAME) throw new Error('R2_BUCKET_NAME is not set in environment variables');

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
  });

  return await getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds });
};

module.exports = {
  r2Client,
  uploadToR2,
  getPresignedDownloadUrl
};
