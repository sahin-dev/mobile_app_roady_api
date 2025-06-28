import { RequestType, User, UserStatus } from "@prisma/client";

import * as bcrypt from "bcrypt";
import crypto, { verify } from "crypto";
import httpStatus from "http-status";
import { Secret } from "jsonwebtoken";
import config from "../../../config";
import ApiError from "../../../errors/ApiError";
import { generateToken, verifyToken } from "../../../helpers/jwt";
import emailSender from "../../../shared/mailSender";
import prisma from "../../db/client";
import { generateOtp } from "../../../helpers/generateOtp";
import jwt from "jsonwebtoken";
import { getApplePublicKey } from "../../../helpers/applePublicKey";
import { generateOtpEmailHtml } from "../../../shared/html";
import { Twilio } from "twilio";

// const initiateLogin = async (payload: { phone: string }) => {
//   //Send this otp to user through email or phone whatever client prefer.
//   //save to database

//   const user = await prisma.user.findFirst({ where: { phone: payload.phone } });
//   if (!user) {
//     throw new ApiError(httpStatus.NOT_FOUND, "User not found!");
//   }
//   const otp = generateOtp();
//   const expirationDate = new Date(Date.now() + 5 * 60 * 1000);

//   const client = new Twilio(config.twilio.accountSid, config.twilio.authToken);

//   if (!payload.phone || !payload.phone.startsWith("+")) {
//     throw new ApiError(
//       httpStatus.BAD_REQUEST,
//       "Phone number must be in E.164 format with country code."
//     );
//   }

//   //   // Create email content
//   const html = `
//     <div style="font-family: Arial, sans-serif; color: #333; padding: 30px; background: linear-gradient(135deg, #6c63ff, #3f51b5); border-radius: 8px;">
//         <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px;">
//             <h2 style="color: #ffffff; font-size: 28px; text-align: center; margin-bottom: 20px;">
//                 <span style="color: #ffeb3b;">Resend OTP</span>
//             </h2>
//             <p style="font-size: 16px; color: #333; line-height: 1.5; text-align: center;">
//                 Here is your new OTP code to complete the process.
//             </p>
//             <p style="font-size: 32px; font-weight: bold; color: #ff4081; text-align: center; margin: 20px 0;">
//                 ${otp}
//             </p>
//             <div style="text-align: center; margin-bottom: 20px;">
//                 <p style="font-size: 14px; color: #555; margin-bottom: 10px;">
//                     This OTP will expire in <strong>5 minutes</strong>. If you did not request this, please ignore this email.
//                 </p>
//                 <p style="font-size: 14px; color: #555; margin-bottom: 10px;">
//                     If you need further assistance, feel free to contact us.
//                 </p>
//             </div>
//             <div style="text-align: center; margin-top: 30px;">
//                 <p style="font-size: 12px; color: #999; text-align: center;">
//                     Best Regards,<br/>
//                     <span style="font-weight: bold; color: #3f51b5;">levimusuc@team.com</span><br/>
//                     <a href="mailto:support@booksy.buzz.com" style="color: #ffffff; text-decoration: none; font-weight: bold;">Contact Support</a>
//                 </p>
//             </div>
//         </div>
//     </div>
//   `;

//   // Send the OTP to user's email
//     const message = await client.messages.create({
//       body: `Here is your new OTP code to complete the process. ${otp}. It will expire in 5 minutes.`,
//       from: config.twilio.twilioPhoneNumber,
//       to: payload.phone,
//     });
//     console.log(message, "message sent successfully");
//     await prisma.user.update({
//       where: { id: user.id },
//       data: { otp, otpExpiresIn: expirationDate },
//     });

//     return { message: "Otp generated successfully", msgBody: message };
// };

