import { Request, Response } from 'express';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/ApiResponse';
import httpStatus from 'http-status';
import ApiError from '../../../errors/ApiError';
import { chatServices } from './chat.service';

const saveChat = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const result = await chatServices.saveChatIntoDb(user, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Chat saved successfully',
    data: result,
  });
});

const sendSuperMessage = catchAsync(async (req:Request, res:Response)=>{

  const user = req.user
  if (!user){
    throw new ApiError (httpStatus.NOT_FOUND, "User not found")
  }

  const result = await chatServices.sendSuperMessager(user, req.body)

  sendResponse(res, {
    statusCode:httpStatus.OK,
    success:true,
    message:"Super message sent",
    data:result
  })

})

const getChats = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const result = await chatServices.getChatFromDb(user, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Chats retrieved successfully',
    data: result,
  });
});

const getRooms = catchAsync( async (req:Request, res:Response)=>{
  const user = req.user
  const result = await chatServices.getMyRooms(user)

  sendResponse(res, {
    success:true,
    data:result,
    message:"Rooms fetched successfully",
    statusCode:httpStatus.OK
  })
})

const getChatById = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const result = await chatServices.getChatByIdFromDb(user, req.params.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Chat retrieved successfully',
    data: result,
  });
});

const updateChat = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const result = await chatServices.updateChatInDb(user, req.params.id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Chat updated successfully',
    data: result,
  });
});

const deleteChat = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  const result = await chatServices.deleteChatFromDb(user, req.params.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Chat deleted successfully',
    data: result,
  });
});

const imageUpload = catchAsync(async (req: Request, res: Response) => {

  if (
    !req.files ||
    !(req.files as { [fieldname: string]: Express.Multer.File[] })['images'] ||
    !Array.isArray((req.files as { [fieldname: string]: Express.Multer.File[] })['images'])
  ) {
    throw new TypeError('Expected an array of files in req.files["images"]');
  }

  const result = await chatServices.imageUpload(
    (req.files as { [fieldname: string]: Express.Multer.File[] })['images']
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Image converted to buffer successfully!',
    data: result,
  });
});

export const chatController = {
  saveChat,
  getChats,
  getChatById,
  updateChat,
  deleteChat,
  imageUpload,
  sendSuperMessage,
  getRooms
};


