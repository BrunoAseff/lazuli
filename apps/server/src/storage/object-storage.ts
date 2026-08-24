import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";

import type { ServerEnv } from "../config.ts";

export const createObjectStorage = (env: ServerEnv) => {
  const client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: true,
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });

  return {
    async ensureBucket() {
      try {
        await client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
      } catch {
        await client.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
      }
    },
    put(key: string, body: Uint8Array | Readable, contentType: string, contentLength?: number) {
      return client.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: key,
          Body: body,
          ContentLength: contentLength,
          ContentType: contentType,
        }),
      );
    },
    get(key: string) {
      return client.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    },
    delete(key: string) {
      return client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    },
    destroy() {
      client.destroy();
    },
  };
};

export type ObjectStorage = ReturnType<typeof createObjectStorage>;
