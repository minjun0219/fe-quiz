import type { Category } from "./question.schema";

interface CategoryScoreEntry {
  correct: number;
  total: number;
}

/** jsonb-shaped: a partial map from Category to per-category aggregate. */
type CategoryScoresJson = Partial<Record<Category, CategoryScoreEntry>>;

export type Database = {
  public: {
    Tables: {
      shares: {
        Row: {
          id: string;
          question_ids: string[];
          /** 0-100 inclusive (DB CHECK constraint) */
          score: number;
          feedback: string;
          result_type: string;
          category_scores: CategoryScoresJson;
          created_at: string;
        };
        Insert: {
          id: string;
          question_ids: string[];
          score: number;
          feedback: string;
          result_type: string;
          category_scores: CategoryScoresJson;
          created_at?: string;
        };
        Update: {
          id?: string;
          question_ids?: string[];
          score?: number;
          feedback?: string;
          result_type?: string;
          category_scores?: CategoryScoresJson;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
