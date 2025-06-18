import express from 'express';
import { validate } from 'node-cron';
import validateRequest from '../../middlewares/validation.middleware';
import { chatValidation } from './chat.validation';
import { UserRole } from '@prisma/client';
import auth from '../../middlewares/auth.middleware';
import { chatController } from './chat.controller';
import { fileUploader } from '../../../helpers/fileUploader';
import checkSubscription from '../../middlewares/subscription.middleware';

const router = express.Router();


router.post(
  '/',
  validateRequest(chatValidation.chatSchema),
  auth(),
  chatController.saveChat
);

router.post ('/super-message', validateRequest(chatValidation.chatSchema), auth(),checkSubscription, chatController.sendSuperMessage)
router.get(
  '/',
  auth(),
  chatController.getChats
);

router.get("/rooms", auth(), chatController.getRooms)
router.get(
  '/:id',
  auth(),
  chatController.getChatById
);

router.put(
  '/:id',
  validateRequest(chatValidation.chatSchema),
  auth(),
  chatController.updateChat
);

router.delete(
  '/:id',
  auth(),
  chatController.deleteChat
);


router.post(
  '/image-upload',
  fileUploader.uploadMultipleImage,
  auth(),
  chatController.imageUpload
);





export const chatRoutes = router;