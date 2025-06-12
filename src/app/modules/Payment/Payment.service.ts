
import { Request } from 'express';

import httpStatus from 'http-status';
import { JwtPayload } from 'jsonwebtoken';

import Stripe from 'stripe';
import prisma from '../../../shared/prisma';
import ApiError from '../../../errors/ApiError';
import { IUser } from '../User/user.interface';
import config from '../../../config';
import { get } from 'http';
import products from '../../../helpers/products';
import { User } from '@prisma/client';




const stripe = require('stripe')(
config.stripe_key,
{apiVersion: '2025-03-31.basil',}
);

export interface IBuySubscription {
  email: string;
  priceId: string;
  methodId: string;
  couponId?: string;
}
const createPrice = async (payload: any) => {
  try {
    const result = await prisma.$transaction(async (tx:any) => {
      // Step 1: Create Product in Stripe
      const product = await stripe.products.create({
        name: payload.name,
        description: payload.description,
        active: payload.active,
      });

      const unitAmount = Math.round(payload.amount * 100);  // Ensure unit_amount is a valid integer

      // Step 2: Create Price in Stripe
      const price = await stripe.prices.create({
        currency: payload.currency,
        unit_amount: unitAmount,
        active: payload.active,
        recurring: {
          interval: payload.billingInterval,
          interval_count: payload.intervalCount,
          trial_period_days: payload.trialPeriodDays || null,
        },
        product: product.id,
      });
      console.log(price)
      // Step 3: Create Price Record in Database
      const dbPrice = await tx.price.create({
        data: {
          amount: Number(payload.amount.toFixed(2)) || 0,
          name: payload.name,
          currency: payload.currency,
          interval: payload.billingInterval,
          intervalCount: payload.intervalCount,
          freeTrailDays: payload.trialPeriodDays,
          productId: product.id,
          priceId: price.id,
          active: payload.active,
          description: payload.description,
          features: payload.features,
        },
      });

      return dbPrice;
    });
    return result;
  } catch (error: any) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, error.message);
  }
  // Add other methods like update, delete, find, etc.
};

// Read All Prices
const getAllPrices = async () => {
  const prices = await prisma.price.findMany();
  
  return prices;
};

// Read a Single Price by ID
const getPriceById = async (id: string) => {
  const price = await prisma.price.findUnique({
    where: { id },
  });

  return price;
};

const getPackageByPriceId = async (id: string) => {
  const packageId = await prisma.price.findFirstOrThrow({
    where: { priceId:id },
  });
  return packageId;
}
// Update Price
const updatePrice = async (id: string, payload: any) => {
  try {
    // Step 1: Retrieve the price record from the database
    const price = await prisma.price.findUnique({
      where: { id },
    });
    if (!price) {
      throw new Error(`Price with ID ${id} not found`);
    }

    // Step 2: Use a Prisma transaction to ensure atomicity
    const updatedPrice = await prisma.$transaction(async (tx:any) => {
      // Update the price in the database
      const dbUpdatedPrice = await tx.price.update({
        where: { id },
        data: {
          active: payload.active ?? price.active, // Use nullish coalescing for fallback
          description: payload.description ?? price.description,
          name: payload.name ?? price.name,
          features: payload.features ?? price.features,
        },
      });

      // Step 3: Update the price in Stripe
      await stripe.prices.update(price.priceId, {
        active: payload.active,
      });

      // Step 4: Update the product in Stripe
      await stripe.products.update(price.productId, {
        name: payload.name ?? price.name,
        description: payload.description ?? price.description,
        active: payload.active,
      });

      return dbUpdatedPrice; // Return the updated price record
    });
    return updatedPrice;
  } catch (error: any) {
    throw new Error(`Failed to update price and product: ${error.message}`);
  }
};

// Delete Price
const deletePrice = async (id: string) => {
  // Step 1: Find the price record in the database
  const price = await prisma.price.findUnique({
    where: { id },
  });

  if (!price) {
    throw new Error(`Price with ID ${id} not found`);
  }
  // Step 2: Delete the price in Stripe
  await stripe.prices.update(price.priceId, { active: false }); // Archive the price instead of deleting it
  // Step 3: Archive the product in Stripe (cannot delete products with prices)
  await stripe.products.update(price.productId, { active: false }); // Archive the product

  // Step 4: Delete the price record in the database
  await prisma.price.delete({
    where: { id },
  });

  return { message: `Price with ID ${id} archived and deleted successfully` };
};

