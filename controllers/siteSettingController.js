import SiteSetting from '../models/schemas/siteSettingSchema.js';

const HOMEPAGE_KEY = 'homepage';

export const getHomepage = async (req, res) => {
  try {
    const doc = await SiteSetting.findOne({ key: HOMEPAGE_KEY }).lean();
    res.json({ data: doc?.data || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateHomepage = async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return res.status(400).json({ error: 'Dữ liệu cấu hình không hợp lệ!' });
    }

    const doc = await SiteSetting.findOneAndUpdate(
      { key: HOMEPAGE_KEY },
      { data: payload, updatedAt: new Date() },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ message: 'Cập nhật cấu hình trang chủ thành công!', data: doc.data });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Lỗi cập nhật cấu hình!' });
  }
};
