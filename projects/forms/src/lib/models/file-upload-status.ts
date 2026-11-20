export type FileUploadStatus =
  | { readonly state: 'uploading'; readonly progress?: number; readonly message?: string }
  | { readonly state: 'complete' | 'failed'; readonly message?: string };
