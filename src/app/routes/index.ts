import { Router } from "express";
import { AuthRoutes } from "../modules/Auth/auth.routes";
import { userRoutes } from "../modules/User/user.route";
import {tripRoutes} from "../modules/Trip/trip.routes";
import { notificationsRoute } from "../modules/Notification/Notification.routes";
import { likeRouter } from "../modules/Like/Like.routes";
import { chatRoutes } from "../modules/Chat/chat.routes";
import { paymentRoutes } from "../modules/Payment/Payment.routes";
import { DislikeRouter } from "../modules/DisLike/DisLike.routes";
import path from "path";
import { stripeRoutes } from "../modules/Stripe/stripe.routes";
import { matchRoutes } from "../modules/Match/match.route";

const router = Router()

const moduleRoutes = [
    {path:'/auth',route:AuthRoutes},
    {path:'/user', route:userRoutes},
    {path:'/notifications', route:notificationsRoute},
    {path:'/likes', route:likeRouter},
    {path:'/dislikes', route:DislikeRouter},
    {path:'/chats', route:chatRoutes},
    {path:'/payment',route:paymentRoutes},
    {path:'/trip', route:tripRoutes},
    {path:'/stripe', route:stripeRoutes},
    {path:"/matches", route:matchRoutes}
]

moduleRoutes.forEach((route) => router.use(route.path, route.route));
export default router