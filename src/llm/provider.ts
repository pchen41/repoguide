export type ProviderResult =
  | { type: 'guide'; markdown: string }
  | { type: 'no-guide' }
  | { type: 'error'; message: string };

export interface GuideProvider {
  generateGuide(folderPath: string, prompt: string): Promise<ProviderResult>;
}
