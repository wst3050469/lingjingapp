<template>
  <div>
    <a-tabs v-model:activeKey="activeTab">
      <a-tab-pane key="online" tab="在线支付">
        <SearchFilter :show-search="false">
          <template #filters>
            <a-select v-model:value="payStatusFilter" placeholder="状态" allow-clear style="width: 120px" @change="paymentStore.fetchPayments">
              <a-select-option value="success">成功</a-select-option>
              <a-select-option value="failed">失败</a-select-option>
              <a-select-option value="pending">待处理</a-select-option>
            </a-select>
          </template>
        </SearchFilter>
        <DataTable :columns="payColumns" :data-source="paymentStore.payments" :loading="paymentStore.loading">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <NeonTag :color="record.status === 'success' ? 'green' : record.status === 'failed' ? 'red' : 'orange'">{{ record.status }}</NeonTag>
            </template>
            <template v-if="column.key === 'actions'">
              <a-button v-if="record.status === 'pending'" type="link" size="small" @click="paymentStore.verifyPayment(record.id)">验证</a-button>
            </template>
          </template>
        </DataTable>
      </a-tab-pane>
      <a-tab-pane key="offline" tab="离线支付">
        <a-empty description="暂无离线支付" />
      </a-tab-pane>
      <a-tab-pane key="invoices" tab="发票管理">
        <DataTable :columns="invoiceColumns" :data-source="paymentStore.invoices" :loading="paymentStore.loading">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'actions'">
              <a-button type="link" size="small" @click="handleEditInvoice(record)">编辑</a-button>
            </template>
          </template>
        </DataTable>
        <a-modal v-model:open="showInvoiceModal" title="编辑发票" @ok="handleSaveInvoice">
          <a-form layout="vertical"><a-form-item label="状态"><a-select v-model:value="invoiceForm.status"><a-select-option value="pending">Pending</a-select-option><a-select-option value="paid">Paid</a-select-option></a-select></a-form-item></a-form>
        </a-modal>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { usePaymentStore } from '@/stores/payments';
import SearchFilter from '@/components/common/SearchFilter.vue';
import DataTable from '@/components/common/DataTable.vue';
import NeonTag from '@/components/neon/NeonTag.vue';

const paymentStore = usePaymentStore();
const activeTab = ref('online');
const payStatusFilter = ref<string>();
const showInvoiceModal = ref(false);
const editingInvoiceId = ref<string>();
const invoiceForm = reactive({ status: '' });

const payColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '金额', dataIndex: 'amount', key: 'amount', width: 120 },
  { title: '方式', dataIndex: 'method', key: 'method', width: 100 },
  { title: '状态', key: 'status', width: 100 },
  { title: '时间', dataIndex: 'created_at', key: 'time', width: 180 },
  { title: '操作', key: 'actions', width: 80 },
];

const invoiceColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '金额', dataIndex: 'amount', key: 'amount', width: 120 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '操作', key: 'actions', width: 80 },
];

function handleEditInvoice(record: any) { editingInvoiceId.value = record.id; invoiceForm.status = record.status; showInvoiceModal.value = true; }
async function handleSaveInvoice() { if (editingInvoiceId.value) await paymentStore.updateInvoice(editingInvoiceId.value, invoiceForm); showInvoiceModal.value = false; }

onMounted(() => { paymentStore.fetchPayments(); paymentStore.fetchInvoices(); });
</script>