import { ObjectId } from 'mongodb';

export interface Article {
  _id: ObjectId;
  slug: string;
  title: string;
  content: string;
  excerpt: string;
  categoryId: ObjectId;
  authorId: ObjectId;
  featuredImage: string;
  tags: string[];
  readTime: number;
  status: 'draft' | 'published' | 'archived';
  publishedAt: Date;
  views: number;
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  _id: ObjectId;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  parentCategory: ObjectId | null;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  _id: ObjectId;
  name: string;
  email: string;
  role: 'superuser' | 'admin' | 'editor' | 'author' | 'user';
  avatar: string;
  bio: string;
  createdAt: Date;
  updatedAt: Date;
}

// Frontend-friendly types (with string IDs)
export interface ArticleResponse {
  _id: string;
  slug: string;
  title: string;
  content: string;
  excerpt: string;
  categoryId: string;
  authorId: string;
  featuredImage: string;
  tags: string[];
  readTime: number;
  status: 'draft' | 'published' | 'archived';
  publishedAt: string;
  views: number;
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface CategoryResponse {
  _id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  parentCategory: string | null;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserResponse {
  _id: string;
  name: string;
  email: string;
  role: 'superuser' | 'admin' | 'editor' | 'author' | 'user';
  avatar: string;
  bio: string;
  createdAt: string;
  updatedAt: string;
}

// API request types
export interface CreateArticleRequest {
  slug: string;
  title: string;
  content: string;
  excerpt: string;
  categoryId: string;
  authorId: string;
  featuredImage: string;
  tags: string[];
  readTime: number;
  status: 'draft' | 'published' | 'archived';
  publishedAt: string;
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
}

export interface UpdateArticleRequest extends Partial<CreateArticleRequest> {}

export interface CreateCategoryRequest {
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  parentCategory: string | null;
  featured: boolean;
}

export interface UpdateCategoryRequest extends Partial<CreateCategoryRequest> {}

export interface FileRecord {
  _id: string;
  originalname: string;
  filename: string;
  type: string;
  size: number;
  url: string;
  createdAt: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  role: 'superuser' | 'admin' | 'editor' | 'author' | 'user';
  avatar: string;
  bio: string;
}

export interface UpdateUserRequest extends Partial<CreateUserRequest> {}