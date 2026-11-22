import { gridDisk, latLngToCell } from "h3-js";
import Rider from "../models/Rider.js";
import Order from "../models/Order.js";

// Straight-line distance between two latitude/longitude points, in kilometres.
export const haversineKm = (from, to) => {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latDifference = toRadians(to.lat - from.lat);
  const lngDifference = toRadians(to.lng - from.lng);
  const a =
    Math.sin(latDifference / 2) ** 2 +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(lngDifference / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
};

// Lower scores are better. Keep each score component visible for explainability.
const scoreRider = (rider, distanceKm) => {
  const averageSpeedKmh = 25;
  const etaMinutes = (distanceKm / averageSpeedKmh) * 60 + 3;
  const distanceScore = Math.min(distanceKm / 5, 1) * 40;
  const etaScore = Math.min(etaMinutes / 15, 1) * 30;
  const workloadScore = Math.min(rider.recentDeliveries / 10, 1) * 20;
  const ratingScore = ((5 - rider.rating) / 5) * 10;
  const totalScore = distanceScore + etaScore + workloadScore + ratingScore;

  return {
    riderId: rider._id,
    riderName: rider.user?.name || "Rider",
    distanceKm: Number(distanceKm.toFixed(2)),
    etaMinutes: Number(etaMinutes.toFixed(1)),
    rating: rider.rating,
    recentDeliveries: rider.recentDeliveries,
    score: Number(totalScore.toFixed(2)),
    scoreBreakdown: {
      distance: Number(distanceScore.toFixed(2)),
      eta: Number(etaScore.toFixed(2)),
      workload: Number(workloadScore.toFixed(2)),
      rating: Number(ratingScore.toFixed(2))
    }
  };
};

export const allocateNextOrder = async (ownerId) => {
  // Consider every pending order. Previously, the oldest order was selected
  // first; if it had no nearby rider, allocation stopped without checking
  // newer orders that might have a rider right beside their restaurant.
  const pendingOrders = await Order.find({ demoOwner: ownerId, status: "PENDING" })
    .sort({ createdAt: 1 })
    .populate("restaurant");

  if (pendingOrders.length === 0) {
    return { error: "There are no waiting orders to allocate." };
  }

  const availableRiders = await Rider.find({
    demoOwner: ownerId,
    status: "IDLE"
  }).populate("user", "name");

  if (availableRiders.length === 0) {
    return { error: "There are no available riders." };
  }

  const resolution = 9;
  const ridersWithCells = availableRiders.map((rider) => ({
    rider,
    cell: latLngToCell(rider.location.lat, rider.location.lng, resolution)
  }));

  let selectedOrder = null;
  let candidates = [];
  let lastRingsChecked = 0;
  let validRestaurantCount = 0;

  for (const order of pendingOrders) {
    const restaurant = order.restaurant;
    if (!restaurant || !restaurant.isOpen) continue;
    validRestaurantCount += 1;

    const location = restaurant.location;
    const restaurantCell = latLngToCell(location.lat, location.lng, resolution);
    let nearby = [];
    let ringsForThisOrder = 0;

    for (let ring = 0; ring <= 5; ring += 1) {
      ringsForThisOrder = ring;
      lastRingsChecked = Math.max(lastRingsChecked, ring);
      const nearbyCells = new Set(gridDisk(restaurantCell, ring));
      nearby = ridersWithCells.filter((item) => nearbyCells.has(item.cell));
      if (nearby.length > 0) break;
    }

    // Skip this order if no rider is close, and try the next pending order.
    if (nearby.length === 0) continue;

    lastRingsChecked = ringsForThisOrder;
    candidates = nearby
      .map(({ rider }) => ({
        ...scoreRider(rider, haversineKm(location, rider.location))
      }))
      .sort((a, b) => a.score - b.score);
    selectedOrder = order;
    break;
  }

  if (!selectedOrder) {
    return {
      error: validRestaurantCount === 0
        ? "None of the waiting orders has an open restaurant."
        : "No available riders were found within 5 H3 rings of any waiting order's restaurant. Check rider and restaurant coordinates.",
      reason: "NO_NEARBY_RIDERS",
      h3: { resolution, ringsChecked: lastRingsChecked, candidateCount: 0 },
      pendingOrdersChecked: pendingOrders.length
    };
  }

  const winner = candidates[0];
  const assignedRider = availableRiders.find(
    (rider) => rider._id.toString() === winner.riderId.toString()
  );

  // Conditional updates prevent two concurrent requests from taking the
  // same rider or order.
  const riderUpdate = await Rider.findOneAndUpdate(
    { _id: assignedRider._id, demoOwner: ownerId, status: "IDLE" },
    { $set: { status: "ACCEPTED" } },
    { new: true }
  );

  if (!riderUpdate) {
    return { error: "That rider was just assigned another order. Please try again." };
  }

  const orderUpdate = await Order.findOneAndUpdate(
    { _id: selectedOrder._id, demoOwner: ownerId, status: "PENDING" },
    { $set: { rider: assignedRider._id, status: "ASSIGNED" } },
    { new: true }
  );

  if (!orderUpdate) {
    await Rider.findOneAndUpdate(
      { _id: assignedRider._id, demoOwner: ownerId, status: "ACCEPTED" },
      { $set: { status: "IDLE" } }
    );
    return { error: "That order was just assigned. Please try again." };
  }

  return {
    orderId: selectedOrder._id,
    orderNumber: selectedOrder.orderNumber,
    restaurant: selectedOrder.restaurant.name,
    selectedRider: winner,
    candidates,
    h3: { resolution, ringsChecked: lastRingsChecked, candidateCount: candidates.length },
    scoreWeights: { distance: 40, eta: 30, workload: 20, rating: 10 },
    orderStatus: orderUpdate.status
  };
};
