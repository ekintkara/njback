import { Request, Response, NextFunction } from 'express';
import { validate, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { AppError } from '../../utils/app-error';

export function validationMiddleware<T extends object>(
  dtoClass: new () => T,
  skipMissingProperties = false
) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const dto = plainToClass(dtoClass, req.body);

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

      req.body = dto;
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