const initiateLogin = async (payload: { phone: string }) => {
  // Send OTP to the user through phone number.
  // Save to the database.

  const user = await prisma.user.findFirst({ where: { phone: payload.phone } });
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found!");
  }
  const otp = generateOtp();
  const expirationDate = new Date(Date.now() + 5 * 60 * 1000);

  const client = new Twilio(config.twilio.accountSid, config.twilio.authToken);

  if (!payload.phone || !payload.phone.startsWith("+")) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Phone number must be in E.164 format with country code."
    );
  }

  // Send OTP via Twilio
  const message = await client.messages.create({
    body: `Here is your new OTP code to complete the process. ${otp}. It will expire in 5 minutes.`,
    from: config.twilio.twilioPhoneNumber,
    to: payload.phone,
  });
  console.log(message, "message sent successfully");

  // Update the user with OTP and expiration date
  await prisma.user.update({
    where: { id: user.id }, // Use user ID to update
    data: { otp, otpExpiresIn: expirationDate },
  });

  return { message: "Otp generated successfully", msgBody: message };
};


// user login
//check otp
//inavalidate otp
const loginUser = async (payload: {
  phone: string;
  otp: string;
  fcmtoken?: string;
}) => {
  const user = await prisma.user.findFirst({ where: { phone: payload.phone } });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found!");
  }
  if (!user.otp) {
    throw new ApiError(httpStatus.NOT_FOUND, "Otp not found");
  }

  if (payload.otp !== user.otp) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Otp is incorrect");
  }

  if (!user.otpExpiresIn || user.otpExpiresIn < new Date()) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Otp is invalid");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { otp: "", otpExpiresIn: "" },
  });

  if (payload && payload.fcmtoken) {
    await prisma.user.update({
      where: { id: user.id },
      data: { fcmToken: payload.fcmtoken },
    });
  }

  const accessToken = generateToken(
    {
      id: user.id,
      phone: user.phone,
      role: user.role,
    },
    config.jwt.jwt_secret as Secret,
    config.jwt.expires_in as string
  );

  return { token: accessToken };
};

const googleLogin = async (googleProfile: any) => {
  const id = googleProfile.id as string;
  let user = await prisma.user.findFirst({
    where: { googleId: googleProfile.id },
  });
  console.log(id);
  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: id,
        username: googleProfile.displayName,
        firstName: googleProfile.name?.givenName,
        lastName: googleProfile.name?.familyName,
        email: googleProfile.emails[0].value,
      },
    });
  }

  const accessToken = generateToken(
    {
      id: user.id,
      phone: user.phone,
      role: user.role,
    },
    config.jwt.jwt_secret as Secret,
    config.jwt.expires_in as string
  );

  return { token: accessToken };
};

const appleLogin = async (appleProfile: any) => {
  // const decodeHeader = jwt.decode(token, {complete:true})
  // const appleKey = await getApplePublicKey(decodeHeader?.header.kid as string) as string
  // const payload = jwt.verify(token, appleKey);
  // if (payload.sub === user){
  // }
};

// // get user profile
const getMyProfile = async (userId: string) => {
  const userProfile = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      about: true,
      age: true,
      appleId: true,
      boosted: true,
      residence_country: true,
      interestAgeGroup: true,
      tripContinent: true,
      tripCountry: true,
      travelPartner: true,
      tripDuration: true,
      tripType: true,
      budgetMin: true,
      budgetMax: true,
      dob: true,
      distance: true,
      genderVisibility: true,
      gender: true,
      status: true,
    },
  });

  if (userProfile?.status === UserStatus.INACTIVE) {
    throw new ApiError(httpStatus.NOT_FOUND, "User inactive");
  }

  if (userProfile && userProfile?.genderVisibility === false) {
    userProfile.gender = null;
  }

  return userProfile;
};

