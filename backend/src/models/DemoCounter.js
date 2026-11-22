import mongoose from "mongoose";

const demoCounterSchema = new mongoose.Schema(
  {
    demoOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },
    value: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { timestamps: true }
);

const DemoCounter = mongoose.model("DemoCounter", demoCounterSchema);

export default DemoCounter;
