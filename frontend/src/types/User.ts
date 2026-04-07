export type User = {
    id: string;
    username: string;
    email: string;
    phone: string;
    name: string;
    role?: string;
};

export interface UserAPI {
    id: string;
    username: string;
    email: string;
    phone: string;
    name: string;
    role?: string;
}