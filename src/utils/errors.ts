export class AppError extends Error {
  statusCode: number;
  constructor(err: string, statusCode = 500) {
    super(err);
    this.statusCode = statusCode;
  }
}