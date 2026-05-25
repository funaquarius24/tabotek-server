import { writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname, extname } from 'path';
import { randomUUID } from 'crypto';

function dateFormat(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function mkdDirsSync(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

function getUploadDir(): string {
  return join(process.cwd(), 'public', 'uploads');
}

export interface UploadResult {
  filename: string;
  url: string;
  originalname: string;
  mimetype: string;
  size: number;
}

export function saveFile(
  fileBuffer: Buffer,
  originalname: string,
  mimetype: string,
  size: number,
  unique: number = 0
): UploadResult {
  const dataFolder = dateFormat(new Date());
  const ext = extname(originalname);
  const filename = unique === 1
    ? `${dataFolder}/${originalname}`
    : `${dataFolder}/${randomUUID()}${ext}`;

  const saveFile = join(getUploadDir(), filename);
  mkdDirsSync(dirname(saveFile));
  writeFileSync(saveFile, fileBuffer);

  const url = `/uploads/${filename}`;

  return { filename, url, originalname, mimetype, size };
}

export function deleteFile(filename: string): void {
  const filePath = join(getUploadDir(), filename);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

export function getUploadUrl(): string {
  return `/uploads`;
}
