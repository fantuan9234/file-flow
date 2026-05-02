export type ContentCategory = 'contract' | 'invoice' | 'resume' | 'report' | 'other';

export interface ContentClassificationResult {
  category: ContentCategory;
  confidence: number;
  matchedKeywords: string[];
}

const keywordDictionary: Record<ContentCategory, string[]> = {
  contract: [
    '合同', '协议', '甲方', '乙方', '签署', '生效', '违约', '赔偿',
    '条款', '双方', '约定', '权利', '义务', 'contract', 'agreement', 'party',
  ],
  invoice: [
    '发票', '金额', '税额', '开票', '购买方', '销售方', '纳税人识别号',
    'invoice', 'amount', 'tax', 'receipt', 'billing',
  ],
  resume: [
    '简历', '教育背景', '工作经历', '技能', '项目经验', '自我评价',
    '联系方式', '求职意向', 'resume', 'experience', 'education', 'skills',
  ],
  report: [
    '报告', '摘要', '结论', '分析', '数据', '统计', '调研',
    'report', 'summary', 'analysis', 'conclusion', 'data',
  ],
  other: [],
};

export function classifyContent(text: string): ContentClassificationResult {
  const lowerText = text.toLowerCase();
  const scores: Record<ContentCategory, number> = {
    contract: 0,
    invoice: 0,
    resume: 0,
    report: 0,
    other: 0,
  };

  for (const [category, keywords] of Object.entries(keywordDictionary)) {
    if (category === 'other') continue;
    
    let matchCount = 0;
    const matchedKeywords: string[] = [];
    
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        matchCount++;
        matchedKeywords.push(keyword);
      }
    }
    
    scores[category as ContentCategory] = matchCount;
  }

  let bestCategory: ContentCategory = 'other';
  let bestScore = 0;
  let bestMatchedKeywords: string[] = [];

  for (const [category, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category as ContentCategory;
      bestMatchedKeywords = keywordDictionary[category as ContentCategory].filter(kw =>
        lowerText.includes(kw.toLowerCase())
      );
    }
  }

  const confidence = bestScore > 0 ? Math.min(bestScore / 5, 1) : 0;

  return {
    category: bestCategory,
    confidence,
    matchedKeywords: bestMatchedKeywords.slice(0, 5),
  };
}
