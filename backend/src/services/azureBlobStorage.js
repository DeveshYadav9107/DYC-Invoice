// ─────────────────────────────────────────────────────────────────
// Storage Service — Azure Blob Storage with Local Dev Fallback
// ─────────────────────────────────────────────────────────────────

import { BlobServiceClient } from '@azure/storage-blob';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER || 'invoices';
const LOCAL_STORAGE_DIR = path.join(process.cwd(), '.storage', 'invoices');

export function isAzureStorageConfigured() {
  return Boolean(process.env.AZURE_STORAGE_CONNECTION_STRING?.trim());
}

function getContainerClient() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) return null;

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    return blobServiceClient.getContainerClient(CONTAINER_NAME);
  } catch (err) {
    console.error('Failed to initialize Azure Blob Storage client:', err);
    return null;
  }
}

export async function uploadInvoiceFile(buffer, originalFileName, mimeType, organizationId = 'default') {
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  const fileExt = path.extname(originalFileName) || '.bin';
  const uniqueId = crypto.randomUUID();
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  const storageKey = `${organizationId}/${year}/${month}/${uniqueId}${fileExt}`;
  const containerClient = getContainerClient();

  if (containerClient) {
    await containerClient.createIfNotExists();
    const blockBlobClient = containerClient.getBlockBlobClient(storageKey);

    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: mimeType,
      },
    });

    return {
      storageKey,
      sizeBytes: buffer.length,
      checksum,
    };
  }

  // Local dev storage fallback
  console.warn(`\n⚠️ [Storage] AZURE_STORAGE_CONNECTION_STRING not set. Saving to local storage: .storage/invoices/${storageKey}`);

  const localFilePath = path.join(LOCAL_STORAGE_DIR, storageKey);
  const localDir = path.dirname(localFilePath);

  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }

  fs.writeFileSync(localFilePath, buffer);

  return {
    storageKey,
    sizeBytes: buffer.length,
    checksum,
  };
}

export async function getInvoiceFileBuffer(storageKey) {
  const containerClient = getContainerClient();

  if (containerClient) {
    const blockBlobClient = containerClient.getBlockBlobClient(storageKey);
    const downloadBlockBlobResponse = await blockBlobClient.download(0);
    const downloaded = await streamToBuffer(downloadBlockBlobResponse.readableStreamBody);
    return {
      buffer: downloaded,
      mimeType: downloadBlockBlobResponse.contentType,
    };
  }

  const localFilePath = path.join(LOCAL_STORAGE_DIR, storageKey);
  if (!fs.existsSync(localFilePath)) {
    throw new Error(`File not found at storage key: ${storageKey}`);
  }

  const buffer = fs.readFileSync(localFilePath);
  return { buffer };
}

export async function deleteInvoiceFile(storageKey) {
  const containerClient = getContainerClient();

  if (containerClient) {
    const blockBlobClient = containerClient.getBlockBlobClient(storageKey);
    await blockBlobClient.deleteIfExists();
    return true;
  }

  const localFilePath = path.join(LOCAL_STORAGE_DIR, storageKey);
  if (fs.existsSync(localFilePath)) {
    fs.unlinkSync(localFilePath);
  }
  return true;
}

async function streamToBuffer(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
}