const createIntent = async (planName:string,user:User,methodId:string) => {
  
  
  let price = products.find((item) => item.name === planName.toLowerCase());

  let customerId = user?.customerId;
  if (!customerId){
    const customer = await stripe.customers.create({
      email: user?.email,
      name: user?.name,
      payment_method: methodId, // ✅ attach payment method
      invoice_settings: {
        default_payment_method: methodId, // ✅ set as default
      },
    });
    console.log(customer)
    await prisma.user.update({
      where: { id: user.id },
      data: { customerId: customer.id },
    });
    customerId = customer.id;
  }
if (methodId){
  
  await stripe.paymentMethods.attach(methodId, {
    customer: customerId,
  });
  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: methodId,
    },
  });
}

  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customerId },
    { apiVersion: '2025-03-31.basil', },
  );
  console.log(price)
  let priceDetails = await stripe.prices.retrieve(price?.id);

  if (!price) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Price not found');

  }

  if (planName.toLocaleLowerCase() === 'premium'){
    const subscription = await stripe.subscriptions.create({
      customer:customerId,
      items:[{price:priceDetails.id}],
      metadata: {
        userId: user.id,
        planType: planName,
  
  },
      // expand:['latest_invoice.payment_intent']
      
    })
    console.log(subscription)
    return {message:"Subscription created successfully"}

  }else{
    const paymentIntent = await stripe.paymentIntents.create({
      amount: priceDetails.unit_amount, // Amount in cents
      currency: priceDetails.currency,
      customer: customerId,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        priceId: price.id,
        productName: planName,
        userId:user.id
      },
      receipt_email: user?.email,
    });
    let secret = paymentIntent?.client_secret
    return {client_secret:secret,ephemeralKey:ephemeralKey.secret,customerId:customerId,priceId:price.id,productName:planName, publishable_Key:config.stripe_key};
  }
  // Step 1: Create a PaymentIntent in Stripe

  

  
}

const buySubscription = async (payload: IBuySubscription, user: JwtPayload) => {
  try {
    const { methodId, priceId, couponId } = payload;
    const existingUser = await prisma.user.findFirst({
      where: { id: user.id },
    });
    if (!existingUser) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }
    // Step 1: Validate Stripe price and product
    const stripePrice = await stripe.prices.retrieve(priceId);
    const product = await stripe.products.retrieve(stripePrice.product);
    if (!stripePrice || !stripePrice.active) {
      throw new ApiError(
        httpStatus.NOT_ACCEPTABLE,
        'Package not active in Stripe',
      );
    }

    // Step 2: Ensure Stripe customer exists
    let customerId = existingUser?.customerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: existingUser.email,
        
      });
      customerId = customer.id;

      // Update user with new customerId (Outside transaction)
      await prisma.user.update({
        where: { id: user.id },
        data: { customerId },
      });
    }

    // Step 3: Attach payment method and update customer
    await stripe.paymentMethods.attach(methodId, {
      customer: customerId,
    });
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: methodId,
      },
    });

    // Step 4: Prepare subscription parameters
    const subscriptionParams: any = {
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice'],
    };

    if (couponId) {
      const coupon = await stripe.coupons.retrieve(couponId);
      if (!coupon || !coupon.valid) {
        throw new ApiError(400, 'Invalid or expired coupon');
      }
      subscriptionParams.discounts = [{ coupon: couponId }];
    }

    // Step 5: Create subscription in Stripe
    const subscription = await stripe.subscriptions.create(subscriptionParams);
    // Step 6: Handle database transaction
    const result = await prisma.$transaction(async (tx:any) => {
      const ExistingUser = await tx.user.findFirst({ where: { id: user.id } });
      if (!ExistingUser) {
        throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
      }

      // Update user with subscription details
      await tx.user.update({
        where: { id: ExistingUser.id },
        data: {
          subscriptionId: subscription.id,
          customerId: subscription.customer as string,
          planName: product.name,
          priceId: subscription.plan.id,
          isPayment: true,
        },
      });

      // Save payment info
      const returnData = {
        subscriptionPlane: product.name,
        userId: ExistingUser.id,
        subscriptionId: subscription.id,
        subtotal: subscription?.latest_invoice?.subtotal / 100 || null,
        total: subscription?.latest_invoice?.total / 100 || null,
        discount:
          subscription?.latest_invoice?.total_discount_amounts[0]?.amount /
            100 || null,
        discountPercent:
          subscription?.latest_invoice?.discount?.coupon?.percent_off || null,
        hosted_invoice_url: subscription?.latest_invoice?.hosted_invoice_url || null,
        invoice_pdf: subscription?.latest_invoice?.invoice_pdf || null,
      };

      const paymentInfo = await tx.paymentInfo.create({
        data: {amount:returnData.total,userEmail:existingUser.email,
          hosted_invoice_url:returnData.hosted_invoice_url,
          invoice_pdf:returnData.invoice_pdf,
          subscriptionId:subscription.id,
          tranId:subscription?.latest_invoice?.number,
          status:subscription?.latest_invoice?.status},
      });

      return returnData;
    });

    return result;
  } catch (error: any) {
    console.error('Transaction failed:', error.message);

    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to process subscription: ' + error.message,
    );
  }
};

