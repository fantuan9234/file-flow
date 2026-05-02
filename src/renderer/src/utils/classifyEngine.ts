import path from 'path';

export type ClassifyRuleType = 'byExtension' | 'byKeyword' | 'bySize' | 'byDate';

export interface ClassifyRule {
  type: ClassifyRuleType;
  params: {
    extension?: string;
    keyword?: string;
    maxSize?: number;
    minSize?: number;
    days?: number;
    dateMode?: 'older' | 'newer';
  };
  targetFolder: string;
}

export interface ClassifyResult {
  oldPath: string;
  newPath: string;
  matchedRule: string;
}

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  mtime: string;
}

function matchesRule(file: FileInfo, rule: ClassifyRule): boolean {
  switch (rule.type) {
    case 'byExtension': {
      if (!rule.params.extension) return false;
      const fileExt = path.extname(file.name).toLowerCase().replace('.', '');
      const targetExt = rule.params.extension.toLowerCase().replace('.', '');
      return fileExt === targetExt;
    }

    case 'byKeyword': {
      if (!rule.params.keyword) return false;
      return file.name.includes(rule.params.keyword);
    }

    case 'bySize': {
      const { maxSize, minSize } = rule.params;
      if (minSize !== undefined && maxSize !== undefined) {
        return file.size >= minSize && file.size <= maxSize;
      }
      if (maxSize !== undefined) {
        return file.size <= maxSize;
      }
      if (minSize !== undefined) {
        return file.size >= minSize;
      }
      return false;
    }

    case 'byDate': {
      if (!rule.params.days) return false;
      const fileDate = new Date(file.mtime);
      const now = new Date();
      const diffDays = (now.getTime() - fileDate.getTime()) / (1000 * 60 * 60 * 24);
      const mode = rule.params.dateMode || 'older';
      return mode === 'older' ? diffDays >= rule.params.days : diffDays <= rule.params.days;
    }

    default:
      return false;
  }
}

export function classifyFiles(
  files: FileInfo[],
  rules: ClassifyRule[],
  baseFolder: string
): ClassifyResult[] {
  const results: ClassifyResult[] = [];

  for (const file of files) {
    for (const rule of rules) {
      if (matchesRule(file, rule)) {
        const targetDir = path.join(baseFolder, rule.targetFolder);
        const newPath = path.join(targetDir, file.name);

        if (file.path === newPath) {
          break;
        }

        results.push({
          oldPath: file.path,
          newPath,
          matchedRule: rule.targetFolder,
        });
        break;
      }
    }
  }

  return results;
}
