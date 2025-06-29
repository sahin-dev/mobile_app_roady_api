import { get } from "http";
import ApiError from "../../../errors/ApiError";
import { fileUploader } from "../../../helpers/fileUploader";
import prisma from "../../../shared/prisma";


export const createTrip = async (id:string,payload:any) => {
    const user = await prisma.user.findUnique({where:{id}})
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    const trip = await prisma.trip.create({
        data: {
            ...payload,
            userId: id,
        },
    })

    return trip
}


const getUserTrips = async (id:string) => {
    const user = await prisma.user.findUnique({where:{id}})
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    const trips = await prisma.trip.findMany({where:{userId:id}})
    if (!trips) {   
        throw new ApiError(404, "No trips found for this user");
    }
    return trips
}

const getTripById = async (id:string,tripId:string) => {
    const user = await prisma.user.findUnique({where:{id}})
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    const trip = await prisma.trip.findUnique({where:{id:tripId}})  
    if (!trip) {
        throw new ApiError(404, "Trip not found");
    }
    return trip
}

const updateTrip = async (id:string,tripId:string,payload:any) => {
    const user = await prisma.user.findUnique({where:{id}})
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    const trip = await prisma.trip.update({where:{id:tripId},data:payload})  
    if (!trip) {
        throw new ApiError(404, "Trip not found");
    }
    return trip
}

// upload image 
const imageUpload = async (files: Express.Multer.File[]) => {
    
    if (!Array.isArray(files)) {
      throw new TypeError("Expected an array of files");
    }
    console.log("files")
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
  

  export const tripServices = {
    createTrip,
    imageUpload,
    getUserTrips,
    getTripById,
    updateTrip
  }