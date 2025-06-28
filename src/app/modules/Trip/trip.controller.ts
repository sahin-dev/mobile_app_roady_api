import sendResponse from "../../../shared/ApiResponse";
import catchAsync from "../../../shared/catchAsync";
import httpStatus from "http-status";
import { Request, Response } from "express";
import { tripServices } from "./trip.service";


const createTrip = catchAsync(async (req: Request, res: Response) => {  
    const user = req.user;
    const result = await tripServices.createTrip(user.id, req.body);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Trip created successfully",
      data: result,
    });
  }
);

const getMyTrips = catchAsync(async (req: Request, res: Response) => {
    const {userId} = req.body;
    const result = await tripServices.getMyTrips(userId);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Trips retrieved successfully",
      data: result,
    });
  }
);

const getTripById = catchAsync(async (req: Request, res: Response) => {
    const user = req.user;
    const result = await tripServices.getTripById(user.id, req.params.id);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Trip retrieved successfully",
      data: result,
    });
  }
);


const imageUpload = catchAsync(async (req: Request, res: Response) => {
    
    if (
      !req.files ||
      !(req.files as { [fieldname: string]: Express.Multer.File[] })['images'] ||
      !Array.isArray((req.files as { [fieldname: string]: Express.Multer.File[] })['images'])
    ) {
      throw new TypeError('Expected an array of files in req.files["images"]');
    }
    console.log("hi")
    const result = await tripServices.imageUpload(
      (req.files as { [fieldname: string]: Express.Multer.File[] })['images']
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Image converted to buffer successfully!',
      data: result,
    });
  });

  export const tripController = {
    imageUpload,
    createTrip,
    getMyTrips,
    getTripById,
    
  }