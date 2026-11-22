import bcrypt from "bcryptjs";
import crypto from "crypto";
import User from "../models/User.js";
import Rider from "../models/Rider.js";
import Restaurant from "../models/Restaurant.js";
import Customer from "../models/Customer.js";
import Order from "../models/Order.js";
import { getNextOrderNumber } from "../services/orderNumberService.js";

const validCoordinate = (value, min, max) =>
  Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max;

export const getDemoResources = async (req, res) => {
  try {
    const restaurants = await Restaurant.find({ demoOwner: req.user._id, isOpen: true })
      .select("name address location isOpen")
      .sort({ name: 1 });
    return res.json({ restaurants });
  } catch (error) {
    return res.status(500).json({ message: "Could not load resources", error: error.message });
  }
};

export const createDemoRider = async (req, res) => {
  try {
    const { name, email, phone, lat, lng, rating } = req.body;
    if (!name?.trim() || !email?.trim() || !validCoordinate(lat, -90, 90) || !validCoordinate(lng, -180, 180)) {
      return res.status(400).json({ message: "Name, email and valid latitude/longitude are required." });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const password = crypto.randomBytes(18).toString("hex");
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "RIDER"
    });

    const count = await Rider.countDocuments({ demoOwner: req.user._id });
    const rider = await Rider.create({
      user: user._id,
      demoOwner: req.user._id,
      code: `R-${String(count + 1).padStart(2, "0")}`,
      phone: phone?.trim() || "",
      rating: Number.isFinite(Number(rating)) ? Math.max(0, Math.min(5, Number(rating))) : 5,
      status: "IDLE",
      location: { lat: Number(lat), lng: Number(lng) },
      recentDeliveries: 0
    });
    return res.status(201).json({
      message: "Rider added successfully.",
      rider: { id: rider.code, name: user.name, status: rider.status }
    });
  } catch (error) {
    return res.status(500).json({ message: "Could not add rider", error: error.message });
  }
};

export const updateDemoRider = async (req, res) => {
  try {
    const { status, lat, lng, rating } = req.body;
    const updates = {};
    if (status !== undefined) {
      if (!["IDLE", "OFFLINE"].includes(status)) {
        return res.status(400).json({ message: "You can set a rider to IDLE or OFFLINE here. Active delivery states are controlled by orders." });
      }
      updates.status = status;
    }
    if (lat !== undefined || lng !== undefined) {
      if (!validCoordinate(lat, -90, 90) || !validCoordinate(lng, -180, 180)) {
        return res.status(400).json({ message: "Provide valid latitude and longitude together." });
      }
      updates.location = { lat: Number(lat), lng: Number(lng) };
    }
    if (rating !== undefined) {
      if (!validCoordinate(rating, 0, 5)) return res.status(400).json({ message: "Rating must be between 0 and 5." });
      updates.rating = Number(rating);
    }

    const rider = await Rider.findOneAndUpdate(
      { demoOwner: req.user._id, code: req.params.code },
      { $set: updates },
      { new: true }
    ).populate("user", "name");
    if (!rider) return res.status(404).json({ message: "Rider not found." });
    return res.json({ message: "Rider updated successfully." });
  } catch (error) {
    return res.status(500).json({ message: "Could not update rider", error: error.message });
  }
};

export const createDemoRestaurant = async (req, res) => {
  try {
    const { name, address, lat, lng } = req.body;
    if (!name?.trim() || !validCoordinate(lat, -90, 90) || !validCoordinate(lng, -180, 180)) {
      return res.status(400).json({ message: "Restaurant name and valid latitude/longitude are required." });
    }
    const restaurant = await Restaurant.create({
      demoOwner: req.user._id,
      name: name.trim(),
      address: address?.trim() || "",
      location: { lat: Number(lat), lng: Number(lng) },
      isOpen: true
    });
    return res.status(201).json({ message: "Restaurant added successfully.", restaurant });
  } catch (error) {
    return res.status(500).json({ message: "Could not add restaurant", error: error.message });
  }
};

export const createDemoOrder = async (req, res) => {
  const idempotencyKey = req.get("Idempotency-Key");
  try {
    if (!idempotencyKey || idempotencyKey.length > 128) {
      return res.status(400).json({ message: "A valid Idempotency-Key is required. Please submit the order from the dashboard." });
    }

    // If the same click/request is sent again, return the original order.
    const existingOrder = await Order.findOne({
      demoOwner: req.user._id,
      idempotencyKey
    });
    if (existingOrder) {
      return res.status(200).json({
        message: `Order #${existingOrder.orderNumber} was already created.`,
        orderNumber: existingOrder.orderNumber,
        duplicate: true
      });
    }

    const { restaurantId, totalAmount } = req.body;
    if (!restaurantId || !Number.isFinite(Number(totalAmount)) || Number(totalAmount) < 0) {
      return res.status(400).json({ message: "Choose a restaurant and enter a valid non-negative amount." });
    }
    const restaurant = await Restaurant.findOne({
      _id: restaurantId,
      demoOwner: req.user._id,
      isOpen: true
    });
    if (!restaurant) return res.status(404).json({ message: "Open restaurant not found." });

    const customer = await Customer.findOne({ user: req.user._id });
    if (!customer) return res.status(400).json({ message: "Customer profile is missing. Reload the dashboard to prepare demo data." });

    const nextNumber = await getNextOrderNumber(req.user._id);
    const order = await Order.create({
      demoOwner: req.user._id,
      idempotencyKey,
      orderNumber: nextNumber,
      customer: customer._id,
      restaurant: restaurant._id,
      totalAmount: Number(totalAmount),
      status: "PENDING"
    });
    return res.status(201).json({ message: `Order #${order.orderNumber} created successfully.`, orderNumber: order.orderNumber });
  } catch (error) {
    // A second simultaneous request can reach MongoDB before the first
    // request finishes. The unique key makes the database the final guard.
    if (error.code === 11000) {
      const existingOrder = await Order.findOne({
        demoOwner: req.user._id,
        idempotencyKey
      });
      if (existingOrder) {
        return res.status(200).json({
          message: `Order #${existingOrder.orderNumber} was already created.`,
          orderNumber: existingOrder.orderNumber,
          duplicate: true
        });
      }
    }
    return res.status(500).json({ message: "Could not create order", error: error.message });
  }
};
