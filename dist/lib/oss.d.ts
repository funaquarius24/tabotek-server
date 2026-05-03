export declare function getOssEndpoint(objectName: string): string;
export declare function signUrl(httpVerb: string, objectName: string, expires: number, contentType?: string, headers?: Record<string, string>): string;
export interface OssUploadTicket {
    token: string;
    uploadUrl: string;
    publicUrl: string;
    imageId: string;
    expiresAt: Date;
}
export declare function createUploadTicket(filename: string, contentType: string): Promise<OssUploadTicket>;
export declare function confirmUpload(imageId: string): Promise<void>;
