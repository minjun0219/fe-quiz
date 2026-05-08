export type Database = {
  public: {
    Tables: {
      shares: {
        Row: {
          id: string;
          question_ids: string[];
          score: number;
          feedback: string;
          result_type: string;
          category_scores: Record<string, number>;
          created_at: string;
        };
        Insert: {
          id: string;
          question_ids: string[];
          score: number;
          feedback: string;
          result_type: string;
          category_scores: Record<string, number>;
          created_at?: string;
        };
        Update: Partial<{
          id: string;
          question_ids: string[];
          score: number;
          feedback: string;
          result_type: string;
          category_scores: Record<string, number>;
          created_at: string;
        }>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
