import { AgeGroup, GenderLabel, GenderSubCategory, InterestType, TravelPartner, TripDuration, TripType, UserRole } from "@prisma/client";
import { boolean } from "zod";


// id                String         @id @default(auto()) @map("_id") @db.ObjectId
//   email             String?         
//   phone             String?         @unique
//   username          String?         
//   dob               DateTime?
//   residence_country String?
//   firstName         String?
//   lastName          String?
//   about             String?
//   interests         InterestType[]
//            
//   budgetMin         Int?
//    budgetMax         Int?
//   travelPartner     TravelPartner?
//   deleted           Boolean @default(false)

//   gender            GenderDescription?
//   genderVisibility  Boolean?        @default(false)
//   tripType          TripType?
//   tripDuration      TripDuration?
//   tripContinent  String?
//   tripCountry String?
//   interestAgeGroup  AgeGroup?
//   otp            String?
//   otpExpiresIn   DateTime?


export interface IUserUpdate {
  email?:string,
  username?:string
  firstName?:string,
  lastName?:string,
  dob?:String,
  about?:string,
  interests?:InterestType[],
  budgetMin?:number,
  budgetMax?:number,
  travelPartner?:TravelPartner,
  gender:{
    label:GenderLabel,
    sub_categories?:GenderSubCategory[]
  },
  photos:string[],
  genderVisibility?:boolean,
  tripType?:TripType,
  tripDuration?:TripDuration,
  tripContinent?:string,
  tripCountry?:string,
  interestAgeGroup?:AgeGroup
  
}



export interface IUser {

  firstName?:string,
  lastName?:string,
  username?:string,
  dob:Date,
  about:string,
  interests:InterestType[],
  budgetMin:number,
  budgetMax:number,
  travelPartne:TravelPartner,
 gender:{
    label:GenderLabel,
    sub_category?:GenderSubCategory[]
  },
  tripType:TripType,
  tripDuration:TripDuration,
  tripContinent:string,
  tripCountry:string,
  interestAgeGroup:AgeGroup
}

export type IUserFilterRequest = {
  name?: string | undefined;
  email?: string | undefined;
  contactNumber?: string | undefined;
  searchTerm?: string | undefined;
  minAge?: number | undefined;
  maxAge?: number | undefined;
  distanceRange?: number | undefined;
}

export interface IUpdateGenderVisibility {
  id:string
}

// export interface IUserUpdate {
//   email?:string,
//   firstName?:string,
//   lastName?:string,
//   phone?:string,
//   role?:string,
//   isDeleted?:boolean
// }