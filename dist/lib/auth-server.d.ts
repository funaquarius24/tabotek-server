export declare function getServerAuth(): Promise<{
    userId: string;
} | null>;
export declare function getServerUser(): Promise<{
    _id: string;
    email: any;
    name: any;
    role: any;
    username: any;
} | null>;
export declare function requireAuth(): Promise<{
    userId: string;
}>;
