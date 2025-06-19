import { AgeGroup, InterestType, Prisma, TravelPartner, TripDuration, TripType, User, UserStatus } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { Request } from "express";
import httpStatus from "http-status";
import config from "../../../config";
import ApiError from "../../../errors/ApiError";
// import { fileUploader } from "../../../helpers/fileUploader";
import { paginationHelper } from "../../../helpers/paginationHelper";
import { IPaginationOptions } from "../../../interfaces/paginations";
import emailSender from "../../../shared/mailSender";
import { generateOtpEmailHtml } from "../../../shared/html";
import prisma from "../../../shared/prisma";
import { userSearchAbleFields } from "./user.costant";
import { IUpdateGenderVisibility, IUser, IUserFilterRequest,IUserUpdate } from "./user.interface";
import { jwtHelpers, verifyToken } from "../../../helpers/jwt";
import { PassThrough } from "stream";
import { calculateAge } from "../../../shared/calculateAge";
import { generateOtp } from "../../../helpers/generateOtp";
import { differenceInYears } from "date-fns";
import { fileUploader } from "../../../helpers/fileUploader";
import { Express } from "express";



const setUserPhone  = async (id:string)=>{
  const user = await prisma.user.findUnique({where:{id}})
  
  if(!user){
    throw new ApiError(httpStatus.NOT_FOUND, "User not found")
  }
  
  if (user.phone){
    throw new ApiError(httpStatus.BAD_REQUEST, "User already has a phone number")
  }
  
  const otp = generateOtp()
  const expiresIn = new Date(Date.now()+ 5 * 60 * 1000)
  await prisma.user.update({where:{id}, data:{otp, otpExpiresIn:expiresIn.toISOString()}})
  const emailSubject = "Your OTP for Account Verification";
  const emailHtml = generateOtpEmailHtml(user.email!, otp);
  if (user.email){
  await emailSender(user.email, emailHtml, emailSubject);
  }
  console.log(`OTP sent to ${user.email}`);

  return {message:"Otp sent to your email"}

}

const verifySetPhone = async (id:string,otp:string, phone:string)=>{
  const user = await prisma.user.findUnique({where:{id}})
  if (!user){
    throw new ApiError(httpStatus.NOT_FOUND, "User not found")
  }
  if (user.phone){
    throw new ApiError(httpStatus.BAD_REQUEST, "User already has a phone number")
  }
  if (user.otp !== otp){
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid OTP")
  }
  if (!user.otpExpiresIn || new Date(user.otpExpiresIn) < new Date()){
    throw new ApiError(httpStatus.BAD_REQUEST, "OTP expired")
  }
  await prisma.user.update({where:{id}, data:{phone, otp:null, otpExpiresIn:null}})
  return {message:"Phone number updated successfully"}
}

const initiateSignUp = async (phone:string)=>{
  const existingUser = await prisma.user.findFirst({where:{phone:phone}})
  if (existingUser){
    throw new ApiError(httpStatus.BAD_REQUEST, `User with this phone ${phone} already exist`)
  }
  const otp = Math.floor(1000 + Math.random() * 9000)
  const otpExpiry = new Date(Date.now() + 15 * 60 * 1000)

}

const checkEmail = async ({email}:{email:string})=>{
  const user = await prisma.user.findMany({where:{email:email}})
  if (user.length>0){
    throw new ApiError(httpStatus.CONFLICT, "User with this email already exist")
  }
  return {message:"email is available"}
}

const checkUsername = async ({username}:{username:string})=>{
  const user = await prisma.user.findMany({where:{username}})
  if (user.length>0){
    throw new ApiError(httpStatus.CONFLICT, "User with this username already exist")
  }
  return {message:"username is available"}
}

const generateSignUpOtp = async ({phone}:{phone:string})=>{
  const user = await prisma.user.findFirst({where:{phone}})
  if (user){
    return new ApiError (httpStatus.CONFLICT, "user already exist with this phone")
  }
  
}

