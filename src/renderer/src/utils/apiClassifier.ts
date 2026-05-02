export type APIProvider = 'openai' | 'deepseek';

export interface APIConfig {
  provider: APIProvider;
  apiKey: string;
  model: string;
}

export interface APIClassificationResult {
  success: boolean;
  category: string;
  confidence: number;
  reasoning?: string;
  error?: string;
}

const PROVIDER_CONFIG: Record<APIProvider, { baseUrl: string; defaultModel: string }> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
  },
};

const SYSTEM_PROMPT = `You are a document classification assistant. Classify the following text into one of these categories:
- contract: Legal agreements, contracts, terms of service
- invoice: Bills, receipts, payment records, financial documents
- resume: CVs, job applications, professional profiles
- report: Analysis reports, research papers, summaries, data documents
- other: Documents that don't fit the above categories

Respond with ONLY a JSON object in this format:
{"category": "contract|invoice|resume|report|other", "confidence": 0.0-1.0, "reasoning": "brief explanation"}

Do not include any other text or markdown formatting.`;

export async function classifyWithAPI(
  text: string,
  config: APIConfig
): Promise<APIClassificationResult> {
  const providerConfig = PROVIDER_CONFIG[config.provider];
  const maxText = text.slice(0, 3000);

  try {
    const response = await fetch(`${providerConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || providerConfig.defaultModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Document text:\n${maxText}` },
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        category: 'other',
        confidence: 0,
        error: `API error: ${response.status} ${errorText}`,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[^}]*\}/s);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        const validCategories = ['contract', 'invoice', 'resume', 'report', 'other'];
        if (validCategories.includes(parsed.category)) {
          return {
            success: true,
            category: parsed.category,
            confidence: parseFloat(parsed.confidence) || 0.5,
            reasoning: parsed.reasoning || '',
          };
        }
      } catch {
        // Fall through to keyword extraction
      }
    }

    const lowerText = content.toLowerCase();
    let category = 'other';
    for (const cat of ['contract', 'invoice', 'resume', 'report']) {
      if (lowerText.includes(cat)) {
        category = cat;
        break;
      }
    }

    return {
      success: true,
      category,
      confidence: 0.5,
      reasoning: 'Parsed from response text',
    };
  } catch (error: any) {
    return {
      success: false,
      category: 'other',
      confidence: 0,
      error: error?.message || String(error),
    };
  }
}
