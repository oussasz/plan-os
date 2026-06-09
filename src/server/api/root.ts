import { adHocRouter } from "~/server/api/routers/adHoc";
import { executionRouter } from "~/server/api/routers/execution";
import { fixedEventRouter } from "~/server/api/routers/fixedEvent";
import { planningRouter } from "~/server/api/routers/planning";
import { projectRouter } from "~/server/api/routers/project";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  planning: planningRouter,
  project: projectRouter,
  fixedEvent: fixedEventRouter,
  adHoc: adHocRouter,
  execution: executionRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