const verifyWithEmail = async (email: string, requetsType: RequestType) => {
  let user = await prisma.user.findFirst({
    where: { email, status: UserStatus.ACTIVE },
  });

  if (requetsType === RequestType.LOGIN) {
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found or not active");
    }
  } else if (requetsType === RequestType.CHANGE_PHONE) {
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found or not active");
    }
  } else if (requetsType === RequestType.SIGNUP) {
    if (user) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `User with this email ${email} already exist.`
      );
    }
    const inactiveUser = await prisma.user.findFirst({
      where: { email, status: UserStatus.INACTIVE },
    });

    if (inactiveUser) {
      user = inactiveUser;
    } else {
      user = await prisma.user.create({ data: { email } });
    }
  }
  const otp = generateOtp();
  const otpExpiary = new Date(Date.now() + 5 * 60 * 1000);

  if (user)
    await prisma.user.update({
      where: { id: user.id },
      data: { otp, otpExpiresIn: otpExpiary },
    });

  const html = `
    <div style="font-family: Arial, sans-serif; color: #333; padding: 30px; background: linear-gradient(135deg, #6c63ff, #3f51b5); border-radius: 8px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px;">
            <h2 style="color: #ffffff; font-size: 28px; text-align: center; margin-bottom: 20px;">
                <span style="color: #ffeb3b;">Resend OTP</span>
            </h2>
            <p style="font-size: 16px; color: #333; line-height: 1.5; text-align: center;">
                Here is your new OTP code to complete the ${requetsType} request.
            </p>
            <p style="font-size: 32px; font-weight: bold; color: #ff4081; text-align: center; margin: 20px 0;">
                ${otp}
            </p>
            <div style="text-align: center; margin-bottom: 20px;">
                <p style="font-size: 14px; color: #555; margin-bottom: 10px;">
                    This OTP will expire in <strong>5 minutes</strong>. If you did not request this, please ignore this email.
                </p>
                <p style="font-size: 14px; color: #555; margin-bottom: 10px;">
                    If you need further assistance, feel free to contact us.
                </p>
            </div>
            <div style="text-align: center; margin-top: 30px;">
                <p style="font-size: 12px; color: #999; text-align: center;">
                    Best Regards,<br/>
                    <span style="font-weight: bold; color: #3f51b5;">`;

  emailSender(email, html, "Otp verification for Roady App");
};

const verifyRequestWithEmail = async (
  email: string,
  otp: string,
  requestType: RequestType,
  newPhone?: string,
  fcmToken?: string
) => {
  // if (!user){
  //   throw new ApiError(httpStatus.NOT_FOUND, "User not found")
  // }

  // if(!user.otp){
  //   throw new ApiError(httpStatus.NOT_FOUND, "Otp is not present")
  // }

  // if (user.otp !== otp || !user.otpExpiresIn || user.otpExpiresIn < new Date()){
  //   throw new ApiError (httpStatus.BAD_REQUEST, "Otp is invalid")
  // }
  // await prisma.user.update({where:{id:user.id}, data:{otp:null, otpExpiresIn:null}})
  let result;
  if (requestType === RequestType.LOGIN) {
    const user = await prisma.user.findFirst({
      where: { email, status: UserStatus.ACTIVE },
    });
    if (!user || user.status === UserStatus.INACTIVE) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found or not active");
    }

    if (
      user.otp !== otp ||
      !user.otpExpiresIn ||
      user.otpExpiresIn < new Date()
    ) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Otp is invalid");
    }

    if (fcmToken) {
      await prisma.user.update({
        where: { id: user.id },
        data: { fcmToken: fcmToken },
      });
    }

    const accessToken = generateToken(
      {
        id: user.id,
        phone: user.phone,
        role: user.role,
      },
      config.jwt.jwt_secret as Secret,
      config.jwt.expires_in as string
    );

    result = { token: accessToken };
  } else if (requestType === RequestType.SIGNUP) {
    const user = await prisma.user.findFirst({
      where: { email, status: UserStatus.ACTIVE },
    });
    if (user) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `User with this email ${email} already exist.`
      );
    }
    const inactiveUser = await prisma.user.findFirst({
      where: { email, status: UserStatus.INACTIVE },
    });
    if (!inactiveUser) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    if (
      inactiveUser.otp !== otp ||
      !inactiveUser.otpExpiresIn ||
      inactiveUser.otpExpiresIn < new Date()
    ) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Otp is invalid");
    }

    await prisma.user.update({
      where: { id: inactiveUser.id },
      data: { status: UserStatus.ACTIVE },
    });

    const accessToken = generateToken(
      {
        id: inactiveUser.id,
        phone: inactiveUser.phone,
        role: inactiveUser.role,
      },
      config.jwt.jwt_secret as Secret,
      config.jwt.expires_in as string
    );
    result = { message: "User account active", token: accessToken };
  } else if (requestType === RequestType.CHANGE_PHONE) {
    const user = await prisma.user.findFirst({
      where: { email, status: UserStatus.ACTIVE },
    });
    if (!user || user.status === UserStatus.INACTIVE) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found or not active");
    }

    if (!newPhone) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "New phone number is required"
      );
    }

    if (
      user.otp !== otp ||
      !user.otpExpiresIn ||
      user.otpExpiresIn < new Date()
    ) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Otp is invalid");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { phone: newPhone },
    });
    result = { message: "Phone number change successfully." };
  }
  return result;
};

