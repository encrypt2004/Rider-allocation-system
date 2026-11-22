import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Rider from "../models/Rider.js";
import Restaurant from "../models/Restaurant.js";
import Customer from "../models/Customer.js";
import Order from "../models/Order.js";
import { allocateNextOrder } from "../services/allocationService.js";

const demoRiders = [
  { code: "R-01", name: "Aarav", lat: 23.3448, lng: 85.3090, rating: 4.9, status: "IDLE", recentDeliveries: 2 },
  { code: "R-02", name: "Ishita", lat: 23.3470, lng: 85.3130, rating: 4.8, status: "ACCEPTED", recentDeliveries: 5 },
  { code: "R-03", name: "Kabir", lat: 23.3415, lng: 85.3110, rating: 4.7, status: "IDLE", recentDeliveries: 3 },
  { code: "R-04", name: "Meera", lat: 23.3425, lng: 85.3160, rating: 4.9, status: "ACCEPTED", recentDeliveries: 4 },
  { code: "R-05", name: "Dev", lat: 23.3395, lng: 85.3075, rating: 4.6, status: "OFFLINE", recentDeliveries: 1 }
];

const demoRestaurants = [
  { name: "Spice Route", lat: 23.3440, lng: 85.3120 },
  { name: "Burger Point", lat: 23.3460, lng: 85.3100 },
  { name: "Green Bowl", lat: 23.3410, lng: 85.3140 }
];

export const setupDemo = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const passwordHash = await bcrypt.hash("RiderFlowDemo123!", 10);

    for (const [index, data] of demoRiders.entries()) {
      const email = `demo-${index + 1}-${ownerId}@riderflow.local`;
      let riderUser = await User.findOne({ email });
      if (!riderUser) {
        riderUser = await User.create({
          name: data.name,
          email,
          password: passwordHash,
          role: "RIDER"
        });
      }

      await Rider.findOneAndUpdate(
        { demoOwner: ownerId, code: data.code },
        {
          $setOnInsert: {
            user: riderUser._id,
            demoOwner: ownerId,
            code: data.code,
            phone: "9000000000",
            rating: data.rating,
            status: data.status,
            location: { lat: data.lat, lng: data.lng },
            recentDeliveries: data.recentDeliveries
          }
        },
        { upsert: true, new: true }
      );
    }

    const customer = await Customer.findOneAndUpdate(
      { user: ownerId },
      {
        $setOnInsert: {
          user: ownerId,
          address: "Demo customer location",
          location: { lat: 23.3405, lng: 85.3170 }
        }
      },
      { upsert: true, new: true }
    );

    const restaurants = [];
    for (const data of demoRestaurants) {
      const restaurant = await Restaurant.findOneAndUpdate(
        { demoOwner: ownerId, name: data.name },
        {
          $setOnInsert: {
            demoOwner: ownerId,
            name: data.name,
            address: "Ranchi, Jharkhand",
            location: { lat: data.lat, lng: data.lng },
            isOpen: true
          }
        },
        { upsert: true, new: true }
      );
      restaurants.push(restaurant);
    }

    const existingOrders = await Order.countDocuments({ demoOwner: ownerId });
    if (existingOrders === 0) {
      const orders = [
        { orderNumber: "1043", restaurant: restaurants[0]._id, status: "PENDING", totalAmount: 420 },
        { orderNumber: "1042", restaurant: restaurants[1]._id, status: "ASSIGNED", totalAmount: 280 },
        { orderNumber: "1041", restaurant: restaurants[2]._id, status: "PENDING", totalAmount: 350 },
        { orderNumber: "1040", restaurant: restaurants[0]._id, status: "ASSIGNED", totalAmount: 510 }
      ];
      const ishita = await Rider.findOne({ demoOwner: ownerId, code: "R-02" });
      const meera = await Rider.findOne({ demoOwner: ownerId, code: "R-04" });
      await Order.insertMany(orders.map((order) => ({
        ...order,
        customer: customer._id,
        demoOwner: ownerId,
        rider: order.orderNumber === "1042" ? ishita._id
          : order.orderNumber === "1040" ? meera._id
          : null
      })));
    }

    return res.json({ message: "Demo data is ready in MongoDB." });
  } catch (error) {
    return res.status(500).json({ message: "Could not prepare demo data", error: error.message });
  }
};

const buildDashboard = async (ownerId, userName) => {
  const riders = await Rider.find({ demoOwner: ownerId }).populate("user", "name").sort({ code: 1 });
  const orders = await Order.find({ demoOwner: ownerId })
    .populate("restaurant", "name")
    .populate({ path: "rider", populate: { path: "user", select: "name" } })
    .sort({ createdAt: -1 });

  return {
    riders: riders.map((rider) => ({
      id: rider.code,
      name: rider.user?.name || "Rider",
      lat: rider.location.lat,
      lng: rider.location.lng,
      status: rider.status === "IDLE" ? "Available" : rider.status === "OFFLINE" ? "Offline" : rider.status === "PICKED_UP" ? "Picked up" : "Delivering",
      task: rider.status === "IDLE" ? "Waiting for order" : rider.status === "OFFLINE" ? "Not on shift" : "Assigned delivery",
      rating: rider.rating,
      recentDeliveries: rider.recentDeliveries
    })),
    orders: orders.map((order) => ({
      id: `#${order.orderNumber}`,
      orderNumber: order.orderNumber,
      orderId: order._id,
      customer: userName,
      restaurant: order.restaurant?.name || "Restaurant",
      status: order.status,
      rider: order.rider?.user?.name || "—"
    }))
  };
};

