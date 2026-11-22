import mongoose from "mongoose";

const restaurantSchema = new mongoose.Schema(
  {
    demoOwner: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    name: { type: String, required: true, trim: true },
    address: String,
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    },
    isOpen: { type: Boolean, default: true }
  },
  { timestamps: true }
);

const Restaurant = mongoose.model("Restaurant", restaurantSchema);

export default Restaurant;
