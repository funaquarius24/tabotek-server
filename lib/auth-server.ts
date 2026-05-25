import { cookies } from 'next/headers';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('user_id')?.value || null;
}

export async function getServerAuth() {
  const userId = await getUserId();

  if (!userId) {
    return null;
  }

  return { userId };
}

export async function getServerUser() {
  const userId = await getUserId();

  if (!userId) {
    return null;
  }

  try {
    const { db } = await connectToDatabase();
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return null;
    }

    return {
      _id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      username: user.username,
    };
  } catch {
    return null;
  }
}

export async function requireAuth() {
  const auth = await getServerAuth();
  if (!auth) {
    throw new Error('Authentication required');
  }
  return auth;
}