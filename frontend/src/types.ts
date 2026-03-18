export interface PlanSwiftItem {
  Item: string;
  Qty: number;
  System?: string;
  unitCost?: number | null;
  labor?: number | null;
}

export interface AggregatedItem {
  System: string;
  Format: string;
  Item: string;
  Qty: number;
  OriginalQty: number;
  Unit: string;
  unitCost?: number | null;
  labor?: number | null;
}

export type ClassificationMode = 'RULE_BASED' | 'AI_POWERED';

export type UserRole = 'READ_ONLY' | 'END_USER' | 'POWER_USER' | 'ADMIN';

export interface SystemMapping {
  [key: string]: string;
}

export interface SectionRule {
  keywords: string[];
  section: string;
  unit: string;
}

export interface User {
  id: string;
  name: string;
  username: string;
  password?: string;
  role: UserRole;
}
