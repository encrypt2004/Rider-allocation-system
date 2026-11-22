import { gridDisk, latLngToCell } from "h3-js";
import Rider from "../models/Rider.js";
import Order from "../models/Order.js";
import Restaurant from "../models/Restaurant.js";

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

// Lower scores are better. Every score component is kept visible for explainability.
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
  const order = await Order.findOne({ demoOwner: ownerId, status: "PENDING" })
    .sort({ createdAt: 1 })
    .populate("restaurant");

  if (!order) {
    return { error: "There are no waiting orders to allocate." };
  }
  if (!order.restaurant || !order.restaurant.isOpen) {
    return { error: "The restaurant for this order is unavailable." };
  }

  const restaurantLocation = order.restaurant.location;
  const availableRiders = await Rider.find({
    demoOwner: ownerId,
    status: "IDLE"
  }).populate("user", "name");

  if (availableRiders.length === 0) {
    return { error: "There are no available riders." };
  }

  // H3 resolution 9 gives neighbourhood-sized cells. Expand rings until
  // we find candidates; if none are in the first five rings, use all idle riders.
  const resolution = 9;
  const restaurantCell = latLngToCell(
    restaurantLocation.lat,
    restaurantLocation.lng,
    resolution
  );
  const ridersWithCells = availableRiders.map((rider) => ({
    rider,
    cell: latLngToCell(rider.location.lat, rider.location.lng, resolution)
  }));

  let nearby = [];
  let ringsChecked = 0;
  for (let ring = 0; ring <= 5; ring += 1) {
    ringsChecked = ring;
    const nearbyCells = new Set(gridDisk(restaurantCell, ring));
    nearby = ridersWithCells.filter((item) => nearbyCells.has(item.cell));
    if (nearby.length > 0) break;
  }

  if (nearby.length === 0) {
    return {
      error: "No available riders were found within 5 H3 rings of this restaurant. Try again after a rider moves closer.",
      reason: "NO_NEARBY_RIDERS",
      h3: { resolution, ringsChecked, candidateCount: 0 }
    };
  }

  const candidates = nearby
    .map(({ rider }) => {
      const distanceKm = haversineKm(restaurantLocation, rider.location);
      return scoreRider(rider, distanceKm);
    })
    .sort((a, b) => a.score - b.score);

  const winner = candidates[0];
  const assignedRider = availableRiders.find(
    (rider) => rider._id.toString() === winner.riderId.toString()
  );

  // Conditional update prevents two requests from assigning the same rider/order.
  const riderUpdate = await Rider.findOneAndUpdate(
    { _id: assignedRider._id, status: "IDLE" },
    { $set: { status: "ACCEPTED" } },
    { new: true }
  );

  if (!riderUpdate) {
    return { error: "That rider was just assigned another order. Please try again." };
  }

  const orderUpdate = await Order.findOneAndUpdate(
    { _id: order._id, status: "PENDING" },
    { $set: { rider: assignedRider._id, status: "ASSIGNED" } },
    { new: true }
  );

  if (!orderUpdate) {
    await Rider.findByIdAndUpdate(assignedRider._id, { $set: { status: "IDLE" } });
    return { error: "That order was just assigned. Please try again." };
  }

  return {
    orderId: order._id,
    orderNumber: order.orderNumber,
    restaurant: order.restaurant.name,
    selectedRider: winner,
    candidates,
    h3: { resolution, ringsChecked, candidateCount: candidates.length },
    scoreWeights: { distance: 40, eta: 30, workload: 20, rating: 10 },
    orderStatus: orderUpdate.status
  };
};
