<script setup lang="ts">
import { ref, reactive } from 'vue';
import { authApi } from '@/api/modules';
import { message } from 'ant-design-vue';

const visible = ref(false);
const loading = ref(false);
const form = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});
const formRef = ref();

function open() {
  form.currentPassword = '';
  form.newPassword = '';
  form.confirmPassword = '';
  visible.value = true;
}

function close() {
  visible.value = false;
}

async function handleSubmit() {
  if (form.newPassword.length < 8) {
    message.warning('新密码至少需要8个字符');
    return;
  }
  if (form.newPassword !== form.confirmPassword) {
    message.warning('两次输入的新密码不一致');
    return;
  }
  loading.value = true;
  try {
    const res = await authApi.changePassword({
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
    });
    if (res.ok) {
      message.success('密码修改成功');
      close();
    } else {
      message.error(res.message || '修改失败');
    }
  } catch (e: any) {
    message.error(e?.response?.data?.detail || e?.response?.data?.error || '修改密码失败，请检查旧密码是否正确');
  } finally {
    loading.value = false;
  }
}

defineExpose({ open });
</script>

<template>
  <a-modal
    :open="visible"
    title="修改密码"
    @ok="handleSubmit"
    @cancel="close"
    :confirm-loading="loading"
    ok-text="确认修改"
    cancel-text="取消"
    destroy-on-close
  >
    <a-form layout="vertical" ref="formRef">
      <a-form-item label="当前密码" name="currentPassword" required>
        <a-input-password
          v-model:value="form.currentPassword"
          placeholder="请输入当前密码"
          autocomplete="current-password"
        />
      </a-form-item>
      <a-form-item label="新密码" name="newPassword" required>
        <a-input-password
          v-model:value="form.newPassword"
          placeholder="请输入新密码（至少8位）"
          autocomplete="new-password"
        />
      </a-form-item>
      <a-form-item label="确认新密码" name="confirmPassword" required>
        <a-input-password
          v-model:value="form.confirmPassword"
          placeholder="请再次输入新密码"
          autocomplete="new-password"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>
