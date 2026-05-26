const fs = require('fs');

const dp = fs.readFileSync('design-preview.html', 'utf8');
const dpCss = dp.match(/<style>([\s\S]*)<\/style>/)[1];

// Build hero HTML from design preview
const heroHtml = dp.match(/<div class="hero">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/)[0]
  .replace(/<div class="tx-row">[\s\S]*?最近交易[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*$/, '');

const ACCT_TYPES = { cash:'现金', checking:'活期', fixed_deposit:'定期', money_market:'货基',
  receivable:'应收', investment:'投资', fixed_asset:'固产', prepaid:'待摊', deposit:'押金',
  credit_card:'信用卡', payable:'应付', loan:'借款' };

const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0"><title>精账簿</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,400;0,500;1,400&family=Noto+Serif+SC:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--ink:#1C1915;--paper:#F2EFE9;--surface:#FDFCF9;--accent:#C44536;--income:#2D7D7A;--income-bg:#EDF6F5;--expense-bg:#FDF4F2;--text:#1C1915;--text2:#6B6560;--text3:#9E9790;--border:#E0DBD3;--border-light:#EDE8E0}
body{font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;background:var(--paper);color:var(--text);-webkit-font-smoothing:antialiased;display:flex;justify-content:center;padding:24px 0}
.app{width:390px;min-height:100vh;padding:0 16px 80px}
${dpCss}
.page{display:none}.page.active{display:block}
/* Account cards */
.acct-card{background:var(--surface);border-radius:12px;padding:20px 22px;margin-bottom:10px;border:1px solid var(--border-light);box-shadow:0 1px 4px rgba(28,25,21,0.04)}
.acct-card-hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.acct-card-name{font-size:17px;font-weight:600}
.acct-card-type{font-size:12px;color:#fff;background:var(--text2);padding:2px 10px;border-radius:10px}
.acct-card-type.cc{background:var(--accent)}.acct-card-type.loan{background:#E8A838}
.acct-card-meta{font-size:12px;color:var(--text3);margin-bottom:2px}
.acct-card-bal{font-family:'DM Mono',monospace;font-size:22px;font-weight:500;margin-top:4px}
.acct-card-bal.pos{color:var(--income)}.acct-card-bal.neg{color:var(--accent)}
/* Report cards */
.rpt-card{background:var(--surface);border-radius:12px;padding:22px;margin-bottom:10px;border:1px solid var(--border-light);box-shadow:0 1px 4px rgba(28,25,21,0.04);display:flex;justify-content:space-between;align-items:center;cursor:pointer;transition:transform 0.15s}
.rpt-card:active{transform:scale(0.98)}
.rpt-card-name{font-size:16px;font-weight:600}
.rpt-card-desc{font-size:12px;color:var(--text3);margin-top:3px}
.rpt-card-arrow{font-size:18px;color:var(--text3)}
/* Settings */
.set-item{background:var(--surface);border-radius:12px;padding:20px 22px;margin-bottom:8px;border:1px solid var(--border-light);display:flex;justify-content:space-between;align-items:center;font-size:15px;cursor:pointer;transition:transform 0.15s}
.set-item:active{transform:scale(0.98)}
.set-item-arrow{color:var(--text3);font-size:16px}
/* Transaction rows (used in dashboard) */
.tx-row{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #EDE8E0}
.tx-row:last-child{border-bottom:none}
.tx-dot{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;font-size:12px;font-weight:600;flex-shrink:0}
.tx-dot.ex{background:var(--expense-bg);color:var(--accent)}
.tx-dot.in{background:var(--income-bg);color:var(--income)}
.tx-sub{font-size:15px;font-weight:500}
.tx-meta{font-size:12px;color:var(--text3);margin-left:32px}
.tx-amt{font-family:'DM Mono',monospace;font-size:16px;font-weight:500}
.tx-amt.ex{color:var(--accent)}.tx-amt.in{color:var(--income)}
.section-label{font-size:13px;color:var(--text3);padding:10px 4px 6px;text-transform:uppercase;letter-spacing:0.05em}
</style></head><body><div class="app">

<!-- Page 0: Dashboard -->
<div id="p0" class="page active"></div>

<!-- Page 1: Accounts -->
<div id="p1" class="page"><div class="section-label">资产账户</div><div id="asset-accts"></div><div class="section-label">负债账户</div><div id="liability-accts"></div></div>

<!-- Page 2: Reports -->
<div id="p2" class="page">
<div class="section-label">财务报表</div>
<div class="rpt-card" onclick="alert('请在完整版App中查看')"><div><div class="rpt-card-name">资产负债表</div><div class="rpt-card-desc">期末资产、负债、净资产状况</div></div><span class="rpt-card-arrow">›</span></div>
<div class="rpt-card"><div><div class="rpt-card-name">利润表</div><div class="rpt-card-desc">月度收入、支出、结余</div></div><span class="rpt-card-arrow">›</span></div>
<div class="rpt-card"><div><div class="rpt-card-name">现金流量表</div><div class="rpt-card-desc">经营/投资/筹资现金流</div></div><span class="rpt-card-arrow">›</span></div>
<div class="section-label">辅助报表</div>
<div class="rpt-card"><div><div class="rpt-card-name">科目余额表</div></div><span class="rpt-card-arrow">›</span></div>
<div class="rpt-card"><div><div class="rpt-card-name">固定vs弹性分析</div></div><span class="rpt-card-arrow">›</span></div>
<div class="rpt-card"><div><div class="rpt-card-name">消费排行榜</div></div><span class="rpt-card-arrow">›</span></div>
<div class="rpt-card"><div><div class="rpt-card-name">预算执行报告</div></div><span class="rpt-card-arrow">›</span></div>
<div class="rpt-card"><div><div class="rpt-card-name">辅助报表（趋势·环比·分布）</div></div><span class="rpt-card-arrow">›</span></div>
</div>

<!-- Page 3: Settings -->
<div id="p3" class="page">
<div class="section-label">功能</div>
${['科目管理','折旧管理','摊销管理','预算管理','待处理事项','导出数据','导入数据','定期记账','标签管理','最近删除','自定义指标','自定义报表'].map(s=>`<div class="set-item"><span>${s}</span><span class="set-item-arrow">›</span></div>`).join('')}
<div class="section-label">系统</div>
${['资产初始化','数据对账','年末结账','编辑历史','安全设置'].map(s=>`<div class="set-item"><span>${s}</span><span class="set-item-arrow">›</span></div>`).join('')}
<div class="set-item"><span>数据库</span><span id="dbp" style="font-size:12px;color:var(--text3)"></span></div>
</div>

<!-- Tab bar -->
<div class="tabbar">
<div class="ti active" onclick="st(0)"><span class="tii">◉</span><span class="til">首页</span></div>
<div class="ti" onclick="st(1)"><span class="tii">◎</span><span class="til">账户</span></div>
<div class="ti" onclick="st(2)"><span class="tii">◒</span><span class="til">报表</span></div>
<div class="ti" onclick="st(3)"><span class="tii">⊙</span><span class="til">设置</span></div>
</div></div>

<script>
function st(i){document.querySelectorAll(".ti").forEach(function(t,x){t.classList.toggle("active",x===i)});document.querySelectorAll(".page").forEach(function(p,x){p.classList.toggle("active",x===i)})}
var Y=new Date().getFullYear(),M=new Date().getMonth()+1,P=Y+"."+String(M).padStart(2,"0");
var AT=${JSON.stringify(ACCT_TYPES)};

// Build dashboard
var p0=document.getElementById("p0");
p0.innerHTML='${heroHtml.replace(/'/g,"\\'").replace(/[\n\r]/g,' ')}';
p0.innerHTML=p0.innerHTML.replace(/<div class="tx-row">[\\s\\S]*<\\/div>\\s*<\\/div>\\s*<\\/div>\\s*$/,'</div>');
p0.innerHTML+='<div class="card"><div class="card-title">最近交易</div><div id="txl" style="font-size:13px;color:var(--text3)">加载中...</div></div>';

(async function(){
if(!window.electronDB){document.getElementById("na")&&(document.getElementById("na").textContent="离线");return}
try{var db=window.electronDB;
var txs=await db.query("SELECT t.*,s.name as sn,a1.name as an FROM transactions t LEFT JOIN accounting_subjects s ON t.subject_id=s.id LEFT JOIN accounts a1 ON t.account_id=a1.id WHERE t.is_deleted=0 ORDER BY t.tx_date DESC LIMIT 50");
var exT=["expense","loan_repay","credit_card_spend","prepaid_amortize","asset_purchase"];
var inT=["income","salary","investment_sell","loan_receive"];
var ms=Y+"-"+String(M).padStart(2,"0")+"-01";
var me=M===12?(Y+1)+"-01-01":Y+"-"+String(M+1).padStart(2,"0")+"-01";
var mt=txs.filter(function(t){return t.txDate>=ms&&t.txDate<me});
var ti=mt.filter(function(t){return inT.includes(t.txType)}).reduce(function(s,t){return s+t.amount},0);
var te=mt.filter(function(t){return exT.includes(t.txType)}).reduce(function(s,t){return s+t.amount},0);
try{var abr=await db.query("SELECT SUM(CASE WHEN je.direction='debit' THEN je.amount ELSE -je.amount END) as bal FROM journal_entries je JOIN accounting_subjects s ON je.subject_id=s.id WHERE s.subject_type='asset'");var ab=Math.abs(abr[0]?.bal||0)}catch(e){var ab=0}
try{var lbr=await db.query("SELECT SUM(CASE WHEN je.direction='credit' THEN je.amount ELSE -je.amount END) as bal FROM journal_entries je JOIN accounting_subjects s ON je.subject_id=s.id WHERE s.subject_type='liability'");var lb=Math.abs(lbr[0]?.bal||0)}catch(e){var lb=0}
var eq=ab-lb;

// Dashboard data
var na=document.getElementById("na");if(na)na.textContent=eq.toFixed(2);
var fi=document.querySelector(".fa.inc");if(fi)fi.textContent="¥"+ti.toFixed(2);
var fe=document.querySelector(".fa.exp");if(fe)fe.textContent="¥"+te.toFixed(2);
var mx=Math.max(ti,te,1);
var feb=document.querySelector(".fbf.exp");if(feb)feb.style.width=Math.round(te/mx*100)+"%";
var hl=document.querySelector(".hero-legend");if(hl)hl.innerHTML='<div class="hero-legend-item"><div class="hl-dot inc-dot"></div><span>收入 ¥'+ti.toFixed(2)+'</span></div><div class="hero-legend-item"><div class="hl-dot exp-dot"></div><span>支出 ¥'+te.toFixed(2)+'</span></div>';
var recent=txs.slice(0,10);
var txh=recent.map(function(t){var isEx=exT.includes(t.txType);var s=isEx?"−":"+";var c=isEx?"ex":"in";return'<div class="tx-row"><div><div style="display:flex;align-items:center;gap:8px"><span class="tx-dot '+c+'">'+(isEx?"支":"收")+'</span><span class="tx-sub">'+(t.sn||"#")+'</span></div><div class="tx-meta">'+t.txDate+' · '+(t.an||"")+(t.note?" · "+t.note:"")+'</div></div><span class="tx-amt '+c+'">'+s+'¥'+Math.abs(t.amount).toFixed(2)+'</span></div>'}).join("")||'<span style="color:var(--text3)">暂无交易</span>';
document.getElementById("txl").innerHTML=txh;

// Accounts data
var accts=await db.query("SELECT a.*,SUM(CASE WHEN je.direction='debit' THEN je.amount ELSE -je.amount END) as bal FROM accounts a LEFT JOIN journal_entries je ON a.id=je.account_id WHERE a.is_active=1 GROUP BY a.id ORDER BY a.subject_code");
var assetList=[],liabilityList=[];
accts.forEach(function(a){var ia=!["credit_card","payable","loan"].includes(a.accountType);var b=ia?(a.bal||0):-(a.bal||0);var typeLabel=AT[a.accountType]||a.accountType;var typeCls=a.accountType==="credit_card"?"cc":a.accountType==="loan"?"loan":"";var card='<div class="acct-card"><div class="acct-card-hd"><span class="acct-card-name">'+a.name+'</span><span class="acct-card-type '+typeCls+'">'+typeLabel+'</span></div>'+(a.bankName?'<div class="acct-card-meta">'+a.bankName+(a.cardLastFour?' · '+a.cardLastFour:'')+'</div>':'')+'<div class="acct-card-bal '+(b>=0?"pos":"neg")+'">¥'+b.toFixed(2)+'</div></div>';if(ia)assetList.push(card);else liabilityList.push(card)});
document.getElementById("asset-accts").innerHTML=assetList.join("")||'<div style="color:var(--text3);padding:10px 0">暂无资产账户</div>';
document.getElementById("liability-accts").innerHTML=liabilityList.join("")||'<div style="color:var(--text3);padding:10px 0">暂无负债账户</div>';

// DB path
if(window.electronDB.getDbPath){var p=await window.electronDB.getDbPath();document.getElementById("dbp").textContent=p}
}catch(e){console.error(e);var na=document.getElementById("na");if(na)na.textContent="错误";var txl=document.getElementById("txl");if(txl)txl.textContent="加载失败: "+e.message}})();
</script></body></html>`;

fs.writeFileSync('d:/accounting app/dist/index.html', html);
console.log('Created dist/index.html:', html.length, 'bytes');
