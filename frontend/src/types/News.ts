export type News = {
    id: string;
    topic: string;
    content: string;
    author: string;
    url_slug: string;
    published_at: Date;
};

export interface NewsApi {
    id: string;
    topic: string;
    content: string;
    author: string;
    url_slug: string;
    published_at: Date;
};