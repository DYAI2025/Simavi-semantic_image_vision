
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getBucketConfig, createS3Client } from "./aws-config";
import { uploadFile as localUploadFile, downloadFile as localDownloadFile, deleteFile as localDeleteFile } from './local-storage';

// Check if we have valid AWS credentials
const hasValidAwsCredentials = 
  process.env.AWS_ACCESS_KEY_ID && 
  process.env.AWS_SECRET_ACCESS_KEY && 
  process.env.AWS_ACCESS_KEY_ID !== 'FAKE_S3_KEY' &&
  process.env.AWS_SECRET_ACCESS_KEY !== 'FAKE_S3_SECRET';

const s3Client = hasValidAwsCredentials ? createS3Client() : null;
const { bucketName, folderPrefix } = hasValidAwsCredentials ? getBucketConfig() : { bucketName: '', folderPrefix: '' };

export async function uploadFile(buffer: Buffer, fileName: string): Promise<string> {
  if (hasValidAwsCredentials && s3Client) {
    const key = `${folderPrefix}uploads/${Date.now()}-${fileName}`;
    
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: "image/*"
    });

    await s3Client.send(command);
    return key;
  } else {
    // Use local storage for development/testing
    return await localUploadFile(buffer, fileName);
  }
}

export async function downloadFile(key: string): Promise<string> {
  if (hasValidAwsCredentials && s3Client && !key.startsWith('local://')) {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return signedUrl;
  } else {
    // Use local storage for development/testing
    return await localDownloadFile(key);
  }
}

export async function deleteFile(key: string): Promise<void> {
  if (hasValidAwsCredentials && s3Client && !key.startsWith('local://')) {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key
    });

    await s3Client.send(command);
  } else {
    // Use local storage for development/testing
    await localDeleteFile(key);
  }
}
