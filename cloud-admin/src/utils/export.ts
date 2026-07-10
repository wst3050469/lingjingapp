/**
 * CSV 导出工具函数
 * 将表格数据导出为 CSV 文件并下载
 */

export function exportToCsv(filename: string, columns: { title: string; dataIndex?: string; key: string }[], data: Record<string, any>[]): void {
  if (!data || data.length === 0) {
    console.warn('没有数据可导出');
    return;
  }

  // 生成 CSV 头部
  const headers = columns
    .filter(c => c.key !== 'action')
    .map(c => c.title);

  // 生成 CSV 行数据
  const rows = data.map(item => {
    return columns
      .filter(c => c.key !== 'action')
      .map(c => {
        const val = item[c.dataIndex || c.key];
        if (val === null || val === undefined) return '';
        const str = String(val);
        // 对包含逗号、引号、换行的字段加引号
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      })
      .join(',');
  });

  // 组装 CSV 内容（BOM for Excel 中文支持）
  const bom = '\uFEFF';
  const csv = bom + headers.join(',') + '\n' + rows.join('\n');

  // 下载文件
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
