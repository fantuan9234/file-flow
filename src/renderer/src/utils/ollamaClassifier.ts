export interface OllamaStatus {
  running: boolean;
  models: string[];
  error?: string;
}

export interface OllamaClassificationResult {
  success: boolean;
  category: string;
  confidence: number;
  reasoning?: string;
  error?: string;
}

export interface OllamaConfig {
  model: string;
  baseUrl: string;
}

const DEFAULT_CONFIG: OllamaConfig = {
  model: 'qwen2.5:1.5b',
  baseUrl: 'http://localhost:11434',
};

export function loadOllamaConfig(): OllamaConfig {
  try {
    const saved = localStorage.getItem('ollama-config');
    if (saved) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_CONFIG;
}

export function saveOllamaConfig(config: Partial<OllamaConfig>): void {
  try {
    const current = loadOllamaConfig();
    const merged = { ...current, ...config };
    localStorage.setItem('ollama-config', JSON.stringify(merged));
  } catch {
    // Ignore storage errors
  }
}

const SYSTEM_PROMPT = `You are a document classification assistant. Classify the following text into one of these categories:
- contract: Legal agreements, contracts, terms of service
- invoice: Bills, receipts, payment records, financial documents
- resume: CVs, job applications, professional profiles
- report: Analysis reports, research papers, summaries, data documents
- other: Documents that don't fit the above categories

Respond with ONLY a JSON object in this format:
{"category": "contract|invoice|resume|report|other", "confidence": 0.0-1.0, "reasoning": "brief explanation"}

Do not include any other text or markdown formatting.`;

export async function classifyWithOllama(
  text: string,
  config?: OllamaConfig
): Promise<OllamaClassificationResult> {
  const cfg = config || loadOllamaConfig();
  const maxText = text.slice(0, 3000);

  try {
    const response = await fetch(`${cfg.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model,
        prompt: `${SYSTEM_PROMPT}\n\nDocument text:\n${maxText}`,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 200,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        category: 'other',
        confidence: 0,
        error: `Ollama API error: ${response.status} ${errorText}`,
      };
    }

    const data = await response.json();
    const responseText = data.response || '';

    const jsonMatch = responseText.match(/\{[^}]*\}/s);
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

    const lowerText = responseText.toLowerCase();
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
