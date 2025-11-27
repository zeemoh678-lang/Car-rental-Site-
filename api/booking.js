import { supabaseAdmin } from "../lib/supabaseClient.mjs";
import { sendMail } from "../lib/mailer.mjs";

// Helper to parse JSON body from Vercel serverless functions
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end("Method not allowed");
  }

  // Parse incoming JSON body
  let data;
  try {
    data = await parseJsonBody(req);
  } catch (err) {
    res.statusCode = 400;
    return res.end("Invalid JSON");
  }

  // Required fields
  const required = [
    "car",
    "startDate",
    "endDate",
    "pickupTime",
    "dropoffTime",
    "fullName",
    "email",
    "phone",
    "age",
    "address",
    "licenseNumber"
  ];

  for (const field of required) {
    if (!data[field]) {
      res.statusCode = 400;
      return res.end(`Missing field: ${field}`);
    }
  }

  const {
    car,
    startDate,
    endDate,
    pickupTime,
    dropoffTime,
    fullName,
    email,
    phone,
    age,
    address,
    licenseNumber,
    notes,
    idFilePath
  } = data;

  // Save booking to Supabase
  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .insert({
      car_id: car,
      start_date: startDate,
      end_date: endDate,
      pickup_time: pickupTime,
      dropoff_time: dropoffTime,
      full_name: fullName,
      email,
      phone,
      age: Number(age),
      address,
      license_number: licenseNumber,
      notes: notes || "",
      id_file_path: idFilePath || null,
      status: "pending",
      deposit_paid: false
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    res.statusCode = 500;
    return res.end("Error saving booking");
  }

  // Email owner (you)
  const messageHtml = `
    <h2>New Booking Request</h2>
    <p><strong>Vehicle:</strong> ${car}</p>
    <p><strong>Dates:</strong> ${startDate} → ${endDate}</p>
    <p><strong>Times:</strong> ${pickupTime} → ${dropoffTime}</p>
    <p><strong>Name:</strong> ${fullName}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Phone:</strong> ${phone}</p>
    <p><strong>Age:</strong> ${age}</p>
    <p><strong>Address:</strong> ${address}</p>
    <p><strong>Licence:</strong> ${licenseNumber}</p>
    <p><strong>ID File:</strong> ${idFilePath || "None"}</p>
    <p><strong>Notes:</strong> ${notes || "None"}</p>
    <hr/>
    <p>A £50 deposit will next be requested from the customer.</p>
    <p>You will get another email once the deposit has been successfully paid.</p>
  `;

  await sendMail({
    from: `"Car Rental Booking" <${process.env.SMTP_USER}>`,
    to: process.env.OWNER_EMAIL,
    subject: `New Booking Request - ${car} (${startDate} → ${endDate})`,
    html: messageHtml
  });

  // Respond to front-end with new booking ID
  res.setHeader("Content-Type", "application/json");
  res.statusCode = 200;
  res.end(JSON.stringify({ bookingId: booking.id, message: "Booking saved" }));
}
