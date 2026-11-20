export type DecimalDraft =
  | { readonly state: 'empty' | 'incomplete' | 'invalid' }
  | { readonly state: 'valid'; readonly value: string };
