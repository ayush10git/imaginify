/* eslint-disable camelcase */
import { clerkClient } from "@clerk/nextjs/server"; // Import Clerk client function
import { WebhookEvent } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix"; // Assuming you're using Svix for webhooks

import { createUser, deleteUser, updateUser } from "@/lib/actions/user.actions";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET; // Get the secret key for webhooks

  if (!WEBHOOK_SECRET) {
    throw new Error(
      "Please add WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local"
    );
  }

  // Get the headers from the request
  const headerPayload = headers();
  const svix_id = (await headerPayload).get("svix-id");
  const svix_timestamp = (await headerPayload).get("svix-timestamp");
  const svix_signature = (await headerPayload).get("svix-signature");

  // If there are no headers, return an error
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occurred -- no svix headers", {
      status: 400,
    });
  }

  // Get the body of the request
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  // Verify the webhook payload
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error occurred", {
      status: 400,
    });
  }

  const { id } = evt.data; // Get the ID from the webhook event
  const eventType = evt.type; // Get the event type (user.created, user.updated, etc.)

  // Handle user created
  if (eventType === "user.created") {
    const { id, email_addresses, image_url, first_name, last_name, username } =
      evt.data;

    // Ensure `id` and `username` are strings
    const user = {
      clerkId: id ?? "", // Fallback to empty string if id is undefined
      email: email_addresses[0].email_address,
      username: username ?? "", // Fallback to empty string if username is undefined
      firstName: first_name ?? "", // Ensure first_name is a string
      lastName: last_name ?? "", // Ensure last_name is a string
      photo: image_url ?? "", // Ensure image_url is a string or fallback to empty
    };

    // Create the user
    const newUser = await createUser(user);

    // Set public metadata for the user in Clerk using clerkClient()
    if (newUser) {
      const client = await clerkClient(); // Await the Clerk client instance
      await client.users.updateUserMetadata(id, {
        publicMetadata: {
          userId: newUser._id,
        },
      });
    }

    return NextResponse.json({ message: "OK", user: newUser });
  }

  // Handle user updated
  if (eventType === "user.updated") {
    const { id, image_url, first_name, last_name, username } = evt.data;

    // Prepare the updated user data
    const user = {
      firstName: first_name ?? "", // Ensure first_name is a string
      lastName: last_name ?? "", // Ensure last_name is a string
      username: username ?? "", // Ensure username is a string
      photo: image_url ?? "", // Ensure image_url is a string
    };

    // Update the user
    const updatedUser = await updateUser(id, user);

    return NextResponse.json({ message: "OK", user: updatedUser });
  }

  // Handle user deleted
  if (eventType === "user.deleted") {
    const { id } = evt.data;

    // Delete the user
    const deletedUser = await deleteUser(id!);

    return NextResponse.json({ message: "OK", user: deletedUser });
  }

  // Log event information for debugging
  console.log(`Webhook with an ID of ${id} and type of ${eventType}`);
  console.log("Webhook body:", body);

  return new Response("", { status: 200 });
}
