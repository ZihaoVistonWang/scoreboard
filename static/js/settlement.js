function getSettlementId(header) {
    const text = header.textContent;
    const match = text.match(/第(\d+)次结算报告/);
    return match ? match[1] : null;
}

function setupSettlementListeners() {
    const settlementHeaders = document.querySelectorAll('.settlement-header');
    const settlementContents = document.querySelectorAll('.settlement-content');

    // 为每个结算报告设置状态
    settlementHeaders.forEach((header, index) => {
        const content = settlementContents[index];
        const settlementId = getSettlementId(header);
        
        if (settlementId) {
            const isExpanded = localStorage.getItem(`settlement_${settlementId}`) === 'expanded';
            
            if (isExpanded) {
                header.classList.remove('collapsed');
                content.classList.remove('collapsed');
            } else {
                header.classList.add('collapsed');
                content.classList.add('collapsed');
            }
        }

        // 移除旧的事件监听器（如果有）
        header.removeEventListener('click', toggleSettlement);
        // 添加新的事件监听器
        header.addEventListener('click', toggleSettlement);
    });
}

function toggleSettlement() {
    const content = this.nextElementSibling;
    this.classList.toggle('collapsed');
    content.classList.toggle('collapsed');
    
    // 保存展开状态到localStorage
    const settlementId = getSettlementId(this);
    if (settlementId) {
        const isExpanded = !this.classList.contains('collapsed');
        localStorage.setItem(`settlement_${settlementId}`, isExpanded ? 'expanded' : 'collapsed');
    }
}

document.addEventListener('DOMContentLoaded', setupSettlementListeners);

// 创建一个MutationObserver来监听结算报告的变化
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && 
            mutation.target.id === 'settlement-reports') {
            setupSettlementListeners();
        }
    });
});

// 在DOM加载完成后开始观察
document.addEventListener('DOMContentLoaded', () => {
    const reportsContainer = document.getElementById('settlement-reports');
    if (reportsContainer) {
        observer.observe(reportsContainer, {
            childList: true,
            subtree: true
        });
    }
});