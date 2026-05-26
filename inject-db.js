const fs = require('fs');
let html = fs.readFileSync('d:/accounting app/design-preview.html', 'utf8');

const dbScript = `
<script>
(async function() {
  if (!window.electronDB) return;
  try {
    const db = window.electronDB;
    const subjects = await db.query('SELECT id, name FROM accounting_subjects');
    const txns = await db.query(
      "SELECT t.*, s.name as subjectName, a1.name as accountName FROM transactions t LEFT JOIN accounting_subjects s ON t.subject_id = s.id LEFT JOIN accounts a1 ON t.account_id = a1.id WHERE t.is_deleted = 0 ORDER BY t.tx_date DESC LIMIT 10"
    );
    const totalIncome = txns.filter(t => ['income','salary','investment_sell'].includes(t.txType)).reduce((s,t) => s + t.amount, 0);
    const totalExpense = txns.filter(t => ['expense','loan_repay','credit_card_spend','prepaid_amortize','asset_purchase'].includes(t.txType)).reduce((s,t) => s + t.amount, 0);

    document.querySelector('.hero-amount').textContent = (286420 + totalIncome - totalExpense).toFixed(2);
    document.querySelector('.flow-amount.income').textContent = '¥' + totalIncome.toFixed(2);
    document.querySelector('.flow-amount.expense').textContent = '¥' + totalExpense.toFixed(2);

    if (txns.length > 0) {
      const rows = txns.map(tx => {
        const isExp = ['expense','loan_repay','credit_card_spend'].includes(tx.txType);
        return '<div class="tx-row"><div class="tx-row-left"><div class="tx-subject-line"><span class="tx-dot '+(isExp?'expense':'income')+'">'+(isExp?'支':'收')+'</span><span class="tx-subject">'+(tx.subjectName||'#')+'</span></div><div class="tx-meta">'+(tx.accountName||'')+(tx.note?' · '+tx.note:'')+'</div></div><span class="tx-amount '+(isExp?'expense':'income')+'">'+(isExp?'−':'+')+'¥'+Math.abs(tx.amount).toFixed(2)+'</span></div>';
      }).join('');
      document.querySelector('.tx-section').innerHTML = '<div class="tx-header"><span class="tx-header-title">最近交易</span></div>' + rows;
    }
  } catch(e) { console.error(e); }
})();
<\/script>
`;

html = html.replace('</body>', dbScript + '</body>');
fs.writeFileSync('d:/accounting app/dist/design-app.html', html);
console.log('Created design-app.html, size:', html.length);
