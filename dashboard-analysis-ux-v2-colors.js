// Color coding for key decision prices. Presentation-only.
(() => {
  const style = document.createElement('style');
  style.textContent = `
    #analysis-production-panel .ux-target-price{color:#dc2626!important;font-size:17px!important;font-weight:900!important}
    #analysis-production-panel .ux-target-price::before{content:'↑ ';font-weight:900}
    #analysis-production-panel .ux-risk-price{color:#059669!important;font-size:17px!important;font-weight:900!important}
    #analysis-production-panel .ux-risk-price::before{content:'↓ ';font-weight:900}
    #analysis-production-panel .ux-technical-factor{background:#eef7ff!important;box-shadow:inset 4px 0 0 #1683e8!important}
    #analysis-production-panel .ux-technical-factor th,#analysis-production-panel .ux-technical-factor td{font-weight:900!important}
    #analysis-production-panel .ux-technical-factor td{color:#087fd8!important;font-size:16px!important}
  `;
  document.head.appendChild(style);
})();
