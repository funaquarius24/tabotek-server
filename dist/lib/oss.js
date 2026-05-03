import { randomUUID, createHmac } from 'crypto';
import { connectToDatabase } from '@/lib/mongodb';
function getOssConfig() {
    const region = process.env.OSS_REGION;
    const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
    const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
    const bucket = process.env.OSS_BUCKET;
    if (!region || !accessKeyId || !accessKeySecret || !bucket) {
        throw new Error('OSS not configured. Set OSS_REGION, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET in .env.local');
    }
    return { region, accessKeyId, accessKeySecret, bucket };
}
export function getOssEndpoint(objectName) {
    const { region, bucket } = getOssConfig();
    const https = process.env.OSS_HTTPS !== 'false';
    const protocol = https ? 'https' : 'http';
    return `${protocol}://${bucket}.${region}.aliyuncs.com/${objectName}`;
}
export function signUrl(httpVerb, objectName, expires, contentType = '', headers = {}) {
    const { accessKeyId, accessKeySecret, bucket } = getOssConfig();
    const canonicalizedHeaders = Object.keys(headers)
        .sort()
        .map(k => `${k.toLowerCase()}:${headers[k]}`)
        .join('\n');
    const resource = `/${bucket}/${objectName}`;
    let stringToSign = `${httpVerb}\n\n${contentType}\n${expires}\n`;
    if (canonicalizedHeaders) {
        stringToSign += `${canonicalizedHeaders}\n`;
    }
    stringToSign += resource;
    const signature = createHmac('sha1', accessKeySecret)
        .update(stringToSign, 'utf-8')
        .digest('base64');
    return `${getOssEndpoint(objectName)}?OSSAccessKeyId=${accessKeyId}&Expires=${expires}&Signature=${encodeURIComponent(signature)}`;
}
export async function createUploadTicket(filename, contentType) {
    const imageId = randomUUID();
    const ext = filename.includes('.') ? filename.substring(filename.lastIndexOf('.')) : '';
    const objectName = `uploads/${imageId}${ext}`;
    const publicUrl = getOssEndpoint(objectName);
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const uploadUrl = signUrl('PUT', objectName, expires, contentType);
    const expiresAt = new Date(expires * 1000);
    const { db } = await connectToDatabase();
    await db.collection('oss_tickets').insertOne({
        token: imageId,
        imageId,
        objectName,
        filename,
        contentType,
        publicUrl,
        status: 'pending',
        createdAt: new Date(),
        expiresAt,
    });
    return {
        token: imageId,
        uploadUrl,
        publicUrl,
        imageId,
        expiresAt,
    };
}
export async function confirmUpload(imageId) {
    const { db } = await connectToDatabase();
    const ticket = await db.collection('oss_tickets').findOne({ imageId, status: 'pending' });
    if (!ticket) {
        throw new Error('Upload ticket not found or already confirmed');
    }
    const headUrl = signUrl('HEAD', ticket.objectName, Math.floor(Date.now() / 1000) + 60);
    const headRes = await fetch(headUrl, { method: 'HEAD' });
    if (!headRes.ok) {
        throw new Error(`OSS HEAD failed: ${headRes.status}`);
    }
    const contentLength = headRes.headers.get('content-length') || '0';
    await db.collection('files').insertOne({
        originalname: ticket.filename,
        filename: ticket.objectName,
        url: ticket.publicUrl,
        type: ticket.contentType,
        size: parseInt(contentLength),
        createdAt: new Date(),
    });
    await db.collection('oss_tickets').updateOne({ imageId }, { $set: { status: 'completed', fileSize: parseInt(contentLength) } });
}
