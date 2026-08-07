import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  NoSuchKey,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AWS_REGION, DOCUMENTS_BUCKET } from "./config";

/**
 * Shared S3 client for the private documents bucket.
 *
 * The bucket blocks all public access (see infra/StorageStack); files are only
 * ever reachable through the short-lived presigned URLs minted below. Access
 * control is enforced by the app BEFORE a URL is minted — never rely on the
 * URL alone being secret.
 */
export const s3 = new S3Client({
  region: AWS_REGION,
  // SDK v3 defaults to adding a CRC32 checksum, which for a presigned PUT bakes
  // the checksum of an EMPTY body into the signed URL — S3 then rejects the
  // real bytes the browser uploads. "WHEN_REQUIRED" omits it so direct-to-S3
  // browser uploads succeed.
  requestChecksumCalculation: "WHEN_REQUIRED",
});

/** Default presigned-URL lifetime, in seconds (5 minutes). */
const DEFAULT_EXPIRY_SECONDS = 300;

/**
 * Mint a short-lived URL to download/preview an existing object.
 * Call ONLY after verifying the requesting user is authorized for the document.
 */
export function getDownloadUrl(
  storageKey: string,
  expiresIn = DEFAULT_EXPIRY_SECONDS,
): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: DOCUMENTS_BUCKET, Key: storageKey }),
    { expiresIn },
  );
}

/**
 * Mint a short-lived URL the admin's browser can PUT a file to directly,
 * so large uploads never pass through the app server.
 * Call ONLY after verifying the requesting user may upload documents.
 */
export function getUploadUrl(
  storageKey: string,
  contentType: string,
  expiresIn = DEFAULT_EXPIRY_SECONDS,
): Promise<string> {
  return getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: DOCUMENTS_BUCKET,
      Key: storageKey,
      ContentType: contentType,
    }),
    { expiresIn },
  );
}

/**
 * Write a small object straight from the server.
 *
 * Uploaded files never take this path — they go browser-to-S3 via a presigned
 * URL so the bytes skip the app server. This is for portal-authored document
 * content, which is a few KB of JSON the server already has in hand; a
 * presigned round trip would be three requests to save what fits in one.
 */
export async function putObjectText(
  storageKey: string,
  body: string,
  contentType = "application/json",
): Promise<number> {
  await s3.send(
    new PutObjectCommand({
      Bucket: DOCUMENTS_BUCKET,
      Key: storageKey,
      Body: body,
      ContentType: contentType,
    }),
  );
  return Buffer.byteLength(body, "utf8");
}

/**
 * Read an object's raw bytes, or null if it does not exist.
 *
 * Only the docx→editor conversion uses this. Downloads deliberately redirect
 * the browser to S3 so file bytes never pass through the app server; but the
 * converter has to read the file from JavaScript, and routing that one read
 * through our own origin removes any dependence on bucket CORS and on
 * cross-origin redirect following. Word documents are small, so the cost is
 * negligible and confined to this one path.
 */
export async function getObjectBytes(
  storageKey: string,
): Promise<Uint8Array | null> {
  try {
    const res = await s3.send(
      new GetObjectCommand({ Bucket: DOCUMENTS_BUCKET, Key: storageKey }),
    );
    return (await res.Body?.transformToByteArray()) ?? null;
  } catch (err) {
    if (err instanceof NoSuchKey) return null;
    throw err;
  }
}

/**
 * Read a small object as text, or null if it does not exist.
 *
 * A missing object is not an error here: a document row can outlive its
 * content object (a half-finished create, a bucket restored from an older
 * snapshot), and an editor that opens blank is far better than one that 500s.
 */
export async function getObjectText(
  storageKey: string,
): Promise<string | null> {
  try {
    const res = await s3.send(
      new GetObjectCommand({ Bucket: DOCUMENTS_BUCKET, Key: storageKey }),
    );
    return (await res.Body?.transformToString()) ?? null;
  } catch (err) {
    if (err instanceof NoSuchKey) return null;
    throw err;
  }
}
