
import ApiError from '../../../errors/ApiError';
import { fileUploader } from '../../../helpers/fileUploader';
import prisma from '../../../shared/prisma';
import httpstatus from 'http-status'

const saveChatIntoDb = async (user: any, payload: any) => {
  
  const chat = await prisma.chat.create({
    data: {
      message: payload.message,
      senderId: user.id,
      roomId: payload.roomId,
      receiverId: payload.receiverId,
    },
  });

  return chat;
};

const sendSuperMessager = async (user:any, payload: any)=>{
  const receiver = await prisma.user.findUnique({where:{id:payload.receiverId}})
  if (!receiver){
    throw new ApiError(httpstatus.NOT_FOUND, "Reciever not found")
  }

  const room = await prisma.room.create({data:{senderId:user.id, receiverId:payload.receiverId}})

  const chat = await prisma.chat.create({
    data:{senderId:user.id,receiverId:payload.receiverId, roomId:room.id,message:payload.message}
  })

  return {message:"super message sent."}
}


const getChatFromDb = async (user: any, payload: any) => {
  const chats = await prisma.chat.findMany({
    where: {
      OR: [
        {
          senderId: user.id,
          receiverId: payload.receiverId,
        },
        {
          senderId: payload.receiverId,
          receiverId: user.id,
        },
      ],
    },
  });

  return chats;
};

const getMyRooms = async (user:any)=>{

  const rooms = await prisma.room.findMany({where:{OR:[{senderId:user.id}, {receiverId:user.id}]}, include:{sender:true, receiver:true}})

  return rooms
}

const getChatByIdFromDb = async (user: any, id: string) => {
  const chat = await prisma.chat.findFirst({
    where: {
      id: id,
    },
  });

  return chat;
};

const updateChatInDb = async (user: any, id: string, payload: any) => {
  const chat = await prisma.chat.update({
    where: {
      id: id,
    },
    data: {
      message: payload.message,
    },
  });

  return chat;
};

const deleteChatFromDb = async (user: any, id: string) => {
  const chat = await prisma.chat.delete({
    where: {
      id: id,
    },
  });

  return chat;
};

// upload image 
const imageUpload = async (files: Express.Multer.File[]) => {
  console.log("Uploading image")
  if (!Array.isArray(files)) {
    throw new TypeError("Expected an array of files");
  }
  const uploadPromises = files.map(async (file) => {
    const uploadResponse = await fileUploader.uploadToDigitalOcean(file);
    if (!uploadResponse || !uploadResponse.Location) {
      throw new ApiError(500, "Failed to upload file");
    }
    return uploadResponse.Location;
  });

  const fileUrls = await Promise.all(uploadPromises);

  return fileUrls;
};


export const chatServices = {
  saveChatIntoDb,
  getChatFromDb,
  getChatByIdFromDb,
  updateChatInDb,
  deleteChatFromDb,
  imageUpload,
  sendSuperMessager,
  getMyRooms
};
