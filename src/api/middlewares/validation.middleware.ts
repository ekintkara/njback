import { Request, Response, NextFunction } from 'express';
import { validate, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { validationResult } from 'express-validator';
import { AppError } from '../../utils/app-error';

export function validationMiddleware<T extends object>(
  dtoClass: new () => T,
  source: 'body' | 'query' = 'body',
  skipMissingProperties = false
) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const sourceData = source === 'query' ? req.query : req.body;
      const dto = plainToClass(dtoClass, sourceData);

      const errors: ValidationError[] = await validate(dto, {
        skipMissingProperties,
        whitelist: true,
        forbidNonWhitelisted: false
      });

      if (errors.length > 0) {
        throw new AppError(
          'Validation failed',
          400,
          'VALIDATION_ERROR'
        );
      }

      if (source === 'query') {
        req.query = dto as any;
      } else {
        req.body = dto;
      }
      next();
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
      } else {
        next(new AppError('Validation failed', 400, 'VALIDATION_ERROR'));
      }
    }
  };
}

export const validateRequest = (req: Request, _res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg).join(', ');
    throw new AppError(`Validation failed: ${errorMessages}`, 400, 'VALIDATION_ERROR');
  }
  next();
};
