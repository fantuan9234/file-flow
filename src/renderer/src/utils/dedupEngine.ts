import fs from 'fs';
import { createHash } from 'crypto';

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  mtime: string;
}

export interface DuplicateGroup {
  hash?: string;
  similarity?: number;
  files: FileInfo[];
}

export interface DedupResult {
  groups: DuplicateGroup[];
  totalDuplicates: number;
}

function calculateMD5(filePath: string): string {
  const hash = createHash('md5');
  const buffer = fs.readFileSync(filePath);
  hash.update(buffer);
  return hash.digest('hex');
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function textSimilarity(a: string, b: string): number {
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  return 1 - distance / maxLength;
}

export function findExactDuplicates(files: FileInfo[]): DedupResult {
  const hashMap = new Map<string, FileInfo[]>();

  for (const file of files) {
    try {
      const hash = calculateMD5(file.path);
      if (!hashMap.has(hash)) {
        hashMap.set(hash, []);
      }
      hashMap.get(hash)!.push(file);
    } catch {
      // Skip files that cannot be read
    }
  }

  const groups: DuplicateGroup[] = [];
  for (const [hash, groupFiles] of hashMap) {
    if (groupFiles.length > 1) {
      groups.push({ hash, files: groupFiles });
    }
  }

  return {
    groups,
    totalDuplicates: groups.reduce((sum, g) => sum + g.files.length - 1, 0),
  };
}

export function findSimilarDuplicates(files: FileInfo[], threshold: number = 0.9): DedupResult {
  const groups: DuplicateGroup[] = [];
  const used = new Set<string>();

  for (let i = 0; i < files.length; i++) {
    if (used.has(files[i].path)) continue;

    const group: FileInfo[] = [files[i]];
    used.add(files[i].path);

    try {
      const contentA = fs.readFileSync(files[i].path, 'utf-8');

      for (let j = i + 1; j < files.length; j++) {
        if (used.has(files[j].path)) continue;

        try {
          const contentB = fs.readFileSync(files[j].path, 'utf-8');
          const similarity = textSimilarity(contentA, contentB);

          if (similarity >= threshold) {
            group.push(files[j]);
            used.add(files[j].path);
          }
        } catch {
          // Skip files that cannot be read
        }
      }
    } catch {
      // Skip files that cannot be read
    }

    if (group.length > 1) {
      const avgSimilarity = group.length > 1 ? threshold : 1;
      groups.push({ similarity: avgSimilarity, files: group });
    }
  }

  return {
    groups,
    totalDuplicates: groups.reduce((sum, g) => sum + g.files.length - 1, 0),
  };
}
