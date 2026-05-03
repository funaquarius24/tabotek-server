export interface UploadResult {
    filename: string;
    url: string;
    originalname: string;
    mimetype: string;
    size: number;
}
export declare function saveFile(fileBuffer: Buffer, originalname: string, mimetype: string, size: number, unique?: number): UploadResult;
export declare function deleteFile(filename: string): void;
export declare function getUploadUrl(): string;