// Create a new user in the database.
const createUserIntoDb = async (userId:string,payload:IUserUpdate) => {
  const user = await prisma.user.findUnique({where:{id:userId}})
  console.log(user)
  if (!user) { 
    throw new ApiError(httpStatus.NOT_FOUND, "User not found")
   }


   if (payload.username) {
    // Check if the username already exists
    const existingUser = await prisma.user.findFirst({where:{username:payload.username}})
    if (existingUser){
      throw new ApiError(httpStatus.CONFLICT, "User with this username already exist")
    }
   }
 
  // if (existingUser) {
  //   if (existingUser.phone === payload.phone) {
  //     throw new ApiError(
  //       400,
  //       `User with this phone ${payload.phone} already exists`
  //     );
  //   }else if (existingUser.email === payload.email){
  //     throw new ApiError(
  //       400,
  //       `User with this email ${payload.email} already exists`
  //     );
  //   }else if (existingUser.username === payload.username){
  //     throw new ApiError(
  //       400,
  //       `User with this username ${payload.username} already exists`
  //     );
  //   }
  // }

  // const hashedPassword = await bcrypt.hash(
  //   payload.password,
  //   Number(config.bcrypt_salt_rounds)
  // );
  // Generate OTP
  // const otp = generateOtp()
  // const otp = Math.floor(1000 + Math.random() * 9000); // 6-digit OTP
  // const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // OTP expires in 15 minutes

  // Create the user and save the OTP and expiry in the database
  const age = payload.dob ? calculateAge(new Date(String(payload.dob))) : undefined;
  
  // Ensure dob is of type string (not String object)
  // Map travelPartner string to enum if present
  let travelPartnerEnum: TravelPartner | undefined = undefined;
  if (payload.travelPartner) {
    switch (payload.travelPartner) {
      case "Womens":
        travelPartnerEnum = TravelPartner.WOMENS;
        break;
      case "Mens":
        travelPartnerEnum = TravelPartner.MENS;
        break;
      case "Non Binarys":
        travelPartnerEnum = TravelPartner.NON_BINARIES;
        break;
      case "everyone":
        travelPartnerEnum = TravelPartner.EVERYONE;
        break;
      default:
        travelPartnerEnum = undefined;
    }
  }

  // Map tripType string to enum if present
  let tripTypeEnum: TripType | undefined = undefined;
  if (payload.tripType) {
    switch (payload.tripType) {
      case "Backpack":
        tripTypeEnum = TripType.BACKPACK;
        break;
      case "Sporting":
        tripTypeEnum = TripType.SPORTING;
        break;
      case "Chill":
        tripTypeEnum = TripType.CHILL;
        break;
      case "Luxe":
        tripTypeEnum = TripType.LUXE;
        break;
      case "Business":
        tripTypeEnum = TripType.BUSINESS;
        break;
      default:
        tripTypeEnum = undefined;
    }
  }

  // Map tripDuration string to enum if present
  let tripDurationEnum: TripDuration | undefined = undefined;
  if (payload.tripDuration) {
    switch (payload.tripDuration) {
      case "1-3 weeks":
        tripDurationEnum = TripDuration.ONE_TO_THREE_WEEKS;
        break;
      case "1-3 months":
        tripDurationEnum = TripDuration.ONE_TO_THREE_MONTHS;
        break;
      case "fewdays":
        tripDurationEnum = TripDuration.FEWDAYS;
        break;
      case "6 months or more":
        tripDurationEnum = TripDuration.SIX_MONTHS_OR_MORE;
        break;
      default:
        tripDurationEnum = undefined;
    }
  }

  // Map interestAgeGroup string to AgeGroup enum if present
  let interestAgeGroupEnum: AgeGroup | undefined = undefined;
  if (payload.interestAgeGroup) {
    switch (payload.interestAgeGroup) {
      case "18-25":
        interestAgeGroupEnum = AgeGroup.EIGHTEEN_TO_TWENTYFIVE;
        break;
      case "25-35":
        interestAgeGroupEnum = AgeGroup.TWENTYFIVE_TO_THIRTYFIVE;
        break;
      case "35-45":
        interestAgeGroupEnum = AgeGroup.THIRTYFIVE_TO_FOURTYFIVE;
        break;
      case "45-60":
        interestAgeGroupEnum = AgeGroup.FOURTYFIVE_TO_SIXTY;
        break;
      case "60 month or more":
        interestAgeGroupEnum = AgeGroup.SIXY_TO_MORE;
        break;
      default:
        interestAgeGroupEnum = undefined;
    }
  }

  const payloadToUpdate = {
    ...payload,
    dob: payload.dob ? String(payload.dob) : undefined,
    // Convert interests to primitive string[] if present
    interests: payload.interests ? payload.interests.map((i) => i.toString()) : undefined,
    interestAgeGroup: interestAgeGroupEnum !== undefined ? interestAgeGroupEnum : undefined,
    travelPartner: travelPartnerEnum !== undefined ? travelPartnerEnum : undefined,
    tripType: tripTypeEnum !== undefined ? tripTypeEnum : undefined,
    tripDuration: tripDurationEnum !== undefined ? tripDurationEnum : undefined,
    gender: payload.gender
      ? {
          label: typeof payload.gender.label === "string" ? payload.gender.label : String(payload.gender.label),
          ...(payload.gender.sub_categories
            ? { sub_categories: payload.gender.sub_categories.map((sc: any) => sc.toString()) }
            : {}),
        }
      : undefined,
  };

  const newUser = await prisma.user.update({where:{id:userId},
    data: {
     ...payloadToUpdate,
      age,
      isCompleteProfile: true,
      phone:user.phone,
      email:user.email,
      status:"ACTIVE",
      
    },
    select: {
      id: true,
      phone: true,
      email:true,
      username:true,
      gender: true,  
      // otp: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Send the OTP to the user's email
  // try {
  //   const emailSubject = "Your OTP for Account Verification";
 
  //   if (newUser.email){
  //     const emailHtml = generateOtpEmailHtml(newUser.email, otp);
  //     await emailSender(newUser.email!, emailHtml, emailSubject);
  //     console.log(`OTP sent to ${newUser.email}`);
  //   }else{
  //     console.log("user email is not present")
  //   }

  // } catch (error) {
  //   console.error(`Failed to send OTP email:`, error);
  // }

  return newUser;
};

const deleteAccount = async (id:string)=>{
  const user = await prisma.user.findUnique({where:{id}})
  if (!user){
    throw new ApiError(httpStatus.NOT_FOUND, "User not found")
  }
  await prisma.user.delete({where:{id}})
  return {message:"User deleted successfully"}
}




const updateGenderVisibility = async (id:string)=>{
  const user = await prisma.user.findUnique({where:{id:id}})
  if (!user){
    throw new ApiError(httpStatus.NOT_FOUND, "User not found")
  }
  await prisma.user.update({where:{id:user.id},data:{genderVisibility:(!user.genderVisibility)}})
  return {message:"Gender visibility updated!"}
}


// reterive all users from the database also searcing anf filetering
const getUsersFromDb = async (
  params: IUserFilterRequest,
  options: IPaginationOptions
) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, ...filterData } = params;

  const andCondions: Prisma.UserWhereInput[] = [];

  if (params.searchTerm) {
    andCondions.push({
      OR: userSearchAbleFields.map((field) => ({
        [field]: {
          contains: params.searchTerm,
          mode: "insensitive",
        },
      })),
    });
  }

  if (Object.keys(filterData).length > 0) {
    andCondions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: {
          equals: (filterData as any)[key],
        },
      })),
    });
  }
  const whereConditons: Prisma.UserWhereInput = { AND: andCondions };

  const result = await prisma.user.findMany({
    where: whereConditons,
    skip,
    orderBy:
      options.sortBy && options.sortOrder
        ? {
            [options.sortBy]: options.sortOrder,
          }
        : {
            createdAt: "desc",
          },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const total = await prisma.user.count({
    where: whereConditons,
  });

  if (!result || result.length === 0) {
    throw new ApiError(404, "No active users found");
  }
  return {
    meta: {
      page,
      limit,
      total,
    },
    data: result,
  };
};


const getUserProfile = async (userId:string)=>{
  const user = await prisma.user.findUnique({where:{id:userId}})

  if (!user){
    throw new ApiError(httpStatus.NOT_FOUND, "User not found")
  }
  return user
}

// update profile by user won profile uisng token or email and id
// const updateProfile = async (req: Request&{user?:any}) => {
//  try {
//   const files = req.files as any;

//   const stringData = req.body.data;
 
//   let images;
//   let parseData;

//   const existingUser = await prisma.user.findFirst({
//     where: {
//       id: req.user?.id,
//     },
//   });
//   if (!existingUser) {
//     throw new ApiError(404, "User not found");
//   }
//   if (files.images) {

//     images = await Promise.all(
//       files?.images?.map(async (file: any) => {
//         const response = await fileUploader.uploadToDigitalOcean(file);
//         return { url: response.Location }; // Extract and return only the file URL
//       })
//     );
//   }
//   if (stringData) {
//     parseData = JSON.parse(stringData);
//   }
// if(parseData?.dob){
//   parseData.dob = new Date(parseData.dob).toISOString();
// }
  

//   const result = await prisma.user.update({
//     where: {
//       id: existingUser.id,
//     },
//     data: {
//       ...parseData,
//       isCompleteProfile: true,
//       photos: (parseData?.photos || images)
//         ? [...(parseData?.photos || []), ...(images || [])]?.map((item) => {
//             if (typeof item === "object" && item?.url) {
//               return item;
//             }
//             return { url: item };
//           })
//         : [], // Default to an empty array if neither photos nor images exist
//     },
    
//     select: {
//       id: true,
//       email: true,
//       name: true,
//       phone: true,
//       gender: true,
//       dob: true,
//       sexOrientation: true,
//       education: true,
//       interests: true,
//       distance: true,
//       favoritesFood: true,
//       photos: true,
//       about: true,
//       lat: true,
//       long: true,
//       isCompleteProfile: true,
//       createdAt: true,
//       updatedAt: true,
//     },
//   });

  
//   return result;
//  } catch (error:any) {
//   throw new ApiError(httpStatus.NOT_ACCEPTABLE,error.message)
//  }
// };

// update user data into database by id for admin
const updateUserIntoDb = async (payload: IUserUpdate, id: string) => {
  const userInfo = await prisma.user.findUnique({
    where: {
      id: id,
    },
  });
  if (!userInfo)
    throw new ApiError(httpStatus.NOT_FOUND, "User not found with id: " + id);

  const result = await prisma.user.update({
    where: {
      id: userInfo.id,
    },
    data: {
      
      dob: payload.dob !== undefined ? String(payload.dob) : undefined,
      username: userInfo.username,
      email: userInfo.email,
      phone: userInfo.phone
    },
    select: {
      id: true,
      email: true,
      lastName:true,
      firstName:true,
      username:true,
      gender:true,
      about:true,
      role: true,
      createdAt: true,
      updatedAt: true,
      phone:true
    },
  });

  if (!result)
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to update user profile"
    );

  return result;
};


