import { body, param, query, ValidationChain } from 'express-validator';
import { Types } from 'mongoose';

export class MessageValidator {
  public static getMessagesByConversationId(): ValidationChain[] {
    return [
      param('conversationId')
        .notEmpty()
        .withMessage('Conversation ID is required')
        .custom((value) => {
          if (!Types.ObjectId.isValid(value)) {
            throw new Error('Invalid conversation ID format');
          }
          return true;
        }),
      
      query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer')
        .toInt(),
      
      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
        .toInt()
    ];
  }

  public static createMessage(): ValidationChain[] {
    return [
      body('conversationId')
        .notEmpty()
        .withMessage('Conversation ID is required')
        .custom((value) => {
          if (!Types.ObjectId.isValid(value)) {
            throw new Error('Invalid conversation ID format');
          }
          return true;
        }),
      
      body('content')
        .notEmpty()
        .withMessage('Message content is required')
        .isString()
        .withMessage('Message content must be a string')
        .trim()
        .isLength({ min: 1, max: 1000 })
        .withMessage('Message content must be between 1 and 1000 characters')
    ];
  }
}

export const messageValidator = MessageValidator;
