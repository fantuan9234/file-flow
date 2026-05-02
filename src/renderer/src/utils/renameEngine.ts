// src/renderer/src/utils/renameEngine.ts

export type RenameRuleType = 'addPrefix' | 'addSuffix' | 'findReplace' | 'insertDate' | 'sequence' | 'regexReplace'

export interface RenameRule {
  type: RenameRuleType
  enabled?: boolean
  findText?: string
  replaceText?: string
  useRegex?: boolean
  regexFlags?: string
  prefix?: string
  suffix?: string
  dateFormat?: string
  insertPosition?: string
  sequenceStart?: number
  sequenceStep?: number
  sequencePadding?: number
  sequencePosition?: string
  params?: {
    prefix?: string
    suffix?: string
    search?: string
    replace?: string
    position?: 'prefix' | 'suffix'
    format?: string
    start?: number
    step?: number
    digits?: number
  }
}

/**
 * 格式化日期
 */
function formatDate(date: Date, format: string): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  
  const tokens: Record<string, string> = {
    'yyyy': String(year),
    'yy': String(year).slice(-2),
    'MM': month,
    'M': String(parseInt(month, 10)),
    'dd': day,
    'd': String(parseInt(day, 10))
  }
  
  return format.replace(/yyyy|yy|MM|M|dd|d/g, match => tokens[match] || match)
}

/**
 * 生成序号字符串
 */
function generateSequenceNumber(index: number, start: number, step: number, digits: number): string {
  const num = start + (index * step)
  return String(num).padStart(digits, '0')
}

/**
 * 应用单条规则到文件名
 */
export function applyRenameRule(nameWithoutExt: string, rule: RenameRule, index: number = 0): string {
  let result = nameWithoutExt
  
  if (rule.type === 'addPrefix') {
    const prefix = rule.prefix || rule.params?.prefix
    if (prefix) {
      result = prefix + result
    }
  } else if (rule.type === 'addSuffix') {
    const suffix = rule.suffix || rule.params?.suffix
    if (suffix) {
      result = result + suffix
    }
  } else if (rule.type === 'findReplace') {
    const search = rule.findText || rule.params?.search
    if (search) {
      const replace = rule.replaceText || rule.params?.replace || ''
      result = result.split(search).join(replace)
    }
  } else if (rule.type === 'insertDate') {
    const format = rule.dateFormat || rule.params?.format
    if (format) {
      const dateStr = formatDate(new Date(), format)
      const position = rule.insertPosition || rule.params?.position || 'prefix'
      
      if (position === 'suffix') {
        result = result + dateStr
      } else {
        result = dateStr + result
      }
    }
  } else if (rule.type === 'sequence') {
    const start = rule.sequenceStart || rule.params?.start || 1
    const step = rule.sequenceStep || rule.params?.step || 1
    const digits = rule.sequencePadding || rule.params?.digits || 3
    const position = rule.sequencePosition || rule.params?.position || 'prefix'
    
    const sequenceStr = generateSequenceNumber(index, start, step, digits)
    
    if (position === 'suffix') {
      result = result + '_' + sequenceStr
    } else {
      result = sequenceStr + '_' + result
    }
  }
  
  return result
}

/**
 * 应用规则链到文件名
 * 按顺序应用所有规则，上一条规则的结果作为下一条规则的输入
 */
export function applyRuleChain(nameWithoutExt: string, rules: RenameRule[], index: number = 0): string {
  let result = nameWithoutExt
  
  for (const rule of rules) {
    result = applyRenameRule(result, rule, index)
  }
  
  return result
}

/**
 * 生成新文件名（支持规则链）
 * @param files 文件列表
 * @param rules 规则数组（规则链）
 * @returns 包含新旧文件名对比的数组
 */
export function generateNewNames(
  files: { path: string; name: string }[],
  rules: RenameRule | RenameRule[]
): { oldPath: string; oldName: string; newName: string; newPath: string }[] {
  const ruleArray = Array.isArray(rules) ? rules : [rules]
  
  return files.map((file, index) => {
    const lastDot = file.name.lastIndexOf('.')
    const nameWithoutExt = lastDot >= 0 ? file.name.substring(0, lastDot) : file.name
    const ext = lastDot >= 0 ? file.name.substring(lastDot) : ''
    
    const newNameWithoutExt = applyRuleChain(nameWithoutExt, ruleArray, index)
    const newName = newNameWithoutExt + ext
    
    return {
      oldPath: file.path,
      oldName: file.name,
      newName: newName,
      newPath: file.path.substring(0, file.path.lastIndexOf(file.name)) + newName,
    }
  })
}
