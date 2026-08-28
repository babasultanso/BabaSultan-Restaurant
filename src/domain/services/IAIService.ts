export interface AIChatResponse {
  detectedLanguage: 'en' | 'ar' | 'so';
  reply: string;
  actionTaken?: string | null;
  actionPayload?: any;
  suggestedQuestions?: string[];
}

export interface IAIService {
  askAIAdvisor(prompt: string, language: string, currentData: any): Promise<AIChatResponse>;
}
