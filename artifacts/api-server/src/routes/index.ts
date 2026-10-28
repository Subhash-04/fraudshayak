import { Router, type IRouter } from "express";
import healthRouter from "./health";
import fraudSahayakRouter from "./fraud-sahayak";

const router: IRouter = Router();

router.use(healthRouter);
router.use(fraudSahayakRouter);

export default router;
