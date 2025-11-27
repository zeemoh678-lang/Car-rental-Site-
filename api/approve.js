import { supabaseAdmin } from "../lib/supabaseClient.mjs";
import { sendMail } from "../lib/mailer.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.end("Method not allowed");
  }

  const url = new URL(req.url, "http://localhost");
  const bookingId = url.searchParams.get("bookingId");

  if (!bookingId) {
    res.statusCode = 400;
    return res.end("Missing bookingId");
  }

  // Update booking in Supabase
  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .update({ status: "confirmed" })
    .eq("id", bookingId)
    .select()
    .single();

  if (error || !booking) {
    console.error("Supabase error:", error);
    res.statusCode = 500;
    return res.end("Error confirming booking");
  }

  const pickupDetails =
    process.env.PICKUP_DETAILS ||
    "Your vehicle will be ready for collection at the agreed pickup location.";

  // Send confirmation email to customer
  await sendMail({
    from: `"Car Rental" <${process.env.SMTP_USER}>`,
    to: booking.email,
    subject: "Your Booking is Confirmed",
    html: `
      <h2>Booking Confirmed</h2>
      <p>Your car hire booking is now confirmed.</p>

      <p><strong>Booking ID:</strong> ${booking.id}</p>
      <p><strong>Vehicle:</strong> ${booking.car_id}</p>
      <p><strong>Dates:</strong> ${booking.start_date} → ${booking.end_date}</p>
      <p><strong>Pickup Time:</strong> ${booking.pickup_time}</p>
      <p><strong>Dropoff Time:</strong> ${booking.dropoff_time}</p>

      <h3>Pickup Details</h3>
      <p>${pickupDetails}</p>

      <br>
      <p>Thank you for choosing our service!</p>
    `
  });

  // Simple response shown to YOU in browser
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html");
  res.end(`
    <html>
      <body style="font-family: Arial; padding: 2rem;">
        <h2>Booking Approved</h2>
        <p>Booking ID <strong>${booking.id}</strong> has been confirmed.</p>
        <p>The customer has been notified by email.</p>
      </body>
    </html>
  `);
}

