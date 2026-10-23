export function successResponse(res, data = {}, message = null, statusCode = 200) {
  const payload = { success: true, ...data };
  if (message) payload.message = message;
  return res.status(statusCode).json(payload);
}

export function errorResponse(res, message = 'An error occurred', statusCode = 400, details = null) {
  const payload = { success: false, error: message };
  if (details) payload.details = details;
  return res.status(statusCode).json(payload);
}
