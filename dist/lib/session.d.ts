export interface SessionUser {
    _id: string;
    email: string;
    name: string;
    role: string;
}
export declare function getServerSession(): Promise<SessionUser | null>;
