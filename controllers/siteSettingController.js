import SiteSetting from "../models/schemas/siteSettingSchema.js";

export const getHomepageSettings = async (req, res) => {
  try {
    let settings = await SiteSetting.findOne();
    if (!settings) {
      settings = await SiteSetting.create({
        banners: [],
        achievements: [],
        testimonials: [],
        blogs: [],
        partners: [],
        faqs: [],
        staffList: [], // Bổ sung mảng rỗng cho HLV
        clubsPage: {
          banner: "",
          description: "",
          facilities: [],
          transformations: [],
        },
        disciplinesPage: {
          banner: "",
          description: "",
          benefits: [],
          facilities: [],
        },
      });
    }
    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const updateHomepageSettings = async (req, res) => {
  try {
    // Bổ sung staffList vào đây để hứng dữ liệu từ Admin
    const {
      banners,
      achievements,
      testimonials,
      blogs,
      partners,
      faqs,
      staffList,
      clubsPage,
      disciplinesPage,
    } = req.body;

    let settings = await SiteSetting.findOne();

    if (!settings) {
      settings = await SiteSetting.create({
        banners: banners || [],
        achievements: achievements || [],
        testimonials: testimonials || [],
        blogs: blogs || [],
        partners: partners || [],
        faqs: faqs || [],
        staffList: staffList || [], // Lưu HLV khi tạo mới
        clubsPage: clubsPage || {
          banner: "",
          description: "",
          facilities: [],
          transformations: [],
        },
        disciplinesPage: disciplinesPage || {
          banner: "",
          description: "",
          benefits: [],
          facilities: [],
        },
      });
    } else {
      settings.banners = banners || [];
      settings.achievements = achievements || [];
      settings.testimonials = testimonials || [];
      settings.blogs = blogs || [];
      settings.partners = partners || [];
      settings.faqs = faqs || [];

      // Lưu danh sách HLV vào Database
      settings.staffList = staffList || [];

      settings.clubsPage = clubsPage || {
        banner: "",
        description: "",
        facilities: [],
        transformations: [],
      };

      // Cập nhật dữ liệu Trang Bộ Môn
      settings.disciplinesPage = disciplinesPage || {
        banner: "",
        description: "",
        benefits: [],
        facilities: [],
      };

      settings.updatedAt = new Date();
      await settings.save();
    }
    return res
      .status(200)
      .json({ success: true, data: settings, message: "Lưu thành công!" });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
