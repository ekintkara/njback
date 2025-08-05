import { body, param, query } from 'express-validator';
import { Types } from 'mongoose';
export const createConversationValidator = [
  body('participantId')
    .notEmpty()
    .withMessage('Participant ID is required')
    .isString()
    .withMessage('Participant ID must be a string')
    .custom((value: string) => {
      if (!Types.ObjectId.isValid(value)) {
        throw new Error('Invalid participant ID format');
      }
      return true;
    })
    .withMessage('Invalid participant ID format')
];
export const getConversationValidator = [
  param('conversationId')
    .notEmpty()
    .withMessage('Conversation ID is required')
    .isString()
    .withMessage('Conversation ID must be a string')
    .custom((value: string) => {
      if (!Types.ObjectId.isValid(value)) {
        throw new Error('Invalid conversation ID format');
      }
      return true;
    })
    .withMessage('Invalid conversation ID format')
];
export const getConversationsValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  query('search')
    .optional()
    .isString()
    .withMessage('Search must be a string')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search must be between 1 and 100 characters')
];
export const deleteConversationValidator = [
  param('conversationId')
    .notEmpty()
    .withMessage('Conversation ID is required')
    .isString()
    .withMessage('Conversation ID must be a string')
    .custom((value: string) => {
      if (!Types.ObjectId.isValid(value)) {
        throw new Error('Invalid conversation ID format');
      }
      return true;
    })
    .withMessage('Invalid conversation ID format')
];
