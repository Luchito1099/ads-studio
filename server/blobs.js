import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";

/**
 * Almacenamiento de archivos en S3 (o compatible: MinIO, R2, Spaces…).
 * Se activa solo si existe S3_BUCKET; si no, devuelve null y las imágenes
 * siguen guardándose dentro de la base como antes.
 *
 * Las credenciales las toma el SDK de AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
 * (o del rol IAM si corre en AWS).
 */
export function openBlobs() {
  const Bucket = process.env.S3_BUCKET;
  if (!Bucket) return null;

  const client = new S3Client({
    region: process.env.S3_REGION || process.env.AWS_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  });
  const prefix = (process.env.S3_PREFIX || "").replace(/^\/+|\/+$/g, "");

  return {
    label: `s3://${Bucket}${prefix ? "/" + prefix : ""}`,
    /** Clave completa del objeto (con el prefijo configurado). */
    keyFor: (name) => (prefix ? `${prefix}/${name}` : name),
    check: () => client.send(new HeadBucketCommand({ Bucket })),
    put: (Key, Body, ContentType) => client.send(new PutObjectCommand({ Bucket, Key, Body, ContentType })),
    get: (Key) => client.send(new GetObjectCommand({ Bucket, Key })),
    delete: (Key) => client.send(new DeleteObjectCommand({ Bucket, Key })),
  };
}
