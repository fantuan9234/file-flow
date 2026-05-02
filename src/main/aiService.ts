import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_ENDPOINT = 'http://localhost:11434';
const OLLAMA_ERROR_HINT = 'Ollama 服务未启动，请确保 Ollama 已安装并运行';

interface AISettings {
  provider: 'ollama' | 'lmstudio';
  endpoint: string;
  apiKey?: string;
}

function loadAISettings(): AISettings {
  try {
    const saved = fs.readFileSync(
      path.join(app.getPath('userData'), 'ai-settings.json'),
      'utf-8'
    );
    return JSON.parse(saved);
  } catch {
    return { provider: 'ollama', endpoint: DEFAULT_ENDPOINT };
  }
}

async function getOllamaModels(endpoint: string): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${endpoint}/api/tags`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.models || []).map((m: any) => m.name || m);
  } catch {
    return [];
  }
}

async function getLMStudioModels(endpoint: string): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${endpoint}/v1/models`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.data || []).map((m: any) => m.id || m.name || m);
  } catch {
    return [];
  }
}

export async function getModelList(endpoint: string, provider: 'ollama' | 'lmstudio'): Promise<string[]> {
  if (provider === 'lmstudio') {
    return getLMStudioModels(endpoint);
  }
  return getOllamaModels(endpoint);
}

export async function callAI(prompt: string, text: string): Promise<string> {
  const settings = loadAISettings();
  const models = await getModelList(settings.endpoint, settings.provider);
  const model = models.length > 0 ? models[0] : (settings.provider === 'lmstudio' ? 'auto' : 'qwen2.5:1.5b');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 5000);

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (settings.apiKey) {
      headers['Authorization'] = `Bearer ${settings.apiKey}`;
    }

    let url: string;
    let body: object;

    if (settings.provider === 'lmstudio') {
      url = `${settings.endpoint}/v1/chat/completions`;
      body = {
        model,
        messages: [{ role: 'user', content: `${prompt}\n\n${text}` }],
        temperature: 0.1,
        max_tokens: 50,
      };
    } else {
      url = `${settings.endpoint}/api/chat`;
      body = {
        model,
        messages: [{ role: 'user', content: `${prompt}\n\n${text}` }],
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 50,
        },
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    let content: string | undefined;
    if (settings.provider === 'lmstudio') {
      content = data.choices?.[0]?.message?.content?.trim();
    } else {
      content = data.message?.content?.trim() || data.response?.trim();
    }

    if (!content) {
      throw new Error('Empty response from AI');
    }
    return content;
  } catch (error: any) {
    clearTimeout(timeoutId);
    const msg = error?.message || String(error);
    if (msg.includes('fetch') || msg.includes('ECONNREFUSED')) {
      throw new Error(OLLAMA_ERROR_HINT);
    }
    throw new Error(msg);
  }
}

export function parseCategory(aiResponse: string): string {
  const normalized = aiResponse.trim().toLowerCase();
  const categoryMap: Record<string, string> = {
    '合同': 'contract',
    'contract': 'contract',
    '发票': 'invoice',
    'invoice': 'invoice',
    '收据': 'invoice',
    'receipt': 'invoice',
    '简历': 'resume',
    'resume': 'resume',
    '报告': 'report',
    'report': 'report',
    '其他': 'other',
    'other': 'other',
  };

  for (const [key, value] of Object.entries(categoryMap)) {
    if (normalized.includes(key)) {
      return value;
    }
  }

  return 'other';
}
