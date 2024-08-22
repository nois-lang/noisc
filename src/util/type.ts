export type ExtractKeys<T> = T extends any ? keyof T : never