const verifyPhoneNumber = async ({
  phone,
  requestType,
}: {
  phone: string;
  requestType: string;
}) => {
  const user = await prisma.user.findFirst({ where: { phone } });

  if (requestType === RequestType.LOGIN) {
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found!");
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new ApiError(httpStatus.NOT_FOUND, "User account is inactive");
    }

    const otp = generateOtp();
    const otpExpiary = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { otp, otpExpiresIn: otpExpiary },
    });

    return { message: "Otp send successfully" };
  } else if (requestType === RequestType.CHANGE_PHONE) {
    // const user = await prisma.user.findFirst({where:{phone}})
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }
    if (user.status === UserStatus.INACTIVE) {
      throw new ApiError(httpStatus.NOT_FOUND, "User account is inactive");
    }

    const otp = generateOtp();
    const otpExpiary = new Date(Date.now() + 5 * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: { otp, otpExpiresIn: otpExpiary },
    });

    return { message: "Otp send successfully" };
  } else if (requestType === RequestType.SIGNUP) {
    const activeUser = await prisma.user.findFirst({
      where: { phone, status: UserStatus.ACTIVE },
    });
    if (activeUser) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `User with this phone ${phone} already exist.`
      );
    }

    const inactiveUser = await prisma.user.findFirst({
      where: { phone, status: UserStatus.INACTIVE },
    });

    // const userPresent = await checkUserExistence(phone)

    const otp = generateOtp();
    const otpExpiary = new Date(Date.now() + 15 * 60 * 1000);

    if (!inactiveUser) {
      await prisma.user.create({
        data: { phone, otp, otpExpiresIn: otpExpiary },
      });
    } else {
      await prisma.user.update({
        where: { id: inactiveUser.id },
        data: { otp, otpExpiresIn: otpExpiary },
      });
    }

    const html = `
    <div style="font-family: Arial, sans-serif; color: #333; padding: 30px; background: linear-gradient(135deg, #6c63ff, #3f51b5); border-radius: 8px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px;">
            <h2 style="color: #ffffff; font-size: 28px; text-align: center; margin-bottom: 20px;">
                <span style="color: #ffeb3b;">Resend OTP</span>
            </h2>
            <p style="font-size: 16px; color: #333; line-height: 1.5; text-align: center;">
                Here is your new OTP code to complete the process.
            </p>
            <p style="font-size: 32px; font-weight: bold; color: #ff4081; text-align: center; margin: 20px 0;">
                ${otp}
            </p>
            <div style="text-align: center; margin-bottom: 20px;">
                <p style="font-size: 14px; color: #555; margin-bottom: 10px;">
                    This OTP will expire in <strong>15 minutes</strong>. If you did not request this, please ignore this email.
                </p>
                <p style="font-size: 14px; color: #555; margin-bottom: 10px;">
                    If you need further assistance, feel free to contact us.
                </p>
            </div>
            <div style="text-align: center; margin-top: 30px;">
                <p style="font-size: 12px; color: #999; text-align: center;">
                    Best Regards,<br/>
                    <span style="font-weight: bold; color: #3f51b5;">`;

    return {
      message: "Otp sent successfully. Otp willbe valid for 15 minutes.",
    };
  }
};

