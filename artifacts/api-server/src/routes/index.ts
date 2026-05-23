import { Router, type IRouter } from "express";
import { authenticateOptional } from "../middleware/auth";
import healthRouter from "./health";
import authRouter from "./auth";
import iotRouter from "./iot";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authenticateOptional);
router.use("/auth", authRouter);
router.use(iotRouter);

export default router;
