import mongoose from "mongoose";

const riderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },
    phone: String,
    rating: {
      type: Number,
      default: 5,
      min: 0,
      max: 5
    },
    status: {
      type: String,
      enum: ["IDLE", "ACCEPTED", "PICKED_UP", "OFFLINE"],
      default: "IDLE"
    },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    },
    recentDeliveries: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { timestamps: true }
);

const Rider = mongoose.model("Rider", riderSchema);

export default Rider;
