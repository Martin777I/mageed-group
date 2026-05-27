export function formatCurrency(amount) {
  return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(amount);
}

export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const statusMap = {
  pending: { label: 'قيد المراجعة', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  accepted: { label: 'مقبول', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  rejected: { label: 'مرفوض', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};
