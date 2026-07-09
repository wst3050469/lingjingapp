<script setup lang="ts">
import { ref, reactive } from 'vue';
import { authApi } from '@/api/modules';
import { useAuthStore } from '@/stores/auth';
import { message } from 'ant-design-vue';

const authStore = useAuthStore();
const visible = ref(false);
const loading = ref(false);
const form = reactive({
  old_password: '',
  new_password: '',
  confirm_password: '',
});
const formRef = ref();

function open() {
  form.old_password = '';
  form.new_password = '';
  form.confirm_password = '';
  visible.value = true;
}

function close() {
  visible.value = false;
}

async function handleSubmit() {
  if (form.new_password.length < 6) {
    message.warning('新密码至少需要6个字符');
    return;
  }
  if (form.new_password !== form.confirm_password) {
    message.warning('两次输入的新密码不一致');
    return;
  }
  loading.value = true;
  try {
    const res = await authApi.changePassword({
      old_password: form.old_password,
      new_password: form.new_password,
    });
    if (res.code === 0) {
      message.success('密码修改成功');
      // 更新存储的令牌
      localStorage.setItem('app_admin_token', res.token);
      close();
    } else {
      message.error(res.msg || '修改失败');
    }
  } catch (e: any) {
    message.error(e?.response?.data?.detail || '修改密码失败，请检查旧密码是否正确');
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
      <a-form-item label="当前密码" name="old_password" required>
        <a-input-password
          v-model:value="form.old_password"
          placeholder="请输入当前密码"
          autocomplete="current-password"
        />
      </a-form-item>
      <a-form-item label="新密码" name="new_password" required>
        <a-input-password
          v-model:value="form.new_password"
          placeholder="请输入新密码（至少6位）"
          autocomplete="new-password"
        />
      </a-form-item>
      <a-form-item label="确认新密码" name="confirm_password" required>
        <a-input-password
          v-model:value="form.confirm_password"
          placeholder="请再次输入新密码"
          autocomplete="new-password"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>
