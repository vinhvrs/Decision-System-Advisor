export type News = {
    id: string;
    hash_key?: string | null;
    title: string;
    content: string;
    author?: string | null;
    source?: string | null;
    published_at: string | Date;
    image?: string | null;
    category?: string | null;
    symbol?: string | null;
    language?: string | null;
    is_processed?: number | boolean;
};

export interface NewsApi extends News {}