const updateSubscription = async (payload: any, user: User) => {
  const ExistingUser = await prisma.user.findFirst({ where: { id: user.id } });
  if (!ExistingUser) {
    throw new Error('User not found');
  }
  const { subscriptionId, priceId, couponId } = payload;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Prepare the update payload
  const updatePayload: any = {
    items: [
      {
        id: subscription.items.data[0].id, // Retrieve the current item ID
        price: priceId, // Set the new price ID
      },
    ],
    proration_behavior: 'create_prorations', // Handle proration (default)
    expand: ['latest_invoice.payment_intent'],
  };

  // Apply coupon only if provided
  if (couponId) {
    updatePayload.discounts = [{ coupon: couponId }];
  }

  // Update the subscription
  const updatedSubscription = await stripe.subscriptions.update(
    subscriptionId,
    updatePayload,
  );

  // Retrieve the latest invoice for the subscription
  // Step 3: Validate Stripe price and product
  const stripePrice = await stripe.prices.retrieve(priceId);
  const product = await stripe.products.retrieve(stripePrice.product);
  const updateData = {
    planName: product.name,
    priceId: subscription.plan.id,
    isPayment: true,
  };

  await prisma.user.update({
    where: { id: ExistingUser.id },
    data: updateData,
  });

  const saveData = {
    subscriptionPlane: product.name as string,
    subscriptionId: subscription.id as string,
    userId: ExistingUser.id as string,
    subtotal: updatedSubscription.latest_invoice?.subtotal / 100 || null,
    total: updatedSubscription.latest_invoice?.total / 100 || null,

    discountPercent:
      updatedSubscription?.latest_invoice?.discount?.coupon?.percent_off /
        100 || null,
  };
  // Assuming `updatedSubscription` is retrieved from Stripe
  const planAmount = updatedSubscription.plan.amount; // Base amount in cents
  const discountPercent =
    updatedSubscription?.latest_invoice?.discount?.coupon?.percent_off || 0; // Percentage discount (e.g., 25 for 25%)
  const discountAmount = (planAmount * discountPercent) / 100; // Discount in cents
  const finalAmount = (planAmount - discountAmount) / 100; // Final amount in standard currency
  const returnData = {
    subscriptionPlane: product.name as string,
    subscriptionId: subscription.id as string,
    userId: ExistingUser.id as string,
    subtotal: updatedSubscription.plan.amount / 100 || null,
    total: finalAmount || null,
    discount: discountAmount / 100 || null,
    discountPercent: discountPercent || null,
  };

  return returnData;
};

