import express, {Request, Response} from "express";
import validateRequest from "../../middlewares/validation.middleware";
import { UserValidation } from "./user.validation";
import { userController } from "./user.controller";
import auth from "../../middlewares/auth.middleware";
import { UserRole } from "@prisma/client";
import { fileUploader } from "../../../helpers/fileUploader";

// import { fileUploader } from "../../../helpers/fileUploader";

const router = express.Router();

// *!register user
router.post(
  "/register",
  auth(),validateRequest(UserValidation.CreateUserValidationSchema),
  userController.createUser
);
router.get("/me", auth(), userController.getMyProfile);
router.post("/update-gender-visibility",auth(UserRole.USER), userController.updateGenderVisibility);
router.post('/set-phone',auth(), userController.setUserPhone)
router.post('/verify-set-phone',auth(), userController.verifySetUserPhone)
// *!get all  user 
router.get("/", userController.getUsers);
router.get("/get-random-user", userController.getRandomUser);
router.get("/get-user-home",auth(), userController.getUserForHomePage);
router.post('/check-email',validateRequest(UserValidation.checkEmailSchema), userController.checkEmail)
router.post('/check-username', userController.checkUsername)
router.post('/set-username',auth(), validateRequest(UserValidation.setUsernameSchema), userController.setUsername)
router.get("/:id", userController.getSingleUserById);
router.put("/",auth(),validateRequest(UserValidation.userUpdateSchema), userController.updateUser);
router.put("/photo", auth(), fileUploader.uploadMultipleImage, userController.updateProfilePhoto)
router.delete("/",auth(), userController.deleteUser);




// *!profile user
// router.put(
//   "/update-profile",
//   validateRequest(UserValidation.userUpdateSchema),

//   auth(UserRole.ADMIN, UserRole.USER),
//   fileUploader.uploadMultipleImage,
//   userController.updateProfile
// );

// *!update  user


export const userRoutes = router;
