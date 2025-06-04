import httpStatus from "http-status";
import prisma from "../../../shared/prisma";
import ApiError from "../../../errors/ApiError";
import { JwtPayload } from "jsonwebtoken";
import { IUserFilterRequest } from "../User/user.interface";
import { paginationHelper } from "../../../helpers/paginationHelper";
import { IPaginationOptions } from "../../../interfaces/paginations";
import { Prisma } from "@prisma/client";

const toggleLike = async (id: string, user: any) => {
  const prismaTransaction = await prisma.$transaction(async (prisma) => {
    // Check if the post exists
    const isUserExist = await prisma.user.findUnique({
      where: {
        id: id,
      },
    });

    if (!isUserExist) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    // Check if the favorite already exists for the user
    const existingLike = await prisma.like.findFirst({
      where: {
        senderId: user.id,
        receiverId: id,
      },
    });
    const existingDisLike = await prisma.disLike.findFirst({
      where: {
        senderId: user.id,
        receiverId: id,
      },
    });
    const existingSuperLike = await prisma.superLike.findFirst({
      where: {
        senderId: user.id,
        receiverId: id,
      },
    });
    if (existingDisLike) {
      console.log("delete dislike");
      await prisma.disLike.delete({
        where: { id: existingDisLike.id },
      });
    }
    if (existingSuperLike) {
      console.log("delete superlike");
      await prisma.superLike.delete({
        where: { id: existingSuperLike.id },
      });
    }

    let result;
    if (existingLike) {
      // If the like exists, remove the favorite and decrement likeCount
      const LikeDelete = await prisma.like.delete({
        where: {
          id: existingLike.id,
        },
      });
      result = {
        massage: "Like deleted successfully",
        data: LikeDelete,
      };
    } else {
      // If the like doesn't exist, add the favorite and increment likeCount
      const createLike = await prisma.like.create({
        data: {
          senderId: user.id,
          receiverId: id,
        },
      });
      result = {
        massage: "Like created successfully",
        data: createLike,
      };
    }

    return result;
  });

  return prismaTransaction;
};

//get all users who liked me

const getAllMyLikedIds = async (id: string) => {

  const findUser = await prisma.user.findUnique({ where: { id: id } });

  if (!findUser) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }
  const result = await prisma.like.findMany({
    where: {
      receiverId: id,
    },
    include:{sender: { select: { id: true, name: true, photos: true} }
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  return result.map((item) => ({id:item.sender.id,name:item.sender.name,photos:item.sender.photos})); // Return only the IDs of the liked users
};



const getWhoLikeMe = async (id: string) => {  
  
  const me = await prisma.user.findUnique({ where: { id: id } });

  if (!me) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }
  const result = await prisma.like.findMany({
    where: {
      senderId: id,
    },
    select: {
      receiverId: true,
    },
  });
  if (me.planName === "FREE") {
    const limitedResult = result.slice(0, 3); // Limit to 5 results
    return limitedResult.map((item) => item.receiverId);
  }
  return result.map((item) => item.receiverId);
}


const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
};




const getAllMyLikeUsers = async (
  user: JwtPayload,
  params: IUserFilterRequest,
  options: IPaginationOptions
) => {

  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, minAge, maxAge,    distanceRange = 40075, ...filterData } = params;

 
  const authUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { lat: true, long: true },
  });

  if (!authUser || authUser.lat == null || authUser.long == null) {
    throw new Error("User's location is not available");
  }

 
  const maxDistance = distanceRange ? Number(distanceRange) : null;

  if (!maxDistance) {
    throw new Error("A valid distanceRange is required.");
  }


  const currentDate = new Date();
  const minDob = maxAge
    ? new Date(currentDate.getFullYear() - maxAge, currentDate.getMonth(), currentDate.getDate())
    : undefined;
  const maxDob = minAge
    ? new Date(currentDate.getFullYear() - minAge, currentDate.getMonth(), currentDate.getDate())
    : undefined;


  const andConditions: Prisma.LikeWhereInput[] = [];

  
  if (searchTerm) {
    andConditions.push({
      receiver: {
        OR: [
          { name: { contains: searchTerm, mode: "insensitive" } },
          { email: { contains: searchTerm, mode: "insensitive" } },
        ],
      },
    });
  }


  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      receiver: {
        AND: Object.keys(filterData).map((key) => ({
          [key]: {
            equals: (filterData as any)[key],
            mode: "insensitive",
          },
        })),
      },
    });
  }


  if (minDob || maxDob) {
    andConditions.push({
      receiver: {
        dob: {
          gte: minDob, 
          lte: maxDob, 
        },
      },
    });
  }

  // Final conditions
  const whereConditions: Prisma.LikeWhereInput = {
    senderId: user.id,
    AND: andConditions,
  };

  // Fetch liked users without pagination
  const likedUsers = await prisma.like.findMany({
    where: whereConditions,
    include: {
      receiver: {
        select: {
          id: true,
          name: true,
          photos: true,
          gender: true,
          email: true,
          dob: true,
          lat: true,
          long: true,
          favoritesFood: true,
          interests: true,
        },
      },
    },
  });

  // Calculate distance and filter users within the specified distance range
  const usersWithinDistance = likedUsers
    .map((like) => {
      if (like.receiver.lat != null && like.receiver.long != null) {
        const distance = calculateDistance(
          Number(authUser.lat),
          Number(authUser.long),
          Number(like.receiver.lat),
          Number(like.receiver.long)
        );

        // Include users only within the specified distanceRange
        if (distance <= maxDistance) {
          return {
            id: like.receiver.id,
            name: like.receiver.name,
            photos: like.receiver.photos,
            gender: like.receiver.gender,
            dob: like.receiver.dob,
            favoritesFood: like.receiver.favoritesFood,
            interest: like.receiver.interests,
            email: like.receiver.email,
            distance: distance.toFixed(2), 
          };
        }
      }
      return null; // Exclude users without valid location or beyond distance range
    })
    .filter((user) => user !== null); // Remove null values
  // Apply pagination after filtering by distance
  const paginatedUsers = usersWithinDistance.slice(skip, skip + limit);

  return {
    meta: {
      page,
      limit,
      total: usersWithinDistance.length,
    },
    data: paginatedUsers,
  };
};


