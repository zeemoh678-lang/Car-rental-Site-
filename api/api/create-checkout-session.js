import Stripe from "stripe";
import { supabaseAdmin } from "../lib/supabaseClient.mjs";

// Helper to parse JSON from request
async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end("Method not allowed");
  }

  // Parse incoming JSON
  let body;
  try {
    body = await parseJsonBody(req);
  } catch {
    res.statusCode = 400;
    return res.end("Invalid JSON");
  }

  const { bookingId } = body;

  if (!bookingId) {
    res.statusCode = 400;
    return res.end("Missing bookingId");
  }

  // Fetch booking details to include in Stripe metadata
  const { data: booking, e
