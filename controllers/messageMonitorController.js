import {
  getMonitorConversations,
  getMonitorTranscript,
  setMessageFlagStatus,
  adminDeleteMessage,
  getMonitorStats
} from '../models/messageModel.js';

export const monitorConversations = (req, res) => {
  const { locationId, loai, flagStatus, level, keyword, staffId, memberId, fromDate, toDate } = req.query;
  getMonitorConversations(
    { locationId, loai, flagStatus, level, keyword, staffId, memberId, fromDate, toDate },
    (err, data) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(data);
    }
  );
};

export const monitorTranscript = (req, res) => {
  const { memberId, staffId, loai } = req.query;
  if (!memberId) return res.status(400).json({ error: 'Thiếu memberId!' });
  getMonitorTranscript(memberId, staffId || null, loai || 'truc_tiep', (err, data) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(data);
  });
};

export const resolveFlag = (req, res) => {
  const { messageId, status } = req.body;
  if (!messageId) return res.status(400).json({ error: 'Thiếu messageId!' });
  const newStatus = ['resolved', 'ignored'].includes(status) ? status : 'resolved';
  setMessageFlagStatus(messageId, newStatus, (err, updated) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!updated) return res.status(404).json({ error: 'Tin nhắn không tồn tại!' });
    res.json(updated);
  });
};

export const deleteMessage = (req, res) => {
  const { messageId } = req.params;
  if (!messageId) return res.status(400).json({ error: 'Thiếu messageId!' });
  adminDeleteMessage(messageId, (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!result) return res.status(404).json({ error: 'Tin nhắn không tồn tại!' });
    res.json({ success: true });
  });
};

export const monitorStats = (req, res) => {
  const { locationId, loai, fromDate, toDate } = req.query;
  getMonitorStats({ locationId, loai, fromDate, toDate }, (err, data) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(data);
  });
};