const verifyRequest = async ({
  phone,
  otp,
  requestType,
  newPhone,
  fcmToken,
}: {
  phone: string;
  otp: string;
  requestType: RequestType;
  newPhone?: string;
  fcmToken?: string;
}) => {
  const user = await prisma.user.findFirst({ where: { phone } });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (requestType === RequestType.LOGIN) {
    if (user.status === UserStatus.INACTIVE) {
      throw new ApiError(httpStatus.NOT_FOUND, "User account is inactive");
    }
  }

  if (!user.otp) {
    throw new ApiError(httpStatus.NOT_FOUND, "Otp is not present");
  }

  if (
    user.otp !== otp ||
    !user.otpExpiresIn ||
    user.otpExpiresIn < new Date()
  ) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Otp is invalid");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { otp: null, otpExpiresIn: null },
  });

  let result;
  if (requestType === RequestType.LOGIN) {
    if (user.status === UserStatus.INACTIVE) {
      throw new ApiError(httpStatus.NOT_FOUND, "User account is inactive");
    }
    if (fcmToken) {
      await prisma.user.update({
        where: { id: user.id },
        data: { fcmToken: fcmToken },
      });
    }

    const accessToken = generateToken(
      {
        id: user.id,
        phone: user.phone,
        role: user.role,
      },
      config.jwt.jwt_secret as Secret,
      config.jwt.expires_in as string
    );

    result = { token: accessToken };
  } else if (requestType === RequestType.SIGNUP) {
    await prisma.user.update({
      where: { id: user.id },
      data: { fcmToken: fcmToken ? fcmToken : null, status: UserStatus.ACTIVE },
    });

    const accessToken = generateToken(
      {
        id: user.id,
        phone: user.phone,
        role: user.role,
      },
      config.jwt.jwt_secret as Secret,
      config.jwt.expires_in as string
    );
    result = { message: "User account active", token: accessToken };
  } else if (requestType === RequestType.CHANGE_PHONE) {
    await prisma.user.update({
      where: { id: user.id },
      data: { phone: newPhone },
    });
    result = { message: "Phone number change successfully." };
  }
  return result;
};

const checkUserExistence = async (phone: string) => {
  const user = await prisma.user.findFirst({ where: { phone } });
  if (user) {
    return true;
  }
  return false;
};

// // change password

const changePhoneNumber = async (
  token: string,
  newPhone: string,
  oldPhone: string
) => {
  const decode = verifyToken(token, config.jwt.jwt_secret!);
  const user = await prisma.user.findUnique({ where: { id: decode.id } });
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found!");
  }
  if (user.phone !== oldPhone || user.deleted) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Incorrect phone number");
  }

  const otp = generateOtp();
  const expirationDate = new Date(Date.now() + 5 * 60 * 1000);
  await prisma.user.update({
    where: { id: decode.id },
    data: { otp: otp, otpExpiresIn: expirationDate.toISOString() },
  });

  return { message: "Otp send successfully" };
};

const verifyChangePhoneNumberOtp = async (
  token: string,
  otp: string,
  newPhone: string
) => {
  const decode = verifyToken(token, config.jwt.jwt_secret!);
  const user = await prisma.user.findUnique({ where: { id: decode.id } });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }
  if (
    user.otp !== otp ||
    !user.otpExpiresIn ||
    user.otpExpiresIn < new Date()
  ) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Otp is invalid");
  }

  await prisma.user.update({
    where: { id: decode.id },
    data: { phone: newPhone, otp: null, otpExpiresIn: null },
  });
  return { message: "Phone number changed successfully" };
};

// const checkPhoneNumber = async (phone:string)=>{
//   const user = await prisma.user.findUnique({where:{phone}})
//   if(user){

//   }
// }
// const changePassword = async (
//   userToken: string,
//   newPassword: string,
//   oldPassword: string
// ) => {
//   const decodedToken = verifyToken(
//     userToken,
//     config.jwt.jwt_secret!
//   );

//   const user = await prisma.user.findUnique({
//     where: { id: decodedToken?.id },
//   });

//   if (!user) {
//     throw new ApiError(404, "User not found");
//   }

//   const isPasswordValid = await bcrypt.compare(oldPassword, user?.password);

//   if (!isPasswordValid) {
//     throw new ApiError(401, "Incorrect old password");
//   }

//   const hashedPassword = await bcrypt.hash(newPassword, 12);

//   const result = await prisma.user.update({
//     where: {
//       id: decodedToken.id,
//     },
//     data: {
//       password: hashedPassword,
//     },
//   });
//   return { message: "Password changed successfully" };
// };

// const forgotPassword = async (payload: { email: string }) => {
//   // Fetch user data or throw if not found
//   const userData = await prisma.user.findFirstOrThrow({
//     where: {
//       email: payload.email,
//     },
//   });

//   // Generate a new OTP
//   const otp = Number(crypto.randomInt(1000, 9999));

