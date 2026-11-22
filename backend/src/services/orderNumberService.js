import Order from "../models/Order.js";
import DemoCounter from "../models/DemoCounter.js";

// Repair old duplicate numbers before enforcing the unique index.
// This is safe to run repeatedly: only duplicate values are changed.
export const ensureOrderNumberIntegrity = async () => {
  const orders = await Order.find({})
    .select("_id demoOwner orderNumber createdAt")
    .sort({ demoOwner: 1, createdAt: 1, _id: 1 })
    .lean();

  const ordersByOwner = new Map();

  for (const order of orders) {
    const ownerKey = order.demoOwner?.toString() || "no-owner";
    if (!ordersByOwner.has(ownerKey)) ordersByOwner.set(ownerKey, []);
    ordersByOwner.get(ownerKey).push(order);
  }

  for (const [ownerKey, ownerOrders] of ordersByOwner) {
    const usedNumbers = new Set();
    let maxNumber = ownerOrders.reduce((max, order) => {
      const parsed = Number(order.orderNumber);
      return Number.isSafeInteger(parsed) && parsed > max ? parsed : max;
    }, 0);

    for (const order of ownerOrders) {
      const number = String(order.orderNumber);
      if (usedNumbers.has(number)) {
        maxNumber += 1;
        const replacement = String(maxNumber);
        await Order.updateOne(
          { _id: order._id },
          { $set: { orderNumber: replacement } }
        );
        usedNumbers.add(replacement);
      } else {
        usedNumbers.add(number);
      }
    }

    if (ownerKey !== "no-owner") {
      await DemoCounter.findOneAndUpdate(
        { demoOwner: ownerOrders[0].demoOwner },
        { $max: { value: maxNumber } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  }

  await Order.collection.createIndex(
    { demoOwner: 1, orderNumber: 1 },
    { unique: true, name: "unique_order_number_per_demo_owner" }
  );
};

// Atomic counter: simultaneous order requests receive different numbers.
export const getNextOrderNumber = async (ownerId) => {
  await ensureOrderNumberIntegrity();

  const existingNumbers = await Order.find({ demoOwner: ownerId })
    .select("orderNumber")
    .lean();

  const currentMaximum = existingNumbers.reduce((max, order) => {
    const parsed = Number(order.orderNumber);
    return Number.isSafeInteger(parsed) && parsed > max ? parsed : max;
  }, 0);

  // Keep $max and $inc in separate atomic updates. MongoDB does not allow
  // two update operators to modify the same field in one update document.
  try {
    await DemoCounter.updateOne(
      { demoOwner: ownerId },
      { $max: { value: currentMaximum } },
      { upsert: true }
    );
  } catch (error) {
    // Two first-time requests may race to create the same counter document.
    if (error.code !== 11000) throw error;
    await DemoCounter.updateOne(
      { demoOwner: ownerId },
      { $max: { value: currentMaximum } }
    );
  }

  const counter = await DemoCounter.findOneAndUpdate(
    { demoOwner: ownerId },
    { $inc: { value: 1 } },
    { new: true }
  );

  return String(counter.value);
};
