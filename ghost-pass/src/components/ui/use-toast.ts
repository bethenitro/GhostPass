// Compatibility wrapper for toast API
// This provides a shadcn/ui-like toast API that wraps our existing toast implementation

import { useToast as useToastOriginal } from './toast';

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

export const useToast = () => {
  const { showToast } = useToastOriginal();

  const toast = (options: ToastOptions) => {
    const message = options.description || options.title || '';
    const type = options.variant === 'destructive' ? 'error' : 'success';
    showToast(message, type);
  };

  return { toast };
};
