/**
 * Utility to check if an error is a 401 authentication error
 * Returns true if the error should be silently handled (auth error)
 * Returns false if the error should be displayed to the user
 */
export const isAuthError = (error: any): boolean => {
  return error?.response?.status === 401;
};

/**
 * Utility to check if an error is a 403 forbidden error
 */
export const isForbiddenError = (error: any): boolean => {
  return error?.response?.status === 403;
};

/**
 * Handle API errors consistently across the application
 * @param error - The error object from axios
 * @param defaultMessage - Default message to show if no specific error message
 * @returns Error message to display, or null if it's an auth error
 */
export const handleApiError = (error: any, defaultMessage: string = 'An error occurred'): string | null => {
  // Don't show error messages for 401 - the router handles authentication
  if (isAuthError(error)) {
    console.log('Authentication error - user will be redirected to login');
    return null;
  }

  // Provide user-friendly message for 403 errors
  if (isForbiddenError(error)) {
    const forbiddenMessage = error?.response?.data?.error || 'You do not have permission to access this resource';
    console.error('Permission denied:', forbiddenMessage);
    return forbiddenMessage;
  }

  // Extract error message from response
  const errorMessage = 
    error?.response?.data?.detail || 
    error?.response?.data?.error || 
    error?.message || 
    defaultMessage;

  console.error('API Error:', errorMessage, error);
  return errorMessage;
};

/**
 * Wrapper for async API calls that handles errors consistently
 * @param apiCall - The async function to execute
 * @param onSuccess - Callback for successful execution
 * @param onError - Callback for error handling (receives error message or null for auth errors)
 */
export const withErrorHandling = async <T>(
  apiCall: () => Promise<T>,
  onSuccess?: (data: T) => void,
  onError?: (errorMessage: string | null) => void
): Promise<T | null> => {
  try {
    const result = await apiCall();
    if (onSuccess) {
      onSuccess(result);
    }
    return result;
  } catch (error: any) {
    const errorMessage = handleApiError(error);
    if (onError) {
      onError(errorMessage);
    }
    return null;
  }
};