//   // Set OTP expiration time to 10 minutes from now
//   const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

//   // Create the email content
//   const html = `
// <div style="font-family: Arial, sans-serif; color: #333; padding: 30px; background: linear-gradient(135deg, #6c63ff, #3f51b5); border-radius: 8px;">
//     <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px;">
//         <h2 style="color: #ffffff; font-size: 28px; text-align: center; margin-bottom: 20px;">
//             <span style="color: #ffeb3b;">Forgot Password OTP</span>
//         </h2>
//         <p style="font-size: 16px; color: #333; line-height: 1.5; text-align: center;">
//             Your forgot password OTP code is below.
//         </p>
//         <p style="font-size: 32px; font-weight: bold; color: #ff4081; text-align: center; margin: 20px 0;">
//             ${otp}
//         </p>
//         <div style="text-align: center; margin-bottom: 20px;">
//             <p style="font-size: 14px; color: #555; margin-bottom: 10px;">
//                 This OTP will expire in <strong>10 minutes</strong>. If you did not request this, please ignore this email.
//             </p>
//             <p style="font-size: 14px; color: #555; margin-bottom: 10px;">
//                 If you need assistance, feel free to contact us.
//             </p>
//         </div>
//         <div style="text-align: center; margin-top: 30px;">
//             <p style="font-size: 12px; color: #999; text-align: center;">
//                 Best Regards,<br/>
//                 <span style="font-weight: bold; color: #3f51b5;">nathancloud Team</span><br/>
//                 <a href="mailto:support@nathancloud.com" style="color: #ffffff; text-decoration: none; font-weight: bold;">Contact Support</a>
//             </p>
//         </div>
//     </div>
// </div> `;

//   // Send the OTP email to the user
//   await emailSender(userData.email, html, "Forgot Password OTP");

//   // Update the user's OTP and expiration in the database
//   await prisma.user.update({
//     where: { id: userData.id },
//     data: {
//       otp: otp,
//       expirationOtp: otpExpires,
//     },
//   });

//   return { message: "Reset password OTP sent to your email successfully" };
// };

const resendOtp = async (phone: string) => {
  // Check if the user exists
  const user = await prisma.user.findFirst({
    where: { phone },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "This user is not found!");
  }

  // Generate a new OTP
  const otp = generateOtp();

  // Set OTP expiration time to 5 minutes from now
  const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

  // Send the OTP to user's phone using Twilio
  const client = new Twilio(config.twilio.accountSid, config.twilio.authToken);

  // Send OTP via SMS
  const message = await client.messages.create({
    body: `Here is your new OTP code: ${otp}. It will expire in 5 minutes.`,
    from: config.twilio.twilioPhoneNumber, // Twilio phone number
    to: phone, // Phone number from request
  });

  console.log(message, "OTP sent successfully");

  // Update the user's profile with the new OTP and expiration
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      otp: otp,
      otpExpiresIn: otpExpires,
    },
  });

  return { message: "OTP resent successfully" };
};


// const verifyForgotPasswordOtp = async (payload: {
//   email: string;
//   otp: number;
// }) => {
//   // Check if the user exists
//   const user = await prisma.user.findUnique({
//     where: { email: payload.email },
//   });

//   if (!user) {
//     throw new ApiError(httpStatus.NOT_FOUND, "This user is not found!");
//   }

//   // Check if the OTP is valid and not expired
//   if (
//     user.otp !== payload.otp ||
//     !user.expirationOtp ||
//     user.expirationOtp < new Date()
//   ) {
//     throw new ApiError(httpStatus.BAD_REQUEST, "Invalid OTP");
//   }

//   // Update the user's OTP, OTP expiration, and verification status
//   await prisma.user.update({
//     where: { id: user.id },
//     data: {
//       otp: null, // Clear the OTP
//       expirationOtp: null, // Clear the OTP expiration
//       status: UserStatus.ACTIVE,
//     },
//   });

//   const token= await  generateToken({id: user.id,
//     email: user.email,
//     role: user.role}, config.jwt.jwt_secret as Secret, config.jwt.expires_in as string);

//   return { message: "OTP verification successful", token: token };
// };

