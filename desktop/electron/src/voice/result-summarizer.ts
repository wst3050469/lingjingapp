export class ResultSummarizer {
  summarize(result: { type: string; content: string; filePath?: string }): string {
    const { type, content } = result;
    const maxLength = 500;

    if (type === 'code' || type === 'file-edit') {
      const lineCount = content.split('\n').length;
      const files = result.filePath ? 1 : 0;
      return `已修改 ${files} 个文件，共 ${lineCount} 行`;
    }

    if (type === 'terminal') {
      const truncated = content.length > 100 ? content.slice(0, 100) + '...' : content;
      return `命令输出: ${truncated}`;
    }

    if (type === 'error') {
      const firstLine = content.split('\n')[0];
      return `错误: ${firstLine}`;
    }

    if (type === 'chat') {
      return content.length > maxLength ? content.slice(0, maxLength) + '...更多内容请在界面查看' : content;
    }

    return content.length > maxLength ? content.slice(0, maxLength) + '...' : content;
  }
}
