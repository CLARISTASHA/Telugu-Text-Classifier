// src/api/classification.ts

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface ClassificationResult {
  category_english: string;
  category_telugu: string;
  confidence: number;
  all_probabilities: Record<string, number>;
}

export class ClassificationAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'ClassificationAPIError';
  }
}

export const classificationAPI = {
  /**
   * Classify Telugu text
   */
  async classifyText(text: string): Promise<ClassificationResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/classify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ClassificationAPIError(
          error.detail || 'Classification failed',
          response.status
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ClassificationAPIError) {
        throw error;
      }
      throw new ClassificationAPIError(
        'Failed to connect to backend. Make sure backend is running on port 8000.'
      );
    }
  },

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; models_loaded: boolean }> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return await response.json();
    } catch (error) {
      throw new ClassificationAPIError('Backend is not reachable');
    }
  },
};