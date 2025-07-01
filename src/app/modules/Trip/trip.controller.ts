import sendResponse from "../../../shared/ApiResponse";
import catchAsync from "../../../shared/catchAsync";
import httpStatus from "http-status";
import { Request, Response } from "express";
import { tripServices } from "./trip.service";
import ApiError from "../../../errors/ApiError";


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

const createTripWithImage = catchAsync(async (req: Request, res: Response) => {  
    const user = req.user;

    // Check for image files in the request
    const files = req.files
        ? (req.files as { [fieldname: string]: Express.Multer.File[] })['images']
        : [];

    // Ensure images exist in the request
    if (!Array.isArray(files) || files.length === 0) {
        throw new ApiError(400, "No images uploaded");
    }

    // Call the createTrip service, passing the user ID, trip data, and files
    const result = await tripServices.createTripWithImage(user.id, req.body, files);

    // Send response with the created trip details
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Trip created successfully",
        data: result,
    });
});


const getMyTrips = catchAsync(async (req: Request, res: Response) => {
    const user = req.user;
    const result = await tripServices.getUserTrips(user.id);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Trips retrieved successfully",
      data: result,
    });
  }
);


const getUserTrips = catchAsync(async (req: Request, res: Response) => {
    const {userId} = req.params;
    const result = await tripServices.getUserTrips(userId);
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
    getUserTrips,
    createTripWithImage
    
  }