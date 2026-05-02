import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { IPC_CHANNELS, SearchFilesResponse, FileInfo, DescribeImageResponse } from '../../../shared/ipc-channels';

const TIMEOUT = 10000;
const IMAGE_TIMEOUT = 30000;

export class SearchService {
  private async callOllama(prompt: string, model: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: {
            temperature: 0.1,
            num_predict: 500,
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      return data.response || '';
    } catch (error: any) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async callOpenAI(prompt: string, apiKey: string, model: string, endpoint: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    try {
      const response = await fetch(`${endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You are a file search assistant. Respond with ONLY a JSON array.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          max_tokens: 1000,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (error: any) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async callLLM(prompt: string, provider: 'ollama' | 'openai', apiKey: string, model: string, endpoint: string): Promise<string> {
    if (provider === 'ollama') {
      return this.callOllama(prompt, model);
    } else {
      return this.callOpenAI(prompt, apiKey, model, endpoint);
    }
  }

  private extractFileContent(filePath: string, maxLength: number = 2000): string {
    try {
      const ext = path.extname(filePath).toLowerCase();
      const stat = fs.statSync(filePath);

      if (stat.size > 1024 * 1024) {
        return '';
      }

      const textExtensions = ['.txt', '.md', '.json', '.csv', '.log', '.xml', '.html', '.htm', '.css', '.js', '.ts', '.py', '.java', '.c', '.cpp', '.h', '.sh', '.bat', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.env', '.gitignore', '.dockerfile', '.sql', '.r', '.rb', '.go', '.rs', '.swift', '.kt', '.dart', '.lua', '.php', '.vue', '.jsx', '.tsx'];

      if (textExtensions.includes(ext)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return content.slice(0, maxLength);
      }

      return '';
    } catch {
      return '';
    }
  }

  async searchFiles(
    files: FileInfo[],
    query: string,
    provider: 'ollama' | 'openai',
    apiKey: string,
    model: string,
    endpoint: string
  ): Promise<{ path: string; name: string; score: number; reason: string }[]> {
    const fileDescriptions = files.map(f => {
      const ext = path.extname(f.name);
      const content = this.extractFileContent(f.path, 500);
      const contentSummary = content ? ` | Content preview: ${content.slice(0, 300)}` : '';
      return `- ${f.name} (${ext.replace('.', '') || 'no extension'}, ${Math.round(f.size / 1024)}KB)${contentSummary}`;
    }).join('\n');

    const prompt = `You are a semantic file search assistant. The user wants to find files related to their query.

Given the following list of files and a search query, return the top matching files ranked by semantic relevance.

Files:
${fileDescriptions}

Search query: "${query}"

Respond with ONLY a JSON array of objects, each with:
- "path": the file path
- "name": the file name
- "score": relevance score from 0 to 100
- "reason": brief explanation of why this file matches

Only include files with score > 20. Sort by score descending. Limit to top 20 results.

Example format:
[{"path":"/docs/report.pdf","name":"report.pdf","score":95,"reason":"Contains quarterly financial report data"},{"path":"/images/chart.png","name":"chart.png","score":60,"reason":"Related visualization of report data"}]`;

    try {
      const responseText = await this.callLLM(prompt, provider, apiKey, model, endpoint);
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return [];
      }

      const results = JSON.parse(jsonMatch[0]);
      return results
        .filter((r: any) => r.score > 20)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 20)
        .map((r: any) => ({
          path: r.path,
          name: r.name,
          score: Math.min(100, Math.max(0, r.score)),
          reason: r.reason || '',
        }));
    } catch (error: any) {
      console.error('[SearchService] Semantic search failed:', error);
      throw error;
    }
  }

  async describeImage(
    imagePath: string,
    provider: 'ollama' | 'openai',
    apiKey: string,
    model: string,
    endpoint: string
  ): Promise<string> {
    if (!fs.existsSync(imagePath)) {
      throw new Error('Image file not found');
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    if (provider === 'ollama') {
      return this.describeImageOllama(base64Image, model);
    } else {
      return this.describeImageOpenAI(base64Image, apiKey, model, endpoint);
    }
  }

  private async describeImageOllama(base64Image: string, model: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMAGE_TIMEOUT);

    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: 'Describe this image in 1-2 sentences. Focus on the main content and key details.',
          images: [base64Image],
          stream: false,
          options: {
            temperature: 0.3,
            num_predict: 200,
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      return data.response || '';
    } catch (error: any) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async describeImageOpenAI(base64Image: string, apiKey: string, model: string, endpoint: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMAGE_TIMEOUT);

    try {
      const response = await fetch(`${endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Describe this image in 1-2 sentences. Focus on the main content and key details.' },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
              ],
            },
          ],
          max_tokens: 200,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (error: any) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  registerIPC() {
    ipcMain.handle(
      IPC_CHANNELS.SEARCH_FILES,
      async (
        _,
        params: {
          files: FileInfo[];
          query: string;
          provider: 'ollama' | 'openai';
          apiKey: string;
          model: string;
          endpoint: string;
        }
      ): Promise<SearchFilesResponse> => {
        try {
          const results = await this.searchFiles(
            params.files,
            params.query,
            params.provider,
            params.apiKey,
            params.model,
            params.endpoint
          );
          return { success: true, results };
        } catch (error: any) {
          console.error('[SearchService] IPC handler error:', error);
          return { success: false, error: error?.message || String(error), results: [] };
        }
      }
    );

    ipcMain.handle(
      IPC_CHANNELS.DESCRIBE_IMAGE,
      async (
        _,
        params: {
          imagePath: string;
          provider: 'ollama' | 'openai';
          apiKey: string;
          model: string;
          endpoint: string;
        }
      ): Promise<DescribeImageResponse> => {
        try {
          const description = await this.describeImage(
            params.imagePath,
            params.provider,
            params.apiKey,
            params.model,
            params.endpoint
          );
          return { success: true, description };
        } catch (error: any) {
          console.error('[SearchService] Describe image handler error:', error);
          return { success: false, error: error?.message || String(error) };
        }
      }
    );
  }
}

export const searchService = new SearchService();
