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
        
        // 获取报告的唯一标识符 (结算次数和时间戳)
        const reportId = newHeader.textContent.trim();
        const roomId = document.querySelector('meta[name="room-id"]')?.content;
        const storageKey = `settlement_${roomId}_${reportId}`;
        
        // 从 localStorage 恢复状态
        const savedState = localStorage.getItem(storageKey);
        if (savedState === 'expanded') {
            newHeader.classList.remove('collapsed');
            const content = newHeader.nextElementSibling;
            if (content && content.classList.contains('settlement-content')) {
                content.classList.remove('collapsed');
            }
        }
        
        // 添加点击事件
        newHeader.addEventListener('click', function() {
            // 切换当前报告的折叠状态
            this.classList.toggle('collapsed');
            const content = this.nextElementSibling;
            if (content && content.classList.contains('settlement-content')) {
                content.classList.toggle('collapsed');
                
                // 保存状态到 localStorage
                if (content.classList.contains('collapsed')) {
                    localStorage.setItem(storageKey, 'collapsed');
                } else {
                    localStorage.setItem(storageKey, 'expanded');
                }
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