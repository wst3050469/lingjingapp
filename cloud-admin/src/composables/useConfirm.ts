import { Modal } from 'ant-design-vue';
import { createVNode } from 'vue';
import { ExclamationCircleOutlined } from '@ant-design/icons-vue';

export interface ConfirmOptions {
  title?: string;
  content?: string;
  danger?: boolean;
}

export function useConfirm() {
  function showConfirm(options: ConfirmOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      Modal.confirm({
        title: options.title ?? '确认操作',
        content: options.content ?? '确定要执行此操作吗？',
        okType: options.danger ? 'danger' : 'primary',
        icon: createVNode(ExclamationCircleOutlined),
        onOk: () => resolve(),
        onCancel: () => reject(new Error('cancelled')),
      });
    });
  }

  return { showConfirm };
}