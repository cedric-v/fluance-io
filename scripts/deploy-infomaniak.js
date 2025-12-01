// scripts/deploy-infomaniak.js
// Build the site, upload static files via FTP to Infomaniak web hosting,
// and upload images to Infomaniak Object Storage (S3-compatible).

require("dotenv").config();

const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const ftp = require("basic-ftp");
const mime = require("mime-types");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

async function main() {
  try {
    console.log("📦 Building site for production...");

    // Ensure env vars for build
    process.env.ELEVENTY_ENV = "prod";
    if (!process.env.S3_PUBLIC_URL) {
      console.warn(
        "⚠️  S3_PUBLIC_URL is not set. Images will NOT point to Object Storage URLs in the generated HTML."
      );
    }

    execSync("npm run build", { stdio: "inherit" });

    console.log("✅ Build finished. Uploading static files via FTP...");
    await uploadViaFtp();

    console.log("✅ FTP upload done. Uploading images to S3 Object Storage...");
    await uploadImagesToS3();

    console.log("🎉 Deployment to Infomaniak (web + Object Storage) completed.");
  } catch (err) {
    console.error("❌ Deployment failed:", err.message);
    process.exit(1);
  }
}

async function uploadViaFtp() {
  const {
    FTP_HOST,
    FTP_USER,
    FTP_PASSWORD,
    FTP_REMOTE_DIR = "/",
    FTP_SECURE = "false",
  } = process.env;

  if (!FTP_HOST || !FTP_USER || !FTP_PASSWORD) {
    throw new Error(
      "FTP_HOST, FTP_USER and FTP_PASSWORD must be set in environment or .env"
    );
  }

  const client = new ftp.Client();
  client.ftp.verbose = true;

  try {
    await client.access({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASSWORD,
      secure: FTP_SECURE === "true",
    });

    console.log(`➡️  Connected to FTP. Uploading _site/ to ${FTP_REMOTE_DIR}...`);
    await client.ensureDir(FTP_REMOTE_DIR);
    // Optional: clear remote dir first
    // await client.clearWorkingDir();
    await client.uploadFromDir(path.join(__dirname, "..", "_site"));
  } finally {
    client.close();
  }
}

async function uploadImagesToS3() {
  const {
    S3_ENDPOINT,
    S3_REGION = "auto",
    S3_BUCKET,
    S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY,
  } = process.env;

  if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    throw new Error(
      "S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set for Object Storage upload."
    );
  }

  const s3 = new S3Client({
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });

  const imagesDir = path.join(__dirname, "..", "src", "assets", "img");
  if (!fs.existsSync(imagesDir)) {
    console.warn(`⚠️  Images directory not found: ${imagesDir} – skipping S3 upload.`);
    return;
  }

  const files = fs.readdirSync(imagesDir).filter((f) => fs.statSync(path.join(imagesDir, f)).isFile());
  if (files.length === 0) {
    console.warn(`⚠️  No image files found in ${imagesDir} – skipping S3 upload.`);
    return;
  }

  for (const file of files) {
    const localPath = path.join(imagesDir, file);
    const key = `assets/img/${file}`;
    const contentType = mime.lookup(file) || "application/octet-stream";

    console.log(`➡️  Uploading ${localPath} to s3://${S3_BUCKET}/${key}`);

    const body = fs.createReadStream(localPath);

    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        ACL: "public-read",
      })
    );
  }
}

main();


