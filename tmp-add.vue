import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/pages/transactions/add.vue");import "/node_modules/@dcloudio/uni-components/style/view.css";import { View as __syscom_0 } from "/node_modules/@dcloudio/uni-h5/dist/uni-h5.es.js";import { defineComponent as _defineComponent } from "/node_modules/@dcloudio/uni-h5-vue/dist/vue.runtime.esm.js";
import { ref, computed } from "/node_modules/@dcloudio/uni-h5-vue/dist/vue.runtime.esm.js";
import { onLoad } from "/node_modules/@dcloudio/uni-app/dist/uni-app.es.js?v=7cc7398c";
import { useSubjectStore } from "/src/stores/subjects.ts";
import { useAccountStore } from "/src/stores/accounts.ts";
import { useTransactionStore } from "/src/stores/transactions.ts";
import { getDatabase } from "/src/database/factory.ts";
import { TransactionRepository } from "/src/repositories/transaction-repo.ts";
const _sfc_main = /* @__PURE__ */ _defineComponent({
	__name: "add",
	setup(__props, { expose: __expose }) {
		__expose();
		const subjectStore = useSubjectStore();
		const accountStore = useAccountStore();
		const txStore = useTransactionStore();
		const saving = ref(false);
		const type = ref("expense");
		const editId = ref(0);
		const isEdit = computed(() => editId.value > 0);
		const txTypeNames = {
			income: "收入",
			expense: "支出",
			transfer: "转账",
			salary: "发工资",
			investment_buy: "投资买入",
			investment_sell: "投资卖出",
			valuation_adjust: "估值调整",
			loan_receive: "借款",
			loan_repay: "还款",
			prepaid_amortize: "预付摊提",
			asset_purchase: "购置固定资产",
			asset_dispose: "资产处置",
			credit_card_spend: "信用卡消费",
			credit_card_repay: "信用卡还款"
		};
		const formName = computed(() => txTypeNames[type.value] || type.value);
		const form = ref({
			txDate: new Date().toISOString().slice(0, 10),
			amount: "",
			subjectId: 0,
			subjectName: "",
			l3SubjectId: null,
			l3SubjectName: "",
			accountId: null,
			accountName: "",
			toAccountId: null,
			toAccountName: "",
			note: "",
			// Type-specific
			grossAmount: "",
			taxAmount: "",
			socialAmount: "",
			quantity: "",
			unitPrice: "",
			interestAmount: "",
			principalAmount: "",
			originalCost: "",
			marketValue: "",
			depreciationMonths: "",
			residualValue: "",
			depositAmount: "",
			prepaidAmount: "",
			disposalProceeds: "",
			disposalReason: ""
		});
		onLoad(async (opt) => {
			if (opt?.type) type.value = opt.type;
			if (opt?.id) {
				editId.value = Number(opt.id);
				const db = await getDatabase();
				const repo = new TransactionRepository(db);
				const tx = await repo.findById(editId.value);
				if (tx) {
					form.value.txDate = tx.txDate;
					form.value.amount = String(tx.amount);
					form.value.subjectId = tx.subjectId;
					form.value.l3SubjectId = tx.l3SubjectId;
					form.value.accountId = tx.accountId;
					form.value.toAccountId = tx.toAccountId;
					form.value.note = tx.note || "";
					const sub = subjectStore.getById(tx.subjectId);
					form.value.subjectName = sub ? `${sub.code} ${sub.name}` : "";
					const acc = accountStore.getById(tx.accountId || 0);
					form.value.accountName = acc ? `${acc.name}` : "";
					const toAcc = accountStore.getById(tx.toAccountId || 0);
					form.value.toAccountName = toAcc ? `${toAcc.name}` : "";
				}
			}
		});
		function pickSubject(filter) {
			const items = subjectStore.subjects.filter((s) => s.level === 2 && (!filter || s.subjectType === filter)).map((s) => ({
				label: `${s.code} ${s.name}`,
				value: s.id
			}));
			uni.showActionSheet({
				itemList: items.map((i) => i.label),
				success: (res) => {
					if (res.tapIndex >= 0) {
						const item = items[res.tapIndex];
						form.value.subjectId = item.value;
						form.value.subjectName = item.label;
					}
				}
			});
		}
		function pickL3Subject(filter) {
			const items = accountStore.accounts.filter((a) => !filter || a.accountType === filter).map((a) => ({
				label: `${a.name}`,
				value: a.id
			}));
			uni.showActionSheet({
				itemList: items.map((i) => i.label),
				success: (res) => {
					if (res.tapIndex >= 0) {
						const item = items[res.tapIndex];
						form.value.l3SubjectId = item.value;
						form.value.l3SubjectName = item.label;
					}
				}
			});
		}
		function pickAccount(typeFilter) {
			const items = accountStore.accounts.filter((a) => !typeFilter || a.accountType === typeFilter).map((a) => ({
				label: `${a.name}  ${a.balance ? "¥" + a.balance.toFixed(2) : ""}`,
				value: a.id
			}));
			uni.showActionSheet({
				itemList: items.map((i) => i.label),
				success: (res) => {
					if (res.tapIndex >= 0) {
						const item = items[res.tapIndex];
						if (!form.value.accountId) {
							form.value.accountId = item.value;
							form.value.accountName = item.label;
						} else if (!form.value.toAccountId && form.value.accountId !== item.value) {
							form.value.toAccountId = item.value;
							form.value.toAccountName = item.label;
						} else {
							form.value.accountId = item.value;
							form.value.accountName = item.label;
						}
					}
				}
			});
		}
		function pickToAccount() {
			const items = accountStore.accounts.filter((a) => a.id !== form.value.accountId).map((a) => ({
				label: `${a.name}`,
				value: a.id
			}));
			uni.showActionSheet({
				itemList: items.map((i) => i.label),
				success: (res) => {
					if (res.tapIndex >= 0) {
						const item = items[res.tapIndex];
						form.value.toAccountId = item.value;
						form.value.toAccountName = item.label;
					}
				}
			});
		}
		async function save() {
			saving.value = true;
			try {
				const payload = {
					txType: type.value,
					txDate: form.value.txDate,
					amount: parseFloat(form.value.amount) || 0,
					subjectId: form.value.subjectId || subjectStore.subjects.find((s) => s.subjectType === "expense" && s.level === 2)?.id || 0,
					l3SubjectId: form.value.l3SubjectId,
					accountId: form.value.accountId,
					toAccountId: form.value.toAccountId,
					note: form.value.note || null,
					grossAmount: form.value.grossAmount ? parseFloat(form.value.grossAmount) : undefined,
					taxAmount: form.value.taxAmount ? parseFloat(form.value.taxAmount) : undefined,
					socialAmount: form.value.socialAmount ? parseFloat(form.value.socialAmount) : undefined,
					quantity: form.value.quantity ? parseFloat(form.value.quantity) : undefined,
					unitPrice: form.value.unitPrice ? parseFloat(form.value.unitPrice) : undefined,
					interestAmount: form.value.interestAmount ? parseFloat(form.value.interestAmount) : undefined,
					principalAmount: form.value.principalAmount ? parseFloat(form.value.principalAmount) : undefined,
					depositAmount: form.value.depositAmount ? parseFloat(form.value.depositAmount) : undefined,
					prepaidAmount: form.value.prepaidAmount ? parseFloat(form.value.prepaidAmount) : undefined,
					depreciationMonths: form.value.depreciationMonths ? parseInt(form.value.depreciationMonths) : undefined,
					residualValue: form.value.residualValue ? parseFloat(form.value.residualValue) : undefined
				};
				if (isEdit.value) {
					await txStore.updateTx(editId.value, payload);
				} else {
					await txStore.create(payload);
				}
				uni.showToast({
					title: isEdit.value ? "修改成功" : "保存成功",
					icon: "success"
				});
				setTimeout(() => uni.navigateBack(), 1e3);
			} catch (e) {
				uni.showToast({
					title: "保存失败: " + (e.message || e),
					icon: "none"
				});
			} finally {
				saving.value = false;
			}
		}
		const __returned__ = {
			subjectStore,
			accountStore,
			txStore,
			saving,
			type,
			editId,
			isEdit,
			txTypeNames,
			formName,
			form,
			pickSubject,
			pickL3Subject,
			pickAccount,
			pickToAccount,
			save
		};
		Object.defineProperty(__returned__, "__isScriptSetup", {
			enumerable: false,
			value: true
		});
		return __returned__;
	}
});
import { resolveComponent as _resolveComponent, createVNode as _createVNode, withCtx as _withCtx, Fragment as _Fragment, openBlock as _openBlock, createElementBlock as _createElementBlock, createCommentVNode as _createCommentVNode, createTextVNode as _createTextVNode, createBlock as _createBlock } from "/node_modules/@dcloudio/uni-h5-vue/dist/vue.runtime.esm.js";
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
	const _component_u_input = _resolveComponent("u-input");
	const _component_u_form_item = _resolveComponent("u-form-item");
	const _component_u_form = _resolveComponent("u-form");
	const _component_u_button = _resolveComponent("u-button");
	const _component_v_uni_view = __syscom_0;
	return _openBlock(), _createBlock(_component_v_uni_view, { class: "page-add" }, {
		default: _withCtx(() => [_createVNode(_component_u_form, { labelWidth: "160" }, {
			default: _withCtx(() => [
				_createVNode(_component_u_form_item, { label: "交易类型" }, {
					default: _withCtx(() => [_createVNode(_component_u_input, {
						modelValue: $setup.formName,
						"onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $setup.formName = $event),
						disabled: ""
					}, null, 8, ["modelValue"])]),
					_: 1
				}),
				_createVNode(_component_u_form_item, { label: "日期" }, {
					default: _withCtx(() => [_createVNode(_component_u_input, {
						modelValue: $setup.form.txDate,
						"onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => $setup.form.txDate = $event),
						type: "text",
						placeholder: "YYYY-MM-DD"
					}, null, 8, ["modelValue"])]),
					_: 1
				}),
				$setup.type === "income" ? (_openBlock(), _createElementBlock(
					_Fragment,
					{ key: 0 },
					[
						_createVNode(_component_u_form_item, { label: "收入分类" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.subjectName,
								"onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => $setup.form.subjectName = $event),
								type: "select",
								placeholder: "选择收入科目",
								onClick: _cache[3] || (_cache[3] = ($event) => $setup.pickSubject("income"))
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "到账账户" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.accountName,
								"onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => $setup.form.accountName = $event),
								type: "select",
								placeholder: "选择账户",
								onClick: $setup.pickAccount
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "金额" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.amount,
								"onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => $setup.form.amount = $event),
								type: "number",
								placeholder: "请输入金额"
							}, null, 8, ["modelValue"])]),
							_: 1
						})
					],
					64
					/* STABLE_FRAGMENT */
				)) : _createCommentVNode("v-if", true),
				$setup.type === "expense" ? (_openBlock(), _createElementBlock(
					_Fragment,
					{ key: 1 },
					[
						_createVNode(_component_u_form_item, { label: "支出分类" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.subjectName,
								"onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => $setup.form.subjectName = $event),
								type: "select",
								placeholder: "选择支出科目",
								onClick: _cache[7] || (_cache[7] = ($event) => $setup.pickSubject("expense"))
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "付款账户" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.accountName,
								"onUpdate:modelValue": _cache[8] || (_cache[8] = ($event) => $setup.form.accountName = $event),
								type: "select",
								placeholder: "选择账户",
								onClick: $setup.pickAccount
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "金额" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.amount,
								"onUpdate:modelValue": _cache[9] || (_cache[9] = ($event) => $setup.form.amount = $event),
								type: "number",
								placeholder: "请输入金额"
							}, null, 8, ["modelValue"])]),
							_: 1
						})
					],
					64
					/* STABLE_FRAGMENT */
				)) : _createCommentVNode("v-if", true),
				$setup.type === "transfer" ? (_openBlock(), _createElementBlock(
					_Fragment,
					{ key: 2 },
					[
						_createVNode(_component_u_form_item, { label: "转出账户" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.accountName,
								"onUpdate:modelValue": _cache[10] || (_cache[10] = ($event) => $setup.form.accountName = $event),
								type: "select",
								placeholder: "选择转出账户",
								onClick: $setup.pickAccount
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "转入账户" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.toAccountName,
								"onUpdate:modelValue": _cache[11] || (_cache[11] = ($event) => $setup.form.toAccountName = $event),
								type: "select",
								placeholder: "选择转入账户",
								onClick: $setup.pickToAccount
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "金额" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.amount,
								"onUpdate:modelValue": _cache[12] || (_cache[12] = ($event) => $setup.form.amount = $event),
								type: "number",
								placeholder: "请输入金额"
							}, null, 8, ["modelValue"])]),
							_: 1
						})
					],
					64
					/* STABLE_FRAGMENT */
				)) : _createCommentVNode("v-if", true),
				$setup.type === "salary" ? (_openBlock(), _createElementBlock(
					_Fragment,
					{ key: 3 },
					[
						_createVNode(_component_u_form_item, { label: "工资分类" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.subjectName,
								"onUpdate:modelValue": _cache[13] || (_cache[13] = ($event) => $setup.form.subjectName = $event),
								type: "select",
								placeholder: "工资薪金",
								onClick: _cache[14] || (_cache[14] = ($event) => $setup.pickSubject("income"))
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "到账账户" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.accountName,
								"onUpdate:modelValue": _cache[15] || (_cache[15] = ($event) => $setup.form.accountName = $event),
								type: "select",
								placeholder: "选择账户",
								onClick: $setup.pickAccount
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "税前总额" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.grossAmount,
								"onUpdate:modelValue": _cache[16] || (_cache[16] = ($event) => $setup.form.grossAmount = $event),
								type: "number",
								placeholder: "税前工资总额"
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "个税" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.taxAmount,
								"onUpdate:modelValue": _cache[17] || (_cache[17] = ($event) => $setup.form.taxAmount = $event),
								type: "number",
								placeholder: "代扣个税"
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "社保公积金" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.socialAmount,
								"onUpdate:modelValue": _cache[18] || (_cache[18] = ($event) => $setup.form.socialAmount = $event),
								type: "number",
								placeholder: "社保+公积金"
							}, null, 8, ["modelValue"])]),
							_: 1
						})
					],
					64
					/* STABLE_FRAGMENT */
				)) : _createCommentVNode("v-if", true),
				$setup.type === "investment_buy" ? (_openBlock(), _createElementBlock(
					_Fragment,
					{ key: 4 },
					[
						_createVNode(_component_u_form_item, { label: "投资品" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.l3SubjectName,
								"onUpdate:modelValue": _cache[19] || (_cache[19] = ($event) => $setup.form.l3SubjectName = $event),
								type: "select",
								placeholder: "选择或输入名称",
								onClick: _cache[20] || (_cache[20] = ($event) => $setup.pickL3Subject("investment"))
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "付款账户" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.accountName,
								"onUpdate:modelValue": _cache[21] || (_cache[21] = ($event) => $setup.form.accountName = $event),
								type: "select",
								placeholder: "选择账户",
								onClick: $setup.pickAccount
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "名称" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.l3SubjectName,
								"onUpdate:modelValue": _cache[22] || (_cache[22] = ($event) => $setup.form.l3SubjectName = $event),
								placeholder: "投资品名称，代码可写后面"
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "单价" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.unitPrice,
								"onUpdate:modelValue": _cache[23] || (_cache[23] = ($event) => $setup.form.unitPrice = $event),
								type: "number",
								placeholder: "单价"
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "总金额" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.amount,
								"onUpdate:modelValue": _cache[24] || (_cache[24] = ($event) => $setup.form.amount = $event),
								type: "number",
								placeholder: "买入总金额"
							}, null, 8, ["modelValue"])]),
							_: 1
						})
					],
					64
					/* STABLE_FRAGMENT */
				)) : _createCommentVNode("v-if", true),
				$setup.type === "investment_sell" ? (_openBlock(), _createElementBlock(
					_Fragment,
					{ key: 5 },
					[
						_createVNode(_component_u_form_item, { label: "投资品" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.l3SubjectName,
								"onUpdate:modelValue": _cache[25] || (_cache[25] = ($event) => $setup.form.l3SubjectName = $event),
								type: "select",
								placeholder: "选择投资品",
								onClick: _cache[26] || (_cache[26] = ($event) => $setup.pickL3Subject("investment"))
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "到账账户" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.accountName,
								"onUpdate:modelValue": _cache[27] || (_cache[27] = ($event) => $setup.form.accountName = $event),
								type: "select",
								placeholder: "选择账户",
								onClick: $setup.pickAccount
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "卖出金额" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.amount,
								"onUpdate:modelValue": _cache[28] || (_cache[28] = ($event) => $setup.form.amount = $event),
								type: "number",
								placeholder: "卖出总金额"
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "卖出数量" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.quantity,
								"onUpdate:modelValue": _cache[29] || (_cache[29] = ($event) => $setup.form.quantity = $event),
								type: "number",
								placeholder: "卖出数量(留空=全部)"
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "卖出单价" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.unitPrice,
								"onUpdate:modelValue": _cache[30] || (_cache[30] = ($event) => $setup.form.unitPrice = $event),
								type: "number",
								placeholder: "卖出单价"
							}, null, 8, ["modelValue"])]),
							_: 1
						})
					],
					64
					/* STABLE_FRAGMENT */
				)) : _createCommentVNode("v-if", true),
				$setup.type === "loan_repay" ? (_openBlock(), _createElementBlock(
					_Fragment,
					{ key: 6 },
					[
						_createVNode(_component_u_form_item, { label: "还款账户" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.accountName,
								"onUpdate:modelValue": _cache[31] || (_cache[31] = ($event) => $setup.form.accountName = $event),
								type: "select",
								placeholder: "选择付款账户",
								onClick: $setup.pickAccount
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "还款总额" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.amount,
								"onUpdate:modelValue": _cache[32] || (_cache[32] = ($event) => $setup.form.amount = $event),
								type: "number",
								placeholder: "还款总额"
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "其中利息" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.interestAmount,
								"onUpdate:modelValue": _cache[33] || (_cache[33] = ($event) => $setup.form.interestAmount = $event),
								type: "number",
								placeholder: "利息部分"
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "其中本金" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.principalAmount,
								"onUpdate:modelValue": _cache[34] || (_cache[34] = ($event) => $setup.form.principalAmount = $event),
								type: "number",
								placeholder: "本金部分"
							}, null, 8, ["modelValue"])]),
							_: 1
						})
					],
					64
					/* STABLE_FRAGMENT */
				)) : _createCommentVNode("v-if", true),
				$setup.type === "prepaid_amortize" ? (_openBlock(), _createElementBlock(
					_Fragment,
					{ key: 7 },
					[
						_createVNode(_component_u_form_item, { label: "费用科目" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.subjectName,
								"onUpdate:modelValue": _cache[35] || (_cache[35] = ($event) => $setup.form.subjectName = $event),
								type: "select",
								placeholder: "选择费用科目",
								onClick: _cache[36] || (_cache[36] = ($event) => $setup.pickSubject("expense"))
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "付款账户" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.accountName,
								"onUpdate:modelValue": _cache[37] || (_cache[37] = ($event) => $setup.form.accountName = $event),
								type: "select",
								placeholder: "选择账户",
								onClick: $setup.pickAccount
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "付款总额" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.amount,
								"onUpdate:modelValue": _cache[38] || (_cache[38] = ($event) => $setup.form.amount = $event),
								type: "number",
								placeholder: "支付总额"
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "押金(可退)" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.depositAmount,
								"onUpdate:modelValue": _cache[39] || (_cache[39] = ($event) => $setup.form.depositAmount = $event),
								type: "number",
								placeholder: "押金金额"
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "预付金额" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.prepaidAmount,
								"onUpdate:modelValue": _cache[40] || (_cache[40] = ($event) => $setup.form.prepaidAmount = $event),
								type: "number",
								placeholder: "待摊金额"
							}, null, 8, ["modelValue"])]),
							_: 1
						})
					],
					64
					/* STABLE_FRAGMENT */
				)) : _createCommentVNode("v-if", true),
				$setup.type === "asset_purchase" ? (_openBlock(), _createElementBlock(
					_Fragment,
					{ key: 8 },
					[
						_createVNode(_component_u_form_item, { label: "资产分类" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.subjectName,
								"onUpdate:modelValue": _cache[41] || (_cache[41] = ($event) => $setup.form.subjectName = $event),
								type: "select",
								placeholder: "选择资产分类",
								onClick: _cache[42] || (_cache[42] = ($event) => $setup.pickSubject("asset"))
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "资产名称" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.l3SubjectName,
								"onUpdate:modelValue": _cache[43] || (_cache[43] = ($event) => $setup.form.l3SubjectName = $event),
								placeholder: "如：联想笔记本"
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "付款账户" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.accountName,
								"onUpdate:modelValue": _cache[44] || (_cache[44] = ($event) => $setup.form.accountName = $event),
								type: "select",
								placeholder: "选择账户",
								onClick: $setup.pickAccount
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "购买金额" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.amount,
								"onUpdate:modelValue": _cache[45] || (_cache[45] = ($event) => $setup.form.amount = $event),
								type: "number",
								placeholder: "购买金额"
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "折旧年限" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.depreciationMonths,
								"onUpdate:modelValue": _cache[46] || (_cache[46] = ($event) => $setup.form.depreciationMonths = $event),
								type: "number",
								placeholder: "使用月数"
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "残值" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.residualValue,
								"onUpdate:modelValue": _cache[47] || (_cache[47] = ($event) => $setup.form.residualValue = $event),
								type: "number",
								placeholder: "预计残值"
							}, null, 8, ["modelValue"])]),
							_: 1
						})
					],
					64
					/* STABLE_FRAGMENT */
				)) : _createCommentVNode("v-if", true),
				$setup.type === "credit_card_spend" ? (_openBlock(), _createElementBlock(
					_Fragment,
					{ key: 9 },
					[
						_createVNode(_component_u_form_item, { label: "支出分类" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.subjectName,
								"onUpdate:modelValue": _cache[48] || (_cache[48] = ($event) => $setup.form.subjectName = $event),
								type: "select",
								placeholder: "选择支出科目",
								onClick: _cache[49] || (_cache[49] = ($event) => $setup.pickSubject("expense"))
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "信用卡" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.accountName,
								"onUpdate:modelValue": _cache[50] || (_cache[50] = ($event) => $setup.form.accountName = $event),
								type: "select",
								placeholder: "选择信用卡",
								onClick: _cache[51] || (_cache[51] = ($event) => $setup.pickAccount("credit_card"))
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "金额" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.amount,
								"onUpdate:modelValue": _cache[52] || (_cache[52] = ($event) => $setup.form.amount = $event),
								type: "number",
								placeholder: "消费金额"
							}, null, 8, ["modelValue"])]),
							_: 1
						})
					],
					64
					/* STABLE_FRAGMENT */
				)) : _createCommentVNode("v-if", true),
				$setup.type === "credit_card_repay" ? (_openBlock(), _createElementBlock(
					_Fragment,
					{ key: 10 },
					[
						_createVNode(_component_u_form_item, { label: "信用卡" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.accountName,
								"onUpdate:modelValue": _cache[53] || (_cache[53] = ($event) => $setup.form.accountName = $event),
								type: "select",
								placeholder: "选择信用卡",
								onClick: _cache[54] || (_cache[54] = ($event) => $setup.pickAccount("credit_card"))
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "还款账户" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.toAccountName,
								"onUpdate:modelValue": _cache[55] || (_cache[55] = ($event) => $setup.form.toAccountName = $event),
								type: "select",
								placeholder: "选择付款账户",
								onClick: _cache[56] || (_cache[56] = ($event) => $setup.pickAccount())
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "还款金额" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.amount,
								"onUpdate:modelValue": _cache[57] || (_cache[57] = ($event) => $setup.form.amount = $event),
								type: "number",
								placeholder: "还款金额"
							}, null, 8, ["modelValue"])]),
							_: 1
						})
					],
					64
					/* STABLE_FRAGMENT */
				)) : _createCommentVNode("v-if", true),
				$setup.type === "valuation_adjust" ? (_openBlock(), _createElementBlock(
					_Fragment,
					{ key: 11 },
					[
						_createVNode(_component_u_form_item, { label: "投资品" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.l3SubjectName,
								"onUpdate:modelValue": _cache[58] || (_cache[58] = ($event) => $setup.form.l3SubjectName = $event),
								type: "select",
								placeholder: "选择投资品",
								onClick: _cache[59] || (_cache[59] = ($event) => $setup.pickL3Subject("investment"))
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "原值(成本)" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.originalCost,
								"onUpdate:modelValue": _cache[60] || (_cache[60] = ($event) => $setup.form.originalCost = $event),
								type: "number",
								placeholder: "买入成本"
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "最新市值" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.marketValue,
								"onUpdate:modelValue": _cache[61] || (_cache[61] = ($event) => $setup.form.marketValue = $event),
								type: "number",
								placeholder: "当前市值"
							}, null, 8, ["modelValue"])]),
							_: 1
						})
					],
					64
					/* STABLE_FRAGMENT */
				)) : _createCommentVNode("v-if", true),
				$setup.type === "loan_receive" ? (_openBlock(), _createElementBlock(
					_Fragment,
					{ key: 12 },
					[
						_createVNode(_component_u_form_item, { label: "借款分类" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.subjectName,
								"onUpdate:modelValue": _cache[62] || (_cache[62] = ($event) => $setup.form.subjectName = $event),
								type: "select",
								placeholder: "选择负债科目",
								onClick: _cache[63] || (_cache[63] = ($event) => $setup.pickSubject("liability"))
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "到账账户" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.accountName,
								"onUpdate:modelValue": _cache[64] || (_cache[64] = ($event) => $setup.form.accountName = $event),
								type: "select",
								placeholder: "选择收款账户",
								onClick: $setup.pickAccount
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "借款金额" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.amount,
								"onUpdate:modelValue": _cache[65] || (_cache[65] = ($event) => $setup.form.amount = $event),
								type: "number",
								placeholder: "借款金额"
							}, null, 8, ["modelValue"])]),
							_: 1
						})
					],
					64
					/* STABLE_FRAGMENT */
				)) : _createCommentVNode("v-if", true),
				$setup.type === "asset_dispose" ? (_openBlock(), _createElementBlock(
					_Fragment,
					{ key: 13 },
					[
						_createVNode(_component_u_form_item, { label: "资产" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.l3SubjectName,
								"onUpdate:modelValue": _cache[66] || (_cache[66] = ($event) => $setup.form.l3SubjectName = $event),
								type: "select",
								placeholder: "选择资产",
								onClick: _cache[67] || (_cache[67] = ($event) => $setup.pickL3Subject("fixed_asset"))
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "处置收入" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.disposalProceeds,
								"onUpdate:modelValue": _cache[68] || (_cache[68] = ($event) => $setup.form.disposalProceeds = $event),
								type: "number",
								placeholder: "卖出/回收金额"
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "资产原值" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.amount,
								"onUpdate:modelValue": _cache[69] || (_cache[69] = ($event) => $setup.form.amount = $event),
								type: "number",
								placeholder: "资产原值"
							}, null, 8, ["modelValue"])]),
							_: 1
						}),
						_createVNode(_component_u_form_item, { label: "处置原因" }, {
							default: _withCtx(() => [_createVNode(_component_u_input, {
								modelValue: $setup.form.disposalReason,
								"onUpdate:modelValue": _cache[70] || (_cache[70] = ($event) => $setup.form.disposalReason = $event),
								placeholder: "出售/报废/其他"
							}, null, 8, ["modelValue"])]),
							_: 1
						})
					],
					64
					/* STABLE_FRAGMENT */
				)) : _createCommentVNode("v-if", true),
				_createVNode(_component_u_form_item, { label: "备注" }, {
					default: _withCtx(() => [_createVNode(_component_u_input, {
						modelValue: $setup.form.note,
						"onUpdate:modelValue": _cache[71] || (_cache[71] = ($event) => $setup.form.note = $event),
						type: "text",
						placeholder: "选填"
					}, null, 8, ["modelValue"])]),
					_: 1
				})
			]),
			_: 1
		}), _createVNode(_component_v_uni_view, { class: "btn-bar" }, {
			default: _withCtx(() => [_createVNode(_component_u_button, {
				type: "primary",
				onClick: $setup.save,
				loading: $setup.saving
			}, {
				default: _withCtx(() => [_createTextVNode("保存")]),
				_: 1
			}, 8, ["loading"])]),
			_: 1
		})]),
		_: 1
	});
}
import "/src/pages/transactions/add.vue?vue&type=style&index=0&scoped=87860f08&lang.scss";
_sfc_main.__hmrId = "87860f08";
typeof __VUE_HMR_RUNTIME__ !== "undefined" && __VUE_HMR_RUNTIME__.createRecord(_sfc_main.__hmrId, _sfc_main);
import.meta.hot.on("file-changed", ({ file }) => {
	__VUE_HMR_RUNTIME__.CHANGED_FILE = file;
});
import.meta.hot.accept((mod) => {
	if (!mod) return;
	const { default: updated, _rerender_only } = mod;
	if (_rerender_only) {
		__VUE_HMR_RUNTIME__.rerender(updated.__hmrId, updated.render);
	} else {
		__VUE_HMR_RUNTIME__.reload(updated.__hmrId, updated);
	}
});
import _export_sfc from "/@id/__x00__plugin-vue:export-helper";
export default /* @__PURE__ */ _export_sfc(_sfc_main, [
	["render", _sfc_render],
	["__scopeId", "data-v-87860f08"],
	["__file", "D:/accounting app/src/pages/transactions/add.vue"]
]);

