import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

import config from "../../config/storage.js";

// Cloudflare R2 is S3-compatible, so the AWS S3 client drives it. Public and
// private objects live in separate buckets by design: the public bucket is
// exposed through a CDN domain (avatars, attachments), while the private bucket
// has no public access at all and is reachable only with these credentials
// (resumes). An unguessable key is obscurity, not access control — separate
// buckets make the boundary a real one.

// The client is created lazily so that importing this module under the local
// driver (tests, development) never touches R2 config or credentials.
let s3;
const client = () => {
  if (!s3) {
    s3 = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return s3;
};

const bucketFor = (area) =>
  area === "public" ? config.publicBucket : config.privateBucket;

export const put = async (key, area, { body, contentType }) => {
  await client().send(
    new PutObjectCommand({
      Bucket: bucketFor(area),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
};

export const remove = async (key, area) => {
  await client().send(
    new DeleteObjectCommand({ Bucket: bucketFor(area), Key: key })
  );
};

export const getStream = async (key, area) => {
  try {
    const res = await client().send(
      new GetObjectCommand({ Bucket: bucketFor(area), Key: key })
    );
    return {
      stream: res.Body,
      contentType: res.ContentType,
      contentLength: res.ContentLength,
    };
  } catch (err) {
    if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
};

export const publicUrl = (key) => `${config.publicBaseUrl}/${key}`;

export const keyFromPublicUrl = (url) => {
  const prefix = `${config.publicBaseUrl}/`;
  return url && url.startsWith(prefix) ? url.slice(prefix.length) : null;
};
