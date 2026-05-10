export type Timestamp = string;

export type Category = string;

export interface UserCategory {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  expiryDate: string; // ISO string
  category: Category;
  price?: number;
  observations?: string;
  imageURL?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface SupabaseErrorInfo {
  error: string;
  operationType: OperationType;
  table: string | null;
  userId?: string | null;
}
