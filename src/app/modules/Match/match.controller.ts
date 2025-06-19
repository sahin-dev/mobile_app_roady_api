import catchAsync from "../../../shared/catchAsync";

import sendResponse from "../../../shared/ApiResponse";
import {  matchService} from "./match.service";
import { Request, Response } from "express";
import httpStatus from "http-status";



const getMatchingUsers = catchAsync(async (req:Request, res:Response)=>{
  
    const userId = req.user.id
    const {page , limit} = req.query as {page:string, limit:string}
    
    const result = await matchService.getMatchingUsres(userId, parseInt(page), parseInt(limit))

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Matching users retrieved successfully!",
      data: result,
    });
})

export const matchController = {
    getMatchingUsers
}