// // reset password
// const resetPassword = async (payload: { password: string; email: string }) => {
//   // Check if the user exists
//   const user = await prisma.user.findUnique({
//     where: { email: payload.email },
//   });

//   if (!user) {
//     throw new ApiError(httpStatus.NOT_FOUND, "This user is not found!");
//   }

//   // Hash the new password
//   const hashedPassword = await bcrypt.hash(payload.password, 10);

//   // Update the user's password in the database
//   await prisma.user.update({
//     where: { email: payload.email },
//     data: {
//       password: hashedPassword, // Update with the hashed password
//       otp: null, // Clear the OTP
//       expirationOtp: null, // Clear OTP expiration
//     },
//   });

//   return { message: "Password reset successfully" };
// };

// const changePhone = async (payload:{email:string,newPhone:string})=>{
//     const user = await prisma.user.findUnique({where:{email:payload.email}})
//     if (!user){
//         throw new ApiError(httpStatus.NOT_FOUND, "User not found!")
//     }
//     await prisma.user.update({where:{id:user.id}, data:{phone:payload.newPhone}})

//     return {message:"Phone number changed successfully"}
// }

// const verifyPhone = async (payload:{phone:string})=>{
//     const user  = await prisma.user.findUnique({where:{phone:payload.phone}})
//     if (user){
//         throw new ApiError(httpStatus.CONFLICT, "Phone already exist.")
//     }
//     const otp =  Math.floor(100000 + Math.random() * 900000).toString()
//     await prisma.verifyPhone.create({data:{otp,phone:payload.phone}})
//     return {message:"Otp sent to your phone number"}
// }

// const verifySignInOtp = async (payload:{phone:string, otp:string})=>{
//     const verifyPhone = await prisma.verifyPhone.findUnique({where:{phone:payload.phone}})
//     if (!verifyPhone){
//         throw new ApiError(httpStatus.NOT_FOUND, "Otp invalid!")
//     }
//     if (verifyPhone.otp != payload.otp){
//         throw new ApiError(httpStatus.UNAUTHORIZED, "Otp does not match!")
//     }
//     return {message:"Phone number verified successfully"}

// }

const generateOtpAndExpiry = (minutes = 5) => {
  const otp = generateOtp();
  const otpExpiresIn = new Date(Date.now() + minutes * 60 * 1000);
  return { otp, otpExpiresIn };
};

const validateOtp = (user: any, otp: string) => {
  if (
    !user.otp ||
    !user.otpExpiresIn ||
    user.otp !== otp ||
    user.otpExpiresIn < new Date()
  ) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Otp is invalid or expired");
  }
};

// const sendOtp = async (phone: string, requestType: RequestType) => {
//   // Generate OTP and set expiration time (5 minutes for login, 15 for signup)
//   const otpData = generateOtpAndExpiry(requestType === RequestType.SIGNUP ? 15 : 5);

//   // Send OTP via Twilio to the phone number
//   const client = new Twilio(config.twilio.accountSid, config.twilio.authToken);

//   // Check if the phone number starts with the country code (+)
//   if (!phone.startsWith("+")) {
//     throw new ApiError(httpStatus.BAD_REQUEST, "Phone number must be in E.164 format with country code.");
//   }

//   // Send OTP to user's phone number via Twilio
//   const message = await client.messages.create({
//     body: `Here is your OTP code to complete the process: ${otpData.otp}. It will expire in 5 minutes.`,
//     from: config.twilio.twilioPhoneNumber,
//     to: phone, // Phone number from request
//   });

//   // Find the user by phone
//   const user = await prisma.user.findFirst({
//     where: { phone },
//   });

//   if (!user) {
//     throw new ApiError(httpStatus.NOT_FOUND, "User not found!");
//   }

//   // Save the OTP and its expiration to the database using the user's id
//   await prisma.user.update({
//     where: { id: user.id },  // Use user.id to update
//     data: { otp: otpData.otp, otpExpiresIn: otpData.otpExpiresIn },
//   });

//   // Return a success message
//   return { message: "OTP sent successfully to your phone." };
// };

