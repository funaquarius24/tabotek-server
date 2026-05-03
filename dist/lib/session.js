import { cookies } from 'next/headers';
import { connectToDatabase } from './mongodb';
function parseSessionCookie(cookieValue) {
    try {
        const decoded = decodeURIComponent(cookieValue);
        if (!decoded.startsWith('s:'))
            return null;
        const sessionId = decoded.slice(2).split('.')[0];
        return sessionId || null;
    }
    catch {
        return null;
    }
}
export async function getServerSession() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('tech_hub_sid');
    if (!sessionCookie?.value)
        return null;
    const sessionId = parseSessionCookie(sessionCookie.value);
    if (!sessionId)
        return null;
    const { db } = await connectToDatabase();
    const sessions = db.collection('sessions');
    const sessionDoc = await sessions.findOne({ _id: sessionId });
    if (!sessionDoc || sessionDoc.expires < new Date())
        return null;
    return sessionDoc.session?.user ?? null;
}