//peer to peer relationship
const getPeerLikes = async (
  user: JwtPayload,
  params: IUserFilterRequest,
  options: IPaginationOptions
) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, minAge, maxAge, distanceRange = 40075, ...filterData } = params;

  const authUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { lat: true, long: true },
  });

  if (!authUser || authUser.lat == null || authUser.long == null) {
    throw new ApiError(httpStatus.NOT_FOUND, "User's location is not available");
  }

  const maxDistance = distanceRange ? Number(distanceRange) : null;
  if (!maxDistance) {
    throw new ApiError(httpStatus.BAD_REQUEST, "A valid distanceRange is required.");
  }

  const currentDate = new Date();
  const minDob = maxAge
    ? new Date(currentDate.getFullYear() - maxAge, currentDate.getMonth(), currentDate.getDate())
    : undefined;
  const maxDob = minAge
    ? new Date(currentDate.getFullYear() - minAge, currentDate.getMonth(), currentDate.getDate())
    : undefined;

  const peerLikes = await prisma.like.findMany({
    where: {
      OR: [
        {
          senderId: user.id,
          receiver: {
            likesSent: {
              some: {
                receiverId: user.id,
              },
            },
          },
        },
        {
          receiverId: user.id,
          sender: {
            likesSent: {
              some: {
                senderId: user.id,
              },
            },
          },
        },
      ],
    },
    include: {
      receiver: {
        select: {
          id: true,
          name: true,
          photos: true,
          gender: true,
          email: true,
          dob: true,
          lat: true,
          long: true,
          favoritesFood: true,
          interests: true,
        },
      },
      sender: {
        select: {
          id: true,
          name: true,
          photos: true,
          gender: true,
          email: true,
          dob: true,
          lat: true,
          long: true,
          favoritesFood: true,
          interests: true,
        },
      },
    },
  });

  const filteredPeerLikes = peerLikes
    .map((like) => {
      const peerUser = like.senderId === user.id ? like.receiver : like.sender;
      if (peerUser.lat != null && peerUser.long != null) {
        const distance = calculateDistance(
          Number(authUser.lat),
          Number(authUser.long),
          Number(peerUser.lat),
          Number(peerUser.long)
        );

        if (distance <= maxDistance) {
          return {
            id: peerUser.id,
            name: peerUser.name,
            photos: peerUser.photos,
            gender: peerUser.gender,
            dob: peerUser.dob,
            favoritesFood: peerUser.favoritesFood,
            interest: peerUser.interests,
            email: peerUser.email,
            distance: distance.toFixed(2),
          };
        }
      }
      return null;
    })
    .filter((user) => user !== null);

  const paginatedPeerLikes = filteredPeerLikes.slice(skip, skip + limit);

  return {
    meta: {
      page,
      limit,
      total: filteredPeerLikes.length,
    },
    data: paginatedPeerLikes,
  };
};
//test

export const LikeService = {
  toggleLike,
  getAllMyLikedIds,
  getWhoLikeMe,
  getAllMyLikeUsers,
  getPeerLikes
};