const updateProfilePhoto = async (userId:string, files:Express.Multer.File[])=>{
  const user = await prisma.user.findUnique({
    where:{id:userId}
  })

  if (!user){
    throw new ApiError(httpStatus.NOT_FOUND, "user not found")
  }

  if (files && files.length <= 0)
{
  throw new ApiError(httpStatus.BAD_REQUEST, "No files detected")
}
  let urls:string[] = [];

  console.log(files)


  if (files && files.length > 0){

      urls = await Promise.all(files.map(async (file) => {

        const f = await fileUploader.uploadToDigitalOcean(file)
        return f.Location;

        }))
        
  }

  let allPhotos = user.photos.concat(urls)

  const updatedUser = await prisma.user.update({where:{id:user.id}, data:{photos: allPhotos}})

  return updatedUser


}




const updateUser = async (payload: IUserUpdate, userId: string, files:Express.Multer.File[]) => {
  let dob = new Date()


  const user = await prisma.user.findUnique({
    where: { id: userId },
  });



  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, `User not found with id: ${userId}`);
  }

  

  let data = {
    
  }
  
// enum AgeGroup {
  
//   EIGHTEEN_TO_TWENTYFIVE
//   TWENTYFIVE_TO_THIRTYFIVE
//   THIRTYFIVE_TO_FOURTYFIVE
//   FOURTYFIVE_TO_SIXTY
//   SIXY_TO_MORE
// }