//# sourceMappingURL=data:application/json;base64,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a09RLGFBRWMsd0JBQUEsRUFGRCxPQUFNLE9BQU0sR0FBQTtPQWxPakMsU0FBQSxlQW1PNEUsQ0FBbEUsYUFBa0Usb0JBQUE7UUFuTzVFLFlBbU80QixPQUFBLEtBQUs7UUFuT2pDLHVCQUFBLE9BQUEsUUFBQSxPQUFBLE9BQUEsV0FBQSxBQW1PNEIsT0FBQSxLQUFLLFNBQU07UUFBRSxNQUFLO1FBQVMsYUFBWTs7T0FuT25FLEdBQUE7O01BcU9RLGFBRWMsd0JBQUEsRUFGRCxPQUFNLE9BQU0sR0FBQTtPQXJPakMsU0FBQSxlQXNPMEUsQ0FBaEUsYUFBZ0Usb0JBQUE7UUF0TzFFLFlBc080QixPQUFBLEtBQUs7UUF0T2pDLHVCQUFBLE9BQUEsUUFBQSxPQUFBLE9BQUEsV0FBQSxBQXNPNEIsT0FBQSxLQUFLLGlCQUFjO1FBQUUsYUFBWTs7T0F0TzdELEdBQUE7Ozs7O1NBQUEsb0JBQUEsUUFBQSxJQUFBO0lBMk9NLGFBRWMsd0JBQUEsRUFGRCxPQUFNLEtBQUksR0FBQTtLQTNPN0IsU0FBQSxlQTRPb0UsQ0FBNUQsYUFBNEQsb0JBQUE7TUE1T3BFLFlBNE8wQixPQUFBLEtBQUs7TUE1Ty9CLHVCQUFBLE9BQUEsUUFBQSxPQUFBLE9BQUEsV0FBQSxBQTRPMEIsT0FBQSxLQUFLLE9BQUk7TUFBRSxNQUFLO01BQU8sYUFBWTs7S0E1TzdELEdBQUE7OztHQUFBLEdBQUE7TUFnUEksYUFFTyx1QkFBQSxFQUZELE9BQU0sVUFBUyxHQUFBO0dBaFB6QixTQUFBLGVBaVA0RSxDQUF0RSxhQUFzRSxxQkFBQTtJQUE1RCxNQUFLO0lBQVcsU0FBTyxPQUFBO0lBQU8sU0FBUyxPQUFBOztJQWpQdkQsU0FBQSxlQWlQaUUsQ0FqUGpFLGlCQWlQK0QsSUFBRTtJQWpQakUsR0FBQTs7R0FBQSxHQUFBOztFQUFBLEdBQUEiLCJuYW1lcyI6W10sInNvdXJjZXMiOlsiYWRkLnZ1ZSJdLCJ2ZXJzaW9uIjozLCJzb3VyY2VzQ29udGVudCI6WyI8dGVtcGxhdGU+XG4gIDx2aWV3IGNsYXNzPVwicGFnZS1hZGRcIj5cbiAgICA8dS1mb3JtIGxhYmVsV2lkdGg9XCIxNjBcIj5cbiAgICAgIDx1LWZvcm0taXRlbSBsYWJlbD1cIuS6pOaYk+exu+Wei1wiPlxuICAgICAgICA8dS1pbnB1dCB2LW1vZGVsPVwiZm9ybU5hbWVcIiBkaXNhYmxlZCAvPlxuICAgICAgPC91LWZvcm0taXRlbT5cblxuICAgICAgPCEtLSBGaWVsZHMgc2hhcmVkIGJ5IGFsbCB0eXBlcyAtLT5cbiAgICAgIDx1LWZvcm0taXRlbSBsYWJlbD1cIuaXpeacn1wiPlxuICAgICAgICA8dS1pbnB1dCB2LW1vZGVsPVwiZm9ybS50eERhdGVcIiB0eXBlPVwidGV4dFwiIHBsYWNlaG9sZGVyPVwiWVlZWS1NTS1ERFwiIC8+XG4gICAgICA8L3UtZm9ybS1pdGVtPlxuXG4gICAgICA8IS0tIFR5cGUtc3BlY2lmaWMgZmllbGRzIC0tPlxuICAgICAgPCEtLSBJbmNvbWUgZmllbGRzIC0tPlxuICAgICAgPHRlbXBsYXRlIHYtaWY9XCJ0eXBlID09PSAnaW5jb21lJ1wiPlxuICAgICAgICA8dS1mb3JtLWl0ZW0gbGFiZWw9XCLmlLblhaXliIbnsbtcIj5cbiAgICAgICAgICA8dS1pbnB1dCB2LW1vZGVsPVwiZm9ybS5zdWJqZWN0TmFtZVwiIHR5cGU9XCJzZWxlY3RcIiBwbGFjZWhvbGRlcj1cIumAieaLqeaUtuWFpeenkeebrlwiIEBjbGljaz1cInBpY2tTdWJqZWN0KCdpbmNvbWUnKVwiIC8+XG4gICAgICAgIDwvdS1mb3JtLWl0ZW0+XG4gICAgICAgIDx1LWZvcm0taXRlbSBsYWJlbD1cIuWIsOi0pui0puaIt1wiPlxuICAgICAgICAgIDx1LWlucHV0IHYtbW9kZWw9XCJmb3JtLmFjY291bnROYW1lXCIgdHlwZT1cInNlbGVjdFwiIHBsYWNlaG9sZGVyPVwi6YCJ5oup6LSm5oi3XCIgQGNsaWNrPVwicGlja0FjY291bnRcIiAvPlxuICAgICAgICA8L3UtZm9ybS1pdGVtPlxuICAgICAgICA8dS1mb3JtLWl0ZW0gbGFiZWw9XCLph5Hpop1cIj5cbiAgICAgICAgICA8dS1pbnB1dCB2LW1vZGVsPVwiZm9ybS5hbW91bnRcIiB0eXBlPVwibnVtYmVyXCIgcGxhY2Vob2xkZXI9XCLor7fovpPlhaXph5Hpop1cIiAvPlxuICAgICAgICA8L3UtZm9ybS1pdGVtPlxuICAgICAgPC90ZW1wbGF0ZT5cblxuICAgICAgPCEtLSBFeHBlbnNlIGZpZWxkcyAtLT5cbiAgICAgIDx0ZW1wbGF0ZSB2LWlmPVwidHlwZSA9PT0gJ2V4cGVuc2UnXCI+XG4gICAgICAgIDx1LWZvcm0taXRlbSBsYWJlbD1cIuaUr+WHuuWIhuexu1wiPlxuICAgICAgICAgIDx1LWlucHV0IHYtbW9kZWw9XCJmb3JtLnN1YmplY3ROYW1lXCIgdHlwZT1cInNlbGVjdFwiIHBsYWNlaG9sZGVyPVwi6YCJ5oup5pSv5Ye656eR55uuXCIgQGNsaWNrPVwicGlja1N1YmplY3QoJ2V4cGVuc2UnKVwiIC8+XG4gICAgICAgIDwvdS1mb3JtLWl0ZW0+XG4gICAgICAgIDx1LWZvcm0taXRlbSBsYWJlbD1cIuS7mOasvui0puaIt1wiPlxuICAgICAgICAgIDx1LWlucHV0IHYtbW9kZWw9XCJmb3JtLmFjY291bnROYW1lXCIgdHlwZT1cInNlbGVjdFwiIHBsYWNlaG9sZGVyPVwi6YCJ5oup6LSm5oi3XCIgQGNsaWNrPVwicGlja0FjY291bnRcIiAvPlxuICAgICAgICA8L3UtZm9ybS1pdGVtPlxuICAgICAgICA8dS1mb3JtLWl0ZW0gbGFiZWw9XCLph5Hpop1cIj5cbiAgICAgICAgICA8dS1pbnB1dCB2LW1vZGVsPVwiZm9ybS5hbW91bnRcIiB0eXBlPVwibnVtYmVyXCIgcGxhY2Vob2xkZXI9XCLor7fovpPlhaXph5Hpop1cIiAvPlxuICAgICAgICA8L3UtZm9ybS1pdGVtPlxuICAgICAgPC90ZW1wbGF0ZT5cblxuICAgICAgPCEtLSBUcmFuc2ZlciAtLT5cbiAgICAgIDx0ZW1wbGF0ZSB2LWlmPVwidHlwZSA9PT0gJ3RyYW5zZmVyJ1wiPlxuICAgICAgICA8dS1mb3JtLWl0ZW0gbGFiZWw9XCLovazlh7rotKbmiLdcIj5cbiAgICAgICAgICA8dS1pbnB1dCB2LW1vZGVsPVwiZm9ybS5hY2NvdW50TmFtZVwiIHR5cGU9XCJzZWxlY3RcIiBwbGFjZWhvbGRlcj1cIumAieaLqei9rOWHuui0puaIt1wiIEBjbGljaz1cInBpY2tBY2NvdW50XCIgLz5cbiAgICAgICAgPC91LWZvcm0taXRlbT5cbiAgICAgICAgPHUtZm9ybS1pdGVtIGxhYmVsPVwi6L2s5YWl6LSm5oi3XCI+XG4gICAgICAgICAgPHUtaW5wdXQgdi1tb2RlbD1cImZvcm0udG9BY2NvdW50TmFtZVwiIHR5cGU9XCJzZWxlY3RcIiBwbGFjZWhvbGRlcj1cIumAieaLqei9rOWFpei0puaIt1wiIEBjbGljaz1cInBpY2tUb0FjY291bnRcIiAvPlxuICAgICAgICA8L3UtZm9ybS1pdGVtPlxuICAgICAgICA8dS1mb3JtLWl0ZW0gbGFiZWw9XCLph5Hpop1cIj5cbiAgICAgICAgICA8dS1pbnB1dCB2LW1vZGVsPVwiZm9ybS5hbW91bnRcIiB0eXBlPVwibnVtYmVyXCIgcGxhY2Vob2xkZXI9XCLor7fovpPlhaXph5Hpop1cIiAvPlxuICAgICAgICA8L3UtZm9ybS1pdGVtPlxuICAgICAgPC90ZW1wbGF0ZT5cblxuICAgICAgPCEtLSBTYWxhcnkgLS0+XG4gICAgICA8dGVtcGxhdGUgdi1pZj1cInR5cGUgPT09ICdzYWxhcnknXCI+XG4gICAgICAgIDx1LWZvcm0taXRlbSBsYWJlbD1cIuW3pei1hOWIhuexu1wiPlxuICAgICAgICAgIDx1LWlucHV0IHYtbW9kZWw9XCJmb3JtLnN1YmplY3ROYW1lXCIgdHlwZT1cInNlbGVjdFwiIHBsYWNlaG9sZGVyPVwi5bel6LWE6Jaq6YeRXCIgQGNsaWNrPVwicGlja1N1YmplY3QoJ2luY29tZScpXCIgLz5cbiAgICAgICAgPC91LWZvcm0taXRlbT5cbiAgICAgICAgPHUtZm9ybS1pdGVtIGxhYmVsPVwi5Yiw6LSm6LSm5oi3XCI+XG4gICAgICAgICAgPHUtaW5wdXQgdi1tb2RlbD1cImZvcm0uYWNjb3VudE5hbWVcIiB0eXBlPVwic2VsZWN0XCIgcGxhY2Vob2xkZXI9XCLpgInmi6notKbmiLdcIiBAY2xpY2s9XCJwaWNrQWNjb3VudFwiIC8+XG4gICAgICAgIDwvdS1mb3JtLWl0ZW0+XG4gICAgICAgIDx1LWZvcm0taXRlbSBsYWJlbD1cIueojuWJjeaAu+minVwiPlxuICAgICAgICAgIDx1LWlucHV0IHYtbW9kZWw9XCJmb3JtLmdyb3NzQW1vdW50XCIgdHlwZT1cIm51bWJlclwiIHBsYWNlaG9sZGVyPVwi56iO5YmN5bel6LWE5oC76aKdXCIgLz5cbiAgICAgICAgPC91LWZvcm0taXRlbT5cbiAgICAgICAgPHUtZm9ybS1pdGVtIGxhYmVsPVwi5Liq56iOXCI+XG4gICAgICAgICAgPHUtaW5wdXQgdi1tb2RlbD1cImZvcm0udGF4QW1vdW50XCIgdHlwZT1cIm51bWJlclwiIHBsYWNlaG9sZGVyPVwi5Luj5omj5Liq56iOXCIgLz5cbiAgICAgICAgPC91LWZvcm0taXRlbT5cbiAgICAgICAgPHUtZm9ybS1pdGVtIGxhYmVsPVwi56S+5L+d5YWs56ev6YeRXCI+XG4gICAgICAgICAgPHUtaW5wdXQgdi1tb2RlbD1cImZvcm0uc29jaWFsQW1vdW50XCIgdHlwZT1cIm51bWJlclwiIHBsYWNlaG9sZGVyPVwi56S+5L+dK+WFrOenr+mHkVwiIC8+XG4gICAgICAgIDwvdS1mb3JtLWl0ZW0+XG4gICAgICA8L3RlbXBsYXRlPlxuXG4gICAgICA8IS0tIEludmVzdG1lbnQgQnV5IC0tPlxuICAgICAgPHRlbXBsYXRlIHYtaWY9XCJ0eXBlID09PSAnaW52ZXN0bWVudF9idXknXCI+XG4gICAgICAgIDx1LWZvcm0taXRlbSBsYWJlbD1cIuaKlei1hOWTgVwiPlxuICAgICAgICAgIDx1LWlucHV0IHYtbW9kZWw9XCJmb3JtLmwzU3ViamVjdE5hbWVcIiB0eXBlPVwic2VsZWN0XCIgcGxhY2Vob2xkZXI9XCLpgInmi6nmiJbovpPlhaXlkI3np7BcIiBAY2xpY2s9XCJwaWNrTDNTdWJqZWN0KCdpbnZlc3RtZW50JylcIiAvPlxuICAgICAgICA8L3UtZm9ybS1pdGVtPlxuICAgICAgICA8dS1mb3JtLWl0ZW0gbGFiZWw9XCLku5jmrL7otKbmiLdcIj5cbiAgICAgICAgICA8dS1pbnB1dCB2LW1vZGVsPVwiZm9ybS5hY2NvdW50TmFtZVwiIHR5cGU9XCJzZWxlY3RcIiBwbGFjZWhvbGRlcj1cIumAieaLqei0puaIt1wiIEBjbGljaz1cInBpY2tBY2NvdW50XCIgLz5cbiAgICAgICAgPC91LWZvcm0taXRlbT5cbiAgICAgICAgPHUtZm9ybS1pdGVtIGxhYmVsPVwi5ZCN56ewXCI+XG4gICAgICAgICAgPHUtaW5wdXQgdi1tb2RlbD1cImZvcm0ubDNTdWJqZWN0TmFtZVwiIHBsYWNlaG9sZGVyPVwi5oqV6LWE5ZOB5ZCN56ew77yM5Luj56CB5Y+v5YaZ5ZCO6Z2iXCIgLz5cbiAgICAgICAgPC91LWZvcm0taXRlbT5cbiAgICAgICAgPHUtZm9ybS1pdGVtIGxhYmVsPVwi5Y2V5Lu3XCI+XG4gICAgICAgICAgPHUtaW5wdXQgdi1tb2RlbD1cImZvcm0udW5pdFByaWNlXCIgdHlwZT1cIm51bWJlclwiIHBsYWNlaG9sZGVyPVwi5Y2V5Lu3XCIgLz5cbiAgICAgICAgPC91LWZvcm0taXRlbT5cbiAgICAgICAgPHUtZm9ybS1pdGVtIGxhYmVsPVwi5oC76YeR6aKdXCI+XG4gICAgICAgICAgPHUtaW5wdXQgdi1tb2RlbD1cImZvcm0uYW1vdW50XCIgdHlwZT1cIm51bWJlclwiIHBsYWNlaG9sZGVyPVwi5Lmw5YWl5oC76YeR6aKdXCIgLz5cbiAgICAgICAgPC91LWZvcm0taXRlbT5cbiAgICAgIDwvdGVtcGxhdGU+XG5cbiAgICAgIDwhLS0gSW52ZXN0bWVudCBTZWxsIC0tPlxuICAgICAgPHRlbXBsYXRlIHYtaWY9XCJ0eXBlID09PSAnaW52ZXN0bWVudF9zZWxsJ1wiPlxuICAgICAgICA8dS1mb3JtLWl0ZW0gbGFiZWw9XCLmipXotYTlk4FcIj5cbiAgICAgICAgICA8dS1pbnB1dCB2LW1vZGVsPVwiZm9ybS5sM1N1YmplY3ROYW1lXCIgdHlwZT1cInNlbGVjdFwiIHBsYWNlaG9sZGVyPVwi6YCJ5oup5oqV6LWE5ZOBXCIgQGNsaWNrPVwicGlja0wzU3ViamVjdCgnaW52ZXN0bWVudCcpXCIgLz5cbiAgICAgICAgPC91LWZvcm0taXRlbT5cbiAgICAgICAgPHUtZm9ybS1pdGVtIGxhYmVsPVwi5Yiw6LSm6LSm5oi3XCI+XG4gICAgICAgICAgPHUtaW5wdXQgdi1tb2RlbD1cImZvcm0uYWNjb3VudE5hbWVcIiB0eXBlPVwic2VsZWN0XCIgcGxhY2Vob2xkZXI9XCLpgInmi6notKbmiLdcIiBAY2xpY2s9XCJwaWNrQWNjb3VudFwiIC8+XG4gICAgICAgIDwvdS1mb3JtLWl0ZW0+XG4gICAgICAgIDx1LWZvcm0taXRlbSBsYWJlbD1cIuWNluWHuumHkeminVwiPlxuICAgICAgICAgIDx1LWlucHV0IHYtbW9kZWw9XCJmb3JtLmFtb3VudFwiIHR5cGU9XCJudW1iZXJcIiBwbGFjZWhvbGRlcj1cIuWNluWHuuaAu+mHkeminVwiIC8+XG4gICAgICAgIDwvdS1mb3JtLWl0ZW0+XG4gICAgICAgIDx1LWZvcm0taXRlbSBsYWJlbD1cIuWNluWHuuaVsOmHj1wiPlxuICAgICAgICAgIDx1LWlucHV0IHYtbW9kZWw9XCJmb3JtLnF1YW50aXR5XCIgdHlwZT1cIm51bWJlclwiIHBsYWNlaG9sZGVyPVwi5Y2W5Ye65pWw6YePKOeVmeepuj3lhajpg6gpXCIgLz5cbiAgICAgICAgPC91LWZvcm0taXRlbT5cbiAgICAgICAgPHUtZm9ybS1pdGVtIGxhYmVsPVwi5Y2W5Ye65Y2V5Lu3XCI+XG4gICAgICAgICAgPHUtaW5wdXQgdi1tb2RlbD1cImZvcm0udW5pdFByaWNlXCIgdHlwZT1cIm51bWJlclwiIHBsYWNlaG9sZGVyPVwi5Y2W5Ye65Y2V5Lu3XCIgLz5cbiAgICAgICAgPC91LWZvcm0taXRlbT5cbiAgICAgIDwvdGVtcGxhdGU+XG5cbiAgICAgIDwhLS0gTG9hbiBSZXBheSAtLT5cbiAgICAgIDx0ZW1wbGF0ZSB2LWlmPVwidHlwZSA9PT0gJ2xvYW5fcmVwYXknXCI+XG4gICAgICAgIDx1LWZvcm0taXRlbSBsYWJlbD1cIui/mOasvui0puaIt1wiPlxuICAgICAgICAgIDx1LWlucHV0IHYtbW9kZWw9XCJmb3JtLmFjY291bnROYW1lXCIgdHlwZT1cInNlbGVjdFwiIHBsYWNlaG9sZGVyPVwi6YCJ5oup5LuY5qy+6LSm5oi3XCIgQGNsaWNrPVwicGlja0FjY291bnRcIiAvPlxuICAgICAgICA8L3UtZm9ybS1pdGVtPlxuICAgICAgICA8dS1mb3JtLWl0ZW0gbGFiZWw9XCLov5jmrL7mgLvpop1cIj5cbiAgICAgICAgICA8dS1pbnB1dCB2LW1vZGVsPVwiZm9ybS5hbW91bnRcIiB0eXBlPVwibnVtYmVyXCIgcGxhY2Vob2xkZXI9XCLov5jmrL7mgLvpop1cIiAvPlxuICAgICAgICA8L3UtZm9ybS1pdGVtPlxuICAgICAgICA8dS1mb3JtLWl0ZW0gbGFiZWw9XCLlhbbkuK3liKnmga9cIj5cbiAgICAgICAgICA8dS1pbnB1dCB2LW1vZGVsPVwiZm9ybS5pbnRlcmVzdEFtb3VudFwiIHR5cGU9XCJudW1iZXJcIiBwbGFjZWhvbGRlcj1cIuWIqeaBr+mDqOWIhlwiIC8+XG4gICAgICAgIDwvdS1mb3JtLWl0ZW0+XG4gICAgICAgIDx1LWZvcm0taXRlbSBsYWJlbD1cIuWFtuS4reacrOmHkVwiPlxuICAgICAgICAgIDx1LWlucHV0IHYtbW9kZWw9XCJmb3JtLnByaW5jaXBhbEFtb3VudFwiIHR5cGU9XCJudW1iZXJcIiBwbGFjZWhvbGRlcj1cIuacrOmHkemDqOWIhlwiIC8+XG4gICAgICAgIDwvdS1mb3JtLWl0ZW0+XG4gICAgICA8L3RlbXBsYXRlPlxuXG4gICAgICA8IS0tIFByZXBhaWQgQW1vcnRpemUgLS0+XG4gICAgICA8dGVtcGxhdGUgdi1pZj1cInR5cGUgPT09ICdwcmVwYWlkX2Ftb3J0aXplJ1wiPlxuICAgICAgICA8dS1mb3JtLWl0ZW0gbGFiZWw9XCLotLnnlKjnp5Hnm65cIj5cbiAgICAgICAgICA8dS1pbnB1dCB2LW1vZGVsPVwiZm9ybS5zdWJqZWN0TmFtZVwiIHR5cGU9XCJzZWxlY3RcIiBwbGFjZWhvbGRlcj1cIumAieaLqei0ueeUqOenkeebrlwiIEBjbGljaz1cInBpY2tTdWJqZWN0KCdleHBlbnNlJylcIiAvPlxuICAgICAgICA8L3UtZm9ybS1pdGVtPlxuICAgICAgICA8dS1mb3JtLWl0ZW0gbGFiZWw9XCLku5jmrL7otKbmiLdcIj5cbiAgICAgICAgICA8dS1pbnB1dCB2LW1vZGVsPVwiZm9ybS5hY2NvdW50TmFtZVwiIHR5cGU9XCJzZWxlY3RcIiBwbGFjZWhvbGRlcj1cIumAieaLqei0puaIt1wiIEBjbGljaz1cInBpY2tBY2NvdW50XCIgLz5cbiAgICAgICAgPC91LWZvcm0taXRlbT5cbiAgICAgICAgPHUtZm9ybS1pdGVtIGxhYmVsPVwi5LuY5qy+5oC76aKdXCI+XG4gICAgICAgICAgPHUtaW5wdXQgdi1tb2RlbD1cImZvcm0uYW1vdW50XCIgdHlwZT1cIm51bWJlclwiIHBsYWNlaG9sZGVyPVwi5pSv5LuY5oC76aKdXCIgLz5cbiAgICAgICAgPC91LWZvcm0taXRlbT5cbiAgICAgICAgPHUtZm9ybS1pdGVtIGxhYmVsPVwi5oq86YeRKOWPr+mAgClcIj5cbiAgICAgICAgICA8dS1pbnB1dCB2LW1vZGVsPVwiZm9ybS5kZXBvc2l0QW1vdW50XCIgdHlwZT1cIm51bWJlclwiIHBsYWNlaG9sZGVyPVwi5oq86YeR6YeR6aKdXCIgLz5cbiAgICAgICAgPC91LWZvcm0taXRlbT5cbiAgICAgICAgPHUtZm9ybS1pdGVtIGxhYmVsPVwi6aKE5LuY6YeR6aKdXCI+XG4gICAgICAgICAgPHUtaW5wdXQgdi1tb2RlbD1cImZvcm0ucHJlcGFpZEFtb3VudFwiIHR5cGU9XCJudW1iZXJcIiBwbGFjZWhvbGRlcj1cIuW+heaRiumHkeminVwiIC8+XG4gICAgICAgIDwvdS1mb3JtLWl0ZW0+XG4gICAgICA8L3RlbXBsYXRlPlxuXG4gICAgICA8IS0tIEFzc2V0IFB1cmNoYXNlIC0tPlxuICAgICAgPHRlbXBsYXRlIHYtaWY9XCJ0eXBlID09PSAnYXNzZXRfcHVyY2hhc2UnXCI+XG4gICAgICAgIDx1LWZvcm0taXRlbSBsYWJlbD1cIui1hOS6p+WIhuexu1wiPlxuICAgICAgICAgIDx1LWlucHV0IHYtbW9kZWw9XCJmb3JtLnN1YmplY3ROYW1lXCIgdHlwZT1cInNlbGVjdFwiIHBsYWNlaG9sZGVyPVwi6YCJ5oup6LWE5Lqn5YiG57G7XCIgQGNsaWNrPVwicGlja1N1YmplY3QoJ2Fzc2V0JylcIiAvPlxuICAgICAgICA8L3UtZm9ybS1pdGVtPlxuICAgICAgICA8dS1mb3JtLWl0ZW0gbGFiZWw9XCLotYTkuqflkI3np7BcIj5cbiAgICAgICAgICA8dS1pbnB1dCB2LW1vZGVsPVwiZm9ybS5sM1N1YmplY3ROYW1lXCIgcGxhY2Vob2xkZXI9XCLlpoLvvJrogZTmg7PnrJTorrDmnKxcIiAvPlxuICAgICAgICA8L3UtZm9ybS1pdGVtPlxuICAgICAgICA8dS1mb3JtLWl0ZW0gbGFiZWw9XCLku5jmrL7otKbmiLdcIj5cbiAgICAgICAgICA8dS1pbnB1dCB2LW1vZGVsPVwiZm9ybS5hY2NvdW50TmFtZVwiIHR5cGU9XCJzZWxlY3RcIiBwbGFjZWhvbGRlcj1cIumAieaLqei0puaIt1wiIEBjbGljaz1cInBpY2tBY2NvdW50XCIgLz5cbiAgICAgICAgPC91LWZvcm0taXRlbT5cbiAgICAgICAgPHUtZm9ybS1pdGVtIGxhYmVsPVwi6LSt5Lmw6YeR6aKdXCI+XG4gICAgICAgICAgPHUtaW5wdXQgdi1tb2RlbD1cImZvcm0uYW1vdW50XCIgdHlwZT1cIm51bWJlclwiIHBsYWNlaG9sZGVyPVwi6LSt5Lmw6YeR6aKdXCIgLz5cbiAgICAgICAgPC91LWZvcm0taXRlbT5cbiAgICAgICAgPHUtZm9ybS1pdGVtIGxhYmVsPVwi5oqY5pen5bm06ZmQXCI+XG4gICAgICAgICAgPHUtaW5wdXQgdi1tb2RlbD1cImZvcm0uZGVwcmVjaWF0aW9uTW9udGhzXCIgdHlwZT1cIm51bWJlclwiIHBsYWNlaG9sZGVyPVwi5L2/55So5pyI5pWwXCIgLz5cbiAgICAgICAgPC91LWZvcm0taXRlbT5cbiAgICAgICAgPHUtZm9ybS1pdGVtIGxhYmVsPVwi5q6L5YC8XCI+XG4gICAgICAgICAgPHUtaW5wdXQgdi1tb2RlbD1cImZvcm0ucmVzaWR1YWxWYWx1ZVwiIHR5cGU9XCJudW1iZXJcIiBwbGFjZWhvbGRlcj1cIumihOiuoeaui+WAvFwiIC8+XG4gICAgICAgIDwvdS1mb3JtLWl0ZW0+XG4gICAgICA8L3RlbXBsYXRlPlxuXG4gICAgICA8IS0tIENyZWRpdCBDYXJkIFNwZW5kIC0tPlxuICAgICAgPHRlbXBsYXRlIHYtaWY9XCJ0eXBlID09PSAnY3JlZGl0X2NhcmRfc3BlbmQnXCI+XG4gICAgICAgIDx1LWZvcm0taXRlbSBsYWJlbD1cIuaUr+WHuuWIhuexu1wiPlxuICAgICAgICAgIDx1LWlucHV0IHYtbW9kZWw9XCJmb3JtLnN1YmplY3ROYW1lXCIgdHlwZT1cInNlbGVjdFwiIHBsYWNlaG9sZGVyPVwi6YCJ5oup5pSv5Ye656eR55uuXCIgQGNsaWNrPVwicGlja1N1YmplY3QoJ2V4cGVuc2UnKVwiIC8+XG4gICAgICAgIDwvdS1mb3JtLWl0ZW0+XG4gICAgICAgIDx1LWZvcm0taXRlbSBsYWJlbD1cIuS/oeeUqOWNoVwiPlxuICAgICAgICAgIDx1LWlucHV0IHYtbW9kZWw9XCJmb3JtLmFjY291bnROYW1lXCIgdHlwZT1cInNlbGVjdFwiIHBsYWNlaG9sZGVyPVwi6YCJ5oup5L+h55So5Y2hXCIgQGNsaWNrPVwicGlja0FjY291bnQoJ2NyZWRpdF9jYXJkJylcIiAvPlxuICAgICAgICA8L3UtZm9ybS1pdGVtPlxuICAgICAgICA8dS1mb3JtLWl0ZW0gbGFiZWw9XCLph5Hpop1cIj5cbiAgICAgICAgICA8dS1pbnB1dCB2LW1vZGVsPVwiZm9ybS5hbW91bnRcIiB0eXBlPVwibnVtYmVyXCIgcGxhY2Vob2xkZXI9XCLmtojotLnph5Hpop1cIiAvPlxuICAgICAgICA8L3UtZm9ybS1pdGVtPlxuICAgICAgPC90ZW1wbGF0ZT5cblxuICAgICAgPCEtLSBDcmVkaXQgQ2FyZCBSZXBheSAtLT5cbiAgICAgIDx0ZW1wbGF0ZSB2LWlmPVwidHlwZSA9PT0gJ2NyZWRpdF9jYXJkX3JlcGF5J1wiPlxuICAgICAgICA8dS1mb3JtLWl0ZW0gbGFiZWw9XCLkv6HnlKjljaFcIj5cbiAgICAgICAgICA8dS1pbnB1dCB2LW1vZGVsPVwiZm9ybS5hY2NvdW50TmFtZVwiIHR5cGU9XCJzZWxlY3RcIiBwbGFjZWhvbGRlcj1cIumAieaLqeS/oeeUqOWNoVwiIEBjbGljaz1cInBpY2tBY2NvdW50KCdjcmVkaXRfY2FyZCcpXCIgLz5cbiAgICAgICAgPC91LWZvcm0taXRlbT5cbiAgICAgICAgPHUtZm9ybS1pdGVtIGxhYmVsPVwi6L+Y5qy+6LSm5oi3XCI+XG4gICAgICAgICAgPHUtaW5wdXQgdi1tb2RlbD1cImZvcm0udG9BY2NvdW50TmFtZVwiIHR5cGU9XCJzZWxlY3RcIiBwbGFjZWhvbGRlcj1cIumAieaLqeS7mOasvui0puaIt1wiIEBjbGljaz1cInBpY2tBY2NvdW50KClcIiAvPlxuICAgICAgICA8L3UtZm9ybS1pdGVtPlxuICAgICAgICA8dS1mb3JtLWl0ZW0gbGFiZWw9XCLov5jmrL7ph5Hpop1cIj5cbiAgICAgICAgICA8dS1pbnB1dCB2LW1vZGVsPVwiZm9ybS5hbW91bnRcIiB0eXBlPVwibnVtYmVyXCIgcGxhY2Vob2xkZXI9XCLov5jmrL7ph5Hpop1cIiAvPlxuICAgICAgICA8L3UtZm9ybS1pdGVtPlxuICAgICAgPC90ZW1wbGF0ZT5cblxuICAgICAgPCEtLSBWYWx1YXRpb24gQWRqdXN0IC0tPlxuICAgICAgPHRlbXBsYXRlIHYtaWY9XCJ0eXBlID09PSAndmFsdWF0aW9uX2FkanVzdCdcIj5cbiAgICAgICAgPHUtZm9ybS1pdGVtIGxhYmVsPVwi5oqV6LWE5ZOBXCI+XG4gICAgICAgICAgPHUtaW5wdXQgdi1tb2RlbD1cImZvcm0ubDNTdWJqZWN0TmFtZVwiIHR5cGU9XCJzZWxlY3RcIiBwbGFjZWhvbGRlcj1cIumAieaLqeaKlei1hOWTgVwiIEBjbGljaz1cInBpY2tMM1N1YmplY3QoJ2ludmVzdG1lbnQnKVwiIC8+XG4gICAgICAgIDwvdS1mb3JtLWl0ZW0+XG4gICAgICAgIDx1LWZvcm0taXRlbSBsYWJlbD1cIuWOn+WAvCjmiJDmnKwpXCI+XG4gICAgICAgICAgPHUtaW5wdXQgdi1tb2RlbD1cImZvcm0ub3JpZ2luYWxDb3N0XCIgdHlwZT1cIm51bWJlclwiIHBsYWNlaG9sZGVyPVwi5Lmw5YWl5oiQ5pysXCIgLz5cbiAgICAgICAgPC91LWZvcm0taXRlbT5cbiAgICAgICAgPHUtZm9ybS1pdGVtIGxhYmVsPVwi5pyA5paw5biC5YC8XCI+XG4gICAgICAgICAgPHUtaW5wdXQgdi1tb2RlbD1cImZvcm0ubWFya2V0VmFsdWVcIiB0eXBlPVwibnVtYmVyXCIgcGxhY2Vob2xkZXI9XCLlvZPliY3luILlgLxcIiAvPlxuICAgICAgICA8L3UtZm9ybS1pdGVtPlxuICAgICAgPC90ZW1wbGF0ZT5cblxuICAgICAgPCEtLSBMb2FuIFJlY2VpdmUgLS0+XG4gICAgICA8dGVtcGxhdGUgdi1pZj1cInR5cGUgPT09ICdsb2FuX3JlY2VpdmUnXCI+XG4gICAgICAgIDx1LWZvcm0taXRlbSBsYWJlbD1cIuWAn+asvuWIhuexu1wiPlxuICAgICAgICAgIDx1LWlucHV0IHYtbW9kZWw9XCJmb3JtLnN1YmplY3ROYW1lXCIgdHlwZT1cInNlbGVjdFwiIHBsYWNlaG9sZGVyPVwi6YCJ5oup6LSf5YC656eR55uuXCIgQGNsaWNrPVwicGlja1N1YmplY3QoJ2xpYWJpbGl0eScpXCIgLz5cbiAgICAgICAgPC91LWZvcm0taXRlbT5cbiAgICAgICAgPHUtZm9ybS1pdGVtIGxhYmVsPVwi5Yiw6LSm6LSm5oi3XCI+XG4gICAgICAgICAgPHUtaW5wdXQgdi1tb2RlbD1cImZvcm0uYWNjb3VudE5hbWVcIiB0eXBlPVwic2VsZWN0XCIgcGxhY2Vob2xkZXI9XCLpgInmi6nmlLbmrL7otKbmiLdcIiBAY2xpY2s9XCJwaWNrQWNjb3VudFwiIC8+XG4gICAgICAgIDwvdS1mb3JtLWl0ZW0+XG4gICAgICAgIDx1LWZvcm0taXRlbSBsYWJlbD1cIuWAn+asvumHkeminVwiPlxuICAgICAgICAgIDx1LWlucHV0IHYtbW9kZWw9XCJmb3JtLmFtb3VudFwiIHR5cGU9XCJudW1iZXJcIiBwbGFjZWhvbGRlcj1cIuWAn+asvumHkeminVwiIC8+XG4gICAgICAgIDwvdS1mb3JtLWl0ZW0+XG4gICAgICA8L3RlbXBsYXRlPlxuXG4gICAgICA8IS0tIEFzc2V0IERpc3Bvc2UgLS0+XG4gICAgICA8dGVtcGxhdGUgdi1pZj1cInR5cGUgPT09ICdhc3NldF9kaXNwb3NlJ1wiPlxuICAgICAgICA8dS1mb3JtLWl0ZW0gbGFiZWw9XCLotYTkuqdcIj5cbiAgICAgICAgICA8dS1pbnB1dCB2LW1vZGVsPVwiZm9ybS5sM1N1YmplY3ROYW1lXCIgdHlwZT1cInNlbGVjdFwiIHBsYWNlaG9sZGVyPVwi6YCJ5oup6LWE5LqnXCIgQGNsaWNrPVwicGlja0wzU3ViamVjdCgnZml4ZWRfYXNzZXQnKVwiIC8+XG4gICAgICAgIDwvdS1mb3JtLWl0ZW0+XG4gICAgICAgIDx1LWZvcm0taXRlbSBsYWJlbD1cIuWkhOe9ruaUtuWFpVwiPlxuICAgICAgICAgIDx1LWlucHV0IHYtbW9kZWw9XCJmb3JtLmRpc3Bvc2FsUHJvY2VlZHNcIiB0eXBlPVwibnVtYmVyXCIgcGxhY2Vob2xkZXI9XCLljZblh7ov5Zue5pS26YeR6aKdXCIgLz5cbiAgICAgICAgPC91LWZvcm0taXRlbT5cbiAgICAgICAgPHUtZm9ybS1pdGVtIGxhYmVsPVwi6LWE5Lqn5Y6f5YC8XCI+XG4gICAgICAgICAgPHUtaW5wdXQgdi1tb2RlbD1cImZvcm0uYW1vdW50XCIgdHlwZT1cIm51bWJlclwiIHBsYWNlaG9sZGVyPVwi6LWE5Lqn5Y6f5YC8XCIgLz5cbiAgICAgICAgPC91LWZvcm0taXRlbT5cbiAgICAgICAgPHUtZm9ybS1pdGVtIGxhYmVsPVwi5aSE572u5Y6f5ZugXCI+XG4gICAgICAgICAgPHUtaW5wdXQgdi1tb2RlbD1cImZvcm0uZGlzcG9zYWxSZWFzb25cIiBwbGFjZWhvbGRlcj1cIuWHuuWUri/miqXlup8v5YW25LuWXCIgLz5cbiAgICAgICAgPC91LWZvcm0taXRlbT5cbiAgICAgIDwvdGVtcGxhdGU+XG5cbiAgICAgIDwhLS0gTm90ZXMgKGNvbW1vbikgLS0+XG4gICAgICA8dS1mb3JtLWl0ZW0gbGFiZWw9XCLlpIfms6hcIj5cbiAgICAgICAgPHUtaW5wdXQgdi1tb2RlbD1cImZvcm0ubm90ZVwiIHR5cGU9XCJ0ZXh0XCIgcGxhY2Vob2xkZXI9XCLpgInloatcIiAvPlxuICAgICAgPC91LWZvcm0taXRlbT5cbiAgICA8L3UtZm9ybT5cblxuICAgIDx2aWV3IGNsYXNzPVwiYnRuLWJhclwiPlxuICAgICAgPHUtYnV0dG9uIHR5cGU9XCJwcmltYXJ5XCIgQGNsaWNrPVwic2F2ZVwiIDpsb2FkaW5nPVwic2F2aW5nXCI+5L+d5a2YPC91LWJ1dHRvbj5cbiAgICA8L3ZpZXc+XG4gIDwvdmlldz5cbjwvdGVtcGxhdGU+XG5cbjxzY3JpcHQgc2V0dXAgbGFuZz1cInRzXCI+XG5pbXBvcnQgeyByZWYsIGNvbXB1dGVkIH0gZnJvbSAndnVlJ1xuaW1wb3J0IHsgb25Mb2FkIH0gZnJvbSAnQGRjbG91ZGlvL3VuaS1hcHAnXG5pbXBvcnQgeyB1c2VTdWJqZWN0U3RvcmUgfSBmcm9tICdAL3N0b3Jlcy9zdWJqZWN0cydcbmltcG9ydCB7IHVzZUFjY291bnRTdG9yZSB9IGZyb20gJ0Avc3RvcmVzL2FjY291bnRzJ1xuaW1wb3J0IHsgdXNlVHJhbnNhY3Rpb25TdG9yZSB9IGZyb20gJ0Avc3RvcmVzL3RyYW5zYWN0aW9ucydcbmltcG9ydCB7IGdldERhdGFiYXNlIH0gZnJvbSAnQC9kYXRhYmFzZS9mYWN0b3J5J1xuaW1wb3J0IHsgVHJhbnNhY3Rpb25SZXBvc2l0b3J5IH0gZnJvbSAnQC9yZXBvc2l0b3JpZXMvdHJhbnNhY3Rpb24tcmVwbydcblxuY29uc3Qgc3ViamVjdFN0b3JlID0gdXNlU3ViamVjdFN0b3JlKClcbmNvbnN0IGFjY291bnRTdG9yZSA9IHVzZUFjY291bnRTdG9yZSgpXG5jb25zdCB0eFN0b3JlID0gdXNlVHJhbnNhY3Rpb25TdG9yZSgpXG5cbmNvbnN0IHNhdmluZyA9IHJlZihmYWxzZSlcbmNvbnN0IHR5cGUgPSByZWYoJ2V4cGVuc2UnKVxuY29uc3QgZWRpdElkID0gcmVmKDApXG5jb25zdCBpc0VkaXQgPSBjb21wdXRlZCgoKSA9PiBlZGl0SWQudmFsdWUgPiAwKVxuXG5jb25zdCB0eFR5cGVOYW1lczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgaW5jb21lOiAn5pS25YWlJywgZXhwZW5zZTogJ+aUr+WHuicsIHRyYW5zZmVyOiAn6L2s6LSmJyxcbiAgc2FsYXJ5OiAn5Y+R5bel6LWEJywgaW52ZXN0bWVudF9idXk6ICfmipXotYTkubDlhaUnLCBpbnZlc3RtZW50X3NlbGw6ICfmipXotYTljZblh7onLFxuICB2YWx1YXRpb25fYWRqdXN0OiAn5Lyw5YC86LCD5pW0JywgbG9hbl9yZWNlaXZlOiAn5YCf5qy+JywgbG9hbl9yZXBheTogJ+i/mOasvicsXG4gIHByZXBhaWRfYW1vcnRpemU6ICfpooTku5jmkYrmj5AnLCBhc3NldF9wdXJjaGFzZTogJ+i0ree9ruWbuuWumui1hOS6pycsXG4gIGFzc2V0X2Rpc3Bvc2U6ICfotYTkuqflpITnva4nLCBjcmVkaXRfY2FyZF9zcGVuZDogJ+S/oeeUqOWNoea2iOi0uScsXG4gIGNyZWRpdF9jYXJkX3JlcGF5OiAn5L+h55So5Y2h6L+Y5qy+Jyxcbn1cblxuY29uc3QgZm9ybU5hbWUgPSBjb21wdXRlZCgoKSA9PiB0eFR5cGVOYW1lc1t0eXBlLnZhbHVlXSB8fCB0eXBlLnZhbHVlKVxuXG5jb25zdCBmb3JtID0gcmVmKHtcbiAgdHhEYXRlOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwgMTApLFxuICBhbW91bnQ6ICcnLFxuICBzdWJqZWN0SWQ6IDAgYXMgbnVtYmVyLFxuICBzdWJqZWN0TmFtZTogJycsXG4gIGwzU3ViamVjdElkOiBudWxsIGFzIG51bWJlciB8IG51bGwsXG4gIGwzU3ViamVjdE5hbWU6ICcnLFxuICBhY2NvdW50SWQ6IG51bGwgYXMgbnVtYmVyIHwgbnVsbCxcbiAgYWNjb3VudE5hbWU6ICcnLFxuICB0b0FjY291bnRJZDogbnVsbCBhcyBudW1iZXIgfCBudWxsLFxuICB0b0FjY291bnROYW1lOiAnJyxcbiAgbm90ZTogJycsXG4gIC8vIFR5cGUtc3BlY2lmaWNcbiAgZ3Jvc3NBbW91bnQ6ICcnLFxuICB0YXhBbW91bnQ6ICcnLFxuICBzb2NpYWxBbW91bnQ6ICcnLFxuICBxdWFudGl0eTogJycsXG4gIHVuaXRQcmljZTogJycsXG4gIGludGVyZXN0QW1vdW50OiAnJyxcbiAgcHJpbmNpcGFsQW1vdW50OiAnJyxcbiAgb3JpZ2luYWxDb3N0OiAnJyxcbiAgbWFya2V0VmFsdWU6ICcnLFxuICBkZXByZWNpYXRpb25Nb250aHM6ICcnLFxuICByZXNpZHVhbFZhbHVlOiAnJyxcbiAgZGVwb3NpdEFtb3VudDogJycsXG4gIHByZXBhaWRBbW91bnQ6ICcnLFxuICBkaXNwb3NhbFByb2NlZWRzOiAnJyxcbiAgZGlzcG9zYWxSZWFzb246ICcnLFxufSlcblxub25Mb2FkKGFzeW5jIChvcHQpID0+IHtcbiAgaWYgKG9wdD8udHlwZSkgdHlwZS52YWx1ZSA9IG9wdC50eXBlXG4gIGlmIChvcHQ/LmlkKSB7XG4gICAgZWRpdElkLnZhbHVlID0gTnVtYmVyKG9wdC5pZClcbiAgICBjb25zdCBkYiA9IGF3YWl0IGdldERhdGFiYXNlKClcbiAgICBjb25zdCByZXBvID0gbmV3IFRyYW5zYWN0aW9uUmVwb3NpdG9yeShkYilcbiAgICBjb25zdCB0eCA9IGF3YWl0IHJlcG8uZmluZEJ5SWQoZWRpdElkLnZhbHVlKVxuICAgIGlmICh0eCkge1xuICAgICAgZm9ybS52YWx1ZS50eERhdGUgPSB0eC50eERhdGVcbiAgICAgIGZvcm0udmFsdWUuYW1vdW50ID0gU3RyaW5nKHR4LmFtb3VudClcbiAgICAgIGZvcm0udmFsdWUuc3ViamVjdElkID0gdHguc3ViamVjdElkXG4gICAgICBmb3JtLnZhbHVlLmwzU3ViamVjdElkID0gdHgubDNTdWJqZWN0SWRcbiAgICAgIGZvcm0udmFsdWUuYWNjb3VudElkID0gdHguYWNjb3VudElkXG4gICAgICBmb3JtLnZhbHVlLnRvQWNjb3VudElkID0gdHgudG9BY2NvdW50SWRcbiAgICAgIGZvcm0udmFsdWUubm90ZSA9IHR4Lm5vdGUgfHwgJydcbiAgICAgIGNvbnN0IHN1YiA9IHN1YmplY3RTdG9yZS5nZXRCeUlkKHR4LnN1YmplY3RJZClcbiAgICAgIGZvcm0udmFsdWUuc3ViamVjdE5hbWUgPSBzdWIgPyBgJHtzdWIuY29kZX0gJHtzdWIubmFtZX1gIDogJydcbiAgICAgIGNvbnN0IGFjYyA9IGFjY291bnRTdG9yZS5nZXRCeUlkKHR4LmFjY291bnRJZCB8fCAwKVxuICAgICAgZm9ybS52YWx1ZS5hY2NvdW50TmFtZSA9IGFjYyA/IGAke2FjYy5uYW1lfWAgOiAnJ1xuICAgICAgY29uc3QgdG9BY2MgPSBhY2NvdW50U3RvcmUuZ2V0QnlJZCh0eC50b0FjY291bnRJZCB8fCAwKVxuICAgICAgZm9ybS52YWx1ZS50b0FjY291bnROYW1lID0gdG9BY2MgPyBgJHt0b0FjYy5uYW1lfWAgOiAnJ1xuICAgIH1cbiAgfVxufSlcblxuZnVuY3Rpb24gcGlja1N1YmplY3QoZmlsdGVyPzogc3RyaW5nKSB7XG4gIGNvbnN0IGl0ZW1zID0gc3ViamVjdFN0b3JlLnN1YmplY3RzXG4gICAgLmZpbHRlcihzID0+IHMubGV2ZWwgPT09IDIgJiYgKCFmaWx0ZXIgfHwgcy5zdWJqZWN0VHlwZSA9PT0gZmlsdGVyKSlcbiAgICAubWFwKHMgPT4gKHsgbGFiZWw6IGAke3MuY29kZX0gJHtzLm5hbWV9YCwgdmFsdWU6IHMuaWQgfSkpXG5cbiAgdW5pLnNob3dBY3Rpb25TaGVldCh7XG4gICAgaXRlbUxpc3Q6IGl0ZW1zLm1hcChpID0+IGkubGFiZWwpLFxuICAgIHN1Y2Nlc3M6IChyZXMpID0+IHtcbiAgICAgIGlmIChyZXMudGFwSW5kZXggPj0gMCkge1xuICAgICAgICBjb25zdCBpdGVtID0gaXRlbXNbcmVzLnRhcEluZGV4XVxuICAgICAgICBmb3JtLnZhbHVlLnN1YmplY3RJZCA9IGl0ZW0udmFsdWVcbiAgICAgICAgZm9ybS52YWx1ZS5zdWJqZWN0TmFtZSA9IGl0ZW0ubGFiZWxcbiAgICAgIH1cbiAgICB9XG4gIH0pXG59XG5cbmZ1bmN0aW9uIHBpY2tMM1N1YmplY3QoZmlsdGVyPzogc3RyaW5nKSB7XG4gIGNvbnN0IGl0ZW1zID0gYWNjb3VudFN0b3JlLmFjY291bnRzXG4gICAgLmZpbHRlcihhID0+ICFmaWx0ZXIgfHwgYS5hY2NvdW50VHlwZSA9PT0gZmlsdGVyKVxuICAgIC5tYXAoYSA9PiAoeyBsYWJlbDogYCR7YS5uYW1lfWAsIHZhbHVlOiBhLmlkIH0pKVxuXG4gIHVuaS5zaG93QWN0aW9uU2hlZXQoe1xuICAgIGl0ZW1MaXN0OiBpdGVtcy5tYXAoaSA9PiBpLmxhYmVsKSxcbiAgICBzdWNjZXNzOiAocmVzKSA9PiB7XG4gICAgICBpZiAocmVzLnRhcEluZGV4ID49IDApIHtcbiAgICAgICAgY29uc3QgaXRlbSA9IGl0ZW1zW3Jlcy50YXBJbmRleF1cbiAgICAgICAgZm9ybS52YWx1ZS5sM1N1YmplY3RJZCA9IGl0ZW0udmFsdWVcbiAgICAgICAgZm9ybS52YWx1ZS5sM1N1YmplY3ROYW1lID0gaXRlbS5sYWJlbFxuICAgICAgfVxuICAgIH1cbiAgfSlcbn1cblxuZnVuY3Rpb24gcGlja0FjY291bnQodHlwZUZpbHRlcj86IHN0cmluZykge1xuICBjb25zdCBpdGVtcyA9IGFjY291bnRTdG9yZS5hY2NvdW50c1xuICAgIC5maWx0ZXIoYSA9PiAhdHlwZUZpbHRlciB8fCBhLmFjY291bnRUeXBlID09PSB0eXBlRmlsdGVyKVxuICAgIC5tYXAoYSA9PiAoeyBsYWJlbDogYCR7YS5uYW1lfSAgJHthLmJhbGFuY2UgPyAnwqUnICsgYS5iYWxhbmNlLnRvRml4ZWQoMikgOiAnJ31gLCB2YWx1ZTogYS5pZCB9KSlcblxuICB1bmkuc2hvd0FjdGlvblNoZWV0KHtcbiAgICBpdGVtTGlzdDogaXRlbXMubWFwKGkgPT4gaS5sYWJlbCksXG4gICAgc3VjY2VzczogKHJlcykgPT4ge1xuICAgICAgaWYgKHJlcy50YXBJbmRleCA+PSAwKSB7XG4gICAgICAgIGNvbnN0IGl0ZW0gPSBpdGVtc1tyZXMudGFwSW5kZXhdXG4gICAgICAgIGlmICghZm9ybS52YWx1ZS5hY2NvdW50SWQpIHtcbiAgICAgICAgICBmb3JtLnZhbHVlLmFjY291bnRJZCA9IGl0ZW0udmFsdWVcbiAgICAgICAgICBmb3JtLnZhbHVlLmFjY291bnROYW1lID0gaXRlbS5sYWJlbFxuICAgICAgICB9IGVsc2UgaWYgKCFmb3JtLnZhbHVlLnRvQWNjb3VudElkICYmIGZvcm0udmFsdWUuYWNjb3VudElkICE9PSBpdGVtLnZhbHVlKSB7XG4gICAgICAgICAgZm9ybS52YWx1ZS50b0FjY291bnRJZCA9IGl0ZW0udmFsdWVcbiAgICAgICAgICBmb3JtLnZhbHVlLnRvQWNjb3VudE5hbWUgPSBpdGVtLmxhYmVsXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZm9ybS52YWx1ZS5hY2NvdW50SWQgPSBpdGVtLnZhbHVlXG4gICAgICAgICAgZm9ybS52YWx1ZS5hY2NvdW50TmFtZSA9IGl0ZW0ubGFiZWxcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSlcbn1cblxuZnVuY3Rpb24gcGlja1RvQWNjb3VudCgpIHtcbiAgY29uc3QgaXRlbXMgPSBhY2NvdW50U3RvcmUuYWNjb3VudHNcbiAgICAuZmlsdGVyKGEgPT4gYS5pZCAhPT0gZm9ybS52YWx1ZS5hY2NvdW50SWQpXG4gICAgLm1hcChhID0+ICh7IGxhYmVsOiBgJHthLm5hbWV9YCwgdmFsdWU6IGEuaWQgfSkpXG5cbiAgdW5pLnNob3dBY3Rpb25TaGVldCh7XG4gICAgaXRlbUxpc3Q6IGl0ZW1zLm1hcChpID0+IGkubGFiZWwpLFxuICAgIHN1Y2Nlc3M6IChyZXMpID0+IHtcbiAgICAgIGlmIChyZXMudGFwSW5kZXggPj0gMCkge1xuICAgICAgICBjb25zdCBpdGVtID0gaXRlbXNbcmVzLnRhcEluZGV4XVxuICAgICAgICBmb3JtLnZhbHVlLnRvQWNjb3VudElkID0gaXRlbS52YWx1ZVxuICAgICAgICBmb3JtLnZhbHVlLnRvQWNjb3VudE5hbWUgPSBpdGVtLmxhYmVsXG4gICAgICB9XG4gICAgfVxuICB9KVxufVxuXG5hc3luYyBmdW5jdGlvbiBzYXZlKCkge1xuICBzYXZpbmcudmFsdWUgPSB0cnVlXG4gIHRyeSB7XG4gICAgY29uc3QgcGF5bG9hZDogYW55ID0ge1xuICAgICAgdHhUeXBlOiB0eXBlLnZhbHVlLFxuICAgICAgdHhEYXRlOiBmb3JtLnZhbHVlLnR4RGF0ZSxcbiAgICAgIGFtb3VudDogcGFyc2VGbG9hdChmb3JtLnZhbHVlLmFtb3VudCkgfHwgMCxcbiAgICAgIHN1YmplY3RJZDogZm9ybS52YWx1ZS5zdWJqZWN0SWQgfHwgc3ViamVjdFN0b3JlLnN1YmplY3RzLmZpbmQocyA9PiBzLnN1YmplY3RUeXBlID09PSAnZXhwZW5zZScgJiYgcy5sZXZlbCA9PT0gMik/LmlkIHx8IDAsXG4gICAgICBsM1N1YmplY3RJZDogZm9ybS52YWx1ZS5sM1N1YmplY3RJZCxcbiAgICAgIGFjY291bnRJZDogZm9ybS52YWx1ZS5hY2NvdW50SWQsXG4gICAgICB0b0FjY291bnRJZDogZm9ybS52YWx1ZS50b0FjY291bnRJZCxcbiAgICAgIG5vdGU6IGZvcm0udmFsdWUubm90ZSB8fCBudWxsLFxuICAgICAgZ3Jvc3NBbW91bnQ6IGZvcm0udmFsdWUuZ3Jvc3NBbW91bnQgPyBwYXJzZUZsb2F0KGZvcm0udmFsdWUuZ3Jvc3NBbW91bnQpIDogdW5kZWZpbmVkLFxuICAgICAgdGF4QW1vdW50OiBmb3JtLnZhbHVlLnRheEFtb3VudCA/IHBhcnNlRmxvYXQoZm9ybS52YWx1ZS50YXhBbW91bnQpIDogdW5kZWZpbmVkLFxuICAgICAgc29jaWFsQW1vdW50OiBmb3JtLnZhbHVlLnNvY2lhbEFtb3VudCA/IHBhcnNlRmxvYXQoZm9ybS52YWx1ZS5zb2NpYWxBbW91bnQpIDogdW5kZWZpbmVkLFxuICAgICAgcXVhbnRpdHk6IGZvcm0udmFsdWUucXVhbnRpdHkgPyBwYXJzZUZsb2F0KGZvcm0udmFsdWUucXVhbnRpdHkpIDogdW5kZWZpbmVkLFxuICAgICAgdW5pdFByaWNlOiBmb3JtLnZhbHVlLnVuaXRQcmljZSA/IHBhcnNlRmxvYXQoZm9ybS52YWx1ZS51bml0UHJpY2UpIDogdW5kZWZpbmVkLFxuICAgICAgaW50ZXJlc3RBbW91bnQ6IGZvcm0udmFsdWUuaW50ZXJlc3RBbW91bnQgPyBwYXJzZUZsb2F0KGZvcm0udmFsdWUuaW50ZXJlc3RBbW91bnQpIDogdW5kZWZpbmVkLFxuICAgICAgcHJpbmNpcGFsQW1vdW50OiBmb3JtLnZhbHVlLnByaW5jaXBhbEFtb3VudCA/IHBhcnNlRmxvYXQoZm9ybS52YWx1ZS5wcmluY2lwYWxBbW91bnQpIDogdW5kZWZpbmVkLFxuICAgICAgZGVwb3NpdEFtb3VudDogZm9ybS52YWx1ZS5kZXBvc2l0QW1vdW50ID8gcGFyc2VGbG9hdChmb3JtLnZhbHVlLmRlcG9zaXRBbW91bnQpIDogdW5kZWZpbmVkLFxuICAgICAgcHJlcGFpZEFtb3VudDogZm9ybS52YWx1ZS5wcmVwYWlkQW1vdW50ID8gcGFyc2VGbG9hdChmb3JtLnZhbHVlLnByZXBhaWRBbW91bnQpIDogdW5kZWZpbmVkLFxuICAgICAgZGVwcmVjaWF0aW9uTW9udGhzOiBmb3JtLnZhbHVlLmRlcHJlY2lhdGlvbk1vbnRocyA/IHBhcnNlSW50KGZvcm0udmFsdWUuZGVwcmVjaWF0aW9uTW9udGhzKSA6IHVuZGVmaW5lZCxcbiAgICAgIHJlc2lkdWFsVmFsdWU6IGZvcm0udmFsdWUucmVzaWR1YWxWYWx1ZSA/IHBhcnNlRmxvYXQoZm9ybS52YWx1ZS5yZXNpZHVhbFZhbHVlKSA6IHVuZGVmaW5lZCxcbiAgICB9XG4gICAgaWYgKGlzRWRpdC52YWx1ZSkge1xuICAgICAgYXdhaXQgdHhTdG9yZS51cGRhdGVUeChlZGl0SWQudmFsdWUsIHBheWxvYWQpXG4gICAgfSBlbHNlIHtcbiAgICAgIGF3YWl0IHR4U3RvcmUuY3JlYXRlKHBheWxvYWQpXG4gICAgfVxuICAgIHVuaS5zaG93VG9hc3QoeyB0aXRsZTogaXNFZGl0LnZhbHVlID8gJ+S/ruaUueaIkOWKnycgOiAn5L+d5a2Y5oiQ5YqfJywgaWNvbjogJ3N1Y2Nlc3MnIH0pXG4gICAgc2V0VGltZW91dCgoKSA9PiB1bmkubmF2aWdhdGVCYWNrKCksIDEwMDApXG4gIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgIHVuaS5zaG93VG9hc3QoeyB0aXRsZTogJ+S/neWtmOWksei0pTogJyArIChlLm1lc3NhZ2UgfHwgZSksIGljb246ICdub25lJyB9KVxuICB9IGZpbmFsbHkge1xuICAgIHNhdmluZy52YWx1ZSA9IGZhbHNlXG4gIH1cbn1cbjwvc2NyaXB0PlxuXG48c3R5bGUgbGFuZz1cInNjc3NcIiBzY29wZWQ+XG4ucGFnZS1hZGQgeyBwYWRkaW5nOiAyMHJweDsgfVxuLmJ0bi1iYXIgeyBtYXJnaW4tdG9wOiA0MHJweDsgcGFkZGluZy1ib3R0b206IDQwcnB4OyB9XG48L3N0eWxlPlxuIl19