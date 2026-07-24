import mongoose from "mongoose";

const siteSettingSchema = new mongoose.Schema({
  banners: [
    {
      _id: false,
      id: Number,
      title: String,
      subtitle: String,
      cta: String,
      image: String,
      active: { type: Boolean, default: true },
      order: Number,
    },
  ],
  achievements: [
    {
      _id: false,
      id: Number,
      number: String,
      label: String,
      icon: String,
      active: { type: Boolean, default: true },
    },
  ],
  testimonials: [
    {
      _id: false,
      id: Number,
      name: String,
      role: String,
      content: String,
      rating: Number,
      avatar: String,
      active: { type: Boolean, default: true },
    },
  ],
  blogs: [
    {
      _id: false,
      id: Number,
      title: String,
      excerpt: String,
      category: String,
      image: String,
      featured: { type: Boolean, default: false },
      publishDate: String,
    },
  ],
  partners: [
    {
      _id: false,
      id: Number,
      name: String,
      logo: String,
      website: String,
      active: { type: Boolean, default: true },
    },
  ],
  faqs: [
    {
      _id: false,
      id: Number,
      question: String,
      answer: String,
      category: String,
      active: { type: Boolean, default: true },
    },
  ],
  staffList: { type: Array, default: [] },
  clubsPage: {
    banner: { type: String, default: "" },
    description: { type: String, default: "" },
    facilities: [
      {
        _id: false,
        id: Number,
        title: String,
        desc: String,
        img: String,
        active: { type: Boolean, default: true },
      },
    ],
    transformations: [{ type: String }],
  },

  // ── CẤU HÌNH TRANG BỘ MÔN (MỚI) ──
  disciplinesPage: {
    banner: { type: String, default: "" },
    description: { type: String, default: "" },
    benefits: [{ type: String }],
    facilities: [
      {
        _id: false,
        id: Number,
        title: String,
        desc: String,
        img: String,
        active: { type: Boolean, default: true },
      },
    ],
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("SiteSetting", siteSettingSchema);