let ageGroup:AgeGroup | null = null
let tripDuration:TripDuration | null= null

let tripType:TripType | null = null

let travelPartner: TravelPartner | null = null



if (payload.travelPartner){
  switch(payload.travelPartner){

    case "Womens":
      travelPartner = TravelPartner.WOMENS
      break
    case "Mens":
      travelPartner = TravelPartner.MENS
      break
    case "Non binaries":
      travelPartner = TravelPartner.NON_BINARIES
      break
    case "everyone":
      travelPartner = TravelPartner.EVERYONE
      break
    default:
      travelPartner = user.travelPartner
  }
}

  if (payload.interestAgeGroup ){

    switch(payload.interestAgeGroup){
      case '18-25':
        ageGroup = AgeGroup.EIGHTEEN_TO_TWENTYFIVE
        break
      case '25-35':
        ageGroup = AgeGroup.THIRTYFIVE_TO_FOURTYFIVE
        break
      case "35-45":
        ageGroup = AgeGroup.THIRTYFIVE_TO_FOURTYFIVE
        break
      case "45-60":
        ageGroup = AgeGroup.FOURTYFIVE_TO_SIXTY
        break
      case "60+":
        ageGroup = AgeGroup.SIXY_TO_MORE
        break
      default:
        ageGroup = user.interestAgeGroup
    }

  }

  if (payload.tripDuration){
    switch (payload.tripDuration){
      case "1-3 weeks":
        tripDuration = TripDuration.ONE_TO_THREE_WEEKS
        break
      case "1-3 months":
        tripDuration = TripDuration.ONE_TO_THREE_MONTHS
        break
      case "fewdays":
        tripDuration = TripDuration.FEWDAYS
        break
      case "6 months or more":
         tripDuration = TripDuration.SIX_MONTHS_OR_MORE
         break

      default:
        tripDuration = user.tripDuration

    }
  }


  if (payload.tripType){
    switch (payload.tripType){
      case "Backpack":
        tripType = TripType.BACKPACK
        break
      case "Sporting":
        tripType = TripType.SPORTING
        break
      case "Chill":
        tripType = TripType.CHILL
        break
      case "Luxe":
        tripType = TripType.LUXE
        break
      case "Business":
        tripType = TripType.BUSINESS
        break
      default:
        tripType = user.tripType

    }
   
  }

  


  const updateData: any = {
    ...payload,
    dob,
    status: UserStatus.ACTIVE,
    // Lock immutable/sensitive fields
  };

  
  // export interface IUserUpdate {
  //   email?:string,
  //   username?:string
  //   firstName?:string,
  //   lastName?:string,
  //   dob?:String,
  //   about?:string,
  //   interests?:InterestType[],
  //   budgetMin?:number,
  //   budgetMax?:number,
  //   travelPartner?:TravelPartner,
  //   gender:{
  //     label:GenderLabel,
  //     sub_categories?:GenderSubCategory[]
  //   },
  //   genderVisibility?:boolean,
  //   tripType?:TripType,
  //   tripDuration?:TripDuration,
  //   tripContinent?:string,
  //   tripCountry?:string,
  //   interestAgeGroup?:AgeGroup
    
  // }
  

  // Auto-calculate age if dob is provided
  let age
  if (payload.dob) {
    age = differenceInYears(new Date(), new Date(payload.dob.toString()));
  }

  let interests: string[]

  if (payload.interests){
    interests = payload.interests as string[]
  }else{
    interests = user.interests as string[]
  }



  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      username:payload.username || user.username,
      email: payload.email || user.email,
      firstName: payload.firstName || user.firstName,
      lastName: payload.lastName || user.lastName,
      dob: String(payload.dob) || user.dob,
      about: payload.about || user.about,
      interests: interests,
      budgetMax: payload.budgetMax || user.budgetMax,
      budgetMin : payload.budgetMin || user.budgetMin,
      travelPartner : travelPartner || user.travelPartner,
      gender: payload.gender as {} || user.gender,
      genderVisibility : payload.genderVisibility || user.genderVisibility,
      //done
      tripType : tripType || user.tripType,
      //done
      tripDuration : tripDuration || user.tripDuration,

      tripContinent : payload.tripContinent || user.tripContinent,
       tripCountry: payload.tripCountry || user.tripCountry,
       //done
       interestAgeGroup : ageGroup || user.interestAgeGroup,
       age:age


    },
    
  });

  return updatedUser;
};


