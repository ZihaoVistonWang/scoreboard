/**
 * 结算报告相关功能
 */

// 初始化结算报告折叠/展开功能
function setupSettlementListeners() {
    const headers = document.querySelectorAll('.settlement-header');
    
    headers.forEach(header => {
        // 移除现有的事件监听器（防止重复添加）
        const newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);
        
        // 添加点击事件
        newHeader.addEventListener('click', function() {
            // 切换当前报告的折叠状态
            this.classList.toggle('collapsed');
            const content = this.nextElementSibling;
            if (content && content.classList.contains('settlement-content')) {
                content.classList.toggle('collapsed');
            }
        });
    });
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 初始化结算报告折叠/展开功能
    setupSettlementListeners();
});

// 导出函数
window.setupSettlementListeners = setupSettlementListeners;