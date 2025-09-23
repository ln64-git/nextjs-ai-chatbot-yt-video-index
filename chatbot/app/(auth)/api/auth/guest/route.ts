import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { isDevelopmentEnvironment } from "@/lib/constants";
import { createGuestUser } from "@/lib/db/queries";

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const redirectUrl = searchParams.get("redirectUrl") || "/";

	const token = await getToken({
		req: request,
		secret: process.env.AUTH_SECRET,
		secureCookie: !isDevelopmentEnvironment,
	});

	if (token) {
		return NextResponse.redirect(new URL("/", request.url));
	}

	try {
		// Create guest user first
		console.log("Creating guest user...");
		const [guestUser] = await createGuestUser();
		console.log("Guest user created:", guestUser);

		// For now, let's just redirect and let the middleware handle it
		// The issue might be that we need to use the proper NextAuth flow
		return NextResponse.redirect(
			new URL(
				`/api/auth/signin/guest?callbackUrl=${encodeURIComponent(redirectUrl)}`,
				request.url,
			),
		);
	} catch (error) {
		console.error("Error in guest authentication:", error);
		return NextResponse.redirect(new URL("/login", request.url));
	}
}