const cancelSubscription = async (user: JwtPayload) => {
  const ExistingUser = await prisma.user.findFirst({
    where: {
      id: user.id,
    },
  });
  if (!ExistingUser) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  const cancelSubscription = await stripe.subscriptions.cancel(
    ExistingUser.subscriptionId,
  );

  await stripe.customers.del(ExistingUser.customerId);
  if (cancelSubscription) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionId: null,
        planName: null,
        priceId: null,
        customerId: null,
        isPayment: false,
      },
    });
  }
  return { message: 'Cancelled subscription' };
};

const handelPaymentWebhook = async (req: Request) => {
  console.log('Handling Payment Webhooks...');

  const sig = req.headers['stripe-signature'] as string;

  if (!sig) {
    console.error('Missing Stripe signature header');
  }

  let event: Stripe.Event;

  // Verify and construct the Stripe event
  event = stripe.webhooks.constructEvent(
    req.body, // Raw body is required
    sig,
    process.env.STRIPE_WEBHOOK_SECRET ||
      'whsec_xyfXjeVBdffHIf5rPdsUEPb4llTJRCao',
  );

  const invoice = event.data.object as Stripe.Invoice;

  switch (event.type) {
    case 'invoice.payment_succeeded': {
      // Retrieve the product details
      const productIndex = invoice.lines.data.length - 1; // Corrected index for last product
      const productId = "invoice.lines.data[productIndex]?.plan?.product as string";

      const product = await stripe.products.retrieve(productId);

      const paymentData = {
        amount: ((invoice.amount_paid / 100) as number) || 0,
        date: new Date() || '', // Use a proper date object
        subscriptionPlane: (product?.name as string) || '',
        // subscriptionId: (invoice?.subscription as string) || '',
        tranId: (invoice?.number as string) || '',
        status: (invoice?.status as string) || '',
        invoice_pdf: (invoice?.invoice_pdf as string) || ' ',
        hosted_invoice_url: (invoice?.hosted_invoice_url as string) || '',
        userEmail: (invoice?.customer_email as string) || '', // Fixed typo
      };

      // Save payment data to the database
      const result = await prisma.paymentInfo.create({
        data: paymentData,
      });
      if (!result) {
        throw new Error('Failed to save payment info');
      }
      console.log('Payment info saved successfully:', paymentData);
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
      break;
  }
};

const getLastDayTransaction = async () => {
  const lastDay = new Date();
  lastDay.setDate(lastDay.getDate() - 1);
  const transactionsSummary = await prisma.paymentInfo.aggregate({
    _count: {
      _all: true, // Counts all rows matching the filter
    },
    _sum: {
      amount: true, // Sums up the `amount` field
    },

    where: {
      createdAt: {
        gte: lastDay,
      },
    },
  });

  return transactionsSummary;
};

const getAllRevenue = async () => {
  const startOfThisMonth = new Date();
  startOfThisMonth.setDate(1);
  startOfThisMonth.setHours(0, 0, 0, 0);

  const startOfLastMonth = new Date(startOfThisMonth);
  startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1);

  const endOfLastMonth = new Date(startOfThisMonth);
  endOfLastMonth.setMilliseconds(-1);

  const totalRevenue = await prisma.paymentInfo.aggregate({
    _sum: { amount: true },
  });

  const thisMonthRevenue = await prisma.paymentInfo.aggregate({
    _sum: { amount: true },
    where: {
      createdAt: { gte: startOfThisMonth },
    },
  });

  const lastMonthRevenue = await prisma.paymentInfo.aggregate({
    _sum: { amount: true },
    where: {
      createdAt: {
        gte: startOfLastMonth,
        lte: endOfLastMonth,
      },
    },
  });

  const totalRevenueAllTime = totalRevenue._sum.amount || 0;
  const thisMonthSum = thisMonthRevenue._sum.amount || 0;
  const lastMonthSum = lastMonthRevenue._sum.amount || 0;

  const percentageChange =
    lastMonthSum === 0
      ? 0
      : ((thisMonthSum - lastMonthSum) / lastMonthSum) * 100;

  return {
    totalRevenue: totalRevenueAllTime,
    thisMonthRevenue: thisMonthSum,
    lastMonthRevenue: lastMonthSum,
    percentageChange: percentageChange.toFixed(2),
  };
};

