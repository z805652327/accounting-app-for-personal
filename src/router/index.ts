import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/pages/index/index',
    },
    {
      path: '/pages/index/index',
      name: 'home',
      component: () => import('@/pages/index/index.vue'),
      meta: { tab: 0 },
    },
    {
      path: '/pages/accounts/index',
      name: 'accounts',
      component: () => import('@/pages/accounts/index.vue'),
      meta: { tab: 1 },
    },
    {
      path: '/pages/accounts/detail',
      name: 'account-detail',
      component: () => import('@/pages/accounts/detail.vue'),
    },
    {
      path: '/pages/reports/index',
      name: 'reports',
      component: () => import('@/pages/reports/index.vue'),
      meta: { tab: 2 },
    },
    {
      path: '/pages/reports/balance-sheet',
      name: 'balance-sheet',
      component: () => import('@/pages/reports/balance-sheet.vue'),
    },
    {
      path: '/pages/reports/income-statement',
      name: 'income-statement',
      component: () => import('@/pages/reports/income-statement.vue'),
    },
    {
      path: '/pages/reports/cash-flow',
      name: 'cash-flow',
      component: () => import('@/pages/reports/cash-flow.vue'),
    },
    {
      path: '/pages/reports/subject-balance',
      name: 'subject-balance',
      component: () => import('@/pages/reports/subject-balance.vue'),
    },
    {
      path: '/pages/reports/subject-detail',
      name: 'subject-detail',
      component: () => import('@/pages/reports/subject-detail.vue'),
    },
    {
      path: '/pages/reports/expense-analysis',
      name: 'expense-analysis',
      component: () => import('@/pages/reports/expense-analysis.vue'),
    },
    {
      path: '/pages/reports/expense-ranking',
      name: 'expense-ranking',
      component: () => import('@/pages/reports/expense-ranking.vue'),
    },
    {
      path: '/pages/reports/budget-report',
      name: 'budget-report',
      component: () => import('@/pages/reports/budget-report.vue'),
    },
    {
      path: '/pages/reports/auxiliary',
      name: 'auxiliary',
      component: () => import('@/pages/reports/auxiliary.vue'),
    },
    {
      path: '/pages/transactions/add',
      name: 'tx-add',
      component: () => import('@/pages/transactions/add.vue'),
    },
    {
      path: '/pages/transactions/detail',
      name: 'tx-detail',
      component: () => import('@/pages/transactions/detail.vue'),
    },
    {
      path: '/pages/transactions/search',
      name: 'tx-search',
      component: () => import('@/pages/transactions/search.vue'),
    },
    {
      path: '/pages/settings/index',
      name: 'settings',
      component: () => import('@/pages/settings/index.vue'),
      meta: { tab: 3 },
    },
    {
      path: '/pages/settings/subjects',
      name: 'subjects',
      component: () => import('@/pages/settings/subjects.vue'),
    },
    {
      path: '/pages/settings/depreciation',
      name: 'depreciation',
      component: () => import('@/pages/settings/depreciation.vue'),
    },
    {
      path: '/pages/settings/amortization',
      name: 'amortization',
      component: () => import('@/pages/settings/amortization.vue'),
    },
    {
      path: '/pages/settings/budget',
      name: 'budget',
      component: () => import('@/pages/settings/budget.vue'),
    },
    {
      path: '/pages/settings/export',
      name: 'export',
      component: () => import('@/pages/settings/export.vue'),
    },
    {
      path: '/pages/settings/import',
      name: 'import',
      component: () => import('@/pages/settings/import.vue'),
    },
    {
      path: '/pages/settings/recurring',
      name: 'recurring',
      component: () => import('@/pages/settings/recurring.vue'),
    },
    {
      path: '/pages/settings/tags',
      name: 'tags',
      component: () => import('@/pages/settings/tags.vue'),
    },
    {
      path: '/pages/settings/recently-deleted',
      name: 'recently-deleted',
      component: () => import('@/pages/settings/recently-deleted.vue'),
    },
    {
      path: '/pages/settings/indicators',
      name: 'indicators',
      component: () => import('@/pages/settings/indicators.vue'),
    },
    {
      path: '/pages/settings/saved-reports',
      name: 'saved-reports',
      component: () => import('@/pages/settings/saved-reports.vue'),
    },
    {
      path: '/pages/settings/reconciliation',
      name: 'reconciliation',
      component: () => import('@/pages/settings/reconciliation.vue'),
    },
    {
      path: '/pages/settings/year-end-close',
      name: 'year-end-close',
      component: () => import('@/pages/settings/year-end-close.vue'),
    },
    {
      path: '/pages/settings/edit-history',
      name: 'edit-history',
      component: () => import('@/pages/settings/edit-history.vue'),
    },
    {
      path: '/pages/settings/security',
      name: 'security',
      component: () => import('@/pages/settings/security.vue'),
    },
    {
      path: '/pages/pending/index',
      name: 'pending',
      component: () => import('@/pages/pending/index.vue'),
    },
    {
      path: '/pages/setup/index',
      name: 'setup',
      component: () => import('@/pages/setup/index.vue'),
    },
  ],
})

export default router