const sendOtp = async (
  identifier: string,
  method: 'email' | 'phone',
  requestType: RequestType
) => {

  const whereClause = method === 'email' ? { email: identifier } : { phone: identifier };
  const user = await prisma.user.findFirst({ where: whereClause });

  const isSignup = requestType === RequestType.SIGNUP;
  const isChangePhone = requestType === RequestType.CHANGE_PHONE;
  const isLogin = requestType === RequestType.LOGIN;

  const otpData = generateOtpAndExpiry(isSignup ? 15 : 5);

  if (isSignup) {
    if (user && user.status === UserStatus.ACTIVE)
      throw new ApiError(httpStatus.BAD_REQUEST, `User with this ${method} already exists.`);

    if (user && user.status === UserStatus.INACTIVE) {
      await prisma.user.update({ where: { id: user.id }, data: otpData });
    } else {
      const createData = method === 'email' ? { email: identifier } : { phone: identifier };
      await prisma.user.create({ data: { ...createData, ...otpData } });
    }
  } else {
    if (!user || user.status !== UserStatus.ACTIVE)
      throw new ApiError(httpStatus.NOT_FOUND, `User not found or inactive.`);

    await prisma.user.update({ where: { id: user.id }, data: otpData });
  }

  const client = new Twilio(config.twilio.accountSid, config.twilio.authToken);

  // Check if the phone number starts with the country code (+)
  if (method === 'phone' && !identifier.startsWith("+")) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Phone number must be in E.164 format with country code.");
  }

  // Send OTP to user's phone number via Twilio
  if (method === 'phone') {
    const message = await client.messages.create({
      body: `Here is your OTP code to complete the process: ${otpData.otp}. It will expire in 5 minutes.`,
      from: config.twilio.twilioPhoneNumber,
      to: identifier, // Phone number from request
    });
  }

  if (method === 'email') {
    const html = `
      <div style="font-family: Arial, sans-serif;">
        <h2>OTP for ${requestType}</h2>
        <p>Your OTP is: <strong>${otpData.otp}</strong></p>
        <p>This OTP will expire in ${requestType === RequestType.SIGNUP ? "15" : "5"} minutes.</p>
      </div>
    `;
    await emailSender(identifier, html, "Otp verification for Roady App");
  }

  return { message: `Otp sent successfully to your ${method}.` };
};




const verifyOtp = async (
  identifier: string,
  otp: string,
  requestType: RequestType,
  method: "email" | "phone",
  newPhone?: string,
  fcmToken?: string
) => {
  const whereClause =
    method === "email" ? { email: identifier } : { phone: identifier };

  let user = await prisma.user.findFirst({ where: whereClause }); // Updated this line to use the correct `whereClause`

  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");

  validateOtp(user, otp);

  // Remove OTP after verification
  await prisma.user.update({
    where: { id: user.id },
    data: { otp: null, otpExpiresIn: null },
  });

  if (requestType === RequestType.LOGIN || requestType === RequestType.SIGNUP) {
    const updateData: any = {};
    if (fcmToken) updateData.fcmToken = fcmToken;
    if (requestType === RequestType.SIGNUP) updateData.status = UserStatus.ACTIVE;

    if (Object.keys(updateData).length) {
      await prisma.user.update({ where: { id: user.id }, data: updateData });
    }

    const token = generateToken(
      { id: user.id, phone: user.phone, role: user.role },
      config.jwt.jwt_secret as Secret,
      config.jwt.expires_in as string
    );

    return {
      message:
        requestType === RequestType.SIGNUP
          ? "User activated"
          : "Login successful",
      token,
    };
  }

  if (requestType === RequestType.CHANGE_PHONE) {
    if (!newPhone)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "New phone number is required"
      );

    await prisma.user.update({
      where: { id: user.id },
      data: { phone: newPhone },
    });
    return { message: "Phone number changed successfully" };
  }

  return { message: "Verification completed" };
};


export const AuthServices = {
  initiateLogin,
  loginUser,
  getMyProfile,
  verifyPhoneNumber,
  verifyRequest,
  appleLogin,
  googleLogin,
  verifyWithEmail,
  verifyRequestWithEmail,
  sendOtp,
  verifyOtp,
  //   changePassword,
  //   forgotPassword,
  //   resetPassword,
  resendOtp,
  //   verifyForgotPasswordOtp,
  //   verifyPhone,
  //   verifySignInOtp
};
