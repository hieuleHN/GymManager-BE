import SensitiveKeyword from './schemas/sensitiveKeywordSchema.js';

export const normalizeVietnamese = (text) => {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd');
};

export const getActiveKeywords = async () => {
  return SensitiveKeyword.find({ enabled: true }).select('keyword normalized level').lean();
};

export const scanForKeywords = (text, keywords) => {
  if (!text || !keywords || keywords.length === 0) return [];
  const normalized = normalizeVietnamese(text);
  const hits = [];
  for (const kw of keywords) {
    if (normalized.includes(kw.normalized)) {
      hits.push({
        keyword: kw.keyword,
        normalized: kw.normalized,
        level: kw.level || 'high'
      });
    }
  }
  return hits;
};

export const listKeywords = async () => {
  return SensitiveKeyword.find().sort({ createdAt: -1 }).lean();
};

export const addKeyword = async (data, callback) => {
  try {
    const normalized = normalizeVietnamese(data.keyword);
    const existing = await SensitiveKeyword.findOne({ normalized });
    if (existing) {
      return callback(new Error('Từ khoá này đã tồn tại!'));
    }
    const keyword = new SensitiveKeyword({
      keyword: data.keyword,
      normalized,
      level: data.level || 'high',
      enabled: data.enabled !== false,
      note: data.note || ''
    });
    const saved = await keyword.save();
    callback(null, saved);
  } catch (err) {
    callback(err);
  }
};

export const updateKeyword = async (id, data, callback) => {
  try {
    const updated = await SensitiveKeyword.findByIdAndUpdate(
      id,
      {
        keyword: data.keyword,
        normalized: normalizeVietnamese(data.keyword),
        level: data.level || 'low',
        enabled: data.enabled !== false,
        note: data.note || ''
      },
      { new: true }
    );
    callback(null, updated);
  } catch (err) {
    callback(err);
  }
};

export const deleteKeyword = async (id, callback) => {
  try {
    const result = await SensitiveKeyword.findByIdAndDelete(id);
    callback(null, result);
  } catch (err) {
    callback(err);
  }
};
