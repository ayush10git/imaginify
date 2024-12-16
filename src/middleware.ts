import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/api/webhooks/clerk"]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!.*\\..*|_next).*)", // Match all routes except static files and Next.js internals
    "/(api|trpc)(.*)",
    "/dashboard/:path*", // Enable dynamic segments under /dashboard
  ],
};
