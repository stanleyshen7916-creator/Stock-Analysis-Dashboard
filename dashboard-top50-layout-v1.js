(() => {
  const install=()=>{if(document.getElementById('top50-layout-v1'))return;const s=document.createElement('style');s.id='top50-layout-v1';s.textContent='#page-top50{min-width:0!important;max-width:100%!important}#page-top50 .panel{min-width:0!important;max-width:100%!important}#page-top50 .table-wrap{width:100%!important;max-width:100%!important;min-width:0!important;overflow-x:auto!important}#page-top50 table{min-width:1050px}';document.head.appendChild(s)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
