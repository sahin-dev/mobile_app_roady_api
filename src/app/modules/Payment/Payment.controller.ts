import { Request, Response } from 'express';
import { PaymentService } from './Payment.service';
import httpStatus from 'http-status';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/ApiResponse';
import { IUser } from '../User/user.interface';
import { User } from '@prisma/client';


// Create Price
const createPrice = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.createPrice(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Price created successfully!',
    data: result,
  });
});

// Get All Prices
const getAllPrices = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.getAllPrices();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Prices fetched successfully!',
    data: result,
  });
});

// Get Price by ID
const getPriceById = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.getPriceById(req.params.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Price fetched successfully!',
    data: result,
  });
});

// Update Price
const updatePrice = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.updatePrice(req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Price updated successfully!',
    data: result,
  });
});

// Delete Price
const deletePrice = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.deletePrice(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Price deleted successfully!',
    data: result,
  });
});

// buy subscription
const buySubscription = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.buySubscription(req.body,req.user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Buy Subscription successfully!',
    data: result,
  });
});
const updateSubscription = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.updateSubscription(req.body,req.user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Buy Subscription successfully!',
    data: result,
  });
});
const cancelSubscription = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.cancelSubscription(req.user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'cancel Subscription successfully!',
    data: result,
  });
});
const handelPaymentWebhook = catchAsync(async (req, res) => {
  const result = await PaymentService.handelPaymentWebhook(req);
  console.log("handelPaymentWebhookc")
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'webhook Subscription successfully!',
    data: result,
  });
});
const getLastDayTransaction = catchAsync(async (req, res) => {
  const result = await PaymentService.getLastDayTransaction();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'last 24 hours transaction!',
    data: result,
  });
});
const getAllRevenue = catchAsync(async (req, res) => {
  const result = await PaymentService.getAllRevenue();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'total transaction!',
    data: result,
  });
});
const getMemberCount = catchAsync(async (req, res) => {
  const result = await PaymentService.getMemberCount();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'total member count!',
    data: result,
  });
});
const monthlyStatistics = catchAsync(async (req, res) => {
  const query=req.query
  const result = await PaymentService.monthlyStatistics(query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'monthly statistic!',
    data: result,
  });
});
const getPackageByPriceId = catchAsync(async (req, res) => {
  const id=req.params.id
  const result = await PaymentService.getPackageByPriceId(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'get package by price id !',
    data: result,
  });
});
const getMemberPlanCount = catchAsync(async (req, res) => {
  const query=req.query
  const result = await PaymentService.getMemberPlanCount(query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'get member plane!',
    data: result,
  });
});
const getAllPayments = catchAsync(async (req, res) => {
  const query=req.query
  const result = await PaymentService.getAllPayments();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'all payment info!',
    data: result,
  });
});

const getAllStripePrices = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.getAllPricesFromStripe();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Prices fetched successfully!',
    data: result,
  });
});

const getAllStripeProducts = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.getAllStripeProducts(); 
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Products fetched successfully!',
    data: result,
  });
});

const createIntent = catchAsync(async (req: Request, res: Response) => {
  const { planName, } = req.params;  
  const {methodId} = req.body
  const user = req.user as User; // Cast req.user to IUser type

  const result = await PaymentService.createIntent(planName, user,methodId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment intent created successfully!',
    data: result,
  });
}
);

const boostProfile = catchAsync(async (req:Request, res:Response)=>{
  
})

export const PaymentController = {
  createPrice,
  getAllPrices,
  getPriceById,
  updatePrice,
  deletePrice,
  buySubscription,
  updateSubscription,
  cancelSubscription,
  handelPaymentWebhook,
  getLastDayTransaction,
  getAllRevenue,
  getMemberCount,
  monthlyStatistics,
  getMemberPlanCount,
  getAllPayments,
  getPackageByPriceId,
  getAllStripePrices,
  getAllStripeProducts,
  createIntent
};
