import { Response } from 'express';

export interface StandardApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface StandardApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string | StandardApiError;
}

export class ApiResponse {
  public static success<T>(res: Response, data?: T, statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      data,
      error: null
    });
  }

  public static error(
    res: Response,
    statusCode: number,
    code: string,
    userFriendlyMessage: string,
    details?: unknown
  ) {
    // Sanitize any potential internal leaks in details
    let safeDetails = details;
    if (details instanceof Error) {
      safeDetails = { message: details.message };
    }

    return res.status(statusCode).json({
      success: false,
      // Backward-compatible string representation:
      error: userFriendlyMessage,
      // Standardized structured error object conforming to requirement 12:
      errorDetails: {
        code,
        message: userFriendlyMessage,
        ...(safeDetails ? { details: safeDetails } : {})
      }
    });
  }
}
