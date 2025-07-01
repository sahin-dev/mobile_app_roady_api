import { Router } from "express";
import { fileUploader } from "../../../helpers/fileUploader";
import { tripController } from "./trip.controller";
import auth from "../../middlewares/auth.middleware";
import validateRequest from "../../middlewares/validation.middleware";
import { tripValidation } from "./trip.validation";



const router = Router()
//create a trip
router.post ('/', auth(),validateRequest(tripValidation.createTripSchema), tripController.createTrip)
//read trips
router.get('/', auth(), tripController.getMyTrips)
router.get("/users/:userId",auth(), tripController.getUserTrips)
//read a trip
router.get('/:id',auth(), tripController.getTripById)
//update a trip
// router.put("/:id")
// //delete a trip
// router.delete('/:id')
router.post(
    '/image-upload',
    auth(),
    fileUploader.uploadMultipleImage,
    tripController.imageUpload
  );

router.post(
    '/create-trip',
    auth(),
    fileUploader.uploadMultipleImage,
    tripController.createTripWithImage
  );
  
  

export const tripRoutes =  router