import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatDate } from '../utils/helpers';
import Modal from '../components/Modal';

const modeLabels = {
  CREATE_ONLY: { label: 'إنشاء فقط', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  UPDATE_ONLY: { label: 'تحديث فقط', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  CREATE_UPDATE: { label: 'إنشاء + تحديث', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  VALIDATE_ONLY: { label: 'معاينة فقط', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
};

export default function ImportHistory() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ pages: 1 });
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/products/import/history?search=${search}&page=${page}&limit=20`);
      setLogs(res.data.logs);
      setPagination(res.data.pagination);
    } catch {
      toast.error('خطأ في جلب سجل الاستيراد');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [search, page]);

  const parseDetails = (detailsStr) => {
    try {
      return JSON.parse(detailsStr);
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">سجل الاستيراد</h1>
        <p className="text-sm text-gray-400 mt-1">عرض جميع عمليات الاستيراد السابقة</p>
      </div>

      {/* Search */}
      <div className="glass rounded-xl p-3">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="بحث باسم الملف أو الوضع..."
          className="w-full px-4 py-2.5 rounded-lg bg-brand-900/80 border border-brand-800/50 text-white placeholder-gray-500 text-sm focus:border-brand-500 transition-all"
        />
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner text="جاري تحميل السجل..." />
      ) : logs.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-gray-400 text-lg">لا توجد عمليات استيراد سابقة</p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-brand-800/30 text-sm text-gray-400">
                  <th className="text-right p-4 font-medium">الملف</th>
                  <th className="text-right p-4 font-medium">الوضع</th>
                  <th className="text-right p-4 font-medium">المشرف</th>
                  <th className="text-right p-4 font-medium">الصفوف</th>
                  <th className="text-right p-4 font-medium">إنشاء</th>
                  <th className="text-right p-4 font-medium">تحديث</th>
                  <th className="text-right p-4 font-medium">تخطي</th>
                  <th className="text-right p-4 font-medium">أخطاء</th>
                  <th className="text-right p-4 font-medium">التاريخ</th>
                  <th className="text-right p-4 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const modeInfo = modeLabels[log.mode] || { label: log.mode, color: 'bg-gray-500/15 text-gray-400 border-gray-500/30' };
                  return (
                    <tr key={log.id} className="border-b border-brand-800/20 table-row-hover transition-colors">
                      <td className="p-4 text-sm text-white max-w-[200px] truncate">{log.fileName}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${modeInfo.color}`}>
                          {modeInfo.label}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-gray-400">{log.admin?.name || '—'}</td>
                      <td className="p-4 text-sm text-gray-400">{log.totalRows}</td>
                      <td className="p-4 text-sm text-green-400 font-medium">{log.createdCount}</td>
                      <td className="p-4 text-sm text-blue-400 font-medium">{log.updatedCount}</td>
                      <td className="p-4 text-sm text-yellow-400 font-medium">{log.skippedCount}</td>
                      <td className="p-4 text-sm text-red-400 font-medium">{log.errorsCount}</td>
                      <td className="p-4 text-sm text-gray-500">{formatDate(log.createdAt)}</td>
                      <td className="p-4">
                        {log.details && (
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="text-sm text-brand-400 hover:text-brand-300 transition-colors"
                          >
                            تفاصيل
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 p-4 border-t border-brand-800/30">
              {Array.from({ length: pagination.pages }, (_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setPage(i + 1)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${page === i + 1 ? 'bg-brand-500 text-white' : 'text-gray-400 hover:bg-brand-800/50'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Details Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={`تفاصيل الاستيراد — ${selectedLog?.fileName || ''}`}
        maxWidth="max-w-2xl"
      >
        {selectedLog && (() => {
          const details = parseDetails(selectedLog.details);
          if (!details) return <p className="text-gray-400 text-sm">لا توجد تفاصيل</p>;
          return (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-brand-900/50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-green-400">{selectedLog.createdCount}</p>
                  <p className="text-xs text-gray-500">إنشاء</p>
                </div>
                <div className="bg-brand-900/50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-blue-400">{selectedLog.updatedCount}</p>
                  <p className="text-xs text-gray-500">تحديث</p>
                </div>
                <div className="bg-brand-900/50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-yellow-400">{selectedLog.skippedCount}</p>
                  <p className="text-xs text-gray-500">تخطي</p>
                </div>
                <div className="bg-brand-900/50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-red-400">{selectedLog.errorsCount}</p>
                  <p className="text-xs text-gray-500">أخطاء</p>
                </div>
              </div>

              {/* Errors */}
              {details.validationErrors?.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-red-400 mb-2">أخطاء التحقق</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {details.validationErrors.map((err, i) => (
                      <p key={i} className="text-xs text-gray-400">
                        <span className="text-red-400/70 font-mono">صف {err.rowNumber}:</span> [{err.field}] {err.error}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Duplicates */}
              {details.duplicatesInFile?.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-orange-400 mb-2">أكواد مكررة</h4>
                  <div className="space-y-1">
                    {details.duplicatesInFile.map((dup, i) => (
                      <p key={i} className="text-xs text-gray-400">
                        الكود <span className="text-orange-400 font-mono">{dup.code}</span> — الصفوف: {dup.rows.join('، ')}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {details.warnings?.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-yellow-400 mb-2">التحذيرات</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {details.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-gray-400">
                        <span className="text-yellow-400/70 font-mono">صف {w.rowNumber}:</span> {w.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