const setOrChangeUsername = async (userId: string, newUsername: string) => {
  if (!newUsername || newUsername.trim() === "") {
    throw new ApiError(httpStatus.BAD_REQUEST, "Username is required");
  }

  // Clean up the username
  newUsername = newUsername.trim().toLowerCase();

  // Check if username already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      username: newUsername,
      deleted: false,
    },
  });

  if (existingUser) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Username is already taken");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  // Optional: prevent changing username once set
  if (user.username) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Username has already been set and cannot be changed");
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { username: newUsername },
    select: {
      id: true,
      username: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
    },
  });

  return {
    message: "Username set successfully",
    user: updatedUser,
  };
};



// get random user

const getRandomUser = async () => {
  // Get the total count of users
  const userCount = await prisma.user.count();

  if (userCount === 0) {
    return null; // Return null if no users exist
  }

  // Generate a random offset within the user count
  const randomOffset = Math.floor(Math.random() * userCount);

  // Fetch a random user using the offset
  const randomUser = await prisma.user.findMany({
    take: 1,
    skip: randomOffset,
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return randomUser.length > 0 ? randomUser[0] : null;
};

// get user for home page with pagination

// const getUserForHomePage = async (
//   authUserId: string,
//   page: number = 1,
//   limit: number = 20,
//   sortBy: string = "createdAt",
//   sortOrder: string = "asc"
// ) => {
//   const offset = (page - 1) * limit;

//   const authUser = await prisma.user.findUnique({
//     where: { id: authUserId },
//     select: {
//       lat: true,
//       long: true,
//       distance: true,
//       favoritesFood: true,
//       interest: true,
//       photos: true,
//       about: true,
//     },
//   });

//   if (!authUser?.lat || !authUser?.long || !authUser?.distance) {
//     throw new Error("Authenticated user's location or radius is not available");
//   }

//   const authLat = parseFloat(authUser.lat);
//   const authLong = parseFloat(authUser.long);
//   const maxRadius = parseFloat(authUser.distance);

//   const users = await prisma.user.findMany({
//     where: {
//       AND: [
//         { id: { not: authUserId } },
//         { lat: { not: null }, long: { not: null } },
//         {
//           OR: [
//             { favoritesFood: { hasSome: authUser.favoritesFood || [] } },
//             { interest: { hasSome: authUser.interest || [] } },
//           ],
//         },
//       ],
//     },
//     select: {
//       id: true,
//       email: true,
//       gender: true,
//       ethnicity: true,
//       dob: true,
//       role: true,
//       name: true,
//       favoritesFood: true,
//       photos: true,
//       interest: true,
//       lat: true,
//       long: true,
//       createdAt: true,
//       updatedAt: true,
//     },
//   });

//   const filteredUsers = users
//     .map((user) => {
//       if (!user.lat || !user.long || !user.dob) return null;

//       const userLat = parseFloat(user.lat);
//       const userLong = parseFloat(user.long);

//       const distance = calculateDistance(authLat, authLong, userLat, userLong);

//       if (distance <= maxRadius) {
//         const age = calculateAge(user.dob); // Calculate age
//         return { ...user , distance: `${distance.toFixed(1)} km`, age }; // Add age to user object
//       }
//       return null;
//     })
//     .filter((user) => user !== null)
//     .slice(offset, offset + limit);

//   const totalUsers = filteredUsers.length;
//   const totalPages = Math.ceil(totalUsers / limit);

//   return {
//     pagination: {
//       currentPage: page,
//       totalPages,
//       totalUsers,
//       limit,
//     },
//     users: filteredUsers,
//   };
// };


const getUserForHomePage = async (
  authUserId: string,
  page: number = 1,
  limit: number = 20,
  sortBy: string = "createdAt",
  sortOrder: string = "asc"
) => {
  const offset = (page - 1) * limit;

  // Fetch authenticated user's details
  const authUser = await prisma.user.findUnique({
    where: { id: authUserId },
    select: {
      lat: true,
      long: true,
      gender:true,
      distance: true,
      favoritesFood: true,
      interests: true,
      photos: true,
      about: true,
      sexOrientation: true, // Fetching the sexOrientation field
    },
  });

  if (!authUser?.lat || !authUser?.long || !authUser?.distance) {
    throw new Error("Authenticated user's location or radius is not available");
  }

  const authLat = parseFloat(authUser.lat);
  const authLong = parseFloat(authUser.long);
  const maxRadius = parseFloat(authUser.distance);

  // Define gender filter logic based on sexOrientation
  let genderFilter: any = {};
  if (authUser?.sexOrientation === "Girl") {
    genderFilter = { gender: "Girl" };
  } else if (authUser?.sexOrientation === "Boy") {
    genderFilter = { gender: "Boy" };
  } // If "Both", do not filter by gender

  // Fetch users with the gender filter applied
  const users = await prisma.user.findMany({
    where: {
      AND: [
        { id: { not: authUserId },gender: { not: authUser.gender} },
        { lat: { not: null }, long: { not: null } },
        {
          OR: [
            { favoritesFood: { hasSome: authUser.favoritesFood || [] } },
            { interest: { hasSome: authUser.interests || [] } },
          ],
        },
        genderFilter, // Apply gender filter
      ],
    },
    select: {
      id: true,
      email: true,
      gender: true,
      dob: true,
      role: true,
      name: true,
      favoritesFood: true,
      photos: true,
      interests: true,
      lat: true,
      long: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Filter users by distance and calculate additional fields
  const filteredUsers = users
    .map((user) => {
      if (!user.lat || !user.long || !user.dob) return null;

      const userLat = parseFloat(user.lat);
      const userLong = parseFloat(user.long);

      const distance = calculateDistance(authLat, authLong, userLat, userLong);

      if (distance <= maxRadius) {
        const age = calculateAge(new Date(user.dob)); // Calculate age
        return { ...user, distance: `${distance.toFixed(1)} miles`, age }; // Add age to user object
      }
      return null;
    })
    .filter((user) => user !== null);

  // If no users are found within the distance, show all users from the world
  if (filteredUsers.length === 0) {
    const allUsers = await prisma.user.findMany({
      where: {
       AND:[ {id: { not: authUserId }}]
      },
      select: {
        id: true,
        email: true,
        gender: true,
        dob: true,
        role: true,
        name: true,
        favoritesFood: true,
        photos: true,
        interests: true,
        lat: true,
        long: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const allFilteredUsers = allUsers
      .map((user) => {
        if (!user.lat || !user.long || !user.dob) return null;
        const age = calculateAge(new Date(user.dob)); // Calculate age
        return { ...user, age }; // Add age to user object
      })
      .filter((user) => user !== null);

    return {
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(allFilteredUsers.length / limit),
        totalUsers: allFilteredUsers.length,
        limit,
      },
      users: allFilteredUsers.slice(offset, offset + limit),
    };
  }

  // Pagination for the filtered users (within the distance)
  const totalUsers = filteredUsers.length;
  const totalPages = Math.ceil(totalUsers / limit);

  return {
    pagination: {
      currentPage: page,
      totalPages,
      totalUsers,
      limit,
    },
    users: filteredUsers.slice(offset, offset + limit),
  };
};


// Helper function to calculate the distance between two points
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const toRadians = (degree: number) => (degree * Math.PI) / 180;

  const EARTH_RADIUS = 6371; // Radius of the Earth in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};


// // get user profile
const getMyProfile = async (id: string) => {
  

  const userProfile = await prisma.user.findUnique({
    where: {
      id: id,
    },
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      phone: true,
      gender: true,
      dob: true,
      isPayment: true,
      planName: true,
      fcmToken: true,
      priceId: true,
      subscriptionId: true,
      sexOrientation: true,
      education: true,
      interests: true,
      distance: true,
      favoritesFood: true,
      photos: true,
      genderVisibility:true,
      residence_country:true,
      travelPartner:true,
      budgetMin:true,
      budgetMax:true,
      tripType:true,
      tripDuration:true,
      tripContinent:true,
      tripCountry:true,
      interestAgeGroup:true,
      about: true,
      lat: true,
      long: true,
      isCompleteProfile: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  


  return userProfile;
};


// get single user by id 
const getSingleUserById = async (id:string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      tripContinent:true,
      tripCountry:true,
      email: true,
      name: true,
      phone: true,
      gender: true,
      dob: true,
      interests: true,
      about: true,

      genderVisibility: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  let age
if(user?.dob){
   age = calculateAge(new Date(user.dob));
}
if (user?.genderVisibility === false) {
  user.gender = null; // Hide
}

  return { ...user, age };
}





const boostProfile = async (id:string, boostTime: number = 30) => {
  const user = await prisma.user.findUnique({where:{id}})

  if (!user){
    throw new ApiError(httpStatus.NOT_FOUND, "User not found")
  }

  if (
    !user.boosted ||
    !user.boostedTill ||
    new Date(user.boostedTill) < new Date()
  ) {
    throw new ApiError(httpStatus.BAD_REQUEST, "You have no boost.");

  }
 

  // const boostEndTime = new Date(Date.now() + boostTime * 60 * 1000)

  

  return {message:"Profile boosted successfully"}

}




export const userService = {
  createUserIntoDb,
  getUsersFromDb,
  // updateProfile,
  updateUserIntoDb,
  updateUser,
  getRandomUser,
  getUserForHomePage,
  getSingleUserById,
  checkEmail,
  checkUsername,
  updateGenderVisibility,
  setUserPhone,
  deleteAccount,
  verifySetPhone,
  getMyProfile,
  setOrChangeUsername,
  updateProfilePhoto
};
