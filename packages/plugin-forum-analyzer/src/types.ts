export interface ForumPost {
    id: number;
    title: string;
    content: string;
    created_at: string;
    views: number;
    reply_count: number;
    like_count: number;
    category_id: number;
    pinned: boolean;
    tags: string[];
    url: string;
} 