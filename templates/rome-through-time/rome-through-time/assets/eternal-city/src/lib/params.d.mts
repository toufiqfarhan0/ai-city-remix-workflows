export type Lang = 'en' | 'zh-CN'
export declare const LANGS: Lang[]
export declare function normLang(value: unknown): Lang
export interface Params {
  lang: Lang
  embed: boolean
  tune: boolean
  quality: 'low' | 'high' | null
  capture: boolean
}
export declare function parseParams(search: string | null | undefined): Params
