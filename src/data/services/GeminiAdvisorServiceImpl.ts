import { IAIService, AIChatResponse } from '../../domain/services/IAIService';
import { auth } from '../../lib/firebase';
import { getApiUrl } from '../../lib/apiConfig';

export class GeminiAdvisorServiceImpl implements IAIService {
  async askAIAdvisor(prompt: string, language: string, currentData: any): Promise<AIChatResponse> {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(getApiUrl('/api/ai-chat'), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt,
        language,
        currentData
      })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `AI Server Error: ${res.statusText}`);
    }

    const data: AIChatResponse = await res.json();
    return data;
  }
}
