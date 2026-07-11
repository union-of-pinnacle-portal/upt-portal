import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
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
export const s3 = new S3Client({ region: AWS_REGION });

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