const getMemberCount = async () => {
  const startOfThisMonth = new Date();
  startOfThisMonth.setDate(1);
  startOfThisMonth.setHours(0, 0, 0, 0);

  const startOfLastMonth = new Date(startOfThisMonth);
  startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1);

  const endOfLastMonth = new Date(startOfThisMonth);
  endOfLastMonth.setMilliseconds(-1);

  const totalUsers = await prisma.paymentInfo.groupBy({
    by: ['userEmail'],
  });

  const thisMonthUsers = await prisma.paymentInfo.groupBy({
    by: ['userEmail'],
    where: {
      createdAt: { gte: startOfThisMonth },
    },
  });

  const lastMonthUsers = await prisma.paymentInfo.groupBy({
    by: ['userEmail'],
    where: {
      createdAt: {
        gte: startOfLastMonth,
        lte: endOfLastMonth,
      },
    },
  });

  const totalMembershipCount = totalUsers.length || 0;
  const thisMonthCount = thisMonthUsers.length || 0;
  const lastMonthCount = lastMonthUsers.length || 0;

  const percentageChange =
    lastMonthCount === 0
      ? thisMonthCount > 0
        ? 100
        : 0
      : ((thisMonthCount - lastMonthCount) / lastMonthCount) * 100;

  return {
    totalMemberships: totalMembershipCount,
    thisMonthMemberships: thisMonthCount,
    lastMonthMemberships: lastMonthCount,
    percentageChange: percentageChange.toFixed(2),
  };
};

const monthlyStatistics = async (query: any) => {
  const year = query.year || new Date().getFullYear();

  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59);

  // Fetch all data for the current year
  const allData = await prisma.paymentInfo.findMany({
    where: {
      createdAt: {
        gte: startOfYear,
        lte: endOfYear,
      },
    },
    select: {
      createdAt: true,
      amount: true,
    },
  });

  // Month names for display
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  // Initialize monthly data structure
  const monthlyData = Array.from({ length: 12 }, (_, index) => ({
    month: monthNames[index],
    totalRevenue: 0,
    totalCount: 0,
  }));

  // Group data manually into months
  allData.forEach((record:any) => {
    const month = new Date(record.createdAt).getMonth(); // Extract month index (0 = Jan)
    monthlyData[month].totalRevenue += record.amount || 0; // Sum up revenue
    monthlyData[month].totalCount += 1; // Increment count
  });

  return monthlyData;
};

const getMemberPlanCount = async (query: any) => {
  const year = query.year || new Date().getFullYear();
  const month = query.month || new Date().getMonth() + 1; // Default to current month (1-based)

  // Calculate start and end of the specified month
  const startOfMonth = new Date(year, month - 1, 1); // Month is 0-based in JavaScript
  const endOfMonth = new Date(year, month, 0, 23, 59, 59); // Last day of the month

  const result = await prisma.paymentInfo.groupBy({
    by: ['subscriptionPlane'], // Group by the subscriptionPlane field
    where: {
      createdAt: {
        gte: startOfMonth, // Start of the month
        lte: endOfMonth, // End of the month
      },
    },
    _count: {
      subscriptionPlane: true, // Count occurrences of subscriptionPlane
    },
  });

  // Transform the result for better readability
  const transformedResult = result.map((item:any) => ({
    subscriptionPlane: item.subscriptionPlane,
    count: item._count.subscriptionPlane, // Rename _count.subscriptionPlane to count
  }));

  return transformedResult;
};

// get all payment info
const getAllPayments = () => {
  return prisma.paymentInfo.findMany({ orderBy: { createdAt: 'desc' } });
};

const getAllPricesFromStripe = async () => {
  try { 
    const prices = await stripe.prices.list({
      limit: 100, // Adjust the limit as needed
    });
    return prices.data;
  }
  catch (error) {
    console.error('Error fetching prices from Stripe:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to fetch prices from Stripe');
  }
}


const getAllStripeProducts = async () => {  
  try {
    const products = await stripe.products.list({
      limit: 100, // Adjust the limit as needed
    });
    return products.data;
  } catch (error) {
    console.error('Error fetching products from Stripe:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to fetch products from Stripe');
  }
}

export const PaymentService = {
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
  getAllPricesFromStripe,
  getAllStripeProducts,
  createIntent
};
