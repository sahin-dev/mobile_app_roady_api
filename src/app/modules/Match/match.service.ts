import path from "path";
import ApiError from "../../../errors/ApiError";
import prisma from "../../../shared/prisma";
import { AgeGroup } from "@prisma/client";
import httpStatus from "http-status";


const getMatchingUsres = async (userId:string, page:number = 1, limit:number = 10) => {

  console.log(userId)
    const targetUser = await prisma.user.findUnique({where:{id:userId}})
    if (!targetUser){
      throw new ApiError(httpStatus.NOT_FOUND, "User not found")
    } 
    const offset = (page - 1) * limit;
    const ageGroup = targetUser.interestAgeGroup
    let ageMin, ageMax

    if (ageGroup == AgeGroup.EIGHTEEN_TO_TWENTYFIVE){
      ageMin = 18
      ageMax = 25
    }else if (ageGroup == AgeGroup.TWENTYFIVE_TO_THIRTYFIVE){
      ageMin = 25
      ageMax = 35
    }else if (ageGroup == AgeGroup.FOURTYFIVE_TO_SIXTY){
      ageMin = 45
      ageMax = 60
    }else if (ageGroup == AgeGroup.SIXY_TO_MORE){   
      ageMin = 60
      ageMax = 100 
    }

    const boostedUsers = await prisma.user.findMany({
        where:{boosted:true,boostedTill:{lte:new Date().toISOString()}, deleted:false, status:"ACTIVE", isCompleteProfile:true, id:{not:userId}, residence_country:{equals:targetUser.residence_country}},
    })
  
  
  
  //   const users = await prisma.user.findMany({
  //     where:{
  //       AND:[
  //         {id:{not:userId}},
  //         {deleted:false},
  //         {status:"ACTIVE"},
  //         {isCompleteProfile:true},
  //         {residence_country:{equals:targetUser.residence_country}},
  //         // {age:{gte:ageMin, lte:ageMax}},
  //         {interests:{hasSome:targetUser.interests}},
  //       ]

  // },
  // skip:offset,
  // take:limit,}
  // )
  // users.push(...boostedUsers)

  // const filteredUsers = users.map((user) => {
  //   if (user.genderVisibility === false) {
  //       user.gender = null; 
  //       return user; //
  // }
  //   return user
  // })

  // if (filteredUsers.length === 0) {
  //   const randomUser = await prisma.user.findMany({where:{residence_country:{equals:targetUser.residence_country}, deleted:false, status:"ACTIVE", isCompleteProfile:true, id:{not:userId}}, take:limit, skip:offset})
  //   if (randomUser.length === 0) {
  //     throw new ApiError(httpStatus.NOT_FOUND, "No matching users found")
  //   } else {
  //     const result =  randomUser.map((user) => {
  //       if (user.genderVisibility === false) {  
  //           user.gender = null;
  //           return user; // Return the user
  //       }
  //       return user
  //     })
  //     // return {data:result, pagination:{page, limit, totalPages:Math.ceil(result.length / limit)}}
  //     return users

  //   }

  // }


    
  // const totalPages = Math.ceil(filteredUsers.length / limit)
  // return {data:users, pagination:{page, limit, totalPages}}

  console.log(targetUser.residence_country)

  const users = await prisma.user.findMany({where:{id:{not:userId},residence_country:{equals:targetUser.residence_country}}})
  console.log(users)
  return users
  
  }

  const addMatch = async (user1:string, user2:string)=>{

    const matched = await prisma.match.create({data:{user1,user2},include:{matchUser1:true,matchUser2:true}})

    return matched

  }

  const getMyMatches = async (userId:string)=>{
    const myMatching = await prisma.match.findMany({where:{OR:[{user1:userId}, {user2:userId}]}})

    return myMatching
  }
  

  export const matchService = { 
    getMatchingUsres,
    addMatch,
    getMyMatches
  }