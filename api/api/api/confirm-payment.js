import Stripe from "stripe";
import { supabaseAdmin } from "../lib/supabaseClient.mjs";
import { sendMail } from "../lib/mailer.mjs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.end("Method not allowed");
  }

  // Extract session_id from URL query
  const url = new URL(req.url, "http://localhost");
  const sessionId = url.searchParams.get("session_id");

  if (!sessionId) {
    res.statusCode = 400;
    return res.end("Missing session_id");
  }

  // Fetch the Stripe checkout session
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    console.error("Stripe error:", err);
    res.statusCode = 400;
    return res.end("Invalid Stripe session");
  }

  // Ensure payment completed
  if (session.payment_status !== "paid") {
    res.statusCode = 400;
    return res.end("Payment not completed");
  }

  const bookingId = session.metadata?.bookingId;

  if (!bookingId) {
    res.statusCode = 400;
    return res.end("No bookingId in session metadata");
  }

  // Update booking in Supabase
  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .update({
      deposit_paid: true,
      status: "deposit_paid"
    })
    .eq("id", bookingId)
    .select()
    .single();

  if (error || !booking) {
    console.error("Supabase error:", error);
    res.statusCode = 500;
    return res.end("Error updating booking after payment");
  }

  // Email YOU (owner) with approval link
  const approveLink = `${process.env.PUBLIC_BASE_URL}/api/approve?bookingId=${booking.id}`;

  await sendMail({
    from: `"Car Rental Booking" <${process.env.SMTP_USER}>`,
    to: process.env.OWNER_EMAIL,
    subject: `£50 Deposit Paid - Booking ${booking.id}`,
    html: `
      <h2>Deposit received</h2>
      <p>The £50 deposit for booking <strong>${booking.id}</strong> has been paid.</p>

      <p><strong>Vehicle:</strong> ${booking.car_id}</p>
      <p><strong>Customer:</strong> ${booking.full_name} (${booking.email})</p>
      <p><strong>Dates:</strong> ${booking.start_date} → ${booking.end_date}</p>

      <hr>
      <p><a href="${approveLink}">CLICK HERE TO APPROVE BOOKING</a></p>
    `
  });

  // Email customer
  await sendMail({
    from: `"Car Rental" <${process.env.SMTP_USER}>`,
    to: booking.email,
    subject: "Deposit received – Awaiting approval",
    html: `
      <h2>Thank you for your deposit</h2>
      <p>Your £50 deposit has been successfully received.</p>

      <p>Your booking is now <strong>awaiting final approval</strong>.</p>

      <p><strong>Booking ID:</strong> ${booking.id}</p>
      <p><strong>Vehicle:</strong> ${booking.car_id}</p>
      <p><strong>Dates:</strong> ${booking.start_date} → ${booking.end_date}</p>

      <p>You will receive a confirmation email once your booking is approved.</p>
    `
  });

  // Return success to frontend
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ status: "ok", bookingId: booking.id }));
}

