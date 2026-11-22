import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true
    },
    rider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rider",
      default: null
    },
    status: {
      type: String,
      enum: ["PENDING", "ASSIGNED", "PICKED_UP", "DELIVERED", "CANCELLED"],
      default: "PENDING"
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true
    },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);

export default Order;
