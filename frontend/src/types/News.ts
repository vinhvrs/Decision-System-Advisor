export type News = {
    id: string;
    title: string;
    content: string;
    author: string;
    source: string;
    published_at: Date;
};

export interface NewsApi {
    id: string;
    title: string;
    content: string;
    author: string;
    source: string;
    published_at: Date;
};