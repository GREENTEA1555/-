
export interface Part {
  id: string;
  name: string;
  category: string; // Changed from enum to string to support dynamic categories
  subcategory: string; 
  price: number;
  description: string;
  imageUrl: string;
  inStock: boolean;
}

export interface PartFormData {
  name: string;
  category: string;
  subcategory: string;
  price: number;
  description: string;
  imageUrl: string;
}

export interface CartItem extends Part {
  quantity: number;
}

// Initial default categories
export const DEFAULT_CATEGORIES = ['PS5', 'PS4', 'XBOX', 'SWITCH'];