const emitDashboard = async (req) => {
  const dashboard = await buildDashboard(req.user._id, req.user.name);
  req.app.get("io")?.to(`user:${req.user._id}`).emit("dashboard:update", dashboard);
  return dashboard;
};

export const getDemoDashboard = async (req, res) => {
  try {
    const dashboard = await buildDashboard(req.user._id, req.user.name);
    return res.json(dashboard);
  } catch (error) {
    return res.status(500).json({ message: "Could not load dashboard", error: error.message });
  }
};

export const allocateDemoOrder = async (req, res) => {
  try {
    const result = await allocateNextOrder(req.user._id);
    if (result.error) return res.status(400).json({ message: result.error });
    const dashboard = await emitDashboard(req);
    return res.json({ message: "Rider allocated successfully", allocation: result, dashboard });
  } catch (error) {
    return res.status(500).json({ message: "Allocation failed", error: error.message });
  }
};

export const resetDemo = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const riderDefaults = [
      ["R-01", "IDLE", 23.3448, 85.3090],
      ["R-02", "ACCEPTED", 23.3470, 85.3130],
      ["R-03", "IDLE", 23.3415, 85.3110],
      ["R-04", "ACCEPTED", 23.3425, 85.3160],
      ["R-05", "OFFLINE", 23.3395, 85.3075]
    ];

    for (const [code, status, lat, lng] of riderDefaults) {
      await Rider.findOneAndUpdate(
        { demoOwner: ownerId, code },
        { $set: { status, location: { lat, lng } } }
      );
    }

    const riders = await Rider.find({ demoOwner: ownerId });
    const riderByCode = new Map(riders.map((rider) => [rider.code, rider]));
    const orderDefaults = [
      ["1043", "PENDING", null],
      ["1042", "ASSIGNED", riderByCode.get("R-02")?._id || null],
      ["1041", "PENDING", null],
      ["1040", "ASSIGNED", riderByCode.get("R-04")?._id || null]
    ];

    for (const [orderNumber, status, riderId] of orderDefaults) {
      await Order.findOneAndUpdate(
        { demoOwner: ownerId, orderNumber },
        { $set: { status, rider: riderId } }
      );
    }

    const dashboard = await emitDashboard(req);
    return res.json({ message: "Demo data has been reset.", dashboard });
  } catch (error) {
    return res.status(500).json({ message: "Could not reset demo data", error: error.message });
  }
};

 
// Move rider coordinates on the backend, then broadcast the new dashboard.
export const moveDemoRiders = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const riders = await Rider.find({ demoOwner: ownerId, status: { $ne: "OFFLINE" } });
    const now = Date.now();

    for (const [index, rider] of riders.entries()) {
      const home = demoRiders.find((item) => item.code === rider.code);
      if (!home) continue;
      const angle = now / 1100 + index * 1.7;
      rider.location.lat = home.lat + Math.sin(angle) * 0.0005;
      rider.location.lng = home.lng + Math.cos(angle * 0.8) * 0.0005;
      await rider.save();
    }

    const dashboard = await emitDashboard(req);
    return res.json({ message: "Rider locations updated", dashboard });
  } catch (error) {
    return res.status(500).json({ message: "Could not move riders", error: error.message });
  }
};

// Keep order and rider states in sync through a small, explicit lifecycle.
export const updateDemoOrderStatus = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { status } = req.body;
    const allowedNext = {
      ASSIGNED: "PICKED_UP",
      PICKED_UP: "DELIVERED"
    };

    const order = await Order.findOne({ demoOwner: req.user._id, orderNumber });
    if (!order) return res.status(404).json({ message: "Order not found." });
    if (allowedNext[order.status] !== status) {
      return res.status(400).json({
        message: order.status === "DELIVERED"
          ? "This order is already delivered."
          : "Invalid status change. Orders must move from Assigned to Picked Up, then Delivered."
      });
    }

    order.status = status;
    await order.save();

    if (order.rider) {
      const nextRiderStatus = status === "PICKED_UP" ? "PICKED_UP" : "IDLE";
      await Rider.findByIdAndUpdate(order.rider, {
        $set: { status: nextRiderStatus },
        ...(status === "DELIVERED" ? { $inc: { recentDeliveries: 1 } } : {})
      });
    }

    const dashboard = await emitDashboard(req);
    return res.json({ message: `Order moved to ${status}`, dashboard });
  } catch (error) {
    return res.status(500).json({ message: "Could not update order status", error: error.message });
  }
};
