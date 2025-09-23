import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { signIn } from "@/app/(auth)/auth";
import { isDevelopmentEnvironment } from "@/lib/constants";
import { createGuestUser } from "@/lib/db/queries";

export async function POST(request: Request) {
	try {
		// Create guest user first
		console.log("Creating guest user...");
		const [guestUser] = await createGuestUser();
		console.log("Guest user created:", guestUser);

		// Now sign in with the guest user using the credentials provider
		const result = await signIn("guest", {
			redirect: false,
			email: guestUser.email,
			password: "dummy", // This won't be used since we're using credentials
		});

		if (result?.error) {
			console.error("Sign in error:", result.error);
			return NextResponse.json(
				{ error: "Authentication failed" },
				{ status: 500 },
			);
		}

		return NextResponse.json({ success: true, user: guestUser });
	} catch (error) {
		console.error("Error in guest authentication:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
